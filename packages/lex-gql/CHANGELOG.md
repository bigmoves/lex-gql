# Changelog

## 0.4.0

### Minor Changes

- Add `query` parameter for full-text search to collection query fields

  - Add optional `query` argument to collection queries
  - When `query` is present, delegates to optional `search` function
  - Both paths use `formatConnection` for consistent response shape
  - Fix blob URL resolver to return null for missing did/ref

## 0.3.2

### Patch Changes

- f0eb4a7: Return null for malformed blobs instead of throwing

  Handles cases where blob data is missing did or ref (e.g., schema migrations, old data formats) gracefully by returning null for the URL instead of throwing an error that breaks the entire query.

## 0.3.1

### Patch Changes

- Fix strongRef resolution in \*Resolved fields

  - Fix resolver to correctly extract URI from strongRef `{uri, cid}` objects instead of passing the object directly to `joinCollector.load()`
  - Fix `buildSchema` to type `*Resolved` fields as `Record` union instead of `String`
  - Add like lexicon test fixture with strongRef subject field
  - Add unit tests for strongRef schema generation
  - Add E2E tests for strongRef subjectResolved resolution

## 0.3.0

### Minor Changes

- bf8625f: Add N+1 query prevention for reverse join fields via ReverseJoinCollector

  - Remove unused `where` argument from reverse join fields
  - Add `findManyPartitioned` operation type for batched per-partition queries
  - Add `ReverseJoinCollector` class that batches reverse join resolver calls within a microtask
  - Reverse join fields now use the collector, falling back to individual queries if adapter returns null
  - Document reverse joins and `findManyPartitioned` in README

## 0.2.2

### Patch Changes

- Add DidCollector for batching DID-based join resolution

  Introduces a new `DidCollector` class (similar to the existing `JoinCollector`) that batches DID-based lookups across GraphQL resolvers. When multiple records reference the same DID, queries are now batched into a single database call per collection instead of N+1 individual queries.

  - Group pending DID lookups by collection
  - Batch fetch using `IN` queries with all pending DIDs
  - Cache resolved results for subsequent requests
  - Support both unique (single record) and non-unique (array) lookups
  - Handle errors gracefully with null/empty fallbacks

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
