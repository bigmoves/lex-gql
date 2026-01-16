/**
 * End-to-end tests for lex-gql with SQLite adapter
 *
 * Tests the full GraphQL query flow using real AT Protocol lexicons.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createAdapter, parseLexicon } from 'lex-gql';
import { createSqliteAdapter, createWriter, setupSchema } from 'lex-gql-sqlite';
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
  let writer;

  beforeAll(() => {
    db = new Database(':memory:');
    setupSchema(db);

    const query = createSqliteAdapter(db);
    adapter = createAdapter(lexicons, { query });
    writer = createWriter(db);
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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/3abc',
        cid: 'bafyreiabc',
        record: {
          text: 'Hello ATProto!',
          createdAt: '2024-01-15T10:30:00.000Z',
          langs: ['en'],
        },
        indexedAt: '2024-01-15T10:30:00.000Z',
      });
      writer.upsertActor('did:plc:alice', 'alice.bsky.social');

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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/withimg',
        cid: 'bafyimg',
        record: {
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
        },
        indexedAt: '2024-01-15T11:00:00.000Z',
      });

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
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/parent',
        cid: 'bafyparent',
        record: {
          text: 'Original post',
          createdAt: '2024-01-15T09:00:00.000Z',
        },
        indexedAt: '2024-01-15T09:00:00.000Z',
      });

      // Reply
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/reply',
        cid: 'bafyreply',
        record: {
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
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.actor.profile/self',
        cid: 'bafyprofile',
        record: {
          displayName: 'Alice',
          description: 'Hello, I am Alice!',
          avatar: {
            $type: 'blob',
            ref: { $link: 'bafyavatar' },
            mimeType: 'image/jpeg',
            size: 50000,
          },
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        indexedAt: '2024-01-01T00:00:00.000Z',
      });
      writer.upsertActor('did:plc:alice', 'alice.bsky.social');

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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.graph.follow/abc123',
        cid: 'bafyfollow',
        record: {
          subject: 'did:plc:bob',
          createdAt: '2024-01-10T00:00:00.000Z',
        },
        indexedAt: '2024-01-10T00:00:00.000Z',
      });

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
        writer.insertRecord({
          uri: `at://did:plc:alice/app.bsky.feed.post/${i}`,
          record: { text: `Post number ${i}`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: `2024-01-15T00:00:${i.toString().padStart(2, '0')}.000Z`,
        });
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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/1',
        record: {
          text: 'Hello world',
          createdAt: '2024-01-15T00:00:00.000Z',
          langs: ['en'],
        },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/2',
        record: {
          text: 'Hola mundo',
          createdAt: '2024-01-16T00:00:00.000Z',
          langs: ['es'],
        },
        indexedAt: '2024-01-16T00:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:carol/app.bsky.feed.post/3',
        record: {
          text: 'Hello from Carol',
          createdAt: '2024-01-17T00:00:00.000Z',
          langs: ['en'],
        },
        indexedAt: '2024-01-17T00:00:00.000Z',
      });
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
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/1',
        record: { text: 'B post', createdAt: '2024-01-15T00:00:00.000Z' },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/2',
        record: { text: 'A post', createdAt: '2024-01-14T00:00:00.000Z' },
        indexedAt: '2024-01-14T00:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:carol/app.bsky.feed.post/3',
        record: { text: 'C post', createdAt: '2024-01-16T00:00:00.000Z' },
        indexedAt: '2024-01-16T00:00:00.000Z',
      });
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
        writer.insertRecord({
          uri: `at://did:plc:alice/app.bsky.feed.post/${i}`,
          record: { text: `Alice post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: '2024-01-15T00:00:00.000Z',
        });
      }
      // Bob: 2 posts
      for (let i = 1; i <= 2; i++) {
        writer.insertRecord({
          uri: `at://did:plc:bob/app.bsky.feed.post/${i}`,
          record: { text: `Bob post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: '2024-01-15T00:00:00.000Z',
        });
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

    it('groups by day interval', async () => {
      // Clear and add posts with different dates
      db.exec('DELETE FROM records');

      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/day1a',
        record: { text: 'Post 1', createdAt: '2024-01-15T10:00:00.000Z' },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/day1b',
        record: { text: 'Post 2', createdAt: '2024-01-15T22:00:00.000Z' },
        indexedAt: '2024-01-15T22:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/day2',
        record: { text: 'Post 3', createdAt: '2024-01-16T08:00:00.000Z' },
        indexedAt: '2024-01-16T08:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [createdAt_day]) {
            count
            groups {
              createdAt_day
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.count).toBe(3);
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);

      const jan15 = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.createdAt_day === '2024-01-15',
      );
      const jan16 = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.createdAt_day === '2024-01-16',
      );
      expect(jan15.count).toBe(2);
      expect(jan16.count).toBe(1);
    });

    it('groups by week interval', async () => {
      db.exec('DELETE FROM records');

      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/week1a',
        record: { text: 'Week 1 post 1', createdAt: '2024-01-01T10:00:00.000Z' }, // Week 01
        indexedAt: '2024-01-01T10:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/week1b',
        record: { text: 'Week 1 post 2', createdAt: '2024-01-03T10:00:00.000Z' }, // Week 01
        indexedAt: '2024-01-03T10:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/week2',
        record: { text: 'Week 2 post', createdAt: '2024-01-08T10:00:00.000Z' }, // Week 02
        indexedAt: '2024-01-08T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [createdAt_week]) {
            count
            groups {
              createdAt_week
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.count).toBe(3);
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);
    });

    it('groups by month interval', async () => {
      db.exec('DELETE FROM records');

      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/jan1',
        record: { text: 'January post 1', createdAt: '2024-01-15T10:00:00.000Z' },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/jan2',
        record: { text: 'January post 2', createdAt: '2024-01-20T10:00:00.000Z' },
        indexedAt: '2024-01-20T10:00:00.000Z',
      });
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/feb1',
        record: { text: 'February post', createdAt: '2024-02-05T10:00:00.000Z' },
        indexedAt: '2024-02-05T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [createdAt_month]) {
            count
            groups {
              createdAt_month
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);

      const jan = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.createdAt_month === '2024-01',
      );
      const feb = result.data.appBskyFeedPostAggregate.groups.find(
        (g) => g.createdAt_month === '2024-02',
      );
      expect(jan.count).toBe(2);
      expect(feb.count).toBe(1);
    });

    it('respects custom limit', async () => {
      db.exec('DELETE FROM records');

      // Create 5 users with different post counts
      for (let i = 0; i < 5; i++) {
        writer.insertRecord({
          uri: `at://did:plc:user${i}/app.bsky.feed.post/1`,
          record: { text: `User ${i} post`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: '2024-01-15T00:00:00.000Z',
        });
      }

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [did], limit: 3) {
            groups {
              did
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(3);
    });

    it('supports ascending count order', async () => {
      db.exec('DELETE FROM records');

      // Alice: 3 posts
      for (let i = 1; i <= 3; i++) {
        writer.insertRecord({
          uri: `at://did:plc:alice/app.bsky.feed.post/${i}`,
          record: { text: `Alice post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: '2024-01-15T00:00:00.000Z',
        });
      }
      // Bob: 1 post
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/1',
        record: { text: 'Bob post', createdAt: '2024-01-15T00:00:00.000Z' },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [did], orderBy: COUNT_ASC) {
            groups {
              did
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);
      // Bob (1 post) should come first in ascending order
      expect(result.data.appBskyFeedPostAggregate.groups[0].did).toBe('did:plc:bob');
      expect(result.data.appBskyFeedPostAggregate.groups[0].count).toBe(1);
      expect(result.data.appBskyFeedPostAggregate.groups[1].did).toBe('did:plc:alice');
      expect(result.data.appBskyFeedPostAggregate.groups[1].count).toBe(3);
    });

    it('supports descending count order (default)', async () => {
      db.exec('DELETE FROM records');

      // Alice: 3 posts
      for (let i = 1; i <= 3; i++) {
        writer.insertRecord({
          uri: `at://did:plc:alice/app.bsky.feed.post/${i}`,
          record: { text: `Alice post ${i}`, createdAt: '2024-01-15T00:00:00.000Z' },
          indexedAt: '2024-01-15T00:00:00.000Z',
        });
      }
      // Bob: 1 post
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/1',
        record: { text: 'Bob post', createdAt: '2024-01-15T00:00:00.000Z' },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostAggregate(groupBy: [did], orderBy: COUNT_DESC) {
            groups {
              did
              count
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostAggregate.groups).toHaveLength(2);
      // Alice (3 posts) should come first in descending order
      expect(result.data.appBskyFeedPostAggregate.groups[0].did).toBe('did:plc:alice');
      expect(result.data.appBskyFeedPostAggregate.groups[0].count).toBe(3);
      expect(result.data.appBskyFeedPostAggregate.groups[1].did).toBe('did:plc:bob');
      expect(result.data.appBskyFeedPostAggregate.groups[1].count).toBe(1);
    });
  });

  describe('at-uri forward joins', () => {
    it('resolves postgate.post to the referenced post via postResolved', async () => {
      // Create a post
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/abc123',
        cid: 'bafypost',
        record: {
          text: 'Original post for postgate test',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      // Create a postgate referencing that post
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.postgate/abc123',
        cid: 'bafypostgate',
        record: {
          post: 'at://did:plc:alice/app.bsky.feed.post/abc123',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostgate(first: 10) {
            edges {
              node {
                post
                postResolved {
                  ... on AppBskyFeedPost {
                    text
                    uri
                  }
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedPostgate.edges).toHaveLength(1);

      const postgate = result.data.appBskyFeedPostgate.edges[0].node;
      expect(postgate.post).toBe('at://did:plc:alice/app.bsky.feed.post/abc123');
      expect(postgate.postResolved).not.toBeNull();
      expect(postgate.postResolved.text).toBe('Original post for postgate test');
      expect(postgate.postResolved.uri).toBe('at://did:plc:alice/app.bsky.feed.post/abc123');
    });

    it('resolves threadgate.post to the referenced post via postResolved', async () => {
      // Create a post
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/thread123',
        cid: 'bafythread',
        record: {
          text: 'Thread root post',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      // Create a threadgate for that post
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.threadgate/thread123',
        cid: 'bafythreadgate',
        record: {
          post: 'at://did:plc:alice/app.bsky.feed.post/thread123',
          createdAt: '2024-01-15T10:00:00.000Z',
          allow: [],
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedThreadgate(first: 10) {
            edges {
              node {
                post
                postResolved {
                  ... on AppBskyFeedPost {
                    text
                  }
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      expect(result.data.appBskyFeedThreadgate.edges).toHaveLength(1);

      const threadgate = result.data.appBskyFeedThreadgate.edges[0].node;
      expect(threadgate.post).toBe('at://did:plc:alice/app.bsky.feed.post/thread123');
      expect(threadgate.postResolved).not.toBeNull();
      expect(threadgate.postResolved.text).toBe('Thread root post');
    });

    it('returns null for postResolved when referenced post does not exist', async () => {
      // Create a postgate referencing a non-existent post
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.postgate/orphan',
        cid: 'bafyorphan',
        record: {
          post: 'at://did:plc:alice/app.bsky.feed.post/nonexistent',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPostgate(first: 10) {
            edges {
              node {
                post
                postResolved {
                  ... on AppBskyFeedPost {
                    text
                  }
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const postgate = result.data.appBskyFeedPostgate.edges[0].node;
      expect(postgate.post).toBe('at://did:plc:alice/app.bsky.feed.post/nonexistent');
      expect(postgate.postResolved).toBeNull();
    });
  });

  describe('StrongRef forward joins', () => {
    it('resolves reply.parent via uriResolved to the parent post', async () => {
      // Create parent post
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/parent',
        cid: 'bafyparent',
        record: {
          text: 'I am the parent post',
          createdAt: '2024-01-15T09:00:00.000Z',
        },
        indexedAt: '2024-01-15T09:00:00.000Z',
      });

      // Create reply with StrongRef
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/reply',
        cid: 'bafyreply',
        record: {
          text: 'This is my reply',
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
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyFeedPost(first: 10, where: { did: { eq: "did:plc:alice" } }) {
            edges {
              node {
                text
                reply {
                  parent {
                    uri
                    cid
                    uriResolved {
                      ... on AppBskyFeedPost {
                        text
                      }
                    }
                  }
                  root {
                    uri
                    uriResolved {
                      ... on AppBskyFeedPost {
                        text
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
      expect(post.text).toBe('This is my reply');
      expect(post.reply.parent.uri).toBe('at://did:plc:bob/app.bsky.feed.post/parent');
      expect(post.reply.parent.uriResolved).not.toBeNull();
      expect(post.reply.parent.uriResolved.text).toBe('I am the parent post');
      expect(post.reply.root.uriResolved.text).toBe('I am the parent post');
    });

    it('resolves profile.pinnedPost via uriResolved', async () => {
      // Create the post to be pinned
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/pinned',
        cid: 'bafypinned',
        record: {
          text: 'This is my pinned post!',
          createdAt: '2024-01-15T10:00:00.000Z',
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      // Create profile with pinnedPost StrongRef
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.actor.profile/self',
        cid: 'bafyprofile',
        record: {
          displayName: 'Alice',
          pinnedPost: {
            uri: 'at://did:plc:alice/app.bsky.feed.post/pinned',
            cid: 'bafypinned',
          },
        },
        indexedAt: '2024-01-15T10:00:00.000Z',
      });

      const result = await adapter.execute(`
        query {
          appBskyActorProfile(first: 10) {
            edges {
              node {
                displayName
                pinnedPost {
                  uri
                  cid
                  uriResolved {
                    ... on AppBskyFeedPost {
                      text
                    }
                  }
                }
              }
            }
          }
        }
      `);

      expect(result.errors).toBeUndefined();
      const profile = result.data.appBskyActorProfile.edges[0].node;
      expect(profile.displayName).toBe('Alice');
      expect(profile.pinnedPost.uri).toBe('at://did:plc:alice/app.bsky.feed.post/pinned');
      expect(profile.pinnedPost.uriResolved).not.toBeNull();
      expect(profile.pinnedPost.uriResolved.text).toBe('This is my pinned post!');
    });
  });

  describe('ByDid resolvers', () => {
    beforeEach(() => {
      // Create profile for Alice
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.actor.profile/self',
        record: { displayName: 'Alice', description: 'Test user Alice' },
        indexedAt: '2024-01-01T00:00:00.000Z',
      });
      writer.upsertActor('did:plc:alice', 'alice.bsky.social');

      // Create post by Alice
      writer.insertRecord({
        uri: 'at://did:plc:alice/app.bsky.feed.post/1',
        record: { text: 'Hello from Alice', createdAt: '2024-01-15T00:00:00.000Z' },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });

      // Create post by Bob (no profile)
      writer.insertRecord({
        uri: 'at://did:plc:bob/app.bsky.feed.post/1',
        record: { text: 'Hello from Bob', createdAt: '2024-01-15T00:00:00.000Z' },
        indexedAt: '2024-01-15T00:00:00.000Z',
      });
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
