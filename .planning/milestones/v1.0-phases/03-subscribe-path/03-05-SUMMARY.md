---
phase: 03-subscribe-path
plan: 05
subsystem: api
tags: [csrf, origin-validation, cors, security, nextjs, api-route]

# Dependency graph
requires:
  - phase: 03-subscribe-path
    provides: "03-04's spoofable-rate-limit-key fix (getRateLimitKey tiered header derivation, ATTEMPTS_MAX_KEYS ceiling) — untouched non-regression baseline for this plan"
provides:
  - "isSameOriginRequest(request): request-derived same-origin precondition ahead of the rate limiter, closing CR-01 (origin) / T-03-19 (cross-site forgery via a visitor's browser)"
  - "hasJsonContentType(request): JSON media-type precondition on the body parse, closing the preflight-free delivery mechanism / T-03-20"
affects: [04-notify-route, 05-production-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Request-derived security anchor (x-forwarded-host / host / Origin), never a static configured value — same shape Next.js uses for its own Server Actions"
    - "Once-per-instance log latch (module-scoped let, mirrors the existing rate-limit attempts map's per-instance lifetime) to bound attacker-driven log volume"
    - "Reuse an existing response shape for a new refusal reason, verified by status/code SET comparison, so no new response shape becomes an enumeration oracle"

key-files:
  created: []
  modified:
    - apps/web/src/app/api/subscribe/route.ts

key-decisions:
  - "Anchored same-origin check to the request's own x-forwarded-host/host, not CONFIG.site.url — a static anchor rejects every Vercel preview deployment and every local run, and a forker who never edits it simultaneously refuses their own visitors while trusting the template author's domain"
  - "Fail-open when Origin is absent — it is a forbidden request header no page script can set and every browser adds it to every POST, so absence identifies a non-browser client that could forge any value anyway; this also keeps every existing 03-VALIDATION.md/03-04 probe's expected result unchanged"
  - "Refusal reuses the existing 400/invalid_email response verbatim rather than a new status or code, denying a prober any signal that an origin control exists (SUB-03, D-21)"
  - "Origin check placed after the configuration 404 but before the rate limiter — cheaper than a counter write, and running it after the limiter would let a cross-site attacker spend rate-limit budget keyed by victim addresses, degrading into a DoS against real subscribers once ATTEMPTS_MAX_KEYS fills"
  - "New operator log site latched to at most one line per serverless instance (originRejectionLogged), with both logged values bounded to 100 chars and JSON.stringify-escaped, per D-24/D-25"
  - "Media-type guard placed after the rate limiter (so wrongly-typed floods still spend their own quota) and compares only the portion before the first semicolon, case-insensitively, so a real client's charset parameter still passes"

patterns-established:
  - "Security-relevant module functions get a full JSDoc block naming the mechanism, the residual (what the control does NOT do), and a pointer to the plan's design-decision record — prevents a future reader from silently regressing the anchor choice"

requirements-completed: []

coverage:
  - id: D1
    description: "Same-origin precondition refuses a forged-Origin POST before it reaches the rate limiter or Resend, with a response byte-identical to the pre-existing malformed-body 400"
    verification:
      - kind: integration
        ref: "credential-free HTTP probe: 8 forged-Origin POSTs against a built server — all 400, zero 429, zero Resend log lines, forged-refusal body string-equal to unparseable-body control"
        status: pass
    human_judgment: false
  - id: D2
    description: "Same-origin and header-less POSTs still traverse the full pipeline unchanged (no regression to legitimate or non-browser traffic)"
    verification:
      - kind: integration
        ref: "credential-free HTTP probe: same-origin POST and header-less POST both return 500/server_error (Resend-stage marker); zero rejection log lines"
        status: pass
    human_judgment: false
  - id: D3
    description: "JSON media-type precondition refuses a JSON payload delivered under a CORS-safelisted Content-Type (the preflight-free delivery mechanism the review named), while parameterized/uppercase application/json still passes"
    verification:
      - kind: integration
        ref: "credential-free HTTP probe: text/plain, application/x-www-form-urlencoded, and empty Content-Type all 400 with zero Resend egress; application/json;charset=utf-8 and APPLICATION/JSON both reach 500/server_error"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan-level non-regression sweep: SC#2 (unconfigured deployment still 404s, including on a forged origin), SC#5 (secret absent from client bundle, exactly 3 files reference the env vars), D-11/D-12 (six-POST no-Origin loop still 5-allow/1-reject), D-13 (honeypot fake-success unchanged), 03-04's spoofed x-forwarded-for probe (3 of 8 refused) and length probe (312-char rejected, plus-tag long-TLD accepted), and the packages/core/site.config.ts/package.json scope fence"
    verification:
      - kind: integration
        ref: "credential-free HTTP probes across 5 fresh server sessions, plus git diff --stat scope-fence check — see Verification Evidence below"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-07-26
status: complete
---

# Phase 03 Plan 05: Same-Origin and Media-Type Preconditions Summary

**Closed the fresh code-review's Critical finding (CR-01 origin, T-03-19): `POST /api/subscribe` now refuses any request whose `Origin` host disagrees with the request's own `x-forwarded-host`/`host`, positioned ahead of the rate limiter, plus a JSON media-type precondition (T-03-20) that removes the CORS-preflight-free delivery mechanism — closing the path that let any third-party page drive a visitor's browser into enrolling an arbitrary victim's address in the site owner's Resend Audience.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-26T13:06Z
- **Tasks:** 2 completed
- **Files modified:** 1

## Accomplishments

- `isSameOriginRequest(request)`: derives the expected host from `x-forwarded-host` then `host` (never a static configured value), compares it against the `Origin` header's parsed `.host`, fails open on an absent `Origin`, and explicitly refuses the literal opaque `"null"` origin. Called immediately after the configuration 404 and immediately before the rate limiter.
- `hasJsonContentType(request)`: requires the request's declared media type to be exactly `application/json` (parameters like a charset permitted, case-insensitive) before `request.json()` runs — removing the CORS-safelisted-media-type delivery mechanism the review named. Called after the rate limiter, immediately before the body parse.
- Both refusal paths reuse the existing `400 {"ok":false,"code":"invalid_email"}` response verbatim — no new status code, no new machine code, so the module's observable response surface (`200,400,404,429,500` / `invalid_email,rate_limited,server_error`) is unchanged and asserted so by set comparison.
- New once-per-instance operator log site (`originRejectionLogged` latch, `ORIGIN_LOG_MAX_LENGTH = 100`, both logged values `JSON.stringify`-escaped) — the module now holds exactly 4 non-comment `console.` call sites (up from 3, recorded as a superseded truth per the plan), still none referencing the submitted address or the rate-limit key.
- Full `03-VALIDATION.md`/`03-04` non-regression sweep re-run and green: no existing probe's expected result changed.

## Task Commits

Each task was committed atomically:

1. **Task 03-05-T1: Same-origin precondition ahead of the rate limiter** - `81b4c07` (feat)
2. **Task 03-05-T2: JSON media-type precondition on the body parse** - `369de37` (feat)

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

- `apps/web/src/app/api/subscribe/route.ts` - Added `isSameOriginRequest`, `hasJsonContentType`, `REQUIRED_CONTENT_TYPE`, `ORIGIN_LOG_MAX_LENGTH`, `originRejectionLogged`, wired both preconditions into the D-23 pipeline, corrected the rate-limit stage comment's now-inaccurate "ahead of every other request stage" claim.

## Decisions Made

See `key-decisions` in frontmatter. Summary: anchor the same-origin check to the request's own headers (never `CONFIG.site.url`), fail open on an absent `Origin`, reuse the existing 400/invalid_email response for both new refusal reasons, place origin before the rate limiter and the media-type guard after it, and latch the new log site to one line per instance.

## Deviations from Plan

None - plan executed exactly as written. No architectural changes, no new dependencies, no new env vars, no file beyond `apps/web/src/app/api/subscribe/route.ts` touched.

## Issues Encountered

- The Bash tool's sandbox reported a non-zero/unusual exit code (144) whenever `pkill -f` was used to stop the background `next start` server, even when no matching process existed. This did not affect correctness — the shell session recovered normally each time — but it made the plan's own `pkill`-based one-liner probe scripts unreliable as written. Worked around by capturing the server's PID explicitly via `$!` at start and killing that PID (plus its `next-server` child, since `npm run start` forks a child process not covered by killing the npm wrapper's PID alone) between probe sessions. This is a harness/tooling detail, not a code change — the probe *assertions* and expected results are identical to what the plan specifies; only the process-lifecycle mechanics of running them differed.

