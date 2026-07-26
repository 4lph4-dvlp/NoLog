---
phase: 03-subscribe-path
plan: 02
subsystem: api
tags: [rate-limiting, honeypot, abuse-resistance, next.js-route-handler]

# Dependency graph
requires: ["03-01-tracer"]
provides:
  - "Per-IP rate limit (5 requests / 10-minute fixed window, module-scoped Map) inserted as D-23 stage 2"
  - "Server-side honeypot check on the `company` field inserted as D-23 stage 3"
  - "Complete five-stage D-23 pipeline in apps/web/src/app/api/subscribe/route.ts: configuration -> rate limit -> honeypot -> validation -> Resend"
affects: [03-03-terminal-template, phase-4-notify-subscribers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scoped Map as an in-process rate limiter, explicitly documented at its declaration as per-instance/cold-start-resetting rather than a distributed guarantee (D-09)"
    - "Fake-success response (identical status + body to a real success) as a bot-silent honeypot drop, constructed at its own branch rather than by falling through the success path"
    - "Sweep-on-write bound on unbounded in-process state, avoiding any timer or background task in a serverless request path"

key-files:
  modified:
    - apps/web/src/app/api/subscribe/route.ts

key-decisions:
  - "No deviations required — both tasks implemented exactly as D-23/D-09/D-10/D-11/D-12/D-13/D-14/D-24/D-25 specify"
  - "Verified server-lifecycle probes (SC#4a, SC#4b) using setsid-detached background processes rather than plain `&` backgrounding, after two initial attempts were killed together with their parent shell by the tool sandbox's process-group timeout; this is a verification-harness detail only, not a code change"

patterns-established:
  - "Pattern: any new per-request early-return stage in this route is wired ahead of body parsing when it must apply uniformly to malformed input too (rate limit), and after body parsing when it needs the parsed body (honeypot) — the D-23 stage order is now the canonical extension point for phase 4's notify path if it ever needs comparable request-level gating"

requirements-completed: [SUB-04, SUB-03]

coverage:
  - id: D5
    description: "The 6th POST from one client IP inside a 10-minute window returns 429 with {ok:false,code:rate_limited}; the 5th is processed normally"
    requirement: "SUB-04"
    verification:
      - kind: e2e
        ref: "curl loop of 6 POSTs against a live build with placeholder Resend credentials: codes were 500,500,500,500,500,429 (first five reach Resend and fail on the fake key; sixth is rate-limited); seventh returns {\"ok\":false,\"code\":\"rate_limited\"}"
        status: pass
    human_judgment: false
  - id: D6
    description: "A 429 response body carries only the machine code and discloses nothing about Audience membership"
    requirement: "SUB-03"
    verification:
      - kind: unit
        ref: "static assertion that the over-limit response body contains no subscribe/exist/already wording"
        status: pass
    human_judgment: false
  - id: D7
    description: "A POST with the honeypot field populated returns HTTP 200 {ok:true}, byte-identical to a real success, and never reaches Resend; a control request with an empty honeypot does reach Resend (non-vacuous gate)"
    requirement: "SUB-04"
    verification:
      - kind: e2e
        ref: "live-server probe: honeypot-populated request -> {\"ok\":true} HTTP:200 with zero new 'Resend contact' log lines; immediately following control request with empty honeypot -> {\"ok\":false,\"code\":\"server_error\"} HTTP:500 with two new 'Resend contact' log lines, proving the trap short-circuited rather than the route never reaching Resend either way"
        status: pass
    human_judgment: false
  - id: D8
    description: "All five D-23 stages (configuration, rate limit, honeypot, validation, Resend) appear in the file in that order, asserted by index comparison rather than by eye"
    requirement: "SUB-04"
    verification:
      - kind: unit
        ref: "node -e index-comparison script across '404', 'isRateLimited', 'company', 'EMAIL_PATTERN', 'contacts.create' substrings within the POST handler body"
        status: pass
    human_judgment: false
  - id: D9
    description: "Exactly three console call sites exist in the module after both tasks land, and none references the address or IP identifiers; no new dependency was added"
    requirement: "SUB-04"
    verification:
      - kind: unit
        ref: "console-site count assertion (=== 3) plus a per-line grep for normalizedEmail/clientIp/getClientIp( against every console. line; package.json diff empty for this plan"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-07-26
status: complete
---

# Phase 3 Plan 02: Rate Limit and Honeypot Abuse-Resistance Layer Summary

**Inserted a module-scoped per-IP rate limiter (5/10min, D-10) and a server-side honeypot check (D-13) into `/api/subscribe`, completing the full five-stage D-23 pipeline with zero new dependencies and zero added log output.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-26
- **Tasks:** 2 (03-02-T1 rate limit, 03-02-T2 honeypot)
- **Files modified:** 1 (`apps/web/src/app/api/subscribe/route.ts`)

## Accomplishments
- Rate limiter (D-09/D-10/D-12): module-scoped `attempts` Map, `getClientIp` keying on the first comma-separated `x-forwarded-for` entry with a shared `"unknown"` fallback, `isRateLimited` enforcing a strictly-greater-than fixed-window boundary at 5 requests / 10 minutes, with a sweep-on-write bound (`ATTEMPTS_SWEEP_THRESHOLD = 1000`) so the map never grows unbounded and no timer runs in the serverless path.
- Honeypot (D-13/D-14): reads the same `company` field the client form already sends, returns a byte-identical `{ok:true}`/200 fake success when populated, and drops the submission before it ever reaches address validation or the Resend API. No time-on-page trap was added — that half of the standard pairing stays out of scope per D-14.
- D-23 ordering enforced end to end: configuration check -> rate limit -> honeypot -> validation -> Resend, mechanically asserted by index comparison rather than by eye.
- D-24/D-25 preserved: the module still holds exactly three `console.` call sites (the same three from 03-01), and none of them reference the client IP or the email identifier — rate-limit and honeypot paths add zero log output.
- Live-server proof for both success criteria: SC#4b's six-request loop returned `500,500,500,500,500,429` (first five reach Resend against a fake key; sixth is rate-limited) and the seventh returned `{"ok":false,"code":"rate_limited"}`. SC#4a's honeypot probe returned `{"ok":true}` HTTP 200 with zero new Resend log lines, immediately followed by a non-vacuous control request (empty honeypot) that did reach Resend and returned `server_error`.

## Task Commits

Each task was committed atomically:

1. **Task 03-02-T1: Per-IP rate limit — D-23 stage 2** - `8213869` (feat)
2. **Task 03-02-T2: Server-side honeypot — D-23 stage 3** - `482a30b` (feat)

## Files Modified
- `apps/web/src/app/api/subscribe/route.ts` - Added `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_MAX`/`ATTEMPTS_SWEEP_THRESHOLD` constants, the `attempts` Map, `getClientIp`/`isRateLimited` functions, and the honeypot short-circuit; wired both new stages into the handler at the exact D-23 positions between the configuration check and address validation.

## Decisions Made
- No implementation deviations: both tasks landed exactly as specified in D-09 through D-14, D-23, D-24, D-25.
- Verification-harness note (not a deviation from the plan's own gates, but worth recording): the two live-server `<verify>` probes in this plan background `npm run start` and then send curl requests against it. Plain `command &` backgrounding left the server process in the same process group as the invoking shell call, and the execution sandbox's per-call timeout killed the whole group before the probe completed on the first two attempts (observed as exit code 144 with `npm error code 143` in the server log). Switched to `setsid nohup npm run start ... < /dev/null &` to fully detach the server from the calling shell's process group, after which both probes completed and were cleanly torn down with `pkill -9`. This is a mechanical detail of how this plan's `<verify>` bash gates were executed in this environment, not a change to `route.ts` or to the gates' pass/fail criteria.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; the tracer from 03-01 already provided every seam this plan's stages needed (the `company` field name, the response-code contract, the three existing log sites).

## Issues Encountered
- Same pre-existing, out-of-scope lint failure noted in `03-01-SUMMARY.md` and logged in `deferred-items.md`: `npm run lint --workspace=apps/web` fails on 15 pre-existing errors in `apps/web/src/templates/terminal/components/TerminalConsole.tsx`, a file this plan does not touch. Verified this plan's own file (`route.ts`, plus `SubscribeForm.tsx` for the field-name-agreement check) lints clean in isolation via `npx eslint <files>` (zero errors, zero warnings) as the workaround, matching 03-01's precedent. No new entry added to `deferred-items.md` since this is the identical pre-existing issue, not a new one.

## User Setup Required
None. Both success criteria for this plan (SC#4a, SC#4b) close entirely against placeholder Resend credentials on a local build — no real Resend account or Notion credentials needed. The two operator-checklist items already tracked in `03-01-SUMMARY.md` (live Audience confirmation, live duplicate-submission diff) are unaffected by and unrelated to this plan's scope.

## Next Phase Readiness
- The full D-23 pipeline (configuration -> rate limit -> honeypot -> validation -> Resend) is complete and mechanically verified in `apps/web/src/app/api/subscribe/route.ts`. Plan 03-03 (terminal template + form wiring) can proceed without touching this file — its own `<verification>` section already asserts that files outside this route show no diff from this plan, confirmed here (`git diff --name-only` across both task commits touches only `route.ts`; `apps/web/package.json` is byte-identical to before this plan).
- T-03-11 (distributed/rotating-IP abuse bypassing the per-instance counter) remains an accepted residual risk per the plan's threat model, documented in code at the `attempts` Map declaration. No action needed from this plan; closing it would require a distributed store, which stays out of scope per `REQUIREMENTS.md`.
- No blockers.

## Self-Check: PASSED

Confirmed `apps/web/src/app/api/subscribe/route.ts` exists on disk at 175 lines (min_lines: 95 satisfied), contains `x-forwarded-for`, and both `getClientIp`/`isRateLimited` symbols. Confirmed exactly three `console.` call sites, none referencing `normalizedEmail`, `clientIp`, or `getClientIp(`. Both task commits (`8213869`, `482a30b`) confirmed present in `git log --oneline -5`. `apps/web/package.json` confirmed unchanged (`git diff` empty) for this plan.

---
*Phase: 03-subscribe-path*
*Completed: 2026-07-26*

## Self-Check: PASSED (verified)
