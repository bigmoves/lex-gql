# GraphQL Subscriptions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add GraphQL subscription support to lex-gql, generating `Created`, `Updated`, and `Deleted` subscription fields for each record type.

**Architecture:** Follow existing pattern of paired functions (`createSubscriptionType` + `createSubscriptionTypeWithResolvers`). Extend `AdapterOptions` with optional `subscribe` function that returns AsyncIterables. The adapter handles wiring subscriptions to the user-provided subscribe function.

**Tech Stack:** graphql (GraphQLObjectType, GraphQLNonNull), AsyncIterator pattern

---

### Task 1: Add SubscriptionEvent typedef

**Files:**
- Modify: `lex-gql.js:71-75` (after AdapterOptions typedef)

**Step 1: Add the typedef**

Add after line 75 (after AdapterOptions):

```javascript
/**
 * @typedef {'created' | 'updated' | 'deleted'} SubscriptionEvent
 */

/**
 * @typedef {Object} SubscribeOperation
 * @property {string} collection - The collection NSID (e.g., 'app.bsky.feed.post')
 * @property {SubscriptionEvent} event - The event type
 */
```

**Step 2: Update AdapterOptions typedef**

Modify lines 71-75 to add subscribe property:

```javascript
/**
 * @typedef {Object} AdapterOptions
 * @property {(op: Operation) => Promise<*>} query
 * @property {(op: SubscribeOperation) => AsyncIterable<*>} [subscribe]
 * @property {Record<string, *>} [context]
 * @property {number} [maxDepth]
 */
```

**Step 3: Commit**

```bash
git add lex-gql.js
git commit -m "feat: add SubscribeOperation and subscribe option typedefs"
```

---

### Task 2: Write failing test for subscription type generation

**Files:**
- Modify: `lex-gql.test.js` (add new describe block after Mutation tests)

**Step 1: Write the failing test**

Add after the Mutation tests section (~line 800):

```javascript
describe("Subscription Type Generation", () => {
  it("generates subscription fields for each record type", () => {
    const lexicons = [
      parseLexicon({
        id: "xyz.test.post",
        defs: {
          main: {
            type: "record",
            key: "tid",
            record: {
              type: "object",
              properties: {
                text: { type: "string" },
              },
            },
          },
        },
      }),
    ];

    const schema = buildSchema(lexicons);
    const subscriptionType = schema.getSubscriptionType();

    expect(subscriptionType).not.toBeNull();
    const fields = subscriptionType.getFields();

    expect(fields.xyzTestPostCreated).toBeDefined();
    expect(fields.xyzTestPostUpdated).toBeDefined();
    expect(fields.xyzTestPostDeleted).toBeDefined();
  });

  it("subscription fields return the record type", () => {
    const lexicons = [
      parseLexicon({
        id: "xyz.test.item",
        defs: {
          main: {
            type: "record",
            key: "tid",
            record: {
              type: "object",
              properties: {
                name: { type: "string" },
              },
            },
          },
        },
      }),
    ];

    const schema = buildSchema(lexicons);
    const subscriptionType = schema.getSubscriptionType();
    const fields = subscriptionType.getFields();

    // All three events should return the same record type (non-null)
    const createdType = fields.xyzTestItemCreated.type;
    expect(createdType.toString()).toBe("XyzTestItem!");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "Subscription"`

Expected: FAIL with `subscriptionType` being null

**Step 3: Commit failing test**

```bash
git add lex-gql.test.js
git commit -m "test: add failing tests for subscription type generation"
```

---

### Task 3: Implement createSubscriptionType function

**Files:**
- Modify: `lex-gql.js` (add after createMutationType, ~line 850)

**Step 1: Add createSubscriptionType function**

Add after `createMutationType` function:

```javascript
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
    if (!lexicon.defs.main || lexicon.defs.main.type !== "record") continue;

    const typeName = nsidToTypeName(lexicon.id);
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
    name: "Subscription",
    fields,
  });
}
```

**Step 2: Update buildSchema to include subscription type**

Find the `return new GraphQLSchema` line in `buildSchema` (~line 1468) and modify:

```javascript
  // Create Subscription type
  const subscriptionType = createSubscriptionType(lexicons, recordTypes);

  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
    types,
  });
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- --grep "Subscription"`

Expected: PASS

**Step 4: Run full test suite**

Run: `npm test`

Expected: All tests pass

**Step 5: Commit**

```bash
git add lex-gql.js
git commit -m "feat: add subscription type generation to buildSchema"
```

