/**
 * teal.fm-Relay Example Server
 *
 * Full-stack example combining:
 * - tap: syncs AT Protocol records
 * - lex-gql + lex-gql-duckdb: GraphQL API over lexicon records
 * - React/Relay: frontend for displaying music scrobbles
 *
 * Usage:
 *   docker compose up -d   # Start tap
 *   pnpm install
 *   pnpm dev               # Start server + vite
 */

import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { createHandler } from "graphql-http/lib/use/http";
import { createAdapter, parseLexicon } from "lex-gql";
import { createDuckDB, setupSchema, createWriter, createDuckDBAdapter } from "lex-gql-duckdb";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import WebSocket from "ws";

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
          if (content.defs?.main?.type === "record" || content.defs) {
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

const SYNC_COLLECTIONS = lexicons
  .filter((l) => l.defs?.main?.type === "record")
  .map((l) => l.id);
console.log(`Syncing collections: ${SYNC_COLLECTIONS.join(", ")}`);

// 2. Setup DuckDB database
const dbPath = "./data/records.duckdb";
mkdirSync("./data", { recursive: true });

console.log("Connecting to DuckDB...");
const duck = await createDuckDB(dbPath);
await setupSchema(duck);

const recordCount = await duck.get("SELECT COUNT(*) as c FROM records");
console.log(`DuckDB has ${Number(recordCount.c).toLocaleString()} records`);

// 3. Event emitter for subscriptions
const recordEvents = new EventEmitter();
recordEvents.setMaxListeners(100);

// Look up actor handle from database
async function getActorHandle(did) {
  const row = await duck.get("SELECT handle FROM actors WHERE did = ?", [did]);
  return row?.handle || null;
}

// Look up actor profile from database
async function getActorProfile(did) {
  const row = await duck.get(
    "SELECT record FROM records WHERE did = ? AND collection = 'app.bsky.actor.profile'",
    [did]
  );
  if (!row?.record) return null;

  const profile = typeof row.record === 'string' ? JSON.parse(row.record) : row.record;

  // Return blob data in format expected by lex-gql Blob type resolver
  // The resolver needs { ref, did, mimeType, size } to compute the URL
  let avatar = null;
  if (profile.avatar?.ref?.$link) {
    avatar = {
      ref: profile.avatar.ref.$link,
      did,
      mimeType: profile.avatar.mimeType || 'image/jpeg',
      size: profile.avatar.size || 0,
    };
  }

  return {
    displayName: profile.displayName || null,
    avatar,
  };
}

// Create writer with batching for DuckDB
const baseWriter = createWriter(duck);

function parseAtUri(uri) {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`Invalid AT URI: ${uri}`);
  return { did: match[1], collection: match[2], rkey: match[3] };
}

// Batch writes for better performance
const pendingWrites = [];
const BATCH_SIZE = 500;  // Larger batches with true batch INSERT
const BATCH_INTERVAL = 100;
let batchTimeout = null;
let isFlushing = false;

async function flushWrites() {
  if (pendingWrites.length === 0 || isFlushing) return;
  isFlushing = true;

  const batch = pendingWrites.splice(0, BATCH_SIZE);
  try {
    // Single batch INSERT is ~10x faster than individual inserts
    await baseWriter.insertRecordsBatch(batch);
  } catch (err) {
    // Ignore constraint errors from malformed records
    if (!err.message.includes('NOT NULL constraint')) {
      console.error('Batch insert error:', err.message);
    }
  }

  isFlushing = false;

  // If more pending, schedule next batch
  if (pendingWrites.length > 0) {
    scheduleBatchFlush();
  }
}

function scheduleBatchFlush() {
  if (batchTimeout) return;
  batchTimeout = setTimeout(async () => {
    batchTimeout = null;
    await flushWrites();
  }, BATCH_INTERVAL);
}

const writer = {
  insertRecord: (input) => {
    pendingWrites.push(input);

    if (pendingWrites.length >= BATCH_SIZE) {
      flushWrites();
    } else {
      scheduleBatchFlush();
    }
  },
  deleteRecord: async (uri) => {
    await flushWrites();
    await baseWriter.deleteRecord(uri);
    const { collection } = parseAtUri(uri);
    recordEvents.emit(`${collection}:deleted`, { uri });
  },
  upsertActor: baseWriter.upsertActor,
  flush: flushWrites,
};

// 4. Connect to tap websocket
const TAP_WS_URL = process.env.TAP_WS_URL || "ws://localhost:2480/channel";
let ws = null;
let reconnectTimeout = null;
let recordCount2 = 0;

