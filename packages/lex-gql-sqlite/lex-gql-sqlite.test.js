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
