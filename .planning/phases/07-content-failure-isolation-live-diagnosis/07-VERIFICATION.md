---
phase: 07-content-failure-isolation-live-diagnosis
verified: 2026-08-10T00:00:00Z
status: passed
score: 3/4 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:

  - truth: "SC#3/SC#4's live halves — a chrome-leg failure leaving the body rendering (SC#3), and a transient getPost()-adjacent failure rendering PostUnavailable instead of a 404 (SC#4)"
    test: "Induce a genuine failure of getCategories()/related-posts getPosts() (SC#3), or a genuine non-404 failure on classifyMissingPost()'s api.notion.com/v1/pages/{id} discriminator call (SC#4), against the deployed Production site, then observe the render"
    expected: "SC#3: the post body still renders, with a [PostPage:chrome] log line for that request. SC#4: a plain-200 'This post is temporarily unavailable' card renders instead of a 404, with a [PostPage:post] log line."
    why_human: "No test infrastructure exists in this repo (explicitly out of scope), so no automated test can exercise either state transition. The capture window in 07-EVIDENCE.md happened to hit neither failure path live — getPost() and the chrome fetches both succeeded on every observed request — so the code's correctness for these two paths rests on static/structural verification only, not a live-observed transition."
human_verification:

  - test: "Confirm, on the deployed Production site (or a forced-failure rehearsal against it), that a categories/related-posts failure still renders the post body with a [PostPage:chrome] log line."
    expected: "Post title, metadata, and body all render; categories/related-posts silently degrade to empty; the failure is visible only in the Vercel log under the [PostPage:chrome] prefix."
    why_human: "Requires a live Notion/Vercel failure or a deliberate fault injection against Production; PITFALLS 12 rules out next dev, and this repo has no test harness to simulate it."

  - test: "Confirm, on the deployed Production site, that a genuine transient failure of the getPost()-adjacent discriminator (classifyMissingPost) renders the PostUnavailable card at HTTP 200 rather than a 404."
    expected: "'This post is temporarily unavailable' card renders (CloudOff icon, exact heading/body copy, Back to feed link) with a [PostPage:post] log line; notFound() is not reached."
    why_human: "Same as above — the 07-03 capture window never induced this failure (getPost() succeeded on every observed request), so PostUnavailable's live reachability is confirmed only by source review, not observation."
---

# Phase 7: Content Failure Isolation & Live Diagnosis Verification Report

**Phase Goal:** The operator can tell, from production logs, exactly which call in the post-detail render failed — and a failure in the page's chrome no longer blanks the post body
**Verified:** 2026-08-10
**Status:** passed *(was `human_needed` at first writing — see the CORRECTION at the end of this file; the frontmatter has read `passed` since `/gsd-verify-work 7` canonicalized it)*
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | A production log line names which one of the three fetches failed | ✓ VERIFIED | `07-EVIDENCE.md` pastes six byte-identical `[PostPage:recordMap]` production log lines (2026-08-09 16:51 UTC) naming exactly the content leg; `[PostPage:chrome]`/`[PostPage:post]` recorded as "no matches in the retention window." Code: `apps/web/src/app/post/[id]/page.tsx` has two independent `try`/`catch` blocks (content, then chrome), each logging under a distinct bracket prefix (`[PostPage:recordMap]`, `[PostPage:chrome]`) built from `describeFetchFailure()`. |
| 2 | Live evidence captured against production, recorded against the six-candidate table with a named verdict | ✓ VERIFIED | `07-EVIDENCE.md` (status: complete) reproduces PITFALLS.md Pitfall 5's six-candidate table verbatim, judges each row against a pasted observation (1 confirmed, 5 eliminated, 0 inconclusive), and names a verdict: Cloudflare answering `notion-client`'s default `user-agent: node` with a 403 challenge page, confirmed by a single-variable User-Agent experiment. Capture context records `Environment: production`, deployment `dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz`, commit `a6becd8`. |
| 3 | A chrome-level failure no longer blanks the post body (structural + live) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **Structural half VERIFIED** by source read: `apps/web/src/app/post/[id]/page.tsx` lines 115–145 — content leg (`getPageRecordMap`) and chrome leg (`getCategories`/`getPosts`) are two fully independent `try`/`catch` blocks; a chrome-leg exception only resets `categories`/`relatedPosts` to `[]` and cannot touch `recordMap`, which was already assigned (or already nulled) by the preceding, separate content-leg block. `07-REVIEW.md` confirms this on independent adversarial read. **Live half unexercised**: `07-EVIDENCE.md`'s Repeated-Load Observations section explicitly records the chrome leg never failed during the capture window (official-API calls all served `Using cache`), so no `[PostPage:chrome]` line was ever produced and the body-survives-chrome-failure behavior was never observed live. `07-EVIDENCE.md` and `07-03-SUMMARY.md` both self-report this as "structural only," not silently claimed as verified. |
| 4 | A post that exists and is public never 404s because of a content-fetch failure (structural + live) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **Structural half VERIFIED** by source read: `apps/web/src/lib/post-availability.ts`'s `classifyMissingPost()` is called only inside `page.tsx`'s `if (!post)` branch, issues one `cache: "no-store"` GET to `api.notion.com/v1/pages/{parsePageId(id)}`, and resolves to `"unavailable"` (renders `<PostUnavailable />` at 200, logs `[PostPage:post]`) for any non-404/non-2xx response or a thrown fetch, or `"missing"` (falls through to the sole, unmoved `notFound()`) for a Notion-authoritative 404 or a fetchable-but-non-public page. `notFound()` appears exactly once in the file and sits outside every `try`. `PostUnavailable.tsx` matches `07-UI-SPEC.md`'s contract (`CloudOff`, `text-warning`, exact heading/body copy, `max-w-md`, no `use client`, no locale branching). `07-REVIEW.md` independently confirmed this control flow terminates cleanly and never throws. **Live half unexercised**: `07-EVIDENCE.md` explicitly records that `getPost()` succeeded on every one of the five repeated Production loads (`<title>` rendered every time), so the `!post` branch — and therefore `classifyMissingPost`/`PostUnavailable` — was never entered during capture. `PostUnavailable` is reachable code, not dead code, but has zero live observations of actually rendering. |

