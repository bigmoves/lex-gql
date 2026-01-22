/**
 * DuckDB adapter for lex-gql
 *
 * Optimized for analytics-heavy workloads with ~17x faster aggregate queries
 * compared to SQLite on large datasets.
 */

import { promisify } from 'node:util';
import duckdb from 'duckdb';
import { DEFAULT_SORT, hydrateRecord } from 'lex-gql';

/**
 * SQL schema for lex-gql records
 */
export const SCHEMA_SQL = `
  CREATE SEQUENCE IF NOT EXISTS records_id_seq;

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER DEFAULT nextval('records_id_seq'),
    uri TEXT UNIQUE NOT NULL,
    did TEXT NOT NULL,
    collection TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT,
    record JSON NOT NULL,
    indexed_at TIMESTAMP NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);
  CREATE INDEX IF NOT EXISTS idx_records_did ON records(did);

  CREATE TABLE IF NOT EXISTS actors (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL
  );
`;

/**
 * @typedef {Object} DuckDBConnection
 * @property {duckdb.Database} db - The DuckDB database instance
 * @property {duckdb.Connection} conn - The connection instance
 * @property {(sql: string, ...params: any[]) => Promise<void>} run - Execute a statement
 * @property {(sql: string, ...params: any[]) => Promise<any[]>} all - Query all rows
 * @property {(sql: string, ...params: any[]) => Promise<any>} get - Query single row
 */

/**
 * Create a promisified DuckDB connection
 * @param {string} dbPath - Path to database file (use ':memory:' for in-memory)
 * @returns {Promise<DuckDBConnection>}
 */
export async function createDuckDB(dbPath) {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(dbPath, (err) => {
      if (err) return reject(err);

      const conn = db.connect();

      /** @type {(sql: string, ...params: any[]) => Promise<void>} */
      const run = /** @type {any} */ (promisify(conn.run.bind(conn)));
      /** @type {(sql: string, ...params: any[]) => Promise<any[]>} */
      const all = /** @type {any} */ (promisify(conn.all.bind(conn)));
      /** @type {(sql: string, ...params: any[]) => Promise<any>} */
      const get = (sql, ...params) => all(sql, ...params).then((rows) => rows[0]);

      resolve({ db, conn, run, all, get });
    });
  });
}

/**
 * Set up the required database schema for lex-gql-duckdb
 * @param {DuckDBConnection} conn
 */
export async function setupSchema(conn) {
  const statements = SCHEMA_SQL.split(';').filter((s) => s.trim());
  for (const stmt of statements) {
    await conn.run(stmt);
  }
}

/**
 * Parse an AT URI into its components
 * @param {string} uri - AT URI (at://did/collection/rkey)
 * @returns {{ did: string, collection: string, rkey: string }}
 */