function connectToTap() {
  console.log(`Connecting to tap at ${TAP_WS_URL}...`);

  ws = new WebSocket(TAP_WS_URL);

  ws.on("open", () => {
    console.log("Connected to tap websocket");
  });

  ws.on("message", (data) => {
    try {
      const event = JSON.parse(data.toString());

      if (event.type === "identity" && event.identity) {
        const { did, handle } = event.identity;
        if (did && handle) {
          writer.upsertActor(did, handle);
        }
      }

      if (event.type === "record" && event.record) {
        const { did, collection, rkey, cid, action, record } = event.record;

        if (!SYNC_COLLECTIONS.includes(collection)) {
          return;
        }

        const uri = `at://${did}/${collection}/${rkey}`;

        if (action === "delete") {
          writer.deleteRecord(uri);
          console.log(`Deleted: ${uri}`);
        } else if (record) {
          writer.insertRecord({ uri, cid, record });
          // TODO: Abstract subscription layer in lex-gql to handle field resolution
          // (related records, blob URLs) like queries do, instead of manual lookups
          Promise.all([getActorHandle(did), getActorProfile(did)]).then(([actorHandle, profile]) => {
            recordEvents.emit(`${collection}:created`, {
              ...record,
              uri,
              actorHandle,
              appBskyActorProfileByDid: profile,
            });
          });
          recordCount2++;
          if (recordCount2 % 1000 === 0) {
            console.log(`Processed ${recordCount2} events`);
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

// 5. Create lex-gql adapter with DuckDB
const query = createDuckDBAdapter(duck);

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

// 6. Static file serving
import { existsSync } from "node:fs";

function serveStatic(req, res) {
  const distPath = "./dist";
  if (!existsSync(distPath)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>teal.fm Relay</title></head>
        <body>
          <h1>Frontend not built</h1>
          <p>Run <code>pnpm build</code> to build the frontend, or use <code>pnpm dev:client</code> for development.</p>
          <p><a href="/graphiql">GraphiQL</a> is available for testing queries.</p>
        </body>
      </html>
    `);
    return;
  }

  // Strip query string from URL
  const urlPath = req.url.split("?")[0];
  let filePath = join(distPath, urlPath === "/" ? "index.html" : urlPath);

  // Known static file extensions
  const staticExtensions = ['.js', '.css', '.html', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.map'];
  const urlExt = urlPath.substring(urlPath.lastIndexOf('.'));
  const isStaticFile = staticExtensions.includes(urlExt.toLowerCase());

  // SPA fallback: serve index.html for routes that aren't static files
  if (!existsSync(filePath) && !isStaticFile) {
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
    <title>teal.fm GraphiQL</title>
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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/graphiql") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(graphiqlHtml);
    return;
  }

  if (req.method === "GET" && req.url === "/stats") {
    duck.get("SELECT COUNT(*) as count FROM records").then((result) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          recordCount: Number(result.count),
          wsConnected: ws?.readyState === WebSocket.OPEN,
          database: "DuckDB",
        })
      );
    });
    return;
  }

  if (req.url === "/graphql") {
    graphqlHandler(req, res);
    return;
  }

  serveStatic(req, res);
});

// 9. WebSocket server for GraphQL subscriptions
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`\nServer running at http://localhost:${PORT}`);
  console.log(`GraphiQL at http://localhost:${PORT}/graphiql`);
  console.log(`Stats at http://localhost:${PORT}/stats`);
  console.log("");
  console.log("Make sure tap is running: docker compose up -d");
});

const wsServer = new WebSocketServer({
  server,
  path: "/graphql",
});

useServer({ schema: adapter.schema }, wsServer);

console.log("GraphQL subscriptions available via WebSocket");

// 10. Graceful shutdown
let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) {
    console.log("Force exiting...");
    process.exit(1);
  }
  isShuttingDown = true;
  console.log("\nShutting down...");

  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (batchTimeout) clearTimeout(batchTimeout);
  if (ws) {
    ws.removeAllListeners();
    ws.close();
  }

  await writer.flush();

  const shutdownTimeout = setTimeout(() => {
    console.log("Shutdown timeout, force exiting...");
    process.exit(1);
  }, 3000);
  shutdownTimeout.unref();

  wsServer.close();

  // Close DuckDB asynchronously
  await new Promise((resolve) => duck.db.close(resolve));
  console.log("Database closed");

  server.close(() => {
    clearTimeout(shutdownTimeout);
    console.log("Server closed");
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
