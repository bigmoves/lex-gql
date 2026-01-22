/*
 *   _      ___  _   _          ___    ___    _
 *  | |    | __| \ \/ /  ___   / __|  / _ \  | |
 *  | |__  | _|   >  <  |___| | (_ | | (_) | | |__
 *  |____| |___| /_/\_\        \___|  \__\_\ |____|
 *
 *  GraphQL for AT Protocol Lexicons
 */

import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql';

// ============================================================================
// TYPES
// ============================================================================

/**
 * A where clause for filtering records.
 * Can be a field condition or a logical operator (AND/OR).
 *
 * Field condition: { field: 'text', op: 'eq', value: 'hello' }
 * Logical AND:     { op: 'and', conditions: WhereClause[][] }
 * Logical OR:      { op: 'or', conditions: WhereClause[][] }
 *
 * @typedef {Object} WhereClause
 * @property {string} [field] - Field name (for field conditions)
 * @property {string} op - Operator: 'eq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or'
 * @property {*} [value] - Value to compare (for field conditions)
 * @property {WhereClause[][]} [conditions] - Nested conditions (for and/or)
 */

/**
 * @typedef {Object} SortClause
 * @property {string} field
 * @property {string} dir
 */

/**
 * @typedef {Object} Pagination
 * @property {number} [first]
 * @property {string} [after]
 * @property {number} [last]
 * @property {string} [before]
 */

/**
 * @typedef {Object} Aggregate
 * @property {string} field
 * @property {string} fn
 */

/**
 * @typedef {Object} Operation
 * @property {'findMany'|'findOne'|'count'|'aggregate'|'create'|'update'|'delete'} type
 * @property {string} collection
 * @property {WhereClause[]} [where]
 * @property {string[]} [select]
 * @property {SortClause[]} [sort]
 * @property {Pagination} [pagination]
 * @property {Record<string, *>} [data]
 * @property {string} [uri]
 * @property {string} [rkey]
 * @property {string[]} [groupBy]
 * @property {Aggregate[]} [aggregates]
 * @property {number} [limit]
 * @property {'COUNT_ASC'|'COUNT_DESC'} [orderBy]
 * @property {string[]} [arrayFields]
 */

/**
 * @typedef {Object} AdapterOptions
 * @property {(op: Operation) => Promise<*>} query
 * @property {(op: SubscribeOperation) => AsyncIterable<*>} [subscribe]
 * @property {Record<string, *>} [context]
 * @property {number} [maxDepth]
 */

/**
 * @typedef {'created' | 'updated' | 'deleted'} SubscriptionEvent
 */

/**
 * @typedef {Object} SubscribeOperation
 * @property {string} collection - The collection NSID (e.g., 'app.bsky.feed.post')
 * @property {SubscriptionEvent} event - The event type
 */

/**
 * @typedef {Object} Property
 * @property {string} name
 * @property {string} type
 * @property {boolean} required
 * @property {string|null} [format]
 * @property {string|null} [ref]
 * @property {string[]|null} [refs]
 * @property {ArrayItems|null} [items]
 */

/**
 * @typedef {Object} ArrayItems
 * @property {string} type
 * @property {string|null} [ref]
 * @property {string[]|null} [refs]
 */

/**
 * @typedef {Object} RecordDef
 * @property {string} type
 * @property {string|null} [key]
 * @property {Property[]} properties
 */

/**
 * @typedef {Object} Lexicon
 * @property {string} id
 * @property {{ main: RecordDef|null, others: Record<string, RecordDef> }} defs
 */

/**
 * @typedef {Object} RawLexiconJson
 * @property {string} id
 * @property {number} [lexicon]
 * @property {Record<string, *>} [defs]
 */

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Error codes for LexGqlError
 */
export const ErrorCodes = {
  INVALID_LEXICON: 'INVALID_LEXICON',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  QUERY_FAILED: 'QUERY_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
};

/**
 * Custom error class for lex-gql errors
 */
export class LexGqlError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {Object} [details]
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'LexGqlError';
    this.code = code;
    this.details = details;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Convert NSID to PascalCase type name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "AppBskyFeedPost"
 */
export function nsidToTypeName(nsid) {
  return nsid
    .split('.')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

/**
 * Convert NSID to camelCase field name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "appBskyFeedPost"
 */
export function nsidToFieldName(nsid) {
  const typeName = nsidToTypeName(nsid);
  return typeName.charAt(0).toLowerCase() + typeName.slice(1);
}

/**
 * Extract collection name (last segment) from NSID
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "post"
 */
export function nsidToCollectionName(nsid) {
  const segments = nsid.split('.');
  return segments[segments.length - 1];
}

/**
 * Map AT Protocol lexicon type to GraphQL type name
 * @param {string} lexiconType
 * @returns {string}
 */
export function mapLexiconType(lexiconType) {
  /** @type {Record<string, string>} */
  const typeMap = {
    string: 'String',
    integer: 'Int',
    boolean: 'Boolean',
    number: 'Float',
    blob: 'Blob',
    bytes: 'String',
    'cid-link': 'String',
    ref: 'String',
    union: 'String',
  };
  return typeMap[lexiconType] || 'String';
}

/**
 * Parse a ref URI into nsid and fragment
 * @param {string} refUri - e.g. "xyz.statusphere.post#embed" or "#mention"
 * @returns {{ nsid: string|null, fragment: string }}
 */
export function parseRefUri(refUri) {
  if (refUri.startsWith('#')) {
    return { nsid: null, fragment: refUri.slice(1) };
  }

  const hashIndex = refUri.indexOf('#');
  if (hashIndex === -1) {
    return { nsid: refUri, fragment: 'main' };
  }

  return {
    nsid: refUri.slice(0, hashIndex),
    fragment: refUri.slice(hashIndex + 1),
  };
}

/**
 * Resolve a ref string to a full registry key
 * @param {string} ref - The ref string (e.g., "#replyRef" or "app.bsky.embed.images")
 * @param {string} parentLexiconId - The lexicon ID containing this ref
 * @returns {string} Full registry key
 */
export function resolveRefKey(ref, parentLexiconId) {
  if (ref.startsWith('#')) {
    // Local ref: #replyRef -> app.bsky.feed.post#replyRef
    return `${parentLexiconId}${ref}`;
  }
  // External ref: already fully qualified
  return ref;
}

/**
 * Convert a ref URI to a GraphQL type name
 * @param {string} refUri - e.g. "fm.teal.alpha.feed.defs#artist"
 * @returns {string} - e.g. "FmTealAlphaFeedDefsArtist"
 */
export function refToTypeName(refUri) {
  const { nsid, fragment } = parseRefUri(refUri);

  if (!nsid) {
    // Local ref - will need context to resolve
    return fragment.charAt(0).toUpperCase() + fragment.slice(1);
  }

  const baseName = nsidToTypeName(nsid);
  if (fragment === 'main') {
    return baseName;
  }

  return baseName + fragment.charAt(0).toUpperCase() + fragment.slice(1);
}

// ============================================================================
// HYDRATION HELPERS
// ============================================================================

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
export function hydrateBlobs(obj, did) {
  if (!obj || typeof obj !== 'object') return obj;

  // Check if this is a blob (has $type: 'blob' or has ref + mimeType + size)
  if (obj.$type === 'blob' || (obj.ref && obj.mimeType && obj.size)) {
    return {
      ...obj,
      ref: obj.ref?.$link || obj.ref, // Normalize { $link: "..." } format
      did,
    };
  }

  // Recurse into arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => hydrateBlobs(item, did));
  }

  // Recurse into object properties
  /** @type {Record<string, any>} */
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = hydrateBlobs(value, did);
  }
  return result;
}

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
export function hydrateRecord(row) {
  const record = typeof row.record === 'string' ? JSON.parse(row.record) : row.record;
  const hydrated = hydrateBlobs(record, row.did);

  // Spread hydrated first so metadata fields take precedence
  return {
    ...hydrated,
    uri: row.uri,
    cid: row.cid,
    did: row.did,
    collection: row.collection,
    indexedAt: row.indexed_at,
    actorHandle: row.handle || null,
  };
}

// ============================================================================
// LEXICON PARSING
// ============================================================================

/**
 * Parse a lexicon JSON object into structured form
 * @param {RawLexiconJson} json - Raw lexicon JSON
 * @returns {Lexicon}
 */
export function parseLexicon(json) {
  if (!json.id) {
    throw new LexGqlError('Lexicon missing required field: id', ErrorCodes.INVALID_LEXICON, {
      field: 'id',
    });
  }

  if (json.lexicon !== undefined && json.lexicon !== 1) {
    throw new LexGqlError(
      `Unsupported lexicon version: ${json.lexicon}`,
      ErrorCodes.UNSUPPORTED_VERSION,
      { version: json.lexicon },
    );
  }

  /** @type {{ main: RecordDef|null, others: Record<string, RecordDef> }} */
  const defs = { main: null, others: {} };

  if (json.defs) {
    for (const [name, def] of Object.entries(json.defs)) {
      const parsed = parseDefinition(/** @type {Record<string, *>} */ (def), json.defs);
      if (name === 'main') {
        defs.main = parsed;
      } else {
        defs.others[name] = parsed;
      }
    }
  }

  return { id: json.id, defs };
}

