---
description: Split an OpenAPI spec into per-resource markdown docs (with a README index) so Claude never has to guess payload/response shapes, and keep them in sync via diff when the spec updates.
argument-hint: "[caminho ou URL do openapi.json | vazio = detectar automaticamente]"
---

# OpenAPI → Per-Resource Docs

**Input**: $ARGUMENTS

Turns a single large OpenAPI spec into a set of small, per-resource markdown files
that are cheap to read and easy to keep accurate — instead of every session grepping
a multi-thousand-line JSON file or, worse, guessing a payload shape. This repo's
`docs/api/` folder (see `docs/api/README.md`, `docs/api/user.md`,
`docs/api/common-schemas.md`) is a working example of the target output — use it as
the concrete reference for formatting if you're unsure how something should look,
but this command is meant to run in **any** project, not just this one.

This command has two modes, auto-detected:

- **First run** (no stored spec copy yet in the output dir) → full split.
- **Update run** (a stored spec copy already exists) → diff old vs. new spec, and
  regenerate only the resource files actually affected.

## Step 0 — Resolve config

Figure out, in order of precedence: explicit values in `$ARGUMENTS` > values already
established in a previous run (read them back from the existing output, don't ask
again) > sensible defaults > ask the user.

- **Spec source**: a local path or a URL to fetch (`curl`/`WebFetch`) the OpenAPI JSON
  (or YAML — convert to JSON first if so). If `$ARGUMENTS` doesn't specify one and no
  previous run exists, ask the user where the spec lives.
- **Output dir**: where the per-resource `.md` files go. Default `docs/api/` if it
  exists or the project has no strong opinion; otherwise ask. This is also where the
  spec copy is stored, at `<output_dir>/_openapi.json` — that stored copy is both the
  rendered source-of-truth reference and the baseline for future diffs. Never hand-edit
  it.
- **Doc language**: match whatever's already in the output dir if regenerating; else
  match the project's stated UI/doc language (check `CLAUDE.md`); else ask.

## Step 1 — First run (full split)

Skip this whole step if `<output_dir>/_openapi.json` already exists — go to Step 2.

1. Fetch/copy the spec verbatim into `<output_dir>/_openapi.json`. This becomes the
   diff baseline for every future run — don't skip writing it even if you also keep
   the original elsewhere.
2. **Group endpoints into resources.** Primary heuristic: the first non-parameter path
   segment (`/user/{id}` → `user`, `/pipeline-lane/...` → `pipeline-lane`). This is a
   better signal than the spec's `tags` — specs are often tagged coarsely (e.g. three
   tags covering 130+ endpoints), which is too broad to be useful as a file split.
   Apply judgment on top of the raw grouping:
   - Merge a first-segment group with 1-2 endpoints into a natural sibling if it's
     tightly coupled (e.g. a `/x/{id}/sub-resource` toggle that only ever gets set
     *on* `x` belongs in `x`'s file, cross-linked from the sub-resource's own file if
     it has one).
   - Split a first-segment group that's actually several distinct concepts glued
     together under one path prefix into multiple files, named by the sub-concept.
   - Target roughly 5-50 endpoints per file. Below that, consider merging into a
     related file; above it, consider splitting — but cohesion beats the number, don't
     split a genuinely single concept just to hit a count.
   - Cross-link instead of duplicating: if resource A's payload has a field that's
     really an action on resource B (e.g. "assign lead to law firm" lives under
     `/lead/{id}/law-firm` but is conceptually a law-firm link), document it in
     whichever file owns the *state change* and mention it with a one-line pointer
     from the other file.
3. **Per resource file** (e.g. `<output_dir>/user.md`), for each endpoint in that
   group:
   - Heading: `### `METHOD /path``
   - One-line summary/description from the spec
   - Auth requirement, if the spec's `security` says so
   - **Parameters** table (path/query/header): `Nome | Local | Obrigatório | Tipo | Descrição`
   - **Request body** table, if any: `Campo | Tipo | Obrigatório | Descrição`. Flatten
     nested objects with dot-notation (`avatar_object.name`) and arrays with `[]`
     (`boards[].permission`) — don't nest tables inside tables.
   - **Resposta**: name the response schema if it maps to a named component, otherwise
     describe the inline shape. Note when it's the standard paginated envelope (link to
     the pagination section instead of re-describing it).
   - Separate endpoints with `---`.
   Below all endpoints, add a `## Schemas` section: every named schema from
   `components.schemas` that's referenced *only* by this resource's endpoints, each as
   `## `schema_name`` + description + the same flattened field table.
