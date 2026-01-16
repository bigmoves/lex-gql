# Union and Ref Type Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make lex-gql generate proper GraphQL union types and resolve ref fields to actual object types, matching the oracle schema.

**Architecture:** Build a unified type registry containing all object types (main defs + others defs) before populating fields. Union fields create named GraphQL unions with `resolveType` reading `$type` from data. Ref fields resolve to actual types from the registry.

**Tech Stack:** GraphQL.js (GraphQLUnionType, GraphQLObjectType), existing lex-gql infrastructure

---

## Task 1: Create Type Registry Infrastructure

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test for type registry**

Add test to verify all object types are registered:

```javascript
describe('Type Registry', () => {
  it('creates types for main object defs (not just records)', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // Main object types from embed lexicons
    expect(sdl).toContain('type AppBskyEmbedImages');
    expect(sdl).toContain('type AppBskyEmbedVideo');
    expect(sdl).toContain('type AppBskyEmbedExternal');
    expect(sdl).toContain('type AppBskyEmbedRecord');
    expect(sdl).toContain('type AppBskyEmbedRecordWithMedia');
  });

  it('creates types for nested object defs (others)', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // Nested types from others defs
    expect(sdl).toContain('type AppBskyFeedPostReplyRef');
    expect(sdl).toContain('type AppBskyEmbedImagesImage');
    expect(sdl).toContain('type AppBskyEmbedDefsAspectRatio');
    expect(sdl).toContain('type ComAtprotoRepoStrongRef');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "creates types for main object defs"`

Expected: FAIL - types like `AppBskyEmbedImages` not in schema

**Step 3: Implement type registry in buildSchema**

In `lex-gql.js`, refactor `buildSchema` to create all types upfront. Find the section around line 1500 and restructure:

```javascript
// After creating blobType and strongRefType, before creating record types:

// ============================================================================
// Phase 1: Build unified type registry (all object types)
// ============================================================================
/** @type {Record<string, GraphQLObjectType>} */
const typeRegistry = {};

// First pass: create type shells for ALL object defs
for (const lexicon of lexicons) {
  // Main defs with type: "object" (like app.bsky.embed.images)
  if (lexicon.defs.main?.type === 'object' && lexicon.defs.main.properties) {
    const typeName = nsidToTypeName(lexicon.id);
    typeRegistry[lexicon.id] = new GraphQLObjectType({
      name: typeName,
      description: `Object type from ${lexicon.id}`,
      fields: () => ({}), // Populated later
    });
  }

  // Others defs (nested types like #replyRef, #image)
  if (lexicon.defs.others) {
    for (const [defName, def] of Object.entries(lexicon.defs.others)) {
      if (def.type === 'object' && def.properties) {
        const refKey = `${lexicon.id}#${defName}`;
        const typeName = nsidToTypeName(lexicon.id) + defName.charAt(0).toUpperCase() + defName.slice(1);
        typeRegistry[refKey] = new GraphQLObjectType({
          name: typeName,
          description: `Nested type from ${refKey}`,
          fields: () => ({}), // Populated later
        });
      }
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "creates types for main object defs"`

Expected: Still FAIL - types created but not included in schema

**Step 5: Include type registry in schema**

Find where `types` array is built (around line 1645) and add registry types:

```javascript
const types = [
  ...(recordUnionType ? [recordUnionType] : []),
  ...Object.values(typeRegistry), // Add all registered types
  ...Object.values(nestedTypes),
  ...Object.values(aggregateTypes),
  ...Object.values(groupByEnums),
  ...Object.values(fieldConditionTypes),
];
```

**Step 6: Run tests to verify both pass**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Type Registry"`

Expected: PASS