**Score:** 2/4 truths fully VERIFIED, 2 truths PRESENT_BEHAVIOR_UNVERIFIED (present, wired, structurally correct, live behavior not exercised) — 3/4 counted in the must-haves score below because SC#3/SC#4 are graded once as a pair of behavior-dependent items requiring human sign-off, not as code failures.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/src/lib/notion-x.ts` | Env-gated deep-diagnostic capture + D-04 probe; exports `getPageRecordMap`, `isDiagnosticsEnabled`, `describeFetchFailure` | ✓ VERIFIED | All three exports present; `getPageRecordMap` still rethrows unchanged; `describeFetchFailure` gates deep fields on `NOTION_DEBUG_DIAGNOSTICS === "1"`; F-01 fix (validate `parsePageId` before the probe, never fall back to raw id) confirmed present at lines 129–134. |
| `apps/web/src/app/api/diagnose-page/route.ts` | Secret-gated on-demand `getPageRecordMap` failure reproduction | ✓ VERIFIED | Double gate (`isDiagnosticsEnabled()` AND `safeCompare` bearer secret) checked first; any gate failure returns byte-identical bare 404; `parsePageId` validated before any outbound call (400 on failure, before network); success returns block-count only. |
| `apps/web/src/app/post/[id]/page.tsx` | Per-concern catch decomposition + `notFound()` scoping | ✓ VERIFIED | Two independent `try`/`catch` blocks (content, chrome), `classifyMissingPost` gating `notFound()` vs `PostUnavailable`, `D-17 audit` comment present and accurate against actual `await`s, `generateMetadata`'s not-found branch carries `robots: { index: false }`. |
| `apps/web/src/lib/post-availability.ts` | Genuine-404 vs transient-failure discriminator | ✓ VERIFIED | `classifyMissingPost` exports as specified; never throws (fetch wrapped in try/catch returning `"unavailable"`); unconfigured-token and invalid-id branches short-circuit before any network call. |
| `apps/web/src/components/PostUnavailable.tsx` | Reader-facing transient-unavailable state | ✓ VERIFIED | Matches `07-UI-SPEC.md` contract exactly (heading, body copy, `max-w-md`, `CloudOff`/`text-warning`, `Back to feed`); no `use client`, no `CONFIG`/locale import, no fixed-height class. |
| `.planning/phases/07-content-failure-isolation-live-diagnosis/07-EVIDENCE.md` | D-08 gate artifact | ✓ VERIFIED | `status: complete`; six-candidate table fully judged; verdict named; Operator Checklist, Raw Evidence, Repeated-Load Observations, Closeout, Hand-off to Phase 8 all present and substantive. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `post/[id]/page.tsx` | `lib/notion-x.ts` | imports `describeFetchFailure`, calls it in both catch blocks | ✓ WIRED | Confirmed by source read at lines 119 and 142. |
| `api/diagnose-page/route.ts` | `lib/notion-x.ts` | imports `getPageRecordMap` + `describeFetchFailure` + `isDiagnosticsEnabled` | ✓ WIRED | Confirmed at route.ts line 3. |
| `post/[id]/page.tsx` | `lib/post-availability.ts` | calls `classifyMissingPost(id)` in the `!post` branch before `notFound()` | ✓ WIRED | Confirmed at page.tsx line 72. |
| `post/[id]/page.tsx` | `components/PostUnavailable.tsx` | returns `<PostUnavailable />` when verdict is `unavailable` | ✓ WIRED | Confirmed at page.tsx line 76. |
| `07-EVIDENCE.md` | `research/PITFALLS.md` | six-candidate table reproduced verbatim | ✓ WIRED | All six candidate-cause labels present verbatim in `07-EVIDENCE.md`, cross-checked against `PITFALLS.md` Pitfall 5. |
| `07-EVIDENCE.md` | `api/diagnose-page/route.ts` | raw response body pasted verbatim as evidence | ✓ WIRED | Three `record_map_failed` diagnostic payloads pasted verbatim in the Raw Evidence section. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase's own files lint clean | `npx eslint` on the five changed files (apps/web dir) | zero errors/warnings | ✓ PASS |
| Phase's own files build clean | `npm run build --workspace=apps/web` | "Compiled successfully," TypeScript passes, `/api/diagnose-page` and `/post/[id]` both listed as dynamic routes | ✓ PASS |
| `packages/core` untouched | `git status --short packages/` and `git log --oneline -- packages/core/` | no diff; no phase-7 commit touches `packages/core` | ✓ PASS |
| No new dependencies | `git log --oneline -10 -- package.json apps/web/package.json package-lock.json` | no phase-7 commit in that list | ✓ PASS |
| No `error.tsx` added | `find apps/web/src/app -iname "error.tsx"` | no results | ✓ PASS |
| F-01 review fix present in shipped code | Read `notion-x.ts:119–134` | `parsePageId` validated before the D-04 probe fires; refuses (`probeSkipped: "unparseable_page_id"`) rather than falling back to the raw id | ✓ PASS |

