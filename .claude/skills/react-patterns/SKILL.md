---
name: react-patterns
description: React 18/19 patterns including hooks discipline, server/client component boundaries, Suspense + error boundaries, forms, data fetching, state management decision trees, and accessibility-first composition. Use when writing or reviewing React components.
metadata:
  origin: ECC
---

# React Patterns

Idiomatic React 18/19 patterns for building robust, accessible, performant component trees.

## When to Activate

- Writing or modifying React function components, custom hooks, or component trees
- Reviewing JSX/TSX files
- Designing state shape or component composition
- Migrating class components or older `forwardRef`/`useEffect`-heavy code
- Choosing between local state, lifted state, and Zustand
- Working with Server Components / Client Components (Next.js App Router, RSC)
- Implementing forms (this project: react-hook-form + `Controller`, see `form-fields` skill — not React 19 form actions)
- Wiring data fetching with React Query / RSC

## Core Principles

### 1. Render is a Pure Function of Props and State

```tsx
// Good: derive during render
function Cart({ items }: { items: CartItem[] }) {
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return <span>{formatMoney(total)}</span>;
}

// Bad: derived state stored separately
function Cart({ items }: { items: CartItem[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((sum, i) => sum + i.price * i.qty, 0));
  }, [items]);
  return <span>{formatMoney(total)}</span>;
}
```

Derived state in `useEffect` adds a render cycle, can desync, and obscures the data flow.

### 2. Side Effects Outside Render

Effects, mutations, network calls, and subscriptions live in event handlers or `useEffect` — never in the render body.

### 3. Composition Over Inheritance

React has no inheritance model for components. Compose with `children`, render props, or component props.

## Hooks Discipline

See [rules/react/hooks.md](../../rules/react/hooks.md) for the full ruleset. Highlights:

- Top-level only, never conditional
- Cleanup every subscription, interval, listener
- Functional updater (`setX(prev => prev + 1)`) when new state depends on old
- Default position: do not memoize — add `useMemo`/`useCallback` only when a profiler or a dependency chain proves it matters
- Extract a custom hook only when the same hook sequence appears in 2+ components

## State Location Decision Tree

```
Used by one component?
  -> useState inside it

Used by parent + a few descendants?
  -> lift to nearest common ancestor

Used across distant branches, across routes, or has complex transitions?
  -> Zustand store (no Context, no useReducer)

Derived from a server?
  -> React Query (prefetch + HydrationBoundary) or RSC fetch, never Zustand
```

Most pages do not need a global store. Resist abstraction until duplicated lifting becomes painful.

## Server / Client Components (RSC)

```tsx
// Server Component - default, async, never ships JS for itself
// In apps/web, this always fetches from apps/api over HTTP — apps/web never
// imports @geekstore/db or touches the database directly (see CLAUDE.md).
export default async function ProductPage({ params }: { params: { id: string } }) {
  const res = await fetch(`${API_URL}/api/products/${params.id}`);
  if (!res.ok) notFound();
  const product = await res.json();
  return <ProductView product={product} />;
}

// Client Component - opt in with "use client"
"use client";
export function AddToCartButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => startTransition(() => addToCart(productId))}
    >
      {pending ? "Adding..." : "Add to cart"}
    </button>
  );
}
```

Boundaries:

- Server -> Client: pass serializable props or `children`
- Client -> Server: call `apps/api` over HTTP (React Query mutation or `fetch` from an event handler) — no Server Actions that touch data
- Never `import` a Server Component from a Client Component file — compose them via `children` instead

## Suspense + Error Boundaries

```tsx
<ErrorBoundary fallback={<ErrorView />}>
  <Suspense fallback={<UserSkeleton />}>
    <UserDetail id={id} />
  </Suspense>
</ErrorBoundary>
```

- Place Suspense boundaries close to the data, not at the route root — progressively reveal content
- Error Boundary remains a class API; use `react-error-boundary` for a hook-friendly wrapper
- A boundary catches errors thrown during render, lifecycle, and constructors of its children — NOT in event handlers or async code

## Forms

Every form in `apps/web` uses react-hook-form's `useForm()` with each field wrapped in an
explicit `<Controller>` — mandatory, not a style preference (HeroUI's inputs don't forward a
plain DOM ref the way `register()` expects). Submission calls `apps/api` over HTTP,
never a Server Action touching a database — `apps/web` never imports `@geekstore/db`
(see `CLAUDE.md`). See the `form-fields` skill for the full contract (the `FieldInput`/
`FieldSelect`/... family in `components/ui/`, isInvalid/error derivation, Zod validation via
`@hookform/resolvers/zod`) and `apps/web/modules/admin/admin-login.tsx` as the reference
implementation.

### Complex forms

