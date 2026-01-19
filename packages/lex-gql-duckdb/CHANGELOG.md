# Changelog

## 0.3.1

### Patch Changes

- 074d06f: Fix cursor pagination with custom sort fields

  Previously, cursor pagination used only the record ID which caused duplicate records when paginating with custom sort fields. Cursors now encode actual sort field values for correct pagination.

  - Encode sort field values + URI tiebreaker in JSON cursor format
  - Add progressive WHERE clauses for multi-field sorts
  - Add field name validation to prevent SQL injection
  - Export centralized DEFAULT_SORT constant from lex-gql

  **Note:** Existing cursors from previous versions will be invalid and pagination will restart from the beginning.

- Updated dependencies [074d06f]
  - lex-gql@0.2.1

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
