---
name: scaffolding-api-service
description: Use ONLY in apps/web, when adding a new domain, endpoint, query or mutation that calls apps/api over HTTP — creating a services/<domain> folder, adding a query or mutation, or extracting an inline fetch from a component. Never for apps/api itself (that is fastify-module-scaffolding).
---

# Scaffolding an `apps/web` API service (`services/<domain>`)

**Scope: `apps/web` only.** This is how the web app talks to `apps/api`. It never applies inside
`apps/api` (routes, controllers, services there follow `fastify-module-scaffolding`), and it never
touches the database — `apps/web` only reaches data over HTTP (`CLAUDE.md`).

## Where it lives (APP_MODE matters)

The store and the admin are built separately (`APP_MODE`), and the store must never import admin
code, nor the reverse (Biome `noRestrictedImports`; CI fails if the store build contains admin
routes or text). So services live **inside the mode that uses them**, never in a shared root folder:

```
apps/web/
├── lib/api.ts                          # shared HTTP client (both modes) — see below
├── modules/store/services/<domain>/    # e.g. catalog, cart, checkout, customer
└── modules/admin/services/<domain>/    # e.g. auth, sku, stock, order
```

If both modes truly need the same call, put the plain fetch function in `lib/` (shared) and give
each mode its own `queries.ts`/`mutations.ts` on top of it. Do not import across modes.

## Anatomy

```
services/<domain>/
  queries.ts     # queryOptions() factories — no hooks, no "use client" (server-safe)
  mutations.ts   # "use client" — useMutation hooks, one per verb
```

Always scaffold a service, even for a single call site — every API call should be findable in the
same shape, not "sometimes a named function, sometimes an inline `fetch`". No barrel file: import
from `queries`/`mutations` directly (mixing a `"use client"` module into a barrel would drag client
code into Server Components).

## Contracts come from `packages/shared` (no `models.ts` here)

Request/response contracts are Zod schemas in `packages/shared` (`CLAUDE.md`), shared with the API:

- **Response types:** `z.infer` types exported by `@geekstore/shared`, passed as the generic to
  the client (`api.get<AuthSessionResponse>(...)`). No `.parse()` on responses — the API already
  serializes them through the same schema.
- **Payload types (mutations):** the shared Zod schema is also the RHF `zodResolver` schema
  (see `form-fields`). User input is validated here and again in the API.
- If the schema you need doesn't exist yet, add it to `packages/shared` first (see
  `fastify-module-scaffolding`), and check `docs/api/README.md` (`/openapi-docs`) for the real shape
  before writing a call. If the API lacks the endpoint or field, that is a request to the backend,
  not something to fake in the web app.
- Money is integer cents everywhere; format only at render time (`components/ui/price.tsx`).

## The HTTP client: `lib/api.ts`

One shared client, no per-domain wrappers and no static classes. **It doesn't exist yet** — create
it the first time a service needs it, modeled on the private `parseJsonOrThrow` in
`modules/admin/lib/auth-client.ts` (the only place that calls the API today):

- Base URL from `process.env.NEXT_PUBLIC_API_URL`, `credentials: 'include'` (refresh cookie),
  JSON in/out, `api.get/post/put/patch/delete<T>()` returning the parsed `T`.
- Params for `get` as a plain object (serialized by the client) — never hand-build query strings.
- Throws an `ApiError` carrying the API's error body (`{ error, code, message, details? }`, see
  `docs/api/common-schemas.md`) so callers can branch on `code`/`status`.
- It lives in `lib/` (shared by store and admin), so it must not import from `modules/admin` or
  `modules/store`. The admin's access token lives in `useAdminAuthStore` (Zustand); the admin
  service passes it in (option/header) — the client doesn't reach into a store itself.
- Once it exists, migrate `auth-client.ts` onto it only when touching that file anyway.

## `queries.ts` — reads

