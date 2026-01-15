# Quickslice.js Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single-file JavaScript library that transforms AT Protocol lexicons into a GraphQL API with pluggable database adapters.

**Architecture:** Lexicons are parsed at runtime, converted to a GraphQL schema with types/queries/mutations, and queries compile to operation objects that adapters translate to database calls. Join batching is handled dataloader-style by the library.

**Tech Stack:** JavaScript (ES modules), JSDoc for types, `graphql` package for schema/execution, `vitest` for testing

**Testing:** All tests use **vitest**. Import test utilities with `import { describe, it, expect } from 'vitest'`. Run tests with `npm test` which executes `vitest run`.

---

## Task 1: Project Setup

**Files:**
- Create: `quickslice.js`
- Create: `quickslice.test.js`
- Create: `package.json`

**Step 0: Initialize git repository**

```bash
git init
```

**Step 1: Create package.json**

```json
{
  "name": "quickslice",
  "version": "0.1.0",
  "type": "module",
  "main": "quickslice.js",
  "dependencies": {
    "graphql": "^16.8.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**Step 2: Create quickslice.js skeleton**

```js
// quickslice.js - AT Protocol Lexicon to GraphQL Adapter

/**
 * @typedef {Object} Operation
 * @property {'findMany'|'findOne'|'count'|'aggregate'|'create'|'update'|'delete'} type
 * @property {string} collection
 * @property {WhereClause[]} [where]
 * @property {string[]} [select]
 * @property {SortClause[]} [sort]
 * @property {Pagination} [pagination]
 * @property {Object} [data]
 * @property {string} [uri]
 * @property {string} [rkey]
 * @property {string[]} [groupBy]
 * @property {Aggregate[]} [aggregates]
 */

/**
 * @typedef {Object} AdapterOptions
 * @property {(op: Operation) => Promise<any>} query
 * @property {Object} [context]
 * @property {number} [maxDepth]
 */

export function createAdapter(lexicons, options) {
  // TODO: implement
  return { execute: async () => null, schema: null }
}
```

**Step 3: Create quickslice.test.js skeleton (using vitest)**

```js
// quickslice.test.js - Tests using vitest
import { describe, it, expect } from 'vitest'

describe('quickslice', () => {
  it('placeholder', () => {
    expect(true).toBe(true)
  })
})
```

Note: All tests use vitest's `describe`, `it`, and `expect` from `'vitest'`.

**Step 4: Run vitest to verify setup**

Run: `npm install && npm test` (runs vitest)
Expected: PASS - vitest runs and the placeholder test passes

**Step 5: Commit**

```bash
git add package.json quickslice.js quickslice.test.js
git commit -m "chore: initial project setup with vitest"
```

---

## Task 2: NSID Utilities

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for NSID conversion (vitest)**

```js
// Add to quickslice.test.js (after existing vitest imports)
import { nsidToTypeName, nsidToFieldName, nsidToCollectionName } from './quickslice.js'

describe('NSID utilities', () => {
  describe('nsidToTypeName', () => {
    it('converts simple NSID to PascalCase', () => {
      expect(nsidToTypeName('xyz.statusphere.status')).toBe('XyzStatusphereStatus')
    })

    it('converts app.bsky NSID to PascalCase', () => {
      expect(nsidToTypeName('app.bsky.feed.post')).toBe('AppBskyFeedPost')
    })

    it('converts com.atproto NSID to PascalCase', () => {
      expect(nsidToTypeName('com.atproto.repo.createRecord')).toBe('ComAtprotoRepoCreateRecord')
    })
  })

  describe('nsidToFieldName', () => {
    it('converts simple NSID to camelCase', () => {
      expect(nsidToFieldName('xyz.statusphere.status')).toBe('xyzStatusphereStatus')
    })

    it('converts app.bsky NSID to camelCase', () => {
      expect(nsidToFieldName('app.bsky.feed.post')).toBe('appBskyFeedPost')
    })

    it('converts com.atproto NSID to camelCase', () => {
      expect(nsidToFieldName('com.atproto.repo.createRecord')).toBe('comAtprotoRepoCreateRecord')
    })
  })

  describe('nsidToCollectionName', () => {
    it('extracts last segment from NSID', () => {
      expect(nsidToCollectionName('xyz.statusphere.status')).toBe('status')
    })

    it('extracts last segment from app.bsky NSID', () => {
      expect(nsidToCollectionName('app.bsky.feed.post')).toBe('post')
    })

    it('extracts last segment from com.atproto NSID', () => {
      expect(nsidToCollectionName('com.atproto.repo.createRecord')).toBe('createRecord')
    })
  })
})
```

**Step 2: Run vitest to verify tests fail**

Run: `npm test` (vitest)
Expected: FAIL with "nsidToTypeName is not exported"

**Step 3: Implement NSID utilities**

```js
// Add to quickslice.js

/**
 * Convert NSID to PascalCase type name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "AppBskyFeedPost"
 */
export function nsidToTypeName(nsid) {
  return nsid
    .split('.')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('')
}

/**
 * Convert NSID to camelCase field name
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "appBskyFeedPost"
 */
export function nsidToFieldName(nsid) {
  const typeName = nsidToTypeName(nsid)
  return typeName.charAt(0).toLowerCase() + typeName.slice(1)
}

/**
 * Extract collection name (last segment) from NSID
 * @param {string} nsid - e.g. "app.bsky.feed.post"
 * @returns {string} - e.g. "post"
 */
export function nsidToCollectionName(nsid) {
  const segments = nsid.split('.')
  return segments[segments.length - 1]
}
```

**Step 4: Run vitest to verify tests pass**

Run: `npm test` (vitest)
Expected: PASS - all NSID utility tests green

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add NSID to type/field name conversion utilities"
```

---

## Task 3: Lexicon Parser - Basic Records

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for basic lexicon parsing**

```js
// Add to quickslice.test.js
import { parseLexicon } from './quickslice.js'

describe('Lexicon Parser', () => {
  it('parses simple record lexicon', () => {
    const json = {
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['text'],
            properties: {
              text: { type: 'string' },
              createdAt: { type: 'string' }
            }
          }
        }
      }
    }

    const result = parseLexicon(json)

    expect(result.id).toBe('xyz.statusphere.status')
    expect(result.defs.main).toBeDefined()
    expect(result.defs.main.type).toBe('record')
    expect(result.defs.main.properties).toHaveLength(2)
  })

  it('parses lexicon with optional fields only', () => {
    const json = {
      lexicon: 1,
      id: 'xyz.statusphere.profile',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            properties: {
              displayName: { type: 'string' },
              bio: { type: 'string' }
            }
          }
        }
      }
    }

    const result = parseLexicon(json)

    expect(result.id).toBe('xyz.statusphere.profile')
    expect(result.defs.main.properties).toHaveLength(2)
    // All properties should be optional (required = false)
    expect(result.defs.main.properties.every(p => !p.required)).toBe(true)
  })

  it('throws on missing id', () => {
    const json = {
      lexicon: 1,
      defs: { main: { type: 'record' } }
    }

    expect(() => parseLexicon(json)).toThrow()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "parseLexicon is not exported"

**Step 3: Implement basic lexicon parser**

```js
// Add to quickslice.js

/**
 * @typedef {Object} Property
 * @property {string} name
 * @property {string} type
 * @property {boolean} required
 * @property {string} [format]
 * @property {string} [ref]
 * @property {string[]} [refs]
 * @property {ArrayItems} [items]
 */

/**
 * @typedef {Object} ArrayItems
 * @property {string} type
 * @property {string} [ref]
 * @property {string[]} [refs]
 */

/**
 * @typedef {Object} RecordDef
 * @property {string} type
 * @property {string} [key]
 * @property {Property[]} properties
 */

/**
 * @typedef {Object} Lexicon
 * @property {string} id
 * @property {{ main: RecordDef|null, others: Object.<string, RecordDef> }} defs
 */

/**
 * Parse a lexicon JSON object into structured form
 * @param {Object} json - Raw lexicon JSON
 * @returns {Lexicon}
 */
export function parseLexicon(json) {
  if (!json.id) {
    throw new Error('Lexicon missing required field: id')
  }

  const defs = { main: null, others: {} }

  if (json.defs) {
    for (const [name, def] of Object.entries(json.defs)) {
      const parsed = parseDefinition(def, json.defs)
      if (name === 'main') {
        defs.main = parsed
      } else {
        defs.others[name] = parsed
      }
    }
  }

  return { id: json.id, defs }
}

