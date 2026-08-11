---
phase: 09-thumbnail-freshness
plan: 02
subsystem: verification
tags: [vercel, deploy, ssrf-guard, fault-injection, browser-observation, cdn-cache, rsc]

requires:
  - "09-01 — the proxy route, the shared PostThumbnail component, and the four-surface rollout"
provides:
  - "Deploy SHA 9c3cc9c live in production, proven live by a status the pre-deploy site cannot produce"
  - "Tier 2 of 09-EVIDENCE.md — controlled-origin guard probes, deployed route battery, IMG-04 browser observation, IMG-05 coverage gap, served-HTML baseline"
  - "An open idle window with a recorded UTC start time for 09-03 to measure from"
affects: [thumbnail-freshness-plan-03]

actuals:
  tokens: 6881
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Fault-injection-then-proven-revert for guards that cannot be exercised against real third-party assets: a loopback origin plus an env-gated fetch override, reverted under a two-part gate (clean worktree path + zero residue of the gate literal) before anything is pushed"
    - "A control probe alongside every fault probe — the image-control 200 is what makes the two 502s legible as guards firing rather than a broken harness"
    - "Capture the pre-deploy response before pushing, so the post-deploy liveness status has a recorded control to be compared against"

key-files:
  created:
    - ".planning/phases/09-thumbnail-freshness/09-02-SUMMARY.md"
  modified:
    - ".planning/phases/09-thumbnail-freshness/09-EVIDENCE.md"

key-decisions:
  - "Task 2's real post id was resolved from the LOCAL production server's home-page HTML rather than the deployed site's, overriding this plan's own <verify> block which curls the deployed `/`. Reason: the deployed `/` must not be requested during task 2, and task 3 performs that check anyway before the clock starts."
  - "IMG-04's failure was produced by repointing each thumbnail at the route's own 400 path rather than by a devtools blocking rule — /browse exposes no request-blocking command and Network.setBlockedURLs is absent from its CDP allowlist. The substitute produces a genuine failed request through the shipped route, arguably closer to IMG-04's wording than blocking."
  - "The RSC flight-payload finding was recorded and raised, not patched. Fixing it means narrowing the client component's prop interface — an architectural change, and outside this plan's file scope (task 3 may modify only 09-EVIDENCE.md)."
  - "Production Notion content was not modified to manufacture an external-thumbnail post for IMG-05, per the plan's explicit prohibition; the gap is recorded instead."

requirements-completed: []

coverage:
  - id: D1
    description: "Redirect-refusal and content-type guards observed firing against a controlled loopback origin, with a working image control proving the harness itself was correct"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → IMG-03 guards, rows T2-1/T2-2/T2-3 — 502 + 0 bytes, 502 + 0 bytes, 200 + 70 bytes with the locked origin cache header"
        status: pass
    human_judgment: false
  - id: D2
    description: "Host-allowlist guard — source-asserted only, NOT exercised"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 1 row 8b (exactly 2 allowlisted hostnames) — no live exercise; the host is chosen by Notion at presign time and cannot be forced off-allowlist"
        status: gap
    human_judgment: false
    rationale: "Exercising it would require a Notion page whose thumbnail resolves to a host outside next.config.ts's allowlist, which this project cannot construct. Recorded as source-asserted and unexercised, in those words."
  - id: D3
    description: "Fault injection provably reverted before the push; the deploy shipped exactly what was verified locally"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → Revert gate: apps/web/src clean, zero THUMBNAIL_TEST_ORIGIN residue, route file byte-identical, build exit 0, both harness ports down. Re-asserted at push time across apps and packages."
        status: pass
    human_judgment: false
  - id: D4
    description: "Deployed route answers 400 for a garbage id — a status the pre-deploy site structurally cannot produce — and the full deployed guard battery behaves as specified"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → Deployed route battery, T2-4..T2-9 plus the pre-deploy baseline row (404 + 40,884 bytes of framework HTML)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An appended query string produces a byte-identical response — the positive form of the no-caller-supplied-URL claim"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md T2-7 vs T2-8: identical status, content type and 1,561,628-byte length; combined with Tier 1 row 8a (zero searchParams)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The deployed response does NOT carry s-maxage=14400; Vercel's edge consumes the directive. D-06's purpose is satisfied and demonstrated, but the must_haves truth's literal wording is not."
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → 'Correction: the s-maxage directive is not observable on the deployed response' — five-link chain: source grep, local origin output, deployed HIT, deployed MISS, MISS-to-HIT transition proving the CDN stored it"
        status: partial
    human_judgment: false
    rationale: "Behaviour correct and directly demonstrated; the assertion as written was authored against the origin's output and is unobservable through Vercel's edge. Needs a documentation correction, not a code change."
  - id: D7
    description: "IMG-04's placeholder confirmed by eye and by DOM measurement at 32px (card) and 48px (hero) in both light and dark themes, no caption, no broken-image glyph"
    requirement: "IMG-04"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → IMG-04, rows T3-1..T3-8; screenshots read back during execution; wrapper classes byte-identical to 09-UI-SPEC.md"
        status: pass
    human_judgment: false
    rationale: "Closes 09-01's D5 human_judgment gap. Agent-observed in a real headless browser, not operator-pending."
  - id: D8
    description: "IMG-05's live half — UNEXERCISED. The operator's database contains no external-thumbnail post."
    requirement: "IMG-05"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → IMG-05: 3 distinct post ids all routing through the proxy, zero absolute-URL img srcs on either page"
        status: gap
    human_judgment: false
    rationale: "All three public posts are Notion-hosted file thumbnails. IMG-05 rests on 09-01's two source assertions (the component's external branch, the route's non-file 404). Production content deliberately not mutated to manufacture the case."
  - id: D9
    description: "Served HTML carries the stable post-id-keyed path in every img src and zero presigned URLs in any img src — IMG-01/IMG-02's structural half"
    requirement: "IMG-01, IMG-02"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → Served-HTML baseline capture: home 48 proxy-path hits / post 17; amazonaws inside an img src = 0 on both pages"
        status: pass
    human_judgment: false
  - id: D10
    description: "Presigned URLs remain embedded in the RSC flight payload (3 on home, 1 on post) because the client component receives the whole Post object. Inert for rendering; the must_haves truth as worded is false."
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 2 → 'Finding: a presigned URL is still embedded in the RSC flight payload'"
        status: gap
    human_judgment: true
    rationale: "Needs an operator decision. Not a regression (exposure strictly reduced versus before the fix, which carried the URL in the img src too) and not a blocker for the idle-window test, but a live read grant does sit in public CDN-cached markup. The fix is a component prop-interface change, outside this plan's scope."

