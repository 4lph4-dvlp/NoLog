---
phase: 09-thumbnail-freshness
plan: 03
subsystem: verification
tags: [vercel, idle-window, isr, data-cache, next-image, live-observation]

requires:
  - phase: 09-thumbnail-freshness (plan 02)
    provides: "Deploy SHA 9c3cc9c live in production, Tier 2 of 09-EVIDENCE.md, an open idle window with a recorded UTC start time"
provides:
  - "Tier 3 of 09-EVIDENCE.md — the idle-window cold-load evidence for IMG-01 and IMG-02"
  - "IMG-02's finding written honestly: observed as met, with its underlying mechanism recorded as MEDIUM confidence and unexercisable by this phase's own design"
  - "research/ARCHITECTURE.md §1's Full-Route-Cache attribution corrected in writing for /post/[id]"
  - "A closed 09-EVIDENCE.md — per-requirement summary across IMG-01..IMG-05, every unexercised item named with its reason"
affects: [phase-9-verification, gsd-verify-work]

actuals:
  tokens: 5824
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One-shot cold request captured whole (headers + body to file) before any second request, so every subsequent read is against the exact bytes the gap produced — not a re-request"
    - "Corroboration explicitly distinguished from establishing evidence in the record itself: the direct proxy-path request establishes IMG-01/IMG-02, a fresh cookie-less headless-browser pass corroborates, and the document states why the corroboration alone cannot prove it (the optimizer's 4-hour cache floor)"
    - "Independent machine corroboration of an operator attestation: the response's own forwarded `date` header (cache-generation time) compared against the recorded window-start timestamp, rather than relying on the attestation alone"

key-files:
  created:
    - ".planning/phases/09-thumbnail-freshness/09-03-SUMMARY.md"
  modified:
    - ".planning/phases/09-thumbnail-freshness/09-EVIDENCE.md"

key-decisions:
  - "The task 1 human-check's browser-corroboration half was NOT performed by the executing agent, per explicit instruction accompanying this run (D-13's spirit: do not fabricate or infer a human observation). Execution halted at a checkpoint after all machine-observable work was done, and the browser pass was subsequently performed and reported back by the orchestrator via gstack /browse in a freshly started, cookie-less headless Chromium session — recorded in those exact terms, not presented as a human incognito-window observation."
  - "The automated portion of task 1 (the one-shot cold request and its direct proxy-path follow-ups) was committed immediately upon completion, before the checkpoint, rather than held uncommitted pending the browser corroboration — this is genuinely irreproducible data (a single 224-minute idle window) and committing it early protects against loss."
  - "IMG-02 reported as observed (not forced): the hero thumbnail resolved after the gap. Its underlying mechanism (Data Cache staleness) stays MEDIUM confidence per 09-RESEARCH.md's own rating, unchanged by this plan, because D-11's verify-after-fix trade-off plus the fix itself (which removes the embedded presigned URL) eliminated the one signal that could have discriminated it."

requirements-completed: [IMG-01, IMG-02]

coverage:
  - id: D1
    description: "Three distinct home-feed thumbnail paths, extracted from HTML that sat cached 224 minutes past the idle window's margin, each resolve to live image bytes on a direct, outside-the-optimizer request"
    requirement: "IMG-01"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 3 → Step 3, three rows: 200/image-png/53788, 200/image-png/1561628, 200/image-png/183062"
        status: pass
    human_judgment: false
  - id: D2
    description: "The home page's first post-gap request reports x-vercel-cache STALE with a forwarded date header predating the recorded window start — independent machine corroboration that no intervening request occurred (T-09-16)"
    requirement: "IMG-01"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 3 → Step 1: age 13514s, date 12:12:04Z vs window start 12:13:13Z"
        status: pass
    human_judgment: false
  - id: D3
    description: "The post detail page's hero thumbnail, extracted from a render that occurred inside the same idle window, resolves to live image bytes on direct request"
    requirement: "IMG-02"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 3 → Step 4: 200/image-png/1561628"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fresh, cookie-less headless-browser pass corroborates both pages: naturalWidth > 0 && complete on every <img>, zero broken images, zero console errors"
    requirement: "IMG-01, IMG-02"
    verification:
      - kind: automated_ui
        ref: "09-EVIDENCE.md Tier 3 → Step 5 tables, gstack /browse session"
        status: pass
    human_judgment: false
    rationale: "Recorded as corroboration only, not the establishing evidence — the optimizer's 4-hour cache floor spans this window and could mask a broken origin. Flagging human_judgment: false because the mechanical naturalWidth/complete criterion is deterministic, not eyeballed; the plan's own text is explicit that the direct proxy-path requests (D1/D3), not this browser pass, are what establish the requirements."
  - id: D5
    description: "IMG-02's finding written as one of the three permitted outcomes (observed), with its mechanism held at MEDIUM confidence and the discriminating re-diagnosis test named"
    requirement: "IMG-02"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md → '## The IMG-02 finding' section"
        status: pass
    human_judgment: false
  - id: D6
    description: "research/ARCHITECTURE.md §1's Full-Route-Cache attribution corrected in writing for /post/[id] (Data Cache is the actual mechanism there)"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md → 'Correcting research/ARCHITECTURE.md §1' subsection, quoting both the wrong and the right attribution"
        status: pass
    human_judgment: false
  - id: D7
    description: "Closing per-requirement section across IMG-01..IMG-05 naming what was established and by which tier, with the host-allowlist guard, IMG-05's live half, and the IMG-02 mechanism all explicitly named as unexercised"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md → 'Closing — per-requirement summary, IMG-01 through IMG-05' table and list"
        status: pass
    human_judgment: false