/**
 * Parse a single definition (record or object type)
 * @param {Object} def
 * @param {Object} allDefs - All defs for resolving required fields
 * @returns {RecordDef}
 */
function parseDefinition(def, allDefs) {
  const type = def.type
  const key = def.key || null

  // Get the object definition (either directly or from record.record)
  const objDef = type === 'record' ? def.record : def

  if (!objDef || !objDef.properties) {
    return { type, key, properties: [] }
  }

  const required = new Set(objDef.required || [])
  const properties = []

  for (const [propName, propDef] of Object.entries(objDef.properties)) {
    properties.push({
      name: propName,
      type: propDef.type,
      required: required.has(propName),
      format: propDef.format || null,
      ref: propDef.ref || null,
      refs: propDef.refs || null,
      items: propDef.items ? {
        type: propDef.items.type,
        ref: propDef.items.ref || null,
        refs: propDef.items.refs || null
      } : null
    })
  }

  return { type, key, properties }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add basic lexicon parser for record types"
```

---

## Task 4: Lexicon Parser - Arrays and Unions

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for array and union parsing**

```js
// Add to Lexicon Parser describe block

it('parses array with ref items', () => {
  const json = {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.track',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            artists: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'fm.teal.alpha.feed.defs#artist'
              }
            }
          }
        }
      }
    }
  }

  const result = parseLexicon(json)
  const artistsProp = result.defs.main.properties.find(p => p.name === 'artists')

  expect(artistsProp.type).toBe('array')
  expect(artistsProp.items.type).toBe('ref')
  expect(artistsProp.items.ref).toBe('fm.teal.alpha.feed.defs#artist')
})

it('parses array with union items', () => {
  const json = {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.track',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            creators: {
              type: 'array',
              items: {
                type: 'union',
                refs: ['fm.teal.alpha.feed.defs#artist', 'fm.teal.alpha.feed.defs#band']
              }
            }
          }
        }
      }
    }
  }

  const result = parseLexicon(json)
  const creatorsProp = result.defs.main.properties.find(p => p.name === 'creators')

  expect(creatorsProp.type).toBe('array')
  expect(creatorsProp.items.type).toBe('union')
  expect(creatorsProp.items.refs).toEqual(['fm.teal.alpha.feed.defs#artist', 'fm.teal.alpha.feed.defs#band'])
})

it('parses union property (not array)', () => {
  const json = {
    lexicon: 1,
    id: 'app.bsky.feed.post',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            embed: {
              type: 'union',
              refs: ['app.bsky.embed.images', 'app.bsky.embed.video']
            }
          }
        }
      }
    }
  }

  const result = parseLexicon(json)
  const embedProp = result.defs.main.properties.find(p => p.name === 'embed')

  expect(embedProp.type).toBe('union')
  expect(embedProp.refs).toEqual(['app.bsky.embed.images', 'app.bsky.embed.video'])
})

it('parses array with string items', () => {
  const json = {
    lexicon: 1,
    id: 'fm.teal.alpha.feed.track',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            artistNames: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }

  const result = parseLexicon(json)
  const artistNamesProp = result.defs.main.properties.find(p => p.name === 'artistNames')

  expect(artistNamesProp.type).toBe('array')
  expect(artistNamesProp.items.type).toBe('string')
  expect(artistNamesProp.items.ref).toBeNull()
})
```

**Step 2: Run tests to verify they pass (implementation already handles this)**

Run: `npm test`
Expected: PASS (the parser from Task 3 already handles these cases)

**Step 3: Commit**

```bash
git add quickslice.test.js
git commit -m "test: add array and union parsing tests"
```

---

## Task 5: Lexicon Parser - Others Defs (Non-Main Types)

**Files:**
- Modify: `quickslice.test.js`

**Step 1: Write tests for lexicons without main and with others**

```js
// Add to Lexicon Parser describe block

it('parses lexicon without main definition', () => {
  const json = {
    lexicon: 1,
    id: 'com.atproto.label.defs',
    defs: {
      selfLabels: {
        type: 'object',
        required: ['values'],
        properties: {
          values: {
            type: 'array',
            items: { ref: '#selfLabel', type: 'ref' }
          }
        }
      },
      selfLabel: {
        type: 'object',
        required: ['val'],
        properties: {
          val: { type: 'string' }
        }
      }
    }
  }

  const result = parseLexicon(json)

  expect(result.id).toBe('com.atproto.label.defs')
  expect(result.defs.main).toBeNull()
  expect(Object.keys(result.defs.others)).toHaveLength(2)
  expect(result.defs.others.selfLabels).toBeDefined()
  expect(result.defs.others.selfLabel).toBeDefined()
})

it('parses lexicon with main object and others', () => {
  const json = {
    lexicon: 1,
    id: 'app.bsky.richtext.facet',
    defs: {
      main: {
        type: 'object',
        required: ['index', 'features'],
        properties: {
          index: { ref: '#byteSlice', type: 'ref' },
          features: {
            type: 'array',
            items: { refs: ['#mention', '#link', '#tag'], type: 'union' }
          }
        }
      },
      mention: {
        type: 'object',
        required: ['did'],
        properties: { did: { type: 'string', format: 'did' } }
      },
      link: {
        type: 'object',
        required: ['uri'],
        properties: { uri: { type: 'string', format: 'uri' } }
      },
      tag: {
        type: 'object',
        required: ['tag'],
        properties: { tag: { type: 'string' } }
      },
      byteSlice: {
        type: 'object',
        required: ['byteStart', 'byteEnd'],
        properties: {
          byteStart: { type: 'integer' },
          byteEnd: { type: 'integer' }
        }
      }
    }
  }

  const result = parseLexicon(json)

  expect(result.id).toBe('app.bsky.richtext.facet')
  expect(result.defs.main).toBeDefined()
  expect(result.defs.main.type).toBe('object')
  expect(Object.keys(result.defs.others)).toHaveLength(4)
  expect(result.defs.others.mention).toBeDefined()
  expect(result.defs.others.link).toBeDefined()
  expect(result.defs.others.tag).toBeDefined()
  expect(result.defs.others.byteSlice).toBeDefined()
})
```

**Step 2: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add quickslice.test.js
git commit -m "test: add tests for lexicons with others defs"
```

---

## Task 6: Type Mapper - Primitive Types

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for type mapping**

```js
// Add to quickslice.test.js
import { mapLexiconType } from './quickslice.js'

describe('Type Mapper', () => {
  it('maps string to GraphQL String', () => {
    expect(mapLexiconType('string')).toBe('String')
  })

  it('maps integer to GraphQL Int', () => {
    expect(mapLexiconType('integer')).toBe('Int')
  })

  it('maps boolean to GraphQL Boolean', () => {
    expect(mapLexiconType('boolean')).toBe('Boolean')
  })

  it('maps number to GraphQL Float', () => {
    expect(mapLexiconType('number')).toBe('Float')
  })

  it('maps blob to Blob object type', () => {
    expect(mapLexiconType('blob')).toBe('Blob')
  })

  it('maps bytes to String (base64)', () => {
    expect(mapLexiconType('bytes')).toBe('String')
  })

  it('maps cid-link to String', () => {
    expect(mapLexiconType('cid-link')).toBe('String')
  })

  it('maps ref to String (URI)', () => {
    expect(mapLexiconType('ref')).toBe('String')
  })

  it('maps union to String (fallback)', () => {
    expect(mapLexiconType('union')).toBe('String')
  })

  it('maps unknown types to String', () => {
    expect(mapLexiconType('somethingWeird')).toBe('String')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "mapLexiconType is not exported"

**Step 3: Implement type mapper**

```js
// Add to quickslice.js

/**
 * Map AT Protocol lexicon type to GraphQL type name
 * @param {string} lexiconType
 * @returns {string}
 */
