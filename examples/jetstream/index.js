/**
 * Example: Integrating lex-gql subscriptions with AT Protocol Jetstream
 *
 * This example shows how to wire up real-time events from Jetstream
 * to GraphQL subscriptions using native WebSocket.
 *
 * Prerequisites:
 *   npm install lex-gql graphql graphql-ws ws
 */

import { useServer } from 'graphql-ws/lib/use/ws';
import { createAdapter, parseLexicon } from 'lex-gql';
import { WebSocket, WebSocketServer } from 'ws';

// 1. Define your lexicons (or load from files)
const lexicons = [
  parseLexicon({
    id: 'app.bsky.feed.post',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            createdAt: { type: 'string', format: 'datetime' },
          },
          required: ['text', 'createdAt'],
        },
      },
    },
  }),
];

// 2. Create a subscription manager using native WebSocket to Jetstream
class JetstreamSubscriptionManager {
  constructor(endpoint, collections) {
    this.endpoint = endpoint;
    this.collections = collections;
    this.listeners = new Map(); // collection:event -> Set<callback>
    this.ws = null;
  }

  connect() {
    const params = new URLSearchParams();
    for (const col of this.collections) {
      params.append('wantedCollections', col);
    }

    const url = `${this.endpoint}?${params}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('Connected to Jetstream');
    });

    this.ws.on('message', (data) => {
      try {
        const evt = JSON.parse(data.toString());
        if (evt.kind !== 'commit' || !evt.commit) return;

        const { collection, operation, record, rkey } = evt.commit;
        const eventType = {
          create: 'created',
          update: 'updated',
          delete: 'deleted',
        }[operation];
        if (!eventType) return;

        const key = `${collection}:${eventType}`;
        const callbacks = this.listeners.get(key);
        if (!callbacks || callbacks.size === 0) return;

        const payload = {
          uri: `at://${evt.did}/${collection}/${rkey}`,
          did: evt.did,
          cid: evt.commit.cid,
          collection,
          indexedAt: new Date().toISOString(),
          ...record,
        };

        for (const callback of callbacks) {
          callback(payload);
        }
      } catch (err) {
        console.error('Failed to parse Jetstream message:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('Disconnected from Jetstream, reconnecting in 5s...');
      setTimeout(() => this.connect(), 5000);
    });

    this.ws.on('error', (err) => {
      console.error('Jetstream WebSocket error:', err);
    });
  }

  subscribe(collection, event) {
    const key = `${collection}:${event}`;

    return {
      [Symbol.asyncIterator]: () => {
        const queue = [];
        let waiting = null;

        const callback = (payload) => {
          if (waiting) {
            waiting(payload);
            waiting = null;
          } else {
            queue.push(payload);
          }
        };

        if (!this.listeners.has(key)) {
          this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);

        return {
          next: () => {
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift(), done: false });
            }
            return new Promise((resolve) => {
              waiting = (value) => resolve({ value, done: false });
            });
          },
          return: () => {
            this.listeners.get(key)?.delete(callback);
            return Promise.resolve({ done: true });
          },
        };
      },
    };
  }
}

// 3. Initialize the subscription manager
const subscriptionManager = new JetstreamSubscriptionManager(
  'wss://jetstream1.us-east.bsky.network/subscribe',
  ['app.bsky.feed.post'],
);

// 4. Create the adapter with subscribe wired to Jetstream
const adapter = createAdapter(lexicons, {
  // Query function - implement with your database
  query: async (op) => {
    console.log('Query:', op);
    // Your database query here
    return { rows: [], hasNext: false, hasPrev: false };
  },

  // Subscribe function - wired to Jetstream
  subscribe: ({ collection, event }) => {
    console.log(`New subscription: ${collection} ${event}`);
    return subscriptionManager.subscribe(collection, event);
  },
});

// 5. Connect to Jetstream
subscriptionManager.connect();

// 6. Start GraphQL WebSocket server
const wsServer = new WebSocketServer({ port: 4000 });

useServer(
  {
    schema: adapter.schema,
    onSubscribe: (_ctx, msg) => {
      console.log('Client subscribed:', msg.payload.query);
    },
  },
  wsServer,
);

console.log('GraphQL WebSocket server running on ws://localhost:4000');
console.log(`
Test with a GraphQL client:

  subscription {
    appBskyFeedPostCreated {
      uri
      did
      text
      createdAt
    }
  }
`);
