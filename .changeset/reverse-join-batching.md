---
"lex-gql": minor
---

Add N+1 query prevention for reverse join fields via ReverseJoinCollector

- Remove unused `where` argument from reverse join fields
- Add `findManyPartitioned` operation type for batched per-partition queries
- Add `ReverseJoinCollector` class that batches reverse join resolver calls within a microtask
- Reverse join fields now use the collector, falling back to individual queries if adapter returns null
- Document reverse joins and `findManyPartitioned` in README
