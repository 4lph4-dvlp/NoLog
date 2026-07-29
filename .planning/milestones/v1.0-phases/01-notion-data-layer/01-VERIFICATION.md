---
phase: 01-notion-data-layer
verified: 2026-07-25T03:10:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/10
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  behavior_now_verified:
    - "markEmailed(pageId) issues the Notion PATCH body { properties: { emailed: { checkbox: true } } } and the change is visible on a subsequent read (DATA-02, ROADMAP SC#3) — proven live via 01-UAT.md test 1"
    - "A post is excluded from getUnemailedPublicPosts() immediately after markEmailed(pageId) succeeds against it (DATA-01/DATA-02, ROADMAP SC#1) — proven live via 01-UAT.md test 1"
    - "markEmailed throws an instanceof-distinguishable NotionCapabilityError when Notion returns 403 for the write (DATA-04, D-03, ROADMAP SC#4) — proven live via 01-UAT.md test 2"
    - "A database schema missing the emailed property produces a distinguishable MissingEmailedPropertyError (D-01) — proven live via 01-UAT.md test 3"
deferred: []
human_verification: []
---

# Phase 1: Notion Data Layer Verification Report

**Phase Goal:** `NologClient` can identify which public posts haven't been emailed yet and durably mark a post as emailed once a send succeeds, with 403s from missing write capability distinguishable from other failures.
**Verified:** 2026-07-25T03:10:00Z
**Status:** passed
**Re-verification:** Yes — final pass, after all 3 human-verification items completed against the live production Notion database (01-UAT.md)

## Note on ROADMAP `Mode: mvp`

Phase 1 is flagged `Mode: mvp` in ROADMAP.md, but its `**Goal:**` line is written as a backend capability statement, not the canonical "As a / I want to / so that" user-story form — 01-01-PLAN.md flags this explicitly and supplies an equivalent framing with a named actor (the future notify/backfill code path, the internal API consumer), since this phase has no end-user UI surface to walk a "User Flow Coverage" table through (CONTEXT.md phase boundary: backend-only data-layer extension). Standard goal-backward truths verification is applied below, consistent with the prior verification pass, rather than forcing an inapplicable UI-flow table onto a phase with no UI.

## Re-Verification Summary — what changed since the last pass

The prior `01-VERIFICATION.md` (status: `human_needed`, 6/10) had:
- **1 gap already closed by inspection** (CR-01 — confirmed a non-issue; see `## CORRECTION` history below, retained for the record)
- **4 truths `PRESENT_BEHAVIOR_UNVERIFIED`** — code-correct by static inspection, but requiring a live Notion round-trip no environment credential could provide at that time

Since then, per `01-UAT.md` (status: `complete`, 3/3 passed, 0 issues), a human ran all three manual verification scripts/checks against the **live production Notion database**, and all passed:

1. **Mark-then-requery** (`verify-phase-1.ts`) — PASS: "Before: 3 unemailed public posts" → marked page `6b42c61e-4a24-82b0-ae11-01fdb5e7110f` ("NoLog를 만들며") → "PASS: post correctly excluded after markEmailed()" (2026-07-25T02:38)
2. **403 capability detection** (`verify-403.ts`) — PASS: `NotionCapabilityError` instanceof-confirmed, message reads "Notion write failed for page 36e2c61e-...: integration lacks \"Update content\" capability... (Notion said: {"status":403,"code":"restricted_resource",...})" — matches the exact message shape in `client.ts:128-137`, no token/Authorization leak (2026-07-25T02:45)
3. **Missing-property detection** (D-01) — PASS: real Notion error observed `{"status":400,"code":"validation_error","message":"Could not find property with name or id: emailed"}`; the existing regex (`res.status===400 && /emailed/i.test(bodyText) && /propert/i.test(bodyText)`) matched correctly — "propert" is present in "property", "emailed" is present in the message — `MissingEmailedPropertyError` fired as designed, no code change needed (2026-07-25T02:52)

