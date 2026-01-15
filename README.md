# lex-gql

GraphQL for AT Protocol. Generate a complete GraphQL API from AT Protocol lexicons.

> **Work in Progress** - This project is under active development. APIs may change and there are probably bugs.

```javascript
import { parseLexicon, createAdapter } from 'lex-gql';

const adapter = createAdapter(
  [parseLexicon(postLexicon), parseLexicon(profileLexicon)],
  {
    query: async (op) => db.execute(op),
  }
);

const result = await adapter.execute(`
  query {
    appBskyFeedPost(first: 10, where: { text: { contains: "hello" } }) {
      edges {
        node {
          uri
          text
          appBskyActorProfileByDid {
            displayName
          }
        }
      }
    }
  }
`);
```

## Features

- Relay-style pagination
- Automatic joins between collections (forward, reverse, and DID-based)
- Filtering, sorting, and aggregations
- CRUD mutations
- Subscriptions
- Batched join resolution (no N+1)

## Packages

- [`lex-gql`](./packages/lex-gql) - Core library

## Examples

- [`jetstream`](./examples/jetstream) - Real-time subscriptions with AT Protocol Jetstream
- [`tap`](./examples/tap) - GraphQL queries with AT Protocol tap

## License

MIT
