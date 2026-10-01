---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
argument-hint: "[feature description | path/to/*.prd.md]"
---

# Plan Command

This command creates a comprehensive implementation plan before writing any code. It accepts either free-form requirements or a PRD markdown file.

Run inline by default. Do not call the Task tool or any subagent by default. This keeps `/plan` usable from plugin installs that ship commands without agent files.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/plan` when:
- Starting a new feature
- Making significant architectural changes
- Working on complex refactoring
- Multiple files/components will be affected
- Requirements are unclear or ambiguous

## How It Works

The assistant will:

1. **Analyze the request** and restate requirements in clear terms
2. **Ground the plan** in relevant codebase patterns when the repo is available
3. **Break down into phases** with specific, actionable steps
4. **Identify dependencies** between components
5. **Assess risks** and potential blockers
6. **Estimate complexity** (High/Medium/Low)
7. **Present the plan** and WAIT for your explicit confirmation

## Input Modes

| Input | Mode | Behavior |
|---|---|---|
| `path/to/name.prd.md` | PRD artifact mode | Read the PRD, pick the next pending delivery milestone or implementation phase, and write `.claude/plans/{name}.plan.md` |
| Any other markdown path | Reference mode | Read the file as context and produce an inline plan |
| Free-form text | Conversational mode | Produce an inline plan |
| Empty input | Clarification mode | Ask what should be planned |

In PRD artifact mode, create `.claude/plans/` if needed. If the PRD contains a `Delivery Milestones` table, update only the selected row from `pending` to `in-progress` and set its `Plan` cell to the generated plan path. If the PRD uses the legacy `.claude/PRPs/prds/` format with `Implementation Phases`, read it without migrating paths.

## Pattern Grounding

Before writing the plan, search the codebase for conventions the implementation should mirror. Capture the top example for each relevant category with file references:

| Category | What to capture |
|---|---|
| Naming | File, function, type, command, or script naming in the affected area |
| Error handling | How failures are raised, returned, logged, or handled gracefully |
| Logging | Levels, format, and what gets logged |
| Data access | Repository, service, query, or filesystem patterns; for API shapes check `docs/api/README.md` (see `/openapi-docs`) before reading route code |
| Tests | Test file location, framework, fixtures, and assertion style |

If no similar code exists, state that explicitly. Do not invent a pattern.

## Flag Backend Shortcuts Before Planning a Frontend Workaround

While grounding the plan, watch for cases where the natural frontend implementation
would require a workaround — duplicated logic, an extra API call/query, client-side
orchestration of multiple endpoints, or polling — to compensate for a response shape
the API doesn't currently provide. If a different response on an existing endpoint,
or a small new endpoint, would let the frontend do this cleanly instead, **say so
before finalizing the plan**: name the workaround, name the API-side alternative,
and let the user decide whether to wait on a backend change or proceed with the
workaround. Don't silently plan around an API gap and don't build the workaround by
default — surfacing the gap is not optional, it's part of grounding the plan.

## PRD Artifact Output

When called with a `.prd.md` file, write the plan to `.claude/plans/{kebab-case-name}.plan.md` using this structure:

````markdown
# Plan: {Feature Name}

**Source PRD**: {path}
**Selected Milestone**: {milestone or phase name}
**Complexity**: {Small | Medium | Large}

## Summary
{2-3 sentences}

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Naming | `path:line` | {short description} |
| Errors | `path:line` | {short description} |
| Tests | `path:line` | {short description} |

## Files to Change
| File | Action | Why |
|---|---|---|
| `path` | CREATE / UPDATE / DELETE | {reason} |

## Tasks
### Task 1: {name}
- **Action**: {what to do}
- **Mirror**: {pattern to follow}
- **Validate**: {command that proves correctness}

## Validation
```bash
{project-specific validation commands}
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|

## Acceptance
- [ ] All tasks complete
- [ ] Validation passes
- [ ] Patterns mirrored, not reinvented
````

After writing the artifact, report its path and WAIT for confirmation before writing code.

> **Visual review:** instead of asking for a typed confirmation, you can open the
> artifact in the browser Plan Canvas (`/plan-canvas`, or the `plan-canvas` skill):
> the user annotates the plan in place and clicks **Approve plan** or **Request
> changes**, which arrives as your confirmation signal.

## Example Usage

```
User: /plan I need an "avise-me quando chegar" (RF-VIT-09) for out-of-stock SKUs

Assistant:
# Implementation Plan: Back-in-Stock Notification

## Requirements Restatement
- Customer subscribes to a SKU that has no available stock (guest or logged in)
- When the SKU's available stock goes from 0 to > 0, subscribers get an e-mail once
- Subscription is per SKU (never per product) and idempotent per (sku, e-mail)

## Implementation Phases

### Phase 1: Database Schema (packages/db)
- Add `stock_alert_subscription` table: `stock_alert_subscription_id` (UUID v7, `@db.Uuid`),
  `sku_id`, `email`, `notified_at` (nullable), `created_at`
- Unique index on (`sku_id`, `email`); index on `sku_id`
- Versioned Prisma migration (never edit an applied one)

### Phase 2: API module (apps/api/src/modules/stock-alert)
- Zod request/response schemas in `packages/shared`
- `POST /api/stock-alerts` (rate limited), conflict-safe insert
- Enqueue a BullMQ job when a stock movement makes available > 0

### Phase 3: Worker and e-mail
- Job loads pending subscriptions for the SKU, sends the e-mail, sets `notified_at`
- Retry with backoff; the job must be idempotent

### Phase 4: Storefront (apps/web, store mode)
- Form on the product page with RHF + `Controller` + `FieldInput`
- Call the API over HTTP via React Query mutation (web never touches the DB)

## Dependencies
- M03 Estoque (movements), M13 Comunicação (transactional e-mail), Redis/BullMQ

## Risks
- HIGH: duplicate e-mails if the job is not idempotent
- MEDIUM: e-mail deliverability (SPF/DKIM/DMARC)
- LOW: spam on the public endpoint (rate limit + Zod validation)

## Estimated Complexity: MEDIUM

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
```

## Important Notes

**CRITICAL**: This command will **NOT** write any code until you explicitly confirm the plan with "yes" or "proceed" or similar affirmative response.

If you want changes, respond with:
- "modify: [your changes]"
- "different approach: [alternative]"
- "skip phase 2 and do phase 3 first"

## Integration with Other Commands

After planning:
- Use `/plan-canvas` to run the confirmation gate visually in the browser (annotate + approve)
- Use the `tdd-workflow` skill to implement with test-driven development
- Use `/build-fix` if build errors occur
- Use `/code-review` to review completed implementation
- Use `/pr` or `/prp-pr` to open a pull request

> **Need requirements first?** Use `/plan-prd` for a lean PRD at `.claude/prds/{name}.prd.md`.
>
> **Need the legacy PRP flow?** Use `/prp-plan` for deep PRP planning with `.claude/PRPs/` artifacts. Use `/prp-implement` to execute those plans with rigorous validation loops.

## Optional Planner Agent

ECC also provides a `planner` agent for manual installs that include agent files. Use it only when the local runtime already exposes that subagent and the user explicitly asks you to delegate planning.

If the `planner` subagent is unavailable, continue planning inline instead of surfacing an "Agent type 'planner' not found" error.

For manual installs, the source file lives at:
`agents/planner.md`
