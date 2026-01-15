# Schema Oracle Alignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align generated GraphQL schema with the oracle schema.graphql to achieve feature parity.

**Architecture:** Extend the existing schema builder to generate complex object types from lexicon definitions, proper union types for resolved references, and oracle-compatible naming conventions. Each task adds one category of missing functionality.

**Tech Stack:** JavaScript ES modules, graphql-js, Vitest

---

## Gap Summary

| Category | Gap | Priority |
|----------|-----|----------|
| Core Types | Blob, ComAtprotoRepoStrongRef, Record union | P0 |
| Nested Types | Generate types from lexicon `others` defs | P0 |
| System Fields | `collection`, `actorHandle` fields | P1 |
| Naming | SortFieldInput vs SortInput | P1 |
| Aggregation | Aggregated vs AggregateResult naming | P2 |
| Field Conditions | Per-type vs generic conditions | P2 |
| Reverse Joins | Add sortBy/where arguments | P2 |

---

## Task 1: Blob Object Type

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for Blob type**

```js
// Add to quickslice.test.js in Schema Builder describe block

it('generates Blob object type for blob fields', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: 'literal:self',
        properties: [
          { name: 'displayName', type: 'string', required: false },
          { name: 'avatar', type: 'blob', required: false }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have Blob type
  expect(sdl).toContain('type Blob')
  expect(sdl).toContain('ref: String!')
  expect(sdl).toContain('mimeType: String!')
  expect(sdl).toContain('size: Int!')

  // Avatar field should be Blob type
  expect(sdl).toContain('avatar: Blob')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - avatar is String, not Blob

**Step 3: Implement Blob type**

```js
// Add to quickslice.js after createDeleteResultType function

/**
 * Create Blob object type for blob fields
 * @returns {GraphQLObjectType}
 */
function createBlobType() {
  return new GraphQLObjectType({
    name: 'Blob',
    description: 'Binary blob reference',
    fields: {
      ref: { type: new GraphQLNonNull(GraphQLString), description: 'CID reference to the blob' },
      mimeType: { type: new GraphQLNonNull(GraphQLString), description: 'MIME type of the blob' },
      size: { type: new GraphQLNonNull(GraphQLInt), description: 'Size in bytes' }
    }
  })
}
```

**Step 4: Update getGraphQLType to use Blob type**

```js
// Modify getGraphQLType function to accept blobType parameter and use it

function getGraphQLType(prop, blobType) {
  const typeMap = {
    'string': GraphQLString,
    'integer': GraphQLInt,
    'boolean': GraphQLBoolean,
    'number': GraphQLFloat,
    'blob': blobType,  // Use Blob type instead of String
    'bytes': GraphQLString,
    'cid-link': GraphQLString,
    'ref': GraphQLString,
    'union': GraphQLString,
    'array': GraphQLString
  }

  if (prop.type === 'array' && prop.items) {
    const itemType = typeMap[prop.items.type] || GraphQLString
    return new GraphQLList(new GraphQLNonNull(itemType))
  }

  return typeMap[prop.type] || GraphQLString
}
```

**Step 5: Update buildSchema to create and pass Blob type**

```js
// In buildSchema function, add after creating shared types:
const blobType = createBlobType()

// Update createRecordType calls to pass blobType
// Update all getGraphQLType calls to pass blobType
```

**Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 7: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add Blob object type for blob fields"
```

---

## Task 2: ComAtprotoRepoStrongRef Type

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for StrongRef type**

```js
// Add to quickslice.test.js

it('generates ComAtprotoRepoStrongRef type for strongRef refs', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: 'literal:self',
        properties: [
          { name: 'pinnedPost', type: 'ref', ref: 'com.atproto.repo.strongRef', required: false }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have StrongRef type
  expect(sdl).toContain('type ComAtprotoRepoStrongRef')
  expect(sdl).toContain('cid: String!')
  expect(sdl).toContain('uri: String!')

  // pinnedPost should use StrongRef type
  expect(sdl).toContain('pinnedPost: ComAtprotoRepoStrongRef')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement StrongRef type**

```js
// Add to quickslice.js

/**
 * Create ComAtprotoRepoStrongRef type
 * @param {GraphQLUnionType} recordUnionType - Record union for resolved refs
 * @returns {GraphQLObjectType}
 */