## Verification Evidence

**Task T1 gates (all four `<automated>` blocks):**
- Source-shape gate: PASS ("OK same-origin predicate shape")
- Stage-order/response-set/logging-discipline gate: PASS ("OK stage order, response sets, logging discipline, 03-04 non-regression")
- `npx eslint src/app/api/subscribe/route.ts`: exit 0
- Probe session A (fresh server, cold counter): `base:[{"ok":false,"code":"invalid_email"} HTTP:400]` `forged:[{"ok":false,"code":"invalid_email"} HTTP:400]` (string-equal to base) `nullo:[{"ok":false,"code":"invalid_email"} HTTP:400]`; 8 forged-Origin POSTs → all `400`, zero `429`; `Resend contact` log lines: `0`; `Cross-origin submission rejected` log lines: `1`
- Probe session B (fresh server): same-origin POST → `HTTP:500 server_error`; header-less POST → `HTTP:500 server_error`; `Cross-origin submission rejected` log lines: `0`

**Task T2 gates (all four `<automated>` blocks):**
- Source-shape gate: PASS ("OK media-type precondition shape")
- `npx eslint src/app/api/subscribe/route.ts`: exit 0
- Probe session A (fresh server): `text/plain` → `HTTP:400 invalid_email`; `application/x-www-form-urlencoded` → `HTTP:400`; empty `Content-Type` → `HTTP:400`; `Resend contact` log lines: `0`
- Probe session B (fresh server): `application/json; charset=utf-8` → `HTTP:500 server_error`; `APPLICATION/JSON` → `HTTP:500 server_error`

