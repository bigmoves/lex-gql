# TODO

## findManyPartitioned adapter implementation

- [ ] Implement `findManyPartitioned` in lex-gql-sqlite (use `ROW_NUMBER() OVER PARTITION BY`)
- [ ] Implement `findManyPartitioned` in lex-gql-duckdb
- [ ] Add E2E test for reverse join batching with multiple parents