**Step 7: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): add type registry for all object defs"
```

---

## Task 2: Implement Ref Resolution Helper

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test for ref resolution**

```javascript
describe('resolveRefKey', () => {
  it('resolves local ref to full key', () => {
    expect(resolveRefKey('#replyRef', 'app.bsky.feed.post')).toBe('app.bsky.feed.post#replyRef');
  });

  it('resolves external ref without fragment', () => {
    expect(resolveRefKey('com.atproto.repo.strongRef', 'app.bsky.feed.post')).toBe('com.atproto.repo.strongRef');
  });

  it('resolves external ref with fragment', () => {
    expect(resolveRefKey('app.bsky.embed.defs#aspectRatio', 'app.bsky.embed.images')).toBe('app.bsky.embed.defs#aspectRatio');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "resolveRefKey"`

Expected: FAIL - `resolveRefKey` not defined

**Step 3: Implement resolveRefKey**

Add after the existing `parseRefUri` function:

```javascript
/**
 * Resolve a ref string to a full registry key
 * @param {string} ref - The ref string (e.g., "#replyRef" or "app.bsky.embed.images")
 * @param {string} parentLexiconId - The lexicon ID containing this ref
 * @returns {string} Full registry key
 */
function resolveRefKey(ref, parentLexiconId) {
  if (ref.startsWith('#')) {
    // Local ref: #replyRef -> app.bsky.feed.post#replyRef
    return `${parentLexiconId}${ref}`;
  }
  // External ref: already fully qualified
  return ref;
}
```

Export it in the exports section.

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "resolveRefKey"`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): add resolveRefKey helper for ref resolution"
```

---

## Task 3: Resolve Ref Fields to Actual Types

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

```javascript
describe('Ref Field Resolution', () => {
  it('resolves ref field to actual GraphQL type', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // reply field should be AppBskyFeedPostReplyRef, not String
    expect(sdl).toMatch(/reply: AppBskyFeedPostReplyRef/);
  });

  it('resolves array of refs to list of actual types', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // images field in AppBskyEmbedImages should be [AppBskyEmbedImagesImage!]!
    expect(sdl).toMatch(/images: \[AppBskyEmbedImagesImage!\]!/);
  });

  it('resolves cross-lexicon refs', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // aspectRatio should be AppBskyEmbedDefsAspectRatio
    expect(sdl).toMatch(/aspectRatio: AppBskyEmbedDefsAspectRatio/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Ref Field Resolution"`

Expected: FAIL - fields are String instead of actual types

**Step 3: Update getGraphQLType to accept type registry**

Modify the `getGraphQLType` function signature and implementation:

```javascript
/**
 * Get GraphQL type for a property
 * @param {Property} prop
 * @param {GraphQLObjectType} [blobType]
 * @param {GraphQLObjectType} [strongRefType]
 * @param {Record<string, GraphQLObjectType>} [typeRegistry]
 * @param {string} [parentLexiconId]
 * @returns {import('graphql').GraphQLOutputType}
 */
function getGraphQLType(prop, blobType, strongRefType, typeRegistry, parentLexiconId) {
  // Handle ref type - resolve to actual type from registry
  if (prop.type === 'ref' && prop.ref && typeRegistry && parentLexiconId) {
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

  // Existing type mapping
  /** @type {Record<string, import('graphql').GraphQLOutputType>} */
  const typeMap = {
    string: GraphQLString,
    integer: GraphQLInt,
    boolean: GraphQLBoolean,
    number: GraphQLFloat,
    blob: blobType || GraphQLString,
    bytes: GraphQLString,
    'cid-link': GraphQLString,
    union: GraphQLString, // Will be handled separately for union types
  };

  if (prop.type === 'array' && prop.items) {
    const itemType = typeMap[prop.items.type] || GraphQLString;
    return new GraphQLList(new GraphQLNonNull(itemType));
  }

  return typeMap[prop.type] || GraphQLString;
}
```

**Step 4: Update all getGraphQLType call sites**

Search for all calls to `getGraphQLType` and add the new parameters. Key locations:
- `createRecordType` - pass `typeRegistry` and `lexicon.id`
- `createNestedObjectType` - pass `typeRegistry` and `lexiconId`

**Step 5: Populate type registry fields in second pass**

After creating all type shells, populate their fields:

```javascript
// Phase 2: Populate fields for all registered types
for (const lexicon of lexicons) {
  // Populate main object type fields
  if (lexicon.defs.main?.type === 'object' && typeRegistry[lexicon.id]) {
    const type = typeRegistry[lexicon.id];
    // Use Object.defineProperty to update the fields thunk
    const fields = buildObjectFields(lexicon.defs.main, typeRegistry, lexicon.id, blobType);
    Object.defineProperty(type, '_fields', { value: fields, writable: true });
  }

  // Populate nested type fields
  if (lexicon.defs.others) {
    for (const [defName, def] of Object.entries(lexicon.defs.others)) {
      const refKey = `${lexicon.id}#${defName}`;
      if (def.type === 'object' && typeRegistry[refKey]) {
        const type = typeRegistry[refKey];
        const fields = buildObjectFields(def, typeRegistry, lexicon.id, blobType);
        Object.defineProperty(type, '_fields', { value: fields, writable: true });
      }
    }
  }
}
```

**Step 6: Create buildObjectFields helper**

```javascript
/**
 * Build fields object for a GraphQL type from lexicon definition
 * @param {RecordDef} def
 * @param {Record<string, GraphQLObjectType>} typeRegistry
 * @param {string} parentLexiconId
 * @param {GraphQLObjectType} blobType
 * @returns {Record<string, import('graphql').GraphQLFieldConfig<*, *>>}
 */
function buildObjectFields(def, typeRegistry, parentLexiconId, blobType) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const prop of def.properties || []) {
    const graphqlType = getGraphQLType(prop, blobType, undefined, typeRegistry, parentLexiconId);
    fields[prop.name] = {
      type: prop.required ? new GraphQLNonNull(graphqlType) : graphqlType,
      description: 'Field from object definition',
    };
  }

  return fields;
}
```

**Step 7: Run tests**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Ref Field Resolution"`

