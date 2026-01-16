/**
 * Example: lex-gql queries with AT Protocol tap
 *
 * This example shows how to query AT Protocol records synced by tap
 * through a GraphQL API powered by lex-gql.
 *
 * Architecture:
 *   1. tap syncs records from the AT Protocol relay
 *   2. This server connects to tap's websocket and stores records locally
 *   3. lex-gql provides GraphQL queries over the stored records
 *
 * Collections synced:
 *   - xyz.statusphere.status (emoji statuses)
 *   - app.bsky.actor.profile (user profiles with avatar/banner blobs)
 *
 * Prerequisites:
 *   docker compose up -d   # Start tap server
 *   pnpm install
 *   node index.js
 *
 * Tap configuration for this example:
 *   TAP_SIGNAL_COLLECTION=xyz.statusphere.status
 *   TAP_COLLECTION_FILTERS=xyz.statusphere.status,app.bsky.actor.profile
 */

import { createServer } from 'node:http';
import Database from 'better-sqlite3';
import { createHandler } from 'graphql-http/lib/use/node';
import { createAdapter, parseLexicon, hydrateRecord } from 'lex-gql';
import WebSocket from 'ws';

// 1. Define lexicons
const lexicons = [
  parseLexicon({
    lexicon: 1,
    id: 'xyz.statusphere.status',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['status', 'createdAt'],
          properties: {
            status: {
              type: 'string',
              minLength: 1,
              maxGraphemes: 1,
              maxLength: 32,
            },
            createdAt: { type: 'string', format: 'datetime' },
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
          properties: {
            displayName: { type: 'string', maxGraphemes: 64, maxLength: 640 },
            description: { type: 'string', maxGraphemes: 256, maxLength: 2560 },
            avatar: { type: 'blob', accept: ['image/png', 'image/jpeg'], maxSize: 1000000 },
            banner: { type: 'blob', accept: ['image/png', 'image/jpeg'], maxSize: 1000000 },
            createdAt: { type: 'string', format: 'datetime' },
          },
        },
      },
    },
  }),
];

// Collections we want to sync from tap
const SYNC_COLLECTIONS = ['xyz.statusphere.status', 'app.bsky.actor.profile'];

// 2. Create local SQLite database for storing records from tap
const dbPath = './data/records.db';
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uri TEXT UNIQUE NOT NULL,
    did TEXT NOT NULL,
    collection TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT,
    record TEXT NOT NULL,
    indexed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_records_collection ON records(collection);
  CREATE INDEX IF NOT EXISTS idx_records_did ON records(did);

  CREATE TABLE IF NOT EXISTS actors (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL
  );
`);

// Prepared statements
const insertRecord = db.prepare(`
  INSERT OR REPLACE INTO records (uri, did, collection, rkey, cid, record, indexed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const deleteRecord = db.prepare(`
  DELETE FROM records WHERE uri = ?
`);

const upsertActor = db.prepare(`
  INSERT OR REPLACE INTO actors (did, handle) VALUES (?, ?)
`);

// 3. Connect to tap's websocket and store records
const TAP_WS_URL = process.env.TAP_WS_URL || 'ws://localhost:2480/channel';
let ws = null;
let reconnectTimeout = null;
let recordCount = 0;

function connectToTap() {
  console.log(`Connecting to tap at ${TAP_WS_URL}...`);

  ws = new WebSocket(TAP_WS_URL);

  ws.on('open', () => {
    console.log('Connected to tap websocket');
  });

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data.toString());

      // Store identity events for actorHandle lookups
      if (event.type === 'identity' && event.identity) {
        const { did, handle } = event.identity;
        if (did && handle) {
          upsertActor.run(did, handle);
        }
      }

      if (event.type === 'record' && event.record) {
        const { did, collection, rkey, cid, action, record } = event.record;

        // Only store records for our collections
        if (!SYNC_COLLECTIONS.includes(collection)) {
          return;
        }

        const uri = `at://${did}/${collection}/${rkey}`;

        if (action === 'delete') {
          deleteRecord.run(uri);
          console.log(`Deleted: ${uri}`);
        } else {
          // create or update
          const now = new Date().toISOString();
          insertRecord.run(uri, did, collection, rkey, cid, JSON.stringify(record), now);
          recordCount++;
          if (recordCount % 100 === 0) {
            const dbCount = db.prepare('SELECT COUNT(*) as c FROM records').get().c;
            console.log(`Processed ${recordCount} events, ${dbCount} records in db`);
          }
        }
      }
    } catch (err) {
      console.error('Error processing message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected from tap, reconnecting in 5s...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('Websocket error:', err.message);
  });
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToTap();
  }, 5000);
}