duration: ~25min (including a checkpoint pause for the browser corroboration)
completed: 2026-08-11
status: complete
---

# Phase 9 Plan 03: The Idle Window Summary

**Spent the phase's single 224-minute idle window on the one claim nothing else could reach: a cold first request against the deployed site, 224 minutes after the last touch, resolved three home-feed thumbnails and one post hero to live image bytes — closing IMG-01 and IMG-02 as observed, and writing IMG-02's still-MEDIUM-confidence mechanism into the record rather than forcing it to HIGH.**

## Performance

- **Duration:** ~25 min, including a checkpoint pause while the browser corroboration was performed by the orchestrator
- **Started:** 2026-08-11T15:56Z (approx)
- **Completed:** 2026-08-11T16:08Z (approx)
- **Tasks:** 2
- **Files modified:** 1 (`09-EVIDENCE.md`); zero source files, by design

## Accomplishments

- **The one-shot cold request succeeded on the first try.** Home page at `+224min`: `x-vercel-cache: STALE`,
  and its forwarded `date` header (`12:12:04Z`) landed *before* the recorded window start (`12:13:13Z`) —
  an independent, machine-observed corroboration of the no-intervening-request attestation, not merely a
  restatement of it.
- **Three distinct home-feed thumbnails and one post hero, read out of that captured HTML, all resolved to
  live image bytes** on a direct request outside the optimizer — `200`, `image/png`, non-zero size, every
  time. This is IMG-01 and IMG-02's establishing evidence.
- **A fresh, cookie-less headless-browser pass corroborated both pages** with a mechanical criterion
  (`naturalWidth > 0 && complete`), zero broken images, zero console errors — performed and reported by the
  orchestrator via gstack `/browse`, explicitly recorded as not a human incognito-window observation.
- **IMG-02's mechanism was written honestly, not forced.** The hero resolved (met), but the underlying
  Data Cache staleness hypothesis stays MEDIUM confidence — this phase's own fix removed the one signal
  that could have discriminated it, and that trade-off (D-11) is recorded as deliberate, not an oversight.
  The discriminating re-diagnosis test (a temporary latency-timing log around `getPost()`) is named as
  available for whoever needs it later.
- **`research/ARCHITECTURE.md` §1's mechanism error is corrected in writing:** it attributes staleness on
  both `/` and `/post/[id]` to the Full Route Cache — right for `/`, wrong for `/post/[id]`, which carries
  no Full Route Cache entry at all (inherited `08-CACHE-EVIDENCE.md` measurement). The actual mechanism
  there is the Next.js Data Cache inside `getPost()`'s own fetch.
- **The document is closed end to end**, three tiers in the order they ran, with a per-requirement summary
  across IMG-01 through IMG-05 naming every unexercised item and its reason.

## Task Commits

1. **Task 1 (automated portion): the cold first request** — `072f0aa` (docs) — one-shot capture: home page
   header/body dump, three direct thumbnail requests, post-page header/body dump, hero direct request
2. **Task 1 (completion): browser corroboration recorded** — `3e2ebc9` (docs) — step 5 filled in from the
   orchestrator-performed `/browse` pass; Result section finalized for IMG-01/IMG-02
3. **Task 2: IMG-02 finding + ARCHITECTURE.md correction + closing section** — `e3ee4c5` (docs)

_No separate plan-metadata commit was made beyond these three — this plan's file scope is `09-EVIDENCE.md`
alone, and each task's full deliverable (including its checkpoint-resolved half) landed in its own commit._

## Files Created/Modified

- `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` — appended `## Tier 3 — the idle window` (window
  accounting, the captured cold request, direct proxy-path evidence for both pages, the browser
  corroboration), `## The IMG-02 finding` (result, unobservable-mechanism note, ARCHITECTURE.md
  correction), and a closing per-requirement summary across IMG-01–IMG-05
- `.planning/phases/09-thumbnail-freshness/09-03-SUMMARY.md` — this file

## Decisions Made

- The browser-corroboration half of task 1's human-check was deliberately NOT performed or fabricated by
  the executing agent. Execution halted at a checkpoint once every machine-observable step was done and
  committed; the orchestrator subsequently directed the check via a freshly started, cookie-less headless
  Chromium session and reported the results back, which are recorded in the document in those exact terms
  (not presented as a human eyeball in an incognito window).