/**
 * Parse a single definition (record or object type)
 * @param {Record<string, *>} def
 * @param {Record<string, *>} _allDefs - All defs for resolving required fields
 * @returns {RecordDef}
 */
function parseDefinition(def, _allDefs) {
  const type = def.type;
  const key = def.key || null;

  // Get the object definition (either directly or from record.record)
  const objDef = type === 'record' ? def.record : def;

  if (!objDef || !objDef.properties) {
    return { type, key, properties: [] };
  }

  const required = new Set(objDef.required || []);
  const properties = [];

  for (const [propName, propDef] of Object.entries(objDef.properties)) {
    properties.push({
      name: propName,
      type: propDef.type,
      required: required.has(propName),
      format: propDef.format || null,
      ref: propDef.ref || null,
      refs: propDef.refs || null,
      items: propDef.items
        ? {
            type: propDef.items.type,
            ref: propDef.items.ref || null,
            refs: propDef.items.refs || null,
          }
        : null,
    });
  }

  return { type, key, properties };
}

// ============================================================================
// GRAPHQL TYPE CREATORS - Shared Types
// ============================================================================

/**
 * Create PageInfo type for pagination
 * @returns {GraphQLObjectType}
 */
function createPageInfoType() {
  return new GraphQLObjectType({
    name: 'PageInfo',
    fields: {
      hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      hasPreviousPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      startCursor: { type: GraphQLString },
      endCursor: { type: GraphQLString },
    },
  });
}

/**
 * Create SortDirection enum
 * @returns {GraphQLEnumType}
 */
function createSortDirectionEnum() {
  return new GraphQLEnumType({
    name: 'SortDirection',
    values: {
      ASC: { value: 'asc' },
      DESC: { value: 'desc' },
    },
  });
}

/**
 * Create AggregateOrderBy enum for aggregate query ordering
 * @returns {GraphQLEnumType}
 */
function createAggregateOrderByEnum() {
  return new GraphQLEnumType({
    name: 'AggregateOrderBy',
    description: 'Order direction for aggregate count',
    values: {
      COUNT_ASC: { value: 'COUNT_ASC', description: 'Ascending by count' },
      COUNT_DESC: { value: 'COUNT_DESC', description: 'Descending by count (default)' },
    },
  });
}

/**
 * Create DeleteResult type
 * @returns {GraphQLObjectType}
 */
function createDeleteResultType() {
  return new GraphQLObjectType({
    name: 'DeleteResult',
    fields: {
      uri: { type: GraphQLString, description: 'URI of deleted record' },
    },
  });
}

const VALID_BLOB_PRESETS = ['avatar', 'banner', 'feed_thumbnail', 'feed_fullsize'];

/**
 * Create Blob object type for blob fields
 * NOTE: The url resolver requires 'did' to be injected into blob objects
 * by the data layer (from parent record).
 * @returns {GraphQLObjectType}
 */
function createBlobType() {
  return new GraphQLObjectType({
    name: 'Blob',
    description: 'Binary blob reference',
    fields: {
      ref: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'CID reference to the blob',
        resolve: (blob) => {
          // Handle ATProto format: ref: { $link: 'cid' } -> 'cid'
          if (blob.ref && typeof blob.ref === 'object' && blob.ref.$link) {
            return blob.ref.$link;
          }
          return blob.ref;
        },
      },
      mimeType: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'MIME type of the blob',
      },
      size: {
        type: new GraphQLNonNull(GraphQLInt),
        description: 'Size in bytes',
      },
      url: {
        type: new GraphQLNonNull(GraphQLString),
        description:
          'Generate CDN URL for the blob with the specified preset (avatar, banner, feed_thumbnail, feed_fullsize)',
        args: {
          preset: {
            type: GraphQLString,
            description: 'Image preset: avatar, banner, feed_thumbnail, feed_fullsize',
          },
        },
        resolve: (blob, { preset = 'feed_fullsize' }) => {
          const { ref, did } = blob;
          if (!did || !ref) {
            throw new Error('Blob missing required did or ref for URL generation');
          }
          if (!VALID_BLOB_PRESETS.includes(preset)) {
            throw new Error(
              `Invalid blob preset: ${preset}. Valid presets: ${VALID_BLOB_PRESETS.join(', ')}`,
            );
          }
          return `https://cdn.bsky.app/img/${preset}/plain/${did}/${ref}@jpeg`;
        },
      },
    },
  });
}

/**
 * Create ComAtprotoRepoStrongRef type for strong references
 * @returns {GraphQLObjectType}
 */
/**
 * @param {() => GraphQLUnionType | null} [getRecordUnionType] - Getter for Record union type (for forward joins)
 */
function createStrongRefType(getRecordUnionType) {
  return new GraphQLObjectType({
    name: 'ComAtprotoRepoStrongRef',
    description: 'Strong reference to another record',
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
      const fields = {
        cid: {
          type: new GraphQLNonNull(GraphQLString),
          description: 'CID of the referenced record',
        },
        uri: {
          type: new GraphQLNonNull(GraphQLString),
          description: 'AT URI of the referenced record',
        },
      };
      // Add forward join field for uri
      const recordUnionType = getRecordUnionType ? getRecordUnionType() : null;
      if (recordUnionType) {
        fields.uriResolved = {
          type: recordUnionType,
          description: 'Forward join to referenced record',
        };
      }
      return fields;
    },
  });
}

// ============================================================================
// GRAPHQL TYPE CREATORS - Field Conditions
// ============================================================================

/**
 * Create field condition input types for filtering
 * @returns {Record<string, GraphQLInputObjectType>}
 */
function createFieldConditionTypes() {
  const operators = ['eq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte'];

  /**
   * @param {string} name
   * @param {import('graphql').GraphQLScalarType} scalarType
   */
  const makeConditionType = (name, scalarType) => {
    /** @type {Record<string, import('graphql').GraphQLInputFieldConfig>} */
    const fields = {};
    for (const op of operators) {
      if (op === 'in') {
        fields[op] = { type: new GraphQLList(scalarType) };
      } else {
        fields[op] = { type: scalarType };
      }
    }
    return new GraphQLInputObjectType({ name, fields });
  };

  return {
    String: makeConditionType('StringFieldCondition', GraphQLString),
    Int: makeConditionType('IntFieldCondition', GraphQLInt),
    Float: makeConditionType('FloatFieldCondition', GraphQLFloat),
    Boolean: makeConditionType('BooleanFieldCondition', GraphQLBoolean),
  };
}

/**
 * Create per-type field condition input type
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @param {Record<string, GraphQLInputObjectType>} fieldConditionInputTypes - For self-reference in AND/OR
 * @returns {GraphQLInputObjectType}
 */
function createPerTypeFieldCondition(typeName, recordDef, fieldConditionInputTypes) {
  const conditionTypeName = `${typeName}FieldCondition`;

  return new GraphQLInputObjectType({
    name: conditionTypeName,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLInputFieldConfig>} */
      const fields = {};

      // Add conditions for each field based on type
      for (const prop of recordDef.properties) {
        const gqlTypeName = mapLexiconType(prop.type);
        if (['String', 'Int', 'Float', 'Boolean'].includes(gqlTypeName)) {
          fields[prop.name] = { type: GraphQLString }; // Simplified - accepts condition object
        }
      }

      // Add logical operators with self-reference
      const selfType = fieldConditionInputTypes[typeName];
      if (selfType) {
        fields.AND = { type: new GraphQLList(selfType) };
        fields.OR = { type: new GraphQLList(selfType) };
      }

      return fields;
    },
  });
}

// ============================================================================
// GRAPHQL TYPE CREATORS - Per-Record Types
// ============================================================================

/**
 * Create edge type for a record type
 * @param {string} typeName
 * @param {GraphQLObjectType} nodeType
 * @returns {GraphQLObjectType}
 */
function createEdgeType(typeName, nodeType) {
  return new GraphQLObjectType({
    name: `${typeName}Edge`,
    fields: {
      node: { type: nodeType },
      cursor: { type: new GraphQLNonNull(GraphQLString) },
    },
  });
}

/**
 * Create connection type for a record type
 * @param {string} typeName
 * @param {GraphQLObjectType} edgeType
 * @param {GraphQLObjectType} pageInfoType
 * @returns {GraphQLObjectType}
 */
function createConnectionType(typeName, edgeType, pageInfoType) {
  return new GraphQLObjectType({
    name: `${typeName}Connection`,
    fields: {
      edges: { type: new GraphQLList(edgeType) },
      pageInfo: { type: new GraphQLNonNull(pageInfoType) },
      totalCount: { type: GraphQLInt },
    },
  });
}

