# lex-gql-sqlite

SQLite adapter for [lex-gql](https://github.com/your-repo/lex-gql).

## Installation

```bash
npm install lex-gql-sqlite lex-gql better-sqlite3
```

## Usage

```javascript
import Database from 'better-sqlite3';
import { createAdapter, parseLexicon } from 'lex-gql';
import { createSqliteAdapter, createWriter, setupSchema } from 'lex-gql-sqlite';

const db = new Database('./data.db');
setupSchema(db);

const query = createSqliteAdapter(db);
const adapter = createAdapter(lexicons, { query });

const result = await adapter.execute(`
  query {
    appBskyFeedPost(first: 10) {
      edges { node { text } }
    }
  }
`);
```

## API

### `setupSchema(db)`

Creates the required database tables and indexes.

### `createSqliteAdapter(db)`

Returns a query function compatible with lex-gql's adapter interface. Supports cross-collection URI resolution (`collection: '*'`) for forward join batching.

### `buildWhere(where)`

Builds SQL WHERE clause from lex-gql where conditions. Supports:
- All comparison operators: `eq`, `gt`, `gte`, `lt`, `lte`
- Array operators: `in`
- Text operators: `contains`
- Logical operators: nested `AND`/`OR`

### `buildOrderBy(sort)`

Builds SQL ORDER BY clause from lex-gql sort conditions.

### `createWriter(db)`

Creates a writer with prepared statements for efficient writes.

```javascript
const writer = createWriter(db);

// Insert or replace a record
writer.insertRecord({
  uri: 'at://did:plc:alice/app.bsky.feed.post/1',
  did: 'did:plc:alice',
  collection: 'app.bsky.feed.post',
  rkey: '1',
  cid: 'bafycid123',          // optional
  record: { text: 'Hello!' }, // object or JSON string
  indexedAt: '2024-01-15T12:00:00Z', // optional, defaults to now
});

// Delete a record
writer.deleteRecord('at://did:plc:alice/app.bsky.feed.post/1');

// Insert or update an actor
writer.upsertActor('did:plc:alice', 'alice.bsky.social');
```

## Schema

The adapter expects this schema (created by `setupSchema`):

```sql
CREATE TABLE records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uri TEXT UNIQUE NOT NULL,
  did TEXT NOT NULL,
  collection TEXT NOT NULL,
  rkey TEXT NOT NULL,
  cid TEXT,
  record TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);

CREATE TABLE actors (
  did TEXT PRIMARY KEY,
  handle TEXT NOT NULL
);
```

## License

MIT
