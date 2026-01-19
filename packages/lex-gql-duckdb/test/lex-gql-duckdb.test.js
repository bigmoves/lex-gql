import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildOrderBy,
  buildWhere,
  createDuckDB,
  createDuckDBAdapter,
  createWriter,
  setupSchema,
} from '../src/lex-gql-duckdb.js';

describe('setupSchema', () => {
  let db;

  beforeEach(async () => {
    db = await createDuckDB(':memory:');
  });

  afterEach(() => {
    db.db.close();
  });

  it('creates records table', async () => {
    await setupSchema(db);
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_name = 'records'");
    expect(tables).toHaveLength(1);
  });

  it('creates actors table', async () => {
    await setupSchema(db);
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_name = 'actors'");
    expect(tables).toHaveLength(1);
  });

  it('is idempotent (can run multiple times)', async () => {
    await setupSchema(db);
    await setupSchema(db);
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_name = 'records'");
    expect(tables).toHaveLength(1);
  });
});

describe('createWriter', () => {
  let db;
  let writer;

  beforeEach(async () => {
    db = await createDuckDB(':memory:');
    await setupSchema(db);
    writer = createWriter(db);
  });

  afterEach(() => {
    db.db.close();
  });

  it('inserts a record', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      cid: 'bafycid123',
      record: { text: 'Hello world' },
    });

    const row = await db.get('SELECT * FROM records WHERE uri = ?', 'at://did:plc:alice/app.bsky.feed.post/1');
    expect(row.did).toBe('did:plc:alice');
    expect(row.collection).toBe('app.bsky.feed.post');
    expect(JSON.parse(row.record)).toEqual({ text: 'Hello world' });
  });

  it('replaces existing record on conflict', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'First version' },
    });

    await writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'Updated version' },
    });

    const rows = await db.all('SELECT * FROM records');
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].record)).toEqual({ text: 'Updated version' });
  });

  it('deletes a record', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'Hello' },
    });

    await writer.deleteRecord('at://did:plc:alice/app.bsky.feed.post/1');

    const rows = await db.all('SELECT * FROM records');
    expect(rows).toHaveLength(0);
  });

  it('upserts an actor', async () => {
    await writer.upsertActor('did:plc:alice', 'alice.bsky.social');

    const row = await db.get('SELECT * FROM actors WHERE did = ?', 'did:plc:alice');
    expect(row.handle).toBe('alice.bsky.social');
  });

  it('updates actor handle on conflict', async () => {
    await writer.upsertActor('did:plc:alice', 'alice.bsky.social');
    await writer.upsertActor('did:plc:alice', 'alice.example.com');

    const rows = await db.all('SELECT * FROM actors');
    expect(rows).toHaveLength(1);
    expect(rows[0].handle).toBe('alice.example.com');
  });

  it('inserts multiple records in a batch', async () => {
    await writer.insertRecordsBatch([
      { uri: 'at://did:plc:alice/app.bsky.feed.post/1', cid: 'cid1', record: { text: 'Post 1' } },
      { uri: 'at://did:plc:alice/app.bsky.feed.post/2', cid: 'cid2', record: { text: 'Post 2' } },
      { uri: 'at://did:plc:bob/app.bsky.feed.post/1', cid: 'cid3', record: { text: 'Post 3' } },
    ]);

    const rows = await db.all('SELECT * FROM records ORDER BY uri');
    expect(rows).toHaveLength(3);
    expect(JSON.parse(rows[0].record)).toEqual({ text: 'Post 1' });
    expect(JSON.parse(rows[1].record)).toEqual({ text: 'Post 2' });
    expect(rows[2].did).toBe('did:plc:bob');
  });

  it('handles batch upsert (updates on conflict)', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/app.bsky.feed.post/1',
      record: { text: 'Original' },
    });

    await writer.insertRecordsBatch([
      { uri: 'at://did:plc:alice/app.bsky.feed.post/1', record: { text: 'Updated' } },
      { uri: 'at://did:plc:alice/app.bsky.feed.post/2', record: { text: 'New' } },
    ]);

    const rows = await db.all('SELECT * FROM records ORDER BY uri');
    expect(rows).toHaveLength(2);
    expect(JSON.parse(rows[0].record)).toEqual({ text: 'Updated' });
    expect(JSON.parse(rows[1].record)).toEqual({ text: 'New' });
  });

  it('handles empty batch gracefully', async () => {
    await writer.insertRecordsBatch([]);
    const rows = await db.all('SELECT * FROM records');
    expect(rows).toHaveLength(0);
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
    expect(sql).toBe("json_extract_string(r.record, '$.status') = ?");
    expect(params).toEqual(['active']);
  });

  it('handles system field (did)', () => {
    const { sql, params } = buildWhere([{ field: 'did', op: 'eq', value: 'did:plc:abc' }]);
    expect(sql).toBe('r.did = ?');
    expect(params).toEqual(['did:plc:abc']);
  });

  it('handles in operator', () => {
    const { sql, params } = buildWhere([{ field: 'status', op: 'in', value: ['a', 'b', 'c'] }]);
    expect(sql).toBe("json_extract_string(r.record, '$.status') IN (?, ?, ?)");
    expect(params).toEqual(['a', 'b', 'c']);
  });

  it('handles contains operator', () => {
    const { sql, params } = buildWhere([{ field: 'text', op: 'contains', value: 'hello' }]);
    expect(sql).toBe("json_extract_string(r.record, '$.text') LIKE ? ESCAPE '\\'");
    expect(params).toEqual(['%hello%']);
  });

  it('escapes LIKE wildcards in contains operator', () => {
    const { sql, params } = buildWhere([{ field: 'text', op: 'contains', value: '50%' }]);
    expect(sql).toBe("json_extract_string(r.record, '$.text') LIKE ? ESCAPE '\\'");
    expect(params).toEqual(['%50\\%%']);
  });

  it('handles comparison operators', () => {
    const { sql, params } = buildWhere([
      { field: 'count', op: 'gt', value: 10 },
      { field: 'count', op: 'lte', value: 100 },
    ]);
    expect(sql).toBe(
      "json_extract_string(r.record, '$.count') > ? AND json_extract_string(r.record, '$.count') <= ?",
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
    expect(sql).toBe("(json_extract_string(r.record, '$.a') = ? AND json_extract_string(r.record, '$.b') = ?)");
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
    expect(sql).toBe("(json_extract_string(r.record, '$.a') = ? OR json_extract_string(r.record, '$.b') = ?)");
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
      "json_extract_string(r.record, '$.status') = ? AND (json_extract_string(r.record, '$.author') = ? OR json_extract_string(r.record, '$.author') = ?)",
    );
    expect(params).toEqual(['active', 'alice', 'bob']);
  });
});

