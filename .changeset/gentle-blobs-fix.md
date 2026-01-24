---
"lex-gql": patch
---

Return null for malformed blobs instead of throwing

Handles cases where blob data is missing did or ref (e.g., schema migrations, old data formats) gracefully by returning null for the URL instead of throwing an error that breaks the entire query.
