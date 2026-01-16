/**
 * SQLite adapter for lex-gql
 */

import { hydrateRecord } from 'lex-gql';

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

const SYSTEM_FIELDS = {
  did: 'r.did',
  uri: 'r.uri',
  collection: 'r.collection',
  cid: 'r.cid',
  indexedAt: 'r.indexed_at',
};

/**
 * Build SQL WHERE clause from lex-gql where conditions
 * @param {Array<{field: string, op: string, value: any}>} where
 * @returns {{ sql: string, params: any[] }}
 */
export function buildWhere(where) {
  if (!where || where.length === 0) {
    return { sql: '1=1', params: [] };
  }

  const parts = [];
  const params = [];

  for (const clause of where) {
    const { field, op, value } = clause;

    // Handle AND/OR
    if (field === 'AND' || op === 'and') {
      const subClauses = value.map((sub) => buildWhere(sub));
      const subSql = subClauses.map((s) => s.sql).join(' AND ');
      parts.push(`(${subSql})`);
      subClauses.forEach((s) => params.push(...s.params));
      continue;
    }

    if (field === 'OR' || op === 'or') {
      const subClauses = value.map((sub) => buildWhere(sub));
      const subSql = subClauses.map((s) => s.sql).join(' OR ');
      parts.push(`(${subSql})`);
      subClauses.forEach((s) => params.push(...s.params));
      continue;
    }

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
      case 'contains':
        parts.push(`${fieldPath} LIKE ?`);
        params.push(`%${value}%`);
        break;
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
    return 'r.id DESC';
  }

  return sort.map(({ field, dir = 'asc' }) => {
    const fieldPath = SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;
    return `${fieldPath} ${dir.toUpperCase()}`;
  }).join(', ');
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

function findMany(db, op) {
  const { collection, where = [], sort = [], pagination = {} } = op;
  const { first = 20, after, last, before } = pagination;

  // Build WHERE clause
  const { sql: whereSql, params: whereParams } = buildWhere([
    { field: 'collection', op: 'eq', value: collection },
    ...where,
  ]);

  // Handle cursor pagination
  const cursorConditions = [];
  const cursorParams = [];

  if (after) {
    try {
      const cursor = JSON.parse(Buffer.from(after, 'base64').toString());
      if (cursor.id) {
        cursorConditions.push('r.id < ?');
        cursorParams.push(cursor.id);
      }
    } catch {}
  }

  if (before) {
    try {
      const cursor = JSON.parse(Buffer.from(before, 'base64').toString());
      if (cursor.id) {
        cursorConditions.push('r.id > ?');
        cursorParams.push(cursor.id);
      }
    } catch {}
  }

  const fullWhere = cursorConditions.length > 0
    ? `${whereSql} AND ${cursorConditions.join(' AND ')}`
    : whereSql;

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
  const transformed = rows.map((row) => ({
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

  return {
    rows: transformed,
    hasNext: first ? hasMore : !!before,
    hasPrev: !!after || (last ? hasMore : false),
  };
}

function aggregate(db, op) {
  const { collection, where = [], groupBy = [] } = op;

  const { sql: whereSql, params } = buildWhere([
    { field: 'collection', op: 'eq', value: collection },
    ...where,
  ]);

  if (groupBy.length === 0) {
    const sql = `SELECT COUNT(*) as count FROM records r WHERE ${whereSql}`;
    const result = db.prepare(sql).get(...params);
    return { count: result.count, groups: [] };
  }

  const groupFields = groupBy.map((f) => {
    const fieldPath = SYSTEM_FIELDS[f] || `json_extract(r.record, '$.${f}')`;
    return `${fieldPath} as ${f}`;
  }).join(', ');

  const groupByClause = groupBy.map((f) => {
    return SYSTEM_FIELDS[f] || `json_extract(r.record, '$.${f}')`;
  }).join(', ');

  const sql = `
    SELECT ${groupFields}, COUNT(*) as count
    FROM records r
    WHERE ${whereSql}
    GROUP BY ${groupByClause}
    ORDER BY count DESC
    LIMIT 100
  `;

  const groups = db.prepare(sql).all(...params);
  const count = groups.reduce((sum, g) => sum + g.count, 0);

  return { count, groups };
}
