---
phase: 08-content-rendering-fix
plan: 01
subsystem: content-rendering
tags: [notion-client, user-agent, cont-05, teardown, d-19]
dependency-graph:
  requires: [07-content-failure-isolation-live-diagnosis]
  provides: [NOLOG_USER_AGENT, isRecordMapEmpty, contentFetchFailed-prop]
  affects: [apps/web/src/lib/notion-x.ts, "apps/web/src/app/post/[id]/page.tsx", apps/web/src/templates/default/PostPage.tsx]
tech-stack:
  added: []
  patterns: ["module-level exported UPPER_SNAKE_CASE constant", "bracket-prefixed console.error(prefix, error) object-form logging"]
key-files:
  created: []
  modified:
    - apps/web/src/lib/notion-x.ts
    - "apps/web/src/app/post/[id]/page.tsx"
    - apps/web/src/templates/default/PostPage.tsx
  deleted:
    - apps/web/src/app/api/diagnose-page/route.ts
decisions:
  - "NOLOG_USER_AGENT shipped as \"NoLog (+https://github.com/4lph4-dvlp/NoLog)\" — no version token, hardcoded (no env var), matching D-01/D-02/D-03/D-04/D-05"
  - "RENDERABLE_BLOCK_MIN shipped as 2 (below-threshold = empty); boundary remains [ASSUMED] pending plan 08-02's live empty-page recalibration"
  - "Tracer's outbound loadPageChunk probe recorded SKIPPED_NO_UAT_PAGE_ID — no UAT_PAGE_ID env var available in this execution environment; not treated as a pass or a fail"
metrics:
  duration: "~35min"
  completed: 2026-08-09
status: complete
actuals:
  tokens: 4800
  tasks: 3
  commits: 4
---

# Phase 8 Plan 1: User-Agent Fix, D-19 Teardown, CONT-05 Split Summary

