# Slices-Relay Example Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an integrated full-stack example combining a React/Relay frontend with a lex-gql backend powered by tap.

**Architecture:** A single package that includes a Node.js server (lex-gql + tap websocket + static file serving) and a React/Vite frontend. The server syncs AT Protocol records via tap, stores them in SQLite, and serves GraphQL queries/subscriptions. The frontend displays music scrobbles from `fm.teal.alpha.feed.play`.

**Tech Stack:** Node.js, better-sqlite3, graphql-http, graphql-ws, React 19, Relay, Vite, Tailwind CSS

---

## Task 1: Create Example Directory Structure

**Files:**
- Create: `examples/relay/`
- Create: `examples/relay/.gitignore`

**Step 1: Create the directory**

```bash
mkdir -p examples/relay
```

**Step 2: Create .gitignore**

Create `examples/relay/.gitignore`:

```
node_modules/
data/
dist/
```

**Step 3: Commit**

```bash
git add examples/relay/.gitignore
git commit -m "chore: scaffold relay example directory"
```

---

## Task 2: Copy Lexicons

**Files:**
- Create: `examples/relay/lexicons/` (copy from `~/code/lexicons/teal/lexicons`)

**Step 1: Copy lexicons directory**

```bash
cp -r ~/code/lexicons/teal/lexicons examples/relay/lexicons
```

**Step 2: Verify structure**

```bash
find examples/relay/lexicons -name "*.json"
```

Expected files:
- `lexicons/fm/teal/feed/play.json`
- `lexicons/fm/teal/feed/defs.json`
- `lexicons/app/bsky/actor/profile.json`
- `lexicons/com/atproto/label/defs.json`
- `lexicons/com/atproto/repo/strongRef.json`

**Step 3: Commit**

```bash
git add examples/relay/lexicons
git commit -m "chore: add teal lexicons to relay example"
```

---

## Task 3: Copy React Frontend Source

**Files:**
- Create: `examples/relay/src/` (copy from `~/code/relay/src`)
- Create: `examples/relay/index.html`
- Create: `examples/relay/postcss.config.js`
- Create: `examples/relay/relay.config.json`
- Create: `examples/relay/schema.graphql`
- Create: `examples/relay/tsconfig.json`
- Create: `examples/relay/tsconfig.app.json`
- Create: `examples/relay/tsconfig.node.json`

**Step 1: Copy frontend files**

```bash
cp -r ~/code/relay/src examples/relay/
cp ~/code/relay/index.html examples/relay/
cp ~/code/relay/postcss.config.js examples/relay/
cp ~/code/relay/relay.config.json examples/relay/
cp ~/code/relay/schema.graphql examples/relay/
cp ~/code/relay/tsconfig.json examples/relay/
cp ~/code/relay/tsconfig.app.json examples/relay/
cp ~/code/relay/tsconfig.node.json examples/relay/
```

**Step 2: Verify key files exist**

```bash
ls examples/relay/src/App.tsx
ls examples/relay/src/main.tsx
ls examples/relay/schema.graphql
```

**Step 3: Commit**

```bash
git add examples/relay/src examples/relay/index.html examples/relay/postcss.config.js examples/relay/relay.config.json examples/relay/schema.graphql examples/relay/tsconfig*.json
git commit -m "chore: copy relay frontend source"
```

---

## Task 4: Modify Frontend Endpoints

**Files:**
- Modify: `examples/relay/src/main.tsx:21-24`

**Step 1: Update endpoints to use relative paths**

In `examples/relay/src/main.tsx`, replace:

```tsx
const HTTP_ENDPOINT =
  "https://quickslice-production-d668.up.railway.app/graphql";

const WS_ENDPOINT = "wss://quickslice-production-d668.up.railway.app/graphql";
```

With:

```tsx
const HTTP_ENDPOINT = "/graphql";

const WS_ENDPOINT = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/graphql`;
```

**Step 2: Commit**

```bash
git add examples/relay/src/main.tsx
git commit -m "feat: use relative endpoints for local development"
```

---

## Task 5: Create Vite Config with Proxy

**Files:**
- Create: `examples/relay/vite.config.ts`

**Step 1: Create vite.config.ts**

Create `examples/relay/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import relay from "vite-plugin-relay";