export function mapLexiconType(lexiconType) {
  const typeMap = {
    'string': 'String',
    'integer': 'Int',
    'boolean': 'Boolean',
    'number': 'Float',
    'blob': 'Blob',
    'bytes': 'String',
    'cid-link': 'String',
    'ref': 'String',
    'union': 'String'
  }
  return typeMap[lexiconType] || 'String'
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add lexicon type to GraphQL type mapper"
```

---

## Task 7: Ref URI Parser

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for ref URI parsing**

```js
// Add to quickslice.test.js
import { parseRefUri, refToTypeName } from './quickslice.js'

describe('Ref URI Parser', () => {
  it('parses full NSID without fragment', () => {
    expect(parseRefUri('xyz.statusphere.profile')).toEqual({
      nsid: 'xyz.statusphere.profile',
      fragment: 'main'
    })
  })

  it('parses NSID with fragment', () => {
    expect(parseRefUri('xyz.statusphere.post#embed')).toEqual({
      nsid: 'xyz.statusphere.post',
      fragment: 'embed'
    })
  })

  it('parses local ref (#fragment)', () => {
    expect(parseRefUri('#mention')).toEqual({
      nsid: null,
      fragment: 'mention'
    })
  })
})

describe('refToTypeName', () => {
  it('converts full ref to PascalCase type name', () => {
    expect(refToTypeName('fm.teal.alpha.feed.defs#artist')).toBe('FmTealAlphaFeedDefsArtist')
  })

  it('converts simple ref to PascalCase type name', () => {
    expect(refToTypeName('app.bsky.feed.post')).toBe('AppBskyFeedPost')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement ref URI parser**

```js
// Add to quickslice.js

/**
 * Parse a ref URI into nsid and fragment
 * @param {string} refUri - e.g. "xyz.statusphere.post#embed" or "#mention"
 * @returns {{ nsid: string|null, fragment: string }}
 */
export function parseRefUri(refUri) {
  if (refUri.startsWith('#')) {
    return { nsid: null, fragment: refUri.slice(1) }
  }

  const hashIndex = refUri.indexOf('#')
  if (hashIndex === -1) {
    return { nsid: refUri, fragment: 'main' }
  }

  return {
    nsid: refUri.slice(0, hashIndex),
    fragment: refUri.slice(hashIndex + 1)
  }
}

/**
 * Convert a ref URI to a GraphQL type name
 * @param {string} refUri - e.g. "fm.teal.alpha.feed.defs#artist"
 * @returns {string} - e.g. "FmTealAlphaFeedDefsArtist"
 */
export function refToTypeName(refUri) {
  const { nsid, fragment } = parseRefUri(refUri)

  if (!nsid) {
    // Local ref - will need context to resolve
    return fragment.charAt(0).toUpperCase() + fragment.slice(1)
  }

  const baseName = nsidToTypeName(nsid)
  if (fragment === 'main') {
    return baseName
  }

  return baseName + fragment.charAt(0).toUpperCase() + fragment.slice(1)
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add ref URI parser and type name conversion"
```

---

## Task 8: Schema Builder - Basic Object Types

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for schema building**

```js
// Add to quickslice.test.js
import { buildSchema } from './quickslice.js'
import { printSchema } from 'graphql'

describe('Schema Builder', () => {
  it('builds schema with system fields for record type', () => {
    const lexicons = [{
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          key: null,
          properties: [
            { name: 'text', type: 'string', required: true },
            { name: 'createdAt', type: 'string', required: true }
          ]
        },
        others: {}
      }
    }]

    const schema = buildSchema(lexicons)
    const sdl = printSchema(schema)

    // Should have Query type
    expect(sdl).toContain('type Query')

    // Should have record type with system fields
    expect(sdl).toContain('type XyzStatusphereStatus')
    expect(sdl).toContain('uri: String')
    expect(sdl).toContain('cid: String')
    expect(sdl).toContain('did: String')
    expect(sdl).toContain('indexedAt: String')

    // Should have lexicon fields
    expect(sdl).toContain('text: String')
    expect(sdl).toContain('createdAt: String')
  })

  it('builds query field with correct name', () => {
    const lexicons = [{
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          key: null,
          properties: [
            { name: 'text', type: 'string', required: true }
          ]
        },
        others: {}
      }
    }]

    const schema = buildSchema(lexicons)
    const sdl = printSchema(schema)

    // Query field should use camelCase
    expect(sdl).toContain('xyzStatusphereStatus')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement basic schema builder**

```js
// Add to quickslice.js
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLUnionType
} from 'graphql'

/**
 * Build a GraphQL schema from parsed lexicons
 * @param {Lexicon[]} lexicons
 * @returns {GraphQLSchema}
 */
export function buildSchema(lexicons) {
  const recordTypes = {}

  // First pass: create all record types
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && (lexicon.defs.main.type === 'record' || lexicon.defs.main.type === 'object')) {
      const typeName = nsidToTypeName(lexicon.id)
      recordTypes[lexicon.id] = createRecordType(typeName, lexicon.defs.main)
    }
  }

  // Create Query type
  const queryFields = {}
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const fieldName = nsidToFieldName(lexicon.id)
      queryFields[fieldName] = {
        type: new GraphQLList(recordTypes[lexicon.id]),
        description: `Query ${lexicon.id}`
      }
    }
  }

  const queryType = new GraphQLObjectType({
    name: 'Query',
    description: 'Root query type',
    fields: queryFields
  })

  return new GraphQLSchema({ query: queryType })
}

/**
 * Create a GraphQL object type for a record definition
 * @param {string} typeName
 * @param {RecordDef} recordDef
 * @returns {GraphQLObjectType}
 */
function createRecordType(typeName, recordDef) {
  return new GraphQLObjectType({
    name: typeName,
    description: `Record type: ${typeName}`,
    fields: () => {
      const fields = {
        // System fields
        uri: { type: GraphQLString, description: 'Record URI' },
        cid: { type: GraphQLString, description: 'Record CID' },
        did: { type: GraphQLString, description: 'DID of record author' },
        indexedAt: { type: GraphQLString, description: 'When record was indexed' }
      }

      // Add lexicon properties
      for (const prop of recordDef.properties) {
        fields[prop.name] = {
          type: getGraphQLType(prop),
          description: `Field from lexicon`
        }
      }

      return fields
    }
  })
}

/**
 * Get GraphQL type for a property
 * @param {Property} prop
 * @returns {GraphQLOutputType}
 */
