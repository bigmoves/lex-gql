# Changelog

## [0.1.0] - 2026-01-15

### Added

- Initial release
- `createSqliteAdapter(db)` - create query function from better-sqlite3 database
- `setupSchema(db)` - create required tables and indexes
- Full WHERE support with AND/OR nesting
- All filter operators: eq, in, contains, gt, gte, lt, lte
- Multi-field sorting
- Bidirectional cursor pagination (first/after, last/before)
- Aggregate queries with groupBy
- Actor handle joins
