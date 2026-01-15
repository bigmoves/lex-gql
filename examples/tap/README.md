# Tap Example

Query AT Protocol records through GraphQL using [tap](https://github.com/bluesky-social/indigo/tree/main/cmd/tap) as the data source.

## What This Does

1. **tap** syncs AT Protocol records from the relay and streams them via websocket
2. **This server** connects to tap's websocket and stores records locally
3. **lex-gql** generates a GraphQL schema from lexicon definitions
4. **GraphQL API** queries the local SQLite database

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
- **Statusphere records**: The `xyz.statusphere.status` collection is from the [Statusphere tutorial app](https://atproto.com/guides/applications).
- **Database location**: Records are stored in `./data/records.db`. Delete this file to reset.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  AT Protocol    │────▶│   tap server    │────▶│   WebSocket     │
│  Relay          │     │  (Docker)       │     │   /channel      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Browser        │◀────│  Node.js Server │
                        │  (GraphiQL)     │     │  (lex-gql)      │
                        └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │   SQLite DB     │
                                                │ (records.db)    │
                                                └─────────────────┘
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 4000)
- `TAP_WS_URL` - tap websocket URL (default: ws://localhost:2480/channel)

### tap Configuration

Edit `docker-compose.yml` to change tap settings:

- `TAP_SIGNAL_COLLECTION` - Collection to track (discovers repos with this collection)
- `TAP_COLLECTION_FILTERS` - Filter which records to emit
- `TAP_RELAY_URL` - AT Protocol relay to sync from

## Troubleshooting

**No records appearing**
- Wait a few minutes for tap to backfill repos
- Check tap stats: `curl http://localhost:2480/stats/record-count`
- Check server stats: `curl http://localhost:4000/stats`

**WebSocket disconnects**
- The server automatically reconnects every 5 seconds
- Check tap logs: `docker compose logs tap`
