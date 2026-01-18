/**
 * @typedef {Object} DuckDBConnection
 * @property {duckdb.Database} db - The DuckDB database instance
 * @property {duckdb.Connection} conn - The connection instance
 * @property {(sql: string, ...params: any[]) => Promise<void>} run - Execute a statement
 * @property {(sql: string, ...params: any[]) => Promise<any[]>} all - Query all rows
 * @property {(sql: string, ...params: any[]) => Promise<any>} get - Query single row
 */
/**
 * Create a promisified DuckDB connection
 * @param {string} dbPath - Path to database file (use ':memory:' for in-memory)
 * @returns {Promise<DuckDBConnection>}
 */
export function createDuckDB(dbPath: string): Promise<DuckDBConnection>;
/**
 * Set up the required database schema for lex-gql-duckdb
 * @param {DuckDBConnection} conn
 */
export function setupSchema(conn: DuckDBConnection): Promise<void>;
/**
 * @typedef {Object} RecordInput
 * @property {string} uri - Record URI (at://did/collection/rkey)
 * @property {string} [cid] - Record CID
 * @property {object} record - Record data (will be JSON stringified)
 * @property {string} [indexedAt] - Timestamp (defaults to now)
 */
/**
 * @typedef {Object} Writer
 * @property {(record: RecordInput) => Promise<void>} insertRecord - Insert or replace a record
 * @property {(records: RecordInput[]) => Promise<void>} insertRecordsBatch - Insert multiple records in a single statement
 * @property {(uri: string) => Promise<void>} deleteRecord - Delete a record by URI
 * @property {(did: string, handle: string) => Promise<void>} upsertActor - Insert or replace an actor
 */
/**
 * Create a writer with methods for efficient writes
 * @param {DuckDBConnection} conn
 * @returns {Writer}
 */
export function createWriter(conn: DuckDBConnection): Writer;
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
 * Create a DuckDB query adapter for lex-gql
 * @param {DuckDBConnection} conn - DuckDB connection from createDuckDB()
 * @returns {(op: import('lex-gql').Operation) => Promise<any>}
 */
export function createDuckDBAdapter(conn: DuckDBConnection): (op: import("lex-gql").Operation) => Promise<any>;
/**
 * SQL schema for lex-gql records
 */
export const SCHEMA_SQL: "\n  CREATE SEQUENCE IF NOT EXISTS records_id_seq;\n\n  CREATE TABLE IF NOT EXISTS records (\n    id INTEGER DEFAULT nextval('records_id_seq'),\n    uri TEXT UNIQUE NOT NULL,\n    did TEXT NOT NULL,\n    collection TEXT NOT NULL,\n    rkey TEXT NOT NULL,\n    cid TEXT,\n    record JSON NOT NULL,\n    indexed_at TIMESTAMP NOT NULL\n  );\n\n  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);\n  CREATE INDEX IF NOT EXISTS idx_records_did ON records(did);\n\n  CREATE TABLE IF NOT EXISTS actors (\n    did TEXT PRIMARY KEY,\n    handle TEXT NOT NULL\n  );\n";
export type DuckDBConnection = {
    /**
     * - The DuckDB database instance
     */
    db: duckdb.Database;
    /**
     * - The connection instance
     */
    conn: duckdb.Connection;
    /**
     * - Execute a statement
     */
    run: (sql: string, ...params: any[]) => Promise<void>;
    /**
     * - Query all rows
     */
    all: (sql: string, ...params: any[]) => Promise<any[]>;
    /**
     * - Query single row
     */
    get: (sql: string, ...params: any[]) => Promise<any>;
};
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
    insertRecord: (record: RecordInput) => Promise<void>;
    /**
     * - Insert multiple records in a single statement
     */
    insertRecordsBatch: (records: RecordInput[]) => Promise<void>;
    /**
     * - Delete a record by URI
     */
    deleteRecord: (uri: string) => Promise<void>;
    /**
     * - Insert or replace an actor
     */
    upsertActor: (did: string, handle: string) => Promise<void>;
};
import duckdb from 'duckdb';