Separately, two more source corrections landed since the prior pass, both verified against current source in this pass:
- `588496d` reverted the CR-01 "fix" — filters are back to lowercase `property: "status"` (confirmed correct, matching the live schema)
- `a5eb42d` renamed the `Emailed` checkbox to `emailed` throughout `client.ts` (extractor call, PATCH body, both error messages) and fixed an independent, real bug — `getRichText(page, "Summary", "summery")` never matched the real `summary` property (typo'd fallback key), so `Post.summary` had always rendered empty; now `getRichText(page, "summary", "Summary")`, confirmed correct

All 4 previously `PRESENT_BEHAVIOR_UNVERIFIED` truths are promoted to ✓ VERIFIED below, backed by the UAT evidence cross-checked against the current source (not by trusting SUMMARY.md/UAT.md claims at face value — see per-truth evidence).

**Net change:** 4 truths moved PRESENT_BEHAVIOR_UNVERIFIED → VERIFIED, 0 new gaps, 0 regressions. Score improves from 6/10 to **10/10**. Status improves from `human_needed` to **`passed`**.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getUnemailedPublicPosts()` returns only `status==='public' AND emailed===false` (DATA-01, SC#2) | ✓ VERIFIED | `client.ts:253-288`: compound `and` filter `{ property: "status", select: { equals: "public" } }` + `{ property: "emailed", checkbox: { equals: false } }`, confirmed matching live schema (lowercase, per user-supplied screenshot + `588496d`). Live-confirmed: 01-UAT.md test 1 printed "Before: 3 unemailed public posts" against the real production DB — a non-trivial, non-empty, non-error live result. |
| 2 | `markEmailed(pageId)` issues `{ properties: { emailed: { checkbox: true } } }` and the change is visible on a subsequent read (DATA-02, SC#3) | ✓ VERIFIED | `client.ts:381-383`: `patchPage(pageId, { emailed: { checkbox: true } })`, no extraneous `type` key. Live-confirmed: 01-UAT.md test 1 — after `markEmailed()`, the requery excluded the marked page ("PASS: post correctly excluded after markEmailed()"), proving the PATCH persisted and is visible on the immediately-following read. |
| 3 | Post excluded from `getUnemailedPublicPosts()` immediately after `markEmailed()` succeeds (DATA-01/02, SC#1) | ✓ VERIFIED | Same evidence as #1/#2 — the mark-then-requery round trip is the direct behavioral proof of this exact truth; live-confirmed against the production database, not simulated. |
| 4 | `markEmailed` throws `instanceof`-distinguishable `NotionCapabilityError` on 403 (DATA-04, D-03, SC#4) | ✓ VERIFIED | `client.ts:343-359`: status-code-first (`res.status === 403` gated before any message matching, per Pitfall 1). Live-confirmed: 01-UAT.md test 2 — with "Update content" capability revoked in the live Notion Developer Portal, `verify-403.ts` caught the error as `instanceof NotionCapabilityError` and printed the exact message shape the constructor at `client.ts:128-137` produces (`(Notion said: {"status":403,"code":"restricted_resource",...})`); capability restored afterward. |
| 5 | Missing `emailed` schema property produces distinguishable `MissingEmailedPropertyError` (D-01) | ✓ VERIFIED | `client.ts:281-283, 368-370`: regex `res.status===400 && /emailed/i.test(bodyText) && /propert/i.test(bodyText)`. Live-confirmed: 01-UAT.md test 3 — with the `emailed` property temporarily removed from the live database, Notion returned `{"status":400,"code":"validation_error","message":"Could not find property with name or id: emailed"}`; the regex matched (`emailed` present, `propert[y]` present) and `MissingEmailedPropertyError` fired correctly — no code change was needed, closing the previously-open Assumption A1 / Open Question 1 / 01-REVIEW.md WR-02 caveat. Property restored afterward. |
| 6 | `emailed=true` post stays excluded permanently, including after unpublish/republish (D-02) | ✓ VERIFIED | Structural: `{ property: "emailed", checkbox: { equals: false } }` is the sole gate; no reset/clear-`emailed` code exists anywhere in `client.ts` (grepped, none found — `command grep -n "emailed"` shows only the 3 expected sites: extractor call, filter clause, PATCH body). |
| 7 | `getUnemailedPublicPosts()` returns `[]` (never null/throw) when nothing matches | ✓ VERIFIED | `pages` initialized `[]` (`client.ts:265`), `pages.map(mapPageToPost)` returned unconditionally on the non-error path (`client.ts:287`). |
| 8 | `markEmailed` is idempotent (safe to call twice) | ✓ VERIFIED | `markEmailed` (`client.ts:381-383`) is an unconditional `patchPage` call with no read-before-write guard — repeat identical checkbox writes are a Notion-side no-op success. |
| 9 | (backstop) No ordering guarantee beyond the query's sort clause (oldest-first) | ✓ VERIFIED | `sorts: [{ timestamp: "created_time", direction: "ascending" }]` present verbatim (`client.ts:256`). |
| 10 | (backstop) No additional concurrency guard beyond Notion's last-write-wins | ✓ VERIFIED | No lock/mutex/version-check code exists anywhere touching `markEmailed`/`patchPage` (grepped, none found). |

**Score:** 10/10 truths verified (0 present-but-behavior-unverified; 0 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/client.ts` | `getUnemailedPublicPosts()`, `markEmailed()`, `patchPage()`, `getCheckbox()`, both error classes, lowercase `"status"`/`"emailed"` filter keys matching the live schema | ✓ VERIFIED | All present, substantive, wired. Confirmed via direct read (lines 90-384) — matches the corrected post-`588496d`/`a5eb42d` state. |
| `packages/core/src/types.ts` | `Post.emailed: boolean` | ✓ VERIFIED | Present with JSDoc (line 37), documents "permanent once true (D-02)". |
| `apps/web/src/types/index.ts` | Identical `Post.emailed: boolean` (kept in sync) | ✓ VERIFIED | Byte-identical `emailed` field (line 37) confirmed against `packages/core/src/types.ts`. |
| `packages/core/scripts/verify-phase-1.ts` | Mark-then-requery manual script | ✓ VERIFIED | Present, substantive, unchanged. Confirmed run against live Notion per 01-UAT.md test 1; output shape matches script's own PASS/FAIL string literals exactly. |
| `packages/core/scripts/verify-403.ts` | 403 manual script | ✓ VERIFIED | Present, substantive, unchanged. Confirmed run per 01-UAT.md test 2; output message matches `NotionCapabilityError`'s exact constructor format. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `getUnemailedPublicPosts()` | private `queryDatabase()` | reused compound `and` filter | ✓ WIRED | `client.ts:270` calls `this.queryDatabase(...)`; no duplicated fetch logic. Live-confirmed non-empty real result (UAT test 1). |
| `markEmailed(pageId)` | `patchPage(pageId, {...})` → `fetch PATCH .../pages/{pageId}` | direct call chain | ✓ WIRED | `client.ts:382` → `client.ts:344`. Live-confirmed durable write (UAT test 1). |
| `getCheckbox(page, "emailed")` | `mapPageToPost()` → `Post.emailed` | direct call | ✓ WIRED | `client.ts:115`. |
| `res.status === 403` | `throw NotionCapabilityError` | status-code-first branch | ✓ WIRED | `client.ts:357-359`. Live-confirmed (UAT test 2). |
| `res.status === 400` + regex | `throw MissingEmailedPropertyError` | pattern-match branch, both call sites | ✓ WIRED | `client.ts:281-283`, `client.ts:368-370`. Live-confirmed match against real Notion error text (UAT test 3) — no longer an open/unverified assumption. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `getUnemailedPublicPosts()` | `pages` → mapped `Post[]` | Live `POST /v1/databases/{id}/query` via `queryDatabase()` | Yes — live-confirmed non-empty result against production (UAT test 1: "Before: 3 unemailed public posts") | ✓ FLOWING |
| `markEmailed()` | n/a (write, not render) | Live `PATCH /v1/pages/{pageId}` via `patchPage()` | Yes — live-confirmed durable, visible-on-requery write (UAT test 1) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package builds clean | `npm run build --workspace=@4lph4/nolog-core` | Success — CJS/ESM/DTS all built, re-run in this verification pass | ✓ PASS |
| apps/web typechecks against current `client.ts`/`Post.emailed` | `npx tsc --noEmit -p apps/web/tsconfig.json` | Exit 0, no errors — re-run in this verification pass | ✓ PASS |
| Barrel export re-exports both new error classes | `command grep -n "NotionCapabilityError\|MissingEmailedPropertyError" packages/core/dist/index.d.ts` | Both classes declared + present in the `export { ... }` line | ✓ PASS |
| Filter keys match live schema (lowercase `"status"`, `"emailed"`) | `command grep -n 'property: "status"' client.ts` | 2 matches (`getPosts()` line 226, `getUnemailedPublicPosts()` line 259) | ✓ PASS |
| No token/Authorization leak into error messages | `command grep -n 'this.token\|Authorization' client.ts` | Only appears in constructor (line 173) and `getNotionHeaders()` (lines 178, 187) — never in either error class | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | `command grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across `client.ts`, `types.ts`, `apps/web/src/types/index.ts` | No matches | ✓ PASS |
| Live Notion mark-then-requery (DATA-01/02) | `npx tsx packages/core/scripts/verify-phase-1.ts` | Run by human against live production DB — PASS (01-UAT.md test 1) | ✓ PASS |
| Live Notion 403 capability (DATA-04) | `npx tsx packages/core/scripts/verify-403.ts` | Run by human with capability revoked — PASS (01-UAT.md test 2) | ✓ PASS |
| Live Notion missing-property detection (D-01) | Manual property removal + query/write call | Run by human — PASS (01-UAT.md test 3) | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes declared or found for this phase; the manual verification scripts (`verify-phase-1.ts`, `verify-403.ts`) serve that role and are covered above, now with confirmed live execution evidence (01-UAT.md). Step 7c: SKIPPED (no conventional probe files; manual scripts are the verification mechanism by design — no test framework exists in this repo, per REQUIREMENTS.md's explicit out-of-scope).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 01-01-PLAN.md | `NologClient` can query all public posts not yet marked `emailed` | ✓ SATISFIED | Code correct (lowercase filter matching live schema) + live-confirmed via 01-UAT.md test 1 (non-empty real result, correctly excludes marked posts on requery). |
| DATA-02 | 01-01-PLAN.md | `NologClient` can mark a post as `emailed` after a successful send | ✓ SATISFIED | Code correct (minimal PATCH body, no extraneous fields) + live-confirmed durable/visible-on-requery write via 01-UAT.md test 1. |
| DATA-04 | 01-01-PLAN.md | `markEmailed` distinguishes a 403 from other failures in its logs | ✓ SATISFIED | `NotionCapabilityError` present, `instanceof`-checkable, status-code-first + live-confirmed via 01-UAT.md test 2 against a real revoked-capability 403. |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly DATA-01, DATA-02, DATA-04 to Phase 1 (DATA-03 correctly deferred to Phase 2, out of this phase's plan `requirements:` lists and scope).

**Documentation nit (non-blocking, carried forward from prior pass):** `.planning/REQUIREMENTS.md`'s checkboxes for DATA-01/02/04 are still unchecked (`- [ ]`) and its traceability table still reads "Gaps Found" for these three rows — both stale relative to this pass's `passed` verdict. This is a bookkeeping update outside the verifier's scope (typically updated at milestone/requirements-completion steps, not at phase verification), flagged here so it isn't silently missed before the next phase's planning references it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/client.ts` | 226, 259 | ~~Property-key casing~~ | — N/A (never a real defect) | CR-01 is retracted — the original lowercase `"status"` filter was correct all along, confirmed against the live schema; `588496d` reverted the erroneous `71f81a5` "fix". |
| `packages/core/src/client.ts` | 281-283, 368-370 | Regex-based detection (`/emailed/i` + `/propert/i`) for the D-01 missing-property case | ℹ️ Info (previously ⚠️ Warning — now closed) | Was previously flagged as an unverified best-guess (01-REVIEW.md WR-02). Now **confirmed correct** against a real Notion error body (01-UAT.md test 3: `{"status":400,"code":"validation_error","message":"Could not find property with name or id: emailed"}` matches both regex clauses). No longer an open risk — downgraded from Warning to informational. |
| `packages/core/src/client.ts:292`, `packages/core/src/client.ts:344` | — | `getPost()` and `patchPage()` (invoked by `markEmailed()`) interpolate an unvalidated, unencoded `pageId` directly into the Notion API request URL; `getPost()` specifically is reachable from `apps/web/src/app/post/[id]/page.tsx`'s raw dynamic route segment with no validation in between (confirmed still present — `command grep` finds no `encodeURIComponent`/validation anywhere in `client.ts`) | ⚠️ Warning (out of this phase's DATA-01/02/04 scope, not a BLOCKER — carried forward from 01-REVIEW.md, unresolved) | `markEmailed()`'s own `pageId` still only ever originates from `getUnemailedPublicPosts()` results within this phase's contract (not raw user input), so DATA-01/02/04 themselves are unaffected. But `getPost()`'s call path contradicts 01-01-PLAN.md's original T-1-02 threat-model acceptance rationale ("pageId never originates from raw user input"). Flagged again for sign-off honesty, same as the prior pass — recommend a dedicated follow-up (e.g. `/gsd-secure-phase 1` re-run, or a scoped input-validation fix) rather than silently dropping it. |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any phase-modified file.