/**
 * Create where input type for a record
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @param {Record<string, GraphQLInputObjectType>} fieldConditionTypes
 * @param {Record<string, GraphQLInputObjectType>} whereInputTypes - For self-reference in AND/OR
 * @returns {GraphQLInputObjectType}
 */
function createWhereInputType(typeName, recordDef, fieldConditionTypes, whereInputTypes) {
  const whereTypeName = `${typeName}WhereInput`;

  return new GraphQLInputObjectType({
    name: whereTypeName,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLInputFieldConfig>} */
      const fields = {};

      // Add system fields that are always filterable
      fields.uri = { type: fieldConditionTypes.String };
      fields.did = { type: fieldConditionTypes.String };
      fields.collection = { type: fieldConditionTypes.String };
      fields.actorHandle = { type: fieldConditionTypes.String };

      for (const prop of recordDef.properties) {
        const gqlType = mapLexiconType(prop.type);
        const conditionType = fieldConditionTypes[gqlType];
        if (conditionType) {
          fields[prop.name] = { type: conditionType };
        }
      }

      // Self-referential AND/OR for composable filters
      const selfType = whereInputTypes[typeName];
      fields.AND = { type: new GraphQLList(selfType) };
      fields.OR = { type: new GraphQLList(selfType) };

      return fields;
    },
  });
}

/**
 * Create sort field enum for a record
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @returns {GraphQLEnumType}
 */
function createSortFieldEnum(typeName, recordDef) {
  /** @type {Record<string, import('graphql').GraphQLEnumValueConfig>} */
  const values = {
    // System fields are always sortable
    uri: { value: 'uri' },
    indexedAt: { value: 'indexedAt' },
  };

  // Add primitive lexicon fields
  for (const prop of recordDef.properties) {
    if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
      values[prop.name] = { value: prop.name };
    }
  }

  return new GraphQLEnumType({
    name: `${typeName}SortField`,
    values,
  });
}

/**
 * Create sort input type for a record
 * @param {string} typeName
 * @param {GraphQLEnumType} sortFieldEnum
 * @param {GraphQLEnumType} sortDirectionEnum
 * @returns {GraphQLInputObjectType}
 */
function createSortInputType(typeName, sortFieldEnum, sortDirectionEnum) {
  return new GraphQLInputObjectType({
    name: `${typeName}SortFieldInput`,
    fields: {
      field: { type: new GraphQLNonNull(sortFieldEnum) },
      direction: { type: sortDirectionEnum },
    },
  });
}

/**
 * Create input type for mutations
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @returns {GraphQLInputObjectType}
 */
function createInputType(typeName, recordDef) {
  /** @type {Record<string, import('graphql').GraphQLInputFieldConfig>} */
  const fields = {};

  for (const prop of recordDef.properties) {
    const baseType = getGraphQLInputType(prop);
    fields[prop.name] = {
      type: prop.required ? new GraphQLNonNull(baseType) : baseType,
    };
  }

  return new GraphQLInputObjectType({
    name: `${typeName}Input`,
    fields,
  });
}

/**
 * Create aggregate result type with count and groups
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @param {string} lexiconId
 * @param {Record<string, GraphQLObjectType>} [typeRegistry]
 * @returns {GraphQLObjectType}
 */
function createAggregateResultType(typeName, recordDef, lexiconId, typeRegistry) {
  const groupTypeName = `${typeName}AggregateGroup`;

  // Create group type with groupable fields + count + array fields
  const groupType = new GraphQLObjectType({
    name: groupTypeName,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
      const fields = {
        count: { type: GraphQLInt },
        // System fields are always groupable
        uri: { type: GraphQLString },
        cid: { type: GraphQLString },
        did: { type: GraphQLString },
        collection: { type: GraphQLString },
        actorHandle: { type: GraphQLString },
      };

      // Add groupable primitive fields
      for (const prop of recordDef.properties) {
        if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
          fields[prop.name] = { type: getGraphQLType(prop) };

          // Add date interval fields for datetime properties
          if (prop.format === 'datetime') {
            fields[`${prop.name}_day`] = { type: GraphQLString };
            fields[`${prop.name}_week`] = { type: GraphQLString };
            fields[`${prop.name}_month`] = { type: GraphQLString };
          }
        }
      }

      // Add array fields (not groupable, but selectable from sample records)
      for (const prop of recordDef.properties) {
        if (prop.type === 'array') {
          const arrayType = getGraphQLType(
            prop,
            undefined, // blobType not needed for arrays
            undefined, // strongRefType not needed
            typeRegistry,
            lexiconId,
          );
          fields[prop.name] = { type: arrayType };
        }
      }

      return fields;
    },
  });

  return new GraphQLObjectType({
    name: `${typeName}Aggregated`,
    fields: {
      count: { type: GraphQLInt },
      groups: { type: new GraphQLList(groupType) },
    },
  });
}

/**
 * Create groupBy enum for aggregate queries
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @returns {GraphQLEnumType}
 */
function createAggregateGroupByEnum(typeName, recordDef) {
  /** @type {Record<string, import('graphql').GraphQLEnumValueConfig>} */
  const values = {
    // System fields are always groupable
    uri: { value: 'uri' },
    cid: { value: 'cid' },
    did: { value: 'did' },
    collection: { value: 'collection' },
    actorHandle: { value: 'actorHandle' },
  };

  for (const prop of recordDef.properties) {
    if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
      values[prop.name] = { value: prop.name };
    }
  }

  // Add date bucketing options for datetime fields
  for (const prop of recordDef.properties) {
    if (prop.format === 'datetime') {
      values[`${prop.name}_day`] = { value: `${prop.name}_day` };
      values[`${prop.name}_week`] = { value: `${prop.name}_week` };
      values[`${prop.name}_month`] = { value: `${prop.name}_month` };
    }
  }

  return new GraphQLEnumType({
    name: `${typeName}GroupByField`,
    values,
  });
}

/**
 * Create GraphQL object type for a nested definition (from others)
 * @param {string} lexiconId - Parent lexicon ID
 * @param {string} defName - Definition name (e.g., 'byteSlice')
 * @param {RecordDef} def - The definition
 * @param {GraphQLObjectType} blobType
 * @param {Record<string, GraphQLObjectType>} [typeRegistry] - Type registry for ref resolution
 * @param {() => GraphQLUnionType | null} [getRecordUnionType] - Getter for Record union type (for forward joins)
 * @returns {GraphQLObjectType}
 */
function createNestedObjectType(
  lexiconId,
  defName,
  def,
  blobType,
  typeRegistry,
  getRecordUnionType,
) {
  const typeName = nsidToTypeName(lexiconId) + defName.charAt(0).toUpperCase() + defName.slice(1);

  return new GraphQLObjectType({
    name: typeName,
    description: `Nested type from ${lexiconId}#${defName}`,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
      const fields = {};
      for (const prop of def.properties || []) {
        fields[prop.name] = {
          type: prop.required
            ? new GraphQLNonNull(getGraphQLType(prop, blobType, undefined, typeRegistry, lexiconId))
            : getGraphQLType(prop, blobType, undefined, typeRegistry, lexiconId),
          description: 'Field from object definition',
        };
      }
      // Add forward join fields for strongRef references
      const recordUnionType = getRecordUnionType ? getRecordUnionType() : null;
      addForwardJoinFields(fields, def.properties || [], recordUnionType);
      return fields;
    },
  });
}

/**
 * Create Record union type containing all record types
 * @param {Record<string, GraphQLObjectType>} recordTypes - Map of lexicon id to GraphQL object type
 * @returns {GraphQLUnionType|null}
 */
function createRecordUnionType(recordTypes) {
  const types = Object.values(recordTypes).filter(Boolean);

  if (types.length === 0) {
    return null;
  }

  return new GraphQLUnionType({
    name: 'Record',
    description: 'Union of all record types',
    types: () => types,
    resolveType: (value) => {
      // Use collection from URI to determine type
      if (value?.uri) {
        const parts = value.uri.split('/');
        if (parts.length >= 4) {
          const collection = parts[3];
          return nsidToTypeName(collection);
        }
      }
      return undefined;
    },
  });
}

// ============================================================================
// GRAPHQL TYPE CREATORS - Mutation Types
// ============================================================================

/**
 * Create mutation type for CRUD operations (no resolvers - for buildSchema)
 * @param {Lexicon[]} lexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @param {Record<string, GraphQLInputObjectType>} inputTypes
 * @param {GraphQLObjectType} deleteResultType
 * @returns {GraphQLObjectType}
 */
function createMutationType(lexicons, recordTypes, inputTypes, deleteResultType) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    const typeName = nsidToTypeName(lexicon.id);

    fields[`create${typeName}`] = {
      type: recordTypes[lexicon.id],
      args: {
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
        rkey: { type: GraphQLString },
      },
    };

    fields[`update${typeName}`] = {
      type: recordTypes[lexicon.id],
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
      },
    };

    fields[`delete${typeName}`] = {
      type: deleteResultType,
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
      },
    };
  }

  return new GraphQLObjectType({
    name: 'Mutation',
    fields,
  });
}