function getGraphQLType(prop) {
  const typeMap = {
    'string': GraphQLString,
    'integer': GraphQLInt,
    'boolean': GraphQLBoolean,
    'number': GraphQLFloat,
    'blob': GraphQLString,  // Simplified for now
    'bytes': GraphQLString,
    'cid-link': GraphQLString,
    'ref': GraphQLString,
    'union': GraphQLString,
    'array': GraphQLString  // Will handle properly later
  }

  if (prop.type === 'array' && prop.items) {
    const itemType = typeMap[prop.items.type] || GraphQLString
    return new GraphQLList(new GraphQLNonNull(itemType))
  }

  return typeMap[prop.type] || GraphQLString
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add basic schema builder with record types"
```

---

## Task 9: Schema Builder - Forward Joins

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for forward join fields**

```js
// Add to Schema Builder describe block

it('generates forward join field for strongRef', () => {
  const lexicons = [{
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'displayName', type: 'string', required: true },
          { name: 'pinnedPost', type: 'ref', required: false, ref: 'com.atproto.repo.strongRef' }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('pinnedPostResolved')
})

it('generates forward join field for at-uri format', () => {
  const lexicons = [{
    id: 'app.bsky.feed.like',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'subject', type: 'string', required: true, format: 'at-uri' },
          { name: 'createdAt', type: 'string', required: true, format: 'datetime' }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('subjectResolved')
})

it('does not generate Resolved fields for non-join fields', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'status', type: 'string', required: true },
          { name: 'createdAt', type: 'string', required: true, format: 'datetime' }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).not.toContain('statusResolved')
  expect(sdl).not.toContain('createdAtResolved')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Update schema builder to add forward join fields**

```js
// Update createRecordType in quickslice.js

function createRecordType(typeName, recordDef, recordUnionType) {
  return new GraphQLObjectType({
    name: typeName,
    description: `Record type: ${typeName}`,
    fields: () => {
      const fields = {
        uri: { type: GraphQLString, description: 'Record URI' },
        cid: { type: GraphQLString, description: 'Record CID' },
        did: { type: GraphQLString, description: 'DID of record author' },
        indexedAt: { type: GraphQLString, description: 'When record was indexed' }
      }

      for (const prop of recordDef.properties) {
        fields[prop.name] = {
          type: getGraphQLType(prop),
          description: `Field from lexicon`
        }

        // Add forward join field if applicable
        if (isForwardJoinField(prop)) {
          fields[prop.name + 'Resolved'] = {
            type: recordUnionType || GraphQLString,
            description: `Resolved reference for ${prop.name}`
          }
        }
      }

      return fields
    }
  })
}

/**
 * Check if a property should generate a forward join field
 * @param {Property} prop
 * @returns {boolean}
 */
function isForwardJoinField(prop) {
  // strongRef reference
  if (prop.type === 'ref' && prop.ref === 'com.atproto.repo.strongRef') {
    return true
  }
  // at-uri format string
  if (prop.type === 'string' && prop.format === 'at-uri') {
    return true
  }
  return false
}
```

Also update buildSchema to create Record union and pass it (complete function):

```js
export function buildSchema(lexicons) {
  const recordTypes = {}

  // First pass: create placeholder types
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && (lexicon.defs.main.type === 'record' || lexicon.defs.main.type === 'object')) {
      const typeName = nsidToTypeName(lexicon.id)
      // Placeholder - will be replaced
      recordTypes[lexicon.id] = null
    }
  }

  // Create Record union type (will reference all record types)
  let recordUnionType = null

  // Second pass: create actual types with forward joins
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && (lexicon.defs.main.type === 'record' || lexicon.defs.main.type === 'object')) {
      const typeName = nsidToTypeName(lexicon.id)
      recordTypes[lexicon.id] = createRecordType(typeName, lexicon.defs.main, recordUnionType)
    }
  }

  // Create Record union if we have multiple record types
  const recordTypeList = Object.values(recordTypes).filter(Boolean)
  if (recordTypeList.length > 0) {
    recordUnionType = new GraphQLUnionType({
      name: 'Record',
      types: recordTypeList,
      description: 'Union of all record types'
    })

    // Recreate types with the union
    for (const lexicon of lexicons) {
      if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
        const typeName = nsidToTypeName(lexicon.id)
        recordTypes[lexicon.id] = createRecordType(typeName, lexicon.defs.main, recordUnionType)
      }
    }
  }

  // Create Query type
  const queryFields = {}
  for (const lexicon of lexicons) {
    if (lexicon.defs.main && lexicon.defs.main.type === 'record') {
      const fieldName = nsidToFieldName(lexicon.id)
      queryFields[fieldName] = {
        type: new GraphQLList(recordTypes[lexicon.id]),
        description: `Query ${lexicon.id}`
      }
    }
  }

  const queryType = new GraphQLObjectType({
    name: 'Query',
    description: 'Root query type',
    fields: queryFields
  })

  return new GraphQLSchema({ query: queryType })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add forward join fields for strongRef and at-uri"
```

---

## Task 10: Schema Builder - DID Joins

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for DID join fields**

```js
// Add to Schema Builder describe block

it('generates DID join fields between collections', () => {
  const lexicons = [
    {
      id: 'xyz.statusphere.status',
      defs: {
        main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
        others: {}
      }
    },
    {
      id: 'app.bsky.actor.profile',
      defs: {
        main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Status should have DID join to Profile
  expect(sdl).toContain('appBskyActorProfileByDid')
  // Profile should have DID join to Status
  expect(sdl).toContain('xyzStatusphereStatusByDid')
})

it('literal:self collections return single object for DID join', () => {
  const lexicons = [
    {
      id: 'xyz.statusphere.status',
      defs: {
        main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
        others: {}
      }
    },
    {
      id: 'app.bsky.actor.profile',
      defs: {
        main: { type: 'record', key: 'literal:self', properties: [{ name: 'displayName', type: 'string', required: false }] },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Profile DID join on Status should return single AppBskyActorProfile (not list/connection)
  expect(sdl).toContain('appBskyActorProfileByDid: AppBskyActorProfile')
})

it('collections do not get DID join to themselves', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should NOT have a self-join
  expect(sdl).not.toContain('xyzStatusphereStatusByDid')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement DID joins**

Update createRecordType to accept lexicons list and add DID join fields:

```js
function createRecordType(typeName, recordDef, lexiconId, allLexicons, recordTypes, connectionTypes) {
  return new GraphQLObjectType({
    name: typeName,
    description: `Record type: ${typeName}`,
    fields: () => {
      const fields = {
        uri: { type: GraphQLString },
        cid: { type: GraphQLString },
        did: { type: GraphQLString },
        indexedAt: { type: GraphQLString }
      }

      // Add lexicon properties
      for (const prop of recordDef.properties) {
        fields[prop.name] = { type: getGraphQLType(prop) }

        if (isForwardJoinField(prop)) {
          fields[prop.name + 'Resolved'] = { type: GraphQLString }  // Will be Record union
        }
      }

      // Add DID join fields to other collections
      for (const otherLexicon of allLexicons) {
        if (otherLexicon.id === lexiconId) continue  // Skip self
        if (!otherLexicon.defs.main || otherLexicon.defs.main.type !== 'record') continue

        const otherTypeName = nsidToTypeName(otherLexicon.id)
        const fieldName = nsidToFieldName(otherLexicon.id) + 'ByDid'
        const isUnique = otherLexicon.defs.main.key === 'literal:self'

        if (isUnique) {
          // Return single object for literal:self collections
          fields[fieldName] = {
            type: recordTypes[otherLexicon.id],
            description: `${otherTypeName} for this DID`
          }
        } else {
          // Return connection for multi-record collections
          fields[fieldName] = {
            type: connectionTypes[otherLexicon.id] || new GraphQLList(recordTypes[otherLexicon.id]),
            description: `${otherTypeName} records for this DID`
          }
        }
      }

      return fields
    }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add DID join fields between collections"
```

---

## Task 11: Connection Types for Pagination

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for connection types**

```js
// Add to Schema Builder describe block

it('generates connection types for pagination', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have connection type
  expect(sdl).toContain('type XyzStatusphereStatusConnection')
  expect(sdl).toContain('edges: [XyzStatusphereStatusEdge')
  expect(sdl).toContain('pageInfo: PageInfo')

  // Should have edge type
  expect(sdl).toContain('type XyzStatusphereStatusEdge')
  expect(sdl).toContain('node: XyzStatusphereStatus')
  expect(sdl).toContain('cursor: String')

  // Should have PageInfo type
  expect(sdl).toContain('type PageInfo')
  expect(sdl).toContain('hasNextPage: Boolean')
  expect(sdl).toContain('hasPreviousPage: Boolean')
})

it('query field returns connection type', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('xyzStatusphereStatus(')
  expect(sdl).toContain('first: Int')
  expect(sdl).toContain('after: String')
  expect(sdl).toContain('): XyzStatusphereStatusConnection')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement connection types**

```js
// Add to quickslice.js

/**
 * Create PageInfo type
 */
function createPageInfoType() {
  return new GraphQLObjectType({
    name: 'PageInfo',
    fields: {
      hasNextPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      hasPreviousPage: { type: new GraphQLNonNull(GraphQLBoolean) },
      startCursor: { type: GraphQLString },
      endCursor: { type: GraphQLString }
    }
  })
}

/**
 * Create edge type for a record type
 */
function createEdgeType(typeName, nodeType) {
  return new GraphQLObjectType({
    name: typeName + 'Edge',
    fields: {
      node: { type: nodeType },
      cursor: { type: new GraphQLNonNull(GraphQLString) }
    }
  })
}

/**
 * Create connection type for a record type
 */
function createConnectionType(typeName, nodeType, edgeType, pageInfoType) {
  return new GraphQLObjectType({
    name: typeName + 'Connection',
    fields: {
      edges: { type: new GraphQLList(edgeType) },
      pageInfo: { type: new GraphQLNonNull(pageInfoType) },
      totalCount: { type: GraphQLInt }
    }
  })
}
```

Update buildSchema to create connection types and use them in query fields.

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add connection types for relay-style pagination"
```

---

## Task 12: Where Input Types

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for where input types**

```js
// Add to Schema Builder describe block

it('generates where input type with field conditions', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'text', type: 'string', required: true },
          { name: 'count', type: 'integer', required: false }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have where input type
  expect(sdl).toContain('input XyzStatusphereStatusWhereInput')
  expect(sdl).toContain('text: StringFieldCondition')
  expect(sdl).toContain('count: IntFieldCondition')
  expect(sdl).toContain('AND: [XyzStatusphereStatusWhereInput')
  expect(sdl).toContain('OR: [XyzStatusphereStatusWhereInput')
})

it('generates field condition types with operators', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have field condition types
  expect(sdl).toContain('input StringFieldCondition')
  expect(sdl).toContain('eq: String')
  expect(sdl).toContain('in: [String')
  expect(sdl).toContain('contains: String')
  expect(sdl).toContain('gt: String')
  expect(sdl).toContain('gte: String')
  expect(sdl).toContain('lt: String')
  expect(sdl).toContain('lte: String')
})

it('query field accepts where argument', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('where: XyzStatusphereStatusWhereInput')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement where input types**

```js
// Add to quickslice.js

function createFieldConditionTypes() {
  const types = {}

  const operators = ['eq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte']

  const makeConditionType = (name, scalarType, listType) => {
    const fields = {}
    for (const op of operators) {
      if (op === 'in') {
        fields[op] = { type: new GraphQLList(scalarType) }
      } else {
        fields[op] = { type: scalarType }
      }
    }
    return new GraphQLInputObjectType({ name, fields })
  }

  types.String = makeConditionType('StringFieldCondition', GraphQLString)
  types.Int = makeConditionType('IntFieldCondition', GraphQLInt)
  types.Float = makeConditionType('FloatFieldCondition', GraphQLFloat)
  types.Boolean = makeConditionType('BooleanFieldCondition', GraphQLBoolean)

  return types
}

function createWhereInputType(typeName, recordDef, fieldConditionTypes) {
  const whereTypeName = typeName + 'WhereInput'

  // Need to use thunk for self-reference (AND/OR)
  return new GraphQLInputObjectType({
    name: whereTypeName,
    fields: () => {
      const fields = {}

      for (const prop of recordDef.properties) {
        const gqlType = mapLexiconType(prop.type)
        const conditionType = fieldConditionTypes[gqlType]
        if (conditionType) {
          fields[prop.name] = { type: conditionType }
        }
      }

      // Self-referential AND/OR for composable filters
      const selfType = whereInputTypes[typeName]
      fields.AND = { type: new GraphQLList(selfType) }
      fields.OR = { type: new GraphQLList(selfType) }

      return fields
    }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add where input types with field conditions"
```

---

## Task 13: Sort Input Types

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for sort types**

```js
// Add to Schema Builder describe block

it('generates sort field enum for primitive fields', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'text', type: 'string', required: true },
          { name: 'count', type: 'integer', required: false },
          { name: 'createdAt', type: 'string', required: true }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should have sort field enum
  expect(sdl).toContain('enum XyzStatusphereStatusSortField')
  expect(sdl).toContain('text')
  expect(sdl).toContain('count')
  expect(sdl).toContain('createdAt')
  expect(sdl).toContain('indexedAt')  // System field
})

it('query field accepts sortBy argument', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('sortBy: [XyzStatusphereStatusSortFieldInput')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement sort types**

```js
// Add to quickslice.js

function createSortDirectionEnum() {
  return new GraphQLEnumType({
    name: 'SortDirection',
    values: {
      ASC: { value: 'asc' },
      DESC: { value: 'desc' }
    }
  })
}

function createSortFieldEnum(typeName, recordDef) {
  const values = {
    // System fields are always sortable
    uri: { value: 'uri' },
    indexedAt: { value: 'indexedAt' }
  }

  // Add primitive lexicon fields
  for (const prop of recordDef.properties) {
    if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
      values[prop.name] = { value: prop.name }
    }
  }

  return new GraphQLEnumType({
    name: typeName + 'SortField',
    values
  })
}

function createSortFieldInputType(typeName, sortFieldEnum, sortDirectionEnum) {
  return new GraphQLInputObjectType({
    name: typeName + 'SortFieldInput',
    fields: {
      field: { type: new GraphQLNonNull(sortFieldEnum) },
      direction: { type: sortDirectionEnum }
    }
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add sort field enum and input types"
```

---

## Task 14: Mutation Types

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for mutations**

```js
// Add to Schema Builder describe block

it('generates mutation type with CRUD operations', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'text', type: 'string', required: true },
          { name: 'createdAt', type: 'string', required: true }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('type Mutation')
  expect(sdl).toContain('createXyzStatusphereStatus')
  expect(sdl).toContain('updateXyzStatusphereStatus')
  expect(sdl).toContain('deleteXyzStatusphereStatus')
})

it('generates input type for mutations', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: null,
        properties: [
          { name: 'text', type: 'string', required: true },
          { name: 'createdAt', type: 'string', required: true }
        ]
      },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('input XyzStatusphereStatusInput')
  expect(sdl).toContain('text: String')
  expect(sdl).toContain('createdAt: String!')  // Required field has non-null type
})

it('generates DeleteResult type', () => {
  const lexicons = [{
    id: 'xyz.statusphere.status',
    defs: {
      main: { type: 'record', key: null, properties: [{ name: 'text', type: 'string', required: true }] },
      others: {}
    }
  }]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  expect(sdl).toContain('type DeleteResult')
  expect(sdl).toContain('uri: String')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement mutation types**

```js
// Add to quickslice.js

function createDeleteResultType() {
  return new GraphQLObjectType({
    name: 'DeleteResult',
    fields: {
      uri: { type: GraphQLString, description: 'URI of deleted record' }
    }
  })
}

function createInputType(typeName, recordDef) {
  const fields = {}

  for (const prop of recordDef.properties) {
    const baseType = getGraphQLInputType(prop)
    fields[prop.name] = {
      type: prop.required ? new GraphQLNonNull(baseType) : baseType
    }
  }

  return new GraphQLInputObjectType({
    name: typeName + 'Input',
    fields
  })
}

function getGraphQLInputType(prop) {
  const typeMap = {
    'string': GraphQLString,
    'integer': GraphQLInt,
    'boolean': GraphQLBoolean,
    'number': GraphQLFloat
  }
  return typeMap[prop.type] || GraphQLString
}

function createMutationType(lexicons, recordTypes, inputTypes, deleteResultType) {
  const fields = {}

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue

    const typeName = nsidToTypeName(lexicon.id)
    const fieldName = nsidToFieldName(lexicon.id)

    fields['create' + typeName] = {
      type: recordTypes[lexicon.id],
      args: {
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
        rkey: { type: GraphQLString }
      }
    }

    fields['update' + typeName] = {
      type: recordTypes[lexicon.id],
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) }
      }
    }

    fields['delete' + typeName] = {
      type: deleteResultType,
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) }
      }
    }
  }

  return new GraphQLObjectType({
    name: 'Mutation',
    fields
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add mutation types for CRUD operations"
```

---

## Task 15: Query Compiler - Operation Generation

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for operation generation**

```js
// Add to quickslice.test.js
import { createAdapter } from './quickslice.js'

describe('Query Compiler', () => {
  it('generates findMany operation for collection query', async () => {
    const operations = []
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: { type: 'object', properties: { text: { type: 'string' } } }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op)
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    await adapter.execute(`
      query { xyzStatusphereStatus(first: 10) { edges { node { uri text } } } }
    `)

    expect(operations).toHaveLength(1)
    expect(operations[0].type).toBe('findMany')
    expect(operations[0].collection).toBe('xyz.statusphere.status')
    expect(operations[0].pagination.first).toBe(10)
  })

  it('generates operation with where clause', async () => {
    const operations = []
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: { type: 'object', properties: { text: { type: 'string' } } }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op)
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    await adapter.execute(`
      query {
        xyzStatusphereStatus(where: { text: { contains: "hello" } }) {
          edges { node { uri } }
        }
      }
    `)

    expect(operations[0].where).toEqual([
      { field: 'text', op: 'contains', value: 'hello' }
    ])
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement query compiler**

```js
// Update createAdapter in quickslice.js

export function createAdapter(lexicons, options) {
  const { query } = options

  const schema = buildSchemaWithResolvers(lexicons, query)

  return {
    schema,
    async execute(queryString, variables = {}) {
      const { graphql } = await import('graphql')
      const result = await graphql({
        schema,
        source: queryString,
        variableValues: variables
      })
      return result
    }
  }
}

function buildSchemaWithResolvers(lexicons, queryFn) {
  // ... schema building code ...

  // Add resolvers that generate operations
  const queryFields = {}

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue

    const fieldName = nsidToFieldName(lexicon.id)
    const typeName = nsidToTypeName(lexicon.id)

    queryFields[fieldName] = {
      type: connectionTypes[lexicon.id],
      args: {
        first: { type: GraphQLInt },
        after: { type: GraphQLString },
        last: { type: GraphQLInt },
        before: { type: GraphQLString },
        where: { type: whereInputTypes[lexicon.id] },
        sortBy: { type: new GraphQLList(sortInputTypes[lexicon.id]) }
      },
      resolve: async (_, args) => {
        const operation = {
          type: 'findMany',
          collection: lexicon.id,
          where: compileWhere(args.where),
          sort: compileSortBy(args.sortBy),
          pagination: {
            first: args.first,
            after: args.after,
            last: args.last,
            before: args.before
          }
        }

        const result = await queryFn(operation)
        return formatConnection(result)
      }
    }
  }

  // ... rest of schema building ...
}

function compileWhere(where) {
  if (!where) return []

  const conditions = []
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'AND' || field === 'OR') continue  // Handle separately
    if (!condition) continue

    for (const [op, value] of Object.entries(condition)) {
      if (value !== undefined && value !== null) {
        conditions.push({ field, op, value })
      }
    }
  }
  return conditions
}

