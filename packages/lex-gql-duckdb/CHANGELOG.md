# Changelog

## 0.3.0

### Minor Changes

- 45bc9df: Add `insertRecordsBatch()` for bulk inserts

  - New `insertRecordsBatch(records)` method that uses a single INSERT statement with multiple VALUES
  - Fixes memory leak in relay example caused by unbounded `pendingWrites` queue

## 0.2.0

### Minor Changes

- 349ddb3: Add aggregate enhancements, actorHandle filtering, and DuckDB adapter

### Patch Changes

- Updated dependencies [349ddb3]
  - lex-gql@0.2.0
