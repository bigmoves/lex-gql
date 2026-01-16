// lex-gql.test.js - Tests using vitest

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  buildSchema,
  createAdapter,
  ErrorCodes,
  hydrateBlobs,
  hydrateRecord,
  LexGqlError,
  mapLexiconType,
  nsidToCollectionName,
  nsidToFieldName,
  nsidToTypeName,
  parseLexicon,
  parseRefUri,
  refToTypeName,
  resolveRefKey,
} from './lex-gql.js';

// Load all lexicon files recursively
function loadLexicons(dir) {
  const lexicons = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      lexicons.push(...loadLexicons(fullPath));
    } else if (entry.endsWith('.json')) {
      const content = JSON.parse(readFileSync(fullPath, 'utf-8'));
      lexicons.push({ path: fullPath, content });
    }
  }
  return lexicons;
}

const LEXICONS_DIR = new URL('./test/lexicons', import.meta.url).pathname;
const realLexicons = loadLexicons(LEXICONS_DIR);

describe('NSID utilities', () => {
  describe('nsidToTypeName', () => {
    it('converts simple NSID to PascalCase', () => {
      expect(nsidToTypeName('xyz.statusphere.status')).toBe('XyzStatusphereStatus');
    });

    it('converts app.bsky NSID to PascalCase', () => {
      expect(nsidToTypeName('app.bsky.feed.post')).toBe('AppBskyFeedPost');
    });

    it('converts com.atproto NSID to PascalCase', () => {
      expect(nsidToTypeName('com.atproto.repo.createRecord')).toBe('ComAtprotoRepoCreateRecord');
    });
  });

  describe('nsidToFieldName', () => {
    it('converts simple NSID to camelCase', () => {
      expect(nsidToFieldName('xyz.statusphere.status')).toBe('xyzStatusphereStatus');
    });

    it('converts app.bsky NSID to camelCase', () => {
      expect(nsidToFieldName('app.bsky.feed.post')).toBe('appBskyFeedPost');
    });

    it('converts com.atproto NSID to camelCase', () => {
      expect(nsidToFieldName('com.atproto.repo.createRecord')).toBe('comAtprotoRepoCreateRecord');
    });
  });

  describe('nsidToCollectionName', () => {
    it('extracts last segment from NSID', () => {
      expect(nsidToCollectionName('xyz.statusphere.status')).toBe('status');
    });

    it('extracts last segment from app.bsky NSID', () => {
      expect(nsidToCollectionName('app.bsky.feed.post')).toBe('post');
    });

    it('extracts last segment from com.atproto NSID', () => {
      expect(nsidToCollectionName('com.atproto.repo.createRecord')).toBe('createRecord');
    });
  });
});

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
              createdAt: { type: 'string' },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);

    expect(result.id).toBe('xyz.statusphere.status');
    expect(result.defs.main).toBeDefined();
    expect(result.defs.main.type).toBe('record');
    expect(result.defs.main.properties).toHaveLength(2);
  });

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
              bio: { type: 'string' },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);

    expect(result.id).toBe('xyz.statusphere.profile');
    expect(result.defs.main.properties).toHaveLength(2);
    // All properties should be optional (required = false)
    expect(result.defs.main.properties.every((p) => !p.required)).toBe(true);
  });

  it('throws on missing id', () => {
    const json = {
      lexicon: 1,
      defs: { main: { type: 'record' } },
    };

    expect(() => parseLexicon(json)).toThrow();
  });

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
                  ref: 'fm.teal.alpha.feed.defs#artist',
                },
              },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);
    const artistsProp = result.defs.main.properties.find((p) => p.name === 'artists');

    expect(artistsProp.type).toBe('array');
    expect(artistsProp.items.type).toBe('ref');
    expect(artistsProp.items.ref).toBe('fm.teal.alpha.feed.defs#artist');
  });

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
                  refs: ['fm.teal.alpha.feed.defs#artist', 'fm.teal.alpha.feed.defs#band'],
                },
              },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);
    const creatorsProp = result.defs.main.properties.find((p) => p.name === 'creators');

    expect(creatorsProp.type).toBe('array');
    expect(creatorsProp.items.type).toBe('union');
    expect(creatorsProp.items.refs).toEqual([
      'fm.teal.alpha.feed.defs#artist',
      'fm.teal.alpha.feed.defs#band',
    ]);
  });

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
                refs: ['app.bsky.embed.images', 'app.bsky.embed.video'],
              },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);
    const embedProp = result.defs.main.properties.find((p) => p.name === 'embed');

    expect(embedProp.type).toBe('union');
    expect(embedProp.refs).toEqual(['app.bsky.embed.images', 'app.bsky.embed.video']);
  });

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
                items: { type: 'string' },
              },
            },
          },
        },
      },
    };

    const result = parseLexicon(json);
    const artistNamesProp = result.defs.main.properties.find((p) => p.name === 'artistNames');

    expect(artistNamesProp.type).toBe('array');
    expect(artistNamesProp.items.type).toBe('string');
    expect(artistNamesProp.items.ref).toBeNull();
  });

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
              items: { ref: '#selfLabel', type: 'ref' },
            },
          },
        },
        selfLabel: {
          type: 'object',
          required: ['val'],
          properties: {
            val: { type: 'string' },
          },
        },
      },
    };

    const result = parseLexicon(json);

    expect(result.id).toBe('com.atproto.label.defs');
    expect(result.defs.main).toBeNull();
    expect(Object.keys(result.defs.others)).toHaveLength(2);
    expect(result.defs.others.selfLabels).toBeDefined();
    expect(result.defs.others.selfLabel).toBeDefined();
  });

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
              items: { refs: ['#mention', '#link', '#tag'], type: 'union' },
            },
          },
        },
        mention: {
          type: 'object',
          required: ['did'],
          properties: { did: { type: 'string', format: 'did' } },
        },
        link: {
          type: 'object',
          required: ['uri'],
          properties: { uri: { type: 'string', format: 'uri' } },
        },
        tag: {
          type: 'object',
          required: ['tag'],
          properties: { tag: { type: 'string' } },
        },
        byteSlice: {
          type: 'object',
          required: ['byteStart', 'byteEnd'],
          properties: {
            byteStart: { type: 'integer' },
            byteEnd: { type: 'integer' },
          },
        },
      },
    };

    const result = parseLexicon(json);

    expect(result.id).toBe('app.bsky.richtext.facet');
    expect(result.defs.main).toBeDefined();
    expect(result.defs.main.type).toBe('object');
    expect(Object.keys(result.defs.others)).toHaveLength(4);
    expect(result.defs.others.mention).toBeDefined();
    expect(result.defs.others.link).toBeDefined();
    expect(result.defs.others.tag).toBeDefined();
    expect(result.defs.others.byteSlice).toBeDefined();
  });
});

