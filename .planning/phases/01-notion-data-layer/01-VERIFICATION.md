---
phase: 01-notion-data-layer
verified: 2026-07-25T00:00:00Z
status: human_needed
score: 6/10 must-haves verified
behavior_unverified: 4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/10
  gaps_closed:
    - "getUnemailedPublicPosts() (and getPosts()) query filter now uses the canonical property key \"Status\" (capital S), matching mapPageToPost()'s getSelect(page, \"Status\", \"status\") primary key and types.ts's documented convention (CR-01 closed)"
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items:
  - truth: "markEmailed(pageId) issues the Notion PATCH body { properties: { Emailed: { checkbox: true } } } and the change is visible on a subsequent read (DATA-02, ROADMAP SC#3)"
    test: "Run `npx tsx packages/core/scripts/verify-phase-1.ts` against a live Notion test DB (NOTION_TOKEN + NOTION_DATABASE_ID set, canonical capital \"Status\" property, Emailed checkbox property present, ≥1 Status=public/Emailed-unchecked post)."
    expected: "stdout ends with \"PASS: post correctly excluded after markEmailed()\", proving the PATCH write durably persisted and the checkbox is visible on the immediately-following query."
    why_human: "Requires a live Notion workspace and real API round-trip; no NOTION_TOKEN/NOTION_DATABASE_ID present in this environment. Code presence/wiring/shape is confirmed correct by inspection (unchanged from 01-01, PATCH body has no extraneous `type` key), but Notion actually persisting and returning the write cannot be proven statically."
  - truth: "A post is excluded from getUnemailedPublicPosts() immediately after markEmailed(pageId) succeeds against it (DATA-01/DATA-02, ROADMAP SC#1)"
    test: "Same verify-phase-1.ts run as above."
    expected: "Same PASS line as above."
    why_human: "Same live-Notion dependency. Previously this truth was additionally blocked by CR-01 (the query would 400 before ever reaching the requery assertion for a canonical-schema workspace); that precondition is now resolved (verified below), so this item is unblocked but still requires a live round-trip to prove behaviorally."
  - truth: "markEmailed throws an instanceof-distinguishable NotionCapabilityError (not a generic Error) when Notion returns 403 for the write (DATA-04, D-03, ROADMAP SC#4)"
    test: "Temporarily revoke the integration's \"Update content\" capability in the Notion Developer Portal, then run `npx tsx packages/core/scripts/verify-403.ts`."
    expected: "stdout is \"PASS: <message>\" and the caught error is `instanceof NotionCapabilityError`."
    why_human: "Requires live Notion Developer Portal access to revoke/restore a capability; cannot be simulated statically. Code path is unchanged from 01-01, still status-code-first (`res.status === 403` gated before any message matching, client.ts:357-359) — correct by inspection, never exercised at runtime in this environment."
  - truth: "A database schema missing the Emailed property produces a distinguishable MissingEmailedPropertyError rather than a raw/unexplained Notion error (D-01)"
    test: "Temporarily remove the Emailed checkbox property from the test database, then call getUnemailedPublicPosts() and markEmailed(); observe Notion's actual error status/body and confirm MissingEmailedPropertyError fires."
    expected: "MissingEmailedPropertyError is thrown (instanceof-checkable), not a generic Error."
    why_human: "The detection condition (`res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)`) is unchanged from 01-01 and remains an explicitly-flagged best-guess pattern-match (RESEARCH.md Assumption A1 / Open Question 1, re-confirmed still present by 01-REVIEW.md WR-02 on the post-fix file), never reconciled against a real Notion error response. Requires live Notion access to observe the actual error shape and adjust the regex if it doesn't match."
