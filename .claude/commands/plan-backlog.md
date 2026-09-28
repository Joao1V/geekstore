---
description: Capture a lightweight backlog of several features/ideas in one planning doc — much less detail than /plan, meant to ground a future implementation session, not gate one.
argument-hint: "[topic name | free-form list of features]"
---

# Plan Backlog Command

Captures **several** feature ideas as a single lightweight planning doc under `docs/planning/`. This is not `/plan` — no task-by-task breakdown, no risk tables, no complexity estimates, no confirmation gate. It's the doc you write when someone dictates a batch of things ("here are 6 things we need eventually") and just needs them documented well enough that whoever picks each one up later doesn't start from zero.

Do not write or edit any application code from this command. Output is documentation only.

## When to Use

- The user lists multiple features/ideas in one go (numbered list, prose backlog dump, voice-to-text stream of thought)
- None of them are being implemented right now — this is capture, not execution
- `/plan` would be overkill: too much ceremony for something nobody is about to build this session

If the user only has **one** feature and wants to start building it now, use `/plan` instead.

## How It Works

1. **Collect items.** Take them from the user's message as given. If the input is empty, ask what should be captured — don't invent items.
2. **Ground each item lightly.** Not a full `search-first` pass — just enough that the doc saves real time later:
   - Find the actual files/components involved (grep/glob — never guess a path)
   - Check `docs/api/README.md` first for whether the API already supports it (param, field, endpoint). State plainly whether it's already there or would need backend work.
   - Note one existing pattern in the codebase to mirror, if one exists — this is the single highest-value thing to capture. If nothing similar exists, say so; don't invent a pattern.
   - If something is genuinely undecided (a UX call, a business rule not yet settled), mark it `⚠️ A definir` rather than guessing an answer.
3. **Write each item** using the template below. Skip anything from `/plan`'s output (phases, risk tables, complexity/time estimates, acceptance checklists) — that level of detail belongs to the session that actually implements the item.
4. **Save** as `docs/planning/{kebab-case-topic}.md`. Group related items into one file per topic/session — don't create a file per individual feature.
5. **Update `docs/planning/README.md`** — add or update the one-line index row for the new file (mirror the existing rows' style).
6. Report the file path. Do not proceed to implement anything unless separately asked.

## Output Template

````markdown
# {Topic} — Backlog

{1-2 sentence framing: what area this covers}

---

## 1. {Feature title}

{1-2 sentence objective — what and why}

**Onde mexer:**
- `path/to/file.tsx` — {what changes here, one line}

**Já existe / confirmado:** {API support with a cite into docs/api/<x>.md, existing type, existing param — or "backend ainda não suporta X, precisa de Y"}

**Padrão a seguir:** {existing component/file to mirror, with path — omit this line if nothing comparable exists}

**Em aberto:** {only include this line if there's a real open question}

---

## 2. {Next feature title}
...
````

## Example Usage

```
User: /plan-backlog quero anotar umas ideias pro board: 1) permitir arquivar
lane sem excluir, 2) exportar leads da lane pra CSV, 3) atalho de teclado
pra mover card pra próxima lane

Assistant:
[greps components/boards/, checks docs/api/pipeline-lane.md for an archive/
export-capable endpoint, checks docs/api/lead.md for CSV export support]

Escrevi docs/planning/board-lane-improvements.md com os 3 itens. Resumo:
- Item 1 (arquivar lane): API não tem esse conceito ainda (só delete) —
  marcado como dependente de backend.
- Item 2 (export CSV): não existe endpoint de export; dá pra montar client-side
  a partir do /lead/paginate existente, sem precisar de backend novo.
- Item 3 (atalho de teclado): puramente frontend, dá pra seguir o padrão de
  onKeyDown já usado em components/boards/lane-column.tsx.
```

## After This Command

Nothing is implemented — items sit in `docs/planning/{file}.md` until explicitly requested (by number or by name), same as any other doc. When an item does get implemented later:
- Check `docs/api/README.md` before assuming a payload/endpoint shape (per `CLAUDE.md`)
- Run `/code-review` before committing — mandatory per `rules/common/code-review.md`, not optional

## Rules

- Never invent an endpoint, param, or field. If the API doesn't support something yet, say so plainly — that item belongs conceptually with the backend-dependent items, not written as if it already works.
- One doc per topic/session grouping related items, not one doc per feature.
- Keep it scannable — a different session, reading only one item, should know exactly where to start without re-reading the whole codebase.
