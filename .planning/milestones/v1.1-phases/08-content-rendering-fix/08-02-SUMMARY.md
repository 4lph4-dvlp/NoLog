---
phase: 08-content-rendering-fix
plan: 02
subsystem: content-rendering
tags: [notion-api, cont-05, empirical-calibration, assumption-closed]

# Dependency graph
requires:
  - phase: 08-content-rendering-fix (plan 01)
    provides: "isRecordMapEmpty() + RENDERABLE_BLOCK_MIN in apps/web/src/lib/notion-x.ts; the shipped NOLOG_USER_AGENT the probe reuses"
provides:
  - "RENDERABLE_BLOCK_MIN = 4, measured against a real empty public Notion page rather than derived"
  - "08-RESEARCH.md Assumption A1 CLOSED — the [ASSUMED] marker is gone from the source"
  - "Observed block-count baseline for this database: empty = 3, real posts = 21/44/45"
affects: [08-04-plan, phase-9-thumbnail-freshness]

# Actuals
actuals:
  tokens: 0
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measure the boundary, do not derive it: a code-reading argument about what an empty Notion page returns was plausible, specific, and wrong by a factor that would have silently disabled half of CONT-05. The named-constant-plus-checkpoint structure existed precisely so there was one scalar to correct and a gate that forced the measurement."
    - "Re-observe after the fix, not just before: the first post-fix observation was taken against a stale server that had failed to restart (EADDRINUSE), and reported a false negative. Confirming the process actually died before trusting the second reading is part of the check."

key-files:
  - apps/web/src/lib/notion-x.ts
---

# Plan 08-02 Summary — Empty-Page Threshold Calibration

## Outcome: Branch B — the shipped value was wrong and was corrected

`RENDERABLE_BLOCK_MIN` moved **2 → 4**. Assumption A1 is closed on evidence; the `[ASSUMED]` marker is
removed from the source.

## What was measured

A throwaway page was created in the live Notion database with a title and **no body content**, its `status`
set to `public`, and fetched through the same `getPage()` path production uses, with the shipped
`NOLOG_USER_AGENT` read out of the source:

| Page | `Object.keys(recordMap.block).length` |
|---|---|
| Empty UAT fixture | **3** |
| Real post (만년필을 선물 하는 것) | 21 |
| Real post | 45 |
| Real post | 44 |

**The derivation was wrong.** Plan 08-01's reasoning held that a genuinely empty page returns a single entry
— its own container block — giving a threshold of 2. The real figure is 3: a page inside a Notion database
carries its ancestor chain in the record map (the page, its parent collection — id `3532c61e-4a24-8000-…`,
the same database id visible in Phase 7's Vercel logs — and one further ancestor).

## What that would have shipped

At the old threshold, `3 < 2` is false, so an empty page fell through to `NotionPageRenderer` and the
no-content sentence was unreachable. Observed directly against a local production build before the fix: the
content area contained only react-notion-x's `animate-pulse` loading skeleton — **neither** sentence
(outcome (c)). Half of CONT-05 would have been dead on arrival while every automated check stayed green.

## Verification after the fix

Local production build (`npm run build` + `npm start`, not `next dev` — PITFALLS 12), cache-busted requests:

| Page | Result |
|---|---|
| Empty fixture | `This post has no content yet.` present; no failure sentence; no skeleton ✓ |
| Real post | neither sentence; renderer entered ✓ (no regression) |

## A false negative that was caught

The first post-fix reading showed no change. The cause was not the code: `pkill` had failed, the rebuilt
server never bound (`EADDRINUSE`), and the stale process was still serving the old bundle. The port was
force-freed and the reading retaken. Recorded because the near-miss is the same shape as the failure this
whole milestone exists to prevent — trusting a measurement without confirming what produced it.

## Threshold rationale and its limits

Floor + 1: three or fewer keys is empty; a page with even one real content block clears it. The margin to the
smallest real post (21) is wide. But this is **one measurement, one page, one database** — a fork whose
database nests pages differently could see a different floor. That caveat is written into the constant's
comment rather than left in a planning document.

## Constraints honoured

- Only `apps/web/src/lib/notion-x.ts` changed (commit `930fa3e`, 1 file). `templates/default/PostPage.tsx`
  untouched — neither sentence and neither branch order moved.
- `packages/core` untouched; no dependency moved; no test framework added; no second heuristic introduced.
- **Nothing pushed.** 26 commits remain local, awaiting plan 08-04's single deploy (D-14).

## Outstanding

The UAT fixture page's `status` must be set back to non-`public` (or the page deleted) before plan 08-04
pushes — otherwise it appears in the live blog's post list as a titled, empty entry. This is the operator's
action and is re-asserted in 08-04's threat register.