function parseAtUri(uri) {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid AT URI: ${uri}`);
  }
  return { did: match[1], collection: match[2], rkey: match[3] };
}

/**
 * @typedef {Object} RecordInput
 * @property {string} uri - Record URI (at://did/collection/rkey)
 * @property {string} [cid] - Record CID
 * @property {object} record - Record data (will be JSON stringified)
 * @property {string} [indexedAt] - Timestamp (defaults to now)
 */

/**
 * @typedef {Object} Writer
 * @property {(record: RecordInput) => Promise<void>} insertRecord - Insert or replace a record
 * @property {(records: RecordInput[]) => Promise<void>} insertRecordsBatch - Insert multiple records in a single statement
 * @property {(uri: string) => Promise<void>} deleteRecord - Delete a record by URI
 * @property {(did: string, handle: string) => Promise<void>} upsertActor - Insert or replace an actor
 */

/**
 * Create a writer with methods for efficient writes
 * @param {DuckDBConnection} conn
 * @returns {Writer}
 */
export function createWriter(conn) {
  return {
    insertRecord: async ({ uri, cid, record, indexedAt }) => {
      const { did, collection, rkey } = parseAtUri(uri);
      const recordJson = typeof record === 'string' ? record : JSON.stringify(record);
      const timestamp = indexedAt || new Date().toISOString();

      await conn.run(
        `
        INSERT INTO records (uri, did, collection, rkey, cid, record, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (uri) DO UPDATE SET
          did = EXCLUDED.did,
          collection = EXCLUDED.collection,
          rkey = EXCLUDED.rkey,
          cid = EXCLUDED.cid,
          record = EXCLUDED.record,
          indexed_at = EXCLUDED.indexed_at
      `,
        uri,
        did,
        collection,
        rkey,
        cid || null,
        recordJson,
        timestamp,
      );
    },

    insertRecordsBatch: async (records) => {
      if (records.length === 0) return;

      const now = new Date().toISOString();
      const rows = records.map(({ uri, cid, record, indexedAt }) => {
        const { did, collection, rkey } = parseAtUri(uri);
        const recordJson = typeof record === 'string' ? record : JSON.stringify(record);
        return [uri, did, collection, rkey, cid || null, recordJson, indexedAt || now];
      });

      // Build a single INSERT with multiple VALUES for ~10x faster performance
      const placeholders = rows.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
      const params = rows.flat();

      await conn.run(
        `
        INSERT INTO records (uri, did, collection, rkey, cid, record, indexed_at)
        VALUES ${placeholders}
        ON CONFLICT (uri) DO UPDATE SET
          did = EXCLUDED.did,
          collection = EXCLUDED.collection,
          rkey = EXCLUDED.rkey,
          cid = EXCLUDED.cid,
          record = EXCLUDED.record,
          indexed_at = EXCLUDED.indexed_at
      `,
        ...params,
      );
    },

    deleteRecord: async (uri) => {
      await conn.run('DELETE FROM records WHERE uri = ?', uri);
    },

    upsertActor: async (did, handle) => {
      await conn.run(
        `
        INSERT INTO actors (did, handle) VALUES (?, ?)
        ON CONFLICT (did) DO UPDATE SET handle = EXCLUDED.handle
      `,
        did,
        handle,
      );
    },
  };
}

/** @type {Record<string, string>} */
const SYSTEM_FIELDS = {
  did: 'r.did',
  uri: 'r.uri',
  collection: 'r.collection',
  cid: 'r.cid',
  indexedAt: 'r.indexed_at',
  actorHandle: 'a.handle',
};

/**
 * Decode a sort-field-aware cursor
 * @param {string} cursor - Base64 encoded cursor
 * @param {Array<{field: string, dir?: string}>} sortFields - Sort configuration
 * @returns {{ fieldValues: any[], uri: string } | null}
 */
function decodeCursor(cursor, sortFields) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    const parsed = JSON.parse(decoded);

    // Validate cursor structure
    if (!parsed.v || !Array.isArray(parsed.v) || !parsed.u) {
      console.debug('lex-gql-duckdb: Invalid cursor structure');
      return null;
    }

    // Validate field count matches sort configuration
    const expectedCount = sortFields?.length || 1;
    if (parsed.v.length !== expectedCount) {
      console.debug(
        `lex-gql-duckdb: Cursor field count mismatch (got ${parsed.v.length}, expected ${expectedCount})`,
      );
      return null;
    }

    return { fieldValues: parsed.v, uri: parsed.u };
  } catch (err) {
    console.debug('lex-gql-duckdb: Failed to decode cursor:', /** @type {Error} */ (err).message);
    return null;
  }
}

/**
 * Get SQL comparison operator based on sort direction and cursor type
 * @param {string | undefined} direction - Sort direction ('asc' or 'desc')
 * @param {boolean} isBefore - Whether this is a 'before' cursor
 * @returns {string}
 */
function getComparisonOp(direction, isBefore) {
  const isDesc = direction?.toLowerCase() === 'desc';
  return isBefore ? (isDesc ? '>' : '<') : isDesc ? '<' : '>';
}

/**
 * Get SQL expression for a field, handling system vs record fields
 * @param {string} field - Field name
 * @returns {string}
 */
function fieldToSqlExpr(field) {
  // Validate field name to prevent SQL injection (defense-in-depth)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Invalid field name: ${field}`);
  }
  return SYSTEM_FIELDS[field] || `json_extract_string(r.record, '$.${field}')`;
}

/**
 * Build WHERE clause for cursor pagination with sort field awareness
 * @param {string} cursor - Base64 encoded cursor
 * @param {Array<{field: string, dir?: string}>} sortFields - Sort configuration
 * @param {boolean} isBefore - Whether this is a 'before' cursor
 * @returns {{ sql: string, params: any[] }}
 */
