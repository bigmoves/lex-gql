# Reverse Join Batching Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add N+1 query prevention for reverse join fields via ReverseJoinCollector and the new `findManyPartitioned` operation type.

**Architecture:** ReverseJoinCollector batches reverse join resolver calls within a microtask, grouping by (collection, fieldName, pagination, sort). Issues one `findManyPartitioned` operation per group, with results keyed by parent URI. Adapters implement efficient per-partition queries (SQL uses window functions).

**Tech Stack:** lex-gql (JS), GraphQL, vitest

---

## Background

### Current Problem
Reverse join resolvers issue one query per parent record:
```graphql
appBskyFeedPost(first: 100) {
  edges {
    node {
      appBskyFeedThreadgateViaPost(first: 5) { ... }  # 100 separate queries
    }
  }
}
```

### Solution
1. Remove unused `where` argument from reverse joins (simplifies design)
2. Add `ReverseJoinCollector` to batch parent URIs
3. Add `findManyPartitioned` operation type for per-partition pagination
4. Update reverse join resolvers to use collector

---

## Task 1: Remove `where` Argument from Reverse Join Fields

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.js:1716`
- Modify: `packages/lex-gql/test/lex-gql.test.js:1350-1395`

**Step 1: Remove `where` from reverse join args**

In `packages/lex-gql/src/lex-gql.js`, change lines 1711-1717 from:

```javascript
/** @type {Record<string, import('graphql').GraphQLArgumentConfig>} */
const reverseFieldArgs = {
  first: { type: GraphQLInt },
  after: { type: GraphQLString },
  last: { type: GraphQLInt },
  before: { type: GraphQLString },
  where: { type: whereInputTypes[fromTypeName] },
};
```

to:

```javascript
/** @type {Record<string, import('graphql').GraphQLArgumentConfig>} */
const reverseFieldArgs = {
  first: { type: GraphQLInt },
  after: { type: GraphQLString },
  last: { type: GraphQLInt },
  before: { type: GraphQLString },
};
```

**Step 2: Update test to not expect `where` argument**

In `packages/lex-gql/test/lex-gql.test.js`, change the test at line 1350 from:

```javascript
it('adds sortBy and where arguments to reverse join fields', () => {
```

to:

```javascript
it('adds sortBy argument to reverse join fields', () => {
```

And remove lines 1394 from the test:

```javascript
expect(postTypeDef).toContain('where:');
```

**Step 3: Run tests to verify**

Run: `cd packages/lex-gql && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/lex-gql/src/lex-gql.js packages/lex-gql/test/lex-gql.test.js
git commit -m "fix(lex-gql): remove unused where argument from reverse join fields

The where argument was accepted but silently ignored. Removing it
simplifies the API and avoids user confusion.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add `findManyPartitioned` Operation Type

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.d.ts:261-276`

**Step 1: Update Operation type to include findManyPartitioned**

In `packages/lex-gql/src/lex-gql.d.ts`, change the Operation type from:

```typescript
export type Operation = {
    type: "findMany" | "findOne" | "count" | "aggregate" | "create" | "update" | "delete";
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
};
```

to:

```typescript
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
```

**Step 2: Add PartitionedResult type after Operation**

Add after the Operation type:

```typescript
export type PartitionedResult = {
    [partitionValue: string]: {
        rows: Record<string, any>[];
        hasNext: boolean;
        hasPrev: boolean;
    };
};
```

**Step 3: Commit**

```bash
git add packages/lex-gql/src/lex-gql.d.ts
git commit -m "feat(lex-gql): add findManyPartitioned operation type

New operation type for batched reverse join queries with per-partition
pagination. Adapters can use SQL window functions for efficient
top-N-per-group queries.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add ReverseJoinCollector Class

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.js` (after DidCollector class, ~line 2480)

**Step 1: Add ReverseJoinCollector class**

Add after the DidCollector class (around line 2480):

```javascript
/**
 * ReverseJoinCollector for batching reverse join resolution
 * Groups lookups by (collection, fieldName, pagination, sort) and batches parent URIs
 */
export class ReverseJoinCollector {
  /**
   * @param {(op: Operation) => Promise<any>} queryFn
   */
  constructor(queryFn) {
    this.queryFn = queryFn;
    /** @type {Map<string, { collection: string, fieldName: string, pagination: any, sort: any, parentUris: string[], callbacks: Array<(result: any) => void> }>} */
    this.pending = new Map();
    this.scheduled = false;
  }

  /**
   * Create a hash key for grouping requests with identical parameters
   * @param {string} collection
   * @param {string} fieldName
   * @param {any} pagination
   * @param {any} sort
   * @returns {string}
   */
  _makeKey(collection, fieldName, pagination, sort) {
    return JSON.stringify({ collection, fieldName, pagination, sort });
  }

  /**
   * Load reverse join results for a parent URI
   * @param {string} collection - The collection to query (e.g., 'app.bsky.feed.threadgate')
   * @param {string} fieldName - The field that references the parent (e.g., 'post')
   * @param {string} parentUri - The parent record's URI
   * @param {{ first?: number, after?: string, last?: number, before?: string }} pagination
   * @param {Array<{ field: string, dir?: string }>} sort
   * @returns {Promise<{ rows: any[], hasNext: boolean, hasPrev: boolean }>}
   */
  load(collection, fieldName, parentUri, pagination, sort) {
    const key = this._makeKey(collection, fieldName, pagination, sort);

    return new Promise((resolve) => {
      if (!this.pending.has(key)) {
        this.pending.set(key, {
          collection,
          fieldName,
          pagination,
          sort,
          parentUris: [],
          callbacks: [],
        });
      }

      const group = this.pending.get(key);
      const index = group.parentUris.length;
      group.parentUris.push(parentUri);
      group.callbacks.push(resolve);

      // Schedule batch resolution
      if (!this.scheduled) {
        this.scheduled = true;
        queueMicrotask(() => this.flush());
      }
    });
  }

  /**
   * Flush pending requests and resolve them in batch
   */
  async flush() {
    if (this.pending.size === 0) {
      this.scheduled = false;
      return;
    }

    const pendingSnapshot = new Map(this.pending);
    this.pending.clear();
    this.scheduled = false;

    // Process each group
    for (const [_key, group] of pendingSnapshot) {
      const { collection, fieldName, pagination, sort, parentUris, callbacks } = group;

      try {
        // Try findManyPartitioned first
        /** @type {Operation} */
        const operation = {
          type: 'findManyPartitioned',
          collection,
          partitionField: fieldName,
          partitionValues: parentUris,
          sort,
          pagination,
        };

        const result = await this.queryFn(operation);

        // If adapter returns null, fall back to individual queries
        if (result === null) {
          await this._fallbackToIndividualQueries(group);
          continue;
        }

        // Distribute results to callbacks
        for (let i = 0; i < parentUris.length; i++) {
          const uri = parentUris[i];
          const partitionResult = result[uri] || { rows: [], hasNext: false, hasPrev: false };
          callbacks[i](partitionResult);
        }
      } catch (_err) {
        // On error, fall back to individual queries
        await this._fallbackToIndividualQueries(group);
      }
    }
  }

  /**
   * Fallback to individual findMany queries when findManyPartitioned is not supported
   * @param {{ collection: string, fieldName: string, pagination: any, sort: any, parentUris: string[], callbacks: Array<(result: any) => void> }} group
   */
  async _fallbackToIndividualQueries(group) {
    const { collection, fieldName, pagination, sort, parentUris, callbacks } = group;

    const promises = parentUris.map(async (uri, i) => {
      try {
        const result = await this.queryFn({
          type: 'findMany',
          collection,
          where: [{ field: fieldName, op: 'eq', value: uri }],
          sort,
          pagination,
        });
        callbacks[i](result);
      } catch (_err) {
        callbacks[i]({ rows: [], hasNext: false, hasPrev: false });
      }
    });

    await Promise.all(promises);
  }
}
```

**Step 2: Export ReverseJoinCollector**

The class is already exported via the `export class` syntax.

**Step 3: Run tests to verify no breakage**

Run: `cd packages/lex-gql && npm test`
Expected: PASS (collector not used yet)

**Step 4: Commit**

```bash
git add packages/lex-gql/src/lex-gql.js
git commit -m "feat(lex-gql): add ReverseJoinCollector for batching reverse joins

Batches reverse join resolver calls within a microtask, grouping by
(collection, fieldName, pagination, sort). Falls back to individual
queries if adapter doesn't support findManyPartitioned.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update TypeScript Definitions for ReverseJoinCollector

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.d.ts` (after DidCollector, ~line 185)

**Step 1: Add ReverseJoinCollector type definition**

Add after the DidCollector class definition:

```typescript
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
    pending: Map<string, {
        collection: string;
        fieldName: string;
        pagination: Pagination;
        sort: SortClause[];
        parentUris: string[];
        callbacks: Array<(result: any) => void>;
    }>;
    scheduled: boolean;
    /**
     * Load reverse join results for a parent URI
     */
    load(
        collection: string,
        fieldName: string,
        parentUri: string,
        pagination: Pagination,
        sort: SortClause[]
    ): Promise<{ rows: any[]; hasNext: boolean; hasPrev: boolean }>;
    /**
     * Flush pending requests and resolve them in batch
     */
    flush(): Promise<void>;
}
```

**Step 2: Commit**

```bash
git add packages/lex-gql/src/lex-gql.d.ts
git commit -m "chore(lex-gql): add ReverseJoinCollector type definition

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update Reverse Join Resolver to Use ReverseJoinCollector

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.js:1580-1700` (createRecordTypeWithResolvers function)
- Modify: `packages/lex-gql/src/lex-gql.js:1727-1752` (reverse join resolver)

**Step 1: Add reverseJoinCollector parameter to createRecordTypeWithResolvers**

Find the function signature for `createRecordTypeWithResolvers` (around line 1580) and add `reverseJoinCollector` parameter. Change from:

```javascript
function createRecordTypeWithResolvers(
  lexicon,
  lexicons,
  recordTypes,
  connectionTypes,
  whereInputTypes,
  sortInputTypes,
  blobType,
  recordUnionTypeHolder,
  typeRegistry,
  joinCollector,
  didCollector,
  queryFn,
  reverseJoinMap,
) {
```

to:

```javascript
function createRecordTypeWithResolvers(
  lexicon,
  lexicons,
  recordTypes,
  connectionTypes,
  whereInputTypes,
  sortInputTypes,
  blobType,
  recordUnionTypeHolder,
  typeRegistry,
  joinCollector,
  didCollector,
  reverseJoinCollector,
  queryFn,
  reverseJoinMap,
) {
```

**Step 2: Update the reverse join resolver to use collector**

Change the resolver (around lines 1727-1752) from:

```javascript
resolve: async (parent, args) => {
  const uri = parent.uri;
  if (!uri) {
    return {
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
      totalCount: 0,
    };
  }

  const operation = {
    type: 'findMany',
    collection: fromLexicon,
    where: [{ field: fieldName, op: 'eq', value: uri }],
    sort: compileSortBy(args.sortBy),
    pagination: {
      first: args.first,
      after: args.after,
      last: args.last,
      before: args.before,
    },
  };

  const result = await queryFn(operation);
  return formatConnection(result, operation.sort);
},
```

to:

```javascript
resolve: async (parent, args) => {
  const uri = parent.uri;
  if (!uri) {
    return {
      edges: [],
      pageInfo: { hasNextPage: false, hasPreviousPage: false },
      totalCount: 0,
    };
  }

  const sort = compileSortBy(args.sortBy);
  const pagination = {
    first: args.first,
    after: args.after,
    last: args.last,
    before: args.before,
  };

  const result = await reverseJoinCollector.load(
    fromLexicon,
    fieldName,
    uri,
    pagination,
    sort,
  );

  return formatConnection(result, sort);
},
```

**Step 3: Update buildSchemaWithResolvers to create and pass reverseJoinCollector**

Find where `createRecordTypeWithResolvers` is called in `buildSchemaWithResolvers` (around line 2070-2100). Add the reverseJoinCollector creation and pass it.

After the line that creates `didCollector` (around line 2070):

```javascript
const didCollector = new DidCollector(queryFn);
```

Add:

```javascript
const reverseJoinCollector = new ReverseJoinCollector(queryFn);
```

Then update the call to `createRecordTypeWithResolvers` to include `reverseJoinCollector` as the new parameter (after `didCollector`, before `queryFn`).

**Step 4: Run tests to verify**

Run: `cd packages/lex-gql && npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/src/lex-gql.js
git commit -m "feat(lex-gql): use ReverseJoinCollector in reverse join resolvers

Reverse join fields now batch queries via ReverseJoinCollector,
eliminating N+1 queries when resolving reverse joins on multiple
parent records.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Unit Tests for ReverseJoinCollector

**Files:**
- Modify: `packages/lex-gql/test/lex-gql.test.js`

**Step 1: Add import for ReverseJoinCollector**

Update the import at the top of the file to include `ReverseJoinCollector`:

```javascript
import {
  buildSchema,
  createAdapter,
  DidCollector,
  ErrorCodes,
  hydrateBlobs,
  hydrateRecord,
  JoinCollector,
  LexGqlError,
  mapLexiconType,
  nsidToCollectionName,
  nsidToFieldName,
  nsidToTypeName,
  parseLexicon,
  parseRefUri,
  refToTypeName,
  resolveRefKey,
  ReverseJoinCollector,
} from '../src/lex-gql.js';
```

**Step 2: Add ReverseJoinCollector test suite after DidCollector tests**

Find the DidCollector tests (search for `describe('DidCollector'`) and add after them:

```javascript
describe('ReverseJoinCollector', () => {
  it('batches multiple reverse join requests into one findManyPartitioned call', async () => {
    const operations = [];
    const mockQueryFn = async (op) => {
      operations.push(op);
      if (op.type === 'findManyPartitioned') {
        // Return results keyed by parent URI
        const result = {};
        for (const uri of op.partitionValues) {
          result[uri] = {
            rows: [{ uri: `${uri}/child/1`, parent: uri }],
            hasNext: false,
            hasPrev: false,
          };
        }
        return result;
      }
      return { rows: [], hasNext: false, hasPrev: false };
    };

    const collector = new ReverseJoinCollector(mockQueryFn);

    // Simulate multiple concurrent resolver calls
    const promise1 = collector.load('app.bsky.feed.like', 'subject', 'at://did1/post/1', { first: 10 }, []);
    const promise2 = collector.load('app.bsky.feed.like', 'subject', 'at://did2/post/2', { first: 10 }, []);
    const promise3 = collector.load('app.bsky.feed.like', 'subject', 'at://did3/post/3', { first: 10 }, []);

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

    // Should have made exactly one findManyPartitioned call
    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('findManyPartitioned');
    expect(operations[0].collection).toBe('app.bsky.feed.like');
    expect(operations[0].partitionField).toBe('subject');
    expect(operations[0].partitionValues).toEqual([
      'at://did1/post/1',
      'at://did2/post/2',
      'at://did3/post/3',
    ]);

    // Each result should have the correct data
    expect(result1.rows).toHaveLength(1);
    expect(result1.rows[0].parent).toBe('at://did1/post/1');
    expect(result2.rows[0].parent).toBe('at://did2/post/2');
    expect(result3.rows[0].parent).toBe('at://did3/post/3');
  });

  it('groups requests by collection, fieldName, pagination, and sort', async () => {
    const operations = [];
    const mockQueryFn = async (op) => {
      operations.push(op);
      if (op.type === 'findManyPartitioned') {
        const result = {};
        for (const uri of op.partitionValues) {
          result[uri] = { rows: [], hasNext: false, hasPrev: false };
        }
        return result;
      }
      return { rows: [], hasNext: false, hasPrev: false };
    };

    const collector = new ReverseJoinCollector(mockQueryFn);

    // Same collection/field but different pagination
    const promise1 = collector.load('app.bsky.feed.like', 'subject', 'at://did1/post/1', { first: 10 }, []);
    const promise2 = collector.load('app.bsky.feed.like', 'subject', 'at://did2/post/2', { first: 5 }, []);  // Different pagination

    await Promise.all([promise1, promise2]);

    // Should have made two separate calls due to different pagination
    expect(operations).toHaveLength(2);
  });

  it('falls back to individual queries when findManyPartitioned returns null', async () => {
    const operations = [];
    const mockQueryFn = async (op) => {
      operations.push(op);
      if (op.type === 'findManyPartitioned') {
        return null; // Adapter doesn't support it
      }
      if (op.type === 'findMany') {
        return {
          rows: [{ uri: 'child', parent: op.where[0].value }],
          hasNext: false,
          hasPrev: false,
        };
      }
      return { rows: [], hasNext: false, hasPrev: false };
    };

    const collector = new ReverseJoinCollector(mockQueryFn);

    const promise1 = collector.load('app.bsky.feed.like', 'subject', 'at://did1/post/1', { first: 10 }, []);
    const promise2 = collector.load('app.bsky.feed.like', 'subject', 'at://did2/post/2', { first: 10 }, []);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Should have tried findManyPartitioned, then fallen back to 2 findMany calls
    expect(operations).toHaveLength(3);
    expect(operations[0].type).toBe('findManyPartitioned');
    expect(operations[1].type).toBe('findMany');
    expect(operations[2].type).toBe('findMany');

    // Results should still be correct
    expect(result1.rows[0].parent).toBe('at://did1/post/1');
    expect(result2.rows[0].parent).toBe('at://did2/post/2');
  });

  it('returns empty result for missing partitions', async () => {
    const mockQueryFn = async (op) => {
      if (op.type === 'findManyPartitioned') {
        // Only return result for first URI
        return {
          'at://did1/post/1': { rows: [{ uri: 'child' }], hasNext: false, hasPrev: false },
          // Missing at://did2/post/2
        };
      }
      return { rows: [], hasNext: false, hasPrev: false };
    };

    const collector = new ReverseJoinCollector(mockQueryFn);

    const promise1 = collector.load('app.bsky.feed.like', 'subject', 'at://did1/post/1', { first: 10 }, []);
    const promise2 = collector.load('app.bsky.feed.like', 'subject', 'at://did2/post/2', { first: 10 }, []);

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1.rows).toHaveLength(1);
    expect(result2.rows).toHaveLength(0);
    expect(result2.hasNext).toBe(false);
  });
});
```

**Step 3: Run tests to verify**

Run: `cd packages/lex-gql && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/lex-gql/test/lex-gql.test.js
git commit -m "test(lex-gql): add ReverseJoinCollector unit tests

Tests batching behavior, grouping by parameters, fallback to
individual queries, and handling of missing partitions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Integration Test for Reverse Join Batching

**Files:**
- Modify: `packages/lex-gql/test/lex-gql.test.js`

**Step 1: Add integration test in the createAdapter tests section**

Find the existing reverse join tests (search for `resolves reverse join fields`) and add after them:

```javascript
it('batches reverse join queries across multiple parent nodes', async () => {
  const operations = [];
  const lexicons = [
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.feed.post',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } },
          },
        },
      },
    }),
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.feed.like',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['subject'],
            properties: {
              subject: { type: 'string', format: 'at-uri' },
            },
          },
        },
      },
    }),
  ];

  const adapter = createAdapter(lexicons, {
    query: async (op) => {
      operations.push({ ...op });

      if (op.type === 'findMany' && op.collection === 'app.bsky.feed.post') {
        return {
          rows: [
            { uri: 'at://did1/app.bsky.feed.post/1', text: 'Post 1' },
            { uri: 'at://did2/app.bsky.feed.post/2', text: 'Post 2' },
            { uri: 'at://did3/app.bsky.feed.post/3', text: 'Post 3' },
          ],
          hasNext: false,
          hasPrev: false,
          totalCount: 3,
        };
      }

      if (op.type === 'findManyPartitioned' && op.collection === 'app.bsky.feed.like') {
        // Return likes for each post
        const result = {};
        for (const uri of op.partitionValues) {
          result[uri] = {
            rows: [
              { uri: `${uri.replace('post', 'like')}/like1`, subject: uri },
              { uri: `${uri.replace('post', 'like')}/like2`, subject: uri },
            ],
            hasNext: false,
            hasPrev: false,
            totalCount: 2,
          };
        }
        return result;
      }

      return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
    },
  });

  const result = await adapter.execute(`
    query {
      appBskyFeedPost(first: 10) {
        edges {
          node {
            uri
            text
            appBskyFeedLikeViaSubject(first: 10) {
              totalCount
              edges {
                node {
                  uri
                }
              }
            }
          }
        }
      }
    }
  `);

  // Should have exactly 2 operations: findMany for posts, findManyPartitioned for likes
  expect(operations).toHaveLength(2);
  expect(operations[0].type).toBe('findMany');
  expect(operations[0].collection).toBe('app.bsky.feed.post');
  expect(operations[1].type).toBe('findManyPartitioned');
  expect(operations[1].collection).toBe('app.bsky.feed.like');
  expect(operations[1].partitionField).toBe('subject');
  expect(operations[1].partitionValues).toHaveLength(3);

  // Verify the results are correct
  const posts = result.data.appBskyFeedPost.edges;
  expect(posts).toHaveLength(3);
  expect(posts[0].node.appBskyFeedLikeViaSubject.totalCount).toBe(2);
  expect(posts[1].node.appBskyFeedLikeViaSubject.totalCount).toBe(2);
  expect(posts[2].node.appBskyFeedLikeViaSubject.totalCount).toBe(2);
});
```

**Step 2: Run tests to verify**

Run: `cd packages/lex-gql && npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/lex-gql/test/lex-gql.test.js
git commit -m "test(lex-gql): add integration test for reverse join batching