/**
 * Create mutation type with resolvers for CRUD operations
 * @param {Lexicon[]} lexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @param {Record<string, GraphQLInputObjectType>} inputTypes
 * @param {GraphQLObjectType} deleteResultType
 * @param {(op: Operation) => Promise<*>} queryFn
 * @returns {GraphQLObjectType}
 */
function createMutationTypeWithResolvers(
  lexicons,
  recordTypes,
  inputTypes,
  deleteResultType,
  queryFn,
) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    const typeName = nsidToTypeName(lexicon.id);

    fields[`create${typeName}`] = {
      type: recordTypes[lexicon.id],
      args: {
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
        rkey: { type: GraphQLString },
      },
      resolve: async (/** @type {*} */ _, /** @type {*} */ args) => {
        /** @type {Operation} */
        const operation = {
          type: 'create',
          collection: lexicon.id,
          data: args.input,
          rkey: args.rkey || undefined,
        };
        return await queryFn(operation);
      },
    };

    fields[`update${typeName}`] = {
      type: recordTypes[lexicon.id],
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
      },
      resolve: async (/** @type {*} */ _, /** @type {*} */ args) => {
        /** @type {Operation} */
        const operation = {
          type: 'update',
          collection: lexicon.id,
          rkey: args.rkey,
          data: args.input,
        };
        return await queryFn(operation);
      },
    };

    fields[`delete${typeName}`] = {
      type: deleteResultType,
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: async (/** @type {*} */ _, /** @type {*} */ args) => {
        /** @type {Operation} */
        const operation = {
          type: 'delete',
          collection: lexicon.id,
          rkey: args.rkey,
        };
        return await queryFn(operation);
      },
    };
  }

  return new GraphQLObjectType({
    name: 'Mutation',
    fields,
  });
}

/**
 * Create subscription type for real-time events (no resolvers - for buildSchema)
 * @param {Lexicon[]} lexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @returns {GraphQLObjectType}
 */
function createSubscriptionType(lexicons, recordTypes) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    const fieldName = nsidToFieldName(lexicon.id);

    fields[`${fieldName}Created`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a new ${lexicon.id} record is created`,
    };

    fields[`${fieldName}Updated`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is updated`,
    };

    fields[`${fieldName}Deleted`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is deleted`,
    };
  }

  return new GraphQLObjectType({
    name: 'Subscription',
    fields,
  });
}

/**
 * Create subscription type with resolvers for real-time events
 * @param {Lexicon[]} lexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @param {(op: SubscribeOperation) => AsyncIterable<*>} subscribeFn
 * @returns {GraphQLObjectType}
 */
function createSubscriptionTypeWithResolvers(lexicons, recordTypes, subscribeFn) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    const fieldName = nsidToFieldName(lexicon.id);

    fields[`${fieldName}Created`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a new ${lexicon.id} record is created`,
      subscribe: () => subscribeFn({ collection: lexicon.id, event: 'created' }),
      resolve: (/** @type {*} */ payload) => payload,
    };

    fields[`${fieldName}Updated`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is updated`,
      subscribe: () => subscribeFn({ collection: lexicon.id, event: 'updated' }),
      resolve: (/** @type {*} */ payload) => payload,
    };

    fields[`${fieldName}Deleted`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is deleted`,
      subscribe: () => subscribeFn({ collection: lexicon.id, event: 'deleted' }),
      resolve: (/** @type {*} */ payload) => payload,
    };
  }

  return new GraphQLObjectType({
    name: 'Subscription',
    fields,
  });
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Get GraphQL type for a property
 * @param {Property} prop
 * @param {GraphQLObjectType} [blobType] - Blob type if available
 * @param {GraphQLObjectType | null} [strongRefType] - StrongRef type if available
 * @param {Record<string, GraphQLObjectType | GraphQLUnionType>} [typeRegistry] - Unified type registry for ref resolution
 * @param {string} [parentLexiconId] - Parent lexicon ID for resolving local refs
 * @param {Record<string, GraphQLUnionType>} [unionRegistry] - Registry for union types
 * @param {string} [parentTypeName] - Parent type name for creating union type names
 * @returns {import('graphql').GraphQLOutputType}
 */
function getGraphQLType(
  prop,
  blobType,
  strongRefType,
  typeRegistry,
  parentLexiconId,
  unionRegistry,
  parentTypeName,
) {
  // Handle union type with refs array - create a union type
  if (
    prop.type === 'union' &&
    prop.refs &&
    typeRegistry &&
    parentLexiconId &&
    unionRegistry &&
    parentTypeName
  ) {
    // Create a unique union type name based on parent type and field name
    const unionTypeName = `${parentTypeName}${prop.name.charAt(0).toUpperCase()}${prop.name.slice(1)}`;

    // Check if we already created this union type
    if (unionRegistry[unionTypeName]) {
      return unionRegistry[unionTypeName];
    }

    // Resolve all refs to their actual types
    const memberTypes = [];
    for (const ref of prop.refs) {
      const refKey = resolveRefKey(ref, parentLexiconId);
      const resolvedType = typeRegistry[refKey];
      if (resolvedType && resolvedType instanceof GraphQLObjectType) {
        memberTypes.push(resolvedType);
      }
    }

    // Only create union if we have at least one member type
    if (memberTypes.length > 0) {
      const unionType = new GraphQLUnionType({
        name: unionTypeName,
        description: `Union type for ${parentTypeName}.${prop.name}`,
        types: memberTypes,
        resolveType: (value) => {
          // Use $type field to determine the actual type
          if (value?.$type) {
            return refToTypeName(value.$type);
          }
          return undefined;
        },
      });
      unionRegistry[unionTypeName] = unionType;
      return unionType;
    }

    // Fallback to String if no member types found
    return GraphQLString;
  }

  // Handle ref type - resolve to actual type from registry
  if (prop.type === 'ref' && prop.ref && typeRegistry && parentLexiconId) {
    // Special case for strongRef
    if (prop.ref === 'com.atproto.repo.strongRef') {
      return strongRefType || typeRegistry['com.atproto.repo.strongRef'] || GraphQLString;
    }
    const refKey = resolveRefKey(prop.ref, parentLexiconId);
    const resolvedType = typeRegistry[refKey];
    if (resolvedType) {
      return resolvedType;
    }
    // Fallback to String if type not found
    return GraphQLString;
  }

  // Handle array with ref items
  if (prop.type === 'array' && prop.items?.ref && typeRegistry && parentLexiconId) {
    const refKey = resolveRefKey(prop.items.ref, parentLexiconId);
    const itemType = typeRegistry[refKey] || GraphQLString;
    return new GraphQLList(new GraphQLNonNull(itemType));
  }

  /** @type {Record<string, import('graphql').GraphQLOutputType>} */
  const typeMap = {
    string: GraphQLString,
    integer: GraphQLInt,
    boolean: GraphQLBoolean,
    number: GraphQLFloat,
    blob: blobType || GraphQLString,
    bytes: GraphQLString,
    'cid-link': GraphQLString,
    ref: GraphQLString,
    union: GraphQLString,
    array: GraphQLString, // Will handle properly later
  };

  if (prop.type === 'array' && prop.items) {
    const itemType = typeMap[prop.items.type] || GraphQLString;
    return new GraphQLList(new GraphQLNonNull(itemType));
  }

  return typeMap[prop.type] || GraphQLString;
}

/**
 * Get GraphQL input type for a property
 * @param {Property} prop
 * @returns {import('graphql').GraphQLInputType}
 */
function getGraphQLInputType(prop) {
  /** @type {Record<string, import('graphql').GraphQLInputType>} */
  const typeMap = {
    string: GraphQLString,
    integer: GraphQLInt,
    boolean: GraphQLBoolean,
    number: GraphQLFloat,
  };
  return typeMap[prop.type] || GraphQLString;
}

/**
 * Check if a property should generate a forward join field
 * @param {Property} prop
 * @returns {boolean}
 */
function isForwardJoinField(prop) {
  // strongRef reference
  if (prop.type === 'ref' && prop.ref === 'com.atproto.repo.strongRef') {
    return true;
  }
  // at-uri format string
  if (prop.type === 'string' && prop.format === 'at-uri') {
    return true;
  }
  return false;
}

/**
 * Add forward join fields for strongRef references
 * @param {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} fields
 * @param {Property[]} properties
 * @param {GraphQLUnionType | null} recordUnionType
 */
function addForwardJoinFields(fields, properties, recordUnionType) {
  if (!recordUnionType) return;

  for (const prop of properties) {
    if (isForwardJoinField(prop)) {
      fields[`${prop.name}Resolved`] = {
        type: recordUnionType,
        description: 'Forward join to referenced record',
      };
    }
  }
}

