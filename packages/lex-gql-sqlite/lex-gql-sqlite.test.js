import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { setupSchema, buildWhere, buildOrderBy, createSqliteAdapter } from './lex-gql-sqlite.js';

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

describe('findMany', () => {
  let db;
  let query;

  beforeEach(() => {
    db = new Database(':memory:');
    setupSchema(db);
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
