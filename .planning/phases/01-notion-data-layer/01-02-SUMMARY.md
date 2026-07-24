---
phase: 01-notion-data-layer
plan: 02
subsystem: database
tags: [notion, typescript, bugfix, notion-api]

# Dependency graph
requires:
  - phase: 01-notion-data-layer (plan 01)
    provides: NologClient with getPosts(), getUnemailedPublicPosts(), markEmailed(), mapPageToPost()
provides:
  - Corrected Notion query-filter property key casing ("Status", not "status") in both getPosts() and getUnemailedPublicPosts()
  - Unblocked live-Notion mark-then-requery verification (verify-phase-1.ts) for workspaces using the documented canonical Status property name
affects: [phase-02, phase-03, phase-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notion database query filters must use the exact case-sensitive property name; the per-page extractor family (getSelect, getRichText, etc.) can fall back client-side to a legacy key, but server-side filters cannot"

key-files:
  created: []
  modified:
    - packages/core/src/client.ts

key-decisions:
  - "Fixed getPosts() alongside getUnemailedPublicPosts() in the same task, even though getPosts() is technically outside DATA-01's original REQ-ID scope, because both share the identical root-cause defect in the same file and leaving getPosts() broken would keep the site's primary read path non-functional for any canonical-schema forker (documented in-scope inclusion, not silent scope creep)"
  - "Left mapPageToPost()'s getSelect(page, \"Status\", \"status\") extractor unchanged — its lowercase fallback is a legitimate per-page client-side fallback, unlike the server-side query filters which have no fallback capability"
  - "Did not follow 01-RESEARCH.md Pattern 1 / 01-PATTERNS.md line 47 guidance to mirror lowercase \"status\" — that guidance is superseded by the 01-VERIFICATION.md CR-01 finding it was based on a misread of the pre-existing bug"

patterns-established: []

requirements-completed: [DATA-01]

coverage:
  - id: D1
    description: "Both getPosts() and getUnemailedPublicPosts() Notion query filters use the canonical property key \"Status\" (capital S), matching mapPageToPost()'s primary extractor key and types.ts's documented convention"
    requirement: DATA-01
    verification:
      - kind: other
        ref: "npm run build --workspace=@4lph4/nolog-core && grep -c 'property: \"Status\"' packages/core/src/client.ts (non-comment lines) == 2"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p apps/web/tsconfig.json"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live-Notion mark-then-requery behavioral proof (verify-phase-1.ts) reaches PASS without a query 400, against a workspace whose Status property uses the canonical capital name"
    requirement: DATA-01
    verification: []
    human_judgment: true
    rationale: "Requires live NOTION_TOKEN/NOTION_DATABASE_ID test credentials not present in this execution environment — same carried-forward gate as 01-01-PLAN.md; no way to run this automatically here"

# Metrics
duration: 15min
completed: 2026-07-25
status: complete
---

> ⚠ **CORRECTION (2026-07-25, post-hoc):** This summary's "Status" (capital) fix was itself a misdiagnosis — the live production database confirmed lowercase `status` was correct all along. Reverted in commit `588496d`; the `Emailed` property was also renamed to `emailed` in `a5eb42d`. See `01-VERIFICATION.md`'s `## CORRECTION` section for the full account. This body is left as originally written (historical record).

# Phase 01 Plan 02: Notion Status Filter Casing Fix (CR-01 Closure) Summary

**Corrected the Notion database query-filter property key from lowercase "status" to canonical "Status" in both getPosts() and getUnemailedPublicPosts(), closing CR-01 from 01-VERIFICATION.md**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-25T00:00:00Z (approx)
- **Completed:** 2026-07-25T00:15:00Z (approx)
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments
- `getPosts()`'s single-clause query filter now uses `property: "Status"` instead of `property: "status"`
- `getUnemailedPublicPosts()`'s compound-filter first clause now uses `property: "Status"` instead of `property: "status"`
- `mapPageToPost()`'s `getSelect(page, "Status", "status")` extractor at line 114, the `{ property: "Emailed", checkbox: { equals: false } }` clause, both `sorts` clauses, and every other method left byte-unchanged
- Package rebuilt clean (`npm run build --workspace=@4lph4/nolog-core`); `apps/web` typechecks clean (`npx tsc --noEmit`)
- Automated grep gate confirmed exactly 2 non-comment occurrences of `property: "Status"` in client.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Correct the Notion query-filter property key from lowercase "status" to canonical "Status" in both getPosts() and getUnemailedPublicPosts()** - `71f81a5` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `packages/core/src/client.ts` - Two query-filter `property` values changed from `"status"` to `"Status"` (getPosts() line ~226, getUnemailedPublicPosts() line ~259)

## Decisions Made
- Fixed `getPosts()` alongside `getUnemailedPublicPosts()` in this same gap-closure task even though `getPosts()` is technically pre-existing/outside DATA-01's original REQ-ID scope — both share the identical root-cause defect in the same file, and leaving `getPosts()` lowercase would keep the site's primary home/category/search read path broken next to its "fixed" sibling. This is a deliberate documented in-scope inclusion per the plan's "Scope decision" section, not silent scope creep.
- Deliberately ignored 01-RESEARCH.md Pattern 1 / 01-PATTERNS.md line 47 guidance to mirror the lowercase `"status"` key — that guidance was derived from the pre-existing buggy filter itself and is superseded by the 01-VERIFICATION.md CR-01 finding.
- Left `mapPageToPost()`'s `getSelect(page, "Status", "status")` extractor unchanged: its lowercase second argument is a legitimate client-side per-page fallback key, distinct from the server-side query filter which Notion matches case-sensitively with no fallback.

## Deviations from Plan

None - plan executed exactly as written. This was a single, minimal, in-scope two-string-literal fix with no auto-fixes, no blocking issues, and no architectural questions triggered.

## Issues Encountered
None.

## User Setup Required

None - no new external service configuration required. The carried-forward live-Notion credential gate (NOTION_TOKEN, NOTION_DATABASE_ID) is unchanged from 01-01-PLAN.md's user_setup and was not resolvable in this execution environment (no live credentials present).

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources were introduced by this change.

## Next Phase Readiness

- CR-01 is closed: both `getPosts()` and `getUnemailedPublicPosts()` now query against the documented canonical `"Status"` property name, matching the extractor family and types.ts JSDoc.
- The DATA-01/DATA-02 live mark-then-requery verification carried forward from 01-01 is now unblocked to run — the fix is the precondition, but it still requires a human to supply live `NOTION_TOKEN`/`NOTION_DATABASE_ID` test credentials against a workspace with a canonical `Status` property and run `npx tsx packages/core/scripts/verify-phase-1.ts`. This was NOT run in this session (no credentials available) and remains an open manual verification item, same as 01-01.
- WR-02 (missing-property detection regex) remains out of scope for this pass, unchanged, per the plan's explicit exclusion.
- No blockers for proceeding to the next phase's planning; the one outstanding item is the same live-Notion human verification gate carried since 01-01.

---
*Phase: 01-notion-data-layer*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: `.planning/phases/01-notion-data-layer/01-02-SUMMARY.md`
- FOUND: commit `71f81a5`
- Confirmed: `grep -c 'property: "Status"' packages/core/src/client.ts` = 2