function compileSortBy(sortBy) {
  if (!sortBy) return []
  return sortBy.map(s => ({ field: s.field, dir: s.direction || 'asc' }))
}

function formatConnection(result) {
  const { rows, hasNext, hasPrev } = result
  return {
    edges: rows.map((row, i) => ({
      node: row,
      cursor: Buffer.from(JSON.stringify({ i, uri: row.uri })).toString('base64')
    })),
    pageInfo: {
      hasNextPage: hasNext,
      hasPreviousPage: hasPrev,
      startCursor: rows.length > 0 ? rows[0].uri : null,
      endCursor: rows.length > 0 ? rows[rows.length - 1].uri : null
    },
    totalCount: rows.length
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add query compiler that generates operations"
```

---

## Task 16: Join Batching

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for join batching**

```js
// Add to Query Compiler describe block

it('batches forward join resolution', async () => {
  const operations = []
  const lexicons = [
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.feed.post',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              author: { type: 'string', format: 'at-uri' }
            }
          }
        }
      }
    }),
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.actor.profile',
      defs: {
        main: {
          type: 'record',
          key: 'literal:self',
          record: {
            type: 'object',
            properties: { displayName: { type: 'string' } }
          }
        }
      }
    })
  ]

  const adapter = createAdapter(lexicons, {
    query: async (op) => {
      operations.push(op)
      if (op.type === 'findMany' && op.collection === 'app.bsky.feed.post') {
        return {
          rows: [
            { uri: 'at://did1/app.bsky.feed.post/1', text: 'hello', author: 'at://did1/app.bsky.actor.profile/self', did: 'did1' },
            { uri: 'at://did2/app.bsky.feed.post/2', text: 'world', author: 'at://did2/app.bsky.actor.profile/self', did: 'did2' }
          ],
          hasNext: false,
          hasPrev: false
        }
      }
      if (op.type === 'findMany' && op.collection === 'app.bsky.actor.profile') {
        return {
          rows: [
            { uri: 'at://did1/app.bsky.actor.profile/self', displayName: 'User 1', did: 'did1' },
            { uri: 'at://did2/app.bsky.actor.profile/self', displayName: 'User 2', did: 'did2' }
          ],
          hasNext: false,
          hasPrev: false
        }
      }
      return { rows: [], hasNext: false, hasPrev: false }
    }
  })

  const result = await adapter.execute(`
    query {
      appBskyFeedPost(first: 10) {
        edges {
          node {
            uri
            text
            authorResolved { ... on AppBskyActorProfile { displayName } }
          }
        }
      }
    }
  `)

  // Should batch resolve - only 2 operations, not N+1
  expect(operations.length).toBeLessThanOrEqual(2)
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement join batching**