/**
 * Discover reverse joins by scanning lexicons for refs pointing to each type
 * @param {Lexicon[]} lexicons
 * @returns {Map<string, Array<{fromLexicon: string, fieldName: string}>>}
 */
function discoverReverseJoins(lexicons) {
  /** @type {Map<string, Array<{fromLexicon: string, fieldName: string}>>} */
  const reverseJoins = new Map();

  // Initialize map for each record type
  for (const lexicon of lexicons) {
    if (lexicon.defs.main?.type === 'record') {
      reverseJoins.set(lexicon.id, []);
    }
  }

  // Scan all lexicons for forward join fields
  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    for (const prop of lexicon.defs.main.properties) {
      if (isForwardJoinField(prop)) {
        // This field points to other records - add reverse join to all record types
        // (since at-uri can point to any type)
        for (const targetId of reverseJoins.keys()) {
          if (targetId !== lexicon.id) {
            const targetJoins = reverseJoins.get(targetId);
            if (targetJoins) {
              targetJoins.push({
                fromLexicon: lexicon.id,
                fieldName: prop.name,
              });
            }
          }
        }
      }
    }
  }

  return reverseJoins;
}

// ============================================================================
// RECORD TYPE CREATORS
// ============================================================================

/**
 * Create a GraphQL object type for a record definition
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @param {string} lexiconId
 * @param {Lexicon[]} allLexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @param {Record<string, GraphQLObjectType>} connectionTypes
 * @param {Map<string, Array<{fromLexicon: string, fieldName: string}>>} reverseJoinMap
 * @param {GraphQLObjectType} blobType
 * @param {GraphQLObjectType | null} strongRefType
 * @param {Record<string, GraphQLInputObjectType>} sortInputTypes
 * @param {Record<string, GraphQLInputObjectType>} whereInputTypes
 * @param {Record<string, GraphQLObjectType>} [typeRegistry] - Unified type registry for ref resolution
 * @param {Record<string, GraphQLUnionType>} [unionRegistry] - Registry for union types
 * @returns {GraphQLObjectType}
 */
function createRecordType(
  typeName,
  recordDef,
  lexiconId,
  allLexicons,
  recordTypes,
  connectionTypes,
  reverseJoinMap,
  blobType,
  strongRefType,
  sortInputTypes,
  whereInputTypes,
  typeRegistry,
  unionRegistry,
) {
  return new GraphQLObjectType({
    name: typeName,
    description: `Record type: ${typeName}`,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLFieldConfig<any, any>>} */
      const fields = {
        // System fields
        uri: { type: GraphQLString, description: 'Record URI' },
        cid: { type: GraphQLString, description: 'Record CID' },
        did: { type: GraphQLString, description: 'DID of record author' },
        collection: { type: GraphQLString, description: 'Collection name' },
        indexedAt: {
          type: GraphQLString,
          description: 'When record was indexed',
        },
        actorHandle: {
          type: GraphQLString,
          description: 'Handle of the actor who created this record',
        },
      };

      // Add lexicon properties
      for (const prop of recordDef.properties) {
        fields[prop.name] = {
          type: getGraphQLType(
            prop,
            blobType,
            strongRefType,
            typeRegistry,
            lexiconId,
            unionRegistry,
            typeName,
          ),
          description: `Field from lexicon`,
        };

        // Add forward join field if applicable
        if (isForwardJoinField(prop)) {
          fields[`${prop.name}Resolved`] = {
            type: GraphQLString, // Will be Record union later
            description: `Resolved reference for ${prop.name}`,
          };
        }
      }

      // Add DID join fields to other collections
      for (const otherLexicon of allLexicons) {
        if (otherLexicon.id === lexiconId) continue; // Skip self
        if (!otherLexicon.defs.main || otherLexicon.defs.main.type !== 'record') continue;

        const otherTypeName = nsidToTypeName(otherLexicon.id);
        const fieldName = `${nsidToFieldName(otherLexicon.id)}ByDid`;
        const isUnique = otherLexicon.defs.main.key === 'literal:self';

        if (isUnique) {
          // Return single object for literal:self collections
          fields[fieldName] = {
            type: recordTypes[otherLexicon.id],
            description: `${otherTypeName} for this DID`,
          };
        } else {
          // Return list for multi-record collections
          fields[fieldName] = {
            type: new GraphQLList(recordTypes[otherLexicon.id]),
            description: `${otherTypeName} records for this DID`,
          };
        }
      }

      // Add reverse join fields
      const reverseJoins = reverseJoinMap.get(lexiconId) || [];
      for (const { fromLexicon, fieldName } of reverseJoins) {
        const fromTypeName = nsidToTypeName(fromLexicon);
        const reverseFieldName =
          nsidToFieldName(fromLexicon) +
          'Via' +
          fieldName.charAt(0).toUpperCase() +
          fieldName.slice(1);

        /** @type {Record<string, import('graphql').GraphQLArgumentConfig>} */
        const reverseFieldArgs = {
          first: { type: GraphQLInt },
          after: { type: GraphQLString },
          last: { type: GraphQLInt },
          before: { type: GraphQLString },
          where: { type: whereInputTypes[fromTypeName] },
        };
        if (sortInputTypes[fromTypeName]) {
          reverseFieldArgs.sortBy = {
            type: new GraphQLList(sortInputTypes[fromTypeName]),
          };
        }
        fields[reverseFieldName] = {
          type: connectionTypes[fromLexicon],
          args: reverseFieldArgs,
          description: `${fromTypeName} records pointing to this via ${fieldName}`,
        };
      }

      return fields;
    },
  });
}

/**
 * Create a GraphQL object type for a record definition with resolvers
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @param {string} lexiconId
 * @param {Lexicon[]} allLexicons
 * @param {Record<string, GraphQLObjectType>} recordTypes
 * @param {() => GraphQLUnionType | null} getRecordUnionType
 * @param {JoinCollector} joinCollector
 * @param {DidCollector} didCollector
 * @param {GraphQLObjectType} blobType
 * @param {GraphQLObjectType | null} strongRefType
 * @param {Record<string, GraphQLObjectType>} typeRegistry
 * @param {Record<string, GraphQLUnionType>} unionRegistry
 * @returns {GraphQLObjectType}
 */
function createRecordTypeWithResolvers(
  typeName,
  recordDef,
  lexiconId,
  allLexicons,
  recordTypes,
  getRecordUnionType,
  joinCollector,
  didCollector,
  blobType,
  strongRefType,
  typeRegistry,
  unionRegistry,
) {
  return new GraphQLObjectType({
    name: typeName,
    description: `Record type: ${typeName}`,
    fields: () => {
      /** @type {Record<string, import('graphql').GraphQLFieldConfig<any, any>>} */
      const fields = {
        // System fields
        uri: { type: GraphQLString, description: 'Record URI' },
        cid: { type: GraphQLString, description: 'Record CID' },
        did: { type: GraphQLString, description: 'DID of record author' },
        collection: { type: GraphQLString, description: 'Collection name' },
        indexedAt: {
          type: GraphQLString,
          description: 'When record was indexed',
        },
        actorHandle: {
          type: GraphQLString,
          description: 'Handle of the actor who created this record',
        },
      };

      // Add lexicon properties
      for (const prop of recordDef.properties) {
        fields[prop.name] = {
          type: getGraphQLType(
            prop,
            blobType,
            strongRefType,
            typeRegistry,
            lexiconId,
            unionRegistry,
            typeName,
          ),
          description: `Field from lexicon`,
        };

        // Add forward join field with resolver
        if (isForwardJoinField(prop)) {
          const recordUnionType = getRecordUnionType();
          if (recordUnionType) {
            fields[`${prop.name}Resolved`] = {
              type: recordUnionType,
              description: `Resolved reference for ${prop.name}`,
              resolve: async (parent) => {
                const uri = parent[prop.name];
                if (!uri) return null;
                return joinCollector.load(uri);
              },
            };
          }
        }
      }

      // Add DID join fields to other collections
      for (const otherLexicon of allLexicons) {
        if (otherLexicon.id === lexiconId) continue; // Skip self
        if (!otherLexicon.defs.main || otherLexicon.defs.main.type !== 'record') continue;

        const otherTypeName = nsidToTypeName(otherLexicon.id);
        const fieldName = `${nsidToFieldName(otherLexicon.id)}ByDid`;
        const isUnique = otherLexicon.defs.main.key === 'literal:self';

        const otherCollection = otherLexicon.id; // Use full NSID as collection name

        if (isUnique) {
          // Return single object for literal:self collections
          fields[fieldName] = {
            type: recordTypes[otherLexicon.id],
            description: `${otherTypeName} for this DID`,
            resolve: async (parent) => {
              const did = parent.did;
              if (!did) return null;
              return didCollector.load(otherCollection, did, true);
            },
          };
        } else {
          // Return list for multi-record collections
          fields[fieldName] = {
            type: new GraphQLList(recordTypes[otherLexicon.id]),
            description: `${otherTypeName} records for this DID`,
            resolve: async (parent) => {
              const did = parent.did;
              if (!did) return [];
              return didCollector.load(otherCollection, did, false);
            },
          };
        }
      }

      return fields;
    },
  });
}

