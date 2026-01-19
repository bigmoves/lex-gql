---
"lex-gql": patch
"lex-gql-duckdb": patch
"lex-gql-sqlite": patch
---

Fix cursor pagination with custom sort fields

Previously, cursor pagination used only the record ID which caused duplicate records when paginating with custom sort fields. Cursors now encode actual sort field values for correct pagination.

- Encode sort field values + URI tiebreaker in JSON cursor format
- Add progressive WHERE clauses for multi-field sorts
- Add field name validation to prevent SQL injection
- Export centralized DEFAULT_SORT constant from lex-gql

**Note:** Existing cursors from previous versions will be invalid and pagination will restart from the beginning.
