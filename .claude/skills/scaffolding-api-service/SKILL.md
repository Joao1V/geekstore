---
name: scaffolding-api-service
description: Use when adding a new domain, endpoint, query or mutation under services/ in this CRM — creating a new service folder, adding a method to an existing service wrapper, or wiring a new React Query hook or mutation function against the GUARD API.
---

# Scaffolding a `services/<domain>` Service

## Overview

Every domain folder under `services/` (e.g. `services/users/`, `services/squads/`, `services/fire-clusters/`) follows the same anatomy: `queries.ts`/`mutations.ts` calling the shared **`@/lib/api`** client directly (`api.get`/`api.post`/`api.put`/`api.delete` — no static-class wrapper in between), **plain TypeScript models** in `models.ts` (response types as `interface`, payload types as Zod — see below for why they differ), wired through **React Query** (`@tanstack/react-query`, not SWR). Following it means a new integration drops in exactly where the next reader expects it — same file names, same client, same hook shape.

**Always scaffold under `services/`, even for a single call site.** There's no "only worth it if reused 2+ times" threshold — a `queries.ts`/`mutations.ts` hook is the standard shape for a GUARD API call regardless of how many components end up using it. The value isn't just reuse, it's consistency: every fetch in the app should be findable in the same shape (`services/<domain>/queries.ts` or `mutations.ts`), not "sometimes a named hook, sometimes inline `ccFetch` depending on how many callers it happened to pick up."

**Decided in this session: React Query is the standard for all new `services/<domain>/` code going forward.** SWR (`useSWR`/`useSWRInfinite` + `swrFetcher`/`swrListFetcher`) remains the pattern for every screen that already uses it — an 84-file, 214-call-site footprint too large to migrate in one pass. It is **not** retrofitted as a standalone sweep; migrate a screen to React Query only when you're already substantially touching it for another reason. `QueryClientProvider` is mounted once in `app/layout.tsx` via `components/providers/query-provider.tsx` (composed with the other app providers in `components/providers/index.tsx`) — every client component in the app can already call `useQuery`/`useMutation`.

**Every GUARD response is wrapped in the same `ApiResponse<T>` envelope** (`HTTPStatus`/`executed`/`message`/`validator`/`object`) — always, no exceptions. Because of that, this skill never types or touches `ApiResponse<T>` at any call site: `@/lib/api`'s `api.get/post/put/patch/delete` already unwrap `.object` internally and just return `T`. If you find yourself writing `ApiResponse<...>` anywhere in a `services/<domain>/` file, that's a sign you reached for the wrong client (see below) — not something this pattern ever requires. This is also what makes the React Query wiring so thin here: `queryFn` is almost always `() => api.get<T>(path)` directly, no separate fetcher function to define or import (`@/lib/api` already IS the `queryFn`).

