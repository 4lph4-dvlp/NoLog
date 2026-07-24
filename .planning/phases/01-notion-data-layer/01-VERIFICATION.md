---
phase: 01-notion-data-layer
verified: 2026-07-25T00:00:00Z
status: gaps_found
score: 5/10 must-haves verified
behavior_unverified: 4
overrides_applied: 0
gaps:
  - truth: "getUnemailedPublicPosts() returns only posts where status === 'public' AND the Emailed checkbox is false, verified against a database mixing emailed, unemailed, and private posts (DATA-01, ROADMAP SC#2)"
    status: partial
    reason: "01-REVIEW.md CR-01 (critical, pre-existing, carried forward — not newly discovered here): the query filter at client.ts:259 hardcodes property key \"status\" (lowercase) with no fallback. Every other read of the same property in this file (mapPageToPost's getSelect(page, \"Status\", \"status\") at client.ts:114, and types.ts's own JSDoc: \"Publication status from the `Status` (select) property\") treats \"Status\" (capital S) as the canonical/documented name and \"status\" as only a legacy fallback. Notion's database-query filter `property` field requires an exact, case-sensitive match with no client-side fallback possible. For any workspace using the documented canonical \"Status\" property name, getUnemailedPublicPosts() (and the pre-existing getPosts(), out of this phase's scope) will receive a 400 from Notion instead of the intended filtered result set — this is a structural/logical defect provable by static reading of the file, independent of live-Notion access, not merely an \"untested\" assumption."
    artifacts:
      - path: "packages/core/src/client.ts"
        issue: "Line 259 (getUnemailedPublicPosts filter) and line 226 (pre-existing getPosts filter) use lowercase \"status\"; line 114's mapPageToPost treats \"Status\" as canonical. Internally inconsistent property-name casing."
    missing:
      - "Either confirm (against the live target Notion workspace) that its Status property is literally named lowercase \"status\", and document that as the required forker convention — or fix the filter's primary key to \"Status\" (matching every other property access in the file) and decide whether/how to also support legacy lowercase \"status\" workspaces (a single Notion filter request cannot fall back the way client-side extraction does)."
      - "Re-run the DATA-01 manual verification (verify-phase-1.ts) only after this is resolved, since an unresolved casing mismatch would make the script fail on the query itself before ever reaching the mark-then-requery assertion."
deferred: []
behavior_unverified_items:
  - truth: "markEmailed(pageId) issues the Notion PATCH body { properties: { Emailed: { checkbox: true } } } and the change is visible on a subsequent read (DATA-02, ROADMAP SC#3)"
    test: "Run `npx tsx packages/core/scripts/verify-phase-1.ts` against a live Notion test DB (NOTION_TOKEN + NOTION_DATABASE_ID set, Emailed checkbox property present, ≥1 Status=public/Emailed-unchecked post)."
    expected: "stdout ends with \"PASS: post correctly excluded after markEmailed()\", proving the PATCH write durably persisted and the checkbox is visible on the immediately-following query."
    why_human: "Requires a live Notion workspace and real API round-trip; not present in this execution environment (no NOTION_TOKEN/NOTION_DATABASE_ID configured). Code presence/wiring alone cannot prove Notion actually persists and returns the write."
  - truth: "A post is excluded from getUnemailedPublicPosts() immediately after markEmailed(pageId) succeeds against it (DATA-01/DATA-02, ROADMAP SC#1)"
    test: "Same verify-phase-1.ts run as above."
    expected: "Same PASS line as above."
    why_human: "Same live-Notion dependency; additionally contingent on the CR-01 gap above being resolved first, or the workspace happening to use lowercase \"status\"."
  - truth: "markEmailed throws an instanceof-distinguishable NotionCapabilityError (not a generic Error) when Notion returns 403 for the write (DATA-04, D-03, ROADMAP SC#4)"
    test: "Temporarily revoke the integration's \"Update content\" capability in the Notion Developer Portal, then run `npx tsx packages/core/scripts/verify-403.ts`."
    expected: "stdout is \"PASS: <message>\" and the caught error is `instanceof NotionCapabilityError`."
    why_human: "Requires live Notion Developer Portal access to revoke/restore a capability; cannot be simulated statically. Code path exists and is status-code-first (verified by reading client.ts:357-359), but never exercised at runtime in this environment."
  - truth: "A database schema missing the Emailed property produces a distinguishable MissingEmailedPropertyError rather than a raw/unexplained Notion error (D-01)"
    test: "Temporarily remove the Emailed checkbox property from the test database, then call getUnemailedPublicPosts() and markEmailed(); observe Notion's actual error status/body and confirm MissingEmailedPropertyError fires."
    expected: "MissingEmailedPropertyError is thrown (instanceof-checkable), not a generic Error."
    why_human: "The detection condition (`res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)`) is an explicitly-flagged best-guess pattern-match (RESEARCH.md Assumption A1 / Open Question 1, also 01-REVIEW.md WR-02) never reconciled against a real Notion error response in any environment to date. Requires live Notion access to observe the actual error shape and adjust the regex if it doesn't match."
