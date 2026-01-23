/**
 * Convert NSID to PascalCase type name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "AppBskyFeedPost"
 */
export function nsidToTypeName(nsid: string): string;
/**
 * Convert NSID to camelCase field name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "appBskyFeedPost"
 */
export function nsidToFieldName(nsid: string): string;
/**
 * Extract collection name (last segment) from NSID
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "post"
 */
export function nsidToCollectionName(nsid: string): string;
/**
 * Map AT Protocol lexicon type to GraphQL type name
 * @param {string} lexiconType
 * @returns {string}
 */
export function mapLexiconType(lexiconType: string): string;
/**
 * Parse a ref URI into nsid and fragment
 * @param {string} refUri - e.g. "xyz.statusphere.post#embed" or "#mention"
 * @returns {{ nsid: string|null, fragment: string }}
 */
export function parseRefUri(refUri: string): {
    nsid: string | null;
    fragment: string;
};
/**
 * Resolve a ref string to a full registry key
 * @param {string} ref - The ref string (e.g., "#replyRef" or "app.bsky.embed.images")
 * @param {string} parentLexiconId - The lexicon ID containing this ref
 * @returns {string} Full registry key
 */
export function resolveRefKey(ref: string, parentLexiconId: string): string;
/**
 * Convert a ref URI to a GraphQL type name
 * @param {string} refUri - e.g. "fm.teal.alpha.feed.defs#artist"
 * @returns {string} - e.g. "FmTealAlphaFeedDefsArtist"
 */
export function refToTypeName(refUri: string): string;
/**
 * Inject DID into blob objects for URL resolution.
 * Blobs need the parent record's DID to generate CDN URLs.
 *
 * @param {any} obj - Record object or value to hydrate
 * @param {string} did - DID to inject into blob objects
 * @returns {any} - Hydrated object with did added to blobs
 *
 * @example
 * const record = JSON.parse(row.record);
 * const hydrated = hydrateBlobs(record, row.did);
 */
export function hydrateBlobs(obj: any, did: string): any;
/**
 * @typedef {Object} DatabaseRow
 * @property {string} uri - Record AT URI
 * @property {string} did - Author DID
 * @property {string} collection - Lexicon NSID
 * @property {string} [cid] - Content ID
 * @property {string|Object} record - JSON string or parsed object
 * @property {string} indexed_at - ISO timestamp
 * @property {string} [handle] - Actor handle from actors table join
 */
/**
 * Transform a database row into lex-gql record format.
 * Expects the standard records table schema.
 *
 * Standard schema:
 * - uri: TEXT (record AT URI)
 * - did: TEXT (author DID)
 * - collection: TEXT (lexicon NSID)
 * - cid: TEXT (optional, content ID)
 * - record: TEXT (JSON) or Object
 * - indexed_at: TEXT (ISO timestamp)
 * - handle: TEXT (optional, actor handle from actors table join)
 *
 * @param {DatabaseRow} row - Database row
 * @returns {Record<string, any>} - Hydrated record for lex-gql
 *
 * @example
 * const rows = db.query('SELECT r.*, a.handle FROM records r LEFT JOIN actors a ON r.did = a.did');
 * const records = rows.map(hydrateRecord);
 */
export function hydrateRecord(row: DatabaseRow): Record<string, any>;
/**
 * Parse a lexicon JSON object into structured form
 * @param {RawLexiconJson} json - Raw lexicon JSON
 * @returns {Lexicon}
 */
export function parseLexicon(json: RawLexiconJson): Lexicon;
/**
 * Build a GraphQL schema from parsed lexicons
 * @param {Lexicon[]} lexicons
 * @returns {GraphQLSchema}
 */
export function buildSchema(lexicons: Lexicon[]): GraphQLSchema;
/**
 * Create a GraphQL adapter with query resolvers
 * @param {Lexicon[]} lexicons
 * @param {AdapterOptions} options
 * @returns {{
 *   schema: GraphQLSchema,
 *   execute: (query: string, variables?: Record<string, unknown>) => Promise<any>,
 *   subscribe: (query: string, variables?: Record<string, unknown>) => Promise<AsyncIterable<import('graphql').ExecutionResult>>
 * }}
 */