describe('Type Mapper', () => {
  it('maps string to GraphQL String', () => {
    expect(mapLexiconType('string')).toBe('String');
  });

  it('maps integer to GraphQL Int', () => {
    expect(mapLexiconType('integer')).toBe('Int');
  });

  it('maps boolean to GraphQL Boolean', () => {
    expect(mapLexiconType('boolean')).toBe('Boolean');
  });

  it('maps number to GraphQL Float', () => {
    expect(mapLexiconType('number')).toBe('Float');
  });

  it('maps blob to Blob object type', () => {
    expect(mapLexiconType('blob')).toBe('Blob');
  });

  it('maps bytes to String (base64)', () => {
    expect(mapLexiconType('bytes')).toBe('String');
  });

  it('maps cid-link to String', () => {
    expect(mapLexiconType('cid-link')).toBe('String');
  });

  it('maps ref to String (URI)', () => {
    expect(mapLexiconType('ref')).toBe('String');
  });

  it('maps union to String (fallback)', () => {
    expect(mapLexiconType('union')).toBe('String');
  });

  it('maps unknown types to String', () => {
    expect(mapLexiconType('somethingWeird')).toBe('String');
  });
});

describe('Ref URI Parser', () => {
  it('parses full NSID without fragment', () => {
    expect(parseRefUri('xyz.statusphere.profile')).toEqual({
      nsid: 'xyz.statusphere.profile',
      fragment: 'main',
    });
  });

  it('parses NSID with fragment', () => {
    expect(parseRefUri('xyz.statusphere.post#embed')).toEqual({
      nsid: 'xyz.statusphere.post',
      fragment: 'embed',
    });
  });

  it('parses local ref (#fragment)', () => {
    expect(parseRefUri('#mention')).toEqual({
      nsid: null,
      fragment: 'mention',
    });
  });
});

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

describe('refToTypeName', () => {
  it('converts full ref to PascalCase type name', () => {
    expect(refToTypeName('fm.teal.alpha.feed.defs#artist')).toBe('FmTealAlphaFeedDefsArtist');
  });

  it('converts simple ref to PascalCase type name', () => {
    expect(refToTypeName('app.bsky.feed.post')).toBe('AppBskyFeedPost');
  });
});

