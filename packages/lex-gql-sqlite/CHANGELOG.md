# Changelog

## 0.2.1

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

## 0.2.0

### Minor Changes

- 349ddb3: Add aggregate enhancements, actorHandle filtering, and DuckDB adapter

### Patch Changes

- Updated dependencies [349ddb3]
  - lex-gql@0.2.0

## 0.1.0 - 2026-01-16

### Added

- Initial release
- `createSqliteAdapter(db)` - create query function from better-sqlite3 database
- `setupSchema(db)` - create required tables and indexes
- `createWriter(db)` helper with prepared statements for efficient writes
  - `insertRecord({ uri, did, collection, rkey, cid?, record, indexedAt? })`
  - `deleteRecord(uri)`
  - `upsertActor(did, handle)`
- `totalCount` field in findMany query results
- Full WHERE support with AND/OR nesting
- All filter operators: eq, in, contains, gt, gte, lt, lte
- Multi-field sorting
- Bidirectional cursor pagination (first/after, last/before)
- Aggregate queries with groupBy
- Actor handle joins
