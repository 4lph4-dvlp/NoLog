---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 03
current_phase_name: subscribe-path
status: executing
stopped_at: Completed 03-06-PLAN.md (CR-01 unconfigured-log-volume gap closure) — Phase 03 subscribe-path fully complete
last_updated: "2026-07-26T16:54:21.720Z"
last_activity: 2026-07-26
last_activity_desc: Phase 03 execution started
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 10
  completed_plans: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-24)

**Core value:** A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.
**Current focus:** Phase 03 — subscribe-path

## Current Position

Phase: 03 (subscribe-path) — EXECUTING
Plan: 4 of 4
Status: Ready to execute
Last activity: 2026-07-26 — Phase 03 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 2 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 6 | 2 tasks | 5 files |
| Phase 01 P02 | 15 | 1 tasks | 1 files |
| Phase 02 P01 | 12 | 3 tasks | 2 files |
| Phase 02 P02 | 4min | 2 tasks | 2 files |
| Phase 03 P01 | ~2h | 2 tasks | 8 files |
| Phase 03 P02 | 35min | 2 tasks | 1 files |
| Phase 03 P03 | ~20min | 2 tasks | 3 files |
| Phase 03 P04 | 21min | 3 tasks | 1 files |
| Phase 03 P05 | ~20min | 2 tasks | 1 files |
| Phase 03 P06 | 25min | 1 tasks | 1 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Approach B (`/api/notify-subscribers` + Vercel Cron once/day) locked in; Resend (Audiences + Broadcast API) chosen over Buttondown.
- Roadmap: Phase 5 (Production Cutover) kept as its own phase despite mapping to a single requirement (OPS-01) — deliberate, per research: enforces backfill-before-cron ordering via phase/deploy structure rather than developer discipline.
- Roadmap: SEC-02 (fail-closed for both `/api/subscribe` and `/api/notify-subscribers`) assigned solely to Phase 4, since that's the first point both routes exist to jointly verify the requirement — avoids a two-phase requirement mapping.
- Roadmap review: same-day digest batching pulled forward into v1 scope (NOTIFY-01/04/05, Phase 4) rather than staying deferred in `TODOS.md` — user asked how multi-post days were handled and chose the digest now instead of waiting for Resend's 100/day cap to become a real constraint. `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` Phase 4, and `TODOS.md` all updated to match.
- [Phase ?]: Phase 1 Plan 01: D-01 missing-property and D-03 403 detection implemented as best-guess pattern-matches per RESEARCH.md — not yet validated against a live Notion workspace (no credentials in execution environment); pending manual verification before ship
- [Phase ?]: Phase 1 Plan 01: index.ts barrel export confirmed to need no edit — wildcard export already re-exports the two new error classes
- [Phase ?]: Fixed getPosts() alongside getUnemailedPublicPosts() in gap-closure task 01-02 (CR-01): both shared the identical case-sensitivity defect in the Notion status query filter; getPosts() was included in-scope despite being outside DATA-01's original REQ-ID, since leaving it broken would keep the primary read path non-functional — **RETRACTED 2026-07-25, see next entry**
- [Phase ?]: 01-02: ignored 01-RESEARCH.md Pattern 1 / 01-PATTERNS.md lowercase-status guidance — superseded by 01-VERIFICATION.md CR-01 finding; corrected both query filters to canonical property: "Status" — **RETRACTED 2026-07-25, see next entry**
- [Phase ?]: 2026-07-25 CORRECTION: CR-01 was a misdiagnosis. User-provided screenshot of the live production Notion database confirmed the real property is lowercase `status` (matching thumbnail/summary/category/tag/author, all lowercase-camelCase) — not `Status`. The two prior entries above are retracted. Reverted both query filters back to `property: "status"` (commit `588496d`), corrected `mapPageToPost()`'s getSelect() primary/fallback order and both `Post.status` JSDoc copies to match reality. `01-VERIFICATION.md` and `01-REVIEW.md` both carry `## CORRECTION` sections documenting this.
- [Phase ?]: Phase 2 Plan 01: all fifteen D-01..D-15 locked decisions implemented as specified; no deviations required
- [Phase ?]: Phase 2 Plan 01: live-database human-check verification (DATA-03 SC#1-3, D-04, D-05) deferred — no Notion credentials in this execution environment, matching Phase 1's identical carried-forward blocker
- [Phase ?]: isSystemicAbort() classifies purely on instanceof identity (never message text); branch order isSystemicAbort -> isRateLimited -> generic is load-bearing and automated-line-asserted
- [Phase ?]: COVERAGE.md row 0/row 9 cells rebalanced (not truncated) to satisfy the api-coverage length validator; all 18 rows and 9/9 INTEGRATE/OPT-OUT decisions preserved
- [Phase ?]: Phase 3 Plan 01: resend npm package SUS/too-new verdict approved as confirmed false positive (seam read latest-version publish date, not package's 2017 creation date); user approved npm install resend --workspace=apps/web
- [Phase ?]: Phase 3 Plan 01: lib/email.ts switched from eager to lazy Resend client construction (getResend() accessor) after discovering the installed SDK's constructor throws when RESEND_API_KEY is unresolvable, which crashed next build for unconfigured forks; D-20's no-default/no-fallback constraint preserved
- [Phase ?]: Phase 3 Plan 02: rate limit + honeypot inserted into D-23 pipeline stages 2/3 exactly as specified, zero deviations; verification harness switched to setsid-detached background server processes after plain-& backgrounding was killed by the sandbox's process-group timeout (harness detail only, not a code change)
- [Phase ?]: Phase 3 Plan 03: SubscribeForm split into two full render branches (default/terminal) sharing one fetch, one honeypot block, one variant-parameterized errorMessage() mapping; terminal placement wired via a Server-rendered subscribeSlot prop (post/[id]/page.tsx constructs <SubscribeSection variant="terminal" />, terminal/PostPage.tsx renders it) rather than a direct import, since that template carries a client directive and a direct import would evaluate the env gate in client code where the secret resolves to undefined
- [Phase ?]: Phase 3 Plan 04 (gap closure): getRateLimitKey replaces getClientIp with a tiered platform-header-first derivation (x-vercel-forwarded-for -> x-real-ip -> x-forwarded-for, last comma entry), closing CR-01's spoofable rate-limit key; live probe confirms exactly 3 of 8 fabricated-header requests refused, against 0 of 8 before the fix
- [Phase ?]: Phase 3 Plan 04: ATTEMPTS_MAX_KEYS=2000 expiry-independent ceiling added to isRateLimited, closing CR-01's secondary DoS defect (the expiry sweep alone could not bound a high-cardinality burst); collapse-not-reject into a shared overflow bucket, guarded by attempts.has() so existing visitors are never evicted
- [Phase ?]: Phase 3 Plan 04: optional T3 (review finding IN-04, email length cap at 254 chars before regex) was executed rather than dropped; reuses the existing invalid_email/400 response, no new machine code
- [Phase ?]: Phase 3 Plan 05 (gap closure): isSameOriginRequest anchors the same-origin check to the request's own x-forwarded-host/host, never CONFIG.site.url — closes CR-01 (origin)/T-03-19; fails open on absent Origin (forbidden header, browsers always add it on POST), refuses the literal opaque "null" origin; placed after the configuration 404 and before the rate limiter so forged traffic never spends a rate-limit slot
- [Phase ?]: Phase 3 Plan 05: hasJsonContentType requires Content-Type application/json (parameters/case permitted) before request.json() runs, closing the CORS-safelisted-media-type preflight-bypass mechanism (T-03-20); both new refusal paths reuse the existing 400/invalid_email response verbatim so the module's observable status/code sets stay unchanged (SUB-03, D-21)
- [Phase ?]: Phase 3 Plan 06 (gap closure): unconfiguredLogged module-scope latch added, mirroring originRejectionLogged, bounding the configuration-gate console.error to one line per instance; the bare 404 return stays outside the latch block so the response contract is unchanged, closing CR-01 (2026-07-26 review)

### Pending Todos

See TODOS.md (repo root) — 3 items still deferred (RSS feed, on-site new-post badge, generic on-publish hook abstraction), plus the standing "no test framework exists" note. Digest batching is no longer deferred — see Decisions above.

### Blockers/Concerns

- Two unresolved research gaps flagged for verification during Phase 4/5 execution: (1) Vercel Hobby `maxDuration` figure contested between two sources (10s vs. 300s under Fluid Compute) — must check the actual target Vercel project's config before finalizing notify-route batch size; (2) Resend Broadcast API's confirmed-opt-in / domain-warmup behavior is thin in public docs — verify against a live Resend account during Phase 4 implementation.
- `PROJECT.md`'s Active requirements text has been corrected to state the right Resend quota (up to 1,000 contacts/month via Broadcast/Audience, not the transactional 100/day cap) — consistent with ROADMAP.md Phase 6 / REQUIREMENTS.md DOCS-02.
- [Phase 2] `apps/web/src/app/post/[id]/page.tsx` passes the raw dynamic route segment into `getPost(pageId)`, which interpolates it unvalidated into the Notion API URL (01-REVIEW.md, post-Phase-1 pass) — not part of Phase 1's DATA-01/02/04 scope, needs its own security review (`/gsd-secure-phase` or targeted fix) before considered resolved.
- Phase 2: six live-database verification scenarios in 02-VALIDATION.md (DATA-03 SC#1-3, D-04, D-05, dry-run listing) require an operator with real NOTION_TOKEN/NOTION_DATABASE_ID before ship; nyquist_compliant stays false until then

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — this is the project's first milestone)* | | | |

## Session Continuity

Last session: 2026-07-26T16:54:21.701Z
Stopped at: Completed 03-06-PLAN.md (CR-01 unconfigured-log-volume gap closure) — Phase 03 subscribe-path fully complete
Resume file: None
