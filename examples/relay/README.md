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
