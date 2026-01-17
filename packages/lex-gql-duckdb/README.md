# lex-gql-duckdb

DuckDB adapter for [lex-gql](../lex-gql) - optimized for analytics-heavy workloads.

## Why DuckDB?

DuckDB is a columnar database designed for analytical queries. Compared to SQLite:

- **~17x faster aggregates** on large datasets (tested with 660K+ records)
- Better suited for GROUP BY, COUNT, and time-series queries
- Same embeddable, serverless model as SQLite

Use this adapter when your workload involves heavy aggregate queries (top tracks, leaderboards, time-based analytics).

## Installation

```bash
npm install lex-gql-duckdb duckdb
```

## Usage

```javascript
import { createAdapter, parseLexicon } from 'lex-gql';
import { createDuckDB, setupSchema, createWriter, createDuckDBAdapter } from 'lex-gql-duckdb';

// 1. Create DuckDB connection
const db = await createDuckDB('./data/records.duckdb');
await setupSchema(db);

// 2. Create writer for inserting records
const writer = createWriter(db);

await writer.insertRecord({
  uri: 'at://did:plc:xyz/app.example.post/abc',
  cid: 'bafyrei...',
  record: { text: 'Hello world', createdAt: new Date().toISOString() }
});

await writer.upsertActor('did:plc:xyz', 'alice.bsky.social');

// 3. Create lex-gql adapter
const query = createDuckDBAdapter(db);
const adapter = createAdapter(lexicons, { query });

// 4. Use adapter.schema with your GraphQL server
```

## API

### `createDuckDB(dbPath)`

Creates a promisified DuckDB connection.

- `dbPath` - Path to database file, or `':memory:'` for in-memory database
- Returns `Promise<DuckDBConnection>`

### `setupSchema(conn)`

Creates the required tables and indexes.

### `createWriter(conn)`

Returns an object with:

- `insertRecord({ uri, cid, record, indexedAt? })` - Insert or update a record
- `deleteRecord(uri)` - Delete a record by URI
- `upsertActor(did, handle)` - Insert or update an actor

### `createDuckDBAdapter(conn)`

Creates a query adapter compatible with lex-gql's `createAdapter()`.

Supports:
- `findMany` - Paginated queries with filtering and sorting
- `aggregate` - GROUP BY queries with COUNT

## Date Handling

The adapter handles both ISO strings and Unix timestamps (seconds or milliseconds) for date fields. Date interval suffixes work automatically:

```graphql
query {
  myRecordAggregate(groupBy: [createdAt_day]) {
    groups {
      createdAt_day  # Returns "2025-01-15"
      count
    }
  }
}
```

Supported suffixes: `_day`, `_week`, `_month`

## Comparison with lex-gql-sqlite

| Feature | lex-gql-sqlite | lex-gql-duckdb |
|---------|----------------|----------------|
| Best for | Simple apps, small datasets | Analytics, large datasets |
| Aggregate speed | ~1500ms (660K rows) | ~85ms (660K rows) |
| Write speed | Fast | Fast (batch inserts) |
| Maturity | Battle-tested | Newer, but solid |

## License

MIT
