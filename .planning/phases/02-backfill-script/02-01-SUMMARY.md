---
phase: 02-backfill-script
plan: 01
subsystem: data
tags: [notion, cli, backfill, throttling, rate-limiting, node-util-parseargs]

requires:
  - phase: 01-notion-data-layer
    provides: "NologClient.getUnemailedPublicPosts()/markEmailed(), NotionCapabilityError, MissingEmailedPropertyError"
provides:
  - "packages/core/scripts/backfill.ts — operator CLI that drains getUnemailedPublicPosts() and marks each post emailed, throttled and resumable"
  - "packages/core/package.json `backfill` npm script entry"
affects: [04-notify-route, 05-production-cutover, 06-documentation]

tech-stack:
  added: []
  patterns:
    - "node:util parseArgs in default strict mode as the sole safety gate in front of an irreversible write"
    - "Fixed 400ms serial throttle (no token-bucket) matching one-post-at-a-time processing"
    - "instanceof error-class branching ordered systemic-abort before per-post-continue before rate-limit-retry"

key-files:
  created:
    - packages/core/scripts/backfill.ts
  modified:
    - packages/core/package.json
    - .planning/phases/02-backfill-script/02-VALIDATION.md

key-decisions:
  - "All fifteen D-01..D-15 locked decisions implemented as specified in 02-CONTEXT.md; no deviations required"
  - "Live human-check verification (DATA-03 SC#1-3, D-04, D-05 against a real Notion workspace) deferred — no NOTION_TOKEN/NOTION_DATABASE_ID available in this execution environment, matching the identical constraint documented for Phase 1"

patterns-established:
  - "Manual-script convention extended: this is the first packages/core/scripts/ file that is also npm-script-wrapped for forker discoverability, unlike its author-only verify-* neighbors"

requirements-completed: [DATA-03]

coverage:
  - id: D1
    description: "--dry-run previews every unemailed public post (id+title) plus a count and the queried database id, with zero Notion writes"
    requirement: "DATA-03"
    verification:
      - kind: manual_procedural
        ref: "npm run backfill --workspace=@4lph4/nolog-core -- --dry-run against invalid credentials: ABORT, non-zero exit, no Node internal trace"
        status: pass
      - kind: manual_procedural
        ref: "live-database dry-run listing + zero-write confirmation"
        status: unknown
    human_judgment: true
    rationale: "No live Notion credentials available in this execution environment; the invalid-credential probe proves the wiring but not the actual per-post listing against real data"
  - id: D2
    description: "Live run marks every unemailed public post, prints 'N marked / M failed', resumable across interruption"
    requirement: "DATA-03"
    verification:
      - kind: manual_procedural
        ref: "live run against invalid credentials: ABORT before any summary line printed"
        status: pass
      - kind: manual_procedural
        ref: "live run against a real test database (SC#1/SC#2/SC#3)"
        status: unknown
    human_judgment: true
    rationale: "Resumability, rate-timing, and full write-loop correctness require a real Notion database with multiple posts, unavailable in this execution environment"
  - id: D3
    description: "NotionCapabilityError aborts the whole run immediately with one ABORT message and a partial count (D-04); MissingEmailedPropertyError and any other initial-fetch failure abort before the loop (D-05/D-15)"
    requirement: "DATA-03"
    verification:
      - kind: manual_procedural
        ref: "invalid-credential probe exercises the generic-fetch-failure abort path (D-15) and confirms exactly one ABORT line"
        status: pass
      - kind: manual_procedural
        ref: "live D-04 (revoke Update content capability) and D-05 (remove emailed property) scenarios"
        status: unknown
    human_judgment: true
    rationale: "D-04/D-05's specific abort message wording and the 'exactly one message, not one per remaining post' guarantee need a live workspace to trigger those specific error conditions"
  - id: D4
    description: "Single fixed-backoff retry on a 429/529 rate-limit response before falling through to per-post failure (D-07/D-14); mistyped flag rejected before any Notion call"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "npx tsc --noEmit --strict packages/core/scripts/backfill.ts (type-checks clean against built dist)"
        status: pass
      - kind: manual_procedural
        ref: "npm run backfill -- --dryrun (typo) exits non-zero with ERR_PARSE_ARGS_UNKNOWN_OPTION before any Notion call"
        status: pass
      - kind: manual_procedural
        ref: "live rate-limit retry scenario (10+ posts, provoke a 429)"
        status: unknown
    human_judgment: true
    rationale: "Provoking an actual Notion 429/529 response requires live production-scale traffic; the retry code path's static structure was verified but not its runtime behavior against a real rate limit"

duration: 12min
completed: 2026-07-25
status: complete
---

# Phase 2 Plan 1: Backfill Script Summary

**Throttled, resumable `backfill` CLI (400ms serial writes, one bounded 429/529 retry, three-way abort/continue/retry error classification) draining `getUnemailedPublicPosts()` via a new npm script wrapper — zero changes to Phase 1's `NologClient`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-25T08:04:00Z (approx, per STATE.md session start)
- **Completed:** 2026-07-25T08:16:00Z
- **Tasks:** 3
- **Files modified:** 2 (1 created, 1 modified) + 1 planning doc (02-VALIDATION.md)

## Accomplishments
- `packages/core/scripts/backfill.ts` created end-to-end: strict `parseArgs` → `NologClient` (from `dist`) → `getUnemailedPublicPosts()` → dry-run preview or live throttled write loop → exit code
- `packages/core/package.json` gained exactly one `scripts.backfill` entry (`npx tsx scripts/backfill.ts`); `dependencies`/`devDependencies` byte-identical, no lifecycle hook references it
- Full three-way error classification implemented: `MissingEmailedPropertyError`/generic-fetch-failure aborts before the loop (D-05/D-15), `NotionCapabilityError` aborts mid-loop with a partial count (D-04), generic per-post failures log-and-continue (D-06), and a 429/529 gets exactly one fixed-backoff retry before falling through to D-06 (D-07/D-14)
- Fixed 400ms throttle (D-09/D-10) holds on every loop iteration regardless of branch taken, with no duplicated or skipped sleep