4. **Shared/orphan schemas** — anything referenced by 3+ unrelated resources (response
   envelope, pagination wrapper, error shape, login/session response, etc.) or not
   clearly owned by one resource → `<output_dir>/common-schemas.md`, not duplicated
   per file. Document the standard response envelope and pagination shape here even if
   they're not literally named schemas in the spec, if the API uses one consistently.
5. **Index** — `<output_dir>/README.md`: one line per resource file in a table
   (`Recurso | Arquivo | Endpoints | Descrição`), a link to `common-schemas.md`, and a
   one-line pointer to wherever the project documents *how* the frontend/client
   actually calls this API (auth flow, client wrapper, etc.) if such a doc exists —
   don't duplicate that content here, just point to it.
6. Every generated file gets a one-line header noting it's generated from the spec and
   shouldn't be hand-edited — e.g. `> Fonte: OpenAPI spec (`<output_dir>/_openapi.json`). Não editar manualmente — regenerar quando a spec mudar.` (translate to the doc language in use).

## Step 2 — Update run (diff-based)

Runs whenever `<output_dir>/_openapi.json` already exists from a prior run.

1. Fetch the new spec from the resolved source (Step 0).
2. Diff new vs. the stored old copy — do this programmatically (Python/`jq`/Node, not
   by eyeballing), comparing at the operation level:
   - Paths present in new but not old → **added**
   - Paths present in old but not new → **removed**
   - Paths in both where the operation object differs (params, requestBody, responses,
     summary) → **changed**
   - Same three buckets for `components.schemas`
3. Map every added/changed/removed path or schema to the resource file that *currently*
   owns it — check the existing files/README first rather than re-deriving the grouping
   from scratch, so unrelated files don't shuffle around on every run. New paths that
   don't fit any existing file follow the Step 1 grouping heuristic to decide whether
   they extend a file or need a new one.
4. Regenerate, **in full**, only the resource files that own at least one
   added/changed/removed item (simplest reliable approach — don't attempt line-level
   patching of an existing file, just rewrite that one file from the new spec).
   Files with zero affected items are untouched.
5. Update `README.md` if the resource list or endpoint counts changed. Update
   `common-schemas.md` if a shared schema changed.
6. Overwrite `<output_dir>/_openapi.json` with the new spec — this becomes the
   baseline for the *next* diff.
7. Print a summary in this shape:

   ```
   OpenAPI docs sync
   ──────────────────────────────
   Added:    3 endpoints in lead.md, 1 new file webhook-log.md
   Changed:  2 endpoints in squad.md (request body field added)
   Removed:  1 endpoint in user.md (deprecated)
   Unchanged: 19 files
   ──────────────────────────────
   ```

## Step 3 — Wire up CLAUDE.md

Every project this command runs in should end up with an instruction telling future
Claude sessions to check the generated docs before guessing an API shape. Check the
project's root `CLAUDE.md` (create one with `/init` first if it genuinely doesn't
exist — don't skip this silently):

- If it already has a section pointing at `<output_dir>/README.md` for endpoint/schema
  lookups, leave it alone (at most fix a stale path).
- If not, add one. Keep it short — a pointer, not a copy of the index. Model:

  ```markdown
  ## API reference docs

  The full external API reference (OpenAPI spec) is organized under `<output_dir>/`,
  split by resource. **Before guessing a payload/response shape, check
  `<output_dir>/README.md`** — it maps each resource to its file. Each resource file
  lists every endpoint (method, path, params, request body fields, response schema)
  plus that resource's schemas. Common patterns (response envelope, pagination,
  standard errors) live in `<output_dir>/common-schemas.md`. The raw OpenAPI JSON
  (source of truth, regenerate the `.md` files from it with `/openapi-docs` when it
  changes) is `<output_dir>/_openapi.json` — don't read it directly for lookups, use
  the per-resource `.md` files.
  ```

  Adapt wording/placement to match the rest of that `CLAUDE.md`'s tone and structure —
  this is a template, not a literal string to paste.

## Rules

- Never hand-edit a generated `.md` file or the stored `_openapi.json` copy outside
  this command — always regenerate.
- Don't invent field descriptions the spec doesn't provide; leave the description cell
  empty rather than guessing.
- On update runs, only touch files the diff actually implicates — resist the urge to
  "clean up" unrelated files while you're in there.
- If the spec source can't be reached or diffed cleanly (e.g. malformed JSON), stop and
  report the problem rather than partially regenerating.
