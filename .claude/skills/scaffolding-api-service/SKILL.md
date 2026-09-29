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

## The HTTP client: `lib/api.ts` (exists)

One shared client, no per-domain wrappers and no static classes.

```ts
api.get<T>(path, params?, options?)      // params: plain object, arrays become repeated keys
api.post<T>(path, body?, options?)       // also put / patch / delete
// options: { accessToken?, cache?, next?, signal? }
```

- Base URL from `NEXT_PUBLIC_API_URL`; sends the refresh cookie (`credentials: 'include'`); sets
  `Content-Type` only when there is a body (Fastify rejects JSON with an empty body, e.g. `/refresh`).
- Failures throw `ApiError` (`status`, `code`, `message`, `details`) built from the API's error
  body (`docs/api/common-schemas.md`). Network failure → `status 0`, `code 'network_error'`.
  Branch on `error.code`/`error.status`, never on message text.
- `accessToken` becomes `Authorization: Bearer`. The client lives in `lib/` (shared), so it never
  imports `modules/admin`/`modules/store`: the admin service passes the token from
  `useAdminAuthStore`. (No protected API route exists yet; the header convention is ours.)
- `cache` / `next` are forwarded to `fetch`. Next 16 without `cacheComponents` (our config) does
  **not** cache `fetch` by default — for ISR/`revalidateTag` (D9) the server-side query must pass
  `next: { revalidate, tags }` or `cache: 'force-cache'`.
- Reference implementation: `modules/admin/services/auth/mutations.ts` (login/refresh/logout).

## QueryClient and server hydration (TanStack Query "Advanced SSR")

`lib/get-query-client.ts` is the single source of the client:

- **Server: a new `QueryClient` per request** (a shared one would leak data between users).
  **Browser: singleton.** `components/providers.tsx` and every Server Component use
  `getQueryClient()` — never `new QueryClient()` or `useState(() => new QueryClient())`.
- `staleTime` is 60s (> 0 avoids an immediate refetch after hydration); 4xx `ApiError`s are not
  retried.
- **Server Components only prefill the cache** (`prefetchQuery` + `dehydrate` +
  `HydrationBoundary`); they never render from the fetched data themselves.
- **Where to prefetch:** public store pages (catalog, product, home) — `await` the prefetch when
  the data must be in the HTML (SEO, RNF-04). Secondary blocks may skip `await` (streaming) if
  `shouldDehydrateQuery` also dehydrates `pending` queries. **Never in the admin or for
  logged-in customer data:** the access token lives in browser memory and the server has no
  cookie, so those screens use `useQuery` on the client.
- Read with `useSuspenseQuery` for prefetched data (needs a `<Suspense>`/`loading.tsx` above) and
  `useQuery` otherwise.
- Don't use `initialData` for server data, and don't call Server Actions from a `queryFn`.

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
const queryClient = getQueryClient();
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
- The form component owns user-facing error handling: catch `ApiError` and branch on `code`
  (`validation_failed` → RHF `setError` from `details`; anything else → show `error.message`, as
  `admin-login.tsx` does). Admin 401 → refresh once, else `clearSession()`
  (`useAdminAuthStore`). Keep that at the call site, not in the hook's `onError`.
- No optimistic updates (`onMutate`) unless a specific screen needs that UX.
- Never `JSON.stringify` the payload yourself; the client does it.

## Quick reference

| Concern | Convention |
| --- | --- |
| Location | `modules/<store\|admin>/services/<domain>/`, never a root `services/` |
| HTTP | `import { api } from '@/lib/api'` only; no `fetch` inline in components, no per-domain classes; errors are `ApiError` |
| QueryClient | `getQueryClient()` from `lib/get-query-client.ts` (new per request on the server, singleton in the browser) |
| Types | From `@geekstore/shared`; no local response models, no `.parse()` on responses |
| Reads | `queryOptions` factories in `queries.ts`; components call `useQuery(...)` directly |
| Server prefetch | Public store pages only: `getQueryClient()` + `prefetchQuery(xQueryOptions(...))` + `HydrationBoundary`; never admin/logged-in data |
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
- Creating a `QueryClient` with `new`/`useState` instead of `getQueryClient()`, or sharing one across server requests.
- Prefetching admin or logged-in customer data on the server (no token/cookie there).
- Inventing a payload/endpoint shape that `docs/api/` and `apps/api` don't have.

## Related skills

- `form-fields` — the form layer that consumes these mutations (RHF + `Controller` + `Field*`).
- `fastify-module-scaffolding` — the API side of every endpoint used here, and `packages/shared` schemas.
- `react-patterns` / `frontend-patterns` — server/client boundary and state placement.