// ============================================================================
// SCHEMA BUILDING
// ============================================================================

/**
 * Build a GraphQL schema from parsed lexicons
 * @param {Lexicon[]} lexicons
 * @returns {GraphQLSchema}
 */
export function buildSchema(lexicons) {
  /** @type {Record<string, GraphQLObjectType>} */
  const recordTypes = {};
  /** @type {Record<string, GraphQLObjectType>} */
  const edgeTypes = {};
  /** @type {Record<string, GraphQLObjectType>} */
  const connectionTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const whereInputTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const sortInputTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const inputTypes = {};

  // Create shared types
  const pageInfoType = createPageInfoType();
  const fieldConditionTypes = createFieldConditionTypes();
  const sortDirectionEnum = createSortDirectionEnum();
  const aggregateOrderByEnum = createAggregateOrderByEnum();
  const deleteResultType = createDeleteResultType();
  const blobType = createBlobType();

  // Holder for recordUnionType - will be set after all record types are created
  // Using a holder object allows field thunks to access it later
  /** @type {{ value: GraphQLUnionType | null }} */
  const recordUnionTypeHolder = { value: null };
  const getRecordUnionType = () => recordUnionTypeHolder.value;

  // Only create strongRefType if the lexicon doesn't already define it
  const hasStrongRefLexicon = lexicons.some((l) => l.id === 'com.atproto.repo.strongRef');
  const strongRefType = hasStrongRefLexicon ? null : createStrongRefType(getRecordUnionType);

  // Discover reverse joins before building types
  const reverseJoinMap = discoverReverseJoins(lexicons);

  // ============================================================================
  // Phase 1: Build unified type registry (all object types)
  // This must happen BEFORE creating record types so refs can be resolved
  // ============================================================================
  /** @type {Record<string, GraphQLObjectType>} */
  const typeRegistry = {};

  // Add strongRef type to registry if we created one
  if (strongRefType) {
    typeRegistry['com.atproto.repo.strongRef'] = strongRefType;
  }

  // First, create nested types from others defs (they need to exist for ref resolution)
  /** @type {Record<string, GraphQLObjectType>} */
  const nestedTypes = {};
  for (const lexicon of lexicons) {
    if (lexicon.defs.others) {
      for (const [defName, def] of Object.entries(lexicon.defs.others)) {
        if (def.type === 'object' && def.properties) {
          const refKey = `${lexicon.id}#${defName}`;
          const nestedType = createNestedObjectType(
            lexicon.id,
            defName,
            def,
            blobType,
            typeRegistry,
            getRecordUnionType,
          );
          nestedTypes[refKey] = nestedType;
          typeRegistry[refKey] = nestedType;
        }
      }
    }
  }

  // Add main object types (type: 'object', not 'record') to registry
  for (const lexicon of lexicons) {
    const mainDef = lexicon.defs.main;
    if (mainDef?.type === 'object' && mainDef.properties) {
      // Create a simple object type for main defs that are objects (not records)
      const typeName = nsidToTypeName(lexicon.id);
      const mainProperties = mainDef.properties;
      const mainObjectType = new GraphQLObjectType({
        name: typeName,
        description: `Object type from ${lexicon.id}`,
        fields: () => {
          /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
          const fields = {};
          for (const prop of mainProperties) {
            fields[prop.name] = {
              type: prop.required
                ? new GraphQLNonNull(
                    getGraphQLType(prop, blobType, strongRefType, typeRegistry, lexicon.id),
                  )
                : getGraphQLType(prop, blobType, strongRefType, typeRegistry, lexicon.id),
              description: 'Field from object definition',
            };
          }
          // Add forward join fields for strongRef references
          addForwardJoinFields(fields, mainProperties, getRecordUnionType());
          return fields;
        },
      });
      typeRegistry[lexicon.id] = mainObjectType;
      // Also add to recordTypes so it's included in the schema
      recordTypes[lexicon.id] = mainObjectType;
    }
  }

  // ============================================================================
  // Phase 2: Create record types (they can now use typeRegistry for ref resolution)
  // ============================================================================
  /** @type {Record<string, GraphQLUnionType>} */
  const unionRegistry = {};

  for (const lexicon of lexicons) {
    if (lexicon.defs.main?.type === 'record') {
      const typeName = nsidToTypeName(lexicon.id);
      recordTypes[lexicon.id] = createRecordType(
        typeName,
        lexicon.defs.main,
        lexicon.id,
        lexicons,
        recordTypes,
        connectionTypes,
        reverseJoinMap,
        blobType,
        strongRefType,
        sortInputTypes,
        whereInputTypes,
        typeRegistry,
        unionRegistry,
      );
      // Also add record types to the registry for cross-type ref resolution
      typeRegistry[lexicon.id] = recordTypes[lexicon.id];
      // Create where input type
      whereInputTypes[typeName] = createWhereInputType(
        typeName,
        lexicon.defs.main,
        fieldConditionTypes,
        whereInputTypes,
      );
      // Create sort types
      const sortFieldEnum = createSortFieldEnum(typeName, lexicon.defs.main);
      sortInputTypes[typeName] = createSortInputType(typeName, sortFieldEnum, sortDirectionEnum);
      // Create input type for mutations
      inputTypes[lexicon.id] = createInputType(typeName, lexicon.defs.main);
    }
  }

  // Second pass: create edge and connection types
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const typeName = nsidToTypeName(lexicon.id);
      edgeTypes[lexicon.id] = createEdgeType(typeName, recordTypes[lexicon.id]);
      connectionTypes[lexicon.id] = createConnectionType(
        typeName,
        edgeTypes[lexicon.id],
        pageInfoType,
      );
    }
  }

  // Create aggregate types, groupBy enums, and per-type field conditions for each record type
  /** @type {Record<string, GraphQLObjectType>} */
  const aggregateTypes = {};
  /** @type {Record<string, GraphQLEnumType>} */
  const groupByEnums = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const fieldConditionInputTypes = {};
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const typeName = nsidToTypeName(lexicon.id);
      aggregateTypes[lexicon.id] = createAggregateResultType(
        typeName,
        lexicon.defs.main,
        lexicon.id,
        typeRegistry,
      );
      groupByEnums[lexicon.id] = createAggregateGroupByEnum(typeName, lexicon.defs.main);
      fieldConditionInputTypes[typeName] = createPerTypeFieldCondition(
        typeName,
        lexicon.defs.main,
        fieldConditionInputTypes,
      );
    }
  }

  // Create Query type
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<any, any>>} */
  const queryFields = {};
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const typeName = nsidToTypeName(lexicon.id);
      const fieldName = nsidToFieldName(lexicon.id);
      queryFields[fieldName] = {
        type: connectionTypes[lexicon.id],
        description: `Query ${lexicon.id}`,
        args: {
          first: { type: GraphQLInt, description: 'Number of items to return' },
          after: { type: GraphQLString, description: 'Cursor to start after' },
          last: {
            type: GraphQLInt,
            description: 'Number of items from the end',
          },
          before: { type: GraphQLString, description: 'Cursor to end before' },
          where: {
            type: whereInputTypes[typeName],
            description: 'Filter conditions',
          },
          sortBy: {
            type: new GraphQLList(sortInputTypes[typeName]),
            description: 'Sort order',
          },
        },
      };

      // Add aggregate query field
      const aggregateFieldName = `${fieldName}Aggregate`;
      queryFields[aggregateFieldName] = {
        type: aggregateTypes[lexicon.id],
        description: `Aggregate ${lexicon.id}`,
        args: {
          where: { type: whereInputTypes[typeName] },
          groupBy: { type: new GraphQLList(groupByEnums[lexicon.id]) },
          limit: {
            type: GraphQLInt,
            description: 'Maximum number of groups (default: 50, max: 1000)',
          },
          orderBy: {
            type: aggregateOrderByEnum,
            description: 'Order by count (default: COUNT_DESC)',
          },
        },
      };
    }
  }

  const queryType = new GraphQLObjectType({
    name: 'Query',
    description: 'Root query type',
    fields: queryFields,
  });

  // Create Mutation type
  const mutationType = createMutationType(lexicons, recordTypes, inputTypes, deleteResultType);

  // Create Record union type (after all record types exist)
  const recordUnionType = createRecordUnionType(recordTypes);
  // Set the holder so nested type field thunks can access it
  recordUnionTypeHolder.value = recordUnionType;

  // Include Record union, nested types, aggregate types, groupBy enums, field conditions, union types, and aggregate orderBy enum so they appear in the schema
  const types = [
    ...(recordUnionType ? [recordUnionType] : []),
    ...Object.values(nestedTypes),
    ...Object.values(aggregateTypes),
    ...Object.values(groupByEnums),
    ...Object.values(fieldConditionInputTypes),
    ...Object.values(unionRegistry),
    aggregateOrderByEnum,
  ];

  // Create Subscription type
  const subscriptionType = createSubscriptionType(lexicons, recordTypes);

  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types,
  });
}

