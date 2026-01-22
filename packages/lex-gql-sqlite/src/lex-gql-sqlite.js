/**
 * SQLite adapter for lex-gql
 */

import { DEFAULT_SORT, hydrateRecord } from 'lex-gql';

/**
 * SQL schema for lex-gql records
 */
export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT UNIQUE NOT NULL,
    did TEXT NOT NULL,
    collection TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT,
    record TEXT NOT NULL,
    indexed_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);
  CREATE INDEX IF NOT EXISTS idx_records_did ON records(did);
  CREATE INDEX IF NOT EXISTS idx_records_uri ON records(uri);

  CREATE TABLE IF NOT EXISTS actors (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL
  );
`;

/**
 * Set up the required database schema for lex-gql-sqlite
 * @param {import('better-sqlite3').Database} db
 */
export function setupSchema(db) {
  db.exec(SCHEMA_SQL);
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
 * @property {(record: RecordInput) => void} insertRecord - Insert or replace a record
 * @property {(uri: string) => void} deleteRecord - Delete a record by URI
 * @property {(did: string, handle: string) => void} upsertActor - Insert or replace an actor
 */

/**
 * Create a writer with prepared statements for efficient writes
 * @param {import('better-sqlite3').Database} db
 * @returns {Writer}
 */
export function createWriter(db) {
  const insertRecordStmt = db.prepare(`
    INSERT OR REPLACE INTO records (uri, did, collection, rkey, cid, record, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteRecordStmt = db.prepare(`
    DELETE FROM records WHERE uri = ?
  `);

  const upsertActorStmt = db.prepare(`
    INSERT OR REPLACE INTO actors (did, handle) VALUES (?, ?)
  `);

  return {
    insertRecord: ({ uri, cid, record, indexedAt }) => {
      const { did, collection, rkey } = parseAtUri(uri);
      const recordJson = typeof record === 'string' ? record : JSON.stringify(record);
      const timestamp = indexedAt || new Date().toISOString();
      insertRecordStmt.run(uri, did, collection, rkey, cid || null, recordJson, timestamp);
    },
    deleteRecord: (uri) => {
      deleteRecordStmt.run(uri);
    },
    upsertActor: (did, handle) => {
      upsertActorStmt.run(did, handle);
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
      console.debug('lex-gql-sqlite: Invalid cursor structure');
      return null;
    }

    // Validate field count matches sort configuration
    const expectedCount = sortFields?.length || 1;
    if (parsed.v.length !== expectedCount) {
      console.debug(
        `lex-gql-sqlite: Cursor field count mismatch (got ${parsed.v.length}, expected ${expectedCount})`,
      );
      return null;
    }

    return { fieldValues: parsed.v, uri: parsed.u };
  } catch (err) {
    console.debug('lex-gql-sqlite: Failed to decode cursor:', /** @type {Error} */ (err).message);
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
  return SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;
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

    // Handle AND/OR logical operators
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

    // Field conditions require a field name
    if (!field) continue;

    const fieldPath = SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;

    switch (op) {
      case 'eq':
        parts.push(`${fieldPath} = ?`);
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
        parts.push(`${fieldPath} > ?`);
        params.push(value);
        break;
      case 'gte':
        parts.push(`${fieldPath} >= ?`);
        params.push(value);
        break;
      case 'lt':
        parts.push(`${fieldPath} < ?`);
        params.push(value);
        break;
      case 'lte':
        parts.push(`${fieldPath} <= ?`);
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
    const fieldPath = SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;
    return `${fieldPath} ${dir.toUpperCase()}`;
  });

  // Add URI as tiebreaker using direction of last sort field
  const lastDir = sort[sort.length - 1]?.dir || 'asc';
  sortClauses.push(`r.uri ${lastDir.toUpperCase()}`);

  return sortClauses.join(', ');
}

/**
 * Create a SQLite query adapter for lex-gql
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @returns {(op: import('lex-gql').Operation) => Promise<any>}
 */
