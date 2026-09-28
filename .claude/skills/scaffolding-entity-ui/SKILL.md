---
name: scaffolding-entity-ui
description: Use when creating a new entity CRUD screen under components/<entity>/, or adding a new table, form, dialog, or row action to an existing entity (e.g. users, roles, squads, agents). Covers UI composition only — for the data layer (queries/mutations/API), see scaffolding-api-service.
---

# Scaffolding a `components/<entity>` CRUD UI

## Overview

Every entity folder under `components/<entity>/` (reference: `components/users/`, `components/roles/` — canonical per `CLAUDE.md`) follows the same flat anatomy: one real table component (not a columns-hook fed into a generic builder), one row-actions component (dropdown + inline confirm, not a generic actions-menu abstraction), and a form split into a dialog wrapper + a reusable RHF form component. No subfolders (`components/<entity>/form/`, `.../modal/`) — everything sits flat in `components/<entity>/`, matching the rest of this codebase.

**Two things this skill deliberately does NOT do, on purpose (decided when adopting this pattern in this project):**

1. **No columns-hook + generic `<TableBuilder>`.** Some reference projects define `use<Entity>Columns()` returning `ColumnDef[]` fed into a shared generic table renderer. This project writes the table's JSX directly in `<entity>-table.tsx` (real `<Table>`/`<TableRow>`/`<TableCell>` markup, per-column, see `components/users/users-table.tsx`) and reuses it wherever needed by importing that component — not by threading column configs through a generic builder.
2. **No generic `RowAction`/`ActionsMenu`/`ActionConfig` abstraction.** Each entity gets its own `<entity>-row-actions.tsx` (dropdown menu + inline `AlertDialog` for destructive confirms), following `components/users/user-row-actions.tsx` directly — not a shared config-driven actions-menu component.

**Reference implementation to reread when in doubt:** `components/users/` (`users-table.tsx`, `user-row-actions.tsx`, `user-form-dialog.tsx`).

**Note:** this skill covers UI composition only. Server data (queries/mutations against the GUARD API) is a separate concern — see the `scaffolding-api-service` skill.

## Naming Convention

Every file in `components/<entity>/` follows `<entity>-<kind>[-<modifier>].tsx` — the segment **right after `<entity>`** always names WHAT the component is (its kind: table, form, dialog, detail...), never a modifier or an implementation detail. Someone reading `ls components/<entity>/` should be able to tell each file's category without opening it — don't bury the kind after a modifier (`<entity>-<modifier>-<kind>.tsx` is backwards).

| Kind | File | Component | Notes |
|---|---|---|---|
| `table` | `<entity>-table.tsx` | `<Entity>Table` | The list screen's table |
| `row-actions` | `<entity>-row-actions.tsx` | `<Entity>RowActions` | Dropdown + inline delete confirm |
| `form` | `<entity>-form.tsx` | `<Entity>Form` | Fields only, no dialog chrome (see below) |
| `form-dialog` | `<entity>-form-dialog.tsx` | `<Entity>FormDialog` | Owns submission; **the one file covers both create AND edit** — mode is the `entity`/`base`/`squad` prop being `null` vs. set, not a separate file |
| `detail` (page, multi-file) | `<entity>-detail-<section>.tsx` | `<Entity>Detail<Section>` | A full detail PAGE is split one file per section — `<section>` names the section (`base-detail-header.tsx`, `base-detail-squads.tsx`, `base-detail-map.tsx`...), never a single catch-all `<entity>-detail.tsx` |
| `detail` (dialog, single-file) | `<entity>-detail-dialog.tsx` | `<Entity>DetailDialog` | A read-only detail view shown as a modal instead of a full page (`product-detail-dialog.tsx`, `vehicle-detail-dialog.tsx`) — use this instead of the multi-file page split when the entity doesn't warrant its own route |

**"Edit" is not its own kind in this project — check before assuming otherwise.** Grepped the whole codebase confirming it: no `*-edit*.tsx` file and no `edit` route exist anywhere. Every entity edits through the SAME `<entity>-form-dialog.tsx` used for creation. If a future entity genuinely needs a standalone edit surface (e.g. a full-page edit instead of a dialog), name it `<entity>-edit-form.tsx` (or `app/painel/<entity>/[id]/edit/page.tsx`) and update this note when it happens — don't invent it speculatively ahead of a real need.

