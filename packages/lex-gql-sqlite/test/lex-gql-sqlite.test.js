import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildOrderBy,
  buildWhere,
  createSqliteAdapter,
  createWriter,
  setupSchema,
} from '../src/lex-gql-sqlite.js';

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
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='records'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates actors table', () => {
    setupSchema(db);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='actors'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it('creates indexes', () => {
    setupSchema(db);
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
      .all();
    expect(indexes.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent (can run multiple times)', () => {
    setupSchema(db);
    setupSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    expect(tables.filter((t) => t.name === 'records')).toHaveLength(1);
  });
});

describe('createWriter', () => {
  let db;
  let writer;

  beforeEach(() => {
    db = new Database(':memory:');
    setupSchema(db);
    writer = createWriter(db);
  });

  afterEach(() => {
    db.close();
  });

  it('inserts a record', () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      cid: 'bafycid123',
      record: { text: 'Hello world' },
    });

    const row = db
      .prepare('SELECT * FROM records WHERE uri = ?')
      .get('at://did:plc:alice/app.bsky.feed.post/1');
    expect(row.did).toBe('did:plc:alice');
    expect(row.collection).toBe('app.bsky.feed.post');
    expect(JSON.parse(row.record)).toEqual({ text: 'Hello world' });
  });

  it('replaces existing record on conflict', () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'First version' },
    });

    writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'Updated version' },
    });

    const rows = db.prepare('SELECT * FROM records').all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].record)).toEqual({ text: 'Updated version' });
  });

  it('deletes a record', () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'Hello' },
    });

    writer.deleteRecord('at://did:plc:alice/app.bsky.feed.post/1');

    const rows = db.prepare('SELECT * FROM records').all();
    expect(rows).toHaveLength(0);
  });

  it('upserts an actor', () => {
    writer.upsertActor('did:plc:alice', 'alice.bsky.social');

    const row = db.prepare('SELECT * FROM actors WHERE did = ?').get('did:plc:alice');
    expect(row.handle).toBe('alice.bsky.social');
  });

  it('updates actor handle on conflict', () => {
    writer.upsertActor('did:plc:alice', 'alice.bsky.social');
    writer.upsertActor('did:plc:alice', 'alice.example.com');

    const rows = db.prepare('SELECT * FROM actors').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].handle).toBe('alice.example.com');
  });
});

describe('buildWhere', () => {
  it('handles empty where', () => {
    const { sql, params } = buildWhere([]);
    expect(sql).toBe('1=1');
    expect(params).toEqual([]);
  });

  it('handles simple eq condition', () => {
    const { sql, params } = buildWhere([{ field: 'status', op: 'eq', value: 'active' }]);
    expect(sql).toBe("json_extract(r.record, '$.status') = ?");
    expect(params).toEqual(['active']);
  });

  it('handles system field (did)', () => {
    const { sql, params } = buildWhere([{ field: 'did', op: 'eq', value: 'did:plc:abc' }]);
    expect(sql).toBe('r.did = ?');
    expect(params).toEqual(['did:plc:abc']);
  });

  it('handles in operator', () => {
    const { sql, params } = buildWhere([{ field: 'status', op: 'in', value: ['a', 'b', 'c'] }]);
    expect(sql).toBe("json_extract(r.record, '$.status') IN (?, ?, ?)");
    expect(params).toEqual(['a', 'b', 'c']);
  });

  it('handles contains operator', () => {
    const { sql, params } = buildWhere([{ field: 'text', op: 'contains', value: 'hello' }]);
    expect(sql).toBe("json_extract(r.record, '$.text') LIKE ?");
    expect(params).toEqual(['%hello%']);
  });

  it('handles comparison operators', () => {
    const { sql, params } = buildWhere([
      { field: 'count', op: 'gt', value: 10 },
      { field: 'count', op: 'lte', value: 100 },
    ]);
    expect(sql).toBe(
      "json_extract(r.record, '$.count') > ? AND json_extract(r.record, '$.count') <= ?",
    );
    expect(params).toEqual([10, 100]);
  });

  it('handles AND conditions', () => {
    const { sql, params } = buildWhere([
      {
        op: 'and',
        conditions: [
          [{ field: 'a', op: 'eq', value: '1' }],
          [{ field: 'b', op: 'eq', value: '2' }],
        ],
      },
    ]);
    expect(sql).toBe("(json_extract(r.record, '$.a') = ? AND json_extract(r.record, '$.b') = ?)");
    expect(params).toEqual(['1', '2']);
  });

  it('handles OR conditions', () => {
    const { sql, params } = buildWhere([
      {
        op: 'or',
        conditions: [
          [{ field: 'a', op: 'eq', value: '1' }],
          [{ field: 'b', op: 'eq', value: '2' }],
        ],
      },
    ]);
    expect(sql).toBe("(json_extract(r.record, '$.a') = ? OR json_extract(r.record, '$.b') = ?)");
    expect(params).toEqual(['1', '2']);
  });

  it('handles nested AND/OR', () => {
    const { sql, params } = buildWhere([
      { field: 'status', op: 'eq', value: 'active' },
      {
        op: 'or',
        conditions: [
          [{ field: 'author', op: 'eq', value: 'alice' }],
          [{ field: 'author', op: 'eq', value: 'bob' }],
        ],
      },
    ]);
    expect(sql).toBe(
      "json_extract(r.record, '$.status') = ? AND (json_extract(r.record, '$.author') = ? OR json_extract(r.record, '$.author') = ?)",
    );
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
      { field: 'createdAt', dir: 'desc' },
    ]);
    expect(sql).toBe(
      "json_extract(r.record, '$.status') ASC, json_extract(r.record, '$.createdAt') DESC",
    );
  });

  it('defaults to asc when dir not specified', () => {
    const sql = buildOrderBy([{ field: 'name' }]);
    expect(sql).toBe("json_extract(r.record, '$.name') ASC");
  });
});