Full `npm test`-equivalent run: N/A — repo has zero test infrastructure by design (REQUIREMENTS.md Out of Scope); this is expected and not a gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CONT-01 | 07-01 | Operator can tell, from production logs, which fetch failed | ✓ SATISFIED | Leg-named catch decomposition shipped and confirmed live in `07-EVIDENCE.md` (six identical `[PostPage:recordMap]` lines, zero `[PostPage:chrome]`/`[PostPage:post]` lines). REQUIREMENTS.md marks `[x]`. |
| CONT-02 | 07-03 | Operator has captured real failure evidence, discriminated against `PITFALLS.md`'s six candidates | ✓ SATISFIED (substance) / documentation lag | `07-EVIDENCE.md` is complete with a named, well-evidenced verdict. **However, REQUIREMENTS.md line 28 still shows `[ ] CONT-02` (unchecked) and the Traceability table (line 105) still reads "Pending"** — the checkbox/table were not updated to reflect the completed deliverable. This is a documentation-sync gap, not a functional gap: the actual artifact fully satisfies the requirement text. Flagged as a non-blocking finding below. |
| CONT-04 | 07-01, 07-02 | A chrome-fetch failure no longer prevents the body from rendering | ✓ SATISFIED (structural) / ⚠️ live half unexercised | Catch decomposition is structurally correct and independently code-reviewed; live confirmation is the `behavior_unverified_items` entry above. REQUIREMENTS.md marks `[x]`, which is defensible given the structural closure is genuine and the live gap is honestly self-reported, but the live half is not yet independently observed. |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Traceability table maps exactly CONT-01/02/04 to Phase 7, matching all three plans' `requirements:` frontmatter.

### Anti-Patterns Found