Fixed the root cause Phase 7 identified (Cloudflare 403 on notion-client's default `user-agent: node`) with a single hardcoded `NOLOG_USER_AGENT` header, deleted every Phase 7 diagnosis-only surface while preserving the three things that had to survive, and split the single "content could not be loaded" fallback sentence into two honest, distinct reader-facing states — all landed as unpushed commits on `main`, ready for plan 08-03's single deploy.

## What Shipped

**Task 1 — User-Agent fix (D-01/D-02/D-03/D-04/D-05/D-06).** Added `export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)"` to `apps/web/src/lib/notion-x.ts` and wired it through the existing `NotionAPI` constructor's `ofetchOptions.headers["User-Agent"]`. No version number, no env var, no other outbound path touched (`@notionhq/client` in `lib/notion.ts` is untouched, per D-06). Commit `622ba7d`.

**Task 2 — D-19 teardown.** Deleted `apps/web/src/app/api/diagnose-page/route.ts` in full, and deleted `describeFetchFailure()` plus its private helpers (`isFetchErrorShape`, `describePageIdShape`, `LOAD_PAGE_CHUNK_URL`, `BODY_EXCERPT_MAX_LENGTH`) and the now-orphaned `parsePageId` import from `lib/notion-x.ts`. Replaced both permanent-file call sites in `post/[id]/page.tsx` (lines 119, 142 pre-change) with plain `console.error(prefix, error)` calls, preserving the `[PostPage:recordMap]`/`[PostPage:chrome]` leg-name prefixes (CONT-01). `isDiagnosticsEnabled()`, its gate constant, and `apps/web/src/lib/post-availability.ts` are untouched (D-13). Commits `427f8a8` + `21f92e0` (see Deviations — split into two commits due to an execution mistake, no scope change).

**Task 3 — CONT-05 split.** Added exported `isRecordMapEmpty(recordMap)` to `lib/notion-x.ts`, backed by a named `RENDERABLE_BLOCK_MIN = 2` threshold. Threaded a new `contentFetchFailed` boolean from `post/[id]/page.tsx`'s content-leg catch to both `DefaultPostPage` call sites (never derived from `recordMap` truthiness). Replaced `templates/default/PostPage.tsx`'s single fallback `<p>` with a three-way branch: Notion renderer / "This post's content could not be loaded right now." / "This post has no content yet." — locked copy from `08-UI-SPEC.md`, same `text-text-secondary italic` class list, same `.notion-content-wrapper`, no new tokens. The `terminal` template is unmodified (confirmed by `git diff --exit-code`). Commit `002a08c`.

## Values Recorded (per plan's `<output>` spec)

- **`NOLOG_USER_AGENT`** shipped value: `NoLog (+https://github.com/4lph4-dvlp/NoLog)`.
- **`RENDERABLE_BLOCK_MIN`** shipped value: `2` (a recordMap with fewer than 2 block entries is judged empty). Its boundary is still `[ASSUMED]` (08-RESEARCH.md Finding 4, Assumption A1) — never observed against a genuinely content-empty public Notion page. Plan 08-02 closes this.
- **Tracer outbound probe (Task 1 `<verify>` second command):** printed `SKIPPED_NO_UAT_PAGE_ID` — no `UAT_PAGE_ID` env var was available in this execution environment. Recorded verbatim, not softened into a pass. The tracer's build/grep checks (first `<verify>` command) all passed.
- **Three commit SHAs** (plus one split-artifact commit, see Deviations): `622ba7d` (Task 1), `427f8a8` + `21f92e0` (Task 2), `002a08c` (Task 3).
- **`origin/main` has not moved.** `git status -sb` shows `main...origin/main [ahead 24]` (20 pre-existing ahead commits + 4 from this plan); `git log origin/main..HEAD` lists all of them, none pushed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - blocking issue, execution mistake] Task 2's first `git add` used an invalid pathspec, splitting the teardown into two commits**
- **Found during:** Task 2, staging step
- **Issue:** `git add apps/web/src/lib/notion-x.ts "apps/web/src/app/post/[id]/page.tsx" apps/web/src/app/api/diagnose-page` failed atomically (pathspec `apps/web/src/app/api/diagnose-page` no longer matched anything after `git rm`), so only the already-staged file deletion was committed (`427f8a8`); the two file edits remained unstaged.
- **Fix:** Staged and committed the remaining `notion-x.ts`/`page.tsx` changes in a immediate follow-up commit (`21f92e0`), explicitly labeled as completing the same task rather than new scope. No amend was used, per the git safety protocol (create new commits, don't amend).
- **Files affected:** `apps/web/src/lib/notion-x.ts`, `apps/web/src/app/post/[id]/page.tsx`.
- **Commits:** `427f8a8`, `21f92e0`.

**2. [Rule 2 - stale comment cleanup, in addition to the plan's named couplings] Removed a second stale comment referencing the deleted `allowProbe`/D-04 probe mechanism**
- **Found during:** Task 3, while re-reading the chrome-leg comment block in `post/[id]/page.tsx`
- **Issue:** Beyond the two stale references the plan explicitly named (the D-17 audit bullet and `notion-x.ts:22`'s route mention, both already handled in Task 2), the chrome-leg comment at line ~124-127 still said `` `allowProbe` is false ... so the D-04 probe's loadPageChunk target would describe the wrong request`` — describing a parameter and a probe mechanism that Task 2 had already deleted.
- **Fix:** Reworded the comment to describe the actual reason (separate outbound path via `@notionhq/client`) without referencing deleted code.
- **Files modified:** `apps/web/src/app/post/[id]/page.tsx`.
- **Commit:** `002a08c`.

No other deviations — the rest of the plan executed exactly as written.

### Auth Gates

None encountered.

## Known Stubs

None. Every branch in the new three-way content conditional resolves to either the Notion renderer or exactly one of the two locked sentences — no path returns `null`, an empty fragment, or placeholder text.

## Threat Flags

None. All source changes match the plan's `<threat_model>` exactly: `NOLOG_USER_AGENT` (T-08-01, accepted), the two hardcoded reader-facing sentences with zero interpolation (T-08-02, mitigated), the route deletion (T-08-03, mitigated). No new network endpoint, auth path, or schema surface was introduced.

## Self-Check: PASSED

- `apps/web/src/lib/notion-x.ts` — FOUND, modified as described.
- `apps/web/src/app/post/[id]/page.tsx` — FOUND, modified as described.
- `apps/web/src/templates/default/PostPage.tsx` — FOUND, modified as described.
- `apps/web/src/app/api/diagnose-page/route.ts` — MISSING (confirmed deleted, as intended).
- Commit `622ba7d` — FOUND in `git log --oneline --all`.
- Commit `427f8a8` — FOUND in `git log --oneline --all`.
- Commit `21f92e0` — FOUND in `git log --oneline --all`.
- Commit `002a08c` — FOUND in `git log --oneline --all`.
