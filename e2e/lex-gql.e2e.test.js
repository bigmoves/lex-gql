/**
 * End-to-end tests for lex-gql with SQLite adapter
 *
 * Tests the full GraphQL query flow using real AT Protocol lexicons.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createAdapter, parseLexicon } from 'lex-gql';
import { createSqliteAdapter, setupSchema } from 'lex-gql-sqlite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
      lexicons.push(parseLexicon(content));
    }
  }
  return lexicons;
}

const LEXICONS_DIR = new URL('../packages/lex-gql/test/lexicons', import.meta.url).pathname;
const lexicons = loadLexicons(LEXICONS_DIR);

describe('lex-gql e2e with real lexicons', () => {
  let db;
  let adapter;
  let insertRecord;
  let insertActor;

  beforeAll(() => {
    db = new Database(':memory:');
    setupSchema(db);

    const query = createSqliteAdapter(db);
    adapter = createAdapter(lexicons, { query });

    insertRecord = db.prepare(`
      INSERT INTO records (uri, did, collection, rkey, cid, record, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertActor = db.prepare(`
      INSERT OR REPLACE INTO actors (did, handle) VALUES (?, ?)
    `);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    db.exec('DELETE FROM records');
    db.exec('DELETE FROM actors');
  });

  describe('app.bsky.feed.post', () => {
    it('queries posts with all standard fields', async () => {
      insertRecord.run(
        'at://did:plc:alice/app.bsky.feed.post/3abc',
        'did:plc:alice',
        'app.bsky.feed.post',
        '3abc',
        'bafyreiabc',
        JSON.stringify({
          text: 'Hello ATProto!',
          createdAt: '2024-01-15T10:30:00.000Z',
          langs: ['en'],
        }),
        '2024-01-15T10:30:00.000Z',
      );
      insertActor.run('did:plc:alice', 'alice.bsky.social');

      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10) {
            edges {
              node {
                uri
                did
                cid
                text
                createdAt
                langs
                indexedAt
                actorHandle
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(1);

      const post = result.data.appBskyFeedPost.edges[0].node;
      expect(post.uri).toBe('at://did:plc:alice/app.bsky.feed.post/3abc');
      expect(post.did).toBe('did:plc:alice');
      expect(post.cid).toBe('bafyreiabc');
      expect(post.text).toBe('Hello ATProto!');
      expect(post.createdAt).toBe('2024-01-15T10:30:00.000Z');
      expect(post.langs).toEqual(['en']);
      expect(post.actorHandle).toBe('alice.bsky.social');
    });

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
                aspectRatio: { width: 1920, height: 1080 },
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
        '2024-01-15T11:00:00.000Z',
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
                      aspectRatio {
                        width
                        height
                      }
                      image {
                        ref
                        mimeType
                        size
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
      expect(post.embed.images).toHaveLength(1);
      expect(post.embed.images[0].alt).toBe('A beautiful sunset');
      expect(post.embed.images[0].image.ref).toBe('bafyimage123');
    });

    it('queries posts with reply reference', async () => {
      // Parent post
      insertRecord.run(
        'at://did:plc:bob/app.bsky.feed.post/parent',
        'did:plc:bob',
        'app.bsky.feed.post',
        'parent',
        'bafyparent',
        JSON.stringify({
          text: 'Original post',
          createdAt: '2024-01-15T09:00:00.000Z',
        }),
        '2024-01-15T09:00:00.000Z',
      );

      // Reply
      insertRecord.run(
        'at://did:plc:alice/app.bsky.feed.post/reply',
        'did:plc:alice',
        'app.bsky.feed.post',
        'reply',
        'bafyreply',
        JSON.stringify({
          text: 'This is a reply',
          createdAt: '2024-01-15T10:00:00.000Z',
          reply: {
            root: {
              uri: 'at://did:plc:bob/app.bsky.feed.post/parent',
              cid: 'bafyparent',
            },
            parent: {
              uri: 'at://did:plc:bob/app.bsky.feed.post/parent',
              cid: 'bafyparent',
            },
          },
        }),
        '2024-01-15T10:00:00.000Z',
      );

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
      expect(post.text).toBe('This is a reply');
      expect(post.reply.root.uri).toBe('at://did:plc:bob/app.bsky.feed.post/parent');
      expect(post.reply.parent.cid).toBe('bafyparent');
    });
  });

  describe('app.bsky.actor.profile', () => {
    it('queries profiles with avatar blob', async () => {
      insertRecord.run(
        'at://did:plc:alice/app.bsky.actor.profile/self',
        'did:plc:alice',
        'app.bsky.actor.profile',
        'self',
        'bafyprofile',
        JSON.stringify({
          displayName: 'Alice',
          description: 'Hello, I am Alice!',
          avatar: {
            $type: 'blob',
            ref: { $link: 'bafyavatar' },
            mimeType: 'image/jpeg',
            size: 50000,
          },
          createdAt: '2024-01-01T00:00:00.000Z',
        }),
        '2024-01-01T00:00:00.000Z',
      );
      insertActor.run('did:plc:alice', 'alice.bsky.social');

      const result = await adapter.execute(`
        query {
          appBskyActorProfile(first: 10) {
            edges {
              node {
                displayName
                description
                avatar {
                  ref
                  mimeType
                  size
                }
                actorHandle
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const profile = result.data.appBskyActorProfile.edges[0].node;
      expect(profile.displayName).toBe('Alice');
      expect(profile.description).toBe('Hello, I am Alice!');
      expect(profile.avatar.ref).toBe('bafyavatar');
      expect(profile.avatar.mimeType).toBe('image/jpeg');
      expect(profile.actorHandle).toBe('alice.bsky.social');
    });
  });

  describe('app.bsky.graph.follow', () => {
    it('queries follows', async () => {
      insertRecord.run(
        'at://did:plc:alice/app.bsky.graph.follow/abc123',
        'did:plc:alice',
        'app.bsky.graph.follow',
        'abc123',
        'bafyfollow',
        JSON.stringify({
          subject: 'did:plc:bob',
          createdAt: '2024-01-10T00:00:00.000Z',
        }),
        '2024-01-10T00:00:00.000Z',
      );

      const result = await adapter.execute(`
        query {
          appBskyGraphFollow(first: 10) {
            edges {
              node {
                uri
                did
                subject
                createdAt
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const follow = result.data.appBskyGraphFollow.edges[0].node;
      expect(follow.did).toBe('did:plc:alice');
      expect(follow.subject).toBe('did:plc:bob');
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      for (let i = 1; i <= 25; i++) {
        insertRecord.run(
          `at://did:plc:alice/app.bsky.feed.post/${i}`,
          'did:plc:alice',
          'app.bsky.feed.post',
          `${i}`,
          null,
          JSON.stringify({ text: `Post number ${i}`, createdAt: '2024-01-15T00:00:00.000Z' }),
          `2024-01-15T00:00:${i.toString().padStart(2, '0')}.000Z`,
        );
      }
    });

    it('paginates through all results', async () => {
      const allPosts = [];
      let cursor = null;

      // Fetch all pages
      for (let page = 0; page < 5; page++) {
        const result = await adapter.execute(
          `
          query ($cursor: String) {
            appBskyFeedPost(first: 10, after: $cursor) {
              edges {
                node { text }
                cursor
              }
              pageInfo {
                hasNextPage
                hasPreviousPage
                endCursor
              }
            }
          }
        `,
          { cursor },
        );

        expect(result.errors).toBeUndefined();
        allPosts.push(...result.data.appBskyFeedPost.edges.map((e) => e.node.text));

        if (!result.data.appBskyFeedPost.pageInfo.hasNextPage) break;
        cursor = result.data.appBskyFeedPost.pageInfo.endCursor;
      }

      expect(allPosts).toHaveLength(25);
    });

    it('returns correct totalCount regardless of pagination', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 5) {
            totalCount
            edges {
              node { text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.totalCount).toBe(25);
      expect(result.data.appBskyFeedPost.edges).toHaveLength(5);
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      insertRecord.run(
        'at://did:plc:alice/app.bsky.feed.post/1',
        'did:plc:alice',
        'app.bsky.feed.post',
        '1',
        null,
        JSON.stringify({
          text: 'Hello world',
          createdAt: '2024-01-15T00:00:00.000Z',
          langs: ['en'],
        }),
        '2024-01-15T00:00:00.000Z',
      );
      insertRecord.run(
        'at://did:plc:bob/app.bsky.feed.post/2',
        'did:plc:bob',
        'app.bsky.feed.post',
        '2',
        null,
        JSON.stringify({
          text: 'Hola mundo',
          createdAt: '2024-01-16T00:00:00.000Z',
          langs: ['es'],
        }),
        '2024-01-16T00:00:00.000Z',
      );
      insertRecord.run(
        'at://did:plc:carol/app.bsky.feed.post/3',
        'did:plc:carol',
        'app.bsky.feed.post',
        '3',
        null,
        JSON.stringify({
          text: 'Hello from Carol',
          createdAt: '2024-01-17T00:00:00.000Z',
          langs: ['en'],
        }),
        '2024-01-17T00:00:00.000Z',
      );
    });

    it('filters by exact match on system field', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { did: { eq: "did:plc:alice" } }) {
            edges {
              node { did text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(1);
      expect(result.data.appBskyFeedPost.edges[0].node.did).toBe('did:plc:alice');
    });

    it('filters by contains on text field', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { text: { contains: "Hello" } }) {
            edges {
              node { text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(2);
    });

    it('filters by in operator', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { did: { in: ["did:plc:alice", "did:plc:carol"] } }) {
            edges {
              node { did }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(2);
    });

    it('filters with AND conditions', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: {
            AND: [
              { text: { contains: "Hello" } },
              { did: { eq: "did:plc:carol" } }
            ]
          }) {
            edges {
              node { did text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(1);
      expect(result.data.appBskyFeedPost.edges[0].node.text).toBe('Hello from Carol');
    });

    it('filters with OR conditions', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: {
            OR: [
              { did: { eq: "did:plc:alice" } },
              { text: { contains: "Hola" } }
            ]
          }) {
            edges {
              node { did text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPost.edges).toHaveLength(2);
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      insertRecord.run(
        'at://did:plc:alice/app.bsky.feed.post/1',
        'did:plc:alice',
        'app.bsky.feed.post',
        '1',
        null,
        JSON.stringify({ text: 'B post', createdAt: '2024-01-15T00:00:00.000Z' }),
        '2024-01-15T00:00:00.000Z',
      );
      insertRecord.run(
        'at://did:plc:bob/app.bsky.feed.post/2',
        'did:plc:bob',
        'app.bsky.feed.post',
        '2',
        null,
        JSON.stringify({ text: 'A post', createdAt: '2024-01-14T00:00:00.000Z' }),
        '2024-01-14T00:00:00.000Z',
      );
      insertRecord.run(
        'at://did:plc:carol/app.bsky.feed.post/3',
        'did:plc:carol',
        'app.bsky.feed.post',
        '3',
        null,
        JSON.stringify({ text: 'C post', createdAt: '2024-01-16T00:00:00.000Z' }),
        '2024-01-16T00:00:00.000Z',
      );
    });

    it('sorts by record field ascending', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, sortBy: [{ field: text, direction: ASC }]) {
            edges {
              node { text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const texts = result.data.appBskyFeedPost.edges.map((e) => e.node.text);
      expect(texts).toEqual(['A post', 'B post', 'C post']);
    });

    it('sorts by createdAt descending', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, sortBy: [{ field: createdAt, direction: DESC }]) {
            edges {
              node { text createdAt }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const texts = result.data.appBskyFeedPost.edges.map((e) => e.node.text);
      expect(texts).toEqual(['C post', 'B post', 'A post']);
    });

    it('sorts by system field (indexedAt)', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, sortBy: [{ field: indexedAt, direction: ASC }]) {
            edges {
              node { text }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const texts = result.data.appBskyFeedPost.edges.map((e) => e.node.text);
      expect(texts).toEqual(['A post', 'B post', 'C post']);
    });
  });

  describe('aggregates', () => {
    beforeEach(() => {
      // Alice: 3 posts
      for (let i = 1; i <= 3; i++) {
        insertRecord.run(
          `at://did:plc:alice/app.bsky.feed.post/${i}`,
          'did:plc:alice',
          'app.bsky.feed.post',
          `${i}`,
          null,
          JSON.stringify({ text: `Alice post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' }),
          '2024-01-15T00:00:00.000Z',
        );
      }
      // Bob: 2 posts
      for (let i = 1; i <= 2; i++) {
        insertRecord.run(
          `at://did:plc:bob/app.bsky.feed.post/${i}`,
          'did:plc:bob',
          'app.bsky.feed.post',
          `${i}`,
          null,
          JSON.stringify({ text: `Bob post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' }),
          '2024-01-15T00:00:00.000Z',
        );
      }
    });

    it('returns total count', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate {
            count
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.count).toBe(5);
    });

    it('returns count with filter', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(where: { did: { eq: "did:plc:alice" } }) {
            count
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.count).toBe(3);
    });

    it('groups by did', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [did]) {
            count
            groups {
              did
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.count).toBe(5);
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);

      const aliceGroup = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.did === 'did:plc:alice',
      );
      const bobGroup = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.did === 'did:plc:bob',
      );
      expect(aliceGroup.count).toBe(3);
      expect(bobGroup.count).toBe(2);
    });
  });

  describe('ByDid resolvers', () => {
    beforeEach(() => {
      // Create profile for Alice
      insertRecord.run(
        'at://did:plc:alice/app.bsky.actor.profile/self',
        'did:plc:alice',
        'app.bsky.actor.profile',
        'self',
        null,
        JSON.stringify({ displayName: 'Alice', description: 'Test user Alice' }),
        '2024-01-01T00:00:00.000Z',
      );
      insertActor.run('did:plc:alice', 'alice.bsky.social');

      // Create post by Alice
      insertRecord.run(
        'at://did:plc:alice/app.bsky.feed.post/1',
        'did:plc:alice',
        'app.bsky.feed.post',
        '1',
        null,
        JSON.stringify({ text: 'Hello from Alice', createdAt: '2024-01-15T00:00:00.000Z' }),
        '2024-01-15T00:00:00.000Z',
      );

      // Create post by Bob (no profile)
      insertRecord.run(
        'at://did:plc:bob/app.bsky.feed.post/1',
        'did:plc:bob',
        'app.bsky.feed.post',
        '1',
        null,
        JSON.stringify({ text: 'Hello from Bob', createdAt: '2024-01-15T00:00:00.000Z' }),
        '2024-01-15T00:00:00.000Z',
      );
    });

    it('resolves profile from post via ByDid', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { did: { eq: "did:plc:alice" } }) {
            edges {
              node {
                text
                actorHandle
                appBskyActorProfileByDid {
                  displayName
                  description
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const post = result.data.appBskyFeedPost.edges[0].node;
      expect(post.text).toBe('Hello from Alice');
      expect(post.actorHandle).toBe('alice.bsky.social');
      expect(post.appBskyActorProfileByDid.displayName).toBe('Alice');
      expect(post.appBskyActorProfileByDid.description).toBe('Test user Alice');
    });

    it('returns null for missing ByDid record', async () => {
      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { did: { eq: "did:plc:bob" } }) {
            edges {
              node {
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
      const post = result.data.appBskyFeedPost.edges[0].node;
      expect(post.text).toBe('Hello from Bob');
      expect(post.appBskyActorProfileByDid).toBeNull();
    });
  });
});
