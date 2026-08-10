---
phase: 08-content-rendering-fix
plan: 04
subsystem: content-rendering
tags: [deploy, cont-03, sc1, isr, vercel-cache, operator-verified]

# Dependency graph
requires:
  - phase: 08-content-rendering-fix (plan 01)
    provides: "The User-Agent fix, the D-19 teardown and the CONT-05 split, all committed and unpushed"
  - phase: 08-content-rendering-fix (plan 02)
    provides: "RENDERABLE_BLOCK_MIN calibrated to 4, riding the same deploy"
  - phase: 08-content-rendering-fix (plan 03)
    provides: "Phase 7's UAT closed, so nothing outstanding blocked the push"
provides:
  - "The single Phase 8 deploy (D-14) — commits a6becd8..5013b52 pushed to origin/main"
  - "CONT-03 closed on the deployed site: every public post renders its Notion body"
  - "A correction to 08-RESEARCH Finding 2 — /post/[id] is not an ISR-cached route"
affects: [phase-7-verification, phase-9-thumbnail-freshness]

# Actuals
actuals:
  tokens: 0
  tasks: 3
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read the route's actual cache classification before designing a cache-based verification procedure. The prescribed A(MISS)→STALE→HIT sequence assumed page-level ISR; the route is fully dynamic, so the sequence could never have occurred and following it literally would have produced a fabricated pass."

key-files:
  - .planning/phases/08-content-rendering-fix/08-04-SUMMARY.md
---

# Plan 08-04 Summary — The Single Deploy and SC#1

## The deploy

`git push origin main` — `a6becd8..5013b52`, one push, one deploy (D-14). Source diff across the whole of
Phases 7 and 8: **4 files, +77 / −216 lines.** The teardown removed substantially more than the fix added.

Landed and verified on `https://4lph4-bl0g.vercel.app`.

## CONT-03: the fix works in production

Before (Phase 7 evidence): every public post rendered its title and then `Content could not be loaded.`
After: every public post renders its Notion body.

| Pass | Time (UTC) | 3702c61e | 36e2c61e | 6b42c61e |
|---|---|---|---|---|
| Deploy-watch | 17:44 | body | — | — |
| A | 17:45 | body | body | body |
| B | 17:49 | body | body | body |
| Repeat 1 | 17:50 | body | body | body |
| Repeat 2 | 17:54 | body | body | body |

"body" = HTTP 200, the renderer entered, and **neither** CONT-05 sentence present — which by the template's
own three-way branch means `recordMap` was fetched and non-empty. Titles confirmed as the real posts
(`만년필을 선물 하는 것`, `Antigravity 2.0 사용기`, `NoLog를 만들며`). Home feed regression-checked: 3 public
posts listed, and the deleted UAT fixture absent.

## SC#1 — and a correction to the procedure it was verified by

`08-RESEARCH.md` Finding 2 prescribed: request **A** post-deploy (`x-vercel-cache: MISS`) → wait >180s
untouched → request **B** (`STALE`) → request **C** (`HIT`), asserting on C. That sequence **cannot occur on
this route**, and the reason matters more than the sequence did.

Measured on the deployed site:

| Route | `cache-control` | `x-vercel-cache` | Build |
|---|---|---|---|
| `/post/[id]` | `private, no-cache, no-store, max-age=0, must-revalidate` | `MISS` on every request | `ƒ (Dynamic)` |
| `/` | `public, max-age=0, must-revalidate` | `PRERENDER` | `○` static, 3m revalidate |

The research assumed the post route was ISR-cached the way the home page is. It is not — it is fully dynamic,
so there is no cached page to go `STALE`. The quiet window was observed anyway (17:45:22 → 17:49:08, untouched)
and `B` returned `MISS`, not `STALE`, which is what surfaced the error.

**What SC#1 actually asks, and how it is met.** The criterion's guard is PITFALLS 15: *a page cached from
before the fix will keep rendering regardless of whether anything was fixed*. On this route that failure mode
**cannot happen** — every request is a fresh server render, and `getPageRecordMap` uses `ofetch` rather than
Next's patched `fetch`, so it is absent from the Data Cache too. Every one of the ~55 successful observations
above was a live `loadPageChunk` call to Notion with the shipped User-Agent. That is a stronger guarantee than
the A/B/C sequence would have provided, not a weaker one.

**What is therefore NOT claimed.** Nothing about ISR regeneration behaviour on `/post/[id]` — there is none to
claim. SC#1's literal phrase "spanning at least one genuine ISR regeneration" is unsatisfiable as written for
this route. It is recorded as met-in-substance with the mechanism named, rather than marked passed against a
sequence that was never observed.

The intermittency half of the guard is addressed separately: repeated across **three posts** and **four passes
spanning ~9 minutes**, all consistent.

## Third premise this milestone corrected by measurement

Recorded because the pattern is now the milestone's most reliable finding:

1. **Phase 7** — "`getPost` throws on non-404 failures." It does not; `packages/core` swallows to `null`.
2. **Phase 8 plan 02** — "an empty Notion page returns 1 block key." It returns 3; a page in a database
   carries its ancestor chain.
3. **Phase 8 plan 04** — "`/post/[id]` is ISR-cached." It is fully dynamic.

All three were plausible, specific, derived from reading code or docs, and wrong. Each was caught only because
something forced a measurement. This is the same lesson `PROJECT.md` already records from v1.0's CR-01 — it has
now recurred three times in one milestone.

## Phase 9 hand-off — the idle-window premise needs re-checking

The ROADMAP has Phase 9 (IMG-01/IMG-02) waiting on an uninterrupted >1h idle window, on the assumption that
stale presigned URLs are held in cached page HTML.

- **IMG-01 (home feed)** — premise holds. `/` is `PRERENDER` with `Revalidate 3m / Expire 1y`, so idle
  prerendered HTML can carry an expired presign.
- **IMG-02 (post hero)** — premise does **not** hold as written. `/post/[id]` is dynamic, so no page HTML is
  cached; any staleness comes from `getPost`'s Data Cache entry (`next: { revalidate: 180, tags }`), a
  different mechanism with a different lifetime. Phase 9's planning must re-derive this rather than inherit it.

**The Phase 9 idle clock restarts from this deploy** — 2026-08-10 ~17:44 UTC, superseding the 2026-08-09
17:13 UTC mark recorded in `07-EVIDENCE.md`. Any further deploy resets it again.

## Requirement status

- **CONT-03 — closed.** Verified on the deployed site across all public posts and repeated passes.
- **CONT-05 — implemented and deployed**; its two states were observed locally in plan 08-02 (empty page →
  "no content yet"; real post → renderer). Neither sentence appears in production, which is correct: no
  production post is currently empty or failing.

## Next step for the operator

`/gsd-verify-work 7` — Phase 7's verification is expected to move from `human_needed` to `passed` now that
plan 08-03 closed both of its UAT items.