describe('findMany', () => {
  let db;
  let query;
  let writer;

  beforeEach(() => {
    db = new Database(':memory:');
    setupSchema(db);
    query = createSqliteAdapter(db);
    writer = createWriter(db);
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
    writer.insertRecord({
      uri: 'at://did:plc:abc/app.bsky.feed.post/123',
      record: { text: 'hello' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

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
      writer.insertRecord({
        uri: `at://did:plc:abc/col/${i}`,
        record: {},
        indexedAt: '2024-01-01T00:00:00Z',
      });
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
      writer.insertRecord({
        uri: `at://did:plc:abc/col/${i}`,
        record: {},
        indexedAt: '2024-01-01T00:00:00Z',
      });
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
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { status: 'inactive' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

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
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { name: 'banana' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { name: 'apple' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

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
    writer.upsertActor('did:plc:abc', 'alice.test');
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: {},
      indexedAt: '2024-01-01T00:00:00Z',
    });

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 10 },
    });

    expect(result.rows[0].actorHandle).toBe('alice.test');
  });
});

describe('aggregate', () => {
  let db;
  let query;
  let writer;

  beforeEach(() => {
    db = new Database(':memory:');
    setupSchema(db);
    query = createSqliteAdapter(db);
    writer = createWriter(db);
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
      writer.insertRecord({
        uri: `at://did:plc:abc/col/${i}`,
        record: {},
        indexedAt: '2024-01-01T00:00:00Z',
      });
    }

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
    });

    expect(result.count).toBe(5);
  });

  it('respects where clause', async () => {
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { status: 'inactive' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [{ field: 'status', op: 'eq', value: 'active' }],
    });

    expect(result.count).toBe(1);
  });

  it('groups by field', async () => {
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    writer.insertRecord({
      uri: 'at://did:plc:abc/col/3',
      record: { status: 'inactive' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

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

  it('groups by day interval', async () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-15T10:00:00Z' },
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-15T22:00:00Z' },
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/3',
      record: { playedTime: '2024-01-16T08:00:00Z' },
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['playedTime_day'],
    });

    expect(result.count).toBe(3);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find((g) => g.playedTime_day === '2024-01-15').count).toBe(2);
    expect(result.groups.find((g) => g.playedTime_day === '2024-01-16').count).toBe(1);
  });

  it('groups by week interval', async () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-01T10:00:00Z' }, // Week 01
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-03T10:00:00Z' }, // Week 01
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/3',
      record: { playedTime: '2024-01-08T10:00:00Z' }, // Week 02
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['playedTime_week'],
    });

    expect(result.count).toBe(3);
    expect(result.groups).toHaveLength(2);
  });

  it('groups by month interval', async () => {
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-15T10:00:00Z' },
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-20T10:00:00Z' },
    });
    writer.insertRecord({
      uri: 'at://did:plc:alice/col/3',
      record: { playedTime: '2024-02-05T10:00:00Z' },
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['playedTime_month'],
    });

    expect(result.count).toBe(3);
    expect(result.groups).toHaveLength(2);
    expect(result.groups.find((g) => g.playedTime_month === '2024-01').count).toBe(2);
    expect(result.groups.find((g) => g.playedTime_month === '2024-02').count).toBe(1);
  });

  it('respects custom limit', async () => {
    // Create 5 distinct groups
    for (let i = 0; i < 5; i++) {
      writer.insertRecord({
        uri: `at://did:plc:alice/col/${i}`,
        record: { category: `cat${i}` },
      });
    }

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['category'],
      limit: 3,
    });

    expect(result.groups).toHaveLength(3);
  });

  it('supports ascending count order', async () => {
    writer.insertRecord({ uri: 'at://did:plc:alice/col/1', record: { cat: 'a' } });
    writer.insertRecord({ uri: 'at://did:plc:alice/col/2', record: { cat: 'a' } });
    writer.insertRecord({ uri: 'at://did:plc:alice/col/3', record: { cat: 'a' } });
    writer.insertRecord({ uri: 'at://did:plc:alice/col/4', record: { cat: 'b' } });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['cat'],
      orderBy: 'COUNT_ASC',
    });

    expect(result.groups[0].cat).toBe('b'); // count 1 first
    expect(result.groups[1].cat).toBe('a'); // count 3 second
  });
});