// Start websocket connection
connectToTap();

// 4. Query adapter: translates lex-gql operations to SQLite queries
async function query(op) {
  if (op.type === 'findMany') {
    return findMany(op);
  }
  if (op.type === 'aggregate') {
    return aggregate(op);
  }
  throw new Error(`Unsupported operation type: ${op.type}`);
}

function findMany(op) {
  const { collection, where = [], pagination = {} } = op;
  const { first = 20, after } = pagination;

  // Build WHERE clause
  const conditions = ['r.collection = ?'];
  const params = [collection];

  // System fields that are columns, not in JSON
  const systemFields = {
    did: 'r.did',
    uri: 'r.uri',
    collection: 'r.collection',
    cid: 'r.cid',
    indexedAt: 'r.indexed_at',
  };

  for (const clause of where) {
    const { field, op: operator, value } = clause;
    // Map field to column or JSON path
    const fieldPath = systemFields[field] || `json_extract(r.record, '$.${field}')`;

    switch (operator) {
      case 'eq':
        conditions.push(`${fieldPath} = ?`);
        params.push(value);
        break;
      case 'contains':
        conditions.push(`${fieldPath} LIKE ?`);
        params.push(`%${value}%`);
        break;
      case 'gt':
        conditions.push(`${fieldPath} > ?`);
        params.push(value);
        break;
      case 'gte':
        conditions.push(`${fieldPath} >= ?`);
        params.push(value);
        break;
      case 'lt':
        conditions.push(`${fieldPath} < ?`);
        params.push(value);
        break;
      case 'lte':
        conditions.push(`${fieldPath} <= ?`);
        params.push(value);
        break;
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          conditions.push(`${fieldPath} IN (${placeholders})`);
          params.push(...value);
        }
        break;
    }
  }

  // Handle cursor pagination
  if (after) {
    try {
      const cursor = JSON.parse(Buffer.from(after, 'base64').toString());
      if (cursor.id) {
        conditions.push('r.id < ?');
        params.push(cursor.id);
      }
    } catch {
      // Invalid cursor, ignore
    }
  }

  // Build and execute query
  const whereClause = conditions.join(' AND ');
  const limit = first + 1; // Fetch one extra to detect hasNext
  const sql = `
    SELECT r.id, r.did, r.collection, r.rkey, r.cid, r.record, r.indexed_at, a.handle
    FROM records r
    LEFT JOIN actors a ON r.did = a.did
    WHERE ${whereClause}
    ORDER BY r.id DESC
    LIMIT ?
  `;
  params.push(limit);

  const rawRows = db.prepare(sql).all(...params);
  const hasNext = rawRows.length > first;
  const rows = hasNext ? rawRows.slice(0, first) : rawRows;

  // Transform rows to lex-gql format
  const transformed = rows.map((row) => ({
    ...hydrateRecord({
      uri: `at://${row.did}/${row.collection}/${row.rkey}`,
      did: row.did,
      collection: row.collection,
      cid: row.cid,
      record: row.record,
      indexed_at: row.indexed_at,
      handle: row.handle,
    }),
    _id: row.id, // For cursor
  }));

  return {
    rows: transformed,
    hasNext,
    hasPrev: !!after,
  };
}

