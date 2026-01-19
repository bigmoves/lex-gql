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

## 0.2.0

### Minor Changes

- 349ddb3: Add aggregate enhancements, actorHandle filtering, and DuckDB adapter

## 0.1.0 - 2026-01-15

### Added

- Initial release
- Generate GraphQL schema from AT Protocol lexicons
- Support for record types, queries, mutations, subscriptions
- Connection-based pagination
- Filtering and sorting
- Reverse joins for related records
- Blob, StrongRef, and DeleteResult types
