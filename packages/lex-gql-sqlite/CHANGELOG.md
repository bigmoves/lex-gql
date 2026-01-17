# Changelog

## [Unreleased]

### Added

- Cross-collection URI resolution support (`collection: '*'`) for forward join batching
- `actorHandle` WHERE filtering support
- **Date interval grouping** for aggregates - use `_day`, `_week`, `_month` suffixes on datetime fields
  - `groupBy: ['createdAt_day']` → groups by `date(createdAt)`
  - `groupBy: ['createdAt_week']` → groups by `strftime('%Y-%W', createdAt)`
  - `groupBy: ['createdAt_month']` → groups by `strftime('%Y-%m', createdAt)`
- **Configurable limit** for aggregate queries (default: 50, max: 1000)
- **Configurable orderBy** for aggregate queries (`COUNT_ASC`, `COUNT_DESC`, default: `COUNT_DESC`)

### Fixed

- Escape LIKE wildcards (`%`, `_`, `\`) in `contains` operator to prevent unintended pattern matching
- Log malformed cursor errors instead of silently ignoring them

### Changed

- `insertRecord` now parses `did`, `collection`, and `rkey` from the URI automatically
  - Before: `insertRecord({ uri, did, collection, rkey, cid?, record, indexedAt? })`
  - After: `insertRecord({ uri, cid?, record, indexedAt? })`

## [0.1.0] - 2026-01-16

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