Multi-step forms, dynamic field arrays, or cross-field validation are exactly what
react-hook-form is already handling here — see `apps/web/modules/store/checkout.tsx` (a
three-step wizard) for how this project structures that: one `useForm()` per logically
independent field set, not one per step.

## Data Fetching Decision Matrix

| Need | Tool |
|---|---|
| Per-request data in Next.js App Router | RSC `await fetch()` |
| Client-side cache + mutations + invalidation | React Query |
| Real-time subscriptions | Server-Sent Events, WebSockets, or the lib's subscription API |
| One-off fire-and-forget | `fetch()` in an event handler |

Avoid `useEffect` + `fetch` for application data — race conditions, no cache, no retry, no Suspense integration.

## Composition Recipes

### Slot via `children`

```tsx
<Layout>
  <Header />
  <Main>{content}</Main>
</Layout>
```

### Named slots

```tsx
<Page header={<Nav />} sidebar={<Filters />}>
  <Results />
</Page>
```

### Compound components (HeroUI ships them; custom ones keep state in Zustand)

```tsx
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="profile"><Profile /></Tabs.Panel>
  <Tabs.Panel value="settings"><Settings /></Tabs.Panel>
</Tabs>
```

### Render prop / function-as-child

Useful when the parent needs to pass parameters to the rendered output:

```tsx
<DataLoader id={id}>
  {({ data, isLoading }) => isLoading ? <Spinner /> : <UserCard user={data} />}
</DataLoader>
```

Modern alternative: a hook (`useData(id)`) returning the same shape — usually cleaner.

## Performance

### When `React.memo` Actually Helps

Wrap a component in `React.memo` only when:

1. It re-renders frequently
2. Its props are usually the same between renders
3. Its render is measurably expensive

`React.memo` adds an equality check on every render. If props differ on most renders, the check is pure overhead.

### Avoiding Render Cascades

- Lift state down rather than up where possible
- Zustand selectors: `useStore(s => s.field)` (+ `useShallow` for objects), never the whole store — a component re-renders only for the slice it reads
- Use `useSyncExternalStore` for external state libraries — required for safe concurrent rendering

### Lists

- Provide stable `key` props (database id, not array index)
- Virtualize long lists with `@tanstack/react-virtual` or `react-window` once visible item count exceeds ~50 with non-trivial rows

## Accessibility-First Composition

- Always render semantic HTML (`<button>`, `<a>`, `<nav>`, `<main>`) before reaching for `role` attributes
- Every interactive element must be reachable by keyboard
- Form inputs need labels — `<label htmlFor>` or `aria-label` if visually labeled by an icon
- Manage focus on route changes and modal open/close

## Routing

Routing in this project is the Next.js App Router only (route groups `(store)` / `(admin)`, `APP_MODE` at build). Framework specifics — Route Handlers, Middleware/`proxy.ts`, Parallel Routes — follow the Next.js docs and the `nextjs-turbopack` skill.

## Related

- Rules: [rules/react/](../../rules/react/) — coding-style, hooks, patterns, security
- Skills: [frontend-patterns](../frontend-patterns/SKILL.md) for UI concerns, [form-fields](../form-fields/SKILL.md) for forms

## Examples

### Custom hook for debounced search
use lib use-debounce

### Optimistic UI with React 19 `useOptimistic`

`useOptimistic` is orthogonal to the RHF+Controller rule above — it wraps the *submit handler*,
not the field itself, so the field stays a normal `Controller`-wrapped `FieldInput`:

```tsx
"use client";
import { useOptimistic } from "react";
import { Controller, useForm } from "react-hook-form";
import { FieldInput } from "@/components/ui";

type MessageFormValues = { text: string };

export function MessageList({ messages }: { messages: Message[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (state, newMessage: Message) => [...state, newMessage],
  );
  const { control, handleSubmit, reset } = useForm<MessageFormValues>();

  const send = async ({ text }: MessageFormValues) => {
    addOptimistic({ id: "pending", text, sender: "me" });
    await saveMessage(text);
    reset();
  };

  return (
    <>
      <ul>{optimistic.map((m) => <li key={m.id}>{m.text}</li>)}</ul>
      <form onSubmit={handleSubmit(send)}>
        <Controller
          control={control}
          name="text"
          render={({ field, fieldState }) => (
            <FieldInput field={field} fieldState={fieldState} label="Mensagem" />
          )}
        />
        <button type="submit">Send</button>
      </form>
    </>
  );
}
```

### Splitting state to avoid render cascades

```tsx
// One store per concern; components subscribe to slices
const items = useCartStore((s) => s.items);          // re-renders only when items change
const addItem = useCartStore((s) => s.addItem);      // actions are stable
const { open, setOpen } = useUiStore(useShallow((s) => ({ open: s.open, setOpen: s.setOpen })));
```