export default defineConfig({
  plugins: [relay, react()],
  server: {
    proxy: {
      "/graphql": {
        target: "http://localhost:4000",
        ws: true,
      },
    },
  },
});
```

**Step 2: Commit**

```bash
git add examples/relay/vite.config.ts
git commit -m "feat: add vite config with dev proxy"
```

---

## Task 6: Create Docker Compose for Tap

**Files:**
- Create: `examples/relay/docker-compose.yml`

**Step 1: Create docker-compose.yml**

Create `examples/relay/docker-compose.yml`:

```yaml
services:
  tap:
    image: ghcr.io/flicknow/tap:latest
    ports:
      - "2480:2480"
    environment:
      TAP_SIGNAL_COLLECTION: fm.teal.alpha.feed.play
      TAP_COLLECTION_FILTERS: fm.teal.alpha.feed.play,app.bsky.actor.profile
```

**Step 2: Commit**

```bash
git add examples/relay/docker-compose.yml
git commit -m "feat: add docker-compose for tap"
```

---

## Task 7: Create Package.json

**Files:**
- Create: `examples/relay/package.json`

**Step 1: Create package.json**

Create `examples/relay/package.json`:

```json
{
  "name": "relay-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "concurrently \"node index.js\" \"vite\"",
    "dev:server": "node index.js",
    "dev:client": "vite",
    "build": "vite build",
    "start": "node index.js",
    "relay": "relay-compiler"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "graphql": "^16.11.0",
    "graphql-http": "^1.22.0",
    "graphql-ws": "^5.16.0",
    "lex-gql": "workspace:*",
    "lex-gql-sqlite": "workspace:*",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "react-relay": "^20.1.1",
    "react-router-dom": "^7.9.3",
    "relay-runtime": "^20.1.1",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.14",
    "@types/better-sqlite3": "^7.6.12",
    "@types/react": "^19.1.16",
    "@types/react-dom": "^19.1.9",
    "@types/react-relay": "^18.2.1",
    "@types/relay-runtime": "^19.0.3",
    "@types/ws": "^8.5.10",
    "@vitejs/plugin-react": "^5.0.4",
    "autoprefixer": "^10.4.21",
    "babel-plugin-relay": "^20.1.1",
    "concurrently": "^8.2.2",
    "postcss": "^8.5.6",
    "relay-compiler": "^20.1.1",
    "tailwindcss": "^4.1.14",
    "typescript": "~5.9.3",
    "vite": "^7.1.7",
    "vite-plugin-relay": "^2.1.0"
  }
}
```

**Step 2: Commit**

```bash
git add examples/relay/package.json
git commit -m "feat: add package.json with combined dependencies"
```

---

## Task 8: Create Server - Lexicon Loading

**Files:**
- Create: `examples/relay/index.js` (partial - lexicon loading)

**Step 1: Create index.js with lexicon loading**

Create `examples/relay/index.js`:

```js
/**
 * Slices-Relay Example Server
 *
 * Full-stack example combining:
 * - tap: syncs AT Protocol records
 * - lex-gql: GraphQL API over lexicon records
 * - React/Relay: frontend for displaying music scrobbles
 *
 * Usage:
 *   docker compose up -d   # Start tap
 *   pnpm install
 *   pnpm dev               # Start server + vite
 */

import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import Database from "better-sqlite3";
import { createHandler } from "graphql-http/lib/use/http";
import { createAdapter, parseLexicon } from "lex-gql";
import { createSqliteAdapter, createWriter, setupSchema } from "lex-gql-sqlite";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";

// 1. Load lexicons from filesystem
function loadLexicons(dir) {
  const lexicons = [];

  function walk(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".json")) {
        try {
          const content = JSON.parse(readFileSync(fullPath, "utf-8"));
          // Only parse record lexicons (have defs.main.type === 'record')
          if (content.defs?.main?.type === "record") {
            lexicons.push(parseLexicon(content));
          }
        } catch (err) {
          console.warn(`Skipping ${fullPath}: ${err.message}`);
        }
      }
    }
  }

  walk(dir);
  return lexicons;
}

const lexicons = loadLexicons("./lexicons");
console.log(
  `Loaded ${lexicons.length} lexicons:`,
  lexicons.map((l) => l.id).join(", ")
);

// Collections to sync from tap
const SYNC_COLLECTIONS = lexicons.map((l) => l.id);
```

**Step 2: Verify syntax**

```bash
node --check examples/relay/index.js
```

Expected: No output (syntax OK) - will fail at runtime due to missing imports, that's fine.

**Step 3: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add server with lexicon loading"
```

---

## Task 9: Create Server - Database and Writer with Events

**Files:**
- Modify: `examples/relay/index.js` (append database + event emitter code)