describe('buildOrderBy', () => {
  it('returns default order when no sort', () => {
    const sql = buildOrderBy([]);
    expect(sql).toBe('r.indexed_at DESC, r.uri DESC');
  });

  it('handles single sort field with uri tiebreaker', () => {
    const sql = buildOrderBy([{ field: 'createdAt', dir: 'asc' }]);
    expect(sql).toBe("json_extract_string(r.record, '$.createdAt') ASC, r.uri ASC");
  });

  it('handles system field sort with uri tiebreaker', () => {
    const sql = buildOrderBy([{ field: 'indexedAt', dir: 'desc' }]);
    expect(sql).toBe('r.indexed_at DESC, r.uri DESC');
  });

  it('handles multi-field sort with uri tiebreaker', () => {
    const sql = buildOrderBy([
      { field: 'status', dir: 'asc' },
      { field: 'createdAt', dir: 'desc' },
    ]);
    expect(sql).toBe(
      "json_extract_string(r.record, '$.status') ASC, json_extract_string(r.record, '$.createdAt') DESC, r.uri DESC",
    );
  });

  it('defaults to asc when dir not specified', () => {
    const sql = buildOrderBy([{ field: 'name' }]);
    expect(sql).toBe("json_extract_string(r.record, '$.name') ASC, r.uri ASC");
  });
});