duration: ~40min (including a pause for push authorization)
completed: 2026-08-11
status: complete
---

# Phase 9 Plan 02: Deploy, Prove the Guards, Start the Clock Summary

**Shipped the thumbnail fix to production as `9c3cc9c`, upgraded two of the four IMG-03 guards from
source-assertion to observed against a controlled loopback origin under a proven-reverted fault
injection, ran the full deployed guard battery, confirmed the `ImageOff` placeholder by eye at both
sizes in both themes, and opened the phase's single idle window at 2026-08-11T12:13:13Z.**

## Performance

- **Duration:** ~40 min, including a pause while the production push was authorized
- **Completed:** 2026-08-11T12:16Z
- **Tasks:** 3
- **Files modified:** 1 (`09-EVIDENCE.md`); zero source files, by design

## Task Commits

| Task | Commit | Type |
|------|--------|------|
| 1 — controlled-origin guard probes + proven revert | `dbb01e7` | docs |
| 2a — pre-deploy liveness baseline (captured during the authorization pause) | `9c3cc9c` | docs |
| 2b — deployed guard battery | `b4df8ba` | docs |
| 3 — IMG-04 / IMG-05 / served-HTML baseline / idle window | `51f8c1b` | docs |

`9c3cc9c` is both a task-2 commit and the deploy SHA — it is the commit the push shipped.

## Accomplishments

- **Two guards upgraded from inferred to observed.** A throwaway Node origin on loopback answered a 302,
  an HTML 200, and a PNG 200; the route refused the first two with `502` and a zero-length body, and the
  harness's sentinel HTML body never reached the caller. The image control returned `200 image/png` with
  the locked cache header, which is what makes the two refusals legible as guards firing rather than as a
  broken harness.
- **The fault injection never reached a commit,** let alone the deploy. Gated twice: at the end of task 1
  (clean `apps/web/src`, zero residue of the gate literal, route file byte-identical to its committed
  state) and again immediately before the push across `apps` and `packages`.
- **The deploy is proven live by a status the pre-deploy site cannot produce.** The pre-deploy baseline
  was captured before pushing: `404` with 40,884 bytes of framework 404 HTML. After the deploy the same
  URL answers `400` with an empty body.
- **Full deployed battery green on every status:** garbage `400`, absent UUID `404`, URL-as-id `400`,
  real id `200 image/png 1561628`, real id plus an off-site query string byte-identical, mangled id `200`
  with its word-boundary reasoning written down for future readers.
- **IMG-04 closed by direct observation,** retiring 09-01's `human_judgment: true` gap: 32×32 on the card
  and 48×48 on the hero, `rgb(155,154,151)` on `rgb(247,246,243)` in light and `rgb(107,107,107)` on
  `rgb(37,37,37)` in dark — exact matches to the UI-SPEC tokens — with empty wrapper text and zero `<img>`
  left to render a broken-image glyph.
- **The idle clock is running** with its start time, its earliest permissible cold load, and the rule that
  any request restarts it, all recorded in UTC.

## Deviations from Plan

### 1. [Environment] The push was refused, then performed by the orchestrator

