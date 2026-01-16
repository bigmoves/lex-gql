/**
 * Set up the required database schema for lex-gql-sqlite
 * @param {import('better-sqlite3').Database} db
 */
export function setupSchema(db: import("better-sqlite3").Database): void;
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
export function createWriter(db: import("better-sqlite3").Database): Writer;
/**
 * Build SQL WHERE clause from lex-gql where conditions
 * @param {import('lex-gql').WhereClause[]} where
 * @returns {{ sql: string, params: any[] }}
 */
export function buildWhere(where: import("lex-gql").WhereClause[]): {
    sql: string;
    params: any[];
};
/**
 * Build SQL ORDER BY clause from lex-gql sort conditions
 * @param {Array<{field: string, dir?: string}>} sort
 * @returns {string}
 */
export function buildOrderBy(sort: Array<{
    field: string;
    dir?: string;
}>): string;
/**
 * Create a SQLite query adapter for lex-gql
 * @param {import('better-sqlite3').Database} db - better-sqlite3 database instance
 * @returns {(op: import('lex-gql').Operation) => Promise<any>}
 */
export function createSqliteAdapter(db: import("better-sqlite3").Database): (op: import("lex-gql").Operation) => Promise<any>;
/**
 * SQL schema for lex-gql records
 */
export const SCHEMA_SQL: "\n  CREATE TABLE IF NOT EXISTS records (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    uri TEXT UNIQUE NOT NULL,\n    did TEXT NOT NULL,\n    collection TEXT NOT NULL,\n    rkey TEXT NOT NULL,\n    cid TEXT,\n    record TEXT NOT NULL,\n    indexed_at TEXT NOT NULL\n  );\n\n  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);\n  CREATE INDEX IF NOT EXISTS idx_records_did ON records(did);\n  CREATE INDEX IF NOT EXISTS idx_records_uri ON records(uri);\n\n  CREATE TABLE IF NOT EXISTS actors (\n    did TEXT PRIMARY KEY,\n    handle TEXT NOT NULL\n  );\n";
export type RecordInput = {
    /**
     * - Record URI (at://did/collection/rkey)
     */
    uri: string;
    /**
     * - Record CID
     */
    cid?: string | undefined;
    /**
     * - Record data (will be JSON stringified)
     */
    record: object;
    /**
     * - Timestamp (defaults to now)
     */
    indexedAt?: string | undefined;
};
export type Writer = {
    /**
     * - Insert or replace a record
     */
    insertRecord: (record: RecordInput) => void;
    /**
     * - Delete a record by URI
     */
    deleteRecord: (uri: string) => void;
    /**
     * - Insert or replace an actor
     */
    upsertActor: (did: string, handle: string) => void;
};