---

### Task 4: Write failing test for subscription resolvers in adapter

**Files:**
- Modify: `lex-gql.test.js`

**Step 1: Write the failing test**

Add to the "Subscription Type Generation" describe block:

```javascript
  it("adapter wires subscribe function to subscription resolvers", async () => {
    const lexicons = [
      parseLexicon({
        id: "xyz.test.message",
        defs: {
          main: {
            type: "record",
            key: "tid",
            record: {
              type: "object",
              properties: {
                content: { type: "string" },
              },
            },
          },
        },
      }),
    ];

    const emittedRecords = [
      { uri: "at://did:plc:test/xyz.test.message/1", content: "Hello" },
      { uri: "at://did:plc:test/xyz.test.message/2", content: "World" },
    ];

    let subscribeCalled = false;
    let subscribeArgs = null;

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false }),
      subscribe: (op) => {
        subscribeCalled = true;
        subscribeArgs = op;
        return (async function* () {
          for (const record of emittedRecords) {
            yield record;
          }
        })();
      },
    });

    const subscriptionType = adapter.schema.getSubscriptionType();
    expect(subscriptionType).not.toBeNull();

    const fields = subscriptionType.getFields();
    expect(fields.xyzTestMessageCreated).toBeDefined();
    expect(fields.xyzTestMessageCreated.subscribe).toBeDefined();

    // Call the subscribe function directly
    const iterator = fields.xyzTestMessageCreated.subscribe(
      {},
      {},
      {},
      { fieldName: "xyzTestMessageCreated" }
    );

    const results = [];
    for await (const value of iterator) {
      results.push(value);
    }

    expect(subscribeCalled).toBe(true);
    expect(subscribeArgs).toEqual({
      collection: "xyz.test.message",
      event: "created",
    });
    expect(results).toEqual(emittedRecords);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "adapter wires subscribe"`

Expected: FAIL (subscribe not defined on field)

**Step 3: Commit failing test**

```bash
git add lex-gql.test.js
git commit -m "test: add failing test for subscription resolver wiring"
```

---

### Task 5: Implement createSubscriptionTypeWithResolvers

**Files:**
- Modify: `lex-gql.js`

**Step 1: Add createSubscriptionTypeWithResolvers function**

Add after `createSubscriptionType`:

```javascript
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
    if (!lexicon.defs.main || lexicon.defs.main.type !== "record") continue;

    const fieldName = nsidToFieldName(lexicon.id);

    fields[`${fieldName}Created`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a new ${lexicon.id} record is created`,
      subscribe: () =>
        subscribeFn({ collection: lexicon.id, event: "created" }),
      resolve: (/** @type {*} */ payload) => payload,
    };

    fields[`${fieldName}Updated`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is updated`,
      subscribe: () =>
        subscribeFn({ collection: lexicon.id, event: "updated" }),
      resolve: (/** @type {*} */ payload) => payload,
    };

    fields[`${fieldName}Deleted`] = {
      type: new GraphQLNonNull(recordTypes[lexicon.id]),
      description: `Emitted when a ${lexicon.id} record is deleted`,
      subscribe: () =>
        subscribeFn({ collection: lexicon.id, event: "deleted" }),
      resolve: (/** @type {*} */ payload) => payload,
    };
  }

  return new GraphQLObjectType({
    name: "Subscription",
    fields,
  });
}
```

**Step 2: Update buildSchemaWithResolvers**

Find `buildSchemaWithResolvers` and add subscription type before the return (~line 1625):

```javascript
  // Create Subscription type with resolvers (only if subscribe function provided)
  const subscriptionType = subscribeFn
    ? createSubscriptionTypeWithResolvers(lexicons, recordTypes, subscribeFn)
    : createSubscriptionType(lexicons, recordTypes);

  return new GraphQLSchema({
    query: queryType,
    mutation: mutationType,
    subscription: subscriptionType,
  });
```

**Step 3: Update buildSchemaWithResolvers signature**

Update the function signature and JSDoc to accept subscribeFn:

```javascript
/**
 * Build a GraphQL schema with resolvers that call the query function
 * @param {Lexicon[]} lexicons
 * @param {(op: Operation) => Promise<any>} queryFn
 * @param {(op: SubscribeOperation) => AsyncIterable<*>} [subscribeFn]
 * @returns {GraphQLSchema}
 */
function buildSchemaWithResolvers(lexicons, queryFn, subscribeFn) {
```

**Step 4: Update createAdapter to pass subscribe function**

In `createAdapter`, update the call to `buildSchemaWithResolvers`:

```javascript
export function createAdapter(lexicons, options) {
  const { query, subscribe } = options;

  const schema = buildSchemaWithResolvers(lexicons, query, subscribe);
```

**Step 5: Run tests to verify they pass**

Run: `npm test -- --grep "Subscription"`

Expected: All subscription tests pass

**Step 6: Run full test suite**

Run: `npm test`

Expected: All tests pass

**Step 7: Commit**

```bash
git add lex-gql.js
git commit -m "feat: add subscription resolvers with subscribe function wiring"
```

---

### Task 6: Run typecheck and lint

**Files:**
- Modify: `lex-gql.js` (if fixes needed)

**Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: Pass (fix any type errors if present)

**Step 2: Run lint**

Run: `npm run lint`

Expected: Pass (run `npm run lint:fix` if needed)

**Step 3: Regenerate types**

Run: `npm run typecheck`

Verify `lex-gql.d.ts` includes new types.

**Step 4: Commit any fixes**

```bash
git add lex-gql.js lex-gql.d.ts
git commit -m "chore: fix lint and regenerate types"
```

---

### Task 7: Update schema comparison test

**Files:**
- Modify: `lex-gql.test.js`

**Step 1: Verify subscription type appears in comparison**

Run the schema comparison and verify Subscription type is now generated:

Run: `npm test`

Check output - "Subscription" should no longer appear in "Types in oracle but NOT generated"

**Step 2: Commit if changes needed**

```bash
git add lex-gql.test.js
git commit -m "test: verify subscription type in schema comparison"
```

---

### Task 8: Add adapter.subscribe convenience method

**Files:**
- Modify: `lex-gql.js`

**Step 1: Write failing test**

Add to test file:

```javascript
  it("adapter.subscribe executes subscription queries", async () => {
    const lexicons = [
      parseLexicon({
        id: "xyz.test.event",
        defs: {
          main: {
            type: "record",
            key: "tid",
            record: {
              type: "object",
              properties: { data: { type: "string" } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false }),
      subscribe: () =>
        (async function* () {
          yield { uri: "at://test/1", data: "event1" };
          yield { uri: "at://test/2", data: "event2" };
        })(),
    });

    expect(adapter.subscribe).toBeDefined();

    const results = [];
    const subscription = await adapter.subscribe(`
      subscription {
        xyzTestEventCreated {
          uri
          data
        }
      }
    `);

    for await (const result of subscription) {
      results.push(result.data.xyzTestEventCreated);
      if (results.length >= 2) break;
    }

    expect(results).toHaveLength(2);
    expect(results[0].data).toBe("event1");
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "adapter.subscribe"`

Expected: FAIL

**Step 3: Implement adapter.subscribe method**

Update the return object in `createAdapter`:

```javascript
  return {
    schema,
    /**
     * @param {string} queryString
     * @param {Record<string, unknown>} [variables]
     */
    async execute(queryString, variables = {}) {
      const { graphql } = await import("graphql");
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
      const { subscribe } = await import("graphql");
      const result = await subscribe({
        schema,
        document: (await import("graphql")).parse(subscriptionQuery),
        variableValues: variables,
      });
      if (Symbol.asyncIterator in result) {
        return result;
      }
      throw new LexGqlError(
        "Subscription failed",
        ErrorCodes.QUERY_FAILED,
        result
      );
    },
  };
```

**Step 4: Update createAdapter return type in JSDoc**

```javascript
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
```

**Step 5: Run tests**

Run: `npm test`

Expected: All pass

**Step 6: Commit**

```bash
git add lex-gql.js lex-gql.test.js
git commit -m "feat: add adapter.subscribe method for executing subscriptions"
```

---

### Task 9: Final verification

**Step 1: Run all checks**

```bash
npm test
npm run typecheck
npm run lint
```

Expected: All pass

**Step 2: Verify .d.ts includes subscribe**

Check `lex-gql.d.ts` includes the new `subscribe` method and types.

**Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: final cleanup for subscription support"
```

---

### Task 10: Add Jetstream integration example

**Files:**
- Create: `examples/jetstream-subscriptions.js`

**Step 1: Create examples directory**

```bash
mkdir -p examples
```

**Step 2: Create the example file**

Create `examples/jetstream-subscriptions.js`:

```javascript
/**
 * Example: Integrating lex-gql subscriptions with AT Protocol Jetstream
 *
 * This example shows how to wire up real-time events from Jetstream
 * to GraphQL subscriptions.
 *
 * Prerequisites:
 *   npm install lex-gql graphql @skyware/jetstream graphql-ws ws
 */

import { createAdapter, parseLexicon } from "lex-gql";
import { Jetstream } from "@skyware/jetstream";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

// 1. Define your lexicons (or load from files)
const lexicons = [
  parseLexicon({
    id: "app.bsky.feed.post",
    defs: {
      main: {
        type: "record",
        key: "tid",
        record: {
          type: "object",
          properties: {
            text: { type: "string" },
            createdAt: { type: "string", format: "datetime" },
          },
          required: ["text", "createdAt"],
        },
      },
    },
  }),
];

// 2. Connect to Jetstream firehose
const jetstream = new Jetstream({
  endpoint: "wss://jetstream1.us-east.bsky.network/subscribe",
  wantedCollections: ["app.bsky.feed.post"],
});

// 3. Create a subscription manager to handle multiple subscribers
class SubscriptionManager {
  constructor(jetstream) {
    this.jetstream = jetstream;
    this.listeners = new Map(); // collection:event -> Set<callback>

    this.jetstream.on("commit", (evt) => {
      if (!evt.commit) return;

      const { collection, operation, record, rkey } = evt.commit;
      const event = { create: "created", update: "updated", delete: "deleted" }[
        operation
      ];
      if (!event) return;

      const key = `${collection}:${event}`;
      const callbacks = this.listeners.get(key);
      if (!callbacks) return;

      const payload = {
        uri: `at://${evt.did}/${collection}/${rkey}`,
        did: evt.did,
        cid: evt.commit.cid,
        collection,
        indexedAt: new Date().toISOString(),
        ...record,
      };

      for (const callback of callbacks) {
        callback(payload);
      }
    });
  }

  subscribe(collection, event) {
    const key = `${collection}:${event}`;

    return {
      [Symbol.asyncIterator]: () => {
        const queue = [];
        let waiting = null;

        const callback = (payload) => {
          if (waiting) {
            waiting(payload);
            waiting = null;
          } else {
            queue.push(payload);
          }
        };

        if (!this.listeners.has(key)) {
          this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        return {
          next: () => {
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift(), done: false });
            }
            return new Promise((resolve) => {
              waiting = (value) => resolve({ value, done: false });
            });
          },
          return: () => {
            this.listeners.get(key)?.delete(callback);
            return Promise.resolve({ done: true });
          },
        };
      },
    };
  }
}

