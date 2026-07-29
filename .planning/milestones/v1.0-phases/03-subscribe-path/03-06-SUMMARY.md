---
phase: 03-subscribe-path
plan: 06
subsystem: api
tags: [nextjs, api-route, logging, dos-mitigation, resend]

# Dependency graph
requires:
  - phase: 03-subscribe-path
    provides: "03-05's originRejectionLogged latch convention and D-23 pipeline ordering in apps/web/src/app/api/subscribe/route.ts"
provides:
  - "unconfiguredLogged module-scope latch bounding the configuration-gate console.error to one line per serverless instance"
affects: [03-subscribe-path, future-log-hygiene-passes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-instance log latch (module-scope boolean, set before logging, cold-start-resetting) — now applied twice in this file (originRejectionLogged, unconfiguredLogged) as the file's standard mechanism for bounding attacker-driven log volume on a deterministic failure"

key-files:
  created: []
  modified:
    - "apps/web/src/app/api/subscribe/route.ts"

key-decisions:
  - "unconfiguredLogged declared immediately adjacent to originRejectionLogged at module scope, same shape, same D-09/D-25 rationale — no second mechanism introduced"
  - "The 404 return was left OUTSIDE the latch block (after its closing brace) so every request gets the identical bare 404 whether or not the log fired — the response contract SUB-02 depends on is unlatched by design"
  - "The log message's existing prefix and both variable names were preserved verbatim; only a trailing sentence ('Further occurrences in this instance are not logged.') was appended, mirroring originRejectionLogged's own message"

patterns-established:
  - "When a deterministic (non-retriable) failure branch needs its diagnostic log bounded against attacker-driven request volume, wrap only the log construction+call in `if (!latchVar) { latchVar = true; ...log... }`, declared as module-scope `let ... = false`, and leave any response/return statement outside that block"

requirements-completed: []

coverage:
  - id: D1
    description: "Configuration-gate console.error latched to exactly one line per serverless instance; five POSTs to an unconfigured server now produce 1 log line (was 5), all five still return a bare 404 with a zero-length body"
    verification:
      - kind: integration
        ref: "live HTTP probe — env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run start, 5x POST /api/subscribe, grep -c 'Route called while unconfigured' on server log"
        status: pass
    human_judgment: false
  - id: D2
    description: "Latch is per-instance and cold-start-resetting: a second fresh process (only RESEND_AUDIENCE_ID set) emits its own single line naming the correct missing variable"
    verification:
      - kind: integration
        ref: "live HTTP probe — fresh process, RESEND_AUDIENCE_ID=aud_fake_probe (RESEND_API_KEY unset), 1x POST /api/subscribe, grep on that session's own log"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-regression: configured-server rate-limit sequence (500x5, 429x1), origin-rejection latch coexistence, SC#2 (no subscribe-form markup when unset), SC#5 (no RESEND_API_KEY leak into client static bundle), D-23 stage order, status/machine-code sets, single import, env-var read set, scoped eslint"
    verification:
      - kind: integration
        ref: "live HTTP probes against configured and unconfigured builds; node structural-assertion script against route.ts; npx eslint src/app/api/subscribe/route.ts"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-07-26
status: complete
---

# Phase 3 Plan 06: Latch Unconfigured-Route Log Summary

**Wrapped the configuration-gate `console.error` in `apps/web/src/app/api/subscribe/route.ts` with a per-instance `unconfiguredLogged` boolean latch (mirroring 03-05's `originRejectionLogged`), leaving the bare 404 refusal itself unlatched — closing CR-01 without changing any response, status, or machine code.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Closed the sole Critical finding (CR-01) from the 2026-07-26 code-review pass: an anonymous request loop against any unconfigured fork can no longer grow the operator's log by more than one line per serverless instance.
- Preserved the 404 response's unlatched status: all five probe requests against an unconfigured server still received an identical, zero-length-body 404, proving the fix did not accidentally disclose route existence to a scanner (T-03-28 mitigated).
- Preserved diagnostic content: the single logged line still names exactly which Resend env var is missing, so a forker who genuinely forgot to configure still learns why their form is inert (T-03-29 mitigated).
- Confirmed the module still holds exactly four non-comment `console.` call sites, one import, the same status/machine-code sets, and unchanged D-23 pipeline ordering — no regression introduced.

## Task Commits

1. **Task 03-06-T1: Latch the unconfigured-route log to one line per instance — close CR-01** - `a539792` (fix)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/web/src/app/api/subscribe/route.ts` - Added `let unconfiguredLogged = false;` at module scope (adjacent to `originRejectionLogged`); wrapped the `missing` construction + `console.error` call in `if (!unconfiguredLogged) { unconfiguredLogged = true; ... }`; left `return new Response(null, { status: 404 })` outside that block; appended "Further occurrences in this instance are not logged." to the log message, preserving the existing prefix and both variable names verbatim.

## Decisions Made
- The latch mirrors `originRejectionLogged` exactly (module-scope `let`, set to `true` before logging) rather than introducing a counter, timer, sampling rate, or new env var — per the plan's explicit prohibition against a second bounding mechanism in the same file.
- The `return new Response(null, { status: 404 })` was kept strictly outside the latch's closing brace so every request receives the identical refusal regardless of whether the log fired — verified by a brace-balance script (exactly one unclosed brace between the `if (!apiKey || !audienceId)` guard and the `return` statement).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Server cleanup between probe sessions:** `kill $SRV` (the `npm run start` wrapper PID captured via `$!`) did not terminate the child `next-server` process it spawned, leaving a stale server bound to port 3000 that silently served probe session B's first request (confirmed via `ss -ltnp` showing the old `next-server` PID still listening). Resolved by explicitly locating and `kill -9`-ing the `next-server` child PID (via `ps aux | grep next-server`) in addition to the wrapper PID before starting each subsequent probe session — consistent with `03-05-SUMMARY.md`'s prior note that plain PID-based kill is unreliable in this sandbox for this process tree.

## Probe Evidence (recorded per plan's `<output>` spec)

**Exact final log message string, as written to source:**
```
[Subscribe] Route called while unconfigured — missing: ${missing.join(", ")}. Further occurrences in this instance are not logged.
```

**Probe session A** (fresh server, both `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` unset, 5 POSTs):
- Status codes: `,404,404,404,404,404`
- Log-line count (`grep -c 'Route called while unconfigured'`): `1` (pre-fix baseline: `5`)
- Captured 404 response body size: `0` bytes

**Probe session B** (second fresh server/process, only `RESEND_AUDIENCE_ID=aud_fake_probe` set, `RESEND_API_KEY` unset, 1 POST):
- Status: `404`
- Log-line count in that session's own log: `1` (proves cold-start reset — not vacuously satisfied by a globally suppressed message from session A)
- Full captured log line: `[Subscribe] Route called while unconfigured — missing: RESEND_API_KEY. Further occurrences in this instance are not logged.`
- Confirmed the line names `RESEND_API_KEY` and does NOT name `RESEND_AUDIENCE_ID` (the variable that was set)

**Console call-site count:** confirmed exactly 4 non-comment `console.` call sites in the module (origin-rejection log, this configuration-gate log, two Resend error logs) — unchanged from the pre-plan count, no new call site added.

**Non-regression sweep (plan `<verification>` steps 2-5):**
- Configured server, six POSTs (JSON content-type, no Origin): `500 500 500 500 500 429` — matches `03-VALIDATION.md`'s SC#4b loop, zero `Route called while unconfigured` lines in that session's log.
- Configured server, one POST with forged cross-site `Origin: https://evil.example.com`: `400 invalid_email`, exactly one `Cross-origin submission rejected` line, zero `Route called while unconfigured` lines in the same session — both latches coexist without suppressing each other.
- Unconfigured build served: `curl -s http://localhost:3000/ | grep -c 'data-testid="subscribe-form"'` → `0`.
- Configured build: `grep -rl RESEND_API_KEY apps/web/.next/static/` → no output (no leak).
- `git diff --name-only` lists exactly `apps/web/src/app/api/subscribe/route.ts`; `git diff --stat -- packages/core/ apps/web/src/site.config.ts apps/web/package.json` empty; no `03-01`…`03-05` PLAN/SUMMARY file modified.
- `(cd apps/web && npx eslint src/app/api/subscribe/route.ts)` exits 0.
- `npm run build --workspace=apps/web` succeeds both with both Resend vars unset and with placeholder credentials set.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 (subscribe-path) is now complete across all six plans (03-01 through 03-06), with the CR-01 (unconfigured-log-volume) gap closed and no regression to any prior plan's guarantees.
- Two review findings remain deliberately out of scope for a future round: WR-05/WR-06 (Resend SDK error-message logging hygiene and the outer `catch`'s silent-drop behavior) and WR-07 (`x-real-ip` trust claim citation) — recommended as `03-07` per this plan's `<verification>` § Not in scope.
- No blockers for Phase 4 (notify-subscribers cron/digest work), which depends on this route's Resend integration remaining stable — unaffected by this plan's changes.

---
*Phase: 03-subscribe-path*
*Completed: 2026-07-26*

## Self-Check: PASSED
