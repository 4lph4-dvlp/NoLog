---
phase: 01-notion-data-layer
plan: 01
subsystem: database
tags: [notion, notionhq-client, typescript, error-handling]

# Dependency graph
requires: []
provides:
  - "NologClient.getUnemailedPublicPosts(): Promise<Post[]> — compound and filter (status=public + Emailed=false), oldest-first"
  - "NologClient.markEmailed(pageId): Promise<void> — durable checkbox write, idempotent"
  - "NotionCapabilityError — instanceof-checkable 403/D-03 error"
  - "MissingEmailedPropertyError — instanceof-checkable D-01 schema-missing error"
  - "Post.emailed: boolean field (synced across packages/core and apps/web type copies)"
  - "packages/core/scripts/verify-phase-1.ts and verify-403.ts manual verification scripts"
affects: [phase-2-backfill, phase-4-notify-route]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Regime B error handling (typed instanceof Error subclasses, status-code-first detection) scoped ONLY to the new write/schema-check paths — existing read methods keep their swallow-and-return-null convention unchanged"
    - "patchPage() mirrors queryDatabase()'s fetch/header shape exactly, PATCH verb, reused getNotionHeaders()"

key-files:
  created:
    - packages/core/scripts/verify-phase-1.ts
    - packages/core/scripts/verify-403.ts
  modified:
    - packages/core/src/client.ts
    - packages/core/src/types.ts
    - apps/web/src/types/index.ts

key-decisions:
  - "D-01/D-03 missing-property and 403 detection implemented as best-guess pattern-matches per RESEARCH.md — NOT yet validated against a live Notion workspace (no NOTION_TOKEN/NOTION_DATABASE_ID in this execution environment); flagged inline in code and below"
  - "index.ts barrel export confirmed to need no edit — wildcard export * from ./client already re-exports both new error classes"

patterns-established:
  - "New Notion write/schema-check paths throw typed Error subclasses; existing read paths remain untouched (two regimes coexist deliberately, per PATTERNS.md)"

requirements-completed: [DATA-01, DATA-02, DATA-04]

coverage:
  - id: D1
    description: "getUnemailedPublicPosts() and markEmailed() added to NologClient with the verified filter/PATCH body shapes; package builds clean and apps/web typechecks against the new Post.emailed field"
    requirement: "DATA-01"
    verification:
      - kind: other
        ref: "npm run build --workspace=@4lph4/nolog-core"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit -p apps/web/tsconfig.json"
        status: pass
    human_judgment: true
    rationale: "The phase's own success criterion (mark-then-requery against a live Notion DB via verify-phase-1.ts) requires NOTION_TOKEN/NOTION_DATABASE_ID and manual dashboard setup not available in this execution environment. Build/typecheck confirm the code compiles and shapes match research, but the live behavioral proof (DATA-01/DATA-02, ROADMAP SC#1-3) has NOT been run. Pending user-supplied credentials."
  - id: D2
    description: "markEmailed() writes only { Emailed: { checkbox: true } } (D-04), idempotent, durable"
    requirement: "DATA-02"
    verification:
      - kind: other
        ref: "npm run build --workspace=@4lph4/nolog-core"
        status: pass
    human_judgment: true
    rationale: "Same live-Notion dependency as D1 — the write's durability/visibility-on-requery claim is proven by verify-phase-1.ts, not yet run in this environment."
  - id: D3
    description: "NotionCapabilityError (403/D-03) and MissingEmailedPropertyError (D-01) added as exported, instanceof-checkable Error subclasses; status-code-first detection in patchPage(); no token/Authorization header ever appears in a thrown message"
    requirement: "DATA-04"
    verification:
      - kind: other
        ref: "npm run build --workspace=@4lph4/nolog-core"
        status: pass
      - kind: other
        ref: "grep -n 'this.token\\|Authorization' packages/core/src/client.ts (manual review — confirmed no leak into error constructors)"
        status: pass
    human_judgment: true
    rationale: "The 403 branch's real-world trigger (revoking 'Update content' capability, running verify-403.ts) requires live Notion Developer Portal access not available here. Additionally, the missing-Emailed-property detection condition (400 status + regex match) is an explicitly UNVERIFIED best-guess per RESEARCH.md Assumption A1/Open Question 1 — it has NOT been reconciled against a real Notion error response in this run. Both must be confirmed by a human with live credentials before D-01/D-03 are considered done."

duration: 6min
completed: 2026-07-24
status: complete
---

# Phase 1 Plan 01: Notion Data Layer — Emailed Query/Write + Typed Errors Summary

