# teal.fm Relay Example

Full-stack example showing how to build an AT Protocol app with lex-gql.

**Stack:**
- **Backend:** Node.js + lex-gql + DuckDB
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

## Deploy to Railway

This example requires two services: **tap** (AT Protocol sync) and **relay** (GraphQL API + frontend).

### 1. Create Project

```bash
railway login
railway init  # Create new project, e.g., "teal-relay"
```

### 2. Deploy tap service

```bash
cd tap
railway link  # Select your project
railway up    # Deploy tap container
```

Add volume in Railway dashboard:
- Mount path: `/data`

Set environment variables for tap:
```bash
railway variables \
  --set "TAP_DATABASE_URL=sqlite:///data/tap.db" \
  --set "TAP_RELAY_URL=https://relay1.us-east.bsky.network" \
  --set "TAP_SIGNAL_COLLECTION=fm.teal.alpha.feed.play" \
  --set "TAP_COLLECTION_FILTERS=fm.teal.alpha.feed.play,app.bsky.actor.profile" \
  --set "TAP_DISABLE_ACKS=true" \
  --set "TAP_RESYNC_PARALLELISM=10"
```

### 3. Deploy relay service

```bash
cd ..  # Back to examples/relay
railway service  # Create new service called "relay"
railway up       # Deploy
```

Add volume in Railway dashboard:
- Mount path: `/app/data`

Set environment variable:
```bash
railway variables --set "TAP_WS_URL=ws://tap.railway.internal:2480/channel"
```

### 4. Add domain

In Railway dashboard, add a domain to the **relay** service to access the app.

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
                                        │   DuckDB    │
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
