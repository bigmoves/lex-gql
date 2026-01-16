/**
 * SQLite adapter for lex-gql
 */

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
    throw new Error(`Not implemented: ${op.type}`);
  };
}
