---
phase: 02-backfill-script
plan: 02
subsystem: infra
tags: [notion-api, error-handling, cli-script, typescript]

# Dependency graph
requires:
  - phase: 02-backfill-script (plan 01)
    provides: "backfill.ts skeleton, throttle/retry/abort scaffolding, dry-run + live paths, npm script wiring"
provides:
  - "isSystemicAbort() type guard classifying NotionCapabilityError | MissingEmailedPropertyError by instanceof only, never message text"
  - "reportSystemicAbort() single-emitter for the ABORT line + partial count + non-zero exit"
  - "Systemic classification reached from both the outer per-post catch and the rate-limit retry's inner catch, closing the ~1s window where a systemic error could be misclassified as per-post noise"
  - "COVERAGE.md rebalanced to pass api-coverage.verify-pre (18 rows, 9 INTEGRATE, 9 OPT-OUT, all cells within length limits)"
affects: [phase-4-notify-cron, phase-5-comment-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared type-guard classifier reached from every catch site handling the same error taxonomy, instead of per-site instanceof chains that can drift apart"
    - "Single reporter function as the structural guarantee of 'exactly one message' properties, rather than relying on call-site discipline"

key-files:
  created: []
  modified:
    - packages/core/scripts/backfill.ts
    - .planning/phases/02-backfill-script/COVERAGE.md

key-decisions:
  - "isSystemicAbort() classifies purely on instanceof identity against NotionCapabilityError and MissingEmailedPropertyError — never on err.message — so Notion-controlled response text can never steer the abort-vs-retry decision"
  - "Branch order in the outer catch is isSystemicAbort() -> isRateLimited() -> generic per-post failure; this ordering is load-bearing and is asserted by an automated line-number comparison, not just code review"
  - "The retry's inner catch gained a matching isSystemicAbort() branch ahead of its existing per-post FAILED handling, closing gap 1's manifestation (b) inside the ~1s rate-limit retry window"
  - "COVERAGE.md row 0 was rebalanced (not truncated) by moving the endpoint/filter detail into its previously-empty reason cell; row 9 (Retry-After OPT-OUT) was compressed from 323 to 174 chars while verifying all four original claims survive"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "Systemic error (NotionCapabilityError or MissingEmailedPropertyError) surfacing in the outer per-post catch aborts the run immediately with exactly one ABORT line, the partial count, and a non-zero exit"
    requirement: "DATA-03"
    verification:
      - kind: other
        ref: "grep assertions: isSystemicAbort(err) present, ordered strictly before isRateLimited(err); instanceof NotionCapabilityError appears exactly once (inside the classifier only)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --strict --skipLibCheck packages/core/scripts/backfill.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Systemic error surfacing inside the rate-limit retry's inner catch (the ~1s window) also aborts immediately, rather than being logged as a per-post FAILED line"
    requirement: "DATA-03"
    verification:
      - kind: other
        ref: "grep assertions: isSystemicAbort(retryErr) present, ordered strictly before retryErr instanceof Error message extraction; reportSystemicAbort(retryErr, marked, failed) present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Mid-run schema change (emailed property removed from Notion database while backfill is in flight) is exercised against a live workspace to confirm exactly one ABORT line, no per-remaining-post failure spam, and a clean re-run after the property is restored"
    verification: []
    human_judgment: true
    rationale: "No live Notion credentials exist in this execution environment; this is the plan's own <human-check> item, additive to the nine items already tracked in 02-VERIFICATION.md. All reachable automated proxies (invalid-credential dry-run and live probes, both aborting cleanly at the initial fetch with a single ABORT line) passed."
  - id: D4
    description: "packages/core/src/client.ts (Phase 1's shipped client) is untouched by this gap-closure plan"
    requirement: "DATA-03"
    verification:
      - kind: other
        ref: "git diff --name-only -- packages/core/src/client.ts (both commits) — zero lines"
        status: pass
    human_judgment: false
  - id: D5
    description: "COVERAGE.md passes api-coverage.verify-pre with zero blocking errors, all 18 rows and 9/9 INTEGRATE/OPT-OUT decisions intact, no row added/removed/merged/re-decided"
    requirement: "DATA-03"
    verification:
      - kind: other
        ref: "node gsd-core/bin/gsd-tools.cjs check api-coverage.verify-pre .planning/phases/02-backfill-script --raw -> {block:false, passed:true, counts:{surface:18, integrate:9, optout:9}}"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-07-25
status: complete
---

# Phase 2 Plan 2: Systemic-Abort Classification Hardening + COVERAGE.md Cell-Length Fix Summary

**Shared `isSystemicAbort()` type guard now gates both the outer per-post catch and the rate-limit retry's inner catch in backfill.ts, closing the window where a revoked capability or a mid-run schema change could be misclassified as ordinary per-post noise; COVERAGE.md's two over-length cells were rebalanced (not truncated) to pass the api-coverage gate.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-25T15:16:58Z
- **Completed:** 2026-07-25T15:20:37Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- Closed VERIFICATION gap 1: `backfill.ts`'s write loop now classifies systemic conditions (`NotionCapabilityError`, `MissingEmailedPropertyError`) via one shared `instanceof`-only guard, checked at both the outer per-post catch and the retry's inner catch, strictly ahead of the rate-limit and generic-failure branches
- Centralized the abort side-effects (`ABORT:` line, partial-count line, `process.exitCode = 1`) into a single `reportSystemicAbort()` function so "exactly one ABORT message" is a structural guarantee, not a convention two call sites had to independently honor
- Closed VERIFICATION gap 2: rebalanced `COVERAGE.md`'s two over-length cells (row 0 capability at 113 chars, row 9 reason at 323 chars) down to 62 and 174 chars respectively, without dropping, merging, or re-deciding any of the matrix's 18 rows
- `api-coverage.verify-pre` now reports `passed: true`, `block: false` — the phase seal is no longer blocked

## Task Commits

Each task was committed atomically:

1. **Task 02-02-T1: Shared systemic-abort classifier checked at every catch site in the write loop** - `8d4a1f3` (fix)
2. **Task 02-02-T2: Bring COVERAGE.md within the api-coverage validator's cell limits** - `8036646` (docs)

**Plan metadata:** pending (this commit, see below)

## Files Created/Modified
- `packages/core/scripts/backfill.ts` - Added `isSystemicAbort()` type guard and `reportSystemicAbort()` reporter; restructured the outer per-post catch and the retry's inner catch to test systemic classification first, ahead of rate-limit/generic handling
- `.planning/phases/02-backfill-script/COVERAGE.md` - Rebalanced row 0 (query capability cell) and compressed row 9 (Retry-After OPT-OUT reason cell) to satisfy the validator's per-cell length limits; all 18 decisions preserved verbatim in substance

## Decisions Made
- Classified purely on `instanceof` identity, never on `err.message` substring matching — a typed class outranks Notion-controlled response text, and this is asserted structurally (the classifier is the only place `instanceof NotionCapabilityError` appears in the comment-stripped file)
- Kept `isSystemicAbort`'s type predicate and `reportSystemicAbort`'s signature on single physical lines where the plan's automated verification depended on single-line regex matches (multi-line formatting of the function signature caused an early verification failure — reformatted to one line, re-verified, no behavior change)
- Row 0's capability/reason split and row 9's compressed reason both used the plan's pre-measured exact wording, verified programmatically against the plan's stated character counts (62, 92, and 174 chars respectively) before committing

## Deviations from Plan

**1. [Verification assertion mismatch — not a code defect] `"error_count": 0` literal not present in a passing `api-coverage.verify-pre --raw` response**
- **Found during:** Task 2 verification
- **Issue:** The plan's automated verify step greps the raw JSON output for the literal string `"error_count": 0`. The actual `gsd-tools check api-coverage.verify-pre` tool only emits an `error_count`/`errors` field when there ARE problems; on a passing run it omits the field entirely (response was `{block:false, passed:true, coverage_present:true, matrix:"COVERAGE.md", counts:{surface:18,integrate:9,optout:9}, message:"..."}`, no `error_count` key at all).
- **Fix:** None required in the plan's target files. Verified the substantive intent instead: `"passed": true` present, `"block": false` present, no `errors` array present, and `counts` matching the required 18/9/9 split — all of which the plan's own other assertions for this same task also check independently. No code or documentation change was needed; this is purely a stale assumption in the plan's literal-string verify step about the tool's JSON contract on the success path.
- **Files modified:** None (verification-only observation)
- **Verification:** Confirmed against the actual raw tool output, reproduced above
- **Committed in:** N/A — no file change; documented here for traceability

Reformatting `isSystemicAbort`'s signature onto one line (noted in Decisions Made above) was a same-task, same-verify-loop correction rather than a separate deviation — it was made and re-verified before the Task 1 commit, so no incorrect state was ever committed.

---

**Total deviations:** 1 observed (verification-assertion mismatch, no fix needed to plan-owned files)
**Impact on plan:** None on scope or correctness. All plan-mandated automated verifications for both tasks pass; the one literal-string mismatch was in the plan's own verify step against a tool response shape it didn't anticipate, not a defect in the delivered code or docs.

## Issues Encountered
None beyond the deviation documented above.

## Known Stubs
None. Both files' changes are complete, non-mocked implementations wired into the existing control flow.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DATA-03 can be re-verified and returned to Complete: both VERIFICATION.md gaps (retry-window misclassification, COVERAGE.md validator failure) are closed with automated evidence.
- One `<human-check>` item remains pending — a live-workspace mid-run schema-removal test — and is recorded as additive to the nine items already tracked in `02-VERIFICATION.md`. It requires a live Notion workspace, which is unavailable in this execution environment; it is not a blocker for the automated gates or for the phase seal per the plan's own `<verification>` section.
- `packages/core/src/client.ts` remains untouched; the Phase 2 scope boundary against Phase 1's shipped client holds.
- No new dependency, no new npm script, no test framework introduced — D-13 holds.

---
*Phase: 02-backfill-script*
*Completed: 2026-07-25*
