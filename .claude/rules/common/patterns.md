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

No success envelope: a successful response is the bare resource (or a paginated object), typed
by a Zod schema in `packages/shared`. Every error uses one shape, `{ error, code, message,
details? }` (`apps/api/src/core/_errors`), with a stable `code` clients can branch on. See
`docs/api/common-schemas.md`.