**`form-dialog` is a fixed, existing compound token — don't reorder it to `dialog-form`.** It reads as "form" (the more specific qualifier) + "dialog" (the shape), matching every single existing file in this codebase (`user-form-dialog.tsx`, `role-form-dialog.tsx`, `product-form-dialog.tsx`, dozens more) and the canonical CRUD table in `CLAUDE.md` itself. Renaming this compound would mean touching every entity in the app for a cosmetic reorder — not worth it, and not what "kind right after entity" is asking for here (the KIND *is* "form-dialog" as one word, same as "row-actions" is one word, not two separately-ordered segments).

## When to Use

- Creating a brand-new `components/<entity>/` folder for a CRUD screen
- Adding/editing a table, row-actions dropdown, or form dialog for an existing entity
- Extracting a form into its own reusable file

## File Anatomy

```
components/<entity>/
  <entity>-table.tsx           # real table JSX + usePaginatedList — see scaffolding-api-service for the data layer
  <entity>-row-actions.tsx     # dropdown menu + inline AlertDialog for destructive actions
  <entity>-form.tsx            # RHF fields only — Zod schema + useFormContext(), reusable, no dialog chrome
  <entity>-form-dialog.tsx     # owns useForm/zodResolver/FormProvider/submit; mode = presence of `entity` prop
  <entity>-detail-<section>.tsx  # only if the entity has a full detail PAGE — one file per section, see Naming Convention below
app/painel/<route>/page.tsx    # header + <EntityTable /> inside `flex-1 overflow-auto p-6`
app/painel/<route>/[id]/page.tsx  # only if the entity has a full detail PAGE — composes the <entity>-detail-<section>.tsx files
```

No `index.ts` barrels — this project imports each file by its direct path (`@/components/users/users-table`), not through a folder barrel. Don't add one unless asked.

## Table: `<entity>-table.tsx`

```tsx
"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { usePaginatedList } from "@/hooks/use-paginated-list"
import { SortableHead, StatusBadge } from "@/components/data-table/data-table-primitives"
import { DataTablePagination, DataTableToolbar } from "@/components/data-table/data-table-controls"
import { SquadRowActions } from "./squad-row-actions"
import { SquadFormDialog } from "./squad-form-dialog"
import type { SquadListItem, SquadOrderField } from "@/lib/types"

export function SquadsTable() {
  const list = usePaginatedList<SquadListItem, SquadOrderField>({
    endpoint: "/squad/paginate",
    initialOrderField: "name",
    errorMessage: "Erro ao carregar equipes.",
  })

  // ...dialogOpen/editing local state (see components/users/users-table.tsx), open/close handlers

  return (
    <div className="flex flex-col gap-4">
      <DataTableToolbar
        searchValue={list.searchInput}
        onSearchChange={list.setSearchInput}
        onCreate={() => {/* openCreate() */}}
        createLabel="Nova equipe"
        onRefresh={() => list.mutate()}
        refreshing={list.isValidating}
      />
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>{/* SortableHead per column, always ending in a header-only "Ações" column */}</TableHeader>
          <TableBody>
            {list.isLoading ? null /* skeleton rows, see users-table.tsx */
             : list.rows.length === 0 ? null /* empty state row */
             : list.rows.map((row) => (
                <TableRow key={row.id}>
                  {/* one TableCell per column */}
                  <TableCell className="text-right">
                    <SquadRowActions squad={row} onEdit={/* openEdit */} onChanged={() => list.mutate()} />
                  </TableCell>
                </TableRow>
               ))}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination {...list} disabled={list.isLoading} />
      <SquadFormDialog open={/* dialogOpen */} onOpenChange={/* ... */} entity={/* editing */} onSaved={() => list.mutate()} />
    </div>
  )
}
```

This is not boilerplate to copy blindly — read `components/users/users-table.tsx` in full and mirror its actual structure (skeleton rows, error row, empty row) for the new entity.

## Row Actions: `<entity>-row-actions.tsx`