- The one-shot cold-request data (task 1's automated portion) was committed immediately on completion,
  before waiting on the checkpoint resolution — it is genuinely irreproducible (a single 224-minute idle
  window that cannot be re-run), so committing early protects it against any loss between the checkpoint
  and its resolution.
- IMG-02 is reported as observed (met) rather than defaulted to a pass or stretched beyond what was tested:
  the hero thumbnail resolving is the observation; the Data Cache staleness mechanism behind why it *could*
  have failed remains a MEDIUM-confidence inference, unchanged and unexercised by this plan, per its own
  file-scope constraint (task 3 may modify only `09-EVIDENCE.md`).

## Deviations from Plan

### 1. [Environment/Instruction] Task 1's human-check was split across a checkpoint, per explicit run instruction

The plan's own `<verify>` block for task 1 bundles the "no intervening request" confirmation and the
fresh-incognito browser view into a single `<human-check>`. This run's accompanying instructions required
treating the second half specifically as something the executing agent must not fabricate, and to halt for
it once all machine-observable work was done. That is what happened: task 1's automated steps (1-4) ran,
were recorded and committed (`072f0aa`), then execution stopped with a checkpoint. The orchestrator
resolved it by directing gstack `/browse` in a freshly started daemon rather than a personal incognito
window — functionally cookie-and-storage-equivalent, but recorded honestly as not a human observation.
Not a plan defect; a deliberate provenance distinction this run's instructions required be preserved in the
written record rather than smoothed over.

### 2. [Transient] The first attempt at the three-ID direct-fetch loop produced garbled/incomplete output

A `for I in $IDS` loop (unquoted, multi-line command substitution) produced two blank results and one
apparent `000` failure on the first pass — almost certainly a shell interleaving artifact rather than a
real network failure, since re-running the identical requests individually immediately afterward (and a
`curl -v` diagnostic against the same URL) succeeded cleanly every time with results matching the plan's
expectations exactly. Not scored as a real failed request against the site; the working, individually-run
results are what is recorded in the evidence document. No retry of the load-bearing home-page request was
needed or performed — that one succeeded cleanly on its first and only execution.

---

**Total deviations:** 2, neither a Rule 1-4 code deviation — both are procedural/provenance notes about how
this verification-only plan was actually carried out, recorded per this phase's honesty rule rather than
smoothed into "as planned."
**Impact on plan:** None on the evidence's validity. The one-shot load-bearing request (home page cold
load) executed exactly once, cleanly, and is what the entire IMG-01/IMG-02 result rests on.

## Issues Encountered

None beyond the transient shell-interleaving artifact documented above, which resolved on retry against
non-time-critical (repeatable) requests.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **09-EVIDENCE.md is closed.** All three tiers are recorded in run order, IMG-01 and IMG-02 are both
  observed, and every unexercised item (host-allowlist guard, IMG-05 live half, IMG-02 mechanism) is named
  with its reason in the closing section — nothing is silently omitted.
- **Two items remain genuinely open for whoever runs phase-level verification or `/gsd-complete-milestone`:**
  (1) the RSC flight-payload finding from `09-02` (presigned URLs still embedded in the flight payload,
  inert for rendering but present in cached markup — an operator decision on the component prop-interface
  fix, not touched by this plan's file scope); (2) the `must_haves` truth wording for D-06 (`s-maxage` not
  observable on the deployed response, purpose satisfied but literal wording needs correcting) — both
  already flagged in `09-02-SUMMARY.md` and unchanged here.
- **`git diff --name-only origin/main..HEAD -- .planning/ROADMAP.md .planning/REQUIREMENTS.md` returns `1`,
  not `0`** — this is `ROADMAP.md`, touched by `09-02`'s own legitimate `roadmap update-plan-progress` call,
  not by this plan. This plan's own diff contributes zero lines to either file; verified directly
  (`git show e3ee4c5 --stat`, `git show 3e2ebc9 --stat`, `git show 072f0aa --stat` each show only
  `09-EVIDENCE.md`).
- Phase-9 requirements IMG-01 and IMG-02 marked complete in `REQUIREMENTS.md` by this plan's own
  `requirements mark-complete` step (state_updates), not written by task content.
- `origin/main` is still at `9c3cc9c`; this plan's three commits are local docs-only additions and carry
  no source changes.

## Self-Check: PASSED

| Claim | Result |
|-------|--------|
| `09-EVIDENCE.md` exists and contains the Tier 3 section | FOUND |
| `09-03-SUMMARY.md` exists | FOUND |
| Commits `072f0aa`, `3e2ebc9`, `e3ee4c5` exist in git log | all FOUND |
| `grep -cE 'X-Amz-(Signature\|Credential)' 09-EVIDENCE.md` = 0 | `0` |
| `git status --porcelain apps/web/src packages` = 0 | `0` |
| `npm run build --workspace=apps/web` exits 0 | PASS |
| `npm run lint --workspace=apps/web` reproduces the documented pre-existing 18-problem baseline, none in this plan's files | PASS |

---
*Phase: 09-thumbnail-freshness*
*Completed: 2026-08-11*