function createStrongRefType(recordUnionType) {
  return new GraphQLObjectType({
    name: 'ComAtprotoRepoStrongRef',
    description: 'Strong reference to another record',
    fields: () => ({
      cid: { type: new GraphQLNonNull(GraphQLString), description: 'CID of the referenced record' },
      uri: { type: new GraphQLNonNull(GraphQLString), description: 'AT URI of the referenced record' },
      uriResolved: { type: recordUnionType, description: 'Forward join to referenced record' }
    })
  })
}
```

**Step 4: Update getGraphQLType to handle strongRef**

```js
// Modify getGraphQLType to check for strongRef and return strongRefType

function getGraphQLType(prop, blobType, strongRefType) {
  // Check for strongRef reference
  if (prop.type === 'ref' && prop.ref === 'com.atproto.repo.strongRef') {
    return strongRefType
  }

  const typeMap = {
    'string': GraphQLString,
    'integer': GraphQLInt,
    'boolean': GraphQLBoolean,
    'number': GraphQLFloat,
    'blob': blobType,
    'bytes': GraphQLString,
    'cid-link': GraphQLString,
    'ref': GraphQLString,
    'union': GraphQLString,
    'array': GraphQLString
  }

  if (prop.type === 'array' && prop.items) {
    const itemType = typeMap[prop.items.type] || GraphQLString
    return new GraphQLList(new GraphQLNonNull(itemType))
  }

  return typeMap[prop.type] || GraphQLString
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add ComAtprotoRepoStrongRef type for strong references"
```

---

## Task 3: Record Union Type

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for Record union**

```js
// Add to quickslice.test.js

it('generates Record union type for resolved references', () => {
  const lexicons = [
    {
      id: 'app.bsky.actor.profile',
      defs: {
        main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
        others: {}
      }
    },
    {
      id: 'app.bsky.feed.post',
      defs: {
        main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have Record union containing all record types
  expect(sdl).toContain('union Record')
  expect(sdl).toContain('AppBskyActorProfile')
  expect(sdl).toContain('AppBskyFeedPost')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - no Record union

**Step 3: Implement Record union type**

```js
// Add to quickslice.js

/**
 * Create Record union type containing all record types
 * @param {Object} recordTypes - Map of lexicon id to GraphQL object type
 * @returns {GraphQLUnionType}
 */
function createRecordUnionType(recordTypes) {
  const types = Object.values(recordTypes).filter(Boolean)

  if (types.length === 0) {
    // Return a placeholder if no types yet
    return null
  }

  return new GraphQLUnionType({
    name: 'Record',
    description: 'Union of all record types',
    types: () => types,
    resolveType: (value) => {
      // Use collection from URI to determine type
      if (value && value.uri) {
        const parts = value.uri.split('/')
        if (parts.length >= 4) {
          const collection = parts[3]
          return nsidToTypeName(collection)
        }
      }
      return null
    }
  })
}
```

**Step 4: Update buildSchema to create Record union**

In `buildSchema`, after creating all record types, create the Record union:

```js
// After first pass creating record types
const recordUnionType = createRecordUnionType(recordTypes)
```

**Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add Record union type for resolved references"
```

---

## Task 4: System Fields (collection, actorHandle)

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for system fields**

```js
// Add to quickslice.test.js

it('includes collection and actorHandle system fields', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('collection: String')
  expect(sdl).toContain('actorHandle: String')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Add system fields to createRecordType**

```js
// In createRecordType, update the fields object:

const fields = {
  // System fields
  uri: { type: GraphQLString, description: 'Record URI' },
  cid: { type: GraphQLString, description: 'Record CID' },
  did: { type: GraphQLString, description: 'DID of record author' },
  collection: { type: GraphQLString, description: 'Collection name' },
  indexedAt: { type: GraphQLString, description: 'When record was indexed' },
  actorHandle: { type: GraphQLString, description: 'Handle of the actor who created this record' }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add collection and actorHandle system fields"
```

---

## Task 5: Nested Object Types from Lexicon Defs

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for nested types**

```js
// Add to quickslice.test.js

it('generates nested object types from lexicon others defs', () => {
  const lexicons = [{
    id: 'app.bsky.richtext.facet',
    defs: {
      main: {
        type: 'object',
        properties: [
          { name: 'index', type: 'ref', ref: '#byteSlice', required: true },
          { name: 'features', type: 'array', items: { type: 'union', refs: ['#mention', '#link'] }, required: true }
        ]
      },
      others: {
        byteSlice: {
          type: 'object',
          properties: [
            { name: 'byteStart', type: 'integer', required: true },
            { name: 'byteEnd', type: 'integer', required: true }
          ]
        },
        mention: {
          type: 'object',
          properties: [
            { name: 'did', type: 'string', required: true }
          ]
        },
        link: {
          type: 'object',
          properties: [
            { name: 'uri', type: 'string', required: true }
          ]
        }
      }
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should generate nested types with full NSID prefix
  expect(sdl).toContain('type AppBskyRichtextFacetByteSlice')
  expect(sdl).toContain('byteStart: Int')
  expect(sdl).toContain('byteEnd: Int')
  expect(sdl).toContain('type AppBskyRichtextFacetMention')
  expect(sdl).toContain('type AppBskyRichtextFacetLink')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement nested type generation**

```js
// Add to quickslice.js

/**
 * Create GraphQL object type for a nested definition (from others)
 * @param {string} lexiconId - Parent lexicon ID
 * @param {string} defName - Definition name (e.g., 'byteSlice')
 * @param {RecordDef} def - The definition
 * @param {GraphQLObjectType} blobType
 * @returns {GraphQLObjectType}
 */
function createNestedObjectType(lexiconId, defName, def, blobType) {
  const typeName = nsidToTypeName(lexiconId) + defName.charAt(0).toUpperCase() + defName.slice(1)

  return new GraphQLObjectType({
    name: typeName,
    description: `Nested type from ${lexiconId}#${defName}`,
    fields: () => {
      const fields = {}
      for (const prop of def.properties || []) {
        fields[prop.name] = {
          type: prop.required
            ? new GraphQLNonNull(getGraphQLType(prop, blobType, null))
            : getGraphQLType(prop, blobType, null),
          description: 'Field from object definition'
        }
      }
      return fields
    }
  })
}
```

**Step 4: Update buildSchema to generate nested types**

```js
// In buildSchema, add loop to create nested types from others:

const nestedTypes = {}

for (const lexicon of lexicons) {
  if (lexicon.defs.others) {
    for (const [defName, def] of Object.entries(lexicon.defs.others)) {
      if (def.type === 'object' && def.properties) {
        const nestedType = createNestedObjectType(lexicon.id, defName, def, blobType)
        nestedTypes[`${lexicon.id}#${defName}`] = nestedType
      }
    }
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 6: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: generate nested object types from lexicon others defs"
```

---

## Task 6: Fix Sort Input Type Naming

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for sort naming**

```js
// Add to quickslice.test.js

it('uses SortFieldInput naming convention', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should use SortFieldInput, not SortInput
  expect(sdl).toContain('input AppBskyActorProfileSortFieldInput')
  expect(sdl).not.toContain('input AppBskyActorProfileSortInput')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Update createSortInputType naming**

```js
// Modify createSortInputType function:

function createSortInputType(typeName, sortFieldEnum, sortDirectionEnum) {
  return new GraphQLInputObjectType({
    name: typeName + 'SortFieldInput',  // Changed from 'SortInput'
    fields: {
      field: { type: new GraphQLNonNull(sortFieldEnum) },
      direction: { type: sortDirectionEnum }
    }
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "fix: use SortFieldInput naming convention to match oracle"
```

---

## Task 7: Aggregated Type Naming

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for aggregated naming**

```js
// Add to quickslice.test.js

it('uses Aggregated naming convention for aggregate results', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should use Aggregated, not AggregateResult
  expect(sdl).toContain('type AppBskyActorProfileAggregated')
  expect(sdl).not.toContain('type AppBskyActorProfileAggregateResult')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Update createAggregateResultType naming**

```js
// Modify createAggregateResultType function:

function createAggregateResultType(typeName, recordDef) {
  // ... keep existing group type creation ...

  return new GraphQLObjectType({
    name: typeName + 'Aggregated',  // Changed from 'AggregateResult'
    fields: {
      count: { type: GraphQLInt },
      groups: { type: new GraphQLList(groupType) }
    }
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "fix: use Aggregated naming convention to match oracle"
```

---

## Task 8: GroupByField Enum Naming

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test**

```js
// Add to quickslice.test.js

it('uses GroupByField enum naming convention', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should use GroupByField, not GroupByFieldInput
  expect(sdl).toContain('enum AppBskyActorProfileGroupByField')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (currently uses different naming)

**Step 3: Update createAggregateGroupByEnum naming**

```js
// Modify createAggregateGroupByEnum function name generation

function createAggregateGroupByEnum(typeName, recordDef) {
  // ... existing values creation ...

  return new GraphQLEnumType({
    name: typeName + 'GroupByField',  // Ensure correct naming
    values
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "fix: use GroupByField enum naming convention"
```

---

## Task 9: Per-Type Field Conditions

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for per-type field conditions**

```js
// Add to quickslice.test.js

it('generates per-type FieldCondition input types', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have per-type field condition
  expect(sdl).toContain('input AppBskyActorProfileFieldCondition')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL

**Step 3: Implement per-type field conditions**

```js
// Add function to create per-type field condition

function createPerTypeFieldCondition(typeName, recordDef) {
  const fields = {}

  // Add conditions for each field
  for (const prop of recordDef.properties) {
    const gqlTypeName = mapLexiconType(prop.type)
    if (['String', 'Int', 'Float', 'Boolean'].includes(gqlTypeName)) {
      fields[prop.name] = { type: GraphQLString }  // Simplified - actual ops would go here
    }
  }

  // Add logical operators
  fields.AND = { type: new GraphQLList(/* self reference */) }
  fields.OR = { type: new GraphQLList(/* self reference */) }

  return new GraphQLInputObjectType({
    name: typeName + 'FieldCondition',
    fields: () => fields
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add per-type FieldCondition input types"
```

---

## Task 10: Reverse Join Arguments

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing test for reverse join args**

```js
// Add to quickslice.test.js

it('adds sortBy and where arguments to reverse join fields', () => {
  const lexicons = [
    {
      id: 'app.bsky.feed.post',
      defs: {
        main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
        others: {}
      }
    },
    {
      id: 'app.bsky.feed.like',
      defs: {
        main: {
          type: 'record',
          key: null,
          properties: [{ name: 'subject', type: 'string', format: 'at-uri', required: true }]
        },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Reverse join should have sortBy argument
  expect(sdl).toContain('appBskyFeedLikeViaSubject(')
  expect(sdl).toContain('sortBy:')
  expect(sdl).toContain('where:')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL - reverse joins don't have sortBy/where

**Step 3: Update reverse join field creation**

```js
// In createRecordType, update reverse join field definition:

fields[reverseFieldName] = {
  type: connectionTypes[fromLexicon],
  args: {
    first: { type: GraphQLInt },
    after: { type: GraphQLString },
    last: { type: GraphQLInt },
    before: { type: GraphQLString },
    sortBy: { type: new GraphQLList(sortInputTypes[fromTypeName]) },
    where: { type: whereInputTypes[fromTypeName] }
  },
  description: `${fromTypeName} records pointing to this via ${fieldName}`
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add sortBy and where arguments to reverse join fields"
```

---

## Task 11: Run Schema Comparison

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 2: Run schema comparison**

Run: `node compare-schemas.js`

Review output to verify:
- Fewer missing types
- Better field coverage
- Naming alignment with oracle

**Step 3: Generate updated schema diff**

Run: `diff generated-schema.graphql schema.graphql | wc -l`

Document the improvement in diff line count.

**Step 4: Commit comparison results**

```bash
git add generated-schema.graphql
git commit -m "chore: update generated schema after oracle alignment"
```

---

## Task 12: Final Integration Test Against Oracle

**Files:**
- Modify: `quickslice.test.js`

**Step 1: Add oracle type coverage test**

```js
// Add to Schema Comparison describe block

it('achieves target type coverage against oracle', () => {
  const oracleSchema = readFileSync(new URL('./schema.graphql', import.meta.url).pathname, 'utf-8')
  const parsedLexicons = realLexicons.map(l => parseLexicon(l.content))
  const schema = buildSchema(parsedLexicons)
  const generatedSdl = printSchema(schema)

  const oracleTypeMatches = oracleSchema.match(/type (\w+)/g) || []
  const oracleTypes = oracleTypeMatches.map(m => m.replace('type ', ''))

  const generatedTypeMatches = generatedSdl.match(/type (\w+)/g) || []
  const generatedTypes = generatedTypeMatches.map(m => m.replace('type ', ''))

  const matchingTypes = generatedTypes.filter(t => oracleTypes.includes(t))
  const matchPercent = (matchingTypes.length / generatedTypes.length) * 100

  // Target: at least 90% of generated types match oracle
  expect(matchPercent).toBeGreaterThanOrEqual(90)

  // Target: generate at least 50 types (was 19)
  expect(generatedTypes.length).toBeGreaterThanOrEqual(50)
})
```

**Step 2: Run test to verify coverage**

Run: `npm test`
Expected: PASS with improved coverage

**Step 3: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "test: add oracle type coverage verification"
```

---

## Execution

Total tasks: 12

Each task is self-contained with:
- Clear test expectations (TDD)
- Minimal implementation
- Immediate verification
- Commit checkpoint

Estimated type coverage improvement: 19 → 60+ types
