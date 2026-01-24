# lex-gql

GraphQL for AT Protocol Lexicons. Generates a fully-typed GraphQL schema from AT Protocol lexicon definitions with automatic join resolution.

## Installation

```bash
npm install lex-gql graphql
```

## Quick Start

```javascript
import { parseLexicon, createAdapter } from 'lex-gql'

// Parse your lexicons
const lexicons = [
  parseLexicon(profileLexiconJson),
  parseLexicon(postLexiconJson),
  parseLexicon(likeLexiconJson)
]

// Create adapter with your data source
const adapter = createAdapter(lexicons, {
  query: async (operation) => {
    // Implement your data fetching logic
    // operation.type: 'findMany' | 'findOne' | 'count' | 'aggregate' | 'create' | 'update' | 'delete'
    // operation.collection: lexicon NSID
    // operation.where: filter conditions
    // operation.sort: sort clauses
    // operation.pagination: { first, after, last, before }
    // operation.select: requested field names (for query optimization)
    return { rows: [...], hasNext: false, hasPrev: false, totalCount: 100 }
  }
})

// Execute GraphQL queries
const result = await adapter.execute(`
  query {
    appBskyFeedPost(first: 10, where: { text: { contains: "hello" } }) {
      edges {
        node {
          uri
          text
          appBskyActorProfileByDid {
            displayName
          }
        }
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`)
```

## Features

- **Automatic schema generation** from AT Protocol lexicons
- **Relay-style pagination** with connections, edges, and pageInfo
- **Forward joins** via `*Resolved` fields for strongRef and at-uri references
- **Reverse joins** via `*Via*` fields (e.g., `appBskyFeedLikeViaSubject`) with automatic N+1 batching
- **DID joins** between collections via `*ByDid` fields
- **Filtering** with field conditions (eq, in, contains, gt, gte, lt, lte)
- **Sorting** with multi-field sort support
- **Aggregations** with groupBy support
- **Mutations** for create, update, delete operations
- **Batched join resolution** to avoid N+1 queries

## API

### `parseLexicon(json)`

Parse a raw lexicon JSON object into the internal format.

```javascript
const lexicon = parseLexicon({
  lexicon: 1,
  id: 'app.bsky.feed.post',
  defs: {
    main: {
      type: 'record',
      record: {
        type: 'object',
        required: ['text', 'createdAt'],
        properties: {
          text: { type: 'string' },
          createdAt: { type: 'string', format: 'datetime' }
        }
      }
    }
  }
})
```

### `buildSchema(lexicons)`

Build a GraphQL schema from parsed lexicons (without resolvers).

```javascript
import { buildSchema } from 'lex-gql'
import { printSchema } from 'graphql'

const schema = buildSchema(lexicons)
console.log(printSchema(schema))
```

### `createAdapter(lexicons, options)`

Create a full adapter with query execution.

```javascript
const adapter = createAdapter(lexicons, {
  query: async (operation) => {
    // Your data source implementation
  }
})

const { schema, execute } = adapter
```

### Utility Functions

```javascript
import {
  nsidToTypeName,      // 'app.bsky.feed.post' -> 'AppBskyFeedPost'
  nsidToFieldName,     // 'app.bsky.feed.post' -> 'appBskyFeedPost'
  nsidToCollectionName, // 'app.bsky.feed.post' -> 'post'
  parseRefUri,         // Parse ref URIs like 'app.bsky.feed.defs#postView'
  refToTypeName,       // Convert ref URI to GraphQL type name
  mapLexiconType       // Map lexicon types to GraphQL type names
} from 'lex-gql'
```

## Query Port Interface

lex-gql follows the hexagonal architecture pattern. Your data layer implements the **query port** interface:

### Operation Types

```typescript
type Operation =
  | { type: 'findMany'; collection: string; where: WhereClause[]; pagination: Pagination; sort?: SortClause[] }
  | { type: 'findManyPartitioned'; collection: string; partitionField: string; partitionValues: string[]; pagination?: Pagination; sort?: SortClause[] }
  | { type: 'aggregate'; collection: string; where: WhereClause[]; groupBy?: string[] }
  | { type: 'create'; collection: string; rkey?: string; record: object }
  | { type: 'update'; collection: string; rkey: string; record: object }
  | { type: 'delete'; collection: string; rkey: string }

// Field condition
type FieldCondition = { field: string; op: 'eq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'; value: any }

// Logical operators (for AND/OR queries)
type LogicalCondition = { op: 'and' | 'or'; conditions: WhereClause[][] }

type WhereClause = FieldCondition | LogicalCondition
type SortClause = { field: string; dir: 'asc' | 'desc' }
type Pagination = { first?: number; after?: string; last?: number; before?: string }
```

### Forward Joins

Forward joins let you resolve references to other records. They're automatically generated for:
- **strongRef fields** - References with `type: 'ref'` pointing to `com.atproto.repo.strongRef`
- **at-uri fields** - String fields with `format: 'at-uri'`

**Naming Convention:** `{fieldName}Resolved`

Examples:
- `app.bsky.feed.like` has a `subject` strongRef field → gets `subjectResolved`
- `app.bsky.feed.postgate` has a `post` at-uri field → gets `postResolved`
- `app.bsky.actor.profile` has a `pinnedPost` strongRef field → gets `pinnedPostResolved`

```graphql
query {
  appBskyFeedLike(first: 10) {
    edges {
      node {
        uri
        subject {
          uri
          cid
        }
        # Resolve the liked post
        subjectResolved {
          ... on AppBskyFeedPost {
            text
            createdAt
          }
        }
      }
    }
  }
}
```

**Nested Resolution:**

The `ComAtprotoRepoStrongRef` type also has a `uriResolved` field for nested strongRef resolution:

```graphql
query {
  appBskyFeedPost(first: 10) {
    edges {
      node {
        text
        reply {
          parent {
            uri
            cid
            # Resolve the parent post via the strongRef
            uriResolved {
              ... on AppBskyFeedPost {
                text
              }
            }
          }
        }
      }
    }
  }
}
```

**N+1 Prevention:**

Forward join queries are automatically batched. When you query 100 likes and each requests `subjectResolved`, lex-gql issues ONE batched query for all unique URIs instead of 100 individual queries.

### Cross-Collection URI Resolution

For batched forward join resolution, lex-gql issues `findMany` operations with `collection: '*'`. This special value means "query across all collections by URI":

```typescript
// Forward join batch request
{
  type: 'findMany',
  collection: '*',  // Special: resolve by URI, ignore collection filter
  where: [{ field: 'uri', op: 'in', value: ['at://did1/...', 'at://did2/...'] }],
  pagination: {}
}
```

Adapters **must** handle this case by omitting the collection filter and returning records matching the URIs. The returned records must include a `collection` field for union type resolution.

### Reverse Joins

Reverse joins let you query records that point TO a record, rather than records that a field points FROM. They're automatically generated for any field with `format: 'at-uri'`.

**Naming Convention:** `{collection}Via{FieldName}`

Examples:
- `app.bsky.feed.like` has a `subject` field pointing to posts
- Posts get a `appBskyFeedLikeViaSubject` field to query likes pointing to them
- `app.bsky.feed.threadgate` has a `post` field
- Posts get a `appBskyFeedThreadgateViaPost` field

```graphql
query {
  appBskyFeedPost(first: 10) {
    edges {
      node {
        uri
        text
        # Get all likes pointing to this post
        appBskyFeedLikeViaSubject(first: 5, sortBy: [{ field: "createdAt", direction: DESC }]) {
          totalCount
          edges {
            node {
              uri
              createdAt
            }
          }
        }
      }
    }
  }
}
```

**Arguments:**
- `first`, `after`, `last`, `before` - Relay pagination (per-parent)
- `sortBy` - Sort order for results

**N+1 Prevention:**

Reverse join queries are automatically batched. When you query 100 posts and each requests likes, lex-gql issues ONE batched `findManyPartitioned` query instead of 100 individual queries. Adapters that implement `findManyPartitioned` get efficient per-partition pagination (e.g., using SQL window functions for top-N-per-group queries). Adapters can return `null` from `findManyPartitioned` to fall back to individual `findMany` queries.

### Response Format

```typescript
// For findMany
{ rows: Record[]; hasNext: boolean; hasPrev: boolean; totalCount?: number }

// For findManyPartitioned (return null to trigger fallback to individual findMany queries)
{ [partitionValue: string]: { rows: Record[]; hasNext: boolean; hasPrev: boolean; totalCount?: number } } | null

// For aggregate
{ count: number; groups: { [field]: value; count: number }[] }

// For mutations
Record | { uri: string }
```

### Standard Records Schema

For SQL-based adapters, we recommend this schema:

```sql
CREATE TABLE records (
  uri TEXT PRIMARY KEY,
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  cid TEXT,
  record TEXT NOT NULL,  -- JSON blob
  indexed_at TEXT NOT NULL
);

CREATE INDEX idx_records_collection ON records(collection);
CREATE INDEX idx_records_did ON records(did);

CREATE TABLE actors (
  did TEXT PRIMARY KEY,
  handle TEXT NOT NULL
);
```

### Hydration Helpers

Use these helpers to transform database rows into lex-gql format:

```javascript
import { hydrateBlobs, hydrateRecord } from 'lex-gql';

// hydrateBlobs - inject DID into blob fields for URL resolution
const record = JSON.parse(row.record);
const hydrated = hydrateBlobs(record, row.did);

// hydrateRecord - full transformation from standard schema
const rows = db.query('SELECT r.*, a.handle FROM records r LEFT JOIN actors a ON r.did = a.did');
const records = rows.map(hydrateRecord);
```

## Generated Schema Structure

For each record lexicon, lex-gql generates:

| Type | Example | Description |
|------|---------|-------------|
| Record type | `AppBskyFeedPost` | The main record with system and lexicon fields |
| Connection | `AppBskyFeedPostConnection` | Relay connection with edges and pageInfo |
| Edge | `AppBskyFeedPostEdge` | Edge with node and cursor |
| WhereInput | `AppBskyFeedPostWhereInput` | Filter input with field conditions |
| SortFieldInput | `AppBskyFeedPostSortFieldInput` | Sort input with field and direction |
| Input | `AppBskyFeedPostInput` | Mutation input type |
| Aggregated | `AppBskyFeedPostAggregated` | Aggregation result type |
| GroupByField | `AppBskyFeedPostGroupByField` | Enum for groupBy fields |
| FieldCondition | `AppBskyFeedPostFieldCondition` | Per-type field condition input |

### System Fields

Every record type includes these system fields:

- `uri: String` - Record URI
- `cid: String` - Record CID
- `did: String` - DID of record author
- `collection: String` - Collection name
- `indexedAt: String` - When record was indexed
- `actorHandle: String` - Handle of the actor

### Special Types

- `Blob` - Binary blob reference with `ref`, `mimeType`, `size`
- `ComAtprotoRepoStrongRef` - Strong reference with `cid`, `uri`
- `Record` - Union of all record types

### Nested Types

AT Protocol lexicons can define helper types alongside their main type. These live in the `defs` section under names other than `main`:

```json
{
  "id": "app.bsky.richtext.facet",
  "defs": {
    "main": { ... },
    "byteSlice": {
      "type": "object",
      "properties": {
        "byteStart": { "type": "integer" },
        "byteEnd": { "type": "integer" }
      }
    },
    "mention": { ... },
    "link": { ... }
  }
}
```

lex-gql generates GraphQL types for these with the pattern `{LexiconName}{DefName}`:

- `app.bsky.richtext.facet#byteSlice` → `AppBskyRichtextFacetByteSlice`
- `app.bsky.richtext.facet#mention` → `AppBskyRichtextFacetMention`
- `app.bsky.actor.defs#profileView` → `AppBskyActorDefsProfileView`

These types are included in the schema so they can be referenced by other types or used in queries.

## Error Handling

```javascript
import { LexGqlError, ErrorCodes } from 'lex-gql'

try {
  parseLexicon(invalidJson)
} catch (err) {
  if (err instanceof LexGqlError) {
    console.log(err.code)    // 'INVALID_LEXICON'
    console.log(err.details) // { field: 'id' }
  }
}

// Error codes:
// - INVALID_LEXICON
// - UNSUPPORTED_VERSION
// - QUERY_FAILED
// - VALIDATION_FAILED
```

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## License

MIT
