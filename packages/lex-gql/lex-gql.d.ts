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
 * Convert a ref URI to a GraphQL type name
 * @param {string} refUri - e.g. "fm.teal.alpha.feed.defs#artist"
 * @returns {string} - e.g. "FmTealAlphaFeedDefsArtist"
 */
export function refToTypeName(refUri: string): string;
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
export function createAdapter(
  lexicons: Lexicon[],
  options: AdapterOptions,
): {
  schema: GraphQLSchema;
  execute: (query: string, variables?: Record<string, unknown>) => Promise<any>;
  subscribe: (
    query: string,
    variables?: Record<string, unknown>,
  ) => Promise<AsyncIterable<import('graphql').ExecutionResult>>;
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
export type WhereClause = {
  field: string;
  op: string;
  value: any;
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
  type: 'findMany' | 'findOne' | 'count' | 'aggregate' | 'create' | 'update' | 'delete';
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
};
export type AdapterOptions = {
  query: (op: Operation) => Promise<any>;
  subscribe?: ((op: SubscribeOperation) => AsyncIterable<any>) | undefined;
  context?: Record<string, any> | undefined;
  maxDepth?: number | undefined;
};
export type SubscriptionEvent = 'created' | 'updated' | 'deleted';
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