### Human Verification Required

**None.** All three previously-open human-verification items are now complete and PASSED against the live production Notion database, per `01-UAT.md` (status: `complete`, 3/3 passed, 0 issues, 0 pending):

1. Mark-then-requery — PASS
2. 403 capability detection — PASS
3. Missing-property detection reconciliation — PASS (regex confirmed correct, no adjustment needed)

The `pageId` URL-injection finding (Anti-Patterns table above) remains flagged for awareness/follow-up but is explicitly out of DATA-01/02/04's scope and does not block this phase's `passed` verdict.

### Gaps Summary

**No gaps.** Every must-have truth (10/10) is verified: 6 by static/structural inspection (unchanged from the prior pass, still correct) and 4 by live behavioral evidence newly available via `01-UAT.md` — cross-checked in this pass against the current source (not taken on SUMMARY/UAT claims alone): the UAT's printed error messages and status codes match the exact strings the current `client.ts` constructs, and the live query counts/exclusion behavior are consistent with the implemented filter and write logic.

Security: `01-SECURITY.md` confirms `threats_open: 0`, `status: verified`, ASVS L1, with T-1-01 (the only `high`-severity threat) re-confirmed closed after the `588496d`/`a5eb42d` message-text corrections (no new leak surface — casing changes only).

Build/typecheck: both re-run in this pass and pass clean (`npm run build --workspace=@4lph4/nolog-core`, `npx tsc --noEmit -p apps/web/tsconfig.json`).

