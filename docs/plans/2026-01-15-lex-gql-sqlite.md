# lex-gql-sqlite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable SQLite adapter package for lex-gql with full query support.

**Architecture:** Hexagonal adapter that implements the lex-gql query port interface. Takes a better-sqlite3 database instance and returns a query function. Supports nested AND/OR where clauses, all filter operators, multi-field sorting, and bidirectional cursor pagination.

**Tech Stack:** better-sqlite3, lex-gql (peer dependency), vitest for tests

---

### Task 1: Create package structure

**Files:**
- Create: `packages/lex-gql-sqlite/package.json`
- Create: `packages/lex-gql-sqlite/tsconfig.json`
- Create: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Create package.json**

```json
{
  "name": "lex-gql-sqlite",
  "version": "0.1.0",
  "description": "SQLite adapter for lex-gql",
  "type": "module",
  "main": "lex-gql-sqlite.js",
  "types": "lex-gql-sqlite.d.ts",
  "exports": {
    ".": {
      "types": "./lex-gql-sqlite.d.ts",
      "default": "./lex-gql-sqlite.js"
    }
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc"
  },
  "keywords": ["graphql", "atproto", "lexicon", "sqlite", "adapter"],
  "license": "MIT",
  "peerDependencies": {
    "better-sqlite3": ">=9.0.0",
    "lex-gql": ">=0.1.0"
  },
  "devDependencies": {
    "better-sqlite3": "^11.8.1",
    "lex-gql": "workspace:*",
    "vitest": "^1.6.1"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "types": ["node"]
  },
  "include": ["lex-gql-sqlite.js"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create minimal lex-gql-sqlite.js with export**

```javascript
/**
 * SQLite adapter for lex-gql
 */

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
```

**Step 4: Install dependencies**

Run: `pnpm install`

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "chore: scaffold lex-gql-sqlite package"
```

---

### Task 2: Implement setupSchema

**Files:**
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.test.js`
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Write failing test for setupSchema**

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { setupSchema } from './lex-gql-sqlite.js';

describe('setupSchema', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('creates records table', () => {
    setupSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates actors table', () => {
    setupSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='actors'").all();
    expect(tables).toHaveLength(1);
  });

  it('creates indexes', () => {
    setupSchema(db);
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all();
    expect(indexes.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent (can run multiple times)', () => {
    setupSchema(db);
    setupSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.filter(t => t.name === 'records')).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: FAIL - setupSchema not exported

**Step 3: Implement setupSchema**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "feat(sqlite): add setupSchema for database initialization"
```

---

### Task 3: Implement WHERE clause builder with AND/OR

**Files:**
- Create: `packages/lex-gql-sqlite/lex-gql-sqlite.test.js`
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Write failing test for buildWhere**

