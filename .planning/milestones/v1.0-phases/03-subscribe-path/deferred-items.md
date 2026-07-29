# Phase 3 — Deferred Items (Out of Scope)

Discovered during execution but explicitly out of scope for the current task per the
scope-boundary rule (only auto-fix issues directly caused by the current task's changes).

## 03-01-T1: Pre-existing lint failures in `apps/web/src/templates/terminal/components/TerminalConsole.tsx`

- **Found during:** Task 03-01-T1, running `npm run lint --workspace=apps/web`
- **Confirmed pre-existing:** Verified via `git stash -u` (removing all this session's changes)
  that `npm run lint --workspace=apps/web` already failed with the identical 15 errors / 4
  warnings before any file in this plan was touched.
- **Errors:** `react-hooks/immutability` (2x "accessed before it is declared" — `printLs`,
  `handleCommand`), `react/no-unescaped-entities` (6x unescaped `"` in JSX), plus warnings.
- **File:** `apps/web/src/templates/terminal/components/TerminalConsole.tsx` — belongs to the
  `terminal` template, not touched by this plan's file set (`03-01-PLAN.md` § files_modified).
- **Disposition:** NOT fixed — out of scope per the scope-boundary rule. Not caused by any
  change in this plan. Flagged here for whichever future phase/plan next touches the terminal
  template (plan `03-03` adds a terminal-variant subscribe form and will already be editing
  files in this directory tree, making it a natural point to fix this too, though `03-03`'s own
  scope is `templates/terminal/PostPage.tsx`, not `TerminalConsole.tsx`).
- **Verification workaround used in this plan:** `npx eslint` scoped to only the files this
  plan created/modified (`src/lib/email.ts`, `src/components/subscribe/SubscribeSection.tsx`,
  `src/components/subscribe/SubscribeForm.tsx`, `src/app/api/subscribe/route.ts`,
  `src/templates/default/Layout.tsx`) — zero errors, zero warnings. The full
  `npm run lint --workspace=apps/web` gate specified in `03-01-PLAN.md`'s `<verify>` block
  cannot pass as literally written until `TerminalConsole.tsx` is fixed, independent of this
  plan's correctness.