**Step 1: Append database and event-emitting writer**

Append to `examples/relay/index.js`:

```js

// 2. Setup SQLite database
const dbPath = "./data/records.db";
import { mkdirSync } from "node:fs";
mkdirSync("./data", { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
setupSchema(db);

// 3. Event emitter for subscriptions
const recordEvents = new EventEmitter();
recordEvents.setMaxListeners(100);

// Create writer with event emission
const baseWriter = createWriter(db);

/** @param {string} uri */
function parseAtUri(uri) {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid AT URI: ${uri}`);
  return { did: match[1], collection: match[2], rkey: match[3] };
}

const writer = {
  insertRecord: (input) => {
    baseWriter.insertRecord(input);
    const { did, collection, rkey } = parseAtUri(input.uri);

    // Emit event for subscriptions
    const record =
      typeof input.record === "string"
        ? JSON.parse(input.record)
        : input.record;
    const hydratedRecord = {
      uri: input.uri,
      did,
      collection,
      rkey,
      cid: input.cid,
      indexedAt: input.indexedAt || new Date().toISOString(),
      ...record,
    };
    recordEvents.emit(`${collection}:created`, hydratedRecord);
  },
  deleteRecord: (uri) => {
    // Get record before deleting for the event
    const existing = db
      .prepare("SELECT * FROM records WHERE uri = ?")
      .get(uri);
    baseWriter.deleteRecord(uri);

    if (existing) {
      const { collection } = parseAtUri(uri);
      recordEvents.emit(`${collection}:deleted`, { uri });
    }
  },
  upsertActor: baseWriter.upsertActor,
};
```

**Step 2: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add database setup with event-emitting writer"
```

---

## Task 10: Create Server - Tap WebSocket Connection

**Files:**
- Modify: `examples/relay/index.js` (append tap connection code)

**Step 1: Append tap connection code**

Append to `examples/relay/index.js`:

```js

// 4. Connect to tap websocket
import WebSocket from "ws";

const TAP_WS_URL = process.env.TAP_WS_URL || "ws://localhost:2480/channel";
let ws = null;
let reconnectTimeout = null;
let recordCount = 0;

function connectToTap() {
  console.log(`Connecting to tap at ${TAP_WS_URL}...`);

  ws = new WebSocket(TAP_WS_URL);

  ws.on("open", () => {
    console.log("Connected to tap websocket");
  });

  ws.on("message", (data) => {
    try {
      const event = JSON.parse(data.toString());

      // Store identity events for actorHandle lookups
      if (event.type === "identity" && event.identity) {
        const { did, handle } = event.identity;
        if (did && handle) {
          writer.upsertActor(did, handle);
        }
      }

      if (event.type === "record" && event.record) {
        const { did, collection, rkey, cid, action, record } = event.record;

        // Only store records for our collections
        if (!SYNC_COLLECTIONS.includes(collection)) {
          return;
        }

        const uri = `at://${did}/${collection}/${rkey}`;

        if (action === "delete") {
          writer.deleteRecord(uri);
          console.log(`Deleted: ${uri}`);
        } else {
          writer.insertRecord({ uri, cid, record });
          recordCount++;
          if (recordCount % 100 === 0) {
            const dbCount = db
              .prepare("SELECT COUNT(*) as c FROM records")
              .get().c;
            console.log(
              `Processed ${recordCount} events, ${dbCount} records in db`
            );
          }
        }
      }
    } catch (err) {
      console.error("Error processing message:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("Disconnected from tap, reconnecting in 5s...");
    scheduleReconnect();
  });

  ws.on("error", (err) => {
    console.error("Websocket error:", err.message);
  });
}

function scheduleReconnect() {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectToTap();
  }, 5000);
}

connectToTap();
```

**Step 2: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add tap websocket connection"
```

---

## Task 11: Create Server - GraphQL Adapter with Subscriptions

**Files:**
- Modify: `examples/relay/index.js` (append GraphQL adapter code)

**Step 1: Append GraphQL adapter with subscribe function**

Append to `examples/relay/index.js`:

```js

// 5. Create lex-gql adapter with subscription support
const query = createSqliteAdapter(db);

/**
 * Subscribe function for GraphQL subscriptions
 * @param {{ collection: string, event: 'created' | 'updated' | 'deleted' }} op
 * @returns {AsyncIterable<any>}
 */
function subscribe({ collection, event }) {
  const eventName = `${collection}:${event}`;

  return {
    [Symbol.asyncIterator]() {
      const queue = [];
      let resolve = null;
      let done = false;

      const handler = (record) => {
        if (resolve) {
          resolve({ value: record, done: false });
          resolve = null;
        } else {
          queue.push(record);
        }
      };

      recordEvents.on(eventName, handler);

      return {
        next() {
          if (done) return Promise.resolve({ value: undefined, done: true });

          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift(), done: false });
          }

          return new Promise((r) => {
            resolve = r;
          });
        },
        return() {
          done = true;
          recordEvents.off(eventName, handler);
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

const adapter = createAdapter(lexicons, { query, subscribe });
```

**Step 2: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add GraphQL adapter with subscription support"
```

---

## Task 12: Create Server - HTTP Server and Routes

**Files:**
- Modify: `examples/relay/index.js` (append HTTP server code)

**Step 1: Append HTTP server with static file serving**

Append to `examples/relay/index.js`:

```js

// 6. Static file serving for built React app
import { existsSync } from "node:fs";

function serveStatic(req, res) {
  const distPath = "./dist";
  if (!existsSync(distPath)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Slices Relay</title></head>
        <body>
          <h1>Frontend not built</h1>
          <p>Run <code>pnpm build</code> to build the frontend, or use <code>pnpm dev</code> for development.</p>
          <p><a href="/graphiql">GraphiQL</a> is available for testing queries.</p>
        </body>
      </html>
    `);
    return;
  }

  let filePath = join(distPath, req.url === "/" ? "index.html" : req.url);

  // SPA fallback: serve index.html for non-file routes
  if (!existsSync(filePath) && !req.url.includes(".")) {
    filePath = join(distPath, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const ext = filePath.split(".").pop();
  const contentTypes = {
    html: "text/html",
    js: "application/javascript",
    css: "text/css",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };

  res.writeHead(200, {
    "Content-Type": contentTypes[ext] || "application/octet-stream",
  });
  res.end(readFileSync(filePath));
}

// 7. GraphiQL HTML
const graphiqlHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Slices GraphiQL</title>
    <style>body { margin: 0; } #graphiql { height: 100dvh; }</style>
    <link rel="stylesheet" href="https://esm.sh/graphiql/dist/style.css" />
    <link rel="stylesheet" href="https://esm.sh/@graphiql/plugin-explorer/dist/style.css" />
    <script type="importmap">
      {
        "imports": {
          "react": "https://esm.sh/react@19.1.0",
          "react/": "https://esm.sh/react@19.1.0/",
          "react-dom": "https://esm.sh/react-dom@19.1.0",
          "react-dom/": "https://esm.sh/react-dom@19.1.0/",
          "graphiql": "https://esm.sh/graphiql?standalone&external=react,react-dom,@graphiql/react,graphql",
          "@graphiql/plugin-explorer": "https://esm.sh/@graphiql/plugin-explorer?standalone&external=react,@graphiql/react,graphql",
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
      import { GraphiQL, HISTORY_PLUGIN } from 'graphiql';
      import { createGraphiQLFetcher } from '@graphiql/toolkit';
      import { explorerPlugin } from '@graphiql/plugin-explorer';
      import 'graphiql/setup-workers/esm.sh';

      const fetcher = createGraphiQLFetcher({
        url: '/graphql',
        subscriptionUrl: window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/graphql' : 'ws://' + window.location.host + '/graphql',
      });

      function App() {
        return React.createElement(GraphiQL, {
          fetcher,
          plugins: [HISTORY_PLUGIN, explorerPlugin()],
          defaultEditorToolsVisibility: true,
        });
      }

      ReactDOM.createRoot(document.getElementById('graphiql')).render(React.createElement(App));
    </script>
  </head>
  <body>
    <div id="graphiql">Loading...</div>
  </body>
</html>`;

// 8. Create HTTP server
const graphqlHandler = createHandler({ schema: adapter.schema });

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // GraphiQL
  if (req.method === "GET" && req.url === "/graphiql") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(graphiqlHtml);
    return;
  }

  // Stats endpoint
  if (req.method === "GET" && req.url === "/stats") {
    const count = db.prepare("SELECT COUNT(*) as count FROM records").get();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        recordCount: count.count,
        wsConnected: ws?.readyState === WebSocket.OPEN,
      })
    );
    return;
  }

  // GraphQL endpoint
  if (req.url === "/graphql") {
    graphqlHandler(req, res);
    return;
  }

  // Static files / React app
  serveStatic(req, res);
});
```

**Step 2: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add HTTP server with static file serving"
```