```js
// Add to quickslice.js

class JoinCollector {
  constructor() {
    this.pending = new Map()  // uri -> resolver callbacks
    this.resolved = new Map()  // uri -> resolved record
  }

  add(uri, callback) {
    if (this.resolved.has(uri)) {
      callback(this.resolved.get(uri))
      return
    }

    if (!this.pending.has(uri)) {
      this.pending.set(uri, [])
    }
    this.pending.get(uri).push(callback)
  }

  async flush(queryFn) {
    if (this.pending.size === 0) return

    const uris = Array.from(this.pending.keys())

    // Batch fetch all pending URIs
    const result = await queryFn({
      type: 'findMany',
      collection: '*',  // Special: resolve by URI
      where: [{ field: 'uri', op: 'in', value: uris }]
    })

    // Map results back
    for (const row of result.rows) {
      this.resolved.set(row.uri, row)
      const callbacks = this.pending.get(row.uri) || []
      for (const cb of callbacks) {
        cb(row)
      }
    }

    // Clear nulls for missing URIs
    for (const uri of uris) {
      if (!this.resolved.has(uri)) {
        const callbacks = this.pending.get(uri) || []
        for (const cb of callbacks) {
          cb(null)
        }
      }
    }

    this.pending.clear()
  }
}
```

Integrate into resolvers with deferred resolution.

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add dataloader-style join batching"
```

---

## Task 17: Aggregation Operations

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for aggregation**

```js
// Add to Query Compiler describe block

it('generates aggregate operation with count', async () => {
  const operations = []
  const lexicons = [parseLexicon({
    lexicon: 1,
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        record: { type: 'object', properties: { text: { type: 'string' } } }
      }
    }
  })]

  const adapter = createAdapter(lexicons, {
    query: async (op) => {
      operations.push(op)
      if (op.type === 'aggregate') {
        return { count: 42 }
      }
      return { rows: [], hasNext: false, hasPrev: false }
    }
  })

  const result = await adapter.execute(`
    query {
      xyzStatusphereStatusAggregate {
        count
      }
    }
  `)

  expect(operations.find(op => op.type === 'aggregate')).toBeDefined()
  expect(result.data.xyzStatusphereStatusAggregate.count).toBe(42)
})

it('generates aggregate operation with groupBy', async () => {
  const operations = []
  const lexicons = [parseLexicon({
    lexicon: 1,
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        record: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'datetime' }
          }
        }
      }
    }
  })]

  const adapter = createAdapter(lexicons, {
    query: async (op) => {
      operations.push(op)
      if (op.type === 'aggregate') {
        return {
          groups: [
            { status: 'active', count: 10 },
            { status: 'inactive', count: 5 }
          ]
        }
      }
      return { rows: [], hasNext: false, hasPrev: false }
    }
  })

  const result = await adapter.execute(`
    query {
      xyzStatusphereStatusAggregate(groupBy: [status]) {
        groups {
          status
          count
        }
      }
    }
  `)

  const aggOp = operations.find(op => op.type === 'aggregate')
  expect(aggOp.groupBy).toEqual(['status'])
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement aggregation types and resolvers**

```js
// Add to quickslice.js

function createAggregateResultType(typeName, recordDef) {
  const groupTypeName = typeName + 'AggregateGroup'

  // Create group type with groupable fields + count
  const groupType = new GraphQLObjectType({
    name: groupTypeName,
    fields: () => {
      const fields = { count: { type: GraphQLInt } }

      // Add groupable primitive fields
      for (const prop of recordDef.properties) {
        if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
          fields[prop.name] = { type: getGraphQLType(prop) }
        }
      }

      return fields
    }
  })

  return new GraphQLObjectType({
    name: typeName + 'AggregateResult',
    fields: {
      count: { type: GraphQLInt },
      groups: { type: new GraphQLList(groupType) }
    }
  })
}

function createAggregateGroupByEnum(typeName, recordDef) {
  const values = {}

  for (const prop of recordDef.properties) {
    if (['string', 'integer', 'number', 'boolean'].includes(prop.type)) {
      values[prop.name] = { value: prop.name }
    }
  }

  // Add date bucketing options for datetime fields
  for (const prop of recordDef.properties) {
    if (prop.format === 'datetime') {
      values[prop.name + '_day'] = { value: prop.name + '_day' }
      values[prop.name + '_week'] = { value: prop.name + '_week' }
      values[prop.name + '_month'] = { value: prop.name + '_month' }
    }
  }

  return new GraphQLEnumType({
    name: typeName + 'GroupByField',
    values
  })
}
```

Add aggregate query fields to buildSchema:

