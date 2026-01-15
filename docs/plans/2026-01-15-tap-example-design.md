# Tap Example Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a minimal GraphQL server that queries AT Protocol records from a local tap instance.

**Architecture:** Docker runs tap server syncing `xyz.statusphere.status` records to SQLite. Node.js server uses lex-gql to generate GraphQL schema, queries SQLite directly via better-sqlite3, serves GraphQL over HTTP with GraphiQL UI.

**Tech Stack:** Node.js, lex-gql, graphql, graphql-http, better-sqlite3, Docker

---

### Task 1: Create Example Directory Structure

**Files:**
- Create: `examples/tap/package.json`
- Create: `examples/tap/docker-compose.yml`

**Step 1: Create package.json**

```json
{
  "name": "lex-gql-tap-example",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Example: lex-gql queries with AT Protocol tap",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "graphql": "^16.8.0",
    "graphql-http": "^1.22.0",
    "lex-gql": "workspace:*"
  }
}
```

**Step 2: Create docker-compose.yml**

```yaml
services:
  tap:
    image: ghcr.io/bluesky-social/indigo/tap:latest
    ports:
      - "2480:2480"
    volumes:
      - ./data:/data
    environment:
      TAP_DATABASE_URL: /data/tap.db
      TAP_RELAY_URL: https://relay1.us-east.bsky.network
      TAP_COLLECTION_FILTERS: xyz.statusphere.status
      TAP_DISABLE_ACKS: "true"
      TAP_FULL_NETWORK: "true"
```

**Step 3: Create .gitignore for data directory**

Create `examples/tap/.gitignore`:
```
data/
```

**Step 4: Commit**

```bash
git add examples/tap/package.json examples/tap/docker-compose.yml examples/tap/.gitignore
git commit -m "feat(examples): add tap example scaffolding"
```

---

### Task 2: Implement GraphQL Server with SQLite Adapter

**Files:**
- Create: `examples/tap/index.js`

**Step 1: Create the server implementation**

```javascript
/**
 * Example: lex-gql queries with AT Protocol tap
 *
 * This example shows how to query AT Protocol records synced by tap
 * through a GraphQL API powered by lex-gql.
 *
 * Prerequisites:
 *   docker compose up -d   # Start tap server
 *   npm install
 *   node index.js
 */

import { createServer } from 'node:http';
import { createHandler } from 'graphql-http/lib/use/node';
import Database from 'better-sqlite3';
import { createAdapter, parseLexicon } from 'lex-gql';

// 1. Define lexicon for xyz.statusphere.status
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
];

// 2. Open tap's SQLite database
const dbPath = './data/tap.db';
let db;
try {
  db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.error(`Failed to open database at ${dbPath}`);
  console.error('Make sure tap is running: docker compose up -d');
  process.exit(1);
}

// 3. Query adapter: translates lex-gql operations to SQLite queries
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
  const conditions = ['collection = ?'];
  const params = [collection];

  for (const clause of where) {
    const { field, op: operator, value } = clause;
    // Map field to JSON path in record blob
    const jsonPath = `json_extract(record, '$.${field}')`;

    switch (operator) {
      case 'eq':
        conditions.push(`${jsonPath} = ?`);
        params.push(value);
        break;
      case 'contains':
        conditions.push(`${jsonPath} LIKE ?`);
        params.push(`%${value}%`);
        break;
      case 'gt':
        conditions.push(`${jsonPath} > ?`);
        params.push(value);
        break;
      case 'gte':
        conditions.push(`${jsonPath} >= ?`);
        params.push(value);
        break;
      case 'lt':
        conditions.push(`${jsonPath} < ?`);
        params.push(value);
        break;
      case 'lte':
        conditions.push(`${jsonPath} <= ?`);
        params.push(value);
        break;
      case 'in':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          conditions.push(`${jsonPath} IN (${placeholders})`);
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
        conditions.push('id > ?');
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
    SELECT id, did, collection, rkey, cid, record, indexed_at
    FROM records
    WHERE ${whereClause}
    ORDER BY id DESC
    LIMIT ?
  `;
  params.push(limit);

  const rawRows = db.prepare(sql).all(...params);
  const hasNext = rawRows.length > first;
  const rows = hasNext ? rawRows.slice(0, first) : rawRows;

  // Transform rows to lex-gql format
  const transformed = rows.map((row) => {
    const record = JSON.parse(row.record);
    return {
      uri: `at://${row.did}/${row.collection}/${row.rkey}`,
      cid: row.cid,
      did: row.did,
      collection: row.collection,
      indexedAt: row.indexed_at,
      ...record,
      _id: row.id, // For cursor
    };
  });

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
  const groupFields = groupBy
    .map((f) => `json_extract(record, '$.${f}') as ${f}`)
    .join(', ');
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

// 4. Create lex-gql adapter
const adapter = createAdapter(lexicons, { query });

