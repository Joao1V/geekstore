# Development Workflow

> This file extends [common/git-workflow.md](git-workflow.md) with the full feature development process that happens before git operations.

The Feature Implementation Workflow describes the development pipeline: research, planning, TDD, code review, and then committing to git.

## Feature Implementation Workflow

0. **Research & Reuse** _(mandatory before any new implementation)_
   - **GitHub code search first:** Run `gh search repos` and `gh search code` to find existing implementations, templates, and patterns before writing anything new.
   - **Library docs second:** Use Context7 (if connected) or primary vendor docs to confirm API behavior, package usage, and version-specific details before implementing.
   - **Web search only when the first two are insufficient:** broader research or discovery after GitHub search and primary docs.
   - **Check package registries:** Search npm, PyPI, crates.io, and other registries before writing utility code. Prefer battle-tested libraries over hand-rolled solutions.
   - **Search for adaptable implementations:** Look for open-source projects that solve 80%+ of the problem and can be forked, ported, or wrapped.
   - Prefer adopting or porting a proven approach over writing net-new code when it meets the requirement.
   - This overlaps with the `search-first` skill — treat this step as the project-specific version of it, not a separate pass.

1. **Plan First**
   - Run `/plan` to create the implementation plan (saved to `.claude/plans/`)
   - Identify dependencies and risks
   - Break down into phases
   - For larger features, capture architecture/design decisions inline in the plan doc itself rather than generating a separate PRD/architecture/tech_doc suite — keep it to one plan file unless the feature genuinely needs more

2. **Code Review**
   - Run `/code-review` immediately after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

3. **Commit & Push**
   - Detailed commit messages
   - Follow conventional commits format
   - See [git-workflow.md](git-workflow.md) for commit message format and PR process

4. **Pre-Review Checks**
   - Verify all automated checks (CI/CD) are passing
   - Resolve any merge conflicts
   - Ensure branch is up to date with target branch
   - Only request review after these checks pass
