# Blob URL Field Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `url(preset)` field to the Blob type for generating Bluesky CDN URLs.

**Architecture:** The Blob type gets a new `url` field with an optional `preset` String argument (default: `feed_fullsize`). The resolver builds a CDN URL in the format `https://cdn.bsky.app/img/{preset}/plain/{did}/{ref}@jpeg`. The blob data must include the `did` field from the parent record.

**Tech Stack:** graphql-js, vitest

---

### Task 1: Add url field to Blob type schema

**Files:**
- Modify: `packages/lex-gql/lex-gql.js:389-408` (createBlobType function)
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write the failing test**

Add to `lex-gql.test.js` after the existing Blob test (around line 1047):

```javascript
it('generates url field on Blob type with preset argument', () => {
  const lexicons = [
    {
      id: 'app.bsky.actor.profile',
      defs: {
        main: {
          type: 'record',
          key: 'literal:self',
          record: {
            type: 'object',
            properties: {
              avatar: { type: 'blob' },
            },
          },
        },
      },
    },
  ];

  const schema = buildSchema(lexicons);
  const sdl = printSchema(schema);

  expect(sdl).toContain('url(');
  expect(sdl).toContain('preset: String');
  expect(sdl).toContain('): String!');
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/lex-gql && pnpm test -- -t "generates url field"`
Expected: FAIL - url field not in schema

**Step 3: Implement url field in createBlobType**

In `lex-gql.js`, update the `createBlobType` function:

```javascript
function createBlobType() {
  return new GraphQLObjectType({
    name: 'Blob',
    description: 'Binary blob reference',
    fields: {
      ref: {
        type: new GraphQLNonNull(GraphQLString),
        description: 'CID reference to the blob',
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
          return `https://cdn.bsky.app/img/${preset}/plain/${did}/${ref}@jpeg`;
        },
      },
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/lex-gql && pnpm test -- -t "generates url field"`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/lex-gql/lex-gql.js packages/lex-gql/lex-gql.test.js
git commit -m "feat(blob): add url field with preset argument for CDN URLs"
```

---

### Task 2: Test url resolver with different presets

**Files:**
- Test: `packages/lex-gql/lex-gql.test.js`

**Step 1: Write resolver tests**

Add a new describe block for Blob URL resolver tests:

```javascript
describe('Blob URL resolver', () => {
  it('generates CDN URL with default preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            record: {
              type: 'object',
              properties: {
                avatar: { type: 'blob' },
              },
            },
          },
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const blobType = schema.getType('Blob');
    const urlField = blobType.getFields().url;

    const blob = {
      ref: 'bafyreiabc123',
      mimeType: 'image/jpeg',
      size: 12345,
      did: 'did:plc:user123',
    };

    const result = urlField.resolve(blob, {});
    expect(result).toBe('https://cdn.bsky.app/img/feed_fullsize/plain/did:plc:user123/bafyreiabc123@jpeg');
  });

  it('generates CDN URL with avatar preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            record: {
              type: 'object',
              properties: {
                avatar: { type: 'blob' },
              },
            },
          },
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const blobType = schema.getType('Blob');
    const urlField = blobType.getFields().url;

    const blob = {
      ref: 'bafyreiabc123',
      mimeType: 'image/jpeg',
      size: 12345,
      did: 'did:plc:user123',
    };

    const result = urlField.resolve(blob, { preset: 'avatar' });
    expect(result).toBe('https://cdn.bsky.app/img/avatar/plain/did:plc:user123/bafyreiabc123@jpeg');
  });

  it('generates CDN URL with banner preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            record: {
              type: 'object',
              properties: {
                banner: { type: 'blob' },
              },
            },
          },
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const blobType = schema.getType('Blob');
    const urlField = blobType.getFields().url;

    const blob = {
      ref: 'bafyreiabc456',
      mimeType: 'image/jpeg',
      size: 54321,
      did: 'did:plc:banner123',
    };

    const result = urlField.resolve(blob, { preset: 'banner' });
    expect(result).toBe('https://cdn.bsky.app/img/banner/plain/did:plc:banner123/bafyreiabc456@jpeg');
  });

  it('generates CDN URL with feed_thumbnail preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            record: {
              type: 'object',
              properties: {
                avatar: { type: 'blob' },
              },
            },
          },
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const blobType = schema.getType('Blob');
    const urlField = blobType.getFields().url;

    const blob = {
      ref: 'bafyreiathumbnail',
      mimeType: 'image/jpeg',
      size: 9999,
      did: 'did:plc:thumb456',
    };

    const result = urlField.resolve(blob, { preset: 'feed_thumbnail' });
    expect(result).toBe('https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:thumb456/bafyreiathumbnail@jpeg');
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd packages/lex-gql && pnpm test -- -t "Blob URL resolver"`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/lex-gql/lex-gql.test.js
git commit -m "test(blob): add url resolver tests for CDN URL generation"
```

---

### Task 3: Run full test suite and bump version

**Files:**
- Modify: `packages/lex-gql/package.json`

**Step 1: Run full test suite**

Run: `cd packages/lex-gql && pnpm test`
Expected: All tests pass

**Step 2: Bump version to 0.2.0**

In `packages/lex-gql/package.json`, change version from `"0.1.0"` to `"0.2.0"`.

**Step 3: Commit and tag**

```bash
git add packages/lex-gql/package.json
git commit -m "chore(lex-gql): bump version to 0.2.0"
git tag v0.2.0
```

---

### Task 4: Publish to npm

**Step 1: Publish**

Run: `cd packages/lex-gql && npm publish`
Expected: Package published successfully

**Step 2: Verify on npm**

Run: `npm info lex-gql`
Expected: Shows version 0.2.0
