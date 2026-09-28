---
name: form-fields
description: Use whenever a new form is added anywhere in apps/web (store or admin), or an existing form is touched. Every form must use react-hook-form with each field wrapped in <Controller>, through the shared Field component in components/ui.tsx — never a bare <form onSubmit> reading FormData, and never a field that manually re-derives isInvalid/errorMessage from parallel useState.
---

# Forms: react-hook-form + Controller, always

## Rule (no exceptions)

Every form in `apps/web` — store or admin, connected to a real API or still a local demo —
is built with react-hook-form's `useForm()`, and every individual field is wired through
`<Controller>`, never through `register()` + a plain HTML `<input>`. This project's inputs are
HeroUI v3 components built on `react-aria-components` (`TextField`/`Input`/`Label`), which don't
forward a plain DOM ref the way `register()` expects — `Controller`'s `field.ref`/`field.onChange`
render-prop is what actually works with them, not a project style preference.

**Why this matters enough to be a hard rule:** without it, every form re-invents the same few
lines — a `useState` for the error message, a manual `if (error) <p className="error">` block,
red-border CSS applied by hand per field. That duplication is exactly what the shared `Field`
component below exists to kill. A new form that skips `Field`/`Controller` reintroduces it.

## The shared `Field` component

`apps/web/components/ui.tsx` exports `Field` — the only text-input component forms should use.
It keeps a flat, HeroUI-v2-like prop surface on the outside (`label`, `description`, plus
whatever HTML attributes the input needs) while doing the compound-component wiring and the
error/description slotting internally:

```tsx
<Field
  control={control}          // from useForm()
  name="email"                // must be a key of your form's values type
  label="E-mail"
  description="Usamos só para confirmar o pedido"  // optional, hidden automatically when there's an error
  type="email"                 // 'text' | 'email' | 'password' | 'tel', default 'text'
  autoComplete="off"
/>
```

Internally it wraps HeroUI's `TextField`/`Label`/`Input`/`Description`/`FieldError` in a
`Controller` render prop, sets `isInvalid={fieldState.invalid}` on the `TextField`, and renders
`fieldState.error?.message` through `FieldError` — the caller never passes `isInvalid` or
`errorMessage` itself; it's always derived. Don't add those as props to `Field` — if a call site
needs to force an error, do it through react-hook-form (`setError(name, { message })`), not a
prop on `Field`.

`Field`'s `type` union only covers text-like inputs (`text`/`email`/`password`/`tel`). Don't
stretch it to fit numeric/date/checkbox inputs — see "Fields `Field` doesn't cover" below.

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
    <Field control={control} name="email" label="E-mail" type="email" />
  ```
  Any form whose shape already has (or should get) a Zod schema in `packages/shared` follows
  this pattern — resolver + shared schema, not hand-rolled validation.

- **`apps/web/modules/store/checkout.tsx`** and **`apps/web/modules/store/account.tsx`** — forms
  with no backend yet (demo/preview screens). Still `useForm()` + `Controller`-based `Field`,
  just without a `resolver` — there's no schema to validate against yet. When these get wired to
  a real endpoint, add the matching Zod schema to `packages/shared` and pass it as a resolver,
  mirroring admin-login.

- **`apps/web/modules/admin/admin.tsx`** (banner form) — a second `useForm()`/`control` pair
  living in the same component as another form (the product-edit dialog) — proof that a
  component with two independent forms just calls `useForm()` twice and destructures each
  hook's `control`/`handleSubmit` under different local names (`bannerControl`/`editControl`),
  rather than trying to share one `useForm()` across unrelated field sets.

## Fields `Field` doesn't cover

Numeric inputs, checkboxes, radios, file inputs, or anything else outside `Field`'s text-like
`type` union: wrap the raw HeroUI/native control in `<Controller>` directly, same as
`apps/web/modules/admin/admin.tsx`'s product-edit dialog (price/stock as `type="number"`):

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

Don't broaden `Field`'s prop surface to fake-support a numeric type just to avoid writing this —
extract a dedicated `NumberField` (or similar) into `components/ui.tsx` once a second real numeric
form shows up, following YAGNI (`rules/common/coding-style.md`). One inline `Controller` doesn't
justify a new shared component yet.

When a raw `<input>` sits inside a `<label>` via a `Controller` render prop, Biome's
`lint/a11y/noLabelWithoutControl` can't see through the render-prop indirection — give the input
an explicit `id` and the `<label>` a matching `htmlFor` rather than relying on implicit nesting
(see the product-edit dialog in `admin.tsx` for the pattern).

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