function buildCursorWhere(cursor, sortFields, isBefore) {
  // Default to indexedAt DESC if no sort fields specified
  const effectiveSort = sortFields && sortFields.length > 0 ? sortFields : DEFAULT_SORT;

  const decoded = decodeCursor(cursor, effectiveSort);
  if (!decoded || decoded.fieldValues.length === 0) {
    return { sql: '1=1', params: [] };
  }

  const clauses = [];
  const params = [];

  // Build progressive OR clauses for multi-field sort
  // For sort [A DESC, B ASC], after cursor [a_val, b_val, uri]:
  // (A < a_val) OR (A = a_val AND B > b_val) OR (A = a_val AND B = b_val AND uri < uri_val)
  for (let i = 0; i < effectiveSort.length; i++) {
    const clauseParts = [];
    const clauseParams = [];

    // Add equality for all prior fields
    for (let j = 0; j < i; j++) {
      clauseParts.push(`${fieldToSqlExpr(effectiveSort[j].field)} = ?`);
      clauseParams.push(decoded.fieldValues[j]);
    }

    // Add comparison for current field
    const op = getComparisonOp(effectiveSort[i].dir, isBefore);
    clauseParts.push(`${fieldToSqlExpr(effectiveSort[i].field)} ${op} ?`);
    clauseParams.push(decoded.fieldValues[i]);

    clauses.push(`(${clauseParts.join(' AND ')})`);
    params.push(...clauseParams);
  }

  // Final clause: all sort fields equal, compare by URI (tiebreaker)
  const allEqualParts = effectiveSort.map((s) => {
    return `${fieldToSqlExpr(s.field)} = ?`;
  });
  const lastDir = effectiveSort[effectiveSort.length - 1]?.dir || 'desc';
  const uriOp = getComparisonOp(lastDir, isBefore);
  allEqualParts.push(`r.uri ${uriOp} ?`);

  clauses.push(`(${allEqualParts.join(' AND ')})`);
  params.push(...decoded.fieldValues, decoded.uri);

  return { sql: `(${clauses.join(' OR ')})`, params };
}

/**
 * Convert a JSON field to timestamp, handling both ISO strings and Unix timestamps
 * @param {string} path - The JSON field path expression
 * @returns {string} - SQL expression that returns a timestamp
 */
function toTimestamp(path) {
  // Handle Unix timestamps (seconds or milliseconds) and ISO strings
  // - If numeric and > 10 billion, it's milliseconds -> divide by 1000
  // - If numeric and smaller, it's seconds
  // - Otherwise try to cast as timestamp (ISO string)
  return `CASE
    WHEN TRY_CAST(${path} AS BIGINT) IS NOT NULL AND CAST(${path} AS BIGINT) > 10000000000
    THEN to_timestamp(CAST(${path} AS BIGINT) / 1000)
    WHEN TRY_CAST(${path} AS BIGINT) IS NOT NULL
    THEN to_timestamp(CAST(${path} AS BIGINT))
    ELSE TRY_CAST(${path} AS TIMESTAMP)
  END`;
}

/**
 * Build SQL WHERE clause from lex-gql where conditions
 * @param {import('lex-gql').WhereClause[]} where
 * @returns {{ sql: string, params: any[] }}
 */
export function buildWhere(where) {
  if (!where || where.length === 0) {
    return { sql: '1=1', params: [] };
  }

  const parts = [];
  const params = [];

  for (const clause of where) {
    const { field, op, value, conditions } = clause;

    if (op === 'and' && conditions) {
      /** @type {Array<{sql: string, params: any[]}>} */
      const subClauses = conditions.map((/** @type {any} */ sub) => buildWhere(sub));
      const subSql = subClauses.map((s) => s.sql).join(' AND ');
      parts.push(`(${subSql})`);
      for (const s of subClauses) {
        params.push(...s.params);
      }
      continue;
    }

    if (op === 'or' && conditions) {
      /** @type {Array<{sql: string, params: any[]}>} */
      const subClauses = conditions.map((/** @type {any} */ sub) => buildWhere(sub));
      const subSql = subClauses.map((s) => s.sql).join(' OR ');
      parts.push(`(${subSql})`);
      for (const s of subClauses) {
        params.push(...s.params);
      }
      continue;
    }

    if (!field) continue;

    // DuckDB uses json_extract_string for JSON text extraction
    const rawFieldPath = SYSTEM_FIELDS[field] || `json_extract_string(r.record, '$.${field}')`;

    // Check if value looks like an ISO date (for date comparisons)
    const isDateValue = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);

    // For date comparisons, convert field to timestamp
    const fieldPath = isDateValue ? `(${toTimestamp(rawFieldPath)})` : rawFieldPath;

    // For date comparisons, also cast the value to timestamp
    const compareValue = isDateValue ? `CAST(? AS TIMESTAMP)` : '?';

    switch (op) {
      case 'eq':
        parts.push(`${fieldPath} = ${compareValue}`);
        params.push(value);
        break;
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          parts.push(`${fieldPath} IN (${placeholders})`);
          params.push(...value);
        }
        break;
      case 'contains': {
        parts.push(`${fieldPath} LIKE ? ESCAPE '\\'`);
        // Escape LIKE wildcards (% and _) in the search value
        const escapedValue = String(value).replace(/[%_\\]/g, '\\$&');
        params.push(`%${escapedValue}%`);
        break;
      }
      case 'gt':
        parts.push(`${fieldPath} > ${compareValue}`);
        params.push(value);
        break;
      case 'gte':
        parts.push(`${fieldPath} >= ${compareValue}`);
        params.push(value);
        break;
      case 'lt':
        parts.push(`${fieldPath} < ${compareValue}`);
        params.push(value);
        break;
      case 'lte':
        parts.push(`${fieldPath} <= ${compareValue}`);
        params.push(value);
        break;
    }
  }

  return {
    sql: parts.length > 0 ? parts.join(' AND ') : '1=1',
    params,
  };
}