**`NologClient` extended with `getUnemailedPublicPosts()`/`markEmailed()` and two `instanceof`-checkable error classes (`NotionCapabilityError`, `MissingEmailedPropertyError`); package builds clean and `apps/web` typechecks, but the phase's live-Notion manual verification scripts have NOT been run in this environment (no test credentials available).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-24T14:29:00Z
- **Completed:** 2026-07-24T14:35:00Z
- **Tasks:** 2/2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- `Post.emailed: boolean` added to both `packages/core/src/types.ts` and the duplicate `apps/web/src/types/index.ts` copy (kept structurally in sync, per plan instruction — not a duplication-collapse)
- `NologClient.getUnemailedPublicPosts()`: compound `and` filter (`status=public` + `Emailed=false`), oldest-first sort, reuses `queryDatabase()` — no fetch-logic duplication
- `NologClient.markEmailed(pageId)` + private `patchPage()`: mirrors `queryDatabase()`'s fetch/header shape exactly, PATCH verb, writes only `{ Emailed: { checkbox: true } }` (D-04 — no timestamp property)
- `NotionCapabilityError` (403/D-03) and `MissingEmailedPropertyError` (D-01) — exported, `instanceof`-checkable `Error` subclasses under a new `// ─── Errors ───` banner; confirmed no token/Authorization header ever appears in a constructed message
- `patchPage()`'s error branch is status-code-first (`res.status === 403` primary signal, per Pitfall 1) with a fallback best-guess 400+regex match for the schema-missing case
- `getUnemailedPublicPosts()`'s query loop rethrows a matching schema-missing failure as `MissingEmailedPropertyError`
- `packages/core/scripts/verify-phase-1.ts` (mark-then-requery) and `packages/core/scripts/verify-403.ts` (403 capability) committed, ready to run once live Notion credentials are supplied
- Confirmed `packages/core/src/index.ts`'s wildcard barrel (`export * from "./client"`) needs no edit — both new error classes are already re-exported

## Task Commits

1. **Task 1: End-to-end "query unemailed → mark emailed → excluded on requery" (happy path only)** - `fdd1044` (feat)
2. **Task 2: Typed fail-loud errors — NotionCapabilityError (403 / D-03) and MissingEmailedPropertyError (D-01)** - `4fdc5c4` (feat)

_Note: no TDD tasks in this plan — no test framework exists in this repo (explicit out-of-scope per REQUIREMENTS.md)._

## Files Created/Modified
- `packages/core/src/client.ts` - Added `getCheckbox()` extractor, extended `mapPageToPost()`, added `getUnemailedPublicPosts()`, `patchPage()`, `markEmailed()`, `NotionCapabilityError`, `MissingEmailedPropertyError`
- `packages/core/src/types.ts` - Added `Post.emailed: boolean` field with JSDoc
- `apps/web/src/types/index.ts` - Added identical `Post.emailed: boolean` field to the duplicate type (kept in sync)
- `packages/core/scripts/verify-phase-1.ts` - New manual mark-then-requery verification script (imports from `dist/`, per Pitfall 4)
- `packages/core/scripts/verify-403.ts` - New manual 403-capability verification script