human_verification:
  - test: "Run `npx tsx packages/core/scripts/verify-phase-1.ts` against a live Notion test DB whose Status property uses the canonical capital name (mark-then-requery)."
    expected: "PASS line printed, proving DATA-01/DATA-02/ROADMAP SC#1-3 — and, unlike the prior verification pass, the query itself should no longer 400 since CR-01 is now closed."
    why_human: "Live Notion round-trip; no NOTION_TOKEN/NOTION_DATABASE_ID in this environment."
  - test: "Run `npx tsx packages/core/scripts/verify-403.ts` with \"Update content\" temporarily revoked."
    expected: "PASS with error instanceof NotionCapabilityError, proving DATA-04/ROADMAP SC#4."
    why_human: "Requires live Notion Developer Portal capability toggling."
  - test: "Temporarily remove the Emailed property; observe Notion's real error and confirm/adjust the MissingEmailedPropertyError detection regex."
    expected: "MissingEmailedPropertyError fires; if the real error text doesn't match `/Emailed/i` + `/propert/i` on a 400, the regex must be tightened (ideally to Notion's stable `code` field, per 01-REVIEW.md WR-02's fix suggestion) before D-01 is considered done."
    why_human: "Live-Notion-only observable; explicitly still unresolved (unchanged code) per this gap-closure's own stated non-scope."
---

# Phase 1: Notion Data Layer Verification Report

**Phase Goal:** `NologClient` can identify which public posts haven't been emailed yet and durably mark a post as emailed once a send succeeds, with 403s from missing write capability distinguishable from other failures.
**Verified:** 2026-07-25T00:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (01-02-PLAN.md, gap_closure: true)

## Re-Verification Summary

The prior `01-VERIFICATION.md` (status: `gaps_found`, 5/10) found one code-provable gap, **CR-01**: the Notion query filters in `getPosts()` and `getUnemailedPublicPosts()` hardcoded the property key as lowercase `"status"`, while every other read of the same property in the file (`mapPageToPost()`'s `getSelect(page, "Status", "status")` at client.ts:114, and `types.ts`'s JSDoc) treats capital-S `"Status"` as canonical. Notion's database-query filter matches `property` case-sensitively with no server-side fallback, so this would 400 for any workspace using the documented canonical schema name.

**CR-01 is CONFIRMED RESOLVED**, verified directly against the current source (not from SUMMARY.md claims):

- `git show 71f81a5 -- packages/core/src/client.ts` shows an exact, minimal 2-line diff: `property: "status"` → `property: "Status"` at both filter sites (line 226 `getPosts()`, line 259 `getUnemailedPublicPosts()`), nothing else touched.
- Current source confirms: `grep -v '^\s*//' packages/core/src/client.ts | grep -c 'property: "Status"'` = **2**; `grep -n 'property: "status"'` (lowercase, in filters) = **0 matches**.
- `mapPageToPost()`'s `getSelect(page, "Status", "status")` extractor (client.ts:114), the `{ property: "Emailed", checkbox: { equals: false } }` clause (client.ts:260), and both `sorts` clauses (client.ts:224, 256) are byte-unchanged, exactly as the gap-closure plan required.
- `npm run build --workspace=@4lph4/nolog-core` compiles clean; `npx tsc --noEmit -p apps/web/tsconfig.json` exits 0. No type regression from the string-literal edit.

The remaining four truths from the prior verification, all classified `PRESENT_BEHAVIOR_UNVERIFIED` (code-correct-by-inspection, requires live Notion credentials this environment does not have — no `NOTION_TOKEN`/`NOTION_DATABASE_ID` set, confirmed empty), remain unchanged in code and therefore remain `PRESENT_BEHAVIOR_UNVERIFIED`. One of them — "post excluded from `getUnemailedPublicPosts()` immediately after `markEmailed()` succeeds" — was previously blocked *at the code level* by CR-01 (the query would 400 before the assertion could even run); that blocking precondition is now resolved, so the item is unblocked but still requires a live round-trip to prove behaviorally, exactly as anticipated by 01-02-PLAN.md's own carried-forward backstop truth.

