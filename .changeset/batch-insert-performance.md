---
"lex-gql-duckdb": minor
---

Add `insertRecordsBatch()` for bulk inserts

- New `insertRecordsBatch(records)` method that uses a single INSERT statement with multiple VALUES
- Fixes memory leak in relay example caused by unbounded `pendingWrites` queue