Expected: PASS

**Step 8: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): resolve ref fields to actual GraphQL types"
```

---

## Task 4: Create Union Types for Union Fields

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

```javascript
describe('Union Types', () => {
  it('creates named union type for union field', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // Should have union type for embed field
    expect(sdl).toContain('union AppBskyFeedPostEmbed =');
    expect(sdl).toContain('AppBskyEmbedImages');
    expect(sdl).toContain('AppBskyEmbedVideo');
  });

  it('uses union type for field instead of String', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // embed field should use the union type
    expect(sdl).toMatch(/embed: AppBskyFeedPostEmbed/);
  });

  it('creates union for labels field', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('union AppBskyFeedPostLabels =');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Union Types"`

Expected: FAIL - no union types created

**Step 3: Implement union type creation**

Add after type registry creation:

```javascript
// ============================================================================
// Phase 2: Create union types for union fields
// ============================================================================
/** @type {Record<string, GraphQLUnionType>} */
const unionTypes = {};

/**
 * Convert field name to PascalCase
 * @param {string} name
 * @returns {string}
 */
function toPascalCase(name) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Scan all lexicons for union fields
for (const lexicon of lexicons) {
  const defs = [
    { def: lexicon.defs.main, prefix: '' },
    ...Object.entries(lexicon.defs.others || {}).map(([name, def]) => ({
      def,
      prefix: toPascalCase(name)
    })),
  ];

  for (const { def, prefix } of defs) {
    if (!def?.properties) continue;

    const parentTypeName = nsidToTypeName(lexicon.id) + prefix;

    for (const prop of def.properties) {
      if (prop.type === 'union' && prop.refs && prop.refs.length > 0) {
        const unionName = `${parentTypeName}${toPascalCase(prop.name)}`;

        // Resolve all refs to their types
        const memberTypes = prop.refs
          .map(ref => {
            const refKey = resolveRefKey(ref, lexicon.id);
            return typeRegistry[refKey];
          })
          .filter(Boolean);

        if (memberTypes.length > 0) {
          unionTypes[unionName] = new GraphQLUnionType({
            name: unionName,
            description: `Union type for ${prop.name} field`,
            types: memberTypes,
            resolveType: (value) => {
              const typeId = value?.$type || value?.['$type'];
              if (!typeId) return null;
              return typeRegistry[typeId] || null;
            },
          });
        }
      }
    }
  }
}
```

**Step 4: Update getGraphQLType to use union types**

Add handling for union fields:

```javascript
// In getGraphQLType, add before the typeMap:
if (prop.type === 'union' && prop.refs && unionTypes) {
  const unionName = `${parentTypeName}${toPascalCase(prop.name)}`;
  const unionType = unionTypes[unionName];
  if (unionType) {
    return unionType;
  }
}
```

**Step 5: Include union types in schema**

Update the types array:

```javascript
const types = [
  ...(recordUnionType ? [recordUnionType] : []),
  ...Object.values(typeRegistry),
  ...Object.values(unionTypes), // Add union types
  ...Object.values(aggregateTypes),
  // ...
];
```

**Step 6: Run tests**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Union Types"`

Expected: PASS

**Step 7: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): create GraphQL union types for union fields"
```

---

## Task 5: Add Forward Joins to Nested Types

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

```javascript
describe('Forward Joins on Nested Types', () => {
  it('adds forward join fields to nested types with strongRef', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // AppBskyFeedPostReplyRef should have parentResolved and rootResolved
    expect(sdl).toMatch(/type AppBskyFeedPostReplyRef \{[\s\S]*?parentResolved: Record/);
    expect(sdl).toMatch(/type AppBskyFeedPostReplyRef \{[\s\S]*?rootResolved: Record/);
  });

  it('adds forward join to ComAtprotoRepoStrongRef', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // ComAtprotoRepoStrongRef should have uriResolved
    expect(sdl).toMatch(/type ComAtprotoRepoStrongRef \{[\s\S]*?uriResolved: Record/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Forward Joins on Nested Types"`

Expected: FAIL - no forward join fields on nested types

**Step 3: Extract forward join logic into shared function**

```javascript
/**
 * Add forward join fields for strongRef references
 * @param {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} fields
 * @param {Property[]} properties
 * @param {GraphQLUnionType} recordUnionType
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
```

**Step 4: Use shared function in buildObjectFields**

Update `buildObjectFields` to accept and use `recordUnionType`:

```javascript
function buildObjectFields(def, typeRegistry, parentLexiconId, blobType, recordUnionType) {
  /** @type {Record<string, import('graphql').GraphQLFieldConfig<*, *>>} */
  const fields = {};

  for (const prop of def.properties || []) {
    const graphqlType = getGraphQLType(prop, blobType, undefined, typeRegistry, parentLexiconId);
    fields[prop.name] = {
      type: prop.required ? new GraphQLNonNull(graphqlType) : graphqlType,
      description: 'Field from object definition',
    };
  }

  // Add forward join fields
  addForwardJoinFields(fields, def.properties || [], recordUnionType);

  return fields;
}
```

**Step 5: Run tests**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Forward Joins on Nested Types"`

Expected: PASS

**Step 6: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): add forward joins to nested types"
```

---

## Task 6: Add Data Hydration for Union Types

**Files:**
- Modify: `packages/lex-gql/lex-gql.js`
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

```javascript
describe('Union Type Resolution at Runtime', () => {
  it('resolves correct type from $type field', async () => {
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'test.post',
        defs: {
          main: {
            type: 'record',
            key: 'tid',
            record: {
              type: 'object',
              properties: {
                text: { type: 'string' },
                embed: {
                  type: 'union',
                  refs: ['test.embed.images', 'test.embed.video'],
                },
              },
            },
          },
        },
      }),
      parseLexicon({
        lexicon: 1,
        id: 'test.embed.images',
        defs: {
          main: {
            type: 'object',
            properties: {
              images: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      }),
      parseLexicon({
        lexicon: 1,
        id: 'test.embed.video',
        defs: {
          main: {
            type: 'object',
            properties: {
              url: { type: 'string' },
            },
          },
        },
      }),
    ];

    const mockQuery = async (op) => {
      if (op.type === 'findMany') {
        return {
          records: [
            {
              uri: 'at://did:test/test.post/1',
              did: 'did:test',
              collection: 'test.post',
              cid: 'bafytest',
              indexedAt: '2024-01-01T00:00:00Z',
              record: {
                text: 'Hello',
                embed: {
                  $type: 'test.embed.images',
                  images: ['img1.jpg', 'img2.jpg'],
                },
              },
            },
          ],
          cursor: null,
        };
      }
      return { count: 0 };
    };

    const adapter = createAdapter(lexicons, { query: mockQuery });
    const result = await adapter.execute(`
      query {
        testPost(first: 10) {
          edges {
            node {
              text
              embed {
                __typename
                ... on TestEmbedImages {
                  images
                }
              }
            }
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.testPost.edges[0].node.embed.__typename).toBe('TestEmbedImages');
    expect(result.data.testPost.edges[0].node.embed.images).toEqual(['img1.jpg', 'img2.jpg']);
  });

  it('returns null for missing $type', async () => {
    // Similar test but with embed missing $type
    // ... (abbreviated for plan)
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Union Type Resolution at Runtime"`

Expected: FAIL - union type resolution not working

**Step 3: Update hydrateRecord to preserve nested objects**

The `hydrateRecord` function needs to pass through union field data without flattening:

```javascript
// In hydrateRecord, when processing a union field:
if (prop.type === 'union') {
  // Pass through the entire object with $type intact
  result[prop.name] = record[prop.name];
}
```

**Step 4: Run tests**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "Union Type Resolution at Runtime"`

Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(lex-gql): add runtime union type resolution"
```

---

## Task 7: Update Existing Tests for New Behavior

**Files:**
- Modify: `packages/lex-gql/lex-gql.test.js`

**Step 1: Update mapLexiconType tests**

The test "maps ref to String (URI)" is now incorrect since refs resolve to actual types. Update:

```javascript
it('maps ref to String when no registry available', () => {
  // mapLexiconType without registry still returns String
  expect(mapLexiconType('ref')).toBe('String');
});

it('maps union to String when no registry available', () => {
  expect(mapLexiconType('union')).toBe('String');
});
```

**Step 2: Run full test suite**

Run: `cd packages/lex-gql && pnpm test`

Expected: All tests pass

**Step 3: Commit**

```bash
git add packages/lex-gql/lex-gql.test.js
git commit -m "test(lex-gql): update tests for ref/union type resolution"
```

---

## Task 8: Verify Schema Comparison Improvement

**Files:**
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Run schema comparison test**

Run: `cd packages/lex-gql && pnpm test -- --reporter=verbose -t "compares generated schema against oracle"`

**Step 2: Check improvement in match percentage**

The output should show significantly improved match percentage (from ~63% to higher).

Expected improvements:
- Types like `AppBskyEmbedImages`, `AppBskyEmbedVideo` now exist
- Union types like `AppBskyFeedPostEmbed` now exist
- Nested types like `AppBskyFeedPostReplyRef` now have proper fields

**Step 3: Document any remaining gaps**

If there are still gaps, note them for future work. Common remaining gaps might include:
- Input types for unions
- Specific filtering/sorting for union fields

**Step 4: Commit any test updates**

```bash
git add packages/lex-gql/lex-gql.test.js
git commit -m "test(lex-gql): verify schema comparison improvement"
```

---

## Task 9: Update E2E Tests

**Files:**
- Modify: `e2e/lex-gql.e2e.test.js`

**Step 1: Update embed field tests to use union syntax**

Now that unions work, update the e2e tests to query union fields properly:

```javascript
it('queries posts with embedded images', async () => {
  insertRecord.run(
    'at://did:plc:alice/app.bsky.feed.post/withimg',
    'did:plc:alice',
    'app.bsky.feed.post',
    'withimg',
    'bafyimg',
    JSON.stringify({
      text: 'Check out this photo!',
      createdAt: '2024-01-15T11:00:00.000Z',
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          {
            alt: 'A beautiful sunset',
            image: {
              $type: 'blob',
              ref: { $link: 'bafyimage123' },
              mimeType: 'image/jpeg',
              size: 245000,
            },
          },
        ],
      },
    }),
    '2024-01-15T11:00:00.000Z'
  );

  const result = await adapter.execute(`
    query {
      appBskyFeedPost(first: 10) {
        edges {
          node {
            text
            embed {
              __typename
              ... on AppBskyEmbedImages {
                images {
                  alt
                  image {
                    cid
                    mimeType
                  }
                }
              }
            }
          }
        }
      }
    }
  `);

  expect(result.errors).toBeUndefined();
  const post = result.data.appBskyFeedPost.edges[0].node;
  expect(post.text).toBe('Check out this photo!');
  expect(post.embed.__typename).toBe('AppBskyEmbedImages');
  expect(post.embed.images[0].alt).toBe('A beautiful sunset');
});
```

**Step 2: Update reply field tests to use object syntax**

```javascript
it('queries posts with reply reference', async () => {
  // ... insert records ...

  const result = await adapter.execute(`
    query {
      appBskyFeedPost(first: 10, where: { did: { eq: "did:plc:alice" } }) {
        edges {
          node {
            text
            reply {
              root {
                uri
                cid
              }
              parent {
                uri
                cid
              }
            }
          }
        }
      }
    }
  `);

  expect(result.errors).toBeUndefined();
  const post = result.data.appBskyFeedPost.edges[0].node;
  expect(post.reply.root.uri).toBe('at://did:plc:bob/app.bsky.feed.post/parent');
});
```

**Step 3: Run e2e tests**

Run: `cd e2e && pnpm test`

Expected: PASS

**Step 4: Commit**

```bash
git add e2e/lex-gql.e2e.test.js
git commit -m "test(e2e): update tests to use union and ref types"
```

---

## Task 10: Final Verification

**Step 1: Run all tests across packages**

```bash
pnpm test
```

Expected: All tests pass in lex-gql, lex-gql-sqlite, and e2e

**Step 2: Run typecheck**

```bash
cd packages/lex-gql && pnpm typecheck
cd packages/lex-gql-sqlite && pnpm typecheck
```

Expected: No type errors

**Step 3: Final commit for any cleanup**

```bash
git add -A
git commit -m "chore: final cleanup for union/ref type support"
```
