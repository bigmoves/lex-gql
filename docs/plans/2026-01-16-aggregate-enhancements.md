# Aggregate Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add date interval grouping and configurable limit/orderBy to aggregate queries for slices-relay compatibility.

**Architecture:** lex-gql generates the GraphQL schema with new `limit` and `orderBy` args, passing them to the query adapter. lex-gql-sqlite parses date interval suffixes (`_day`, `_week`, `_month`) and uses SQLite date functions. Defaults: limit=50 (max 1000), orderBy=COUNT_DESC.

**Tech Stack:** JavaScript, SQLite (better-sqlite3), GraphQL

---

### Task 1: Date Interval Grouping in lex-gql-sqlite

**Files:**
- Modify: `packages/lex-gql-sqlite/src/lex-gql-sqlite.js:325-367`
- Test: `packages/lex-gql-sqlite/test/lex-gql-sqlite.test.js`

**Step 1: Write the failing test for day grouping**

Add to `test/lex-gql-sqlite.test.js` inside the `aggregate` describe block:

```javascript
it('groups by day interval', async () => {
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/1',
    record: { playedTime: '2024-01-15T10:00:00Z' },
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/2',
    record: { playedTime: '2024-01-15T22:00:00Z' },
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/3',
    record: { playedTime: '2024-01-16T08:00:00Z' },
  });

  const result = await query({
    type: 'aggregate',
    collection: 'col',
    where: [],
    groupBy: ['playedTime_day'],
  });

  expect(result.count).toBe(3);
  expect(result.groups).toHaveLength(2);
  expect(result.groups.find((g) => g.playedTime_day === '2024-01-15').count).toBe(2);
  expect(result.groups.find((g) => g.playedTime_day === '2024-01-16').count).toBe(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "groups by day interval"`
Expected: FAIL - groups have wrong keys or values

**Step 3: Implement date interval parsing**

In `src/lex-gql-sqlite.js`, add helper function before `aggregate()` (around line 320):

```javascript
/**
 * Get SQL expression for a groupBy field, handling date interval suffixes
 * @param {string} field
 * @returns {{ expr: string, alias: string }}
 */
function getGroupByExpression(field) {
  const dayMatch = field.match(/^(.+)_day$/);
  const weekMatch = field.match(/^(.+)_week$/);
  const monthMatch = field.match(/^(.+)_month$/);

  if (dayMatch) {
    const base = dayMatch[1];
    const path = SYSTEM_FIELDS[base] || `json_extract(r.record, '$.${base}')`;
    return { expr: `date(${path})`, alias: field };
  }
  if (weekMatch) {
    const base = weekMatch[1];
    const path = SYSTEM_FIELDS[base] || `json_extract(r.record, '$.${base}')`;
    return { expr: `strftime('%Y-%W', ${path})`, alias: field };
  }
  if (monthMatch) {
    const base = monthMatch[1];
    const path = SYSTEM_FIELDS[base] || `json_extract(r.record, '$.${base}')`;
    return { expr: `strftime('%Y-%m', ${path})`, alias: field };
  }

  const expr = SYSTEM_FIELDS[field] || `json_extract(r.record, '$.${field}')`;
  return { expr, alias: field };
}
```

**Step 4: Update aggregate() to use the helper**

Replace the `groupFields` and `groupByClause` logic (lines 340-351) with:

```javascript
  const groupExpressions = groupBy.map((/** @type {string} */ f) => getGroupByExpression(f));

  const groupFields = groupExpressions
    .map(({ expr, alias }) => `${expr} as ${alias}`)
    .join(', ');

  const groupByClause = groupExpressions
    .map(({ expr }) => expr)
    .join(', ');
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --grep "groups by day interval"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lex-gql-sqlite.js test/lex-gql-sqlite.test.js
git commit -m "feat(lex-gql-sqlite): add date interval grouping for aggregates"
```

---

### Task 2: Week and Month Interval Tests

**Files:**
- Test: `packages/lex-gql-sqlite/test/lex-gql-sqlite.test.js`

**Step 1: Write the failing test for week grouping**

```javascript
it('groups by week interval', async () => {
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/1',
    record: { playedTime: '2024-01-01T10:00:00Z' }, // Week 01
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/2',
    record: { playedTime: '2024-01-03T10:00:00Z' }, // Week 01
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/3',
    record: { playedTime: '2024-01-08T10:00:00Z' }, // Week 02
  });

  const result = await query({
    type: 'aggregate',
    collection: 'col',
    where: [],
    groupBy: ['playedTime_week'],
  });

  expect(result.count).toBe(3);
  expect(result.groups).toHaveLength(2);
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --grep "groups by week interval"`
Expected: PASS (implementation already done in Task 1)