describe('Schema Builder', () => {
  it('builds schema with system fields for record type', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'text', type: 'string', required: true },
              { name: 'createdAt', type: 'string', required: true },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have Query type
    expect(sdl).toContain('type Query');

    // Should have record type with system fields
    expect(sdl).toContain('type XyzStatusphereStatus');
    expect(sdl).toContain('uri: String');
    expect(sdl).toContain('cid: String');
    expect(sdl).toContain('did: String');
    expect(sdl).toContain('indexedAt: String');

    // Should have lexicon fields
    expect(sdl).toContain('text: String');
    expect(sdl).toContain('createdAt: String');
  });

  it('builds query field with correct name', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Query field should use camelCase
    expect(sdl).toContain('xyzStatusphereStatus');
  });

  it('generates forward join field for strongRef', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'displayName', type: 'string', required: true },
              {
                name: 'pinnedPost',
                type: 'ref',
                required: false,
                ref: 'com.atproto.repo.strongRef',
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('pinnedPostResolved');
  });

  it('generates forward join field for at-uri format', () => {
    const lexicons = [
      {
        id: 'app.bsky.feed.like',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              {
                name: 'subject',
                type: 'string',
                required: true,
                format: 'at-uri',
              },
              {
                name: 'createdAt',
                type: 'string',
                required: true,
                format: 'datetime',
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('subjectResolved');
  });

  it('does not generate Resolved fields for non-join fields', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'status', type: 'string', required: true },
              {
                name: 'createdAt',
                type: 'string',
                required: true,
                format: 'datetime',
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).not.toContain('statusResolved');
    expect(sdl).not.toContain('createdAtResolved');
  });

  it('generates DID join fields between collections', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Status should have DID join to Profile
    expect(sdl).toContain('appBskyActorProfileByDid');
    // Profile should have DID join to Status
    expect(sdl).toContain('xyzStatusphereStatusByDid');
  });

  it('literal:self collections return single object for DID join', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Profile DID join on Status should return single AppBskyActorProfile (not list)
    expect(sdl).toContain('appBskyActorProfileByDid: AppBskyActorProfile');
  });

  it('collections do not get DID join to themselves', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should NOT have a self-join
    expect(sdl).not.toContain('xyzStatusphereStatusByDid');
  });

  it('generates connection types for pagination', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have connection type
    expect(sdl).toContain('type XyzStatusphereStatusConnection');
    expect(sdl).toContain('edges: [XyzStatusphereStatusEdge');
    expect(sdl).toContain('pageInfo: PageInfo');

    // Should have edge type
    expect(sdl).toContain('type XyzStatusphereStatusEdge');
    expect(sdl).toContain('node: XyzStatusphereStatus');
    expect(sdl).toContain('cursor: String');

    // Should have PageInfo type
    expect(sdl).toContain('type PageInfo');
    expect(sdl).toContain('hasNextPage: Boolean');
    expect(sdl).toContain('hasPreviousPage: Boolean');
  });

  it('query field returns connection type', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('xyzStatusphereStatus(');
    expect(sdl).toContain('first: Int');
    expect(sdl).toContain('after: String');
    expect(sdl).toContain('): XyzStatusphereStatusConnection');
  });

  it('generates where input type with field conditions', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'text', type: 'string', required: true },
              { name: 'count', type: 'integer', required: false },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have where input type
    expect(sdl).toContain('input XyzStatusphereStatusWhereInput');
    expect(sdl).toContain('text: StringFieldCondition');
    expect(sdl).toContain('count: IntFieldCondition');
    expect(sdl).toContain('AND: [XyzStatusphereStatusWhereInput');
    expect(sdl).toContain('OR: [XyzStatusphereStatusWhereInput');
  });

  it('generates field condition types with operators', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have field condition types
    expect(sdl).toContain('input StringFieldCondition');
    expect(sdl).toContain('eq: String');
    expect(sdl).toContain('in: [String');
    expect(sdl).toContain('contains: String');
    expect(sdl).toContain('gt: String');
    expect(sdl).toContain('gte: String');
    expect(sdl).toContain('lt: String');
    expect(sdl).toContain('lte: String');
  });

  it('query field accepts where argument', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('where: XyzStatusphereStatusWhereInput');
  });

  it('generates sort field enum for primitive fields', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'text', type: 'string', required: true },
              { name: 'count', type: 'integer', required: false },
              { name: 'createdAt', type: 'string', required: true },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have sort field enum
    expect(sdl).toContain('enum XyzStatusphereStatusSortField');
    expect(sdl).toContain('text');
    expect(sdl).toContain('count');
    expect(sdl).toContain('createdAt');
    expect(sdl).toContain('indexedAt'); // System field
  });

  it('query field accepts sortBy argument', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('sortBy: [XyzStatusphereStatusSortFieldInput');
  });

  it('generates mutation type with CRUD operations', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'text', type: 'string', required: true },
              { name: 'createdAt', type: 'string', required: true },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('type Mutation');
    expect(sdl).toContain('createXyzStatusphereStatus');
    expect(sdl).toContain('updateXyzStatusphereStatus');
    expect(sdl).toContain('deleteXyzStatusphereStatus');
  });

  it('generates input type for mutations', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              { name: 'text', type: 'string', required: true },
              { name: 'createdAt', type: 'string', required: true },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('input XyzStatusphereStatusInput');
    expect(sdl).toContain('text: String!');
    expect(sdl).toContain('createdAt: String!');
  });

  it('generates DeleteResult type', () => {
    const lexicons = [
      {
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('type DeleteResult');
    expect(sdl).toContain('uri: String');
  });

  it('generates reverse join fields for refs pointing to type', () => {
    const lexicons = [
      {
        id: 'app.bsky.feed.post',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.feed.like',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              {
                name: 'subject',
                type: 'string',
                required: true,
                format: 'at-uri',
              },
              { name: 'createdAt', type: 'string', required: true },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Post should have a reverse join field showing likes pointing to it
    expect(sdl).toContain('appBskyFeedLikeViaSubject');
  });

  it('reverse join fields return connection type', () => {
    const lexicons = [
      {
        id: 'app.bsky.feed.post',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.feed.like',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              {
                name: 'subject',
                type: 'string',
                required: true,
                format: 'at-uri',
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should be a connection, not a plain list
    expect(sdl).toContain('appBskyFeedLikeViaSubject(');
    expect(sdl).toContain('): AppBskyFeedLikeConnection');
  });

  it('generates Blob object type for blob fields', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [
              { name: 'displayName', type: 'string', required: false },
              { name: 'avatar', type: 'blob', required: false },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have Blob type
    expect(sdl).toContain('type Blob');
    expect(sdl).toContain('ref: String!');
    expect(sdl).toContain('mimeType: String!');
    expect(sdl).toContain('size: Int!');

    // Avatar field should be Blob type
    expect(sdl).toContain('avatar: Blob');
  });

  it('generates url field on Blob type with preset argument', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('url(');
    expect(sdl).toContain('preset: String');
    expect(sdl).toContain('): String!');
  });

  it('generates ComAtprotoRepoStrongRef type for strongRef refs', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [
              {
                name: 'pinnedPost',
                type: 'ref',
                ref: 'com.atproto.repo.strongRef',
                required: false,
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have StrongRef type
    expect(sdl).toContain('type ComAtprotoRepoStrongRef');
    expect(sdl).toContain('cid: String!');
    expect(sdl).toContain('uri: String!');

    // pinnedPost should use StrongRef type
    expect(sdl).toContain('pinnedPost: ComAtprotoRepoStrongRef');
  });

  it('generates Record union type for resolved references', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.feed.post',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have Record union containing all record types
    expect(sdl).toContain('union Record');
    expect(sdl).toContain('AppBskyActorProfile');
    expect(sdl).toContain('AppBskyFeedPost');
  });

  it('includes collection and actorHandle system fields', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    expect(sdl).toContain('collection: String');
    expect(sdl).toContain('actorHandle: String');
  });

  it('generates nested object types from lexicon others defs', () => {
    const lexicons = [
      {
        id: 'app.bsky.richtext.facet',
        defs: {
          main: {
            type: 'object',
            properties: [
              { name: 'index', type: 'ref', ref: '#byteSlice', required: true },
              {
                name: 'features',
                type: 'array',
                items: { type: 'union', refs: ['#mention', '#link'] },
                required: true,
              },
            ],
          },
          others: {
            byteSlice: {
              type: 'object',
              properties: [
                { name: 'byteStart', type: 'integer', required: true },
                { name: 'byteEnd', type: 'integer', required: true },
              ],
            },
            mention: {
              type: 'object',
              properties: [{ name: 'did', type: 'string', required: true }],
            },
            link: {
              type: 'object',
              properties: [{ name: 'uri', type: 'string', required: true }],
            },
          },
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should generate nested types with full NSID prefix
    expect(sdl).toContain('type AppBskyRichtextFacetByteSlice');
    expect(sdl).toContain('byteStart: Int');
    expect(sdl).toContain('byteEnd: Int');
    expect(sdl).toContain('type AppBskyRichtextFacetMention');
    expect(sdl).toContain('type AppBskyRichtextFacetLink');
  });

  it('uses SortFieldInput naming convention', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should use SortFieldInput, not SortInput
    expect(sdl).toContain('input AppBskyActorProfileSortFieldInput');
    expect(sdl).not.toContain('input AppBskyActorProfileSortInput');
  });

  it('uses Aggregated naming convention for aggregate results', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should use Aggregated, not AggregateResult
    expect(sdl).toContain('type AppBskyActorProfileAggregated');
    expect(sdl).not.toContain('type AppBskyActorProfileAggregateResult');
  });

  it('uses GroupByField enum naming convention', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should use GroupByField
    expect(sdl).toContain('enum AppBskyActorProfileGroupByField');
  });

  it('generates per-type FieldCondition input types', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'displayName', type: 'string', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Should have per-type field condition
    expect(sdl).toContain('input AppBskyActorProfileFieldCondition');
  });

  it('adds sortBy and where arguments to reverse join fields', () => {
    const lexicons = [
      {
        id: 'app.bsky.feed.post',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [{ name: 'text', type: 'string', required: true }],
          },
          others: {},
        },
      },
      {
        id: 'app.bsky.feed.like',
        defs: {
          main: {
            type: 'record',
            key: null,
            properties: [
              {
                name: 'subject',
                type: 'string',
                format: 'at-uri',
                required: true,
              },
            ],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const sdl = printSchema(schema);

    // Extract the AppBskyFeedPost type definition to check reverse join args
    const postTypeMatch = sdl.match(/type AppBskyFeedPost \{[\s\S]*?\n\}/);
    expect(postTypeMatch).not.toBeNull();
    const postTypeDef = postTypeMatch[0];

    // Reverse join field should have sortBy and where arguments
    expect(postTypeDef).toContain('appBskyFeedLikeViaSubject(');
    expect(postTypeDef).toContain('sortBy:');
    expect(postTypeDef).toContain('where:');
  });
});

describe('Real Lexicons (smoke tests)', () => {
  it.each(realLexicons)('parses $content.id without throwing', ({ content }) => {
    expect(() => parseLexicon(content)).not.toThrow();
  });

  it('loaded at least 10 lexicons', () => {
    expect(realLexicons.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Query Compiler', () => {
  it('generates findMany operation for collection query', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    await adapter.execute(`
      query { xyzStatusphereStatus(first: 10) { edges { node { uri text } } } }
    `);

    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('findMany');
    expect(operations[0].collection).toBe('xyz.statusphere.status');
    expect(operations[0].pagination.first).toBe(10);
  });

  it('generates operation with where clause', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    await adapter.execute(`
      query {
        xyzStatusphereStatus(where: { text: { contains: "hello" } }) {
          edges { node { uri } }
        }
      }
    `);

    expect(operations[0].where).toEqual([{ field: 'text', op: 'contains', value: 'hello' }]);
  });

  it('batches forward join resolution', async () => {
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
              properties: {
                text: { type: 'string' },
                author: { type: 'string', format: 'at-uri' },
              },
            },
          },
        },
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
              properties: { displayName: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'findMany' && op.collection === 'app.bsky.feed.post') {
          return {
            rows: [
              {
                uri: 'at://did1/app.bsky.feed.post/1',
                text: 'hello',
                author: 'at://did1/app.bsky.actor.profile/self',
                did: 'did1',
              },
              {
                uri: 'at://did2/app.bsky.feed.post/2',
                text: 'world',
                author: 'at://did2/app.bsky.actor.profile/self',
                did: 'did2',
              },
            ],
            hasNext: false,
            hasPrev: false,
          };
        }
        if (op.type === 'findMany' && op.collection === '*') {
          // Batched URI resolution
          const uris = op.where.find((w) => w.field === 'uri')?.value || [];
          return {
            rows: uris.map((uri) => {
              if (uri.includes('profile')) {
                const did = uri.split('/')[2];
                return { uri, displayName: `User ${did}`, did };
              }
              return { uri };
            }),
            hasNext: false,
            hasPrev: false,
          };
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
              authorResolved {
                uri
                displayName
              }
            }
          }
        }
      }
    `);

    // Should batch resolve - only 2 operations, not N+1
    expect(operations.length).toBeLessThanOrEqual(2);
    // Verify the resolved data came back
    expect(result.data.appBskyFeedPost.edges[0].node.authorResolved.displayName).toBe('User did1');
  });

  it('generates aggregate operation with count', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'aggregate') {
          return { count: 42 };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    const result = await adapter.execute(`
      query {
        xyzStatusphereStatusAggregate {
          count
        }
      }
    `);

    expect(operations.find((op) => op.type === 'aggregate')).toBeDefined();
    expect(result.data.xyzStatusphereStatusAggregate.count).toBe(42);
  });

  it('generates aggregate operation with groupBy', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'datetime' },
              },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'aggregate') {
          return {
            groups: [
              { status: 'active', count: 10 },
              { status: 'inactive', count: 5 },
            ],
          };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    const _result = await adapter.execute(`
      query {
        xyzStatusphereStatusAggregate(groupBy: [status]) {
          groups {
            status
            count
          }
        }
      }
    `);

    const aggOp = operations.find((op) => op.type === 'aggregate');
    expect(aggOp.groupBy).toEqual(['status']);
  });
});

describe('Mutation Resolvers', () => {
  it('generates create operation', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
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
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'create') {
          return {
            uri: 'at://did:plc:test/xyz.statusphere.status/abc123',
            text: op.data.text,
          };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    const result = await adapter.execute(`
      mutation {
        createXyzStatusphereStatus(input: { text: "hello" }) {
          uri
          text
        }
      }
    `);

    expect(operations[0].type).toBe('create');
    expect(operations[0].collection).toBe('xyz.statusphere.status');
    expect(operations[0].data.text).toBe('hello');
    expect(result.data.createXyzStatusphereStatus.uri).toContain('xyz.statusphere.status');
  });

  it('generates update operation with rkey', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
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
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'update') {
          return {
            uri: `at://did:plc:test/xyz.statusphere.status/${op.rkey}`,
            text: op.data.text,
          };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    await adapter.execute(`
      mutation {
        updateXyzStatusphereStatus(rkey: "abc123", input: { text: "updated" }) {
          uri
          text
        }
      }
    `);

    expect(operations[0].type).toBe('update');
    expect(operations[0].rkey).toBe('abc123');
    expect(operations[0].data.text).toBe('updated');
  });

  it('generates delete operation', async () => {
    const operations = [];
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'xyz.statusphere.status',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async (op) => {
        operations.push(op);
        if (op.type === 'delete') {
          return { uri: `at://did:plc:test/xyz.statusphere.status/${op.rkey}` };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    await adapter.execute(`
      mutation {
        deleteXyzStatusphereStatus(rkey: "abc123") {
          uri
        }
      }
    `);

    expect(operations[0].type).toBe('delete');
    expect(operations[0].rkey).toBe('abc123');
    expect(operations[0].collection).toBe('xyz.statusphere.status');
  });
});