```js
// Inside buildSchema, after creating query fields for records:

for (const lexicon of lexicons) {
  if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue

  const typeName = nsidToTypeName(lexicon.id)
  const fieldName = nsidToFieldName(lexicon.id) + 'Aggregate'

  const aggregateResultType = createAggregateResultType(typeName, lexicon.defs.main)
  const groupByEnum = createAggregateGroupByEnum(typeName, lexicon.defs.main)

  queryFields[fieldName] = {
    type: aggregateResultType,
    args: {
      where: { type: whereInputTypes[lexicon.id] },
      groupBy: { type: new GraphQLList(groupByEnum) }
    },
    resolve: async (_, args) => {
      const operation = {
        type: 'aggregate',
        collection: lexicon.id,
        where: compileWhere(args.where),
        groupBy: args.groupBy || []
      }
      return await queryFn(operation)
    }
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add aggregation operations with groupBy support"
```

---

## Task 18: Mutation Resolvers

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for mutation resolvers**

```js
// Add to quickslice.test.js

describe('Mutation Resolvers', () => {
  it('generates create operation', async () => {
    const operations = []
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } }
          }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op)
        if (op.type === 'create') {
          return { uri: 'at://did:plc:test/xyz.statusphere.status/abc123', text: op.data.text }
        }
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    const result = await adapter.execute(`
      mutation {
        createXyzStatusphereStatus(input: { text: "hello" }) {
          uri
          text
        }
      }
    `)

    expect(operations[0].type).toBe('create')
    expect(operations[0].collection).toBe('xyz.statusphere.status')
    expect(operations[0].data.text).toBe('hello')
    expect(result.data.createXyzStatusphereStatus.uri).toContain('xyz.statusphere.status')
  })

  it('generates update operation with rkey', async () => {
    const operations = []
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } }
          }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op)
        if (op.type === 'update') {
          return { uri: `at://did:plc:test/xyz.statusphere.status/${op.rkey}`, text: op.data.text }
        }
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    await adapter.execute(`
      mutation {
        updateXyzStatusphereStatus(rkey: "abc123", input: { text: "updated" }) {
          uri
          text
        }
      }
    `)

    expect(operations[0].type).toBe('update')
    expect(operations[0].rkey).toBe('abc123')
    expect(operations[0].data.text).toBe('updated')
  })

  it('generates delete operation', async () => {
    const operations = []
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'xyz.statusphere.status',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            properties: { text: { type: 'string' } }
          }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op)
        if (op.type === 'delete') {
          return { uri: `at://did:plc:test/xyz.statusphere.status/${op.rkey}` }
        }
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    await adapter.execute(`
      mutation {
        deleteXyzStatusphereStatus(rkey: "abc123") {
          uri
        }
      }
    `)

    expect(operations[0].type).toBe('delete')
    expect(operations[0].rkey).toBe('abc123')
    expect(operations[0].collection).toBe('xyz.statusphere.status')
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement mutation resolvers**

```js
// Update createMutationType in quickslice.js to include resolvers

function createMutationType(lexicons, recordTypes, inputTypes, deleteResultType, queryFn) {
  const fields = {}

  for (const lexicon of lexicons) {
    if (!lexicon.defs.main || lexicon.defs.main.type !== 'record') continue

    const typeName = nsidToTypeName(lexicon.id)

    fields['create' + typeName] = {
      type: recordTypes[lexicon.id],
      args: {
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) },
        rkey: { type: GraphQLString }
      },
      resolve: async (_, args) => {
        const operation = {
          type: 'create',
          collection: lexicon.id,
          data: args.input,
          rkey: args.rkey || null
        }
        return await queryFn(operation)
      }
    }

    fields['update' + typeName] = {
      type: recordTypes[lexicon.id],
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) },
        input: { type: new GraphQLNonNull(inputTypes[lexicon.id]) }
      },
      resolve: async (_, args) => {
        const operation = {
          type: 'update',
          collection: lexicon.id,
          rkey: args.rkey,
          data: args.input
        }
        return await queryFn(operation)
      }
    }

    fields['delete' + typeName] = {
      type: deleteResultType,
      args: {
        rkey: { type: new GraphQLNonNull(GraphQLString) }
      },
      resolve: async (_, args) => {
        const operation = {
          type: 'delete',
          collection: lexicon.id,
          rkey: args.rkey
        }
        return await queryFn(operation)
      }
    }
  }

  return new GraphQLObjectType({
    name: 'Mutation',
    fields
  })
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add mutation resolvers for create/update/delete"
```

---

## Task 19: Reverse Join Discovery

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for reverse joins**

```js
// Add to Schema Builder describe block

it('generates reverse join fields for refs pointing to type', () => {
  const lexicons = [
    {
      id: 'app.bsky.feed.post',
      defs: {
        main: {
          type: 'record',
          key: null,
          properties: [
            { name: 'text', type: 'string', required: true }
          ]
        },
        others: {}
      }
    },
    {
      id: 'app.bsky.feed.like',
      defs: {
        main: {
          type: 'record',
          key: null,
          properties: [
            { name: 'subject', type: 'string', required: true, format: 'at-uri' },
            { name: 'createdAt', type: 'string', required: true }
          ]
        },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Post should have a reverse join field showing likes pointing to it
  expect(sdl).toContain('appBskyFeedLikeViaSubject')
})

it('reverse join fields return connection type', () => {
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
          properties: [{ name: 'subject', type: 'string', required: true, format: 'at-uri' }]
        },
        others: {}
      }
    }
  ]

  const schema = buildSchema(lexicons)
  const sdl = printSchema(schema)

  // Should be a connection, not a plain list
  expect(sdl).toContain('appBskyFeedLikeViaSubject(')
  expect(sdl).toContain('): AppBskyFeedLikeConnection')
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement reverse join discovery**

```js
// Add to quickslice.js

/**
 * Discover reverse joins by scanning lexicons for refs pointing to each type
 * @param {Lexicon[]} lexicons
 * @returns {Map<string, Array<{fromLexicon: string, fieldName: string}>>}
 */
function discoverReverseJoins(lexicons) {
  const reverseJoins = new Map()

  // Initialize map for each record type
  for (const lexicon of lexicons) {
    if (lexicon.defs.main?.type === 'record') {
      reverseJoins.set(lexicon.id, [])
    }
  }

  // Scan all lexicons for forward join fields
  for (const lexicon of lexicons) {
    if (!lexicon.defs.main?.type === 'record') continue

    for (const prop of lexicon.defs.main.properties) {
      if (isForwardJoinField(prop)) {
        // This field points to other records - add reverse join to all record types
        // (since at-uri can point to any type)
        for (const targetId of reverseJoins.keys()) {
          if (targetId !== lexicon.id) {
            reverseJoins.get(targetId).push({
              fromLexicon: lexicon.id,
              fieldName: prop.name
            })
          }
        }
      }
    }
  }

  return reverseJoins
}
```

Update createRecordType to add reverse join fields:

```js
// Inside createRecordType fields builder, after DID joins:

// Add reverse join fields
const reverseJoins = reverseJoinMap.get(lexiconId) || []
for (const { fromLexicon, fieldName } of reverseJoins) {
  const fromTypeName = nsidToTypeName(fromLexicon)
  const reverseFieldName = nsidToFieldName(fromLexicon) + 'Via' + fieldName.charAt(0).toUpperCase() + fieldName.slice(1)

  fields[reverseFieldName] = {
    type: connectionTypes[fromLexicon],
    args: {
      first: { type: GraphQLInt },
      after: { type: GraphQLString }
    },
    description: `${fromTypeName} records pointing to this via ${fieldName}`
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add reverse join discovery and Via connection fields"
```

---

## Task 20: Full Integration Test

**Files:**
- Modify: `quickslice.test.js`

**Step 1: Write comprehensive integration test**

```js
// Add to quickslice.test.js

describe('Integration', () => {
  const blueskyLexicons = [
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.actor.profile',
      defs: {
        main: {
          type: 'record',
          key: 'literal:self',
          record: {
            type: 'object',
            properties: {
              displayName: { type: 'string' },
              description: { type: 'string' },
              avatar: { type: 'blob' }
            }
          }
        }
      }
    }),
    parseLexicon({
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
              createdAt: { type: 'string', format: 'datetime' },
              reply: { type: 'ref', ref: 'com.atproto.repo.strongRef' }
            }
          }
        }
      }
    }),
    parseLexicon({
      lexicon: 1,
      id: 'app.bsky.feed.like',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['subject', 'createdAt'],
            properties: {
              subject: { type: 'ref', ref: 'com.atproto.repo.strongRef' },
              createdAt: { type: 'string', format: 'datetime' }
            }
          }
        }
      }
    })
  ]

  it('creates schema with all expected types', () => {
    const schema = buildSchema(blueskyLexicons)
    const sdl = printSchema(schema)

    // Record types
    expect(sdl).toContain('type AppBskyActorProfile')
    expect(sdl).toContain('type AppBskyFeedPost')
    expect(sdl).toContain('type AppBskyFeedLike')

    // Connection types
    expect(sdl).toContain('type AppBskyFeedPostConnection')
    expect(sdl).toContain('type AppBskyFeedLikeConnection')

    // Input types
    expect(sdl).toContain('input AppBskyFeedPostWhereInput')
    expect(sdl).toContain('input AppBskyFeedPostInput')

    // Mutations
    expect(sdl).toContain('createAppBskyFeedPost')
    expect(sdl).toContain('updateAppBskyFeedPost')
    expect(sdl).toContain('deleteAppBskyFeedPost')
  })

  it('executes complex query with joins', async () => {
    const mockData = {
      posts: [
        { uri: 'at://did1/app.bsky.feed.post/1', text: 'Hello', createdAt: '2024-01-01T00:00:00Z', did: 'did1' },
        { uri: 'at://did2/app.bsky.feed.post/2', text: 'World', createdAt: '2024-01-02T00:00:00Z', did: 'did2' }
      ],
      profiles: [
        { uri: 'at://did1/app.bsky.actor.profile/self', displayName: 'User 1', did: 'did1' },
        { uri: 'at://did2/app.bsky.actor.profile/self', displayName: 'User 2', did: 'did2' }
      ]
    }

    const adapter = createAdapter(blueskyLexicons, {
      query: async (op) => {
        if (op.collection === 'app.bsky.feed.post') {
          return { rows: mockData.posts, hasNext: false, hasPrev: false }
        }
        if (op.collection === 'app.bsky.actor.profile') {
          const dids = op.where?.find(w => w.field === 'did')?.value || []
          const filtered = mockData.profiles.filter(p => dids.includes(p.did))
          return { rows: filtered, hasNext: false, hasPrev: false }
        }
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    const result = await adapter.execute(`
      query {
        appBskyFeedPost(first: 10) {
          edges {
            node {
              uri
              text
              appBskyActorProfileByDid {
                displayName
              }
            }
          }
        }
      }
    `)

    expect(result.errors).toBeUndefined()
    expect(result.data.appBskyFeedPost.edges).toHaveLength(2)
    expect(result.data.appBskyFeedPost.edges[0].node.text).toBe('Hello')
  })

  it('executes mutation and returns result', async () => {
    const adapter = createAdapter(blueskyLexicons, {
      query: async (op) => {
        if (op.type === 'create') {
          return {
            uri: 'at://did:plc:test/app.bsky.feed.post/new123',
            ...op.data,
            did: 'did:plc:test',
            cid: 'bafycid123',
            indexedAt: new Date().toISOString()
          }
        }
        return { rows: [], hasNext: false, hasPrev: false }
      }
    })

    const result = await adapter.execute(`
      mutation {
        createAppBskyFeedPost(input: { text: "New post", createdAt: "2024-01-01T00:00:00Z" }) {
          uri
          text
          createdAt
        }
      }
    `)

    expect(result.errors).toBeUndefined()
    expect(result.data.createAppBskyFeedPost.uri).toContain('app.bsky.feed.post')
    expect(result.data.createAppBskyFeedPost.text).toBe('New post')
  })
})
```

**Step 2: Run tests**

Run: `npm test`
Expected: PASS (or failures that reveal real integration issues)

**Step 3: Fix any integration issues discovered**

Fix issues as they arise during test execution.

**Step 4: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "test: add comprehensive integration tests"
```

---

## Task 21: Error Handling

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write failing tests for error handling**

```js
// Add to quickslice.test.js

describe('Error Handling', () => {
  it('throws on invalid lexicon format', () => {
    expect(() => parseLexicon({})).toThrow('Lexicon missing required field: id')
  })

  it('throws on lexicon version mismatch', () => {
    expect(() => parseLexicon({ lexicon: 2, id: 'test.invalid' })).toThrow('Unsupported lexicon version')
  })

  it('returns GraphQL error for invalid query', async () => {
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'test.record',
      defs: {
        main: {
          type: 'record',
          record: { type: 'object', properties: { text: { type: 'string' } } }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false })
    })

    const result = await adapter.execute(`
      query { nonExistentField { id } }
    `)

    expect(result.errors).toBeDefined()
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('propagates adapter query errors as GraphQL errors', async () => {
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'test.record',
      defs: {
        main: {
          type: 'record',
          record: { type: 'object', properties: { text: { type: 'string' } } }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async () => {
        throw new Error('Database connection failed')
      }
    })

    const result = await adapter.execute(`
      query { testRecord { edges { node { uri } } } }
    `)

    expect(result.errors).toBeDefined()
    expect(result.errors[0].message).toContain('Database connection failed')
  })

  it('validates operation before execution', async () => {
    const lexicons = [parseLexicon({
      lexicon: 1,
      id: 'test.record',
      defs: {
        main: {
          type: 'record',
          record: {
            type: 'object',
            required: ['text'],
            properties: { text: { type: 'string' } }
          }
        }
      }
    })]

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false })
    })

    // Missing required field
    const result = await adapter.execute(`
      mutation {
        createTestRecord(input: {}) {
          uri
        }
      }
    `)

    expect(result.errors).toBeDefined()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL

**Step 3: Implement error handling**

```js
// Update parseLexicon in quickslice.js

export function parseLexicon(json) {
  if (!json.id) {
    throw new Error('Lexicon missing required field: id')
  }

  if (json.lexicon !== undefined && json.lexicon !== 1) {
    throw new Error(`Unsupported lexicon version: ${json.lexicon}`)
  }

  // ... rest of implementation
}

// Add QuicksliceError class
export class QuicksliceError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'QuicksliceError'
    this.code = code
    this.details = details
  }
}

// Error codes
export const ErrorCodes = {
  INVALID_LEXICON: 'INVALID_LEXICON',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  QUERY_FAILED: 'QUERY_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "feat: add error handling with QuicksliceError class"
```

---

## Task 22: Final Cleanup and Exports

**Files:**
- Modify: `quickslice.js`
- Modify: `quickslice.test.js`

**Step 1: Write tests for public API exports**

```js
// Add to quickslice.test.js

describe('Public API', () => {
  it('exports createAdapter as main entry point', async () => {
    const { createAdapter } = await import('./quickslice.js')
    expect(typeof createAdapter).toBe('function')
  })

  it('exports parseLexicon for parsing lexicon JSON', async () => {
    const { parseLexicon } = await import('./quickslice.js')
    expect(typeof parseLexicon).toBe('function')
  })

  it('exports buildSchema for schema-only use cases', async () => {
    const { buildSchema } = await import('./quickslice.js')
    expect(typeof buildSchema).toBe('function')
  })

  it('exports utility functions', async () => {
    const {
      nsidToTypeName,
      nsidToFieldName,
      nsidToCollectionName,
      parseRefUri,
      refToTypeName,
      mapLexiconType
    } = await import('./quickslice.js')

    expect(typeof nsidToTypeName).toBe('function')
    expect(typeof nsidToFieldName).toBe('function')
    expect(typeof nsidToCollectionName).toBe('function')
    expect(typeof parseRefUri).toBe('function')
    expect(typeof refToTypeName).toBe('function')
    expect(typeof mapLexiconType).toBe('function')
  })

  it('exports error types', async () => {
    const { QuicksliceError, ErrorCodes } = await import('./quickslice.js')
    expect(QuicksliceError).toBeDefined()
    expect(ErrorCodes).toBeDefined()
  })
})
```

**Step 2: Run tests**

Run: `npm test`
Expected: PASS

**Step 3: Ensure all exports are properly declared**

Verify quickslice.js has all exports at the top or in a clear exports section:

```js
// At end of quickslice.js, ensure all public API is exported:

export {
  // Main entry point
  createAdapter,

  // Schema building
  buildSchema,
  parseLexicon,

  // Utilities
  nsidToTypeName,
  nsidToFieldName,
  nsidToCollectionName,
  parseRefUri,
  refToTypeName,
  mapLexiconType,

  // Error handling
  QuicksliceError,
  ErrorCodes
}
```

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add quickslice.js quickslice.test.js
git commit -m "chore: finalize public API exports"
```

---

## Execution

This plan is ready for execution. Each task is self-contained with:
- Clear test expectations
- Minimal implementation
- Immediate verification
- Commit checkpoint

Total tasks: 22
