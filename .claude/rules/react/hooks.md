---
paths:
  - "**/*.tsx"
  - "**/*.jsx"
  - "**/hooks/**/*.ts"
  - "**/hooks/**/*.js"
  - "**/use-*.ts"
  - "**/use-*.tsx"
---
# React Hooks

> This file covers **React hooks** (`useState`, `useEffect`, `useMemo`, `useCallback`, custom hooks) — NOT the Claude Code `hooks/` runtime system. Naming matches the per-language convention `rules/<lang>/hooks.md` used across this repo.
>
> Extends [typescript/patterns.md](../typescript/patterns.md) and [common/patterns.md](../common/patterns.md).

## Rules of Hooks

Enforce `eslint-plugin-react-hooks` with `react-hooks/rules-of-hooks` set to error.

1. Hooks only at the top level of a function component or another hook
2. Never in loops, conditionals, nested functions, or after early returns
3. Always called in the same order on every render
4. Only inside React function components or custom hooks (functions starting with `use`)

```tsx
// WRONG: conditional hook
function Foo({ enabled }: { enabled: boolean }) {
  if (enabled) {
    const [x, setX] = useState(0); // rule violation
  }
}

// CORRECT: hook unconditional, condition inside
function Foo({ enabled }: { enabled: boolean }) {
  const [x, setX] = useState(0);
  if (!enabled) return null;
  return <span>{x}</span>;
}
```

## `useEffect` — When NOT to Use

`useEffect` is for synchronizing with external systems (subscriptions, browser APIs, third-party libraries). It is **not** the right tool for:

- Derived state — compute it during render
- Transforming data for rendering — compute it during render
- Resetting state when a prop changes — use a `key` on the parent or derive from props
- Notifying parents of state changes — call the callback in the event handler
- Initializing app-level singletons — call the function module-side or in `main.tsx`

```tsx
// WRONG: effect for derived state
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);

// CORRECT: derive during render
const fullName = `${first} ${last}`;
```

## Effect Placement Within a Component

All `useEffect` calls in a component go together as **one contiguous block, immediately before the first `return`** — never interspersed between regular helper functions or other hook calls earlier in the body.

**Early-return components (loading/error/empty-state guards) are the one case where "before the return" doesn't mean "at the bottom of the file."** Rule of Hooks #2 (never call a hook after an early return) takes priority over this style rule — a component like:

```tsx
// WRONG — effects placed after the early returns that gate them; on the
// loading/error renders, these useEffect calls never execute, and if a later
// render takes a DIFFERENT early-return path than the previous render, the
// hook is skipped on some renders and not others — the exact violation
// "always called in the same order every render" forbids.
function Widget({ query }: { query: string }) {
  const { data, isLoading, isError } = useQuery(query)

  if (isLoading) return <Skeleton />
  if (isError) return <ErrorState />

  useEffect(() => { /* ... */ }, [data]) // never reached on loading/error renders — bug

  return <Result data={data} />
}
```

still groups its effects together, but the group moves to **right after the other hooks, before the first early return** — not "right before the final JSX return":

```tsx
// CORRECT — all hooks, including every useEffect, run unconditionally before
// any early return. The group is still contiguous, just positioned earlier.
function Widget({ query }: { query: string }) {
  const { data, isLoading, isError } = useQuery(query)

  useEffect(() => { /* ... */ }, [data])
  useEffect(() => { /* ... */ }, [isError])

  if (isLoading) return <Skeleton />
  if (isError) return <ErrorState />

  return <Result data={data} />
}
```

So the actual rule is: **group every `useEffect` together, positioned as late as possible without following any conditional/early return** — for a component with no early returns that's the bottom of the function, right before `return`; for a component with early-return guards, that's right after the other hooks (state/refs/data), before the first `if (...) return ...`.

Order within a component with no early returns:

1. State/ref/data hooks (`useState`, `useRef`, `useDebouncedCallback`, data-fetching hooks like `useQuery`)
2. Plain helper functions (event handlers, derived-value functions)
3. Render-only derived `const`s
4. **All `useEffect` calls, grouped, last** — right before `return`