const subscriptionManager = new SubscriptionManager(jetstream);

// 4. Create the adapter with subscribe wired to Jetstream
const adapter = createAdapter(lexicons, {
  // Query function - implement with your database
  query: async (op) => {
    console.log("Query:", op);
    // Your database query here
    return { rows: [], hasNext: false, hasPrev: false };
  },

  // Subscribe function - wired to Jetstream
  subscribe: ({ collection, event }) => {
    console.log(`New subscription: ${collection} ${event}`);
    return subscriptionManager.subscribe(collection, event);
  },
});

// 5. Start Jetstream
jetstream.start();
console.log("Connected to Jetstream");

// 6. Start GraphQL WebSocket server
const wsServer = new WebSocketServer({ port: 4000 });

useServer(
  {
    schema: adapter.schema,
    onSubscribe: (ctx, msg) => {
      console.log("Client subscribed:", msg.payload.query);
    },
  },
  wsServer
);

console.log("GraphQL WebSocket server running on ws://localhost:4000");
console.log(`
Test with a GraphQL client:

  subscription {
    appBskyFeedPostCreated {
      uri
      did
      text
      createdAt
    }
  }
`);
```

**Step 3: Add to .gitignore (optional)**

If you don't want to track examples, add to `.gitignore`:

```
# examples/
```

**Step 4: Test the example runs**

```bash
node examples/jetstream-subscriptions.js
```

Expected: Server starts without errors (will fail to connect to Jetstream without network, but code should be valid)

**Step 5: Commit**

```bash
git add examples/
git commit -m "docs: add Jetstream integration example for subscriptions"
```

---

## Summary

After completing all tasks:

1. `buildSchema` generates Subscription type with `Created`, `Updated`, `Deleted` fields
2. `createAdapter` accepts optional `subscribe` function in options
3. Subscription resolvers wire to user's `subscribe` function
4. `adapter.subscribe()` convenience method for executing subscriptions
5. Full type definitions in `.d.ts`
6. Working example showing Jetstream + graphql-ws integration
