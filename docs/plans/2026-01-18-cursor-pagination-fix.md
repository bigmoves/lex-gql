# Cursor-Based Pagination Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix cursor pagination to work correctly with custom sort fields, eliminating duplicates when paginating sorted results.

**Architecture:** Replace ID-based cursor pagination with sort-field-aware cursors. Cursors encode actual sort field values (e.g., `playedTime|uri`) rather than internal row IDs. When decoding, build progressive WHERE clauses that properly respect sort order.

**Tech Stack:** lex-gql (JS), lex-gql-duckdb (JS/DuckDB), Node.js test runner

---

## Background

### Current Problem
The cursor pagination uses internal row `id`:
```js
// lex-gql-duckdb.js:411-413
cursorConditions.push('r.id < ?');
cursorParams.push(cursor.id);
```

This only works when sorting by insertion order. When sorting by `playedTime DESC`, the internal `id` doesn't correlate with `playedTime`, causing duplicates and out-of-order results.

### Solution
1. Encode sort field VALUES in cursor (not just ID)
2. Build progressive WHERE clauses based on sort fields
3. Use URI as tiebreaker for stable ordering

---

## Task 1: Add Cursor Pagination Test with Custom Sort

**Files:**
- Modify: `packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js`

**Step 1: Write the failing test**

Add this test after the existing "handles cursor pagination with after" test (~line 371):

```javascript
it('handles cursor pagination with custom sort field', async () => {
  // Insert records with different playedTime values (out of insertion order)
  await writer.insertRecord({
    uri: 'at://did:plc:abc/col/1',
    record: { playedTime: '2024-01-03T00:00:00Z', name: 'third' },
  });
  await writer.insertRecord({
    uri: 'at://did:plc:abc/col/2',
    record: { playedTime: '2024-01-01T00:00:00Z', name: 'first' },
  });
  await writer.insertRecord({
    uri: 'at://did:plc:abc/col/3',
    record: { playedTime: '2024-01-05T00:00:00Z', name: 'fifth' },
  });
  await writer.insertRecord({
    uri: 'at://did:plc:abc/col/4',
    record: { playedTime: '2024-01-02T00:00:00Z', name: 'second' },
  });
  await writer.insertRecord({
    uri: 'at://did:plc:abc/col/5',
    record: { playedTime: '2024-01-04T00:00:00Z', name: 'fourth' },
  });

  // Get first page sorted by playedTime DESC
  const first = await query({
    type: 'findMany',
    collection: 'col',
    where: [],
    sort: [{ field: 'playedTime', dir: 'desc' }],
    pagination: { first: 2 },
  });

  expect(first.rows).toHaveLength(2);
  expect(first.rows[0].name).toBe('fifth');  // 2024-01-05
  expect(first.rows[1].name).toBe('fourth'); // 2024-01-04
  expect(first.hasNext).toBe(true);

  // Build cursor from last row - this is what formatConnection does
  const lastRow = first.rows[1];
  const cursorValues = ['2024-01-04T00:00:00Z', lastRow.uri];
  const cursor = Buffer.from(cursorValues.join('|')).toString('base64');

  // Get second page
  const second = await query({
    type: 'findMany',
    collection: 'col',
    where: [],
    sort: [{ field: 'playedTime', dir: 'desc' }],
    pagination: { first: 2, after: cursor },
  });

  expect(second.rows).toHaveLength(2);
  expect(second.rows[0].name).toBe('third');  // 2024-01-03
  expect(second.rows[1].name).toBe('second'); // 2024-01-02
  expect(second.hasNext).toBe(true);

  // Get third page
  const lastRow2 = second.rows[1];
  const cursor2Values = ['2024-01-02T00:00:00Z', lastRow2.uri];
  const cursor2 = Buffer.from(cursor2Values.join('|')).toString('base64');

  const third = await query({
    type: 'findMany',
    collection: 'col',
    where: [],
    sort: [{ field: 'playedTime', dir: 'desc' }],
    pagination: { first: 2, after: cursor2 },
  });

  expect(third.rows).toHaveLength(1);
  expect(third.rows[0].name).toBe('first'); // 2024-01-01
  expect(third.hasNext).toBe(false);
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql-duckdb && npm test -- --grep "handles cursor pagination with custom sort field"`
Expected: FAIL - second page will have wrong records because cursor uses internal ID

**Step 3: Commit the failing test**

```bash
git add packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js
git commit -m "test(lex-gql-duckdb): add failing test for cursor pagination with custom sort

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Helper Functions for Cursor Handling

**Files:**
- Modify: `packages/lex-gql-duckdb/src/lex-gql-duckdb.js`

**Step 1: Add helper functions after SYSTEM_FIELDS (~line 200)**

```javascript
/**
 * Decode a sort-field-aware cursor
 * @param {string} cursor - Base64 encoded cursor
 * @param {Array<{field: string, dir?: string}>} sortFields - Sort configuration
 * @returns {{ fieldValues: string[], uri: string } | null}
 */
