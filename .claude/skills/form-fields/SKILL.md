---
name: form-fields
description: Use whenever a new form is added anywhere in apps/web (store or admin), an existing form is touched, or a new field type/kind is needed (select, radio, checkbox...). Every field must be wrapped in an explicit <Controller>, passing its field/fieldState render-prop args straight into the matching Field* component in components/ui/ (field-input.tsx, field-select.tsx, ...) — never a bare <form onSubmit> reading FormData, never a field that manually re-derives isInvalid/errorMessage from parallel useState, and never a new field-kind component named anything but Field<Kind>.
---

> HeroUI docs for the underlying inputs: `TextField` https://heroui.com/en/docs/react/components/text-field, `Select` https://heroui.com/en/docs/react/components/select. Check them before adding a new field kind.

# Forms: react-hook-form + Controller, always

## Rule (no exceptions)

Every form in `apps/web` — store or admin, connected to a real API or still a local demo —
is built with react-hook-form's `useForm()`, and every individual field is wrapped in an
explicit `<Controller>` **in the form's own JSX** — never through `register()` + a plain HTML
`<input>`, and never with `Controller` hidden inside a shared component. This project's inputs
are HeroUI v3 components built on `react-aria-components`, which don't forward a plain DOM ref
the way `register()` expects — `Controller`'s `field.ref`/`field.onChange` render-prop is what
actually works with them, not a project style preference.

**Why this matters enough to be a hard rule:** without it, every form re-invents the same few
lines — a `useState` for the error message, a manual `if (error) <p className="error">` block,
red-border CSS applied by hand per field. That duplication is exactly what the shared `Field*`
components below exist to kill. A new form that skips them reintroduces it.

## The `Field*` family — naming and location

Every field-kind component lives in `apps/web/components/ui/` as `field-<kind>.tsx` exporting
`Field<Kind>` (PascalCase, `Field` prefix): `field-input.tsx` → `FieldInput`, `field-select.tsx`
→ `FieldSelect`. A future `FieldRadio`/`FieldCheckbox` follows the same shape. The `Field` prefix
(not a `*Field` suffix) is deliberate: it avoids colliding with the raw HeroUI/react-aria
primitives each one wraps (`Input`, `Select`, ...) so nothing needs an import alias, and it
groups every field-kind component together in the barrel/autocomplete. All of them share one
contract:

- Props always include `field` (the `Controller` render prop's `field`) and `fieldState` (same
  render prop's `fieldState`) — never split into individual `value`/`onChange`/`isInvalid`/
  `errorMessage` props.
- `isInvalid` and the rendered error message are always derived from `fieldState` inside the
  component — a call site never passes those in directly.
- `label`/`description` stay flat props (HeroUI-v2-like ergonomics), even though the underlying
  HeroUI v3 primitive is a compound component.

```tsx
<Controller
  control={control}                 // from useForm()
  name="email"                      // must be a key of your form's values type
  render={({ field, fieldState }) => (
    <FieldInput
      field={field}
      fieldState={fieldState}
      label="E-mail"
      description="Usamos só para confirmar o pedido"  // optional, hidden automatically when there's an error
      type="email"                   // 'text' | 'email' | 'password' | 'tel', default 'text'
      autoComplete="off"
    />
  )}
/>
```

If a call site needs to force an error, do it through react-hook-form (`setError(name, {
message })`), which flows into `fieldState` the same way — never a prop directly on a `Field*`
component.

## `FieldInput` — text-like fields

`apps/web/components/ui/field-input.tsx`. Covers `type`: `text` | `email` | `password` | `tel`
(default `text`). Don't stretch this union to fit numeric/date/checkbox inputs — see "Fields no
`Field*` component covers yet" below.

## `FieldSelect` — single-select dropdown

`apps/web/components/ui/field-select.tsx`. Takes `options: { value: string; label: string }[]`
instead of raw children — reference usage: `checkout.tsx`'s "Estado (UF)" field (27 Brazilian
states). HeroUI's `Select` uses `value`/`onChange` directly (not the deprecated
`selectedKey`/`onSelectionChange`), which maps 1:1 to `field.value`/`field.onChange` with zero
translation.

**Non-obvious requirement found the hard way:** each `<ListBox.Item>` needs an explicit
`textValue={option.label}` prop, even though its children is already the same plain string. React
Aria's Select renders a hidden native `<select>` (for form submission and screen readers) whose
`<option>` text comes from each collection node's `textValue`, not from re-rendering the JSX
children — omit it and every hidden `<option>` silently ends up with empty text (no error, no
warning; only visible by inspecting the rendered HTML). Verified with an isolated
`renderToStaticMarkup` smoke test (not committed) rather than a full page — see "Validating a
new `Field*` component" below for why.

## Reference implementations (reread these, don't reinvent)

- **`apps/web/modules/admin/admin-login.tsx`** — the canonical case: a form with a real Zod
  schema shared with the API (`authLoginBodySchema` from `@geekstore/shared`), validated via
  `@hookform/resolvers/zod`:
  ```tsx
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<AuthLoginBody>({
    resolver: zodResolver(authLoginBodySchema),
  });
  ...
  <form onSubmit={handleSubmit(submit)}>
    <Controller
      control={control}
      name="email"
      render={({ field, fieldState }) => (
        <FieldInput field={field} fieldState={fieldState} label="E-mail" type="email" />
      )}
    />
  ```
  Any form whose shape already has (or should get) a Zod schema in `packages/shared` follows
  this pattern — resolver + shared schema, not hand-rolled validation.