**Plan-level `<verification>` sweep (steps 2–9):**
- Step 2 (SC#2): env-unset build → `data-testid="subscribe-form"` count `0`; forged-Origin POST against the unconfigured server → `HTTP:404` (configuration 404 still strictly precedes the origin check, D-22/SUB-02 intact)
- Step 3 (SC#5): configured build → `grep -rl RESEND_API_KEY apps/web/.next/static/` empty; exactly 3 files under `apps/web/src` reference either Resend env var (`SubscribeSection.tsx`, `email.ts`, `route.ts`)
- Step 4 (D-11/D-12): six POSTs, `Content-Type: application/json`, no `Origin` → `500 500 500 500 500 429` (5 allowed through to the Resend stage, 6th rate-limited) — unchanged from pre-plan expectation
- Step 5 (SC#4a/SC#3): honeypot-populated POST → `{"ok":true} HTTP:200` contributing zero `Resend contact` log lines; empty-honeypot control → `500 server_error`; two POSTs of an identical address → byte-identical `500 server_error` responses
- Step 6 (03-04 non-regression): 8 POSTs with 8 distinct fabricated `X-Forwarded-For` values, no `Origin` → `500 500 500 500 500 429 429 429` (exactly 3 `429`s, request 5 allowed, request 6 refused — matches 03-04-T1's expectation); 311-char address (312 with the `@`+domain, matching the plan's "312-character address") → `400 invalid_email`; `a.b+tag@sub.example.museum` → `500 server_error` (not `400`). The expensive 2006-request `ATTEMPTS_MAX_KEYS` ceiling probe (03-04-T2) was **skipped** per the plan's own guidance ("re-run it only if `isRateLimited` shows any diff in `git diff` for this plan") — `git diff` for this plan touches only `isSameOriginRequest`/`hasJsonContentType` additions and comment corrections; `isRateLimited` itself is byte-identical, confirmed by the source-shape gate's regex assertions against it in both tasks.
- Step 7 (scope fence): `git diff --stat -- packages/core/ apps/web/src/site.config.ts apps/web/package.json` empty; `git diff --name-only` across both task commits lists exactly `apps/web/src/app/api/subscribe/route.ts`
- Step 8 (lint, scoped): `npx eslint src/app/api/subscribe/route.ts` exit 0 (repo-wide gate deliberately not run — pre-existing `TerminalConsole.tsx` failures, per `deferred-items.md`)
- Step 9 (build): `npm run build --workspace=apps/web` succeeds (both env-unset and configured)

No deviation from the plan's chosen host-derivation order (`x-forwarded-host` then `host`) or the fail-open decision on an absent `Origin`.

## User Setup Required

None - no external service configuration required. This plan is purely a request-admission hardening change inside an already-deployed route.

## Self-Check: PASSED

- FOUND: apps/web/src/app/api/subscribe/route.ts
- FOUND: .planning/phases/03-subscribe-path/03-05-SUMMARY.md
- FOUND: commit 81b4c07 (Task T1)
- FOUND: commit 369de37 (Task T2)

## Next Phase Readiness

- Phase 03 (subscribe-path) is now complete across all 5 plans, with the fresh review's sole Critical finding closed.
- The residual T-03-21 (a scripted, non-browser client can still set a matching `Origin` and enroll an arbitrary address) is accepted and documented in this plan's `<threat_model>` — closing it fully requires a double opt-in/confirmation step, which `REQUIREMENTS.md` explicitly places Out of Scope. Any future work reopening that scope should start from T-03-21's rationale.
- Two review findings in this same file are deliberately deferred to a future gap-closure round rather than bundled here: **WR-05** (Resend SDK error messages logged verbatim at the two pre-existing `console.error` call sites, a possible address-leak path distinct from this plan's D-24 guarantee) and **WR-06** (`x-real-ip` trust citation gap, carried from 03-04). Both are recorded in this plan's `<verification>` § Not in scope.
- The four-item operator checklist (live Resend Audience confirmation, terminal-template SSR differential probe, post-partial-failure convergence, and the new live preview-deployment confirmation of the same-origin check) remains open pending a real Vercel/Notion/Resend environment — none of this execution context.