function decodeCursor(cursor, sortFields) {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString();
    const parts = decoded.split('|');
    const uri = parts.pop() || '';
    return { fieldValues: parts, uri };
  } catch {
    return null;
  }
}

/**
 * Get SQL comparison operator based on sort direction and cursor type
 * @param {string | undefined} direction - Sort direction ('asc' or 'desc')
 * @param {boolean} isBefore - Whether this is a 'before' cursor
 * @returns {string}
 */
function getComparisonOp(direction, isBefore) {
  const isDesc = direction?.toLowerCase() === 'desc';
  return isBefore ? (isDesc ? '>' : '<') : (isDesc ? '<' : '>');
}

/**
 * Get SQL expression for a field, handling system vs record fields
 * @param {string} field - Field name
 * @returns {string}
 */
function fieldToSqlExpr(field) {
  return SYSTEM_FIELDS[field] || `json_extract_string(r.record, '$.${field}')`;
}

/**
 * Build WHERE clause for cursor pagination with sort field awareness
 * @param {string} cursor - Base64 encoded cursor
 * @param {Array<{field: string, dir?: string}>} sortFields - Sort configuration
 * @param {boolean} isBefore - Whether this is a 'before' cursor
 * @returns {{ sql: string, params: any[] }}
 */
function buildCursorWhere(cursor, sortFields, isBefore) {
  // If no sort fields, fall back to default id-based behavior
  if (!sortFields || sortFields.length === 0) {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString());
      if (parsed.id) {
        return {
          sql: isBefore ? 'r.id > ?' : 'r.id < ?',
          params: [parsed.id],
        };
      }
    } catch {
      // Fall through to sort-field-aware decoding
    }
  }

  const decoded = decodeCursor(cursor, sortFields);
  if (!decoded || decoded.fieldValues.length === 0) {
    return { sql: '1=1', params: [] };
  }

  const clauses = [];
  const params = [];

  // Build progressive OR clauses for multi-field sort
  // For sort [A DESC, B ASC], after cursor [a_val, b_val, uri]:
  // (A < a_val) OR (A = a_val AND B > b_val) OR (A = a_val AND B = b_val AND uri < uri_val)
  for (let i = 0; i < sortFields.length; i++) {
    const clauseParts = [];
    const clauseParams = [];

    // Add equality for all prior fields
    for (let j = 0; j < i; j++) {
      clauseParts.push(`${fieldToSqlExpr(sortFields[j].field)} = ?`);
      clauseParams.push(decoded.fieldValues[j]);
    }

    // Add comparison for current field
    const op = getComparisonOp(sortFields[i].dir, isBefore);
    clauseParts.push(`${fieldToSqlExpr(sortFields[i].field)} ${op} ?`);
    clauseParams.push(decoded.fieldValues[i]);

    clauses.push(`(${clauseParts.join(' AND ')})`);
    params.push(...clauseParams);
  }

  // Final clause: all sort fields equal, compare by URI (tiebreaker)
  const allEqualParts = sortFields.map((s, i) => {
    return `${fieldToSqlExpr(s.field)} = ?`;
  });
  const lastDir = sortFields[sortFields.length - 1]?.dir || 'desc';
  const uriOp = getComparisonOp(lastDir, isBefore);
  allEqualParts.push(`r.uri ${uriOp} ?`);

  clauses.push(`(${allEqualParts.join(' AND ')})`);
  params.push(...decoded.fieldValues, decoded.uri);

  return { sql: `(${clauses.join(' OR ')})`, params };
}
```

**Step 2: Run existing tests to verify no breakage**

Run: `cd packages/lex-gql-duckdb && npm test`
Expected: PASS for existing tests (we haven't changed behavior yet)

**Step 3: Commit helper functions**

```bash
git add packages/lex-gql-duckdb/src/lex-gql-duckdb.js
git commit -m "feat(lex-gql-duckdb): add cursor pagination helper functions

- decodeCursor: parses sort-field-aware cursors
- getComparisonOp: determines < or > based on sort direction
- fieldToSqlExpr: maps field names to SQL expressions
- buildCursorWhere: builds progressive WHERE for cursor pagination

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update findMany to Use New Cursor Logic

**Files:**
- Modify: `packages/lex-gql-duckdb/src/lex-gql-duckdb.js:408-430`

**Step 1: Replace cursor handling in findMany**

Replace the cursor handling block (lines 408-430) with:

```javascript
  if (after) {
    const cursorWhere = buildCursorWhere(after, sort, false);
    if (cursorWhere.sql !== '1=1') {
      cursorConditions.push(cursorWhere.sql);
      cursorParams.push(...cursorWhere.params);
    }
  }

  if (before) {
    const cursorWhere = buildCursorWhere(before, sort, true);
    if (cursorWhere.sql !== '1=1') {
      cursorConditions.push(cursorWhere.sql);
      cursorParams.push(...cursorWhere.params);
    }
  }
```

**Step 2: Run new test to verify it passes**

Run: `cd packages/lex-gql-duckdb && npm test -- --grep "handles cursor pagination with custom sort field"`
Expected: PASS

**Step 3: Run all tests**

Run: `cd packages/lex-gql-duckdb && npm test`
Expected: PASS (including existing cursor test with default sort)

**Step 4: Commit**

```bash
git add packages/lex-gql-duckdb/src/lex-gql-duckdb.js
git commit -m "feat(lex-gql-duckdb): use sort-aware cursor pagination

Replace ID-based cursor handling with buildCursorWhere which respects
sort field values for correct pagination order.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update lex-gql formatConnection to Encode Sort Values

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.js:2143-2144` (pass sort to formatConnection)
- Modify: `packages/lex-gql/src/lex-gql.js:2434-2457` (update formatConnection)

**Step 1: Update formatConnection signature and implementation**

Change the function at line 2434:

```javascript
/**
 * Format query result as GraphQL connection
 * @param {{ rows: any[], hasNext: boolean, hasPrev: boolean, totalCount: number }} result
 * @param {Array<{field: string, dir?: string}>} [sortBy] - Sort configuration for cursor encoding
 * @returns {Object}
 */
function formatConnection(result, sortBy = []) {
  const { rows, hasNext, hasPrev, totalCount } = result;

  /**
   * Create cursor encoding sort field values + uri as tiebreaker
   * @param {any} row
   */
  const makeCursor = (row) => {
    if (!row) return null;

    // If no sort specified, fall back to legacy id-based cursor for backwards compatibility
    if (!sortBy || sortBy.length === 0) {
      return Buffer.from(JSON.stringify({ id: row._id, uri: row.uri })).toString('base64');
    }

    // Encode sort field values + uri as tiebreaker
    const values = sortBy.map(s => String(row[s.field] ?? ''));
    values.push(row.uri);
    return Buffer.from(values.join('|')).toString('base64');
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
```

**Step 2: Pass sortBy to formatConnection**

Change line 2144 from:
```javascript
return formatConnection(result);
```
to:
```javascript
return formatConnection(result, operation.sort);
```

**Step 3: Run lex-gql tests**

