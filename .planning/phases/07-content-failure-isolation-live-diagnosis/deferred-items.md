# Deferred Items — Phase 07 Plan 01

Out-of-scope discoveries logged per the executor's SCOPE BOUNDARY rule. Not fixed by this plan.

## `npm run lint --workspace=apps/web` fails on pre-existing, unrelated errors

`npm run lint --workspace=apps/web` reports 15 errors / 4 warnings, all inside
`apps/web/src/templates/terminal/components/TerminalConsole.tsx` (`react-hooks/immutability`
variable-before-declaration errors, `react/no-unescaped-entities` on literal quote characters).

Confirmed pre-existing and unrelated to this plan's changes:
- `git stash` verification: identical 15/4 error/warning count reproduces on unmodified `main`
  (commit `e485605`), before any file this plan touches was created or edited.
- `git log` on the file shows its last touch was the original monorepo-restructure commit
  (`c658c7d`), unrelated to this milestone.
- The `terminal` template is explicitly out of scope for milestone v1.1
  (`PROJECT.md`: "Target template is `default`... The `terminal` template is out of scope this
  milestone.").
- `apps/web/src/lib/notion-x.ts` and `apps/web/src/app/api/diagnose-page/route.ts` (this plan's
  files) produce zero lint errors/warnings, confirmed by grepping lint output for their paths.

This plan's task verification treats "lint clean" as "no new lint errors introduced by this
plan's files" rather than a literal repo-wide zero-error exit code, since the latter is blocked
by pre-existing debt this plan did not create and is not scoped to fix.

---

## RESOLVED 2026-08-14 (v1.1 milestone close)

**This item is closed and requires no decision at milestone close.** The lint debt described above
no longer exists: `npm run lint --prefix apps/web` exits `0` with zero errors and zero warnings, and
`git log` on the file shows commit `9d535a5` — *"fix(lint): clear the 14 pre-existing eslint errors
blocking the post-merge gate"* — explicitly cleared it. Every subsequent phase (8, 9, 10) has run
the same lint command green at every wave gate.

**Note on how this appeared in the close audit.** `audit-open` counted the four bullets above as
four separate unresolved deferred items. They are not four items — they are the four pieces of
evidence for one finding (a pre-existing, out-of-scope lint failure in the `terminal` template).
Recorded here so a future reader does not re-derive the same confusion from the audit output.