**Why response types are plain TypeScript, not Zod (decided in this session, overturning this skill's earlier stance):** `docs/api/*.md` already documents the full shape of every response, field by field — that documentation IS the contract. Adding a `.parse()`/`.safeParse()` on top of an already-fully-documented response is redundant validation of something we already know, not a safety net for something uncertain. The earlier version of this skill argued for `.strict()` Zod schemas as a way to catch drift between `docs/api/*.md` and the real API loudly instead of silently — that reasoning didn't hold up in practice: real drift (e.g. `address_lat` documented as `number` but arriving as a decimal `string`) still has to be *found* by hitting the failure once and reading the parse error, same as it would be found by the field just behaving wrong in the UI — the schema didn't prevent the surprise, it just changed where it surfaces. So: type the response as a plain `interface` matching `docs/api/*.md`, pass it as the generic to `api.get<T>()`/`fetchAllPages<T>()`, no runtime step in between. When a real response diverges from the documented shape (it does happen — see `docs/business-rules.md`), fix the `interface` to match reality and log it there if it's a genuine surprise worth remembering; don't reach for a validator to catch it next time.

**Why payload types still use Zod:** this is a different boundary — a payload is *user input* (a form submission), which `rules/common/coding-style.md` already requires validating ("ALWAYS validate at system boundaries... never trust external data"). A response from an API we already fully documented is not the same kind of "external/untrusted" as a value someone just typed into a field. Payload Zod schemas also double as the RHF `zodResolver` schema (see `scaffolding-entity-ui`) — that's real, load-bearing validation (required fields, `min`, `email`), not defensive parsing of a known shape.

**Why `lib/types.ts` isn't the target for new domains:** it's a single very large file mixing types from every module in the app — the long-term direction (confirmed by the user) is to isolate types back into their own domain instead of growing that file further. `services/<domain>/models.ts` is that isolation vehicle now, regardless of whether a given section ends up as a Zod schema (Payload) or a plain interface (Response/Request).

**This is an adopted pattern, not yet the norm across the codebase.** Most existing screens (see `components/users/user-form-dialog.tsx`, `components/squad/*`) still call `ccFetch`/`useSWR` inline inside the component — that's the pre-existing style, not wrong, just not yet migrated. Use this skill's structure for **new** domains and features from now on; migrate an existing domain to it opportunistically when you're already touching that code for another reason, not as a standalone sweep.

**Reference implementation:** `services/map-elements/queries.ts` and `services/fire/queries.ts` — originally built with `useSWR` (map migration plan, `.claude/plans/daq-map-react-migration.plan.md`, Fase 2), migrated to React Query in a follow-up session (explicit user request, not the opportunistic-only policy below — that policy still applies to every *other* SWR screen in the app). Point future scaffolding at these two `queries.ts` files as the real React Query example — `useBasesForMap`/`useSquadsForMap` for the plain-query shape, `useFirePoints` for a query with an `enabled` gate + a derived (non-object) `queryKey`.

**Note — three data-fetching layers coexist in this project on purpose:** `lib/api-client.ts` (`ccFetch`, `swrFetcher`, `swrListFetcher`) is the original client, still used by every existing SWR screen (`components/users/*`, etc.) — it requires typing the full `ApiResponse<T>` envelope and manually reading `.object` at each call site (see `CLAUDE.md`, "Making API calls"). `lib/api/` (`import api from "@/lib/api"`) is the newer, leaner client — same proxy (`/api/cc`), same `ApiError`, but `api.get<T>()`/`api.post<T>()`/etc. already return `T` (the unwrapped `.object`) directly, no envelope typing needed. `@tanstack/react-query` is the newest layer on top — it's the *cache/hook* layer, not an HTTP client, and it consumes `@/lib/api` as its `queryFn`/mutation function, same as SWR consumed it before. **`services/<domain>/` always uses `@/lib/api` + React Query, never `ccFetch`, never `useSWR`** — that's the whole point of this skill's `queries.ts`/`mutations.ts` shape. Existing `ccFetch`/`useSWR` call sites (the old 214-call-site footprint) are not migrated as a sweep; this is only about what new code under `services/` uses.

## When to Use

- Creating a brand-new resource under `services/<domain>/`
- Adding an endpoint/method to an existing domain's `queries.ts`/`mutations.ts`
- Extracting any inline `useSWR`/`ccFetch` call in a component into a named hook under `services/<domain>/` (rewrite it as React Query while you're at it — don't extract it as a shared SWR hook), regardless of whether it's used in one place or several

## File Anatomy

```
services/<domain>/
  queries.ts                   # useX()/useXList() hooks — useQuery + @/lib/api, or usePaginatedList for table screens
  mutations.ts                  # useCreateX()/useUpdateX()/useDeleteX() — useMutation wrapping @/lib/api directly
  models.ts                    # Zod schemas + inferred types, organized in Request / Response / Payload sections
  index.ts                     # barrel: export * from './queries', './mutations', './models'
```

Existing entities still living in `lib/types.ts` are **not** retroactively migrated as a sweep — only move a type out when you're already scaffolding or substantially touching that domain under `services/`.

## `models.ts` Convention

**One file per domain, not a `models/` folder.** Split into up to three sections, in this order, each under its own comment header — omit a section entirely when the domain has nothing for it (most domains don't need "Request" — see below):

```ts
// services/squads/models.ts
import { z } from "zod"

// ============================================================
// Request — typed query/filter params, only when a domain needs something
// beyond the generic page/limit/order_field/order_type usePaginatedList already covers
// ============================================================

export interface SquadMapFilters {
  baseIds?: number[]
}

// ============================================================
// Response — plain interfaces matching docs/api/*.md, no runtime validation
// ============================================================

export interface SquadDetail {
  squad_id: number
  name: string
  // API real devolve string decimal pra lat/lng (ver docs/business-rules.md #21) — não assuma number aqui
  location_lat: number | string | null
  location_lng: number | string | null
}

// ============================================================
// Payload — mutation request bodies (POST/PUT). Zod here, unlike Response above:
// this validates real user input from a form, not an already-documented API response.
// ============================================================

export const SquadPayloadSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  squad_type_id: z.coerce.number(),
})

export type SquadPayload = z.infer<typeof SquadPayloadSchema>
```

- **Response types are plain `interface`s, not Zod** — the contract is `docs/api/*.md`, already fully documented field-by-field; there's nothing left to validate at runtime that the docs don't already commit to. Type the interface to match the doc, pass it as the generic to `api.get<T>()`/`fetchAllPages<T>()`/`api.post<T>()`, done — no `.parse()` step.
- When a real response diverges from what `docs/api/*.md` says (it happens — decimal-string lat/lng instead of `number` is the recurring one, see `docs/business-rules.md`), fix the `interface` to match reality (e.g. `number | string`, matching `SquadDetail.location_lat` above) and log the surprise in `docs/business-rules.md` if it's worth remembering for other domains. Don't reach for a Zod schema to "catch it next time" — the fix is updating the type, not adding a validator around it.
- **Payload schemas are the one place in this file that still use Zod** — a payload is user input (a form submission), a genuine "external/untrusted data" boundary per `rules/common/coding-style.md`, unlike a response from an API we already fully documented. Encode real validation rules (`min`, `email`, etc.) since these double as the RHF `zodResolver` schema when the same shape is reused by a form (see `scaffolding-entity-ui`) — check first whether the form's own inline schema and the payload schema are actually identical before triggering that reuse; don't force it if the form collects a subset/different shape than the raw API payload.
- **Request section is the exception, not the default** — most domains have nothing here, because `usePaginatedList`'s generic `page`/`limit`/`order_field`/`order_type` already covers the table-screen case. Only add a `Request` type when a query needs its own named filter shape (e.g. a map layer's bounds+status filter) — plain `interface`, same reasoning as Response (caller-constructed, not something to validate).
- **No shared fragments file yet** (this project has no `lib/common-schemas.ts` equivalent to the source project's `@/libs/common-schemas`). Don't create one preemptively — write the field inline the first time, and only extract a shared fragment once the exact same rule is genuinely duplicated across 2+ domains (same principle as this skill's sibling, `scaffolding-entity-ui`, uses for form schemas).

## `queries.ts` — React Query reads

Two shapes, depending on what the endpoint returns:

**Paginated list feeding a table** — don't write a custom hook, use the existing `usePaginatedList` directly in the table component (see `scaffolding-entity-ui`); it's SWR-based internally and stays that way for now, this skill doesn't touch it. `queries.ts` doesn't need to wrap this.

**Single entity / small reference list — always a named hook here**, even if only one component ends up calling it (this replaces what today are copy-pasted-inline fetches per dialog, e.g. `user-form-dialog.tsx` fetching `companies`/`roles`/`detail` inline):

```ts
// services/squads/queries.ts
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import type { Paginated } from "@/lib/types"
import type { SquadDetail, SquadType } from "./models"

/** Detalhe completo de uma squad — usado ao abrir o dialog de edição. */
export function useSquad(id: number | string | null) {
  return useQuery({
    queryKey: ["squad", id],
    queryFn: () => api.get<SquadDetail>(`/squad/${id}`),
    enabled: id !== null,
  })
}

/** Lista de referência (tipos de squad) — usada em selects. */
export function useSquadTypes() {
  return useQuery({
    queryKey: ["squad-type", "list"],
    queryFn: async () => {
      const page = await api.get<Paginated<SquadType>>("/squad-type/paginate", {
        page: 1,
        limit: 100,
        order_field: "description",
        order_type: "ASC",
      })
      return page.data
    },
  })
}
```

- **`queryKey` is an array, not a URL string** — the biggest mechanical difference from SWR. Convention: `[domain, ...identifiers]` (`["squad", id]`, `["squad-type", "list"]`) — plain strings/values, no need to bake the query string into the key by hand like SWR's URL-as-key required. Keep keys colocated in the hook that uses them; **no `QUERY_KEYS` registry file** for now — only introduce one if key reuse across files genuinely happens (YAGNI, same call as SWR's "no keys file" rule below it replaces).
- `enabled: id !== null` (or `!!id`) replaces SWR's `null`-as-key conditional-fetch trick — same effect (query doesn't fire), explicit boolean instead of implicit key shape.
- A paginated endpoint's `api.get<T>()` return is the `Paginated<T>` object (`.data` is the array), same shape `usePaginatedList` already unwraps — `.data` still needs reading explicitly here since this file isn't going through that hook, but there's still no `ApiResponse<...>` in sight; the envelope itself is already gone by the time this code runs.
- **Never hand-build a query string.** `api.get<T>(path, params)` takes a plain params object as its second argument and axios serializes it (`lib/api/request.ts`'s `paramsSerializer` — arrays become repeated keys, not `key[]=`). `api.get("/squad-type/paginate?page=1&limit=100")` and manual `URLSearchParams`/template-literal query strings are both the old habit from `services/fire/`/`services/map-elements/` before they were cleaned up — don't reintroduce it in new code.
- Don't set custom `staleTime`/`gcTime`/`refetchOnWindowFocus` per hook unless you have a concrete reason — the app-wide `QueryClient` defaults (`components/providers/query-provider.tsx`) are the baseline; tune per-hook only when a specific screen's data genuinely needs different freshness behavior.

## `mutations.ts` — React Query writes

`useMutation` hooks, one per verb, calling `@/lib/api` directly — no wrapper class in between. The calling component (usually a `-form-dialog.tsx` or `-row-actions.tsx`, see `scaffolding-entity-ui`) calls `.mutate()`/`.mutateAsync()` and still owns the standard error-handling branch itself in `onError` (401 → `expireSession()`, 409 → "possui vínculos", 422 → surface `payload.validator` via RHF `setError` — see `CLAUDE.md`, "Standard error handling"):

```ts
// services/squads/mutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"
import type { SquadDetail, SquadPayload } from "./models"

export function useCreateSquad() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SquadPayload) => api.post<SquadDetail>("/squad", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["squad-type", "list"] }),
  })
}

export function useUpdateSquad(id: number | string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SquadPayload) => api.put<SquadDetail>(`/squad/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["squad", id] }),
  })
}

