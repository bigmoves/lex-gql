import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { setupSchema, buildWhere } from './lex-gql-sqlite.js';

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