Run: `cd packages/lex-gql && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/lex-gql/src/lex-gql.js
git commit -m "feat(lex-gql): encode sort field values in cursors

formatConnection now encodes actual sort field values in cursors
instead of just internal IDs, enabling correct pagination with
custom sort orders.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Test for Duplicate Records During Sorted Pagination

**Files:**
- Modify: `packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js`

**Step 1: Add test to verify no duplicates across pages**

```javascript
it('does not produce duplicate records when paginating with custom sort', async () => {
  // Insert 10 records with varying timestamps
  const timestamps = [
    '2024-01-10T00:00:00Z',
    '2024-01-09T00:00:00Z',
    '2024-01-08T00:00:00Z',
    '2024-01-07T00:00:00Z',
    '2024-01-06T00:00:00Z',
    '2024-01-05T00:00:00Z',
    '2024-01-04T00:00:00Z',
    '2024-01-03T00:00:00Z',
    '2024-01-02T00:00:00Z',
    '2024-01-01T00:00:00Z',
  ];

  // Insert in random order
  const insertOrder = [4, 7, 1, 9, 2, 5, 0, 8, 3, 6];
  for (const i of insertOrder) {
    await writer.insertRecord({
      uri: `at://did:plc:abc/col/${i}`,
      record: { playedTime: timestamps[i], index: i },
    });
  }

  const allUris = new Set();
  let cursor = null;

  // Paginate through all records
  for (let page = 0; page < 5; page++) {
    const result = await query({
      type: 'findMany',
      collection: 'col',
      where: [],
      sort: [{ field: 'playedTime', dir: 'desc' }],
      pagination: { first: 3, after: cursor },
    });

    // Check for duplicates
    for (const row of result.rows) {
      expect(allUris.has(row.uri)).toBe(false);
      allUris.add(row.uri);
    }

    if (!result.hasNext) break;

    // Build cursor for next page
    const lastRow = result.rows[result.rows.length - 1];
    const cursorValues = [lastRow.playedTime, lastRow.uri];
    cursor = Buffer.from(cursorValues.join('|')).toString('base64');
  }

  // Verify we got all records
  expect(allUris.size).toBe(10);
});
```

**Step 2: Run test**

Run: `cd packages/lex-gql-duckdb && npm test -- --grep "does not produce duplicate records"`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js
git commit -m "test(lex-gql-duckdb): verify no duplicates in sorted pagination

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Test for Backwards Pagination (before cursor)

**Files:**
- Modify: `packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js`

**Step 1: Add test for before cursor with custom sort**

```javascript
it('handles before cursor with custom sort field', async () => {
  // Insert records
  for (let i = 1; i <= 5; i++) {
    await writer.insertRecord({
      uri: `at://did:plc:abc/col/${i}`,
      record: { playedTime: `2024-01-0${i}T00:00:00Z`, name: `item${i}` },
    });
  }

  // Start from the middle: item3 (2024-01-03)
  const cursor = Buffer.from(['2024-01-03T00:00:00Z', 'at://did:plc:abc/col/3'].join('|')).toString('base64');

  // Get records BEFORE item3 (should be item4, item5 in DESC order)
  const result = await query({
    type: 'findMany',
    collection: 'col',
    where: [],
    sort: [{ field: 'playedTime', dir: 'desc' }],
    pagination: { last: 2, before: cursor },
  });

  expect(result.rows).toHaveLength(2);
  expect(result.rows[0].name).toBe('item5'); // 2024-01-05
  expect(result.rows[1].name).toBe('item4'); // 2024-01-04
});
```

**Step 2: Run test**

Run: `cd packages/lex-gql-duckdb && npm test -- --grep "handles before cursor"`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/lex-gql-duckdb/test/lex-gql-duckdb.test.js
git commit -m "test(lex-gql-duckdb): add before cursor test with custom sort

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Manual Verification with Relay Example

**Files:**
- None (manual testing)

**Step 1: Start the relay example**

Run: `cd examples/relay && pnpm dev`

**Step 2: Test pagination**

1. Open http://localhost:4000 in browser
2. Scroll down slowly to trigger pagination
3. Verify no duplicate tracks appear
4. Note track order is maintained (newest first)

**Step 3: Test subscriptions + pagination interaction**

1. Keep scrolling to load more pages
2. Wait for new subscription events to appear at top
3. Continue scrolling - verify no duplicates appear

**Step 4: Document any issues found**

If issues are found, create additional test cases and fix before proceeding.

---

## Task 8: Update TypeScript Definitions

**Files:**
- Modify: `packages/lex-gql-duckdb/src/lex-gql-duckdb.d.ts`

**Step 1: Add type definitions for new functions**

Add after the existing type definitions (~line 54):

```typescript
/**
 * Decode a sort-field-aware cursor
 */
export function decodeCursor(cursor: string, sortFields: Array<{field: string; dir?: string}>): { fieldValues: string[]; uri: string } | null;

/**
 * Get SQL comparison operator based on sort direction and cursor type
 */
export function getComparisonOp(direction: string | undefined, isBefore: boolean): string;

/**
 * Get SQL expression for a field
 */
export function fieldToSqlExpr(field: string): string;

/**
 * Build WHERE clause for cursor pagination
 */
export function buildCursorWhere(cursor: string, sortFields: Array<{field: string; dir?: string}>, isBefore: boolean): { sql: string; params: any[] };
```

**Step 2: Commit**

```bash
git add packages/lex-gql-duckdb/src/lex-gql-duckdb.d.ts
git commit -m "chore(lex-gql-duckdb): add type definitions for cursor helpers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Final Integration Test and Cleanup

**Step 1: Run all package tests**

Run: `cd packages/lex-gql && npm test && cd ../lex-gql-duckdb && npm test`
Expected: All PASS

**Step 2: Run relay example build**

Run: `cd examples/relay && pnpm build`
Expected: Success

**Step 3: Final commit summarizing the feature**

```bash
git add -A
git commit -m "feat: sort-field-aware cursor pagination

Fixes cursor-based pagination to work correctly with custom sort orders.
Previously, cursors used internal row IDs which only worked for insertion
order. Now cursors encode actual sort field values, enabling correct
pagination regardless of sort configuration.

Changes:
- lex-gql: formatConnection encodes sort field values in cursors
- lex-gql-duckdb: buildCursorWhere builds progressive WHERE clauses

Fixes duplicate records when paginating sorted results.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Verification Checklist

- [ ] New pagination test passes with custom sort
- [ ] No duplicate records test passes
- [ ] Before cursor test passes
- [ ] Existing cursor pagination tests still pass
- [ ] lex-gql tests pass
- [ ] Relay example shows no duplicates when scrolling
- [ ] Subscriptions + pagination work together correctly