```javascript
import { describe, it, expect } from 'vitest';
import { buildWhere } from './lex-gql-sqlite.js';

describe('buildWhere', () => {
  it('handles empty where', () => {
    const { sql, params } = buildWhere([]);
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });

  it('handles simple eq condition', () => {
    const { sql, params } = buildWhere([
      { field: 'status', op: 'eq', value: 'active' }
    ]);
    expect(sql).toBe("json_extract(r.record, '$.status') = ?");
    expect(params).toEqual(['active']);
  });

  it('handles system field (did)', () => {
    const { sql, params } = buildWhere([
      { field: 'did', op: 'eq', value: 'did:plc:abc' }
    ]);
    expect(sql).toBe('r.did = ?');
    expect(params).toEqual(['did:plc:abc']);
  });

  it('handles in operator', () => {
    const { sql, params } = buildWhere([
      { field: 'status', op: 'in', value: ['a', 'b', 'c'] }
    ]);
    expect(sql).toBe("json_extract(r.record, '$.status') IN (?, ?, ?)");
    expect(params).toEqual(['a', 'b', 'c']);
  });

  it('handles contains operator', () => {
    const { sql, params } = buildWhere([
      { field: 'text', op: 'contains', value: 'hello' }
    ]);
    expect(sql).toBe("json_extract(r.record, '$.text') LIKE ?");
    expect(params).toEqual(['%hello%']);
  });

  it('handles comparison operators', () => {
    const { sql, params } = buildWhere([
      { field: 'count', op: 'gt', value: 10 },
      { field: 'count', op: 'lte', value: 100 }
    ]);
    expect(sql).toBe("json_extract(r.record, '$.count') > ? AND json_extract(r.record, '$.count') <= ?");
    expect(params).toEqual([10, 100]);
  });

  it('handles AND conditions', () => {
    const { sql, params } = buildWhere([
      { field: 'AND', op: 'and', value: [
        [{ field: 'a', op: 'eq', value: '1' }],
        [{ field: 'b', op: 'eq', value: '2' }]
      ]}
    ]);
    expect(sql).toBe("(json_extract(r.record, '$.a') = ? AND json_extract(r.record, '$.b') = ?)");
    expect(params).toEqual(['1', '2']);
  });

  it('handles OR conditions', () => {
    const { sql, params } = buildWhere([
      { field: 'OR', op: 'or', value: [
        [{ field: 'a', op: 'eq', value: '1' }],
        [{ field: 'b', op: 'eq', value: '2' }]
      ]}
    ]);
    expect(sql).toBe("(json_extract(r.record, '$.a') = ? OR json_extract(r.record, '$.b') = ?)");
    expect(params).toEqual(['1', '2']);
  });

  it('handles nested AND/OR', () => {
    const { sql, params } = buildWhere([
      { field: 'status', op: 'eq', value: 'active' },
      { field: 'OR', op: 'or', value: [
        [{ field: 'author', op: 'eq', value: 'alice' }],
        [{ field: 'author', op: 'eq', value: 'bob' }]
      ]}
    ]);
    expect(sql).toBe("json_extract(r.record, '$.status') = ? AND (json_extract(r.record, '$.author') = ? OR json_extract(r.record, '$.author') = ?)");
    expect(params).toEqual(['active', 'alice', 'bob']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: FAIL - buildWhere not exported

**Step 3: Implement buildWhere**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "feat(sqlite): add WHERE clause builder with AND/OR support"
```

---

### Task 4: Implement ORDER BY builder

**Files:**
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.test.js`
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Write failing test for buildOrderBy**

```javascript
describe('buildOrderBy', () => {
  it('returns default order when no sort', () => {
    const sql = buildOrderBy([]);
    expect(sql).toBe('r.id DESC');
  });

  it('handles single sort field', () => {
    const sql = buildOrderBy([{ field: 'createdAt', dir: 'asc' }]);
    expect(sql).toBe("json_extract(r.record, '$.createdAt') ASC");
  });

  it('handles system field sort', () => {
    const sql = buildOrderBy([{ field: 'indexedAt', dir: 'desc' }]);
    expect(sql).toBe('r.indexed_at DESC');
  });

  it('handles multi-field sort', () => {
    const sql = buildOrderBy([
      { field: 'status', dir: 'asc' },
      { field: 'createdAt', dir: 'desc' }
    ]);
    expect(sql).toBe("json_extract(r.record, '$.status') ASC, json_extract(r.record, '$.createdAt') DESC");
  });

  it('defaults to asc when dir not specified', () => {
    const sql = buildOrderBy([{ field: 'name' }]);
    expect(sql).toBe("json_extract(r.record, '$.name') ASC");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: FAIL

**Step 3: Implement buildOrderBy**

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "feat(sqlite): add ORDER BY builder with multi-field support"
```

---

### Task 5: Implement findMany with pagination

**Files:**
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.test.js`
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Write failing test for findMany**

```javascript
import Database from 'better-sqlite3';
import { createSqliteAdapter } from './lex-gql-sqlite.js';

describe('findMany', () => {
  let db;
  let query;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uri TEXT UNIQUE NOT NULL,
        did TEXT NOT NULL,
        collection TEXT NOT NULL,
        rkey TEXT NOT NULL,
        cid TEXT,
        record TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE TABLE actors (
        did TEXT PRIMARY KEY,
        handle TEXT NOT NULL
      );
    `);
    query = createSqliteAdapter(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns empty result for empty table', async () => {
    const result = await query({
      type: 'findMany',
      collection: 'app.bsky.feed.post',
      where: [],
      pagination: { first: 10 },
    });
    expect(result.rows).toEqual([]);
    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
  });

  it('returns records for collection', async () => {
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/app.bsky.feed.post/123',
      'did:plc:abc',
      'app.bsky.feed.post',
      '123',
      JSON.stringify({ text: 'hello' }),
      '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'findMany',
      collection: 'app.bsky.feed.post',
      where: [],
      pagination: { first: 10 },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('hello');
    expect(result.rows[0].uri).toBe('at://did:plc:abc/app.bsky.feed.post/123');
  });

  it('respects first limit', async () => {
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        `at://did:plc:abc/col/${i}`, 'did:plc:abc', 'col', `${i}`, '{}', '2024-01-01T00:00:00Z'
      );
    }

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 3 },
    });

    expect(result.rows).toHaveLength(3);
    expect(result.hasNext).toBe(true);
  });

  it('handles cursor pagination with after', async () => {
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        `at://did:plc:abc/col/${i}`, 'did:plc:abc', 'col', `${i}`, '{}', '2024-01-01T00:00:00Z'
      );
    }

    const first = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 2 },
    });

    const cursor = Buffer.from(JSON.stringify({ id: first.rows[1]._id })).toString('base64');

    const second = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 2, after: cursor },
    });

    expect(second.rows).toHaveLength(2);
    expect(second.hasPrev).toBe(true);
  });

  it('filters with where clause', async () => {
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/1', 'did:plc:abc', 'col', '1', JSON.stringify({ status: 'active' }), '2024-01-01T00:00:00Z'
    );
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/2', 'did:plc:abc', 'col', '2', JSON.stringify({ status: 'inactive' }), '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [{ field: 'status', op: 'eq', value: 'active' }],
      pagination: { first: 10 },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('active');
  });

  it('sorts results', async () => {
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/1', 'did:plc:abc', 'col', '1', JSON.stringify({ name: 'banana' }), '2024-01-01T00:00:00Z'
    );
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/2', 'did:plc:abc', 'col', '2', JSON.stringify({ name: 'apple' }), '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'name', dir: 'asc' }],
      pagination: { first: 10 },
    });

    expect(result.rows[0].name).toBe('apple');
    expect(result.rows[1].name).toBe('banana');
  });

  it('joins actor handle', async () => {
    db.prepare(`INSERT INTO actors (did, handle) VALUES (?, ?)`).run('did:plc:abc', 'alice.test');
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/1', 'did:plc:abc', 'col', '1', '{}', '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 10 },
    });

    expect(result.rows[0].actorHandle).toBe('alice.test');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: FAIL

