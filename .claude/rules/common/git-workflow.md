# Git Workflow

## Commit Message Format

**Always Conventional Commits, always with a scope, always in English** — regardless of what language the conversation with the user is in.

```
<type>(<scope>): <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

Scope = the directory/module the change lives in (e.g. `api`, `web`, `db`, `shared`, `auth`, `catalog`, `stock`) — never omit it, even for a one-file change. Description and body are always English, even though this project's UI/comments/commit conversations are in Portuguese.


## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](development-workflow.md).