human_verification:
  - test: "Run `npx tsx packages/core/scripts/verify-phase-1.ts` against a live Notion test DB (mark-then-requery)."
    expected: "PASS line printed, proving DATA-01/DATA-02/ROADMAP SC#1-3."
    why_human: "Live Notion round-trip; no NOTION_TOKEN/NOTION_DATABASE_ID in this environment. Also gated on the CR-01 casing fix/confirmation above."
  - test: "Run `npx tsx packages/core/scripts/verify-403.ts` with \"Update content\" temporarily revoked."
    expected: "PASS with error instanceof NotionCapabilityError, proving DATA-04/ROADMAP SC#4."
    why_human: "Requires live Notion Developer Portal capability toggling."
  - test: "Temporarily remove the Emailed property; observe Notion's real error and confirm/adjust the MissingEmailedPropertyError detection regex."
    expected: "MissingEmailedPropertyError fires; if the real error text doesn't match `/Emailed/i` + `/propert/i` on a 400, the regex must be tightened (ideally to Notion's stable `code` field, per 01-REVIEW.md WR-02's fix suggestion) before D-01 is considered done."
    why_human: "Live-Notion-only observable; explicitly unresolved per the plan's own Task 2 acceptance criteria and the SUMMARY's disclosed open item."
  - test: "Confirm the live target Notion workspace's actual Status property name casing (capital \"Status\" vs lowercase \"status\") and resolve CR-01 accordingly (fix the filter key, or document the lowercase-\"status\" convention as required)."
    expected: "getPosts() and getUnemailedPublicPosts() both query successfully (no 400) against the real workspace schema."
    why_human: "Requires inspecting the actual live Notion database schema, which is outside this environment; this determines whether the CR-01 gap above is a live-breaking bug or a false alarm for this specific workspace."
---

# Phase 1: Notion Data Layer Verification Report