**Net change:** 1 gap closed (CR-01, moved FAILED → VERIFIED), 0 new gaps, 0 regressions. Score improves from 5/10 to 6/10; `behavior_unverified` count unchanged at 4 (the same four items, now all unblocked rather than one still gated on a separate code defect).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getUnemailedPublicPosts()` returns only `status==='public' AND Emailed===false` (DATA-01, SC#2) | ✓ VERIFIED | CR-01 closed: filter at client.ts:259 now uses canonical `property: "Status"`, matching `mapPageToPost()`'s primary extractor key (client.ts:114) and types.ts's documented convention. Confirmed via diff of commit `71f81a5`, current-source grep (count=2, zero lowercase remaining), and clean build/typecheck. The `Emailed` clause and sort were already correct and are unchanged. |
| 2 | `markEmailed(pageId)` issues `{ properties: { Emailed: { checkbox: true } } }` and the change is visible on a subsequent read (DATA-02, SC#3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `markEmailed`/`patchPage` present, wired, correct body shape confirmed by code read (client.ts:343-383, no `type` key). Unchanged from 01-01. Durability/visibility claim requires live Notion — not run in this environment. |
| 3 | Post excluded from `getUnemailedPublicPosts()` immediately after `markEmailed()` succeeds (DATA-01/02, SC#1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic present (same corrected filter as truth #1, same query re-run). Previously additionally blocked by CR-01 at the code level; that block is now removed — item is unblocked but still needs a live round-trip. |
| 4 | `markEmailed` throws `instanceof`-distinguishable `NotionCapabilityError` on 403 (DATA-04, D-03, SC#4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Status-code-first branch confirmed by code read (client.ts:357-359, gates on `res.status === 403` before any message matching, per Pitfall 1). Unchanged from 01-01. Never exercised against a live 403 in this environment. |
| 5 | Missing `Emailed` schema property produces distinguishable `MissingEmailedPropertyError` (D-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Detection branches present at both call sites (client.ts:281-283, 368-370), unchanged from 01-01, still explicitly flagged inline (and by 01-REVIEW.md WR-02, re-confirmed on the post-fix file) as an unverified best-guess regex match, never reconciled against a real Notion error body. |
| 6 | `Emailed=true` post stays excluded permanently, including after unpublish/republish (D-02) | ✓ VERIFIED | Structural: filter clause `{ property: "Emailed", checkbox: { equals: false } }` is the sole gate; no reset/clear-Emailed code exists anywhere in client.ts (grepped, none found). Unchanged. |
| 7 | `getUnemailedPublicPosts()` returns `[]` (never null/throw) when nothing matches | ✓ VERIFIED | `pages` initialized `[]`, `pages.map(mapPageToPost)` returned unconditionally on the non-error path (client.ts:265-287). Unchanged. |
| 8 | `markEmailed` is idempotent (safe to call twice) | ✓ VERIFIED | `markEmailed` is an unconditional `patchPage` call with no read-before-write guard (client.ts:381-383). Unchanged. |
| 9 | (backstop) No ordering guarantee beyond the query's sort clause (oldest-first) | ✓ VERIFIED | `sorts: [{ timestamp: "created_time", direction: "ascending" }]` present verbatim (client.ts:256). Unchanged. |
| 10 | (backstop) No additional concurrency guard beyond Notion's last-write-wins | ✓ VERIFIED | No lock/mutex/version-check code exists anywhere touching `markEmailed`/`patchPage` (grepped, none found). Unchanged. |

**Score:** 6/10 truths verified (4 present + wired, behavior-unverified; 0 failed — CR-01 gap closed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/client.ts` | `getUnemailedPublicPosts()`, `markEmailed()`, `patchPage()`, `getCheckbox()`, both error classes, corrected `"Status"` filter keys | ✓ VERIFIED | All present, substantive, wired. CR-01 filter-key fix confirmed at both sites (lines 226, 259); everything else byte-unchanged from 01-01. |
| `packages/core/src/types.ts` | `Post.emailed: boolean` | ✓ VERIFIED | Present with JSDoc (line 37). Unchanged (quick regression check — this plan did not touch this file). |
| `apps/web/src/types/index.ts` | Identical `Post.emailed: boolean` (kept in sync) | ✓ VERIFIED | Byte-identical `emailed` field (line 37) confirmed. Unchanged. |
| `packages/core/scripts/verify-phase-1.ts` | Mark-then-requery manual script | ✓ VERIFIED | Present, substantive, unchanged. Not run in this environment (no live Notion). |
| `packages/core/scripts/verify-403.ts` | 403 manual script | ✓ VERIFIED | Present, substantive, unchanged. Not run in this environment. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `getUnemailedPublicPosts()` | private `queryDatabase()` | reused compound `and` filter, now `"Status"` | ✓ WIRED | client.ts:270 calls `this.queryDatabase(...)`; filter clause corrected, no duplicated fetch logic. |
| `markEmailed(pageId)` | `patchPage(pageId, {...})` → `fetch PATCH .../pages/{pageId}` | direct call chain | ✓ WIRED | client.ts:382 → client.ts:344. Unchanged. |
| `getCheckbox(page, "Emailed")` | `mapPageToPost()` → `Post.emailed` | direct call | ✓ WIRED | client.ts:115. Unchanged. |
| `res.status === 403` | `throw NotionCapabilityError` | status-code-first branch | ✓ WIRED | client.ts:357-359. Unchanged. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `getUnemailedPublicPosts()` | `pages` → mapped `Post[]` | Live `POST /v1/databases/{id}/query` via `queryDatabase()`, now filtering on canonical `"Status"` | Yes (real Notion HTTP call, not static) — CR-01 blocker removed | ✓ FLOWING |
| `markEmailed()` | n/a (write, not render) | Live `PATCH /v1/pages/{pageId}` via `patchPage()` | Yes (real Notion HTTP call) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package builds clean | `npm run build --workspace=@4lph4/nolog-core` | Success — CJS/ESM/DTS all built | ✓ PASS |
| apps/web typechecks against current `client.ts`/`Post.emailed` | `npx tsc --noEmit -p apps/web/tsconfig.json` | Exit 0, no errors | ✓ PASS |
| Both filter sites use canonical `"Status"`, exactly 2 non-comment occurrences | `grep -v '^\s*//' client.ts \| grep -c 'property: "Status"'` | `2` | ✓ PASS |
| No lowercase `"status"` remains in any filter | `grep -n 'property: "status"' client.ts` | 0 matches | ✓ PASS |
| No token/Authorization leak into error messages | inspection of `NotionCapabilityError`/`MissingEmailedPropertyError` constructors (client.ts:128-155) | Only `pageId` and Notion's own `notionMessage` interpolated; no `this.token`/`Authorization` reference | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | `grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across client.ts, types.ts, both scripts, apps/web types.ts | No matches | ✓ PASS |
| Live Notion mark-then-requery (DATA-01/02) | `npx tsx packages/core/scripts/verify-phase-1.ts` | Not run — no `NOTION_TOKEN`/`NOTION_DATABASE_ID` in this environment | ? SKIP → human_needed |
| Live Notion 403 capability (DATA-04) | `npx tsx packages/core/scripts/verify-403.ts` | Not run — requires live Notion Developer Portal access | ? SKIP → human_needed |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes declared or found for this phase; the manual verification scripts (`verify-phase-1.ts`, `verify-403.ts`) serve that role and are covered above. Step 7c: SKIPPED (no conventional probe files).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 01-01-PLAN.md, 01-02-PLAN.md (gap closure) | `NologClient` can query all public posts not yet marked `Emailed` | ? NEEDS HUMAN | CR-01 code-level defect closed — filter is now structurally correct against the documented canonical schema. Full behavioral proof (mark-then-requery against a real workspace) still requires live Notion credentials not present here. REQUIREMENTS.md checkbox correctly remains unchecked; traceability table still reads "Gaps Found" (stale wording — should now read "code fixed, human verification pending" but this is a documentation nit outside this pass's scope). |
| DATA-02 | 01-01-PLAN.md | `NologClient` can mark a post as `Emailed` after a successful send | ? NEEDS HUMAN | Write path correct by code inspection (unchanged); durability/visibility-on-requery claim unverified against live Notion. |
| DATA-04 | 01-01-PLAN.md | `markEmailed` distinguishes a 403 from other failures in its logs | ? NEEDS HUMAN | `NotionCapabilityError` present, `instanceof`-checkable, status-code-first (unchanged, correct by inspection); never exercised against a real 403 in this environment. |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly DATA-01, DATA-02, DATA-04 to Phase 1 (DATA-03 correctly deferred to Phase 2, out of this phase's plan `requirements:` lists and scope).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/client.ts` | 226, 259 | ~~Property-key casing inconsistency~~ | — RESOLVED (was 🛑 Blocker CR-01) | Closed by 01-02-PLAN.md commit `71f81a5`. Confirmed via diff + current-source grep. No longer present. |
| `packages/core/src/client.ts` | 281-283, 368-370 | Fragile substring/regex matching (`/Emailed/i` + `/propert/i`) to detect the D-01 missing-property case, explicitly self-flagged as unverified | ⚠️ Warning (carried forward from 01-REVIEW.md WR-02; unchanged by this gap-closure, explicitly out of its scope) | `MissingEmailedPropertyError` may never fire, or may misfire, until validated against a real Notion error body. |
| `packages/core/src/client.ts:292`, `packages/core/src/client.ts:344` | — | **NEW finding, out of this phase's DATA-01/02/04 scope**: `getPost()` and `patchPage()` (invoked by `markEmailed()`) interpolate an unvalidated, unencoded `pageId` directly into the Notion API request URL. 01-REVIEW.md (committed `76ffed4`, reviewed the post-fix state) found this is reachable from a raw, unsanitized dynamic route segment (`apps/web/src/app/post/[id]/page.tsx` → `getPost(id)` with no validation in between), contradicting 01-01-PLAN.md's `<threat_model>` T-1-02 disposition (`accept`, which assumed `pageId` "never originates from raw user input"). | ⚠️ Flagged for sign-off honesty (not a BLOCKER for this phase's must-haves — DATA-01/02/04 do not cover `getPost()`'s call path, and `markEmailed()`'s own `pageId` still only originates from `getUnemailedPublicPosts()` results per the plan's design) | See note below — surfaced rather than silently dropped, since it materially changes the risk picture the original threat model accepted, but is genuinely outside this phase's requirement scope. |

**Note on the pageId-injection finding:** This is a pre-existing issue on `getPost()`'s call path (via `apps/web/src/app/post/[id]/page.tsx`), not something either DATA-01/02/04 or the 01-02 gap-closure plan introduced or was scoped to fix. It is surfaced here for phase-sign-off honesty because it undermines the accepted-risk rationale in 01-01-PLAN.md's threat model (T-1-02 assumed `pageId` never originates from raw user input — 01-REVIEW.md shows at least one call path where it does, via `getPost()`, not `markEmailed()`). It is not blocking this verification's pass/fail determination (which is scoped to the DATA-01/02/04 must-haves), but should be tracked as a follow-up — e.g. via `/gsd-secure-phase 1` to formally re-run the threat model, or as a scoped fix in a future pass — rather than silently absorbed into a clean phase sign-off.

### Human Verification Required

See `human_verification` in frontmatter for the full list. Summary:

1. **Mark-then-requery (DATA-01/02, SC#1-3)** — run `verify-phase-1.ts` against a live Notion test DB with a canonical capital `"Status"` property. Unlike the prior verification pass, the query itself should no longer 400 (CR-01 is closed).
2. **403 capability (DATA-04, SC#4)** — run `verify-403.ts` with "Update content" temporarily revoked.
3. **Missing-property detection (D-01)** — temporarily remove the `Emailed` property; confirm/adjust the regex-based detection to match Notion's real error shape (unchanged, still open — WR-02).

Also for awareness (not a blocking human-verify item for this phase's must-haves, but a sign-off-honesty flag): the new `pageId` URL-injection finding from 01-REVIEW.md (see Anti-Patterns table above) should be triaged separately.

### Gaps Summary

**No gaps remain against this phase's must-haves.** The single gap the prior verification found — CR-01, the property-key casing defect — is confirmed closed by direct inspection of the current source (not by trusting SUMMARY.md's claim): the exact 2-line diff matches the described fix, both filter sites now use the canonical `"Status"` key, the extractor fallback and `Emailed` clause are untouched, and build/typecheck both pass clean.

The remaining four must-haves are correctly implemented and wired by every check static analysis can perform, but require a live Notion workspace to prove behaviorally — legitimately outside this environment (confirmed no `NOTION_TOKEN`/`NOTION_DATABASE_ID` set), exactly as both plans' `user_setup` blocks anticipated. These route to human verification, not failure.

One item is surfaced for transparency but does not affect this phase's pass/fail: a newly-reviewed Critical finding (unvalidated `pageId` interpolation reachable via `getPost()`'s call path) contradicts the original threat model's accepted-risk disposition. It is out of DATA-01/02/04 scope and not included in the gaps list, but is flagged in the Anti-Patterns section above so it isn't silently dropped from the phase's risk picture.

**Recommended next step:** have a human run the three manual verification scripts/checks against a real Notion test workspace (now unblocked by the CR-01 fix) before considering DATA-01/02/04 fully done and advancing past Phase 1 sign-off. Separately, triage the pageId-injection finding (e.g. via `/gsd-secure-phase 1` or a scoped follow-up fix).

---

_Verified: 2026-07-25T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