/**
 * Build a GraphQL schema with resolvers that call the query function
 * @param {Lexicon[]} lexicons
 * @param {(op: Operation) => Promise<any>} queryFn
 * @param {(op: SubscribeOperation) => AsyncIterable<*>} [subscribeFn]
 * @returns {GraphQLSchema}
 */
function buildSchemaWithResolvers(lexicons, queryFn, subscribeFn) {
  /** @type {Record<string, GraphQLObjectType>} */
  const recordTypes = {};
  /** @type {Record<string, GraphQLObjectType>} */
  const edgeTypes = {};
  /** @type {Record<string, GraphQLObjectType>} */
  const connectionTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const whereInputTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const sortInputTypes = {};
  /** @type {Record<string, GraphQLInputObjectType>} */
  const inputTypes = {};
  /** @type {Record<string, GraphQLObjectType>} */
  const typeRegistry = {};
  /** @type {Record<string, GraphQLUnionType>} */
  const unionRegistry = {};

  // Create shared types
  const pageInfoType = createPageInfoType();
  const fieldConditionTypes = createFieldConditionTypes();
  const sortDirectionEnum = createSortDirectionEnum();
  const aggregateOrderByEnum = createAggregateOrderByEnum();
  const deleteResultType = createDeleteResultType();
  const blobType = createBlobType();

  // Holder for recordUnionType - used by strongRef uriResolved field
  /** @type {{ value: GraphQLUnionType | null }} */
  const recordUnionTypeHolder = { value: null };
  const getRecordUnionType = () => recordUnionTypeHolder.value;

  // Create strongRef type if not defined in lexicons
  const hasStrongRefLexicon = lexicons.some((l) => l.id === 'com.atproto.repo.strongRef');
  const strongRefType = hasStrongRefLexicon ? null : createStrongRefType(getRecordUnionType);
  if (strongRefType) {
    typeRegistry['com.atproto.repo.strongRef'] = strongRefType;
  }

  // Create collectors for batching
  const joinCollector = new JoinCollector(queryFn);
  const didCollector = new DidCollector(queryFn);

  // Pre-pass: Create nested types from local defs (like #replyRef, #entity, etc.)
  for (const lexicon of lexicons) {
    const otherDefs = lexicon.defs?.others || {};
    for (const [defName, defValue] of Object.entries(otherDefs)) {
      if ((defValue.type === 'object' || !defValue.type) && defValue.properties) {
        const localKey = `${lexicon.id}#${defName}`;
        typeRegistry[localKey] = createNestedObjectType(
          lexicon.id,
          defName,
          defValue,
          blobType,
          typeRegistry,
          getRecordUnionType,
        );
      }
    }
  }

  // First pass: create all record types
  for (const lexicon of lexicons) {
    if (
      lexicon.defs.main &&
      (lexicon.defs.main.type === 'record' || lexicon.defs.main.type === 'object')
    ) {
      const typeName = nsidToTypeName(lexicon.id);
      recordTypes[lexicon.id] = createRecordTypeWithResolvers(
        typeName,
        lexicon.defs.main,
        lexicon.id,
        lexicons,
        recordTypes,
        getRecordUnionType,
        joinCollector,
        didCollector,
        blobType,
        strongRefType,
        typeRegistry,
        unionRegistry,
      );
      // Register in type registry
      typeRegistry[lexicon.id] = recordTypes[lexicon.id];
      // Create where input type (keyed by typeName for self-reference lookup)
      whereInputTypes[typeName] = createWhereInputType(
        typeName,
        lexicon.defs.main,
        fieldConditionTypes,
        whereInputTypes,
      );
      // Create sort types
      const sortFieldEnum = createSortFieldEnum(typeName, lexicon.defs.main);
      sortInputTypes[typeName] = createSortInputType(typeName, sortFieldEnum, sortDirectionEnum);
      // Create input type for mutations
      inputTypes[lexicon.id] = createInputType(typeName, lexicon.defs.main);
    }
  }

  // Create Record union type from all record types
  const recordTypeValues = Object.values(recordTypes).filter((t) => t instanceof GraphQLObjectType);
  if (recordTypeValues.length > 0) {
    const recordUnionType = new GraphQLUnionType({
      name: 'Record',
      description: 'Union of all record types',
      types: recordTypeValues,
      resolveType: (value) => {
        if (value?.collection) {
          return nsidToTypeName(value.collection);
        }
        return undefined;
      },
    });
    recordUnionTypeHolder.value = recordUnionType;
  }

  // Second pass: create edge and connection types
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const typeName = nsidToTypeName(lexicon.id);
      edgeTypes[lexicon.id] = createEdgeType(typeName, recordTypes[lexicon.id]);
      connectionTypes[lexicon.id] = createConnectionType(
        typeName,
        edgeTypes[lexicon.id],
        pageInfoType,
      );
    }
  }

  // Create Query type with resolvers
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<any, any>>} */
  const queryFields = {};
  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue;

    const typeName = nsidToTypeName(lexicon.id);
    const fieldName = nsidToFieldName(lexicon.id);

    queryFields[fieldName] = {
      type: connectionTypes[lexicon.id],
      args: {
        first: { type: GraphQLInt },
        after: { type: GraphQLString },
        last: { type: GraphQLInt },
        before: { type: GraphQLString },
        where: { type: whereInputTypes[typeName] },
        sortBy: { type: new GraphQLList(sortInputTypes[typeName]) },
      },
      resolve: async (_, args, _context, info) => {
        /** @type {Operation} */
        const operation = {
          type: 'findMany',
          collection: lexicon.id,
          where: compileWhere(args.where),
          sort: compileSortBy(args.sortBy),
          pagination: {
            first: args.first,
            after: args.after,
            last: args.last,
            before: args.before,
          },
          select: extractSelectFields(info),
        };

        const result = await queryFn(operation);
        return formatConnection(result, operation.sort);
      },
    };

    // Add aggregate query field
    const aggregateFieldName = `${fieldName}Aggregate`;
    const aggregateResultType = createAggregateResultType(
      typeName,
      lexicon.defs.main,
      lexicon.id,
      typeRegistry,
    );
    const groupByEnum = createAggregateGroupByEnum(typeName, lexicon.defs.main);

    // Extract array field names from the lexicon for aggregate queries
    const arrayFields = lexicon.defs.main.properties
      .filter((/** @type {Property} */ p) => p.type === 'array')
      .map((/** @type {Property} */ p) => p.name);

    queryFields[aggregateFieldName] = {
      type: aggregateResultType,
      args: {
        where: { type: whereInputTypes[typeName] },
        groupBy: { type: new GraphQLList(groupByEnum) },
        limit: {
          type: GraphQLInt,
          description: 'Maximum number of groups (default: 50, max: 1000)',
        },
        orderBy: {
          type: aggregateOrderByEnum,
          description: 'Order by count (default: COUNT_DESC)',
        },
      },
      resolve: async (_, args) => {
        /** @type {Operation} */
        const operation = {
          type: 'aggregate',
          collection: lexicon.id,
          where: compileWhere(args.where),
          groupBy: args.groupBy || [],
          limit: args.limit,
          orderBy: args.orderBy,
          arrayFields,
        };
        return await queryFn(operation);
      },
    };
  }

  const queryType = new GraphQLObjectType({
    name: 'Query',
    fields: queryFields,
  });

  // Create Mutation type with resolvers
  const mutationType = createMutationTypeWithResolvers(
    lexicons,
    recordTypes,
    inputTypes,
    deleteResultType,
    queryFn,
  );

  // Create Subscription type with resolvers (only if subscribe function provided)
  const subscriptionType = subscribeFn
    ? createSubscriptionTypeWithResolvers(lexicons, recordTypes, subscribeFn)
    : createSubscriptionType(lexicons, recordTypes);

  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
  });
}

// ============================================================================
// ADAPTER / RUNTIME
// ============================================================================

/**
 * JoinCollector for batching forward join resolution
 */
export class JoinCollector {
  /**
   * @param {(op: Operation) => Promise<any>} queryFn
   */
  constructor(queryFn) {
    this.queryFn = queryFn;
    this.pending = new Map(); // uri -> resolver callbacks
    this.resolved = new Map(); // uri -> resolved record
    this.scheduled = false;
  }