## Task Commits

Each task was committed atomically:

1. **Task 02-01-T1: End-to-end backfill CLI — dry-run preview, one command, no writes** - `e242de9` (feat)
2. **Task 02-01-T2: Throttled write loop — mark, count, abort on systemic failure, signal via exit code** - `abd2014` (feat)
3. **Task 02-01-T3: Single retry with fixed backoff on a Notion rate-limit response** - `44fd9be` (feat, includes 02-VALIDATION.md binding update)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `packages/core/scripts/backfill.ts` - New operator CLI: header comment, `--dry-run` flag (strict parseArgs), dry-run preview, throttled live write loop, rate-limit retry, exit-code signaling
- `packages/core/package.json` - Added `backfill` script entry after `dev`
- `.planning/phases/02-backfill-script/02-VALIDATION.md` - Bound TBD task IDs to `02-01-T1`/`02-01-T2` per the plan's validation binding table; marked Wave 0 requirements complete

## Decisions Made
- All fifteen locked decisions (D-01 through D-15) implemented exactly as specified in `02-CONTEXT.md` — no deviations from the decision set were required.
- The live write path (T2/T3 code) intentionally builds *inside* T1's `main()` after the dry-run early return, matching the plan's explicit instruction that "nothing here gets rewritten" — the dry-run branch is byte-identical from T1 through T3.
- Placed the rate-limit retry branch (T3) as an `else if` sibling to the generic catch, letting control fall through to the loop's single trailing `sleep(DELAY_MS)` rather than adding a second sleep call inside the retry branch — this was a first-draft mistake (duplicate `sleep(DELAY_MS)` + early `continue`) caught and corrected during this same task before committing, to honor the plan's explicit "do not duplicate the sleep in each branch" instruction.

## Deviations from Plan

None - plan executed exactly as written. (One in-flight authoring correction — the retry-branch sleep duplication described above — was caught and fixed before the task's commit, so no deviation reached the committed code.)

## Issues Encountered

**No live Notion credentials in this execution environment.** Identical to the constraint already documented for Phase 1 (STATE.md: "not yet validated against a live Notion workspace (no credentials in execution environment); pending manual verification before ship"). All automated verification passed:
- `npm run build --workspace=@4lph4/nolog-core && npx tsc --noEmit --strict ...` — clean on every task
- Invalid-credential probes for `--dry-run`, live mode, and a mistyped `--dryrun` flag — all produced the expected `ABORT:`/`ERR_PARSE_ARGS_UNKNOWN_OPTION` behavior with correct exit codes and no Node internal stack traces
- `package.json` structural checks (script entry, dependency blocks, lifecycle hooks) — all green
- `git diff --quiet -- packages/core/src/` — Phase 1's `NologClient` provably untouched
- Static checks for `DELAY_MS`, `RETRY_BACKOFF_MS`, `429`/`529` prefixes, `instanceof NotionCapabilityError` ordering — all present and correctly ordered

The six live-database `<human-check>` scenarios (DATA-03 SC#1/SC#2/SC#3, D-04 abort, D-05 abort, dry-run listing against real posts) require a real Notion test workspace and remain `⬜ pending` in `02-VALIDATION.md`, tracked against `02-01-T1`/`02-01-T2` per the plan's binding table. `nyquist_compliant` stays `false` until an operator with real credentials executes them.

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data paths. The script's only untested surface is live-network behavior against a real Notion workspace (documented above under Issues Encountered, not a code stub).

## User Setup Required

**External Notion workspace verification requires manual configuration/execution.** Before this backfill script is used in production (i.e., before Phase 5's cutover), an operator with real `NOTION_TOKEN`/`NOTION_DATABASE_ID` credentials must:
1. Run `npm run build --workspace=@4lph4/nolog-core` then `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` against the target database and confirm the per-post listing and count look correct.
2. Run the live backfill (`npm run backfill --workspace=@4lph4/nolog-core`) once, confirm the `N marked / M failed` summary and that a follow-up `--dry-run` reports 0 remaining posts.
3. Optionally exercise the D-04 (revoke "Update content" capability) and D-05 (remove `emailed` property) abort paths per `02-VALIDATION.md`'s per-task verification map.

No new env vars are introduced by this phase — it reuses Phase 1's `NOTION_TOKEN`/`NOTION_DATABASE_ID`.

## Next Phase Readiness

- `packages/core/scripts/backfill.ts` and its npm script entry are complete and type-check clean against the built `dist`; Phase 1's `NologClient` is unmodified.
- Phase 4 (notify route) can proceed independently — this phase's scope is exhausted (script + npm entry only, no cron wiring, no README docs per phase boundary).
- Blocker/concern carried forward: the six live-database verification scenarios in `02-VALIDATION.md` must be run by an operator with real Notion credentials before Phase 5's production cutover — `nyquist_compliant: false` until then. This mirrors Phase 1's identical carried-forward blocker.

---
*Phase: 02-backfill-script*
*Completed: 2026-07-25*

## Self-Check: PASSED

- FOUND: packages/core/scripts/backfill.ts
- FOUND: .planning/phases/02-backfill-script/02-01-SUMMARY.md
- FOUND commit: e242de9
- FOUND commit: abd2014
- FOUND commit: 44fd9be