Copy the shape of `components/users/user-row-actions.tsx` directly: dropdown (`DropdownMenu`/`DropdownMenuTrigger` styled via `buttonVariants`, never a nested `<Button>` — see `CLAUDE.md`'s Base UI note) with "Editar"/"Excluir", plus an inline `AlertDialog` owning its own `confirmOpen`/`deleting` local state:

```tsx
async function handleDelete() {
  setDeleting(true)
  try {
    await deleteSquad(squad.id) // from services/squads/mutations — see scaffolding-api-service
    toast.success("Equipe excluída com sucesso.")
    setConfirmOpen(false)
    onChanged()
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) { expireSession(); return }
    if (err instanceof ApiError && err.status === 409) {
      toast.error("Esta equipe não pode ser excluída porque possui vínculos no sistema.")
      setConfirmOpen(false)
      return
    }
    toast.error((err as ApiError)?.message || "Não foi possível excluir a equipe.")
  } finally {
    setDeleting(false)
  }
}
```

`AlertDialogAction`'s `onClick` always calls `e.preventDefault()` before the async handler (Radix/Base UI closes the dialog on click otherwise, before the request even finishes) — and shows a `Loader2` spinner while `deleting`/`isMutating` is true.

## Form: Zod + React Hook Form, split across two files

**Adopted in this project from this point forward** (not previously used here — `zod`, `react-hook-form`, `@hookform/resolvers` are now installed). New forms use this pattern; existing `useState`-per-field forms (e.g. `components/users/user-form-dialog.tsx` as it stands today) migrate opportunistically when touched for other reasons, not as a standalone sweep.

**Why split into two files:** the dialog owns submission or, when the entity should be creatable/editable from more than one place (a table dialog and, say, an inline panel), the same `<entity>-form.tsx` mounts in both without duplicating field JSX.

### `<entity>-form.tsx` — fields only, no dialog chrome

```tsx
"use client"

import { useFormContext } from "react-hook-form"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError } from "@/components/ui/form-section"

export const SquadFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  squad_type_id: z.coerce.number({ error: "Selecione o tipo de equipe" }),
})

export type SquadFormValues = z.infer<typeof SquadFormSchema>

export function SquadForm() {
  const { register, formState: { errors } } = useFormContext<SquadFormValues>()

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Nome</Label>
        <Input id="name" {...register("name")} />
        {errors.name && <FieldError>{errors.name.message}</FieldError>}
      </div>
      {/* selects go through SimpleSearchSelect/<Entity>SearchSelect via Controller — see below */}
    </div>
  )
}
```

- The Zod schema lives **inline at the top of the form file** (matches this codebase's principle of colocating what's only used in one place) — unless the entity already has a Payload schema in `services/<domain>/models.ts` (see `scaffolding-api-service`) whose shape is genuinely identical to what this form collects, in which case import and reuse that one instead of declaring a second copy. Don't force the reuse if the form collects a subset or a differently-shaped payload than the raw API expects — a real mismatch here is worse than a small duplication.
- Every field with a validation message renders `<FieldError>` from `components/ui/form-section.tsx` under it — same primitive already used across the app.
- **Never call `<Select>` from `components/ui/select.tsx`** inside a form field — per `CLAUDE.md`, always the search-select pattern (`SimpleSearchSelect`/`<Entity>SearchSelect`). Since those aren't native `<input>` elements, wire them through RHF's `Controller` (or `useController`), not `register()`:

```tsx
import { Controller, useFormContext } from "react-hook-form"
import { SimpleSearchSelect } from "@/components/shared/simple-search-select"

const { control } = useFormContext<SquadFormValues>()

<Controller
  control={control}
  name="squad_type_id"
  render={({ field, fieldState }) => (
    <>
      <SimpleSearchSelect
        value={String(field.value ?? "")}
        options={SQUAD_TYPE_OPTIONS}
        onChange={(v) => field.onChange(Number(v))}
        placeholder="Tipo de equipe"
      />
      {fieldState.error && <FieldError>{fieldState.error.message}</FieldError>}
    </>
  )}
/>
```

- **Never read a field with `useFormContext().watch("field")` during render** to drive conditional JSX — it re-subscribes the whole component to every form change. Use `useWatch({ control, name: "field" })` instead. `watch("field")` is fine only for one-off reads inside an event handler, not during render.

### `<entity>-form-dialog.tsx` — owns submission, mode = presence of `entity` prop

```tsx
"use client"

import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError } from "@/lib/api-client"
import { useAuth } from "@/components/providers/auth-provider"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SquadForm, SquadFormSchema, type SquadFormValues } from "./squad-form"
import { createSquad, updateSquad } from "@/services/squads/mutations"
import type { SquadListItem } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  entity: SquadListItem | null
  onSaved: () => void
}

export function SquadFormDialog({ open, onOpenChange, entity, onSaved }: Props) {
  const { expireSession } = useAuth()
  const isEdit = !!entity

  const methods = useForm<SquadFormValues>({
    resolver: zodResolver(SquadFormSchema),
    values: entity ? { name: entity.name, squad_type_id: entity.squad_type_id } : undefined,
  })

  async function onSubmit(values: SquadFormValues) {
    try {
      if (isEdit) await updateSquad(entity.id, values)
      else await createSquad(values)
      toast.success(isEdit ? "Equipe atualizada com sucesso." : "Equipe criada com sucesso.")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { expireSession(); return }
      if (err instanceof ApiError && err.status === 422) {
        const validator = (err.payload as { validator?: Record<string, string[]> })?.validator ?? {}
        for (const [field, messages] of Object.entries(validator)) {
          methods.setError(field as keyof SquadFormValues, { message: messages[0] })
        }
        return
      }
      toast.error((err as ApiError)?.message || "Não foi possível salvar a equipe.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEdit ? "Editar equipe" : "Nova equipe"}</DialogTitle></DialogHeader>
        <FormProvider {...methods}>
          <form id="squad-form" onSubmit={methods.handleSubmit(onSubmit)}>
            <SquadForm />
          </form>
        </FormProvider>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button form="squad-form" type="submit" disabled={methods.formState.isSubmitting}>
            {methods.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- **422 handling maps `payload.validator` straight into `methods.setError`** — this is the one non-obvious integration point between this project's existing error contract (`CLAUDE.md`, "Standard error handling": `422 → validation errors in payload.validator`) and RHF. Every form-dialog needs this branch; don't drop it and fall through to a generic toast for validation errors.
- `values: entity ? {...} : undefined` (not `defaultValues`) so the form re-syncs when `entity` changes across open/close cycles without needing a `key` remount — RHF's documented way to keep a form in sync with async/prop-driven data.
- Dialog open/close state stays local `useState` in the parent table (`dialogOpen`/`editing`, as `users-table.tsx` already does) — this project does not use the URL-search-param-driven modal pattern some reference projects use for deep-linking. Don't introduce that here unless asked.

## Quick Reference

| Concern | Convention |
|---|---|
| File naming | `<entity>-<kind>[-<modifier>].tsx` — kind (table/form/form-dialog/detail) always right after `<entity>`, see Naming Convention above |
| Table | Real JSX in `<entity>-table.tsx`, no columns-hook / generic builder |
| Row actions | `<entity>-row-actions.tsx`, dropdown + inline `AlertDialog`, no generic actions-menu abstraction |
| Form validation | Zod schema inline in `<entity>-form.tsx`, `zodResolver` in the dialog |
| Form fields file | `<entity>-form.tsx` — `useFormContext()`, no dialog chrome, reusable |
| Form dialog file | `<entity>-form-dialog.tsx` — owns `useForm`/`FormProvider`/submit, mode = `entity` prop presence |
| Select fields | `Controller` + `SimpleSearchSelect`/`<Entity>SearchSelect`, never native `<Select>` |
| 422 errors | `methods.setError(field, { message })` from `payload.validator` |
| 401 errors | `expireSession()` |
| 409 errors | toast "possui vínculos", stop |
| Dialog open state | Local `useState` in the table component, not URL search params |
| Barrels | None — direct file imports |

## Common Mistakes

- Building a `use<Entity>Columns()` hook + generic table builder instead of a real `<entity>-table.tsx`.
- Building a generic `ActionsMenu`/`ActionConfig` abstraction instead of a per-entity `<entity>-row-actions.tsx`.
- Putting form fields directly inside `<entity>-form-dialog.tsx` instead of a separate `<entity>-form.tsx` — makes the form impossible to reuse outside that one dialog.
- Using `register()` on a `SimpleSearchSelect`/custom select component — it's not a native input; use `Controller`.
- Reading a watched field with `watch("field")` during render instead of `useWatch({ control, name })`.
- Dropping the 422 → `setError` mapping and just toasting a generic error message for validation failures.
- Using `components/ui/select.tsx`'s native `<Select>` anywhere in a new form field — always the search-select pattern.
- Naming a file `<entity>-<modifier>-<kind>.tsx` (kind buried at the end) instead of `<entity>-<kind>-<modifier>.tsx` (kind right after entity) — see Naming Convention above.
- Inventing a separate `<entity>-edit-*.tsx` file — this project has none; edit always reuses `<entity>-form-dialog.tsx`.
- Adding a folder barrel (`index.ts`) or nested `form/`/`modal/` subfolders — this project keeps `components/<entity>/` flat.

## Related Skills

- **`scaffolding-api-service`** — the data layer (`services/<domain>/`) this skill's dialogs and row-actions consume.
