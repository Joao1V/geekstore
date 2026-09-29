# Common Patterns

## Skeleton Projects

When implementing new functionality:
1. Search for battle-tested skeleton projects
2. Use parallel agents to evaluate options:
   - Security assessment
   - Extensibility analysis
   - Relevance scoring
   - Implementation planning
3. Clone best match as foundation
4. Iterate within proven structure

## Design Patterns

### Repository Pattern

Encapsulate data access behind a consistent interface:
- Define standard operations: findAll, findById, create, update, delete
- Concrete implementations handle storage details (database, API, file, etc.)
- Business logic depends on the abstract interface, not the storage mechanism
- Enables easy swapping of data sources and simplifies testing with mocks

### API Response Format

JSON is snake_case. Success is always `{ data }` (lists: `{ data, meta }` with `page`,
`page_size`, `total`, `total_pages`), typed by Zod schemas in `packages/shared`. Every error uses
one shape, `{ error, code, message, details?, request_id }` (`apps/api/src/core/_errors`), with a
stable `code` clients can branch on. See `docs/api/common-schemas.md`.
