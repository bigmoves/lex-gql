# Changelog

## [Unreleased]

### Added

- Initial implementation
- `createDuckDB(path)` - create async DuckDB connection
- `createDuckDBAdapter(db)` - create query function from DuckDB connection
- `setupSchema(db)` - create required tables and indexes
- `createWriter(db)` helper for async writes
  - `insertRecord({ uri, cid?, record, indexedAt? })`
  - `deleteRecord(uri)`
  - `upsertActor(did, handle)`
- `totalCount` field in findMany query results
- Full WHERE support with AND/OR nesting
- All filter operators: eq, in, contains, gt, gte, lt, lte
- Multi-field sorting
- Bidirectional cursor pagination (first/after, last/before)
- Aggregate queries with groupBy
- Actor handle joins
- `actorHandle` WHERE filtering support
- **Date interval grouping** for aggregates - use `_day`, `_week`, `_month` suffixes on datetime fields
- **Configurable limit** for aggregate queries (default: 50, max: 1000)
- **Configurable orderBy** for aggregate queries (`COUNT_ASC`, `COUNT_DESC`)
- **arrayFields** option for aggregate queries to include sample array values per group
- TypeScript declarations generated from JSDoc
- Escape LIKE wildcards (`%`, `_`, `\`) in `contains` operator
- Log malformed cursor errors instead of silently ignoring them
