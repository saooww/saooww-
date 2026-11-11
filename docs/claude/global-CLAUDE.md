# Shared standards (copy to ~/.claude/CLAUDE.md on your computer)

Language with the owner: Russian, short, plain.

- Inspect before deciding: read the project's CLAUDE.md, package/project files and tests first; never assume the stack.
- Architecture: pure logic separate from UI and storage; one source of truth per number; small focused modules.
- Types: TypeScript strict (or the native language's strict mode); no `any` in new code; exhaustive switches.
- UI: follow the project's design system and existing components; touch targets ≥ 44 px, contrast ≥ 4.5:1, labels on icon buttons, respect reduced motion.
- Tests: add the smallest test that proves the change; run typecheck, unit tests, build and the relevant end-to-end flow before calling it done.
- Security: no secrets in code, logs or commits; validate input at the boundary; least-privilege permissions.
- Git: check `git status` and make a checkpoint before large or risky changes; small commits with clear messages; never force-push or rewrite shared history.
- Data: never fabricate or silently change user data; destructive steps need a backup and the owner's approval.
- Tokens: targeted searches over whole-repo reads; no parallel agents unless asked; Sonnet for routine edits, Opus for architecture and hard reasoning.
- Report: what changed · what was actually run · what is unverified · next step.

Project-specific rules live in each repo's CLAUDE.md and .claude/skills — finance rules only in app repos, game rules only in game repos.
