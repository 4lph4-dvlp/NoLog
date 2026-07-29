---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 6
current_phase_name: Documentation
status: verifying
stopped_at: Completed 06-02-PLAN.md
last_updated: "2026-07-29T07:38:00.033Z"
last_activity: 2026-07-29
last_activity_desc: Phase 6 execution started
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 17
  completed_plans: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-29)

**Core value:** A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.
**Current focus:** Phase 6 — Documentation

## Current Position

Phase: 6 (Documentation) — EXECUTING
Plan: 2 of 2
Status: Phase complete — ready for verification
Last activity: 2026-07-29 — Phase 6 execution started

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | - | - |
| 02 | 2 | - | - |
| 03 | 6 | - | - |
| 04 | 3 | - | - |
| 05 | 2 | - | - |

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
| Phase 04 P01 | ~25min | 2 tasks | 3 files |
| Phase 04 P02 | ~10min | 2 tasks | 3 files |
| Phase 05 P01 | ~10min | 2 tasks | 2 files |
| Phase 05 P02 | ~15min | 3 tasks | 1 files |
| Phase 06 P01 | 20min | 2 tasks | 2 files |
| Phase 06 P02 | ~7min | 2 tasks | 2 files |

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
- [Phase ?]: Phase 4 Plan 01: D-08 revised under its own escape hatch — visible {{{RESEND_UNSUBSCRIBE_URL}}} footer link added instead of relying solely on Resend's automatic header injection (04-RESEARCH.md Open Question 1 could not confirm unconditional RFC 8058 header injection)
- [Phase ?]: Phase 4 Plan 01: D-11 batch-cap env var resolved to NOTIFY_BATCH_SIZE (default 50); Open Question 2 resolved in favor of short-circuiting remaining markEmailed attempts after the first NotionCapabilityError in a run
- [Phase ?]: Phase 4 Plan 01: fromAddress placed in site.config.ts alongside physicalAddress under D-06's public-value rationale (forker-visible branding, not a secret)
- [Phase ?]: Phase 4 Plan 02: Post.thumbnailType added to the published core package (option (a) from 04-RESEARCH.md Pitfall 1) instead of a send-time re-fetch; getFileType() duplicates getFileUrl()'s files[0] lookup deliberately rather than sharing a helper, keeping the live site's image path untouched
- [Phase ?]: Phase 4 Plan 02: digest buildSectionHtml() only embeds a thumbnail when thumbnailType === "external" AND the URL parses as absolute https; Notion-hosted (presigned, one-hour-expiring) or malformed thumbnails downgrade silently to D-05's existing text-only rendering, with one per-run [Notify] log line reporting the downgrade count
- [Phase ?]: Phase 4, post-execution (user-requested, 2026-07-27): D-06 revised — CONFIG.notify.physicalAddress removed from site.config.ts (git-committed) and moved to a NOTIFY_PHYSICAL_ADDRESS env var, since NoLog forks are typically public repos and a config-file field would permanently expose a forker's real mailing address to anyone browsing source, not just email recipients; fromAddress unaffected (already public via every email's From header and DNS)
- [Phase ?]: Phase 4 Plan 03 (operator verification): live run against real Resend + Notion fully confirmed SC#1/SC#2/SC#3/SC#5/SC#6 — single broadcast, one email received, working unsubscribe (visible link AND List-Unsubscribe/List-Unsubscribe-Post headers both confirmed present, closing 04-RESEARCH.md Open Question 1), failed-send-marks-nothing, fail-closed on missing config, /api/subscribe regression clean. 4lph4-bl0g.kro.kr confirmed as a valid Resend sending domain (DKIM/SPF/DMARC all pass on the delivered message)
- [Phase ?]: Phase 4 Plan 03, post-execution UX addition: buildSectionHtml() now also renders a visible "read more"/"자세히 보기 →" link under each section's summary (same href as the title link), requested after live review of the actual delivered digest
- [Phase ?]: Phase 4 Plan 03: NOTIFY-04's live malformed-post test NOT demonstrated — see Blockers/Concerns below for full detail; recorded as an open gap, not silently passed
- [Phase ?]: Phase 5 Plan 1: production backfill confirmed zero unemailed posts against live Notion DB (ROADMAP SC#1 closed); Vercel dashboard maxDuration=300s/Root Directory=apps/web/all 6 Production env vars present recorded (SC#3 measurement half closed).
- [Phase ?]: Phase 5 Plan 1: NOTIFY_BATCH_SIZE_DEFAULT confirmed unchanged (50) against the real 300s maxDuration reading (N_max=110); comment rewritten to cite 05-01-VERIFICATION.md row P2 and the sizing arithmetic (SC#3 batch-size half closed).
- [Phase ?]: Phase 5 Plan 1: OPS-01 intentionally NOT marked complete in REQUIREMENTS.md by this plan — its text describes the cron-entry deployment (Plan 05-02's deliverable), not the backfill-confirmation record produced here.
- [Phase ?]: Phase 5 Plan 2: Task 1 go-live gate — operator selected proceed with the default 0 11 * * * schedule after all five P1-P5 facts and D-04's costly-undo rating were read back
- [Phase ?]: Phase 5 Plan 2: Task 3 manual-trigger response body not captured verbatim by operator (only Vercel's trace/metadata view pasted, not literal JSON) — recorded as a coverage status:gap on that specific sub-fact per 05-01-VERIFICATION.md's P5 transparency precedent; overall result (200, authenticated, no email sent) solidly established by corroborating evidence
- [Phase ?]: Phase 5 Plan 2: OPS-01 fully closed — vercel.json cron entry added, deployed, and dashboard-confirmed registered, strictly after the confirmed-empty backfill (commit 73a4d19, strict descendant of 6200190)
- [Phase ?]: Phase 6 Plan 1: step-2 Notion capability warning sourced to Notion's documented model and the shipped NotionCapabilityError class, not phrased as a failure this project reproduced live (Phase 4's two revocation tests remain unreproduced, still open in STATE.md)
- [Phase ?]: Phase 6 Plan 1: CONFIG.notify.fromAddress documented as its own README step despite not being an env var — a forker who sets all 4 env vars but leaves the default fromAddress would otherwise still fail closed with no README explanation
- [Phase ?]: Phase 6 Plan 1: free-tier quota note avoids the word 'unlimited'/'무제한' entirely, stating the 1,000-contacts/month figure as the actual ceiling rather than any no-ceiling framing
- [Phase ?]: Phase 6 Plan 2: NR -->|Optional digest| RS edge label chosen to carry explicit optional framing into the diagram, mirroring the Cusdis -->|Optional comments| edge
- [Phase ?]: Phase 6 Plan 2: Korean notify-route node translated (알림 라우트); Vercel Cron and Resend kept as English product nouns, resolving an internal ambiguity in the plan's own action text by following the file's existing convention

### Pending Todos

See TODOS.md (repo root) — 3 items still deferred (RSS feed, on-site new-post badge, generic on-publish hook abstraction), plus the standing "no test framework exists" note. Digest batching is no longer deferred — see Decisions above.

### Blockers/Concerns

- **RESOLVED 2026-07-27:** Both Phase 4 research gaps confirmed against live systems during 04-03's operator verification: (1) Vercel Hobby `maxDuration` confirmed 300s via `04-RESEARCH.md`, batch cap default (50) sized against that figure — Phase 5 SC#3 still owns confirming the specific deployed project's setting; (2) Resend's unsubscribe behavior confirmed fully working live — visible footer link works end-to-end (no login, contact unsubscribes), and raw email source additionally confirmed `List-Unsubscribe`/`List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers ARE present (04-RESEARCH.md Open Question 1 fully resolved).
- **OPEN — Phase 4:** Notion "Update content" capability revocation did NOT block `markEmailed()`'s PATCH in two independent live tests (including one with a freshly reissued `NOTION_TOKEN`), despite the integration's "콘텐츠 업데이트"/"Update content" checkbox confirmed unchecked in the Notion dashboard (screenshot-verified) both times. `packages/core/src/client.ts`'s `patchPage()` correctly checks `res.status === 403` → `NotionCapabilityError` (confirmed correct by direct code inspection, not just trusted) — this is NOT a code bug. The discrepancy is between Notion's dashboard capability toggle and the live PATCH /v1/pages/{id} response, which returned 200 both times. Root cause unknown: possibly a Notion-side propagation delay, a per-database "connection" override, or an undocumented capability boundary for property-only writes. Re-verify against Notion's actual behavior before Phase 5 ships — do not assume the capability-short-circuit code path is reachable/necessary based on this session's evidence alone.
- **OPEN — Phase 4:** NOTIFY-04's live "malformed post excluded, others still send" scenario could not be exercised during 04-03. The specified fault-injection method (clearing a post's title in Notion) doesn't trigger a section-build exception — `packages/core/src/client.ts`'s `getTitle()` falls back to the literal string `"Untitled"` for an empty title, so `buildSectionHtml()` never throws for this input, and no other Notion-editable field can trigger a throw given current property-extraction fallbacks. The per-post `try`/`catch` isolation structure is present and confirmed by code review (04-01 plan-checker pass), but its live-behavior half is unverified. See `04-03-SUMMARY.md` coverage item D4. Resolve before Phase 4 is considered fully closed: either accept structural-only coverage, or add a real throwable precondition (e.g. reject the `getTitle()` fallback sentinel) and re-test live.
- `PROJECT.md`'s Active requirements text has been corrected to state the right Resend quota (up to 1,000 contacts/month via Broadcast/Audience, not the transactional 100/day cap) — consistent with ROADMAP.md Phase 6 / REQUIREMENTS.md DOCS-02.
- [Phase 2] `apps/web/src/app/post/[id]/page.tsx` passes the raw dynamic route segment into `getPost(pageId)`, which interpolates it unvalidated into the Notion API URL (01-REVIEW.md, post-Phase-1 pass) — not part of Phase 1's DATA-01/02/04 scope, needs its own security review (`/gsd-secure-phase` or targeted fix) before considered resolved.
- Phase 2: six live-database verification scenarios in 02-VALIDATION.md (DATA-03 SC#1-3, D-04, D-05, dry-run listing) require an operator with real NOTION_TOKEN/NOTION_DATABASE_ID before ship; nyquist_compliant stays false until then

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — this is the project's first milestone)* | | | |

## Session Continuity

Last session: 2026-07-29T07:38:00.009Z
Stopped at: Completed 06-02-PLAN.md
Resume file: None