- **`apps/web/modules/store/checkout.tsx`** and **`apps/web/modules/store/account.tsx`** — forms
  with no backend yet (demo/preview screens). Still `useForm()` + `Controller`-based `FieldInput`/
  `FieldSelect`, just without a `resolver` — there's no schema to validate against yet. When these
  get wired to a real endpoint, add the matching Zod schema to `packages/shared` and pass it as a
  resolver, mirroring admin-login.

- **`apps/web/modules/admin/admin.tsx`** (banner form) — a second `useForm()`/`control` pair
  living in the same component as another form (the product-edit dialog) — proof that a
  component with two independent forms just calls `useForm()` twice and destructures each
  hook's `control`/`handleSubmit` under different local names (`bannerControl`/`editControl`),
  rather than trying to share one `useForm()` across unrelated field sets.

- **`apps/web/modules/store/shell.tsx`** (header search) — a live-search-as-you-type field, not
  a validate-then-submit form. Still `useForm()` + `Controller`, but reads the live value with
  `useWatch({ control, name: 'q' })` instead of a parallel `useState` — the field driving other
  UI (the suggestions dropdown) on every keystroke is exactly the "controlled inputs" case, and
  RHF's `useWatch` covers it without a second source of truth.

- **`apps/web/modules/store/product.tsx`** (`Freight`, the CEP field) — a `FieldInput` with an
  input mask: `field.onChange` is wrapped in the `Controller` render prop to reformat digits
  into `00000-000` before handing the value to RHF, and `FieldInput` was extended with
  `inputMode`/`maxLength` (plain HTML input attributes, not a new field kind) once this became
  the second real case needing them (`checkout.tsx`'s own `cep` field is the first, unmasked).

## Fields no `Field*` component covers yet

Checkboxes, radios, file inputs, or anything without a `Field*` component: wrap the raw
HeroUI/native control in `<Controller>` directly, same as `apps/web/modules/admin/admin.tsx`'s
product-edit dialog (price/stock as `type="number"`, since `FieldInput` only covers text-like
types). This also applies when the field's chrome genuinely doesn't fit `FieldInput`'s
`Label`+`TextField` wrapper — `apps/web/modules/store/checkout.tsx`'s coupon input sits inside a
compact pill with no visible label, so it wraps a bare `<input>` in `Controller` instead of
forcing `FieldInput`'s structure onto a UI it wasn't designed for. Mismatched chrome is a
legitimate reason to skip a `Field*` component; missing validation/error display is not.

```tsx
<Controller
  control={control}
  name="price"
  render={({ field }) => (
    <input
      name={field.name}
      ref={field.ref}
      value={field.value}
      onBlur={field.onBlur}
      onChange={(e) => field.onChange(e.target.valueAsNumber)}
      type="number"
    />
  )}
/>
```

Don't broaden an existing `Field*` component's prop surface to fake-support a different kind
just to avoid writing this — add a new `field-<kind>.tsx` once a second real use case for that
kind shows up, following YAGNI (`rules/common/coding-style.md`). One inline `Controller` doesn't
justify a new shared component yet.

When a raw `<input>` sits inside a `<label>` via a `Controller` render prop, Biome's
`lint/a11y/noLabelWithoutControl` can't see through the render-prop indirection — give the input
an explicit `id` and the `<label>` a matching `htmlFor` rather than relying on implicit nesting
(see the product-edit dialog in `admin.tsx` for the pattern).

## Validating a new `Field*` component

Interactive browser testing isn't always available in this workflow — don't assume it is. Before
trusting a new field-kind component:

1. `pnpm --filter web typecheck` — catches prop/generic mismatches against the underlying
   react-aria/HeroUI types.
2. An isolated `renderToStaticMarkup` smoke test: import the component directly, render it with
   hand-built `field`/`fieldState` objects (mimicking both an empty and a filled/invalid state),
   and inspect the returned HTML string for the parts that matter (label text, ARIA attributes,
   the hidden native input/select's value and text, the rendered error message) — run via `tsx`
   from inside `apps/web` so React resolves, and delete the script afterward, same as the
   disposable BullMQ smoke test in `docs/planning/`. This catches wiring bugs (like the
   `textValue` one above) that `pnpm build` alone won't: a page using the form inside a
   client-only store (Zustand cart, auth session) usually SSGs its *loading* state, never the
   real form, so a green build proves nothing about the field itself.
3. If real interactive behavior matters (does the popover actually open on click, does keyboard
   nav work), that still needs a person or a browser tool to click through it — say so plainly
   instead of claiming full validation from steps 1–2 alone.

## Multi-step / conditional forms

One `useForm()` per logically-independent field set, even across steps of the same wizard —
`checkout.tsx`'s three-step contact/address form is one `useForm()` because all the field names
are unique across all three steps and only one step is ever submitted at a time. If two steps
needed overlapping field names with different meanings, that would be two separate forms/hooks
instead.

For a form whose field set should mirror external state that changes after mount (edit dialogs,
not creation forms), pass `values` to `useForm()` instead of `defaultValues` — `values` keeps
re-syncing whenever the referenced object changes, which is what a re-opened "edit X" dialog
needs (see `admin.tsx`'s `editControl`, synced to `editing`). `defaultValues` only seeds the form
once, at mount.