`git push origin main` was denied by the execution environment's permission classifier, not by any gate
in this plan. I stopped rather than routing around it, returned a checkpoint, and the orchestrator pushed
after independently re-verifying all four pre-push gates. Recorded because the plan assumed the executor
would push.

**Silver lining, and it is a real one:** the pause is what produced the pre-deploy baseline row. Without
it the liveness check would have had no recorded control to be compared against.

### 2. [Scope discipline] The real post id came from the local server, not the deployed home page

This plan's own `<verify>` block for task 2 resolves the id with `curl -s $S/ | grep …`. That is a request
to the deployed `/`, which task 2 must not make. The id was taken instead from the local production
server's home-page HTML during task 1. Both read the same Notion database, and task 3 performed the
deployed home-page check anyway, before the clock — so nothing was lost.

### 3. [Tooling] IMG-04's failure was induced by repointing, not by blocking

`/browse` (mandated by this project's `CLAUDE.md` for all web browsing) exposes no request-blocking
command, and `Network.setBlockedURLs` is not in its CDP allowlist. Each thumbnail `<img>` was instead
repointed at `/api/thumbnail/not-a-real-id`, which the deployed route answers `400`. That is a genuine
failed request travelling through the shipped route's own refusal path, so the real `onError` fires.

### 4. [Pre-existing] Lint exits 1, not 0

`✖ 18 problems (14 errors, 4 warnings)`, all in `Profile.tsx`, `MermaidBlock.tsx`, and three
`templates/terminal/` files. None is among phase 9's seven files. This is the pre-existing set Tier 1
already recorded and confirmed present on `main`; the repo's bar is "no new errors from this plan's
files" (STATE.md, Phase 7 Plan 01 precedent). Out of scope to fix, recorded rather than passed silently.

## Findings That Need an Operator Decision

### A. A presigned URL is still embedded in the RSC flight payload

Three on the home page, one on the post page. Every one sits inside a `self.__next_f.push([...])` script,
**none** in an `<img>` `src`. Cause: `PostThumbnail` is a Client Component receiving the whole `post`
object, so React serialises `post.thumbnail` for hydration even though the file-type branch never reads
it.

- **Impact on this phase's goal: none.** No `<img>` carries an expiring URL, so 09-03's idle-window test
  remains valid and meaningful.
- **Impact on security: an improvement, not a regression, and not a fix.** Before this phase the URL was
  in the `<img>` `src` *and* the payload; now only the payload. But a live read grant does sit in public,
  CDN-cached markup, and `/` is prerendered with a long expiry.
- **The `must_haves` truth "the expiring value is no longer embedded anywhere in cached markup" is false
  as written** and is recorded as false rather than narrowed to the elements where it holds.
- **Suggested follow-up:** narrow the component's props to the values the client actually needs, so
  `post.thumbnail` never crosses the client boundary for file-type thumbnails. Not done here — it is a
  component-interface change and task 3's file scope is `09-EVIDENCE.md` alone.

### B. `s-maxage=14400` is not observable on the deployed response

The deployed header is `public, immutable`. Vercel's edge consumes `s-maxage` and does not forward it.
D-06's *purpose* is satisfied and was demonstrated directly — a cache-busted URL went `MISS` then `HIT`
with `age: 2`, and only `s-maxage` supplies the shared-cache lifetime that storage requires. The
`must_haves` truth needs rewording to name the origin rather than the deployed response.

## Known Gaps (carried into 09-03 and phase verification)

| Gap | Status | Why |
|-----|--------|-----|
| Host-allowlist guard | source-asserted, **unexercised** | Notion chooses the presign host; it cannot be forced off-allowlist |
| IMG-05 live half | **unexercised** | No external-thumbnail post exists in the operator's database; production content deliberately not mutated |
| IMG-01 / IMG-02 behavioural half | **pending 09-03** | Needs the idle window; structural half observed here |
| RSC flight-payload exposure | **open, needs a decision** | See Finding A |
| D-06 truth wording | **needs correcting** | See Finding B |

## Next Phase Readiness

- **The idle window is open and must not be disturbed.** Start `2026-08-11T12:13:13Z`, earliest cold load
  `2026-08-11T13:23:13Z`. Any request of any kind — automated check, link preview, uptime monitor, an open
  browser tab — restarts it from zero.
- The headless browser was navigated off the site and its daemon shut down before the clock was taken;
  confirmed zero browse-daemon processes remain and no process holds the site host in its command line.
- 09-03 needs only the cold load and the raw-origin-URL read (PITFALLS 14). Everything cheap is already
  banked in Tier 2.
- `origin/main` is at `9c3cc9c`; this plan's three later doc commits are local and carry no source
  changes, so they can ship whenever without re-triggering a meaningful deploy — though **pushing before
  13:23:13Z would redeploy and invalidate the window.** Do not push until 09-03 is done.

---
*Phase: 09-thumbnail-freshness*
*Completed: 2026-08-11*