export function createSqliteAdapter(db) {
  return async function query(op) {
    if (op.type === 'findMany') {
      return findMany(db, op);
    }
    if (op.type === 'aggregate') {
      return aggregate(db, op);
    }
    throw new Error(`Not implemented: ${op.type}`);
  };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {any} op
 */
function findMany(db, op) {
  const { collection, where = [], sort = [], pagination = {} } = op;
  const { first = 20, after, last, before } = pagination;

  // Build WHERE clause
  // Special case: collection '*' means query across all collections (for URI resolution)
  const collectionFilter =
    collection === '*' ? [] : [{ field: 'collection', op: 'eq', value: collection }];
  const { sql: whereSql, params: whereParams } = buildWhere([...collectionFilter, ...where]);

  // Handle cursor pagination
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

  // Build ORDER BY
  const orderBy = buildOrderBy(sort);

  // Build query
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

  const rawRows = db.prepare(sql).all(...allParams);
  const hasMore = rawRows.length > (first || last || 20);
  const rows = hasMore ? rawRows.slice(0, -1) : rawRows;

  // Transform rows
  const transformed = rows.map((/** @type {any} */ row) => ({
    ...hydrateRecord({
      uri: row.uri,
      did: row.did,
      collection: row.collection,
      cid: row.cid,
      record: row.record,
      indexed_at: row.indexed_at,
      handle: row.handle,
    }),
    _id: row.id,
  }));

  // Get total count (without pagination)
  const countSql = `SELECT COUNT(*) as count FROM records r LEFT JOIN actors a ON r.did = a.did WHERE ${whereSql}`;
  /** @type {{count: number}} */
  const countResult = /** @type {any} */ (db.prepare(countSql).get(...whereParams));

  return {
    rows: transformed,
    hasNext: first ? hasMore : !!before,
    hasPrev: !!after || (last ? hasMore : false),
    totalCount: countResult.count,
  };
}

/**
 * Get the SQL expression for a field
 * @param {string} field
 * @returns {string}
 */
function getFieldExpression(field) {
  return SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;
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
    return { expr: `date(${path})`, alias: field };
  }
  if (weekMatch) {
    const base = weekMatch[1];
    const path = getFieldExpression(base);
    return { expr: `strftime('%Y-%W', ${path})`, alias: field };
  }
  if (monthMatch) {
    const base = monthMatch[1];
    const path = getFieldExpression(base);
    return { expr: `strftime('%Y-%m', ${path})`, alias: field };
  }

  const expr = getFieldExpression(field);
  return { expr, alias: field };
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {any} op
 */
function aggregate(db, op) {
  const {
    collection,
    where = [],
    groupBy = [],
    limit = 50,
    orderBy = 'COUNT_DESC',
    arrayFields = [],
  } = op;

  // Cap limit at 1000
  const effectiveLimit = Math.min(limit, 1000);
  const orderDirection = orderBy === 'COUNT_ASC' ? 'ASC' : 'DESC';

  const { sql: whereSql, params } = buildWhere([
    { field: 'collection', op: 'eq', value: collection },
    ...where,
  ]);

  if (groupBy.length === 0) {
    const sql = `SELECT COUNT(*) as count FROM records r LEFT JOIN actors a ON r.did = a.did WHERE ${whereSql}`;
    /** @type {{count: number}} */
    const result = /** @type {any} */ (db.prepare(sql).get(...params));
    return { count: result.count, groups: [] };
  }

  const groupExpressions = groupBy.map((/** @type {string} */ f) => getGroupByExpression(f));

  const groupFields = groupExpressions
    .map((/** @type {{ expr: string, alias: string }} */ { expr, alias }) => `${expr} as ${alias}`)
    .join(', ');

  const groupByClause = groupExpressions
    .map((/** @type {{ expr: string }} */ { expr }) => expr)
    .join(', ');

  // Build array field selections using MAX to get a sample value from each group
  const arrayFieldSelects = arrayFields
    .map((/** @type {string} */ f) => `MAX(json_extract(r.record, '$.${f}')) as ${f}`)
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
  const rawGroups = /** @type {any} */ (db.prepare(sql).all(...params, effectiveLimit));

  // Parse JSON array fields back into actual arrays
  const groups = rawGroups.map((group) => {
    const parsed = { ...group };
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