**Step 3: Write the test for month grouping**

```javascript
it('groups by month interval', async () => {
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/1',
    record: { playedTime: '2024-01-15T10:00:00Z' },
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/2',
    record: { playedTime: '2024-01-20T10:00:00Z' },
  });
  writer.insertRecord({
    uri: 'at://did:plc:alice/col/3',
    record: { playedTime: '2024-02-05T10:00:00Z' },
  });

  const result = await query({
    type: 'aggregate',
    collection: 'col',
    where: [],
    groupBy: ['playedTime_month'],
  });

  expect(result.count).toBe(3);
  expect(result.groups).toHaveLength(2);
  expect(result.groups.find((g) => g.playedTime_month === '2024-01').count).toBe(2);
  expect(result.groups.find((g) => g.playedTime_month === '2024-02').count).toBe(1);
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --grep "groups by month interval"`
Expected: PASS

**Step 5: Commit**

```bash
git add test/lex-gql-sqlite.test.js
git commit -m "test(lex-gql-sqlite): add week and month interval grouping tests"
```

---

### Task 3: Configurable Limit in lex-gql-sqlite

**Files:**
- Modify: `packages/lex-gql-sqlite/src/lex-gql-sqlite.js:325-367`
- Test: `packages/lex-gql-sqlite/test/lex-gql-sqlite.test.js`

**Step 1: Write the failing test for custom limit**