/**
 * Build SQL ORDER BY clause from lex-gql sort conditions
 * @param {Array<{field: string, dir?: string}>} sort
 * @returns {string}
 */
export function buildOrderBy(sort) {
  if (!sort || sort.length === 0) {
    return 'r.indexed_at DESC, r.uri DESC';
  }

  const sortClauses = sort.map(({ field, dir = 'asc' }) => {
    const fieldPath = SYSTEM_FIELDS[field] || `json_extract_string(r.record, '$.${field}')`;
    return `${fieldPath} ${dir.toUpperCase()}`;
  });

  // Add URI as tiebreaker using direction of last sort field
  const lastDir = sort[sort.length - 1]?.dir || 'asc';
  sortClauses.push(`r.uri ${lastDir.toUpperCase()}`);

  return sortClauses.join(', ');
}

/**
 * Get SQL expression for a field (DuckDB JSON syntax)
 * @param {string} field
 * @returns {string}
 */
function getFieldExpression(field) {
  return SYSTEM_FIELDS[field] || `json_extract_string(r.record, '$.${field}')`;
}

/**
 * Get SQL expression for a groupBy field, handling date interval suffixes
 * @param {string} field
 * @returns {{ expr: string, alias: string }}
 */
function getGroupByExpression(field) {
  const dayMatch = field.match(/^(.+)_day$/);
  const weekMatch = field.match(/^(.+)_week$/);
  const monthMatch = field.match(/^(.+)_month$/);

  if (dayMatch) {
    const base = dayMatch[1];
    const path = getFieldExpression(base);
    const ts = toTimestamp(path);
    return { expr: `strftime(CAST((${ts}) AS DATE), '%Y-%m-%d')`, alias: field };
  }
  if (weekMatch) {
    const base = weekMatch[1];
    const path = getFieldExpression(base);
    const ts = toTimestamp(path);
    return { expr: `strftime(date_trunc('week', (${ts})), '%Y-%W')`, alias: field };
  }
  if (monthMatch) {
    const base = monthMatch[1];
    const path = getFieldExpression(base);
    const ts = toTimestamp(path);
    return { expr: `strftime(date_trunc('month', (${ts})), '%Y-%m')`, alias: field };
  }

  const expr = getFieldExpression(field);
  return { expr, alias: field };
}

/**
 * Create a DuckDB query adapter for lex-gql
 * @param {DuckDBConnection} conn - DuckDB connection from createDuckDB()
 * @returns {(op: import('lex-gql').Operation) => Promise<any>}
 */
export function createDuckDBAdapter(conn) {
  return async function query(op) {
    if (op.type === 'findMany') {
      return findMany(conn, op);
    }
    if (op.type === 'aggregate') {
      return aggregate(conn, op);
    }
    throw new Error(`Not implemented: ${op.type}`);
  };
}

/**
 * @param {DuckDBConnection} conn
 * @param {any} op
 */
