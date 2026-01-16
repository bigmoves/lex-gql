# Hydration Helpers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add hydration helpers to lex-gql that simplify building query adapters, following the hexagonal architecture port/adapter pattern.

**Architecture:** lex-gql defines a query port interface that adapters implement. Hydration helpers (`hydrateBlobs`, `hydrateRecord`) are shared utilities for adapter authors that transform raw database rows into the format lex-gql expects. The standard records schema is documented so adapters have a clear contract.

**Tech Stack:** JavaScript, graphql-js, vitest

---

### Task 1: Add hydrateBlobs helper function

**Files:**
- Modify: `packages/lex-gql/lex-gql.js` (add after utility functions ~line 212)
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

Add to `lex-gql.test.js` in a new describe block:

```javascript
describe('Hydration Helpers', () => {
  describe('hydrateBlobs', () => {
    it('injects did into blob objects', () => {
      const { hydrateBlobs } = require('./lex-gql.js');

      const record = {
        text: 'hello',
        avatar: {
          $type: 'blob',
          ref: { $link: 'bafyreiabc123' },
          mimeType: 'image/jpeg',
          size: 12345,
        },
      };

      const result = hydrateBlobs(record, 'did:plc:user123');

      expect(result.text).toBe('hello');
      expect(result.avatar.did).toBe('did:plc:user123');
      expect(result.avatar.ref).toBe('bafyreiabc123');
    });

    it('handles nested blob objects', () => {
      const { hydrateBlobs } = require('./lex-gql.js');

      const record = {
        embed: {
          images: [
            { image: { $type: 'blob', ref: 'bafyrei1', mimeType: 'image/jpeg', size: 100 } },
            { image: { $type: 'blob', ref: 'bafyrei2', mimeType: 'image/png', size: 200 } },
          ],
        },
      };

      const result = hydrateBlobs(record, 'did:plc:user123');

      expect(result.embed.images[0].image.did).toBe('did:plc:user123');
      expect(result.embed.images[1].image.did).toBe('did:plc:user123');
    });

    it('returns primitives unchanged', () => {
      const { hydrateBlobs } = require('./lex-gql.js');

      expect(hydrateBlobs(null, 'did:plc:x')).toBe(null);
      expect(hydrateBlobs('string', 'did:plc:x')).toBe('string');
      expect(hydrateBlobs(123, 'did:plc:x')).toBe(123);
    });

    it('handles blob without $type but with ref/mimeType/size', () => {
      const { hydrateBlobs } = require('./lex-gql.js');

      const record = {
        avatar: { ref: 'bafyreiabc', mimeType: 'image/jpeg', size: 100 },
      };

      const result = hydrateBlobs(record, 'did:plc:user');
      expect(result.avatar.did).toBe('did:plc:user');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- -t "hydrateBlobs"`
Expected: FAIL - hydrateBlobs is not exported

**Step 3: Implement hydrateBlobs**

Add to `lex-gql.js` after the utility functions section (~line 212):

```javascript
// ============================================================================
// HYDRATION HELPERS
// ============================================================================

/**
 * Inject DID into blob objects for URL resolution.
 * Blobs need the parent record's DID to generate CDN URLs.
 *
 * @param {*} obj - Record object or value to hydrate
 * @param {string} did - DID to inject into blob objects
 * @returns {*} - Hydrated object with did added to blobs
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
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = hydrateBlobs(value, did);
  }
  return result;
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql && pnpm test -- -t "hydrateBlobs"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat: add hydrateBlobs helper for blob DID injection"
```

---

### Task 2: Add hydrateRecord helper function

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

Add to the `Hydration Helpers` describe block:

```javascript
describe('hydrateRecord', () => {
  it('transforms a database row to lex-gql record format', () => {
    const { hydrateRecord } = require('./lex-gql.js');

    const row = {
      uri: 'at://did:plc:user123/app.bsky.feed.post/abc',
      did: 'did:plc:user123',
      collection: 'app.bsky.feed.post',
      rkey: 'abc',
      cid: 'bafyreicid',
      record: JSON.stringify({ text: 'hello', createdAt: '2024-01-01T00:00:00Z' }),
      indexed_at: '2024-01-01T00:00:00Z',
      handle: 'user.bsky.social',
    };

    const result = hydrateRecord(row);

    expect(result.uri).toBe('at://did:plc:user123/app.bsky.feed.post/abc');
    expect(result.did).toBe('did:plc:user123');
    expect(result.collection).toBe('app.bsky.feed.post');
    expect(result.cid).toBe('bafyreicid');
    expect(result.indexedAt).toBe('2024-01-01T00:00:00Z');
    expect(result.actorHandle).toBe('user.bsky.social');
    expect(result.text).toBe('hello');
    expect(result.createdAt).toBe('2024-01-01T00:00:00Z');
  });

  it('hydrates blob fields with did', () => {
    const { hydrateRecord } = require('./lex-gql.js');

    const row = {
      uri: 'at://did:plc:user/app.bsky.actor.profile/self',
      did: 'did:plc:user',
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      cid: 'bafyreicid',
      record: JSON.stringify({
        displayName: 'Test',
        avatar: { $type: 'blob', ref: { $link: 'bafyrei123' }, mimeType: 'image/jpeg', size: 100 },
      }),
      indexed_at: '2024-01-01T00:00:00Z',
    };

    const result = hydrateRecord(row);

    expect(result.avatar.did).toBe('did:plc:user');
    expect(result.avatar.ref).toBe('bafyrei123');
  });

  it('handles missing optional fields', () => {
    const { hydrateRecord } = require('./lex-gql.js');

    const row = {
      uri: 'at://did:plc:user/col/rkey',
      did: 'did:plc:user',
      collection: 'col',
      rkey: 'rkey',
      record: '{}',
      indexed_at: '2024-01-01T00:00:00Z',
      // cid and handle are missing
    };

    const result = hydrateRecord(row);

    expect(result.cid).toBeUndefined();
    expect(result.actorHandle).toBeNull();
  });

  it('accepts record as object instead of JSON string', () => {
    const { hydrateRecord } = require('./lex-gql.js');

    const row = {
      uri: 'at://did:plc:user/col/rkey',
      did: 'did:plc:user',
      collection: 'col',
      rkey: 'rkey',
      record: { text: 'already parsed' },
      indexed_at: '2024-01-01T00:00:00Z',
    };

    const result = hydrateRecord(row);
    expect(result.text).toBe('already parsed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- -t "hydrateRecord"`