```tsx
// WRONG — effects scattered between helper functions
function Widget() {
  const [open, setOpen] = useState(false)

  useEffect(() => { /* effect A */ }, [])

  function handleClick() { /* ... */ }

  useEffect(() => { /* effect B */ }, [open])

  function handleSubmit() { /* ... */ }

  return ...
}

// CORRECT — every useEffect grouped together, right before return
function Widget() {
  const [open, setOpen] = useState(false)

  function handleClick() { /* ... */ }
  function handleSubmit() { /* ... */ }

  useEffect(() => { /* effect A */ }, [])
  useEffect(() => { /* effect B */ }, [open])

  return ...
}
```

**Why:** a `useEffect` runs on mount (and on every dependency change) regardless of where it sits in the source — its position in the file doesn't change when it fires. Grouping them as the last thing before `return` gives one predictable place to scan for "everything that runs as a side effect when this component mounts/updates," instead of hunting for `useEffect` calls scattered between unrelated helper functions. This is a house style choice, not a React requirement — it doesn't conflict with the Rules of Hooks above (call order across renders still only depends on hooks never being conditional/looped, not on their position relative to plain functions).

## Dependency Arrays

- Always include every reactive value referenced inside the effect/callback
- Enable `react-hooks/exhaustive-deps` lint rule — never silence it without a comment explaining why
- If the dep array grows unwieldy, the effect is doing too much — split it
- Stable identity for functions passed in deps: wrap in `useCallback` only when the function is itself a dependency of another hook or passed to a memoized child

## Cleanup

Every subscription, interval, listener, or in-flight request must clean up.

```tsx
useEffect(() => {
  const controller = new AbortController();
  fetch(url, { signal: controller.signal }).then(handleResponse);
  return () => controller.abort();
}, [url]);
```

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
```

Missing cleanup = race conditions when deps change, memory leaks on unmount.

## `useMemo` and `useCallback` — When Worth It

Default position: **do not memoize**. Add `useMemo` / `useCallback` only when:

1. The value is passed to a `React.memo`-wrapped child as a prop, and identity matters
2. The value is a dependency of another `useEffect` / `useMemo` / `useCallback`
3. The computation is measurably expensive (profile before assuming)

Premature memoization adds noise, hides bugs, and can be slower than the recompute it replaces.

## Custom Hooks

Extract a custom hook when:

- The same hook sequence (state + effect + computed) appears in 2+ components
- The logic has a clear, nameable purpose (`useDebounce`, `useOnClickOutside`, `useLocalStorage`)
- You want to test the logic independently of any component

Do NOT extract when:

- It would have a single caller — inline it
- The "hook" is just `useState` with a different name — adds indirection, no value

```tsx
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

## `useState` Patterns

- Initial state from prop only at mount: pass a function `useState(() => computeInitial(prop))` when computation is expensive
- Functional updater when the new state depends on the old: `setCount(c => c + 1)` — never `setCount(count + 1)` inside async or batched contexts
- Group related state into one object only when they always change together; otherwise split into multiple `useState` calls
- Use `useReducer` once state transitions are conditional on the previous state or there are 3+ related values

## `useRef` Patterns

- DOM refs for imperative APIs (focus, scroll, third-party libs)
- Mutable container that does not trigger re-render (timer ids, previous values, "is mounted" flags)
- Never read or write `ref.current` during render — only inside effects or event handlers
- `useImperativeHandle` only when exposing a child API to a parent ref — last-resort escape hatch

## `useSyncExternalStore`

Use this hook to subscribe to any external store (browser API, third-party state lib, custom event emitter). It is the supported way to make external state safe with concurrent rendering.

```tsx
const isOnline = useSyncExternalStore(
  (cb) => {
    window.addEventListener("online", cb);
    window.addEventListener("offline", cb);
    return () => {
      window.removeEventListener("online", cb);
      window.removeEventListener("offline", cb);
    };
  },
  () => navigator.onLine,
  () => true,
);
```

## React 19 Additions

- `use()` — unwrap promises and contexts inline; usable conditionally (only hook with that property)
- `useFormStatus()` / `useFormState()` (or `useActionState`) — form submission state without prop drilling
- `useOptimistic()` — optimistic UI updates while a server action is pending
- `useTransition()` — mark non-urgent state updates so urgent ones stay responsive

When the project targets React 19+, prefer these over hand-rolled equivalents.

## Stale Closure Trap

Async handlers and intervals capture the values from the render where they were created. Fix by:

1. Using the functional updater form of `setState`
2. Putting the changing value in the dep array of `useEffect` and rebuilding the handler
3. Reading from a ref that is kept in sync

## Lint Configuration

Required rules:

```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

Treat `exhaustive-deps` warnings as errors in CI for new code.