describe('findMany', () => {
  let db;
  let query;
  let writer;

  beforeEach(async () => {
    db = await createDuckDB(':memory:');
    await setupSchema(db);
    query = createDuckDBAdapter(db);
    writer = createWriter(db);
  });

  afterEach(() => {
    db.db.close();
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
    await writer.insertRecord({
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
      await writer.insertRecord({
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
      await writer.insertRecord({
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

    // Cursor format: JSON { v: [sortValues], u: uri } (default sort is indexedAt DESC)
    // indexedAt comes back as Date object, convert to ISO string
    const lastRow = first.rows[1];
    const indexedAtStr = lastRow.indexedAt instanceof Date
      ? lastRow.indexedAt.toISOString()
      : lastRow.indexedAt;
    const cursor = Buffer.from(JSON.stringify({ v: [indexedAtStr], u: lastRow.uri })).toString('base64');

    const second = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      pagination: { first: 2, after: cursor },
    });

    expect(second.rows).toHaveLength(2);
    expect(second.hasPrev).toBe(true);
  });

  it('handles cursor pagination with custom sort field', async () => {
    // Insert records with different playedTime values (out of insertion order)
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { playedTime: '2024-01-03T00:00:00Z', name: 'third' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { playedTime: '2024-01-01T00:00:00Z', name: 'first' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/3',
      record: { playedTime: '2024-01-05T00:00:00Z', name: 'fifth' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/4',
      record: { playedTime: '2024-01-02T00:00:00Z', name: 'second' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/5',
      record: { playedTime: '2024-01-04T00:00:00Z', name: 'fourth' },
    });

    // Get first page sorted by playedTime DESC
    const first = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'playedTime', dir: 'desc' }],
      pagination: { first: 2 },
    });

    expect(first.rows).toHaveLength(2);
    expect(first.rows[0].name).toBe('fifth');  // 2024-01-05
    expect(first.rows[1].name).toBe('fourth'); // 2024-01-04
    expect(first.hasNext).toBe(true);

    // Build cursor from last row - this is what formatConnection does
    const lastRow = first.rows[1];
    const cursor = Buffer.from(JSON.stringify({ v: ['2024-01-04T00:00:00Z'], u: lastRow.uri })).toString('base64');

    // Get second page
    const second = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'playedTime', dir: 'desc' }],
      pagination: { first: 2, after: cursor },
    });

    expect(second.rows).toHaveLength(2);
    expect(second.rows[0].name).toBe('third');  // 2024-01-03
    expect(second.rows[1].name).toBe('second'); // 2024-01-02
    expect(second.hasNext).toBe(true);

    // Get third page
    const lastRow2 = second.rows[1];
    const cursor2 = Buffer.from(JSON.stringify({ v: ['2024-01-02T00:00:00Z'], u: lastRow2.uri })).toString('base64');

    const third = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'playedTime', dir: 'desc' }],
      pagination: { first: 2, after: cursor2 },
    });

    expect(third.rows).toHaveLength(1);
    expect(third.rows[0].name).toBe('first'); // 2024-01-01
    expect(third.hasNext).toBe(false);
  });

  it('does not produce duplicate records when paginating with custom sort', async () => {
    // Insert 10 records with varying timestamps
    const timestamps = [
      '2024-01-10T00:00:00Z',
      '2024-01-09T00:00:00Z',
      '2024-01-08T00:00:00Z',
      '2024-01-07T00:00:00Z',
      '2024-01-06T00:00:00Z',
      '2024-01-05T00:00:00Z',
      '2024-01-04T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-02T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ];

    // Insert in random order
    const insertOrder = [4, 7, 1, 9, 2, 5, 0, 8, 3, 6];
    for (const i of insertOrder) {
      await writer.insertRecord({
        uri: `at://did:plc:abc/col/${i}`,
        record: { playedTime: timestamps[i], index: i },
      });
    }

    const allUris = new Set();
    let cursor = null;

    // Paginate through all records
    for (let page = 0; page < 5; page++) {
      const result = await query({
        type: 'findMany',
        collection: 'col',
        where: [],
        sort: [{ field: 'playedTime', dir: 'desc' }],
        pagination: { first: 3, after: cursor },
      });

      // Check for duplicates
      for (const row of result.rows) {
        expect(allUris.has(row.uri)).toBe(false);
        allUris.add(row.uri);
      }

      if (!result.hasNext) break;

      // Build cursor for next page
      const lastRow = result.rows[result.rows.length - 1];
      cursor = Buffer.from(JSON.stringify({ v: [lastRow.playedTime], u: lastRow.uri })).toString('base64');
    }

    // Verify we got all records
    expect(allUris.size).toBe(10);
  });

  it('handles before cursor with custom sort field', async () => {
    // Insert records
    for (let i = 1; i <= 5; i++) {
      await writer.insertRecord({
        uri: `at://did:plc:abc/col/${i}`,
        record: { playedTime: `2024-01-0${i}T00:00:00Z`, name: `item${i}` },
      });
    }

    // Start from the middle: item3 (2024-01-03)
    const cursor = Buffer.from(JSON.stringify({ v: ['2024-01-03T00:00:00Z'], u: 'at://did:plc:abc/col/3' })).toString('base64');

    // Get records BEFORE item3 (should be item4, item5 in DESC order)
    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'playedTime', dir: 'desc' }],
      pagination: { last: 2, before: cursor },
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('item5'); // 2024-01-05
    expect(result.rows[1].name).toBe('item4'); // 2024-01-04
  });

  it('handles cursor pagination with multi-field sort', async () => {
    // Insert records with two sort fields: category and playedTime
    const records = [
      { uri: 'at://did:plc:abc/col/1', category: 'A', playedTime: '2024-01-03T00:00:00Z' },
      { uri: 'at://did:plc:abc/col/2', category: 'A', playedTime: '2024-01-01T00:00:00Z' },
      { uri: 'at://did:plc:abc/col/3', category: 'B', playedTime: '2024-01-05T00:00:00Z' },
      { uri: 'at://did:plc:abc/col/4', category: 'A', playedTime: '2024-01-02T00:00:00Z' },
      { uri: 'at://did:plc:abc/col/5', category: 'B', playedTime: '2024-01-04T00:00:00Z' },
      { uri: 'at://did:plc:abc/col/6', category: 'C', playedTime: '2024-01-01T00:00:00Z' },
    ];

    for (const r of records) {
      await writer.insertRecord({
        uri: r.uri,
        record: { category: r.category, playedTime: r.playedTime },
      });
    }

    // Sort by category ASC, then playedTime DESC
    // Expected order: A(01-03), A(01-02), A(01-01), B(01-05), B(01-04), C(01-01)
    const allUris = [];
    let cursor = null;

    // Paginate through all records with page size 2
    for (let page = 0; page < 4; page++) {
      const result = await query({
        type: 'findMany',
        collection: 'col',
        where: [],
        sort: [{ field: 'category', dir: 'asc' }, { field: 'playedTime', dir: 'desc' }],
        pagination: { first: 2, after: cursor },
      });

      for (const row of result.rows) {
        allUris.push(row.uri);
      }

      if (!result.hasNext) break;

      // Build cursor with both sort field values
      const lastRow = result.rows[result.rows.length - 1];
      cursor = Buffer.from(JSON.stringify({
        v: [lastRow.category, lastRow.playedTime],
        u: lastRow.uri,
      })).toString('base64');
    }

    // Verify correct order
    expect(allUris).toEqual([
      'at://did:plc:abc/col/1', // A, 01-03
      'at://did:plc:abc/col/4', // A, 01-02
      'at://did:plc:abc/col/2', // A, 01-01
      'at://did:plc:abc/col/3', // B, 01-05
      'at://did:plc:abc/col/5', // B, 01-04
      'at://did:plc:abc/col/6', // C, 01-01
    ]);
  });

  it('filters with where clause', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
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
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { name: 'banana' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
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
    await writer.upsertActor('did:plc:abc', 'alice.test');
    await writer.insertRecord({
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

  it('filters by actorHandle', async () => {
    await writer.upsertActor('did:plc:alice', 'alice.test');
    await writer.upsertActor('did:plc:bob', 'bob.test');
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { text: 'from alice' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
      uri: 'at://did:plc:bob/col/2',
      record: { text: 'from bob' },
      indexedAt: '2024-01-01T00:00:00Z',
    });

    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [{ field: 'actorHandle', op: 'eq', value: 'alice.test' }],
      pagination: { first: 10 },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].actorHandle).toBe('alice.test');
    expect(result.rows[0].text).toBe('from alice');
  });
});