export function createAdapter(lexicons: Lexicon[], options: AdapterOptions): {
    schema: GraphQLSchema;
    execute: (query: string, variables?: Record<string, unknown>) => Promise<any>;
    subscribe: (query: string, variables?: Record<string, unknown>) => Promise<AsyncIterable<import("graphql").ExecutionResult>>;
};
export namespace ErrorCodes {
    let INVALID_LEXICON: string;
    let UNSUPPORTED_VERSION: string;
    let QUERY_FAILED: string;
    let VALIDATION_FAILED: string;
}
/**
 * Custom error class for lex-gql errors
 */
export class LexGqlError extends Error {
    /**
     * @param {string} message
     * @param {string} code
     * @param {Object} [details]
     */
    constructor(message: string, code: string, details?: Object);
    code: string;
    details: Object;
}
/**
 * JoinCollector for batching forward join resolution
 */
export class JoinCollector {
    /**
     * @param {(op: Operation) => Promise<any>} queryFn
     */
    constructor(queryFn: (op: Operation) => Promise<any>);
    queryFn: (op: Operation) => Promise<any>;
    pending: Map<any, any>;
    resolved: Map<any, any>;
    scheduled: boolean;
    /**
     * Add a URI to be resolved
     * @param {string} uri
     * @returns {Promise<any>}
     */
    load(uri: string): Promise<any>;
    /**
     * Flush pending URIs and resolve them in batch
     */
    flush(): Promise<void>;
}
/**
 * DidCollector for batching DID-based join resolution
 * Groups lookups by collection and batches DIDs within each collection
 */
export class DidCollector {
    /**
     * @param {(op: Operation) => Promise<any>} queryFn
     */
    constructor(queryFn: (op: Operation) => Promise<any>);
    queryFn: (op: Operation) => Promise<any>;
    pending: Map<any, any>;
    resolved: Map<any, any>;
    scheduled: boolean;
    /**
     * Load a record by DID from a collection
     * @param {string} collection
     * @param {string} did
     * @param {boolean} unique - If true, return single record; if false, return array
     * @returns {Promise<any>}
     */
    load(collection: string, did: string, unique?: boolean): Promise<any>;
    /**
     * Flush pending DIDs and resolve them in batch
     */
    flush(): Promise<void>;
}
/**
 * ReverseJoinCollector for batching reverse join resolution
 * Groups lookups by (collection, fieldName, pagination, sort) and batches parent URIs
 */
export class ReverseJoinCollector {
    /**
     * @param {(op: Operation) => Promise<any>} queryFn
     */
    constructor(queryFn: (op: Operation) => Promise<any>);
    queryFn: (op: Operation) => Promise<any>;
    /** @type {Map<string, { collection: string, fieldName: string, pagination: any, sort: any, parentUris: string[], callbacks: Array<(result: any) => void> }>} */
    pending: Map<string, {
        collection: string;
        fieldName: string;
        pagination: any;
        sort: any;
        parentUris: string[];
        callbacks: Array<(result: any) => void>;
    }>;
    scheduled: boolean;
    /**
     * Create a hash key for grouping requests with identical parameters
     * @param {string} collection
     * @param {string} fieldName
     * @param {any} pagination
     * @param {any} sort
     * @returns {string}
     */
    _makeKey(collection: string, fieldName: string, pagination: any, sort: any): string;
    /**
     * Load reverse join results for a parent URI
     * @param {string} collection - The collection to query (e.g., 'app.bsky.feed.threadgate')
     * @param {string} fieldName - The field that references the parent (e.g., 'post')
     * @param {string} parentUri - The parent record's URI
     * @param {{ first?: number, after?: string, last?: number, before?: string }} pagination
     * @param {Array<{ field: string, dir?: string }>} sort
     * @returns {Promise<{ rows: any[], hasNext: boolean, hasPrev: boolean, totalCount: number }>}
     */
    load(collection: string, fieldName: string, parentUri: string, pagination: {
        first?: number;
        after?: string;
        last?: number;
        before?: string;
    }, sort: Array<{
        field: string;
        dir?: string;
    }>): Promise<{
        rows: any[];
        hasNext: boolean;
        hasPrev: boolean;
        totalCount: number;
    }>;
    /**
     * Flush pending requests and resolve them in batch
     */
    flush(): Promise<void>;
    /**
     * Fallback to individual findMany queries when findManyPartitioned is not supported
     * @param {{ collection: string, fieldName: string, pagination: any, sort: any, parentUris: string[], callbacks: Array<(result: any) => void> }} group
     */
    _fallbackToIndividualQueries(group: {
        collection: string;
        fieldName: string;
        pagination: any;
        sort: any;
        parentUris: string[];
        callbacks: Array<(result: any) => void>;
    }): Promise<void>;
}
/** @type {Array<{field: string, dir: string}>} */
export const DEFAULT_SORT: Array<{
    field: string;
    dir: string;
}>;
export type DatabaseRow = {
    /**
     * - Record AT URI
     */
    uri: string;
    /**
     * - Author DID
     */
    did: string;
    /**
     * - Lexicon NSID
     */
    collection: string;
    /**
     * - Content ID
     */
    cid?: string | undefined;
    /**
     * - JSON string or parsed object
     */
    record: string | Object;
    /**
     * - ISO timestamp
     */
    indexed_at: string;
    /**
     * - Actor handle from actors table join
     */
    handle?: string | undefined;
};
/**
 * A where clause for filtering records.
 * Can be a field condition or a logical operator (AND/OR).
 *
 * Field condition: { field: 'text', op: 'eq', value: 'hello' }
 * Logical AND:     { op: 'and', conditions: WhereClause[][] }
 * Logical OR:      { op: 'or', conditions: WhereClause[][] }
 */