  /**
   * Add a URI to be resolved
   * @param {string} uri
   * @returns {Promise<any>}
   */
  load(uri) {
    // If already resolved, return immediately
    if (this.resolved.has(uri)) {
      return Promise.resolve(this.resolved.get(uri));
    }

    // Create a promise for this URI
    return new Promise((resolve) => {
      if (!this.pending.has(uri)) {
        this.pending.set(uri, []);
      }
      this.pending.get(uri).push(resolve);

      // Schedule batch resolution
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.flush());
      }
    });
  }

  /**
   * Flush pending URIs and resolve them in batch
   */
  async flush() {
    if (this.pending.size === 0) {
      this.scheduled = false;
      return;
    }

    const uris = Array.from(this.pending.keys());
    const callbacks = new Map(this.pending);
    this.pending.clear();
    this.scheduled = false;

    try {
      // Batch fetch all pending URIs
      const result = await this.queryFn({
        type: 'findMany',
        collection: '*', // Special: resolve by URI
        where: [{ field: 'uri', op: 'in', value: uris }],
        pagination: {},
      });

      // Map results back
      for (const row of result.rows) {
        this.resolved.set(row.uri, row);
      }

      // Resolve all callbacks
      for (const uri of uris) {
        const resolvers = callbacks.get(uri) || [];
        const value = this.resolved.get(uri) || null;
        for (const resolve of resolvers) {
          resolve(value);
        }
      }
    } catch (_err) {
      // On error, resolve all with null
      for (const uri of uris) {
        const resolvers = callbacks.get(uri) || [];
        for (const resolve of resolvers) {
          resolve(null);
        }
      }
    }
  }
}

/**
 * DidCollector for batching DID-based join resolution
 * Groups lookups by collection and batches DIDs within each collection
 */
export class DidCollector {
  /**
   * @param {(op: Operation) => Promise<any>} queryFn
   */
  constructor(queryFn) {
    this.queryFn = queryFn;
    this.pending = new Map(); // collection -> Map<did, callbacks[]>
    this.resolved = new Map(); // `${collection}:${did}` -> record or record[]
    this.scheduled = false;
  }

  /**
   * Load a record by DID from a collection
   * @param {string} collection
   * @param {string} did
   * @param {boolean} unique - If true, return single record; if false, return array
   * @returns {Promise<any>}
   */
  load(collection, did, unique = true) {
    const key = `${collection}:${did}:${unique}`;

    // If already resolved, return immediately
    if (this.resolved.has(key)) {
      return Promise.resolve(this.resolved.get(key));
    }

    // Create a promise for this lookup
    return new Promise((resolve) => {
      if (!this.pending.has(collection)) {
        this.pending.set(collection, new Map());
      }
      const collectionMap = this.pending.get(collection);
      const didKey = `${did}:${unique}`;
      if (!collectionMap.has(didKey)) {
        collectionMap.set(didKey, { did, unique, callbacks: [] });
      }
      collectionMap.get(didKey).callbacks.push(resolve);

      // Schedule batch resolution
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.flush());
      }
    });
  }

  /**
   * Flush pending DIDs and resolve them in batch
   */
  async flush() {
    if (this.pending.size === 0) {
      this.scheduled = false;
      return;
    }

    const pendingSnapshot = new Map(this.pending);
    this.pending.clear();
    this.scheduled = false;

    // Process each collection
    for (const [collection, didMap] of pendingSnapshot) {
      const entries = Array.from(didMap.values());
      const dids = [...new Set(entries.map((e) => e.did))]; // Unique DIDs

      try {
        // Batch fetch all pending DIDs for this collection
        const result = await this.queryFn({
          type: 'findMany',
          collection,
          where: [{ field: 'did', op: 'in', value: dids }],
          pagination: { first: dids.length * 100 }, // Allow multiple records per DID
        });

        // Group results by DID
        /** @type {Map<string, any[]>} */
        const resultsByDid = new Map();
        for (const row of result.rows || []) {
          let arr = resultsByDid.get(row.did);
          if (!arr) {
            arr = [];
            resultsByDid.set(row.did, arr);
          }
          arr.push(row);
        }

        // Resolve all callbacks
        for (const entry of entries) {
          const { did, unique, callbacks } = entry;
          const key = `${collection}:${did}:${unique}`;
          const records = resultsByDid.get(did) || [];
          const value = unique ? records[0] || null : records;

          this.resolved.set(key, value);
          for (const resolve of callbacks) {
            resolve(value);
          }
        }
      } catch (_err) {
        // On error, resolve all with null/empty
        for (const entry of entries) {
          const { unique, callbacks } = entry;
          for (const resolve of callbacks) {
            resolve(unique ? null : []);
          }
        }
      }
    }
  }
}

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
export function createAdapter(lexicons, options) {
  const { query, subscribe } = options;

  const schema = buildSchemaWithResolvers(lexicons, query, subscribe);

  return {
    schema,
    /**
     * @param {string} queryString
     * @param {Record<string, unknown>} [variables]
     */
    async execute(queryString, variables = {}) {
      const { graphql } = await import('graphql');
      const result = await graphql({
        schema,
        source: queryString,
        variableValues: variables,
      });
      return result;
    },
    /**
     * @param {string} subscriptionQuery
     * @param {Record<string, unknown>} [variables]
     * @returns {Promise<AsyncIterable<import('graphql').ExecutionResult>>}
     */
    async subscribe(subscriptionQuery, variables = {}) {
      const { subscribe, parse } = await import('graphql');
      const result = await subscribe({
        schema,
        document: parse(subscriptionQuery),
        variableValues: variables,
      });
      if (Symbol.asyncIterator in result) {
        return result;
      }
      throw new LexGqlError('Subscription failed', ErrorCodes.QUERY_FAILED, result);
    },
  };
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Compile where clause to operation format
 * @param {Object} where
 * @returns {WhereClause[]}
 */
function compileWhere(where) {
  if (!where) return [];

  const conditions = [];
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'AND' && Array.isArray(condition)) {
      const andConditions = condition.map((c) => compileWhere(c));
      if (andConditions.length > 0) {
        conditions.push({ op: 'and', conditions: andConditions });
      }
      continue;
    }
    if (field === 'OR' && Array.isArray(condition)) {
      const orConditions = condition.map((c) => compileWhere(c));
      if (orConditions.length > 0) {
        conditions.push({ op: 'or', conditions: orConditions });
      }
      continue;
    }
    if (!condition) continue;

    for (const [op, value] of Object.entries(condition)) {
      if (value !== undefined && value !== null) {
        conditions.push({ field, op, value });
      }
    }
  }
  return conditions;
}

/**
 * Compile sortBy to operation format
 * @param {Array<{ field: string, direction?: string }>} sortBy
 * @returns {Array<{ field: string, dir: string }>}
 */
function compileSortBy(sortBy) {
  if (!sortBy) return [];
  return sortBy.map((s) => ({ field: s.field, dir: s.direction || 'asc' }));
}

/**
 * Extract selected field names from GraphQL info for connection queries
 * Traverses edges.node to find the actual record field selections
 * @param {import('graphql').GraphQLResolveInfo} info
 * @returns {string[]}
 */
function extractSelectFields(info) {
  const fieldNode = info.fieldNodes[0];
  if (!fieldNode.selectionSet) return [];

  // Find edges selection
  const edgesSelection = fieldNode.selectionSet.selections.find(
    (s) => s.kind === 'Field' && s.name.value === 'edges',
  );
  if (!edgesSelection || edgesSelection.kind !== 'Field') return [];
  if (!edgesSelection.selectionSet) return [];

  // Find node selection within edges
  const nodeSelection = edgesSelection.selectionSet.selections.find(
    (s) => s.kind === 'Field' && s.name.value === 'node',
  );
  if (!nodeSelection || nodeSelection.kind !== 'Field') return [];
  if (!nodeSelection.selectionSet) return [];

  // Extract field names from node selection
  return nodeSelection.selectionSet.selections
    .filter((s) => s.kind === 'Field')
    .map((s) => s.name.value);
}

/** @type {Array<{field: string, dir: string}>} */
export const DEFAULT_SORT = [{ field: 'indexedAt', dir: 'desc' }];

/**
 * Format query result as GraphQL connection
 * @param {{ rows: any[], hasNext: boolean, hasPrev: boolean, totalCount: number }} result
 * @param {Array<{field: string, dir?: string}>} [sortBy] - Sort configuration for cursor encoding
 * @returns {Object}
 */
function formatConnection(result, sortBy) {
  const { rows, hasNext, hasPrev, totalCount } = result;
  const effectiveSort = sortBy && sortBy.length > 0 ? sortBy : DEFAULT_SORT;

  /**
   * Create cursor encoding sort field values + uri as tiebreaker
   * @param {any} row
   */
  const makeCursor = (row) => {
    if (!row) return null;
    const values = effectiveSort.map((s) => row[s.field] ?? null);
    return Buffer.from(JSON.stringify({ v: values, u: row.uri })).toString('base64');
  };

  return {
    edges: rows.map((row) => ({
      node: row,
      cursor: makeCursor(row),
    })),
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: hasPrev,
      startCursor: makeCursor(rows[0]),
      endCursor: makeCursor(rows[rows.length - 1]),
    },
    totalCount,
  };
}