---

## Task 13: Create Server - WebSocket Server for Subscriptions

**Files:**
- Modify: `examples/relay/index.js` (append WebSocket server code)

**Step 1: Append WebSocket server for GraphQL subscriptions**

Append to `examples/relay/index.js`:

```js

// 9. WebSocket server for GraphQL subscriptions
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`GraphiQL at http://localhost:${PORT}/graphiql`);
  console.log(`Stats at http://localhost:${PORT}/stats`);
  console.log("");
  console.log("Make sure tap is running: docker compose up -d");
});

// WebSocket server for subscriptions
const wsServer = new WebSocketServer({
  server,
  path: "/graphql",
});

useServer({ schema: adapter.schema }, wsServer);

console.log("GraphQL subscriptions available via WebSocket");

// 10. Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  if (ws) ws.close();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  wsServer.close();
  db.close();
  server.close();
  process.exit(0);
});
```

**Step 2: Verify syntax**

```bash
node --check examples/relay/index.js
```

Expected: No output (syntax OK)

**Step 3: Commit**

```bash
git add examples/relay/index.js
git commit -m "feat: add WebSocket server for GraphQL subscriptions"
```

---

## Task 14: Create README

**Files:**
- Create: `examples/relay/README.md`

**Step 1: Create README**

Create `examples/relay/README.md`:

```markdown
# Slices-Relay Example

Full-stack example showing how to build an AT Protocol app with lex-gql.

**Stack:**
- **Backend:** Node.js + lex-gql + SQLite
- **Frontend:** React + Relay + Vite + Tailwind
- **Data:** tap syncs `fm.teal.alpha.feed.play` (music scrobbles) from the AT Protocol network

## Quick Start

1. Start tap:
   ```bash
   docker compose up -d
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Run development server:
   ```bash
   pnpm dev
   ```

4. Open http://localhost:5173 (Vite dev server with hot reload)

## Production Build

```bash
pnpm build
pnpm start
```

Then open http://localhost:4000

## Endpoints

- `/` - React app
- `/graphql` - GraphQL API (HTTP + WebSocket)
- `/graphiql` - GraphQL playground
- `/stats` - Server stats (record count, tap connection status)

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AT Proto   │────▶│    tap      │────▶│   Server    │
│   Network   │     │ (WebSocket) │     │  (lex-gql)  │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   SQLite    │
                                        │  (records)  │
                                        └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   React +   │
                                        │    Relay    │
                                        └─────────────┘
```

## Lexicons

This example syncs two collections:
- `fm.teal.alpha.feed.play` - Music scrobbles (track plays)
- `app.bsky.actor.profile` - User profiles
```

**Step 2: Commit**

```bash
git add examples/relay/README.md
git commit -m "docs: add README for relay example"
```

---

## Task 15: Install Dependencies and Test

**Files:**
- None (verification task)

**Step 1: Install dependencies**

```bash
cd examples/relay && pnpm install
```

**Step 2: Verify server starts (without tap)**

```bash
timeout 5 node index.js || true
```

Expected: Server should start and log messages about connecting to tap (will retry since tap isn't running).

**Step 3: Build frontend**

```bash
pnpm build
```

Expected: Vite builds successfully to `dist/`

**Step 4: Verify relay compiler works**

```bash
pnpm relay
```

Expected: Relay compiler runs without errors (types already generated).

**Step 5: Commit lockfile**

```bash
cd ../.. && git add pnpm-lock.yaml examples/relay/
git commit -m "chore: install relay example dependencies"
```

---

## Task 16: Final Integration Test

**Files:**
- None (verification task)

**Step 1: Start tap**

```bash
cd examples/relay && docker compose up -d
```

**Step 2: Start server**

```bash
node index.js &
SERVER_PID=$!
sleep 3
```

**Step 3: Test GraphQL endpoint**

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

Expected: `{"data":{"__typename":"Query"}}`

**Step 4: Test stats endpoint**

```bash
curl http://localhost:4000/stats
```

Expected: JSON with `recordCount` and `wsConnected: true`

**Step 5: Stop server**

```bash
kill $SERVER_PID
docker compose down
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete relay example" --allow-empty
```

---

## Summary

After completing all tasks, you will have:

1. A working full-stack example at `examples/relay/`
2. Backend that syncs AT Protocol records via tap
3. GraphQL API with query and subscription support
4. React/Relay frontend displaying music scrobbles
5. Development workflow with hot reload
6. Production build with static file serving