export function useDeleteSquad() {
  return useMutation({ mutationFn: (id: number | string) => api.delete(`/squad/${id}`) })
}
```

- `invalidateQueries({ queryKey: [...] })` is the direct replacement for SWR's `mutate(key)` — call it in `onSuccess`, targeting whichever `queries.ts` key(s) the write affects. If the mutation doesn't need to invalidate anything reactive on this screen (e.g. the caller does `router.push` right after and the destination re-fetches on its own), it's fine to skip `onSuccess` entirely.
- The component still does its own `try/catch` around `.mutateAsync(payload)` (or reads `mutation.error`/`isPending` from `.mutate()`) for the standard 401/409/422 branches — `onError` inside the hook is only for cache-adjacent side effects, not for user-facing toasts/`setError`, which stay at the call site same as before.
- For most domains this file is one `useMutation` per verb, no more — don't add optimistic updates (`onMutate`/rollback) unless a specific screen actually needs that UX; the default (invalidate + refetch) is the right starting point everywhere else.
- The base path (`"/squad"`) is just written inline per call, same as `queries.ts` — no shared URL constant or wrapper class. If a domain has enough mutations that repeating the literal starts to bug you, a private `const BASE_URL = "/squad"` at the top of that one file is fine; don't promote it to a class or export it.

## `index.ts` Barrel

```ts
export * from "./queries"
export * from "./mutations"
export * from "./models"
```

## Quick Reference

| Concern | Convention |
|---|---|
| HTTP client (everything) | `import api from "@/lib/api"` — `.get/.post/.put/.patch/.delete`, called directly in `queries.ts`/`mutations.ts`, no wrapper class, never `ccFetch` |
| Types | `models.ts` (Request/Response/Payload sections) — Response/Request are plain `interface`s matching `docs/api/*.md` (no runtime parsing); only Payload uses Zod + `z.infer` (real user-input validation, doubles as RHF schema) |
| `ApiResponse<T>` | Never typed or touched anywhere in `services/<domain>/` — `@/lib/api` already stripped the envelope before your code sees the data |
| Shared Zod fragments | None yet — write inline, extract only once a rule is genuinely duplicated across 2+ domains |
| Cache key (React Query) | Array `[domain, ...identifiers]`, e.g. `["squad", id]` — no registry file, keep it colocated in the hook |
| List/table data | `hooks/use-paginated-list.ts` directly in the table component (still SWR-based, not touched by this skill) |
| User-facing errors | `toast.error(message)` / `toast.success(message)` from `sonner` (already the project standard) |
| Standard error branches | 401 → `expireSession()`, 409 → "possui vínculos", 422 → `payload.validator` — handled at the call site (`try/catch` around `.mutateAsync()`, or the component's own read of `.error`), not inside `mutations.ts`'s `onError` |
| Cache invalidation | `queryClient.invalidateQueries({ queryKey: [...] })` in a mutation's `onSuccess` — the React Query equivalent of SWR's `mutate(key)` |

## Common Mistakes

- Reaching for `ccFetch`/`swrFetcher`/`swrListFetcher`/`useSWR` inside `services/<domain>/` — those are the older stack's job, not this pattern's. Always `@/lib/api` + React Query here.
- Typing anything as `ApiResponse<T>` or reading `.object` manually inside `services/<domain>/` — if you're doing either, you're re-unwrapping an envelope `@/lib/api` already unwrapped for you.
- `JSON.stringify`-ing the payload before passing it to `api.post`/`api.put` — the client does that internally; pass the plain object.
- Wrapping `api.post`/`api.put`/`api.delete` in a static-class shape (`XApi`/`XService`) — that indirection was dropped; call `@/lib/api` directly from `mutations.ts`.
- Skipping a `services/<domain>/` hook because a call site is "only used once" — there's no reuse threshold, every GUARD API call gets the same shape regardless of caller count.
- **Adding a Zod schema + `.parse()`/`.safeParse()` on a Response type** — the shape is already fully documented in `docs/api/*.md`; a plain `interface` passed as the generic to `api.get<T>()`/`api.post<T>()`/`fetchAllPages<T>()` is the whole job. Zod belongs only in the Payload section (real, untrusted user input from a form), not on trusted, already-documented API responses.
- Migrating an entity out of `lib/types.ts` as a standalone sweep instead of only when a domain is already being scaffolded/touched under `services/`.
- Using a raw URL string as `queryKey` out of SWR habit — use the array form (`["squad", id]`), it's how React Query's cache actually partial-matches for invalidation.
- Adding optimistic updates (`onMutate`) or a `QUERY_KEYS` registry file speculatively — start with the plain `invalidateQueries` shape above; only reach for either once a specific screen's UX genuinely needs it.
- Migrating an existing SWR domain (any inline `useSWR` screen, or a `services/<domain>/` folder) to React Query as a standalone sweep instead of only when already touching that code for another reason or the user explicitly asks for that specific domain.
- Wrapping `usePaginatedList` in another hook here — table screens call it directly, `queries.ts` is for single-entity/reference data only.
- Adding a `/api/cc` prefix to an `@/lib/api` call — it's automatic there and would double up to `/api/cc/api/cc/...` (that prefix is only manual for the older `swrFetcher`/`swrListFetcher`, which this skill doesn't use).
- Hand-building a query string (`URLSearchParams`, template-literal `?key=value&...`) instead of passing a plain object as `api.get`'s second argument.
- Forgetting to re-export new hooks/functions/models from `index.ts`.

## Related Skills

- **`scaffolding-entity-ui`** — the UI layer (`components/<entity>/`) that consumes these hooks/mutations, including the RHF+Zod form convention.
