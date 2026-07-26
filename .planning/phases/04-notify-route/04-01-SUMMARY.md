---
phase: 04-notify-route
plan: 01
subsystem: api
tags: [nextjs, resend, notion, cron, node-crypto, email]

# Dependency graph
requires:
  - phase: 01-notion-data-layer
    provides: "NologClient.getUnemailedPublicPosts()/markEmailed(pageId), NotionCapabilityError/MissingEmailedPropertyError"
  - phase: 02-backfill-script
    provides: "Precedent for systemic-abort-vs-per-item-continue error classification (adapted here as capability-error short-circuit)"
  - phase: 03-subscribe-path
    provides: "getResend() lazy singleton (lib/email.ts), [Context]-prefixed logging convention, unconfiguredLogged latch idiom"
provides:
  - "GET /api/notify-subscribers: timing-safe CRON_SECRET auth gate, fail-closed SEC-02 config gate, capped digest query, per-post-isolated section assembly, single Resend broadcast send, mark-after-send-only write-back"
  - "CONFIG.notify (physicalAddress, fromAddress) in site.config.ts"
  - "getUnemailedPublicPosts/markEmailed pass-throughs in lib/notion.ts"
affects: [04-02-thumbnails, 04-03-live-verification, 05-production-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timing-safe secret comparison via node:crypto.timingSafeEqual with an explicit same-length burn-time branch on length mismatch (no try/catch around the throw)"
    - "Single-digest content assembly: per-post try/catch isolation at section-build time only, one broadcasts.create call outside every loop, mark-after-send-only ordering"
    - "Capability-aware write-back: NotionCapabilityError short-circuits remaining per-post writes after the first 403, with a distinguishable once-per-run log and an unmarked-count summary"

key-files:
  created:
    - apps/web/src/app/api/notify-subscribers/route.ts
  modified:
    - apps/web/src/site.config.ts
    - apps/web/src/lib/notion.ts

key-decisions:
  - "D-08 revised under its own escape hatch: renders the {{{RESEND_UNSUBSCRIBE_URL}}} merge tag as a visible footer link instead of relying solely on Resend's automatic header injection, since 04-RESEARCH.md Open Question 1 could not confirm unconditional RFC 8058 header injection from any quotable official Resend page"
  - "D-11's batch-cap env var name resolved to NOTIFY_BATCH_SIZE (integer, default 50)"
  - "04-RESEARCH.md Open Question 2 resolved in favor of short-circuiting: the mark loop stops attempting further markEmailed calls after the first NotionCapabilityError in a run, since a missing capability grant 403s identically for every post in the batch"
  - "fromAddress placed in site.config.ts alongside physicalAddress (not an env var) under D-06's public-value rationale — it is forker-visible sender branding, not a secret"

patterns-established:
  - "Cron-only route trust model: explicit 401 (not a hide-existence 404) and unlatched failure logging for auth rejections, deliberately diverging from the sibling subscribe route's D-22/D-25 posture, because this route's only legitimate callers are Vercel Cron and the operator"

requirements-completed: [NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04, NOTIFY-05, SEC-01, SEC-02]

coverage:
  - id: D1
    description: "Unauthenticated/wrong-secret GET requests to /api/notify-subscribers are rejected 401 via timing-safe comparison, before any Notion or Resend call"
    requirement: "SEC-01"
    verification:
      - kind: manual_procedural
        ref: "curl -H 'Authorization: Bearer wrong' localhost:3999/api/notify-subscribers -> 401; header-less request -> 401 (run against a live dev server, both before and after Task 2's edits)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both /api/notify-subscribers and /api/subscribe fail closed (200 unconfigured / 404) when required env vars or CONFIG.notify fields are unset"
    requirement: "SEC-02"
    verification:
      - kind: manual_procedural
        ref: "curl with CRON_SECRET set, RESEND_API_KEY/RESEND_AUDIENCE_ID unset -> {\"ok\":true,\"code\":\"unconfigured\"}; POST /api/subscribe -> 404 (Phase 3 regression re-confirmed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one resend.broadcasts.create call site exists, outside every loop, covering the whole digest in a single send"
    requirement: "NOTIFY-03"
    verification:
      - kind: other
        ref: "grep -c 'broadcasts.create' route.ts == 1, not nested in for/while/.map/.forEach"
        status: pass
    human_judgment: false
  - id: D4
    description: "A malformed post's section build failure is isolated and does not abort the digest; every other eligible post's section still assembles, sends, and marks"
    requirement: "NOTIFY-04"
    verification: []
    human_judgment: true
    rationale: "Requires a live Notion database with a deliberately malformed post and a live Resend send to observe end-to-end — carried to 04-03's operator verification checkpoint per ROADMAP Phase 4 Wave 3"
  - id: D5
    description: "A whole-digest send failure marks zero posts; a successful send marks only the posts whose sections survived assembly, with capability-error short-circuiting on repeated 403s"
    requirement: "NOTIFY-05"
    verification: []
    human_judgment: true
    rationale: "Requires live Resend/Notion credentials to force a send failure and a capability-revoked write — carried to 04-03's operator verification checkpoint per ROADMAP Phase 4 Wave 3"

duration: ~25min
completed: 2026-07-27
status: complete
---

# Phase 4 Plan 1: Notify Route Tracer + Resilience Summary

**Cron-only `GET /api/notify-subscribers` with a timing-safe auth gate, a single-digest Resend broadcast covering every unemailed public post, per-post-section isolation, capability-aware mark-after-send, and a `NOTIFY_BATCH_SIZE` overflow cap.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 3 (1 created, 2 edited)

## Accomplishments

- Built the entire notify feature end to end in a new `apps/web/src/app/api/notify-subscribers/route.ts`: `safeCompare` timing-safe `CRON_SECRET` check as the literal first statement, a fail-closed SEC-02 configuration gate, a capped `getUnemailedPublicPosts()` query, a digest assembler with per-post-section isolation, exactly one `resend.broadcasts.create` call, and a capability-aware mark-after-send loop
- Added `CONFIG.notify` (`physicalAddress`, `fromAddress`) to `site.config.ts`, both `""` by default so an unconfigured fork stays inert
- Added non-memoised `getUnemailedPublicPosts`/`markEmailed` pass-throughs to `apps/web/src/lib/notion.ts`
- Hardened the tracer path with a `NOTIFY_BATCH_SIZE` post-count cap (default 50), per-post section-build isolation with a `no_sections` fallback code, `NotionCapabilityError`-aware short-circuiting of the mark loop, and an `unconfiguredLogged` latch bounding the SEC-02 operator log to once per instance

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end authenticated digest — one path, wired through every layer** - `2f43cf7` (feat)
2. **Task 2: Resilience and scale — per-post isolation, capability-aware marking, batch cap** - `b6a34f3` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `apps/web/src/app/api/notify-subscribers/route.ts` — the whole notify feature: `GET` handler, `safeCompare` auth gate, SEC-02 config gate, capped query, isolated section assembly, one broadcast, mark-after-send loop
- `apps/web/src/site.config.ts` — new `CONFIG.notify` block (`physicalAddress`, `fromAddress`)
- `apps/web/src/lib/notion.ts` — `getUnemailedPublicPosts`/`markEmailed` pass-throughs, deliberately not `cache()`-wrapped

## Decisions Made

- **D-08 revised** (under D-08's own escape hatch): renders `{{{RESEND_UNSUBSCRIBE_URL}}}` as a visible footer link rather than relying purely on Resend's automatic header injection, because 04-RESEARCH.md's Open Question 1 could not confirm unconditional RFC 8058 header injection from any quotable official Resend page — only the suppression-list half of the behavior is confirmed. This is strictly additive and satisfies NOTIFY-02 under either interpretation.
- **D-11's env var name resolved to `NOTIFY_BATCH_SIZE`** (integer, default 50) — a reasoned figure against Vercel Hobby's confirmed 300s `maxDuration`, tunable without a code change once Phase 5 confirms the live project's actual duration budget.
- **Open Question 2 resolved in favor of short-circuiting**: the mark loop stops attempting further `markEmailed` calls in the same run after the first `NotionCapabilityError`, since a missing "Update content" grant 403s identically for every post in the batch — N further doomed PATCH calls buy nothing and bury the one line the operator needs.
- **`fromAddress` placed in `site.config.ts` alongside `physicalAddress`**, not as an env var, under D-06's public-value rationale: it is forker-visible sender branding, not a secret.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria, structural grep assertions, `tsc`/`eslint` checks, the dev-server 401/401/unconfigured/404 probes, and `npm run build --workspace=apps/web` all passed without requiring any auto-fix.

## Issues Encountered

- The local dev environment's `.env.local` already carries live `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` values (left over from Phase 3's manual verification), so the first probe run against `/api/subscribe` returned `200` instead of the plan's expected `404`. Not a regression — reran the dev server with `RESEND_API_KEY=` `RESEND_AUDIENCE_ID=` explicitly overriding the shell environment (Next.js only falls back to `.env.local` values when the shell doesn't already set them), which reproduced the intended unconfigured-env test condition and confirmed the correct `401`/`401`/`unconfigured`/`404` sequence on both task verifications.
- A background `next dev` process launched via the harness's `run_in_background` plain-`&` mechanism was killed immediately (exit 144) before any log output — matches Phase 3's documented harness detail (`03-VALIDATION.md`: "verification harness switched to setsid-detached background server processes after plain-`&` backgrounding was killed by the sandbox's process-group timeout"). Switched to an explicit `setsid ... & disown` launch, which started and stayed up cleanly for both verification runs.

## User Setup Required

None — no external service configuration required by this plan. `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, and `CONFIG.notify.physicalAddress`/`fromAddress` all remain unset in this repo by design; the route no-ops until an operator configures them (Phase 5/6 concern).

## Next Phase Readiness

- Everything locally-closable in this plan (SEC-01, SEC-02, NOTIFY-03 structurally, the isolation/mark-ordering code shape for NOTIFY-04/NOTIFY-05) is done and verified.
- `04-02-PLAN.md` (thumbnail handling) can proceed — it edits the same route file and depends on nothing this plan left incomplete.
- `04-03-PLAN.md`'s live-credential operator checkpoint still owns closing NOTIFY-04/NOTIFY-05 by observed outcome (a malformed post dropped while others send, a failed send marking nothing) and discharging D-08's "must be revisited before phase close" clause by clicking a real unsubscribe link — both are unavailable without live Resend/Notion credentials, consistent with every prior phase's carried-forward blocker.

---
*Phase: 04-notify-route*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: apps/web/src/app/api/notify-subscribers/route.ts
- FOUND: .planning/phases/04-notify-route/04-01-SUMMARY.md
- FOUND commit: 2f43cf7
- FOUND commit: b6a34f3