export type WhereClause = {
    /**
     * - Field name (for field conditions)
     */
    field?: string | undefined;
    /**
     * - Operator: 'eq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or'
     */
    op: string;
    /**
     * - Value to compare (for field conditions)
     */
    value?: any;
    /**
     * - Nested conditions (for and/or)
     */
    conditions?: WhereClause[][] | undefined;
};
export type SortClause = {
    field: string;
    dir: string;
};
export type Pagination = {
    first?: number | undefined;
    after?: string | undefined;
    last?: number | undefined;
    before?: string | undefined;
};
export type Aggregate = {
    field: string;
    fn: string;
};
export type Operation = {
    type: "findMany" | "findManyPartitioned" | "findOne" | "count" | "aggregate" | "create" | "update" | "delete";
    collection: string;
    where?: WhereClause[] | undefined;
    select?: string[] | undefined;
    sort?: SortClause[] | undefined;
    pagination?: Pagination | undefined;
    data?: Record<string, any> | undefined;
    uri?: string | undefined;
    rkey?: string | undefined;
    groupBy?: string[] | undefined;
    aggregates?: Aggregate[] | undefined;
    limit?: number | undefined;
    orderBy?: "COUNT_ASC" | "COUNT_DESC" | undefined;
    arrayFields?: string[] | undefined;
    partitionField?: string | undefined;
    partitionValues?: string[] | undefined;
};
export type PartitionedResultEntry = {
    rows: Record<string, any>[];
    hasNext: boolean;
    hasPrev: boolean;
    totalCount?: number | undefined;
};
export type PartitionedResult = {
    [x: string]: PartitionedResultEntry;
};
export type AdapterOptions = {
    query: (op: Operation) => Promise<any>;
    subscribe?: ((op: SubscribeOperation) => AsyncIterable<any>) | undefined;
    context?: Record<string, any> | undefined;
    maxDepth?: number | undefined;
};
export type SubscriptionEvent = "created" | "updated" | "deleted";
export type SubscribeOperation = {
    /**
     * - The collection NSID (e.g., 'app.bsky.feed.post')
     */
    collection: string;
    /**
     * - The event type
     */
    event: SubscriptionEvent;
};
export type Property = {
    name: string;
    type: string;
    required: boolean;
    format?: string | null | undefined;
    ref?: string | null | undefined;
    refs?: string[] | null | undefined;
    items?: ArrayItems | null | undefined;
};
export type ArrayItems = {
    type: string;
    ref?: string | null | undefined;
    refs?: string[] | null | undefined;
};
export type RecordDef = {
    type: string;
    key?: string | null | undefined;
    properties: Property[];
};
export type Lexicon = {
    id: string;
    defs: {
        main: RecordDef | null;
        others: Record<string, RecordDef>;
    };
};
export type RawLexiconJson = {
    id: string;
    lexicon?: number | undefined;
    defs?: Record<string, any> | undefined;
};
import { GraphQLSchema } from 'graphql';
