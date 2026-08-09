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