**Phase 1 goal is achieved.** `NologClient` can identify unemailed public posts, durably mark one as emailed (proven live, not just by inspection), and distinguishes a missing-capability 403 (`NotionCapabilityError`) and a missing-schema-property case (`MissingEmailedPropertyError`) from generic failures — both confirmed against real Notion API responses, both `instanceof`-checkable, neither ever leaking the token/Authorization header.

**Recommended next step:** proceed to Phase 2 (Backfill Script) planning. Separately (non-blocking): update `.planning/REQUIREMENTS.md`'s DATA-01/02/04 checkboxes and traceability status, and triage the carried-forward `pageId`-injection finding on `getPost()`'s call path (e.g. via a scoped follow-up or `/gsd-secure-phase 1` re-run).

---

## ⚠ CORRECTION (2026-07-25, historical record — retained from the prior verification pass)

**CR-01 was a misdiagnosis. The "fix" described in that finding has been reverted.** The user shared a screenshot of the actual live production Notion database showing every property name is lowercase-first camelCase (`title`, `thumbnail`, `summary`, `status`, `category`, `tag`, `author`, `createDate`, `editDate`, `emailed`) — confirming the properties are literally named lowercase, not capitalized.

The entire CR-01 chain (01-REVIEW.md's original finding → the prior VERIFICATION.md's `gaps_found` → the 01-02-PLAN.md gap-closure plan → commit `71f81a5`) was built on an unverified inference: `mapPageToPost()`'s primary/fallback key order and `types.ts`'s JSDoc were read as "documenting" capitalized keys as canonical, without ever checking a real workspace. That inference was backwards. The **original code (lowercase filters) was correct all along** — it was never a gap.

Commit `71f81a5` (the CR-01 "fix") changed both query filters to capitalized keys, which would have actually **broken** them against the real database (Notion's server-side filter has no fallback). This was caught and reverted in commit `588496d` before any live-Notion test ran; `a5eb42d` additionally renamed the `Emailed` checkbox property to `emailed` throughout the source (and fixed an independent, real `summary`-extraction typo bug) to match the confirmed-real schema.

This history is preserved for the record; it does not affect this pass's `passed` verdict, which is based on the current, corrected source plus the live UAT evidence above.

---

_Verified: 2026-07-25T03:10:00Z_
_Verifier: Claude (gsd-verifier)_