**Phase Goal:** `NologClient` can identify which public posts haven't been emailed yet and durably mark one as emailed once its send succeeds, distinguishing a missing-write-capability 403 from other failures (ROADMAP Phase 1 Success Criteria #1-4).
**Verified:** 2026-07-25T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `getUnemailedPublicPosts()` returns only `status==='public' AND Emailed===false` (DATA-01, SC#2) | ✗ FAILED (partial) | Filter present and wired (client.ts:253-288), but hardcodes lowercase `"status"` while the rest of the file treats `"Status"` as canonical (client.ts:114, types.ts:33-34) — CR-01 in 01-REVIEW.md, pre-existing/carried-forward critical finding. Structurally provable defect risk for any workspace using the documented canonical property name; not resolved in this phase. |
| 2 | `markEmailed(pageId)` issues `{ properties: { Emailed: { checkbox: true } } }` and the change is visible on a subsequent read (DATA-02, SC#3) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `markEmailed`/`patchPage` present, wired, correct body shape confirmed by code read (client.ts:343-383, no `type` key, matches Assumption A2). Durability/visibility claim requires live Notion — not run in this environment. |
| 3 | Post excluded from `getUnemailedPublicPosts()` immediately after `markEmailed()` succeeds (DATA-01/02, SC#1) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Logic present (same filter as truth #1, same query re-run). Depends on truth #1's CR-01 resolution AND a live round-trip; neither performed here. |
| 4 | `markEmailed` throws `instanceof`-distinguishable `NotionCapabilityError` on 403 (DATA-04, D-03, SC#4) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Status-code-first branch confirmed by code read (client.ts:357-359, gates on `res.status === 403` before any message matching, per Pitfall 1). Never exercised against a live 403 in this environment. |
| 5 | Missing `Emailed` schema property produces distinguishable `MissingEmailedPropertyError` (D-01) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Detection branches present at both call sites (client.ts:281-283, 368-370) but explicitly flagged inline (and by 01-REVIEW.md WR-02) as an unverified best-guess regex match, never reconciled against a real Notion error body. |
| 6 | `Emailed=true` post stays excluded permanently, including after unpublish/republish (D-02) | ✓ VERIFIED | Structural: filter clause `{ property: "Emailed", checkbox: { equals: false } }` is the sole gate; no reset/clear-Emailed code exists anywhere in client.ts (grepped, none found) — the one-way-flag contract holds by absence of any code path that would flip it back. |
| 7 | `getUnemailedPublicPosts()` returns `[]` (never null/throw) when nothing matches | ✓ VERIFIED | `pages` initialized `[]`, `pages.map(mapPageToPost)` returned unconditionally on the non-error path (client.ts:265-287). |
| 8 | `markEmailed` is idempotent (safe to call twice) | ✓ VERIFIED | `markEmailed` is an unconditional `patchPage` call with no read-before-write guard (client.ts:381-383) — repeat calls send the identical PATCH body; matches SUMMARY's disclosed reasoning and Notion's documented checkbox-write semantics. |
| 9 | (backstop) No ordering guarantee beyond the query's sort clause (oldest-first) | ✓ VERIFIED | `sorts: [{ timestamp: "created_time", direction: "ascending" }]` present verbatim (client.ts:256) — matches the claim exactly. |
| 10 | (backstop) No additional concurrency guard beyond Notion's last-write-wins | ✓ VERIFIED | No lock/mutex/version-check code exists anywhere touching `markEmailed`/`patchPage` (grepped, none found) — absence-of-feature claim holds. |

**Score:** 5/10 truths verified (4 present + wired, behavior-unverified; 1 failed/partial)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/src/client.ts` | `getUnemailedPublicPosts()`, `markEmailed()`, `patchPage()`, `getCheckbox()`, both error classes | ✓ VERIFIED | All present, substantive (no stubs/placeholders), wired into `mapPageToPost`/`queryDatabase`/`fetch`. See CR-01 gap for the one filter-key defect. |
| `packages/core/src/types.ts` | `Post.emailed: boolean` | ✓ VERIFIED | Present with JSDoc referencing `Emailed` checkbox + D-02 permanence note (line 37). |
| `apps/web/src/types/index.ts` | Identical `Post.emailed: boolean` (kept in sync) | ✓ VERIFIED | Byte-identical `emailed` field/JSDoc confirmed against the core copy (diff-equivalent). Pre-existing duplication (WR-03, out of scope for this phase per plan). |
| `packages/core/scripts/verify-phase-1.ts` | Mark-then-requery manual script | ✓ VERIFIED | Present, substantive, correct PASS/FAIL logic, imports from `dist/` per Pitfall 4. Not run in this environment (no live Notion). |
| `packages/core/scripts/verify-403.ts` | 403 manual script | ✓ VERIFIED | Present, substantive, correct `instanceof` assertion logic. Not run in this environment. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `getUnemailedPublicPosts()` | private `queryDatabase()` | reused compound `and` filter | ✓ WIRED | client.ts:270 calls `this.queryDatabase(...)`; no duplicated fetch logic. |
| `markEmailed(pageId)` | `patchPage(pageId, {...})` → `fetch PATCH .../pages/{pageId}` | direct call chain | ✓ WIRED | client.ts:382 → client.ts:344 (`fetch` with `method: "PATCH"`, correct URL template). |
| `getCheckbox(page, "Emailed")` | `mapPageToPost()` → `Post.emailed` | direct call | ✓ WIRED | client.ts:115: `emailed: getCheckbox(page, "Emailed")`. |
| `res.status === 403` | `throw NotionCapabilityError` | status-code-first branch | ✓ WIRED | client.ts:357-359, gated on status code before any message-matching (Pitfall 1 honored). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `getUnemailedPublicPosts()` | `pages` → mapped `Post[]` | Live `POST /v1/databases/{id}/query` via `queryDatabase()` | Yes (real Notion HTTP call, not a static/hardcoded return) — contingent on the CR-01 property-key match succeeding | ⚠️ FLOWING, at-risk (CR-01) |
| `markEmailed()` | n/a (write, not render) | Live `PATCH /v1/pages/{pageId}` via `patchPage()` | Yes (real Notion HTTP call) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Package builds clean | `npm run build --workspace=@4lph4/nolog-core` | Success — CJS/ESM/DTS all built, both new error classes present in `dist/index.d.ts` (`export { MissingEmailedPropertyError, ..., NotionCapabilityError, ... }`) | ✓ PASS |
| apps/web typechecks against new `Post.emailed` field | `npx tsc --noEmit -p apps/web/tsconfig.json` | Exit 0, no errors | ✓ PASS |
| No token/Authorization leak into error messages | `grep -n "this.token\|Authorization" packages/core/src/client.ts` | Only appears in `getNotionHeaders()` (lines 173/178/187) for the actual outbound request; zero occurrences inside `NotionCapabilityError`/`MissingEmailedPropertyError` constructors (lines 128-155) | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | `grep -nE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER"` across client.ts, types.ts, both scripts, apps/web types.ts | No matches | ✓ PASS |
| Live Notion mark-then-requery (DATA-01/02) | `npx tsx packages/core/scripts/verify-phase-1.ts` | Not run — no `NOTION_TOKEN`/`NOTION_DATABASE_ID` in this environment | ? SKIP → human_needed |
| Live Notion 403 capability (DATA-04) | `npx tsx packages/core/scripts/verify-403.ts` | Not run — requires live Notion Developer Portal access | ? SKIP → human_needed |

### Probe Execution

No `scripts/*/tests/probe-*.sh`-style probes declared or found for this phase; the plan's own "manual verification scripts" (`verify-phase-1.ts`, `verify-403.ts`) serve that role and are covered under Behavioral Spot-Checks / Human Verification above. Step 7c: SKIPPED (no conventional probe files; manual scripts are the phase's documented equivalent, already assessed).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 01-01-PLAN.md | `NologClient` can query all public posts not yet marked `Emailed` | ✗ BLOCKED (partial) | Method exists, compiles, structurally correct filter *shape* — but CR-01's property-casing defect means the query will 400 against any workspace using the canonical `"Status"` property name. REQUIREMENTS.md currently marks this `[x]` Complete; that checkbox is premature pending CR-01 resolution + a live-Notion mark-then-requery PASS. |
| DATA-02 | 01-01-PLAN.md | `NologClient` can mark a post as `Emailed` after a successful send | ? NEEDS HUMAN | Write path (`markEmailed`/`patchPage`) correct by code inspection (D-04 minimal body honored); durability/visibility-on-requery claim unverified against live Notion in this environment. |
| DATA-04 | 01-01-PLAN.md | `markEmailed` distinguishes a 403 from other failures in its logs | ? NEEDS HUMAN | `NotionCapabilityError` present, `instanceof`-checkable, status-code-first (correct by code inspection); never exercised against a real 403 in this environment. |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly DATA-01, DATA-02, DATA-04 to Phase 1 (DATA-03 correctly deferred to Phase 2, out of this phase's plan `requirements:` list and scope).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/src/client.ts` | 226, 259 (vs. 114) | Property-key casing inconsistency: query filters hardcode lowercase `"status"` while `mapPageToPost` and `types.ts` treat `"Status"` as canonical | 🛑 Blocker (carried forward from 01-REVIEW.md CR-01; pre-existing in `getPosts()`, newly inherited into this phase's `getUnemailedPublicPosts()`) | Breaks the phase's own primary success criterion (DATA-01/SC#2) for any workspace following the documented canonical schema name |
| `packages/core/src/client.ts` | 281-283, 368-370 | Fragile substring/regex matching (`/Emailed/i` + `/propert/i`) to detect the D-01 missing-property case, explicitly self-flagged as unverified | ⚠️ Warning (carried forward from 01-REVIEW.md WR-02; matches this plan's own explicitly-disclosed open item) | `MissingEmailedPropertyError` may never fire, or may misfire, until validated against a real Notion error body |
| `packages/core/scripts/verify-phase-1.ts`, `verify-403.ts` | 19-20 each | Non-null assertions (`process.env.NOTION_TOKEN!`) instead of an explicit guard | ℹ️ Info (carried forward from 01-REVIEW.md IN-02) | Missing env vars would produce a confusing `Authorization: Bearer undefined` 401 rather than a clear setup message — low severity, scripts are developer-run manual tools, not user-facing |

No new anti-patterns beyond what 01-REVIEW.md already surfaced; this verification cross-checked each against the current source and confirms they remain present/unresolved as of this report.

### Human Verification Required

See `human_verification` in frontmatter for the full list (mark-then-requery, 403 capability, missing-property reconciliation, and CR-01 schema-casing confirmation). Summary:

1. **Mark-then-requery (DATA-01/02, SC#1-3)** — run `verify-phase-1.ts` against a live Notion test DB.
2. **403 capability (DATA-04, SC#4)** — run `verify-403.ts` with "Update content" temporarily revoked.
3. **Missing-property detection (D-01)** — temporarily remove the `Emailed` property; confirm/adjust the regex-based detection to match Notion's real error shape.
4. **CR-01 schema-casing confirmation** — check whether the target production Notion workspace's Status property is actually named `"status"` (lowercase) or `"Status"` (capital, per the codebase's own documented convention); if capital, the filter must be fixed before items 1-3 can even run without erroring on the query itself.

### Gaps Summary

One gap blocks full goal achievement: **CR-01** (property-name casing mismatch between the query filters and the file's own documented canonical `"Status"` property name) is a real, statically-provable defect — not merely an "unverified" runtime assumption — that would cause `getUnemailedPublicPosts()` (and the pre-existing `getPosts()`) to fail against any workspace following the codebase's own documented convention. This was already surfaced as a Critical finding in `01-REVIEW.md` prior to this verification pass and is carried forward here, not newly discovered.

Beyond that one gap, the remaining four must-haves are correctly implemented and wired by every check static analysis can perform (build passes, typecheck passes, no token/header leak, no debt markers, correct body/filter shapes, status-code-first error gating) but require a live Notion workspace to prove behaviorally — which is legitimately outside this environment (no `NOTION_TOKEN`/`NOTION_DATABASE_ID` configured), exactly as the plan's own `user_setup` block anticipated. These are appropriately routed to human verification, not treated as failures.

Recommended next step: resolve CR-01 (confirm the live schema's actual casing, or fix the filter key to `"Status"` with an explicit forker-facing documented convention), then have a human run the three manual verification scripts/checks against a real Notion test workspace before considering DATA-01/02/04 fully done and advancing past Phase 1 sign-off.

---

_Verified: 2026-07-25T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