**Step 3: Implement findMany in createSqliteAdapter**

```javascript
import { hydrateRecord } from 'lex-gql';

/**
 * Create a SQLite query adapter for lex-gql
 * @param {import('better-sqlite3').Database} db
 * @returns {(op: import('lex-gql').Operation) => Promise<any>}
 */
export function createSqliteAdapter(db) {
  return async function query(op) {
    if (op.type === 'findMany') {
      return findMany(db, op);
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "feat(sqlite): implement findMany with full pagination support"
```

---

### Task 6: Implement aggregate

**Files:**
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.test.js`
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`

**Step 1: Write failing test for aggregate**

```javascript
describe('aggregate', () => {
  let db;
  let query;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uri TEXT UNIQUE NOT NULL,
        did TEXT NOT NULL,
        collection TEXT NOT NULL,
        rkey TEXT NOT NULL,
        cid TEXT,
        record TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
    `);
    query = createSqliteAdapter(db);
  });

  afterEach(() => {
    db.close();
  });

  it('returns count for empty table', async () => {
    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
    });
    expect(result.count).toBe(0);
    expect(result.groups).toEqual([]);
  });

  it('returns count for collection', async () => {
    for (let i = 0; i < 5; i++) {
      db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
        `at://did:plc:abc/col/${i}`, 'did:plc:abc', 'col', `${i}`, '{}', '2024-01-01T00:00:00Z'
      );
    }

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
    });

    expect(result.count).toBe(5);
  });

  it('respects where clause', async () => {
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/1', 'did:plc:abc', 'col', '1', JSON.stringify({ status: 'active' }), '2024-01-01T00:00:00Z'
    );
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/2', 'did:plc:abc', 'col', '2', JSON.stringify({ status: 'inactive' }), '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [{ field: 'status', op: 'eq', value: 'active' }],
    });

    expect(result.count).toBe(1);
  });

  it('groups by field', async () => {
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/1', 'did:plc:abc', 'col', '1', JSON.stringify({ status: 'active' }), '2024-01-01T00:00:00Z'
    );
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/2', 'did:plc:abc', 'col', '2', JSON.stringify({ status: 'active' }), '2024-01-01T00:00:00Z'
    );
    db.prepare(`INSERT INTO records (uri, did, collection, rkey, record, indexed_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'at://did:plc:abc/col/3', 'did:plc:abc', 'col', '3', JSON.stringify({ status: 'inactive' }), '2024-01-01T00:00:00Z'
    );

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['status'],
    });

    expect(result.count).toBe(3);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find((g) => g.status === 'active').count).toBe(2);
    expect(result.groups.find((g) => g.status === 'inactive').count).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: FAIL

**Step 3: Implement aggregate**

Add to createSqliteAdapter:

```javascript
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
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql-sqlite && pnpm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "feat(sqlite): implement aggregate with groupBy support"
```

---

### Task 7: Update tap example to use lex-gql-sqlite

**Files:**
- Modify: `examples/tap/package.json`
- Modify: `examples/tap/index.js`

**Step 1: Add lex-gql-sqlite dependency to tap example**

Add to `examples/tap/package.json` dependencies:
```json
"lex-gql-sqlite": "workspace:*"
```

**Step 2: Run pnpm install**

Run: `pnpm install`

**Step 3: Update tap example to use createSqliteAdapter and setupSchema**

Replace the schema setup and query function in `examples/tap/index.js`:

```javascript
// Change imports
import { createAdapter, parseLexicon } from 'lex-gql';
import { createSqliteAdapter, setupSchema } from 'lex-gql-sqlite';

// Remove: the manual CREATE TABLE statements (~20 lines)
// Remove: the entire query(), findMany(), aggregate() functions (~160 lines)

// Replace schema setup with:
setupSchema(db);

// Replace query function with:
const query = createSqliteAdapter(db);

// Keep: const adapter = createAdapter(lexicons, { query });
```

**Step 4: Test tap example still works**

Run: `cd examples/tap && node --check index.js`
Expected: No syntax errors

**Step 5: Commit**

```bash
git add examples/tap
git commit -m "refactor(tap): use lex-gql-sqlite adapter"
```

---

### Task 8: Generate types and finalize

**Files:**
- Modify: `packages/lex-gql-sqlite/lex-gql-sqlite.js`
- Create: `packages/lex-gql-sqlite/lex-gql-sqlite.d.ts`
- Create: `packages/lex-gql-sqlite/README.md`
- Create: `packages/lex-gql-sqlite/CHANGELOG.md`

**Step 1: Run typecheck to generate .d.ts**

Run: `cd packages/lex-gql-sqlite && pnpm typecheck`

**Step 2: Create README.md**

```markdown
# lex-gql-sqlite

SQLite adapter for [lex-gql](https://github.com/your-repo/lex-gql).

## Installation

```bash
npm install lex-gql-sqlite lex-gql better-sqlite3
```

## Usage

```javascript
import Database from 'better-sqlite3';
import { createAdapter, parseLexicon } from 'lex-gql';
import { createSqliteAdapter } from 'lex-gql-sqlite';

const db = new Database('./data.db');
const query = createSqliteAdapter(db);
const adapter = createAdapter(lexicons, { query });

const result = await adapter.execute(`
  query {
    appBskyFeedPost(first: 10) {
      edges { node { text } }
    }
  }
`);
```

## Schema

Expects the standard lex-gql schema:

```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT UNIQUE NOT NULL,
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  cid TEXT,
  record TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);

CREATE TABLE actors (
  did TEXT PRIMARY KEY,
  handle TEXT NOT NULL
);
```

## License

MIT
```

**Step 3: Create CHANGELOG.md**

```markdown
# Changelog

## [0.1.0] - 2026-01-15

### Added

- Initial release
- `createSqliteAdapter(db)` - create query function from better-sqlite3 database
- Full WHERE support with AND/OR nesting
- All filter operators: eq, in, contains, gt, gte, lt, lte
- Multi-field sorting
- Bidirectional cursor pagination (first/after, last/before)
- Aggregate queries with groupBy
- Actor handle joins
```

**Step 4: Commit**

```bash
git add packages/lex-gql-sqlite
git commit -m "docs: add README and CHANGELOG for lex-gql-sqlite"
```

---

### Task 9: Run full test suite and verify

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Verify tap example works**

Run: `cd examples/tap && node --check index.js`
Expected: No errors

**Step 3: Final commit if needed**

If any fixes were needed, commit them.