Verifies that multiple reverse join resolvers are batched into a
single findManyPartitioned operation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update README Documentation

**Files:**
- Modify: `packages/lex-gql/README.md`

**Step 1: Expand the reverse joins documentation**

Find the Features section (around line 58) and update the reverse joins bullet:

From:
```markdown
- **Reverse joins** via `*Via*` fields (e.g., `appBskyFeedLikeViaSubject`)
```

To:
```markdown
- **Reverse joins** via `*Via*` fields (e.g., `appBskyFeedLikeViaSubject`) with automatic N+1 batching
```

**Step 2: Add Reverse Joins section after the DID Joins section**

Find a good location (after describing forward joins, around line 260) and add:

```markdown
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

Reverse join queries are automatically batched. When you query 100 posts and each requests likes, lex-gql issues ONE batched query instead of 100 individual queries. Adapters that implement `findManyPartitioned` get efficient per-partition pagination.
```

**Step 3: Add findManyPartitioned to the Operation Types section**

Find the Operation Types section (around line 143) and add after the existing operations:

```markdown
  | { type: 'findManyPartitioned'; collection: string; partitionField: string; partitionValues: string[]; sort?: SortClause[]; pagination?: Pagination }
```

**Step 4: Add response format for findManyPartitioned**

In the Response Format section (around line 180), add:

```markdown
// For findManyPartitioned
{ [partitionValue: string]: { rows: Record[]; hasNext: boolean; hasPrev: boolean } }
```

**Step 5: Commit**

```bash
git add packages/lex-gql/README.md
git commit -m "docs(lex-gql): document reverse joins and findManyPartitioned

- Explain reverse join naming convention and use cases
- Document findManyPartitioned operation for adapters
- Note N+1 prevention via batching

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all lex-gql tests**

Run: `cd packages/lex-gql && npm test`
Expected: All PASS

**Step 2: Run E2E tests**

Run: `npm run test:e2e`
Expected: All PASS (may need to update if E2E uses reverse joins)

**Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, no commit needed
# If changes, commit them
```

---

## Verification Checklist

- [ ] `where` argument removed from reverse join fields
- [ ] `findManyPartitioned` operation type added to TypeScript definitions
- [ ] `ReverseJoinCollector` class implemented and exported
- [ ] Reverse join resolvers use `ReverseJoinCollector`
- [ ] Unit tests for `ReverseJoinCollector` pass
- [ ] Integration test for batching passes
- [ ] README documents reverse joins and `findManyPartitioned`
- [ ] All existing tests still pass
- [ ] E2E tests pass