`queryOptions` (TanStack Query v5) factories (type names below like `ProductResponse`/`SkuPayload` are illustrative — the schemas don't exist in `packages/shared` yet): one definition of key + fetcher, usable in a client
component **and** for server prefetch. No wrapper `useX()` hooks — components call
`useQuery(skuQueryOptions(code))` directly.

```ts
// modules/store/services/catalog/queries.ts
import { queryOptions } from '@tanstack/react-query';
import type { ProductListResponse, ProductResponse } from '@geekstore/shared';
import { api } from '@/lib/api';

export const productListQueryOptions = (params: { category?: string; page?: number }) =>
  queryOptions({
    queryKey: ['product', 'list', params],
    queryFn: () => api.get<ProductListResponse>('/api/products', params),
  });

export const productQueryOptions = (slug: string) =>
  queryOptions({
    queryKey: ['product', slug],
    queryFn: () => api.get<ProductResponse>(`/api/products/${slug}`),
  });
```

```tsx
// Server Component (store page): prefetch + hydrate, then the client component reads the cache
const queryClient = new QueryClient();
await queryClient.prefetchQuery(productQueryOptions(slug));
return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ProductView slug={slug} />
  </HydrationBoundary>
);

// Client component
const { data } = useQuery(productQueryOptions(slug));
```

- **`queryKey` is an array `[domain, ...identifiers]`**, kept next to the factory. No `QUERY_KEYS`
  registry until key reuse across files actually happens.
- Conditional fetch: `enabled: Boolean(id)`. Don't set per-query `staleTime`/`retry` without a
  concrete reason — the defaults are in `components/providers.tsx`.
- Server data never goes into Zustand and never into `useState` + `useEffect`.

## `mutations.ts` — writes

```ts
// modules/admin/services/sku/mutations.ts
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SkuPayload, SkuResponse } from '@geekstore/shared';
import { api } from '@/lib/api';

export function useCreateSku() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SkuPayload) => api.post<SkuResponse>('/api/skus', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sku'] }),
  });
}
```

- One `useMutation` per verb; `invalidateQueries` in `onSuccess` for the keys the write affects.
- The form component owns user-facing error handling: `validation_failed` → RHF `setError` from
  `details`, other codes → a message via `StoreAlert`/the admin equivalent. Admin 401 →
  refresh once, else `clearSession()` (`useAdminAuthStore`). Keep that at the call site, not in
  the hook's `onError`.
- No optimistic updates (`onMutate`) unless a specific screen needs that UX.
- Never `JSON.stringify` the payload yourself; the client does it.

## Quick reference

| Concern | Convention |
| --- | --- |
| Location | `modules/<store\|admin>/services/<domain>/`, never a root `services/` |
| HTTP | `import { api } from '@/lib/api'` only; no `fetch` inline in components, no per-domain classes |
| Types | From `@geekstore/shared`; no local response models, no `.parse()` on responses |
| Reads | `queryOptions` factories in `queries.ts`; components call `useQuery(...)` directly |
| Server prefetch | `prefetchQuery(xQueryOptions(...))` + `HydrationBoundary` in the Server Component |
| Writes | `useMutation` in `mutations.ts` (`"use client"`), invalidate in `onSuccess` |
| Global state | Zustand only for UI/session/cart — never for server data |
| Files | kebab-case, no barrel |

## Common mistakes

- Using this skill (or a `services/` folder) inside `apps/api`.
- Creating `apps/web/services/` at the root, or importing a service across store/admin.
- Writing `fetch(...)` directly in a component or a `useEffect` instead of a service.
- Wrapping every `useQuery` in a same-named `useX` hook that adds nothing.
- Defining a response `interface` locally instead of importing from `@geekstore/shared`.
- Marking `queries.ts` as `"use client"` — it then can't be used for server prefetch.
- Hand-building query strings, or putting a URL string in `queryKey`.
- Storing the fetched data in Zustand.
- Inventing a payload/endpoint shape that `docs/api/` and `apps/api` don't have.

## Related skills

- `form-fields` — the form layer that consumes these mutations (RHF + `Controller` + `Field*`).
- `fastify-module-scaffolding` — the API side of every endpoint used here, and `packages/shared` schemas.
- `react-patterns` / `frontend-patterns` — server/client boundary and state placement.
