# Changelog

## [Unreleased]

### Added

- **Forward join resolution to Record union** - `{field}Resolved` fields now return the `Record` union type
  - Enables inline fragment queries: `postResolved { ... on AppBskyFeedPost { text } }`
  - Works for both at-uri string fields (e.g., `post: String` with `format: at-uri`) and StrongRef fields
  - Uses `collection` field from resolved record for type discrimination
- **Union type support** for lexicon fields with multiple `ref` options
  - Type registry infrastructure for ref resolution
  - `resolveRefKey` helper to resolve `ref` URIs to GraphQL type names
  - Union types automatically created for fields with `refs` array
  - `resolveType` function uses `$type` field for runtime type resolution
- **Forward joins on nested types** - nested object types now get `*Resolved` fields for strongRef references
- System fields (`uri`, `did`, `collection`) to WhereInput for filtering
- System fields (`uri`, `did`, `collection`, `cid`, `actorHandle`) to GroupByEnum and AggregateGroup
- Blob ref resolution for ATProto format (`ref: { $link: 'cid' }` → `'cid'`)
- `url(preset: String): String!` field on `Blob` type for generating Bluesky CDN URLs
  - Format: `https://cdn.bsky.app/img/{preset}/plain/{did}/{ref}@jpeg`
  - Valid presets: `avatar`, `banner`, `feed_thumbnail`, `feed_fullsize`
  - Default preset: `feed_fullsize`
- `hydrateBlobs(obj, did)` helper to inject DID into blob objects for URL resolution
- `hydrateRecord(row)` helper to transform database rows to lex-gql format

### Changed

- AND/OR where clause format simplified from `{ field: 'AND', op: 'and', value: [...] }` to `{ op: 'and', conditions: [...] }`

### Fixed

- Cursor-based pagination now uses `_id` field for reliable ordering

### Notes

- Data layer must inject parent record's `did` into blob objects for the URL resolver to work
- Union types require `$type` field in data for proper type resolution

## [0.1.0] - 2026-01-15

### Added

- Initial release
- Generate GraphQL schema from AT Protocol lexicons
- Support for record types, queries, mutations, subscriptions
- Connection-based pagination
- Filtering and sorting
- Reverse joins for related records
- Blob, StrongRef, and DeleteResult types