## Decisions Made
- Kept the two duplicate `Post` type definitions in sync with a 1-line addition each, rather than collapsing the duplication — matches plan's explicit scope boundary (collapsing touches import sites, out of scope here)
- Placed the two new error classes at module level (before `NologClientOptions`), not inside the `NologClient` class body, since they're standalone exported `Error` subclasses, not methods — the `// ─── Mutations ───` banner (which is inside the class, containing `patchPage`/`markEmailed`) is a separate section from `// ─── Errors ───`
- The missing-property detection condition (`res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)`) is committed as the RESEARCH.md best-guess, explicitly marked unverified inline — per plan instruction, this must be reconciled against real Notion behavior before D-01 is considered fully done (see Known Gaps below)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ran `npm install` to restore missing `node_modules`**
- **Found during:** Task 1, first attempt at the automated build verify
- **Issue:** `node_modules/` did not exist in this environment; `npm run build --workspace=@4lph4/nolog-core` failed with `tsup: not found` (exit 127) — a missing dependency install, not a missing/hallucinated package (the existing `package-lock.json` already pinned all versions), so this is a blocking-issue fix, not a new package-legitimacy case under the package-manager-install exclusion
- **Fix:** Ran `npm install` from the repo root against the existing lockfile
- **Files modified:** `package-lock.json` (one incidental line — `apps/web`'s recorded version in the lockfile synced from stale `0.1.0` to the current `0.3.2`; no dependency version changes)
- **Verification:** `npm run build --workspace=@4lph4/nolog-core` then succeeded; `npx tsc --noEmit` in `apps/web` passed clean
- **Committed in:** `fdd1044` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run any automated verification in this environment. No scope creep — no new packages installed, no version changes beyond a stale lockfile metadata field.

## Issues Encountered
None beyond the deviation above — both tasks' `<automated>` verify steps (build) passed on the first attempt after the `npm install` fix.

## User Setup Required

**External Notion workspace configuration and manual verification are required and have NOT been performed in this run.** Per the plan's own `user_setup` block:
- `NOTION_TOKEN` / `NOTION_DATABASE_ID` env vars must be set from a live Notion test workspace (no `.env` file or env vars present in this execution environment)
- The test database needs a Checkbox property named exactly `Emailed`, with at least one `Status=public`, `Emailed`-unchecked post
- The integration's "Update content" capability must be temporarily revocable/restorable via the Notion Developer Portal for the 403 test

**None of the following have been run in this session (pending user-supplied credentials):**
1. `npx tsx packages/core/scripts/verify-phase-1.ts` — mark-then-requery proof (DATA-01/DATA-02, ROADMAP SC#1-3)
2. `npx tsx packages/core/scripts/verify-403.ts` with "Update content" temporarily revoked — 403 proof (DATA-04, ROADMAP SC#4)
3. Temporarily removing the `Emailed` property to observe Notion's actual error status/message for the D-01 case, and adjusting the pattern-match condition in `patchPage()`/`getUnemailedPublicPosts()` to match reality

**This is expected and by design** — the phase's own `<precondition>` on Task 1 states live-Notion access is "required only to run the manual verify, not to compile the code," and RESEARCH.md/VALIDATION.md both classify all three requirements as manual-only (no test framework exists in this repo, explicitly out of scope). The automated build/typecheck gate is the only verification this environment can perform.

## Plan Output Section — Required Disclosures

Per the plan's `<output>` instructions:

1. **Actual live-Notion error status/message for the missing-`Emailed`-property case, and how the detection condition was adjusted (Assumption A1 / Open Question 1):** **NOT resolved in this run.** No live Notion workspace was reachable (no credentials). The detection condition committed (`res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)`, and the mirrored check in `getUnemailedPublicPosts()`'s catch block) is exactly RESEARCH.md's unverified best-guess pattern-match, shipped with an explicit inline comment flagging it as unconfirmed. **This remains an open item that MUST be validated against a real Notion workspace before D-01 is considered done** — a future execution with live credentials should temporarily remove the `Emailed` property, observe the actual response, and adjust the condition if it doesn't match.
2. **Confirmation that `index.ts` needed no edit:** Confirmed. `packages/core/src/index.ts` is `export * from "./types"` / `export * from "./client"` (unchanged, 2 lines). Both `NotionCapabilityError` and `MissingEmailedPropertyError` are visible in the built `dist/index.d.ts` barrel (`export { MissingEmailedPropertyError, NologClient, ..., NotionCapabilityError, ... }`) without any edit to `index.ts`.
3. **Whether the DATA-02 unclassified edge surfaced anything beyond the assumed idempotent-write contract:** No new edge surfaced. `markEmailed()`'s implementation is a direct, unconditional `patchPage()` call with no read-before-write guard, so calling it twice on the same page sends the same idempotent PATCH body both times — Notion's own API treats repeat identical checkbox writes as a no-op success, matching the assumed contract (issues the verified PATCH body; is idempotent; surfaces 403 as `NotionCapabilityError`). No partial-write semantics or other distinct edge was discovered during implementation.

## Known Stubs

None — no hardcoded empty/placeholder values or unwired data sources introduced.

## Threat Flags

None — no new security-relevant surface beyond what `<threat_model>` (T-1-01, T-1-02, T-1-SC) already anticipated. T-1-01 (error message token/header leak) was explicitly checked via source review: neither `NotionCapabilityError` nor `MissingEmailedPropertyError` constructors reference `this.token` or `Authorization`.

## Next Phase Readiness

- The data-layer contract (`getUnemailedPublicPosts()`, `markEmailed()`, both typed errors, `Post.emailed`) is fully implemented, compiles clean, and is ready for Phase 2's backfill script and Phase 4's notify route to consume.
- **Blocker for full phase sign-off (not for this plan's code):** the three manual-only verifications (mark-then-requery, 403 capability, schema-missing-property detection reconciliation) have not been run. A human with a live Notion test workspace must run `verify-phase-1.ts` and `verify-403.ts`, and separately test the schema-missing case, adjusting the pattern-match condition in `packages/core/src/client.ts` if Notion's actual error text doesn't match the current best-guess — before `/gsd-verify-work` or ROADMAP Phase 1 sign-off.

---
*Phase: 01-notion-data-layer*
*Completed: 2026-07-24*

## Self-Check: PASSED

All created/modified files confirmed on disk; all three commits (`fdd1044`, `4fdc5c4`, plan-metadata commit) confirmed in `git log`.