None blocking. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no empty-implementation stubs, and no hardcoded-empty props found in any of the five phase-7 files. The one High-severity finding from code review (F-01, D-04 probe SSRF-adjacent fallback) was fixed in commit `2f4a349` and independently reconfirmed present in the current source during this verification. The one Medium finding (F-02, D-19 teardown/coupling risk) was resolved by revising the D-19 decision text (commit `f32b3fe`) rather than code, and is correctly scoped as forward-looking guidance for Phase 8, not a Phase 7 defect. Three Low findings (F-03 duplication, F-04 gate-log-on-unconfigured-fork, F-05 probe lacks explicit User-Agent) were explicitly accepted with recorded rationale — none are blocking and none contradict a locked decision.

### Human Verification Required

1. **Chrome-leg live failure → body still renders (ROADMAP SC#3 live half)**
   **Test:** Induce (or wait for/observe) a genuine failure of `getCategories()` or the related-posts `getPosts()` against the deployed Production site, then load `/post/<id>`.
   **Expected:** Post title, metadata, and body all render normally; categories/related-posts silently degrade to empty; the only trace of the failure is a `[PostPage:chrome]` line in the Vercel dashboard log for that request.
   **Why human:** No test framework exists in this repo (explicitly out of scope per REQUIREMENTS.md), and `next dev` cannot reproduce production-only failures (PITFALLS 12). The 07-03 capture window happened not to hit this failure path — code correctness here rests on static review only.

2. **Transient `getPost`-adjacent failure → `PostUnavailable` renders instead of 404 (ROADMAP SC#4 live half)**
   **Test:** Induce (or wait for/observe) a genuine non-404, non-2xx response (or thrown fetch) from `classifyMissingPost`'s `api.notion.com/v1/pages/{id}` call against the deployed Production site, for a page that is genuinely public, then load `/post/<id>`.
   **Expected:** A plain-HTTP-200 "This post is temporarily unavailable" card renders (CloudOff icon, exact copy, "Back to feed" link) instead of a 404; a `[PostPage:post]` log line records the detail.
   **Why human:** Same constraint as above — `getPost()` succeeded on every request during the 07-03 capture window, so the `!post` branch (and therefore `PostUnavailable`) was never entered live. The component is reachable code by source review, not confirmed-reachable by observation.

### Gaps Summary

No BLOCKER-level gaps. Everything the phase's own must-haves and ROADMAP's four success criteria require to exist and be wired does exist and is wired, confirmed independently against the live codebase (not just the SUMMARY.md narrative): both catches are genuinely separated, `notFound()` is genuinely scoped behind a never-throwing discriminator, `PostUnavailable` is genuinely reachable code (not dead code), the F-01 SSRF-adjacent probe fix is genuinely present, `packages/core` and dependency manifests are genuinely untouched, and `07-EVIDENCE.md` genuinely contains a well-evidenced, honestly-caveated verdict for SC#1/SC#2.

The phase's own artifacts (`07-EVIDENCE.md`, both `07-01`/`07-02`-SUMMARY.md coverage sections, and `07-03-SUMMARY.md`) already self-report — accurately, on independent re-check — that SC#3 and SC#4's live halves are "structural only" / "unexercised, not failed." This verification confirms that self-report is honest rather than a way of papering over a gap: the code is real, correct on read, and independently code-reviewed, but genuinely has zero live observations of the two state transitions it introduces (chrome-failure-survives, transient-failure-shows-PostUnavailable). Per this verifier's instructions, that combination (present + wired + structurally correct, but behavior unexercised) routes to `human_needed`, not `passed` — under-claiming rather than over-claiming.

Two non-blocking findings, neither affecting the phase's core goal achievement:

- **REQUIREMENTS.md documentation lag on CONT-02.** `07-EVIDENCE.md` is genuinely complete with a named verdict, but `.planning/REQUIREMENTS.md` line 28 still shows `[ ] CONT-02` and its Traceability table (line 105) still reads "Pending." The substance of CONT-02 is satisfied; only the tracking document wasn't updated to match. Recommend flipping the checkbox and the traceability status before or during Phase 8 planning.
- **`.planning/STATE.md` missing plan 07-03's verdict entry.** Plan 07-03's own acceptance criteria (`07-03-PLAN.md` Task 3) required "`.planning/STATE.md` carries a new one-line entry naming the verdict," so a later session doesn't have to reopen `07-EVIDENCE.md` to know the outcome. Plan 07-01's and 07-02's one-line entries are present in STATE.md's Accumulated Context (lines ~110–112), but no equivalent entry naming the Cloudflare/User-Agent verdict from plan 07-03 was found. Minor, easily fixed, does not affect any code artifact.

D-19's teardown of the diagnostic instrumentation (`NOTION_DEBUG_DIAGNOSTICS`, `NOTION_DEBUG_ROUTE_SECRET`, `/api/diagnose-page`, `describeFetchFailure`) is correctly **not** treated as a Phase 7 gap — `07-CONTEXT.md` explicitly assigns that teardown to Phase 8, to land in the same deploy as the fix.

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_

---

## Closure — status moved `human_needed` → `passed` (2026-08-10)

**Appended, not rewritten.** Every finding above is the original verdict and is unchanged. This section
records only why the frontmatter status moved, so the change is not silent.

This report scored **3/4** and routed to `human_needed` because SC#3 and SC#4 were
`PRESENT_BEHAVIOR_UNVERIFIED` — the code was present, wired, and confirmed correct on read, but neither state
transition had ever been observed. That was the correct call at the time and is not being revised.

**What closed it.** Phase 8 plan 08-03 ran both tests under D-15 and observed both transitions. Recorded in
`07-UAT.md` with timestamps:

- **SC#3** — an env-gated forced throw in the chrome leg left the post body rendering at HTTP 200, with
  exactly one `[PostPage:chrome]` line and **zero** `[PostPage:recordMap]` lines. The fault was reverted and
  the working tree confirmed clean.
- **SC#4** — both directions exercised: an absent UUID returns **404**; a wrong `NOTION_TOKEN` returns **200**
  with the `PostUnavailable` card inside normal page chrome and one
  `[PostPage:post] {"verdict":"unavailable","reason":"notion-error"}` line. The two are visibly different.

**Why the test only became meaningful after Phase 8.** Until the User-Agent fix landed, the content leg was
failing for an unrelated reason, so "the body did not render" was ambiguous between two causes. Plan 08-03
established the body rendering as a baseline *before* injecting the fault — which is what makes SC#3's first
item an observation rather than a coincidence. This report's own `human_needed` routing is what forced that
ordering.

**One item deliberately left unticked** in `07-UAT.md`: `PostUnavailable`'s light/dark rendering was verified
structurally (the served HTML uses the `text-warning` token, not a raw colour) but **never viewed in a browser
under both themes**. Recorded as `unexercised` with that reason. It is not what SC#4 asserts, so it does not
hold SC#4 open — but it is not claimed either.

**Also completed after this report was written:** `07-SECURITY.md` (SECURED, 19/19 threats closed, 0 open) and
`COVERAGE.md` (a reasoned no-external-API-integration declaration resolving the `api-coverage.verify-pre`
gate). Neither existed when the 3/4 score was assigned.

*Status changed during `/gsd-verify-work 7`, per that workflow's canonicalization step, after both UAT items
resolved with zero issues.*

---

## CORRECTION (2026-08-14, v1.1 milestone audit)

**What changed:** the body header at the top of this report read `**Status:** human_needed` while the
frontmatter read `status: passed`. The header is now corrected. Nothing about the findings below
changed.

**Why the two disagreed.** This report was written at 3/4 must-haves with SC#3 and SC#4 recorded
`PRESENT_BEHAVIOR_UNVERIFIED` — structurally verified by source read, live half unexercised because
`07-EVIDENCE.md`'s capture window never produced a chrome-leg failure or a `!post` branch entry. Both
were closed afterwards, by plan 08-03 under D-15, and `/gsd-verify-work 7` then canonicalized the
frontmatter to `passed`. The sections above already record those closures in detail; only the header
line was left behind.

**Do not read the `behavior_unverified_items` frontmatter block as open.** It is the record of what was
unverified *at the time this report was written*, preserved deliberately rather than deleted. The
closures are documented in the "Goal Achievement" detail above, in `07-UAT.md` (`status: complete`),
and in `STATE.md`'s Phase 8 Plan 03 entry.

**Found by:** the v1.1 milestone audit's 3-source requirements cross-reference, which flagged CONT-02
as `partial` because it appears in no SUMMARY's `requirements_completed` frontmatter — `07-03-SUMMARY.md`
omits that key entirely. Manual verification confirmed CONT-02 genuinely satisfied
(`07-EVIDENCE.md` holds the captured 403 + `text/html` Cloudflare page, the six-candidate table, and a
named verdict). The requirement was never at risk; the cross-check source was simply absent.
