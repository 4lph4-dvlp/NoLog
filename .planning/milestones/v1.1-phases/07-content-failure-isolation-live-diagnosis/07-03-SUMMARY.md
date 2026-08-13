---
phase: 07-content-failure-isolation-live-diagnosis
plan: 03
subsystem: diagnostics-evidence
tags: [notion-api, cloudflare, user-agent, operator-verified, evidence-capture]

# Dependency graph
requires:
  - phase: 07-content-failure-isolation-live-diagnosis (plan 01)
    provides: "Env-gated deep diagnostics + D-04 probe in lib/notion-x.ts; secret-gated GET /api/diagnose-page; [PostPage:recordMap]/[PostPage:chrome] leg-named logs"
  - phase: 07-content-failure-isolation-live-diagnosis (plan 02)
    provides: "classifyMissingPost() + PostUnavailable; notFound() scoped to genuinely-missing posts"
provides:
  - "07-EVIDENCE.md — the D-08 gate artifact: six-candidate table judged against pasted production observations, verbatim log lines, named verdict"
  - "Root cause established at HIGH confidence: Cloudflare answers notion-client's default `user-agent: node` with 403 + an HTML challenge page"
  - "ROADMAP SC#1 live half closed; SC#2 closed; SC#3/SC#4 live halves recorded as unexercised-not-failed"
affects: [phase-8-content-fix, phase-9-thumbnail-freshness]

# Actuals
actuals:
  tokens: 0
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-variable discrimination: when a production payload establishes WHAT fails but not WHY, hold every constant (host, IP, body, id, endpoint) and vary exactly one candidate trigger. A constant that both succeeds and fails cannot be the cause — this is what eliminated the egress-IP framing that three prior research passes had left as the leading hypothesis."
    - "Operator-verified capture with paste-not-paraphrase enforcement: acceptance criteria required verbatim pastes and forbade marking a candidate eliminated on anything but a pasted observation, which is what kept an inference from being recorded as evidence."

key-files:
  - .planning/phases/07-content-failure-isolation-live-diagnosis/07-EVIDENCE.md
---

# Plan 07-03 Summary — Live Production Evidence Capture

## What this plan produced

One artifact: `07-EVIDENCE.md`. No source files were touched (`git status --short packages/ apps/` clean),
by design — this plan consumes the instrumentation plans 07-01 and 07-02 built and turns it into a recorded
observation.

## The verdict

**Candidate 2 of PITFALLS.md Pitfall 5 — `fetch`/runtime differences, specifically the missing
`User-Agent` — confirmed. The other five candidates eliminated. None inconclusive.**

`notion-client` sets no `User-Agent`, so Node's built-in `fetch` sends its default `user-agent: node`.
Cloudflare, in front of `www.notion.so/api/v3/loadPageChunk`, answers that with **403 + an HTML challenge
page** instead of JSON. `ofetch` raises a `FetchError`, `getPageRecordMap` rethrows, and the content-leg
catch nulls `recordMap` — so every public post renders title and metadata, then the
`Content could not be loaded.` fallback in place of its body.

## How it was established

Production diagnostics from all three public post ids were byte-identical: `status: 403`,
`contentType: text/html; charset=UTF-8`, `bodyExcerpt` opening with Cloudflare error-page boilerplate,
`viaProbe: false`.

The decisive step was a **single-variable experiment** run from one non-Vercel host on one IP — same POST
body, same page id, same endpoint — varying only the `User-Agent`:

| `User-Agent` | Status | Content-Type |
|---|---|---|
| `curl/8.14.1` | 200 | `application/json` (full `recordMap`) |
| `node` | **403** | `text/html` (Cloudflare page) |
| Chrome/131 | 200 | `application/json` (full `recordMap`) |

A constant IP that both succeeds and fails cannot be the discriminating variable. This is what refuted the
egress-IP framing that `PROJECT.md`, `PITFALLS.md` and `07-RESEARCH.md` had all carried as a leading
candidate, and it upgraded the react-notion-x #710 / `User-Agent` idea from MEDIUM-confidence hypothesis to
reproduced fact.

## Success criteria

| SC | Status | Evidence |
|----|--------|----------|
| SC#1 — a production log line names one of the three fetches | **closed** | 6× `[PostPage:recordMap]` pasted verbatim; `[PostPage:chrome]` and `[PostPage:post]` produced **no** lines. The legs are distinguishable in practice, not just in code |
| SC#2 — live evidence recorded against the six-candidate table with a named verdict | **closed** | `07-EVIDENCE.md`, captured against `dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz`, `Environment: production` |
| SC#3 — chrome failure no longer blanks the body | **structural only** | The chrome leg did not fail during the window, so no live observation exists. Recorded as unexercised, not verified |
| SC#4 — an existing public post never 404s on a content-fetch failure | **structural only** | `getPost()` succeeded on every request, so the `!post` branch was never entered and `PostUnavailable` never rendered. Recorded as unexercised, not verified |

## Deviations and honest limitations

- **Repeated-load spread.** PITFALLS 15 prescribes five loads across several minutes; the five here span
  ~2 seconds. Recorded as a deviation with its compensating evidence: attempt 1's log shows
  `SET Updating Data Cache` (a genuine regeneration, not a cache read), and the controlled experiment
  settles intermittency more directly than time-spread would.
- **Incognito check not performed as a browser session.** Superseded by a strictly stronger observation —
  a fully unauthenticated request returned a complete `recordMap`, which no session-restricted page can do.
- **Failure-onset correlation not gathered.** Reason recorded rather than left blank: it existed only to
  discriminate candidate 6, which was eliminated on direct evidence instead.
- **Closeout redeploy outstanding at time of writing.** Both Production debug env vars were removed at
  2026-08-09 17:05 UTC, but the redeploy that makes running instances drop them had not yet completed.
  T-07-13's mitigation is half-applied until it does. Flagged in `07-EVIDENCE.md`'s Closeout section.

## Decision recorded during this plan

**D-19 (new, in `07-CONTEXT.md`).** The operator revised D-02 mid-capture: the diagnostic instrumentation is
**temporary**, not permanent. Rationale — NoLog's core value is minimal forker setup, and permanent
diagnostic env vars are fatigue a forker pays for and never benefits from. Teardown scope is enumerated in
D-19 and carried into `07-EVIDENCE.md`'s hand-off. Net new forker-facing env vars after v1.1: **zero**.

## Hand-off to Phase 8

The fix is narrowed to giving `notion-client` a browser-shaped `User-Agent`, inside D-01 (keep the
unofficial client) and D-07 (no new dependencies). Three questions are left open on purpose and are listed
in `07-EVIDENCE.md`: whether `NotionAPI`'s public API exposes header configuration without patching;
whether a static UA is durable if Cloudflare escalates to a JS challenge; and whether impersonating a
browser UA is appropriate for this project — the last is the operator's call, not a technical one.

CONT-05 (the "no content yet" vs "fetch failed" wording split) is **not** informed by this verdict and
remains Phase 8's own work.