describe('aggregate', () => {
  let db;
  let query;
  let writer;

  beforeEach(async () => {
    db = await createDuckDB(':memory:');
    await setupSchema(db);
    query = createDuckDBAdapter(db);
    writer = createWriter(db);
  });

  afterEach(() => {
    db.db.close();
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
      await writer.insertRecord({
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
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
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
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/1',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
      uri: 'at://did:plc:abc/col/2',
      record: { status: 'active' },
      indexedAt: '2024-01-01T00:00:00Z',
    });
    await writer.insertRecord({
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
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-15T10:00:00Z' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-15T22:00:00Z' },
    });
    await writer.insertRecord({
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

  it('groups by day interval with Unix timestamps', async () => {
    // Unix timestamps in milliseconds
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: 1705311600000 }, // 2024-01-15T10:00:00Z
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: 1705354800000 }, // 2024-01-15T22:00:00Z
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/3',
      record: { playedTime: 1705392000000 }, // 2024-01-16T08:00:00Z
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
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-01T10:00:00Z' }, // Week 01
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-03T10:00:00Z' }, // Week 01
    });
    await writer.insertRecord({
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
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-15T10:00:00Z' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-20T10:00:00Z' },
    });
    await writer.insertRecord({
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
      await writer.insertRecord({
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
    await writer.insertRecord({ uri: 'at://did:plc:alice/col/1', record: { cat: 'a' } });
    await writer.insertRecord({ uri: 'at://did:plc:alice/col/2', record: { cat: 'a' } });
    await writer.insertRecord({ uri: 'at://did:plc:alice/col/3', record: { cat: 'a' } });
    await writer.insertRecord({ uri: 'at://did:plc:alice/col/4', record: { cat: 'b' } });

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

  it('includes array fields in results', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: {
        trackName: 'Song A',
        artists: [{ name: 'Artist 1' }],
      },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: {
        trackName: 'Song A',
        artists: [{ name: 'Artist 1' }],
      },
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [],
      groupBy: ['trackName'],
      arrayFields: ['artists'],
    });

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].trackName).toBe('Song A');
    expect(result.groups[0].artists).toEqual([{ name: 'Artist 1' }]);
    expect(result.groups[0].count).toBe(2);
  });

  it('filters with date comparison', async () => {
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/1',
      record: { playedTime: '2024-01-15T10:00:00Z' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/2',
      record: { playedTime: '2024-01-20T10:00:00Z' },
    });
    await writer.insertRecord({
      uri: 'at://did:plc:alice/col/3',
      record: { playedTime: '2024-02-05T10:00:00Z' },
    });

    const result = await query({
      type: 'aggregate',
      collection: 'col',
      where: [{ field: 'playedTime', op: 'gte', value: '2024-01-20T00:00:00Z' }],
    });

    expect(result.count).toBe(2);
  });
});