```javascript
it('respects custom limit', async () => {
  // Create 5 distinct groups
  for (let i = 0; i < 5; i++) {
    writer.insertRecord({
      uri: `at://did:plc:alice/col/${i}`,
      record: { category: `cat${i}` },
    });
  }

  const result = await query({
    type: 'aggregate',
    collection: 'col',
    where: [],
    groupBy: ['category'],
    limit: 3,
  });

  expect(result.groups).toHaveLength(3);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "respects custom limit"`
Expected: FAIL - returns all 5 groups (hardcoded limit 100)

**Step 3: Update aggregate() to accept limit parameter**

In `aggregate()` function, update the destructuring and SQL:

```javascript
function aggregate(db, op) {
  const { collection, where = [], groupBy = [], limit = 50 } = op;

  // Cap limit at 1000
  const effectiveLimit = Math.min(limit, 1000);

  // ... existing where building code ...

  if (groupBy.length === 0) {
    // ... existing count-only code unchanged ...
  }

  // ... existing groupExpressions code ...

  const sql = `
    SELECT ${groupFields}, COUNT(*) as count
    FROM records r
    WHERE ${whereSql}
    GROUP BY ${groupByClause}
    ORDER BY count DESC
    LIMIT ?
  `;

  /** @type {Array<{count: number, [key: string]: any}>} */
  const groups = /** @type {any} */ (db.prepare(sql).all(...params, effectiveLimit));
  const count = groups.reduce((sum, g) => sum + g.count, 0);

  return { count, groups };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --grep "respects custom limit"`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lex-gql-sqlite.js test/lex-gql-sqlite.test.js
git commit -m "feat(lex-gql-sqlite): add configurable limit for aggregates"
```

---

### Task 4: Configurable OrderBy in lex-gql-sqlite

**Files:**
- Modify: `packages/lex-gql-sqlite/src/lex-gql-sqlite.js`
- Test: `packages/lex-gql-sqlite/test/lex-gql-sqlite.test.js`

**Step 1: Write the failing test for ascending order**

```javascript
it('supports ascending count order', async () => {
  writer.insertRecord({ uri: 'at://did:plc:alice/col/1', record: { cat: 'a' } });
  writer.insertRecord({ uri: 'at://did:plc:alice/col/2', record: { cat: 'a' } });
  writer.insertRecord({ uri: 'at://did:plc:alice/col/3', record: { cat: 'a' } });
  writer.insertRecord({ uri: 'at://did:plc:alice/col/4', record: { cat: 'b' } });

  const result = await query({
    type: 'aggregate',
    collection: 'col',
    where: [],
    groupBy: ['cat'],
    orderBy: 'COUNT_ASC',
  });

  expect(result.groups[0].cat).toBe('b'); // count 1 first
  expect(result.groups[1].cat).toBe('a'); // count 3 second
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "supports ascending count order"`
Expected: FAIL - 'a' comes first (hardcoded DESC)

**Step 3: Update aggregate() to accept orderBy parameter**

```javascript
function aggregate(db, op) {
  const { collection, where = [], groupBy = [], limit = 50, orderBy = 'COUNT_DESC' } = op;

  // ... existing code ...

  const orderDirection = orderBy === 'COUNT_ASC' ? 'ASC' : 'DESC';

  const sql = `
    SELECT ${groupFields}, COUNT(*) as count
    FROM records r
    WHERE ${whereSql}
    GROUP BY ${groupByClause}
    ORDER BY count ${orderDirection}
    LIMIT ?
  `;

  // ... rest unchanged ...
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --grep "supports ascending count order"`
Expected: PASS

**Step 5: Run all tests**

Run: `npm test`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/lex-gql-sqlite.js test/lex-gql-sqlite.test.js
git commit -m "feat(lex-gql-sqlite): add configurable orderBy for aggregates"
```

---

### Task 5: Add limit/orderBy Args to lex-gql Schema

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.js:2090-2111`
- Test: `packages/lex-gql/test/lex-gql.test.js`

**Step 1: Write the failing test**

Add to `test/lex-gql.test.js`:

```javascript
it('aggregate queries include limit and orderBy args', async () => {
  const { printSchema } = await import('graphql');
  const schema = buildSchemaWithResolvers(lexicons, () => {}, async () => ({}));
  const printed = printSchema(schema);

  expect(printed).toContain('limit: Int');
  expect(printed).toContain('orderBy: AggregateOrderBy');
  expect(printed).toContain('enum AggregateOrderBy');
  expect(printed).toContain('COUNT_ASC');
  expect(printed).toContain('COUNT_DESC');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --grep "aggregate queries include limit"`
Expected: FAIL - args not found in schema

**Step 3: Create AggregateOrderBy enum**

Add near the top of `lex-gql.js` (around line 150, with other enum definitions):

```javascript
const AggregateOrderByEnum = new GraphQLEnumType({
  name: 'AggregateOrderBy',
  description: 'Order direction for aggregate count',
  values: {
    COUNT_ASC: { value: 'COUNT_ASC', description: 'Ascending by count' },
    COUNT_DESC: { value: 'COUNT_DESC', description: 'Descending by count (default)' },
  },
});
```

**Step 4: Add args to aggregate query field**

In `buildSchemaWithResolvers()` around line 2090, update the args:

```javascript
queryFields[aggregateFieldName] = {
  type: aggregateResultType,
  args: {
    where: { type: whereInputTypes[typeName] },
    groupBy: { type: new GraphQLList(groupByEnum) },
    limit: { type: GraphQLInt, description: 'Maximum number of groups (default: 50, max: 1000)' },
    orderBy: { type: AggregateOrderByEnum, description: 'Order by count (default: COUNT_DESC)' },
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
    };
    return await queryFn(operation);
  },
};
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --grep "aggregate queries include limit"`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lex-gql.js test/lex-gql.test.js
git commit -m "feat(lex-gql): add limit and orderBy args to aggregate queries"
```

---

### Task 6: Update Type Definitions

**Files:**
- Modify: `packages/lex-gql/src/lex-gql.d.ts`
- Modify: `packages/lex-gql-sqlite/src/lex-gql-sqlite.d.ts`

**Step 1: Update lex-gql Operation type**

In `packages/lex-gql/src/lex-gql.d.ts`, find the Operation type and add:

```typescript
export interface Operation {
  type: 'findMany' | 'findOne' | 'count' | 'aggregate' | 'create' | 'update' | 'delete';
  collection: string;
  where?: WhereClause[];
  select?: string[];
  sort?: SortClause[];
  pagination?: Pagination;
  data?: Record<string, unknown>;
  uri?: string;
  rkey?: string;
  groupBy?: string[];
  aggregates?: Aggregate[];
  limit?: number;
  orderBy?: 'COUNT_ASC' | 'COUNT_DESC';
}
```

**Step 2: Commit**

```bash
git add packages/lex-gql/src/lex-gql.d.ts packages/lex-gql-sqlite/src/lex-gql-sqlite.d.ts
git commit -m "chore: update type definitions for aggregate limit/orderBy"
```

---

### Task 7: Final Verification

**Step 1: Run all tests in both packages**

```bash
cd packages/lex-gql && npm test
cd ../lex-gql-sqlite && npm test
```

Expected: All tests PASS

**Step 2: Regenerate test schema and verify**

```bash
cd packages/lex-gql
npm run test
cat test/generated-schema.graphql | grep -A5 "Aggregated("
```

Expected: See `limit: Int` and `orderBy: AggregateOrderBy` in aggregate query args

**Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, done. If changes, commit them.
```