describe('Subscription Type Generation', () => {
  it('generates subscription fields for each record type', () => {
    const lexicons = [
      parseLexicon({
        id: 'xyz.test.post',
        defs: {
          main: {
            type: 'record',
            key: 'tid',
            record: {
              type: 'object',
              properties: {
                text: { type: 'string' },
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

  it('subscription fields return the record type', () => {
    const lexicons = [
      parseLexicon({
        id: 'xyz.test.item',
        defs: {
          main: {
            type: 'record',
            key: 'tid',
            record: {
              type: 'object',
              properties: {
                name: { type: 'string' },
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
    expect(createdType.toString()).toBe('XyzTestItem!');
  });

  it('adapter wires subscribe function to subscription resolvers', async () => {
    const lexicons = [
      parseLexicon({
        id: 'xyz.test.message',
        defs: {
          main: {
            type: 'record',
            key: 'tid',
            record: {
              type: 'object',
              properties: {
                content: { type: 'string' },
              },
            },
          },
        },
      }),
    ];

    const emittedRecords = [
      { uri: 'at://did:plc:test/xyz.test.message/1', content: 'Hello' },
      { uri: 'at://did:plc:test/xyz.test.message/2', content: 'World' },
    ];

    let subscribeCalled = false;
    let subscribeArgs = null;

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false, totalCount: 0 }),
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
      { fieldName: 'xyzTestMessageCreated' },
    );

    const results = [];
    for await (const value of iterator) {
      results.push(value);
    }

    expect(subscribeCalled).toBe(true);
    expect(subscribeArgs).toEqual({
      collection: 'xyz.test.message',
      event: 'created',
    });
    expect(results).toEqual(emittedRecords);
  });

  it('adapter.subscribe executes subscription queries', async () => {
    const lexicons = [
      parseLexicon({
        id: 'xyz.test.event',
        defs: {
          main: {
            type: 'record',
            key: 'tid',
            record: {
              type: 'object',
              properties: { data: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false, totalCount: 0 }),
      subscribe: () =>
        (async function* () {
          yield { uri: 'at://test/1', data: 'event1' };
          yield { uri: 'at://test/2', data: 'event2' };
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
    expect(results[0].data).toBe('event1');
  });
});

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
              avatar: { type: 'blob' },
            },
          },
        },
      },
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
              reply: { type: 'ref', ref: 'com.atproto.repo.strongRef' },
            },
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
            required: ['subject', 'createdAt'],
            properties: {
              subject: { type: 'ref', ref: 'com.atproto.repo.strongRef' },
              createdAt: { type: 'string', format: 'datetime' },
            },
          },
        },
      },
    }),
  ];

  it('creates schema with all expected types', () => {
    const schema = buildSchema(blueskyLexicons);
    const sdl = printSchema(schema);

    // Record types
    expect(sdl).toContain('type AppBskyActorProfile');
    expect(sdl).toContain('type AppBskyFeedPost');
    expect(sdl).toContain('type AppBskyFeedLike');

    // Connection types
    expect(sdl).toContain('type AppBskyFeedPostConnection');
    expect(sdl).toContain('type AppBskyFeedLikeConnection');

    // Input types
    expect(sdl).toContain('input AppBskyFeedPostWhereInput');
    expect(sdl).toContain('input AppBskyFeedPostInput');

    // Mutations
    expect(sdl).toContain('createAppBskyFeedPost');
    expect(sdl).toContain('updateAppBskyFeedPost');
    expect(sdl).toContain('deleteAppBskyFeedPost');
  });

  it('executes complex query with joins', async () => {
    const mockData = {
      posts: [
        {
          uri: 'at://did1/app.bsky.feed.post/1',
          text: 'Hello',
          createdAt: '2024-01-01T00:00:00Z',
          did: 'did1',
        },
        {
          uri: 'at://did2/app.bsky.feed.post/2',
          text: 'World',
          createdAt: '2024-01-02T00:00:00Z',
          did: 'did2',
        },
      ],
      profiles: [
        {
          uri: 'at://did1/app.bsky.actor.profile/self',
          displayName: 'User 1',
          did: 'did1',
        },
        {
          uri: 'at://did2/app.bsky.actor.profile/self',
          displayName: 'User 2',
          did: 'did2',
        },
      ],
    };

    const adapter = createAdapter(blueskyLexicons, {
      query: async (op) => {
        if (op.collection === 'app.bsky.feed.post') {
          return {
            rows: mockData.posts,
            hasNext: false,
            hasPrev: false,
            totalCount: mockData.posts.length,
          };
        }
        if (op.collection === 'app.bsky.actor.profile') {
          const dids = op.where?.find((w) => w.field === 'did')?.value || [];
          const filtered = mockData.profiles.filter((p) => dids.includes(p.did));
          return {
            rows: filtered,
            hasNext: false,
            hasPrev: false,
            totalCount: filtered.length,
          };
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
              appBskyActorProfileByDid {
                displayName
              }
            }
          }
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.appBskyFeedPost.edges).toHaveLength(2);
    expect(result.data.appBskyFeedPost.edges[0].node.text).toBe('Hello');
  });

  it('executes mutation and returns result', async () => {
    const adapter = createAdapter(blueskyLexicons, {
      query: async (op) => {
        if (op.type === 'create') {
          return {
            uri: 'at://did:plc:test/app.bsky.feed.post/new123',
            ...op.data,
            did: 'did:plc:test',
            cid: 'bafycid123',
            indexedAt: new Date().toISOString(),
          };
        }
        return { rows: [], hasNext: false, hasPrev: false, totalCount: 0 };
      },
    });

    const result = await adapter.execute(`
      mutation {
        createAppBskyFeedPost(input: { text: "New post", createdAt: "2024-01-01T00:00:00Z" }) {
          uri
          text
          createdAt
        }
      }
    `);

    expect(result.errors).toBeUndefined();
    expect(result.data.createAppBskyFeedPost.uri).toContain('app.bsky.feed.post');
    expect(result.data.createAppBskyFeedPost.text).toBe('New post');
  });
});

describe('Error Handling', () => {
  it('throws on invalid lexicon format', () => {
    expect(() => parseLexicon({})).toThrow('Lexicon missing required field: id');
  });

  it('throws on lexicon version mismatch', () => {
    expect(() => parseLexicon({ lexicon: 2, id: 'test.invalid' })).toThrow(
      'Unsupported lexicon version',
    );
  });

  it('returns GraphQL error for invalid query', async () => {
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'test.record',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false, totalCount: 0 }),
    });

    const result = await adapter.execute(`
      query { nonExistentField { id } }
    `);

    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('propagates adapter query errors as GraphQL errors', async () => {
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'test.record',
        defs: {
          main: {
            type: 'record',
            record: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        },
      }),
    ];

    const adapter = createAdapter(lexicons, {
      query: async () => {
        throw new Error('Database connection failed');
      },
    });

    const result = await adapter.execute(`
      query { testRecord { edges { node { uri } } } }
    `);

    expect(result.errors).toBeDefined();
    expect(result.errors[0].message).toContain('Database connection failed');
  });

  it('validates operation before execution', async () => {
    const lexicons = [
      parseLexicon({
        lexicon: 1,
        id: 'test.record',
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
    ];

    const adapter = createAdapter(lexicons, {
      query: async () => ({ rows: [], hasNext: false, hasPrev: false, totalCount: 0 }),
    });

    // Missing required field
    const result = await adapter.execute(`
      mutation {
        createTestRecord(input: {}) {
          uri
        }
      }
    `);

    expect(result.errors).toBeDefined();
  });

  it('exports LexGqlError class', () => {
    const error = new LexGqlError('Test error', ErrorCodes.INVALID_LEXICON, {
      field: 'id',
    });
    expect(error.name).toBe('LexGqlError');
    expect(error.code).toBe(ErrorCodes.INVALID_LEXICON);
    expect(error.details).toEqual({ field: 'id' });
    expect(error.message).toBe('Test error');
  });

  it('exports ErrorCodes constants', () => {
    expect(ErrorCodes.INVALID_LEXICON).toBe('INVALID_LEXICON');
    expect(ErrorCodes.UNSUPPORTED_VERSION).toBe('UNSUPPORTED_VERSION');
    expect(ErrorCodes.QUERY_FAILED).toBe('QUERY_FAILED');
    expect(ErrorCodes.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
  });
});

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

describe('Union Type Resolution', () => {
  it('creates union type for fields with refs array', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // embed field should be a union type, not String
    expect(sdl).toMatch(/embed: AppBskyFeedPostEmbed/);
    // The union type should be defined
    expect(sdl).toMatch(/union AppBskyFeedPostEmbed/);
  });

  it('union type contains all referenced types', () => {
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // AppBskyFeedPostEmbed should include embed types
    expect(sdl).toMatch(/union AppBskyFeedPostEmbed\s*=.*AppBskyEmbedImages/);
    expect(sdl).toMatch(/union AppBskyFeedPostEmbed\s*=.*AppBskyEmbedVideo/);
    expect(sdl).toMatch(/union AppBskyFeedPostEmbed\s*=.*AppBskyEmbedExternal/);
  });
});

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

describe('Schema Comparison', () => {
  it('generates schema from real lexicons', () => {
    // Parse all real lexicons
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));

    // Build schema
    const schema = buildSchema(parsedLexicons);
    const sdl = printSchema(schema);

    // Basic structure checks
    expect(sdl).toContain('type Query');
    expect(sdl).toContain('type Mutation');
    expect(sdl).toContain('type PageInfo');

    // Should have record types from lexicons
    expect(sdl).toContain('type AppBskyActorProfile');
    expect(sdl).toContain('type AppBskyFeedPost');
  });

  it('compares generated schema against oracle', () => {
    const oracleSchema = readFileSync(
      new URL('./test/schema.graphql', import.meta.url).pathname,
      'utf-8',
    );

    // Parse all real lexicons
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const generatedSdl = printSchema(schema);

    // Extract type names from oracle
    const oracleTypeMatches = oracleSchema.match(/type (\w+)/g) || [];
    const oracleTypes = oracleTypeMatches.map((m) => m.replace('type ', ''));

    // Extract type names from generated
    const generatedTypeMatches = generatedSdl.match(/type (\w+)/g) || [];
    const generatedTypes = generatedTypeMatches.map((m) => m.replace('type ', ''));

    // Check for key types that should exist (based on available lexicons)
    const expectedTypes = [
      'Query',
      'Mutation',
      'PageInfo',
      'AppBskyActorProfile',
      'AppBskyFeedPost',
    ];
    for (const typeName of expectedTypes) {
      expect(generatedTypes).toContain(typeName);
    }

    // Log comparison for debugging
    const missingFromGenerated = oracleTypes.filter((t) => !generatedTypes.includes(t));
    const extraInGenerated = generatedTypes.filter((t) => !oracleTypes.includes(t));

    console.log('\n=== Schema Comparison ===');
    console.log('Oracle types:', oracleTypes.length);
    console.log('Generated types:', generatedTypes.length);
    console.log('\nTypes in oracle but NOT generated:', missingFromGenerated.length);
    if (missingFromGenerated.length > 0) {
      console.log('  Sample:', missingFromGenerated.slice(0, 15).join(', '));
    }
    console.log('\nTypes generated but NOT in oracle:', extraInGenerated.length);
    if (extraInGenerated.length > 0) {
      console.log('  Sample:', extraInGenerated.slice(0, 15).join(', '));
    }

    // Check overlap percentage
    const matchingTypes = generatedTypes.filter((t) => oracleTypes.includes(t));
    console.log('\nMatching types:', matchingTypes.length);
    console.log(
      'Match %:',
      `${((matchingTypes.length / generatedTypes.length) * 100).toFixed(1)}%`,
    );
  });

  it('achieves target type coverage against oracle', () => {
    const oracleSchema = readFileSync(
      new URL('./test/schema.graphql', import.meta.url).pathname,
      'utf-8',
    );
    const parsedLexicons = realLexicons.map((l) => parseLexicon(l.content));
    const schema = buildSchema(parsedLexicons);
    const generatedSdl = printSchema(schema);

    const oracleTypeMatches = oracleSchema.match(/type (\w+)/g) || [];
    const oracleTypes = oracleTypeMatches.map((m) => m.replace('type ', ''));

    const generatedTypeMatches = generatedSdl.match(/type (\w+)/g) || [];
    const generatedTypes = generatedTypeMatches.map((m) => m.replace('type ', ''));

    const matchingTypes = generatedTypes.filter((t) => oracleTypes.includes(t));
    const matchPercent = (matchingTypes.length / generatedTypes.length) * 100;

    // Target: at least 50% of generated types match oracle
    // (We generate more types due to nested defs from "others")
    expect(matchPercent).toBeGreaterThanOrEqual(50);

    // Target: generate at least 50 types (was 19 before oracle alignment work)
    expect(generatedTypes.length).toBeGreaterThanOrEqual(50);

    // Target: cover at least 60% of oracle types
    const oracleCoverage = (matchingTypes.length / oracleTypes.length) * 100;
    expect(oracleCoverage).toBeGreaterThanOrEqual(60);
  });
});

describe('Public API', () => {
  it('exports createAdapter as main entry point', async () => {
    const { createAdapter } = await import('./lex-gql.js');
    expect(typeof createAdapter).toBe('function');
  });

  it('exports parseLexicon for parsing lexicon JSON', async () => {
    const { parseLexicon } = await import('./lex-gql.js');
    expect(typeof parseLexicon).toBe('function');
  });

  it('exports buildSchema for schema-only use cases', async () => {
    const { buildSchema } = await import('./lex-gql.js');
    expect(typeof buildSchema).toBe('function');
  });

  it('exports utility functions', async () => {
    const {
      nsidToTypeName,
      nsidToFieldName,
      nsidToCollectionName,
      parseRefUri,
      refToTypeName,
      mapLexiconType,
    } = await import('./lex-gql.js');

    expect(typeof nsidToTypeName).toBe('function');
    expect(typeof nsidToFieldName).toBe('function');
    expect(typeof nsidToCollectionName).toBe('function');
    expect(typeof parseRefUri).toBe('function');
    expect(typeof refToTypeName).toBe('function');
    expect(typeof mapLexiconType).toBe('function');
  });

  it('exports error types', async () => {
    const { LexGqlError, ErrorCodes } = await import('./lex-gql.js');
    expect(LexGqlError).toBeDefined();
    expect(ErrorCodes).toBeDefined();
  });
});

describe('Blob URL resolver', () => {
  it('generates CDN URL with default preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
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
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
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
            properties: [{ name: 'banner', type: 'blob', required: false }],
          },
          others: {},
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
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
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

  it('throws error when did is missing from blob', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
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
      // did is missing
    };

    expect(() => urlField.resolve(blob, {})).toThrow('Blob missing required did or ref for URL generation');
  });

  it('throws error when ref is missing from blob', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
        },
      },
    ];

    const schema = buildSchema(lexicons);
    const blobType = schema.getType('Blob');
    const urlField = blobType.getFields().url;

    const blob = {
      // ref is missing
      mimeType: 'image/jpeg',
      size: 12345,
      did: 'did:plc:user123',
    };

    expect(() => urlField.resolve(blob, {})).toThrow('Blob missing required did or ref for URL generation');
  });

  it('throws error for invalid preset', () => {
    const lexicons = [
      {
        id: 'app.bsky.actor.profile',
        defs: {
          main: {
            type: 'record',
            key: 'literal:self',
            properties: [{ name: 'avatar', type: 'blob', required: false }],
          },
          others: {},
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

    expect(() => urlField.resolve(blob, { preset: 'invalid_preset' })).toThrow(
      'Invalid blob preset: invalid_preset. Valid presets: avatar, banner, feed_thumbnail, feed_fullsize'
    );
  });
});

describe('Hydration Helpers', () => {
  describe('hydrateBlobs', () => {
    it('injects did into blob objects', () => {
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
      expect(hydrateBlobs(null, 'did:plc:x')).toBe(null);
      expect(hydrateBlobs(undefined, 'did:plc:x')).toBe(undefined);
      expect(hydrateBlobs('string', 'did:plc:x')).toBe('string');
      expect(hydrateBlobs(123, 'did:plc:x')).toBe(123);
    });

    it('handles empty arrays', () => {
      const record = { images: [] };
      const result = hydrateBlobs(record, 'did:plc:x');
      expect(result.images).toEqual([]);
    });

    it('handles blob without $type but with ref/mimeType/size', () => {
      const record = {
        avatar: { ref: 'bafyreiabc', mimeType: 'image/jpeg', size: 100 },
      };

      const result = hydrateBlobs(record, 'did:plc:user');
      expect(result.avatar.did).toBe('did:plc:user');
    });
  });

  describe('hydrateRecord', () => {
    it('transforms a database row to lex-gql record format', () => {
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

    it('metadata fields take precedence over record fields', () => {
      const row = {
        uri: 'at://did:plc:user/col/rkey',
        did: 'did:plc:user',
        collection: 'col',
        rkey: 'rkey',
        record: { uri: 'should-be-overwritten', did: 'should-be-overwritten' },
        indexed_at: '2024-01-01T00:00:00Z',
      };

      const result = hydrateRecord(row);

      expect(result.uri).toBe('at://did:plc:user/col/rkey');
      expect(result.did).toBe('did:plc:user');
    });

    it('throws on malformed JSON', () => {
      const row = {
        uri: 'at://did:plc:user/col/rkey',
        did: 'did:plc:user',
        collection: 'col',
        rkey: 'rkey',
        record: 'not valid json {',
        indexed_at: '2024-01-01T00:00:00Z',
      };

      expect(() => hydrateRecord(row)).toThrow(SyntaxError);
    });
  });
});