function aggregate(op) {
  const { collection, where = [], groupBy = [] } = op;

  // Build WHERE clause
  const conditions = ['collection = ?'];
  const params = [collection];

  for (const clause of where) {
    const { field, op: operator, value } = clause;
    const jsonPath = `json_extract(record, '$.${field}')`;
    if (operator === 'eq') {
      conditions.push(`${jsonPath} = ?`);
      params.push(value);
    }
  }

  const whereClause = conditions.join(' AND ');

  if (groupBy.length === 0) {
    // Simple count
    const sql = `SELECT COUNT(*) as count FROM records WHERE ${whereClause}`;
    const result = db.prepare(sql).get(...params);
    return { count: result.count, groups: [] };
  }

  // Grouped count
  const groupFields = groupBy.map((f) => `json_extract(record, '$.${f}') as ${f}`).join(', ');
  const sql = `
    SELECT ${groupFields}, COUNT(*) as count
    FROM records
    WHERE ${whereClause}
    GROUP BY ${groupBy.map((f) => `json_extract(record, '$.${f}')`).join(', ')}
    ORDER BY count DESC
    LIMIT 100
  `;
  const groups = db.prepare(sql).all(...params);

  return {
    count: groups.reduce((sum, g) => sum + g.count, 0),
    groups,
  };
}

// 5. Create lex-gql adapter
const adapter = createAdapter(lexicons, { query });

// 6. GraphiQL HTML
const graphiqlHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tap GraphQL</title>
    <style>
      body { margin: 0; }
      #graphiql { height: 100dvh; }
      .loading { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
    </style>
    <link rel="stylesheet" href="https://esm.sh/graphiql/dist/style.css" />
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@19.1.0",
        "react/": "https://esm.sh/react@19.1.0/",
        "react-dom": "https://esm.sh/react-dom@19.1.0",
        "react-dom/": "https://esm.sh/react-dom@19.1.0/",
        "graphiql": "https://esm.sh/graphiql?standalone&external=react,react-dom,@graphiql/react,graphql",
        "@graphiql/react": "https://esm.sh/@graphiql/react?standalone&external=react,react-dom,graphql,@graphiql/toolkit,@emotion/is-prop-valid",
        "@graphiql/toolkit": "https://esm.sh/@graphiql/toolkit?standalone&external=graphql",
        "graphql": "https://esm.sh/graphql@16.11.0",
        "@emotion/is-prop-valid": "data:text/javascript,"
      }
    }
    </script>
    <script type="module">
      import React from 'react';
      import ReactDOM from 'react-dom/client';
      import { GraphiQL } from 'graphiql';
      import { createGraphiQLFetcher } from '@graphiql/toolkit';

      const fetcher = createGraphiQLFetcher({ url: '/graphql' });
      const defaultQuery = \`# Welcome to Tap GraphQL
#
# Query AT Protocol records synced by tap.
# This example tracks xyz.statusphere.status and app.bsky.actor.profile records.

# Query statuses with author profiles (DID join)
query StatusesWithProfiles {
  xyzStatusphereStatus(first: 10) {
    edges {
      node {
        status
        createdAt
        actorHandle
        appBskyActorProfileByDid {
          displayName
          avatar {
            url(preset: "avatar")
          }
        }
      }
    }
  }
}
\`;

      const root = ReactDOM.createRoot(document.getElementById('graphiql'));
      root.render(React.createElement(GraphiQL, { fetcher, defaultQuery }));
    </script>
  </head>
  <body>
    <div id="graphiql"><div class="loading">Loading…</div></div>
  </body>
</html>`;

// 7. Create HTTP server
const graphqlHandler = createHandler({ schema: adapter.schema });

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve GraphiQL at root
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(graphiqlHtml);
    return;
  }

  // Stats endpoint
  if (req.method === 'GET' && req.url === '/stats') {
    const count = db.prepare('SELECT COUNT(*) as count FROM records').get();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ recordCount: count.count, wsConnected: ws?.readyState === WebSocket.OPEN }),
    );
    return;
  }

  // GraphQL endpoint
  if (req.url === '/graphql') {
    graphqlHandler(req, res);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`GraphQL server running at http://localhost:${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser for GraphiQL`);
  console.log(`Stats available at http://localhost:${PORT}/stats`);
  console.log('');
  console.log('Make sure tap is running: docker compose up -d');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  db.close();
  server.close();
  process.exit(0);
});