// 5. GraphiQL HTML
const graphiqlHtml = `<!DOCTYPE html>
<html>
  <head>
    <title>Tap GraphQL</title>
    <link href="https://unpkg.com/graphiql/graphiql.min.css" rel="stylesheet" />
  </head>
  <body style="margin: 0;">
    <div id="graphiql" style="height: 100vh;"></div>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/graphiql/graphiql.min.js"></script>
    <script>
      const root = ReactDOM.createRoot(document.getElementById('graphiql'));
      root.render(
        React.createElement(GraphiQL, {
          fetcher: GraphiQL.createFetcher({ url: '/graphql' }),
          defaultQuery: \`# Welcome to Tap GraphQL
#
# Query AT Protocol records synced by tap.
# This example tracks xyz.statusphere.status records.

query {
  xyzStatusphereStatus(first: 10) {
    edges {
      node {
        uri
        did
        status
        createdAt
        indexedAt
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}
\`
        })
      );
    </script>
  </body>
</html>`;

// 6. Create HTTP server
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
  console.log('');
  console.log('Make sure tap is running: docker compose up -d');
});
```

**Step 2: Commit**

```bash
git add examples/tap/index.js
git commit -m "feat(examples): implement tap GraphQL server"
```

---

### Task 3: Add README Documentation

**Files:**
- Create: `examples/tap/README.md`

**Step 1: Create README**

```markdown
# Tap Example

Query AT Protocol records through GraphQL using [tap](https://github.com/bluesky-social/indigo/tree/main/cmd/tap) as the data source.

## What This Does

1. **tap** syncs AT Protocol records from the relay to a local SQLite database
2. **lex-gql** generates a GraphQL schema from lexicon definitions
3. **This server** queries tap's SQLite database and serves it via GraphQL

## Prerequisites

- Docker
- Node.js 18+
- pnpm (run `npm install -g pnpm` if needed)

## Quick Start

```bash
# 1. Start tap (begins syncing xyz.statusphere.status records)
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Start the GraphQL server
node index.js

# 4. Open http://localhost:4000 for GraphiQL
```

## Example Queries

### List Recent Statuses

```graphql
query {
  xyzStatusphereStatus(first: 10) {
    edges {
      node {
        uri
        did
        status
        createdAt
        indexedAt
      }
    }
    pageInfo {
      hasNextPage
    }
  }
}
```

### Filter by Emoji

```graphql
query {
  xyzStatusphereStatus(first: 20, where: { status: { eq: "👍" } }) {
    edges {
      node {
        did
        status
        createdAt
      }
    }
  }
}
```

### Aggregate by Status

```graphql
query {
  xyzStatusphereStatusAggregate(groupBy: [status]) {
    count
    groups {
      status
      count
    }
  }
}
```

## Notes

- **Sync takes time**: tap starts syncing from the relay when you run `docker compose up`. It may take a few minutes before records appear.
- **Statusphere records may be sparse**: The `xyz.statusphere.status` collection is from the [Statusphere tutorial app](https://atproto.com/guides/applications). There may not be many records on the network.
- **Database location**: tap stores data in `./data/tap.db`. Delete this directory to reset.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AT Protocol    │────▶│   tap server    │────▶│   SQLite DB     │
│  Relay          │     │  (Docker)       │     │  (./data/tap.db)│
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Browser        │◀────│  Node.js Server │
                        │  (GraphiQL)     │     │  (lex-gql)      │
                        └─────────────────┘     └─────────────────┘
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 4000)

### tap Configuration

Edit `docker-compose.yml` to change tap settings:

- `TAP_COLLECTION_FILTERS` - Comma-separated list of collections to sync
- `TAP_RELAY_URL` - AT Protocol relay to sync from
- `TAP_FULL_NETWORK` - Set to `true` to track all repos

## Troubleshooting

**"Failed to open database"**
- Make sure tap is running: `docker compose up -d`
- Check tap logs: `docker compose logs tap`

**No records appearing**
- Wait a few minutes for tap to sync
- Check tap stats: `curl http://localhost:2480/stats/repos`
```

**Step 2: Commit**

```bash
git add examples/tap/README.md
git commit -m "docs(examples): add tap example README"
```

---

### Task 4: Update Root README

**Files:**
- Modify: `README.md`

**Step 1: Add tap example to examples list**

In the Examples section of the root README, add:

```markdown
- [`tap`](./examples/tap) - GraphQL queries with AT Protocol tap
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add tap example to root README"
```

---

### Task 5: Test the Example

**Step 1: Install dependencies**

```bash
cd examples/tap
pnpm install
```

**Step 2: Start tap**

```bash
docker compose up -d
```

Expected: tap container starts, begins syncing from relay

**Step 3: Wait for database to be created**

```bash
# Wait until tap.db exists
ls -la data/
```

Expected: `tap.db` file appears (may take 10-30 seconds)

**Step 4: Start the server**

```bash
node index.js
```

Expected output:
```
GraphQL server running at http://localhost:4000
Open http://localhost:4000 in your browser for GraphiQL

Make sure tap is running: docker compose up -d
```

**Step 5: Test GraphQL query**

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ xyzStatusphereStatus(first: 5) { edges { node { uri status } } } }"}'
```

Expected: JSON response with edges array (may be empty if no records synced yet)

**Step 6: Stop services**

```bash
# Stop the Node server (Ctrl+C)
docker compose down
```

---

## Summary

This plan creates a minimal tap example with:
- Docker Compose for running tap
- SQLite query adapter for lex-gql
- HTTP server with GraphiQL
- Documentation

Total: 5 tasks, ~20 steps