async function findMany(conn, op) {
  const { collection, where = [], sort = [], pagination = {} } = op;
  const { first = 20, after, last, before } = pagination;

  const collectionFilter =
    collection === '*' ? [] : [{ field: 'collection', op: 'eq', value: collection }];
  const { sql: whereSql, params: whereParams } = buildWhere([...collectionFilter, ...where]);

  const cursorConditions = [];
  const cursorParams = [];

  if (after) {
    const cursorWhere = buildCursorWhere(after, sort, false);
    if (cursorWhere.sql !== '1=1') {
      cursorConditions.push(cursorWhere.sql);
      cursorParams.push(...cursorWhere.params);
    }
  }

  if (before) {
    const cursorWhere = buildCursorWhere(before, sort, true);
    if (cursorWhere.sql !== '1=1') {
      cursorConditions.push(cursorWhere.sql);
      cursorParams.push(...cursorWhere.params);
    }
  }

  const fullWhere =
    cursorConditions.length > 0 ? `${whereSql} AND ${cursorConditions.join(' AND ')}` : whereSql;

  const allParams = [...whereParams, ...cursorParams];
  const orderBy = buildOrderBy(sort);
  const limit = (first || last || 20) + 1;

  const sql = `
    SELECT r.id, r.uri, r.did, r.collection, r.rkey, r.cid, r.record, r.indexed_at, a.handle
    FROM records r
    LEFT JOIN actors a ON r.did = a.did
    WHERE ${fullWhere}
    ORDER BY ${orderBy}
    LIMIT ?
  `;
  allParams.push(limit);

  const rawRows = await conn.all(sql, ...allParams);
  const hasMore = rawRows.length > (first || last || 20);
  const rows = hasMore ? rawRows.slice(0, -1) : rawRows;

  const transformed = rows.map((/** @type {any} */ row) => ({
    ...hydrateRecord({
      uri: row.uri,
      did: row.did,
      collection: row.collection,
      cid: row.cid,
      record: typeof row.record === 'string' ? row.record : JSON.stringify(row.record),
      indexed_at: row.indexed_at,
      handle: row.handle,
    }),
    _id: row.id,
  }));

  const countSql = `SELECT COUNT(*) as count FROM records r LEFT JOIN actors a ON r.did = a.did WHERE ${whereSql}`;
  const countResult = await conn.get(countSql, ...whereParams);

  return {
    rows: transformed,
    hasNext: first ? hasMore : !!before,
    hasPrev: !!after || (last ? hasMore : false),
    totalCount: Number(countResult.count),
  };
}

/**
 * @param {DuckDBConnection} conn
 * @param {any} op
 */
async function aggregate(conn, op) {
  const {
    collection,
    where = [],
    groupBy = [],
    limit = 50,
    orderBy = 'COUNT_DESC',
    arrayFields = [],
  } = op;

  const effectiveLimit = Math.min(limit, 1000);
  const orderDirection = orderBy === 'COUNT_ASC' ? 'ASC' : 'DESC';

  const { sql: whereSql, params } = buildWhere([
    { field: 'collection', op: 'eq', value: collection },
    ...where,
  ]);

  if (groupBy.length === 0) {
    const sql = `SELECT COUNT(*) as count FROM records r LEFT JOIN actors a ON r.did = a.did WHERE ${whereSql}`;
    const result = await conn.get(sql, ...params);
    return { count: Number(result.count), groups: [] };
  }

  const groupExpressions = groupBy.map((/** @type {string} */ f) => getGroupByExpression(f));

  const groupFields = groupExpressions
    .map(
      (/** @type {{ expr: string, alias: string }} */ { expr, alias }) => `${expr} as "${alias}"`,
    )
    .join(', ');

  const groupByClause = groupExpressions
    .map((/** @type {{ expr: string }} */ { expr }) => expr)
    .join(', ');

  // Build array field selections using MAX to get a sample value from each group
  const arrayFieldSelects = arrayFields
    .map((/** @type {string} */ f) => `MAX(json_extract_string(r.record, '$.${f}')) as "${f}"`)
    .join(', ');

  const selectClause = arrayFieldSelects
    ? `${groupFields}, ${arrayFieldSelects}, COUNT(*) as count`
    : `${groupFields}, COUNT(*) as count`;

  const sql = `
    SELECT ${selectClause}
    FROM records r
    LEFT JOIN actors a ON r.did = a.did
    WHERE ${whereSql}
    GROUP BY ${groupByClause}
    ORDER BY count ${orderDirection}
    LIMIT ?
  `;

  /** @type {Array<{count: number, [key: string]: any}>} */
  const rawGroups = /** @type {any} */ (await conn.all(sql, ...params, effectiveLimit));

  // Parse JSON array fields back into actual arrays
  const groups = rawGroups.map((group) => {
    /** @type {Record<string, any>} */
    const parsed = { ...group, count: Number(group.count) };
    for (const field of arrayFields) {
      if (parsed[field] && typeof parsed[field] === 'string') {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch {
          // Keep as-is if not valid JSON
        }
      }
    }
    return parsed;
  });

  const count = groups.reduce((sum, g) => sum + g.count, 0);

  return { count, groups };
}