Expected: FAIL - hydrateRecord is not exported

**Step 3: Implement hydrateRecord**

Add to `lex-gql.js` after `hydrateBlobs`:

```javascript
/**
 * Transform a database row into lex-gql record format.
 * Expects the standard records table schema.
 *
 * Standard schema:
 * - uri: TEXT (record AT URI)
 * - did: TEXT (author DID)
 * - collection: TEXT (lexicon NSID)
 * - rkey: TEXT (record key)
 * - cid: TEXT (optional, content ID)
 * - record: TEXT (JSON) or Object
 * - indexed_at: TEXT (ISO timestamp)
 * - handle: TEXT (optional, actor handle from actors table join)
 *
 * @param {Object} row - Database row
 * @returns {Object} - Hydrated record for lex-gql
 *
 * @example
 * const rows = db.query('SELECT r.*, a.handle FROM records r LEFT JOIN actors a ON r.did = a.did');
 * const records = rows.map(hydrateRecord);
 */
export function hydrateRecord(row) {
  const record = typeof row.record === 'string' ? JSON.parse(row.record) : row.record;
  const hydrated = hydrateBlobs(record, row.did);

  return {
    uri: row.uri,
    cid: row.cid,
    did: row.did,
    collection: row.collection,
    indexedAt: row.indexed_at,
    actorHandle: row.handle || null,
    ...hydrated,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql && pnpm test -- -t "hydrateRecord"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat: add hydrateRecord helper for standard row transformation"
```

---

### Task 3: Document the port interface in README

**Files:**
- Modify: `packages/lex-gql/README.md`

**Step 1: Add Port Interface section**

Add after the "API" section in README.md:

```markdown
## Query Port Interface

lex-gql follows the hexagonal architecture pattern. Your data layer implements the **query port** interface:

### Operation Types

```typescript
type Operation =
  | { type: 'findMany'; collection: string; where: WhereClause[]; pagination: Pagination; sort?: SortClause[] }
  | { type: 'aggregate'; collection: string; where: WhereClause[]; groupBy?: string[] }
  | { type: 'create'; collection: string; rkey?: string; record: object }
  | { type: 'update'; collection: string; rkey: string; record: object }
  | { type: 'delete'; collection: string; rkey: string }

type WhereClause = { field: string; op: 'eq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'; value: any }
type SortClause = { field: string; dir: 'asc' | 'desc' }
type Pagination = { first?: number; after?: string; last?: number; before?: string }
```

### Response Format

```typescript
// For findMany
{ rows: Record[]; hasNext: boolean; hasPrev: boolean }

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
```

**Step 2: Commit**

```bash
git add packages/lex-gql/README.md
git commit -m "docs: add port interface and hydration helpers documentation"
```

---

### Task 4: Update tap example to use hydration helpers

**Files:**
- Modify: `examples/tap/index.js`

**Step 1: Update imports**

Change import to include helpers:

```javascript
import { createAdapter, parseLexicon, hydrateRecord } from 'lex-gql';
```

**Step 2: Remove local injectDidIntoBlobs helper**

Delete the `injectDidIntoBlobs` function (lines ~198-223).

**Step 3: Simplify findMany transform**

Replace the transform section:

```javascript
// Transform rows to lex-gql format
const transformed = rows.map((row) => ({
  ...hydrateRecord({
    uri: `at://${row.did}/${row.collection}/${row.rkey}`,
    did: row.did,
    collection: row.collection,
    rkey: row.rkey,
    cid: row.cid,
    record: row.record,
    indexed_at: row.indexed_at,
    handle: row.handle,
  }),
  _id: row.id, // For cursor
}));
```

**Step 4: Verify tap example still works**

Run: `cd examples/tap && node index.js`
Test the GraphQL query in browser.

**Step 5: Commit**

```bash
git add examples/tap/index.js
git commit -m "refactor(tap): use lex-gql hydration helpers"
```

---

### Task 5: Run full test suite and verify

**Step 1: Run all tests**

Run: `cd packages/lex-gql && pnpm test`
Expected: All tests pass

**Step 2: Verify exports in type definitions**

Check that `lex-gql.d.ts` exports the new functions (if it exists), or note that types need updating.

**Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after hydration helpers"
```

---
