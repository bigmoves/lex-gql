# Changelog

## [Unreleased]

### Added

- `url(preset: String): String!` field on `Blob` type for generating Bluesky CDN URLs
  - Format: `https://cdn.bsky.app/img/{preset}/plain/{did}/{ref}@jpeg`
  - Valid presets: `avatar`, `banner`, `feed_thumbnail`, `feed_fullsize`
  - Default preset: `feed_fullsize`
- Validation for `did` and `ref` fields (throws if missing)
- Validation for preset values (throws if invalid)
- `hydrateBlobs(obj, did)` helper to inject DID into blob objects for URL resolution
- `hydrateRecord(row)` helper to transform database rows to lex-gql format

### Notes

- Data layer must inject parent record's `did` into blob objects for the URL resolver to work

## [0.1.0] - 2026-01-15

### Added

- Initial release
- Generate GraphQL schema from AT Protocol lexicons
- Support for record types, queries, mutations, subscriptions
- Connection-based pagination
- Filtering and sorting
- Reverse joins for related records
- Blob, StrongRef, and DeleteResult types
