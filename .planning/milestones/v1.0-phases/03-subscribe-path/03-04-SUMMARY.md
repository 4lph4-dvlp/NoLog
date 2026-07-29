---
phase: 03-subscribe-path
plan: 04
subsystem: api
tags: [rate-limiting, security, gap-closure, next-js, vercel-headers]

# Dependency graph
requires:
  - phase: 03-subscribe-path (03-01, 03-02)
    provides: "/api/subscribe route with rate limiting, honeypot, and Resend contact create/update pair"
provides:
  - "Platform-first rate-limit identity derivation (x-vercel-forwarded-for -> x-real-ip -> x-forwarded-for) closing CR-01 header-spoofing gap"
  - "Expiry-independent hard ceiling (ATTEMPTS_MAX_KEYS=2000) on the in-memory attempts map, closing CR-01's secondary DoS defect"
  - "Optional defense-in-depth email-length guard (IN-04) ahead of the validation regex"
affects: ["04-notify-route", "05-production-cutover"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tiered platform-header trust: prefer platform-injected headers, discard client-suppliable-only headers into a shared bucket rather than trusting them as identity"
    - "Expiry-independent cardinality ceiling with has()-guarded collapse to prevent both unbounded map growth and attacker-triggered lockout of existing entries"

key-files:
  created: []
  modified:
    - apps/web/src/app/api/subscribe/route.ts

key-decisions:
  - "getRateLimitKey replaces getClientIp entirely (name removed from file, including comments); reads the LAST comma-separated entry of each candidate header on the stated one-trusted-hop assumption verified against Vercel's request-headers docs (fetched 2026-07-26)"
  - "A bare x-forwarded-for with no platform header alongside it is treated as untrusted: its value is discarded and the request is bucketed under a shared 'untrusted' key, distinct from the pre-existing 'unknown' key, so a spoofing burst cannot throttle header-less/local-dev traffic"
  - "ATTEMPTS_MAX_KEYS=2000 enforced by collapse (not rejection) into ATTEMPTS_OVERFLOW_KEY, guarded by an attempts.has() membership test so an existing visitor's bucket is never evicted once the map is full"
  - "T3 (IN-04 email-length guard) was executed, not dropped -- straightforward, in-scope file, zero risk to D-15's loose-validation intent"

requirements-completed: [SUB-04]

coverage:
  - id: D1
    description: "Rate-limit identity now keyed on platform-owned headers (x-vercel-forwarded-for, x-real-ip) with x-forwarded-for treated as untrusted and collapsed into a shared bucket -- closes CR-01"
    requirement: "SUB-04"
    verification:
      - kind: e2e
        ref: "live-server probe: 8 POSTs with distinct fabricated x-forwarded-for values -> exactly 3 of 8 refused with 429/rate_limited (0 of 8 before this plan)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Expiry-independent hard ceiling (ATTEMPTS_MAX_KEYS=2000) bounds the attempts map regardless of key cardinality or freshness"
    requirement: "SUB-04"
    verification:
      - kind: e2e
        ref: "live-server probe: 2006 POSTs with distinct x-vercel-forwarded-for values -- 0 of first 2000 refused, request 2005 not refused, request 2006 refused (429), 0 Resend egress logged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Optional IN-04 length guard: addresses over 254 chars refused with the existing invalid_email/400 response before the regex runs; does not tighten D-15's loose validation"
    verification:
      - kind: e2e
        ref: "live-server probe: 312-char address -> 400/invalid_email; a.b+tag@sub.example.museum not rejected as 400"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full non-regression sweep: D-12 'unknown' bucket unchanged (6-request loop, 5 not refused, 6th 429), honeypot byte-identical 200 with zero Resend calls, idempotent identical-address responses, SC#2 SSR gating, SC#5 secret absent from client bundle, D-23 stage order, D-24/D-25 logging discipline, scope fence (only route.ts changed), eslint clean, build succeeds"
    verification:
      - kind: e2e
        ref: "plan <verification> steps 1-8, re-run against the final committed state"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-07-26
status: complete
---

# Phase 03 Plan 04: CR-01 Rate-Limit Identity Hardening Summary

**Replaced the client-spoofable `x-forwarded-for`-only rate-limit key with a platform-header-first tiered derivation, and added an expiry-independent 2000-key hard ceiling on the counter map — closing both halves of review finding CR-01.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-26T11:38:00Z
- **Completed:** 2026-07-26T11:59:00Z
- **Tasks:** 3 (T1 required, T2 required, T3 optional — executed)
- **Files modified:** 1

## Accomplishments

- `getRateLimitKey` replaces `getClientIp`: tries `x-vercel-forwarded-for`, then `x-real-ip` (both platform-owned, trusted), then `x-forwarded-for` (untrusted — value discarded, request bucketed under the shared `"untrusted"` key). Header names verified directly against Vercel's request-headers docs during planning (fetched 2026-07-26).
- Live reproduction-then-fix proof: 8 POSTs with 8 distinct fabricated `x-forwarded-for` values now yield exactly **3 of 8** `429`/`rate_limited` responses, against **0 of 8** before this plan (the exact defect `03-VERIFICATION.md` and `03-REVIEW.md` CR-01 both reproduced).
- `ATTEMPTS_MAX_KEYS` (2000) and `ATTEMPTS_OVERFLOW_KEY` ("overflow") added: once 2000 distinct keys exist, a new key collapses into the shared overflow bucket (an `attempts.has()` membership test ensures an already-tracked visitor never loses their bucket). Live probe: 2006 POSTs with distinct `x-vercel-forwarded-for` values — zero of the first 2000 refused, request 2005 not refused, request **2006 refused (429)**, zero Resend egress logged.
- Stale comments corrected: the module no longer claims the ten-minute window bounds the counter map's size; `ATTEMPTS_MAX_KEYS` is now the stated (and true) bound.
- Optional T3 (review finding IN-04) executed: addresses over 254 characters are refused with the existing `invalid_email`/400 response before the loose D-15 regex runs.
- Full non-regression sweep (plan `<verification>` steps 1-8) re-run against the final committed state: D-12's `"unknown"` bucket, honeypot byte-identical success, idempotency, SC#2 SSR gating, SC#5 bundle-secret absence, D-23 stage order, D-24/D-25 logging discipline, scope fence, lint, and build all pass.

## Task Commits

Each task was committed atomically:

1. **Task 03-04-T1: Platform-first rate-limit identity — close CR-01 end to end** - `fe44aab` (fix)
2. **Task 03-04-T2: Hard cardinality ceiling on the counter map** - `0af71b7` (fix)
3. **Task 03-04-T3 (optional, executed): bound the address length before the regex — IN-04** - `3f8f14e` (fix)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified

- `apps/web/src/app/api/subscribe/route.ts` — `getRateLimitKey` (replaces `getClientIp`), `ATTEMPTS_UNTRUSTED_KEY`, `ATTEMPTS_MAX_KEYS`, `ATTEMPTS_OVERFLOW_KEY`, ceiling-collapse logic in `isRateLimited`, corrected bound-attribution comments, and the optional `MAX_EMAIL_LENGTH` guard.

## Decisions Made

- Executed the optional T3 (IN-04 length guard) rather than dropping it — the file was already open for this gap closure, the guard is one line, and it reuses the existing `invalid_email` response with no new machine code, so the marginal risk was near zero.
- Reconstructed the file's edit history into three sequential intermediate states (T1-only, T1+T2, T1+T2+T3) to satisfy per-task atomic commit requirements, even though the working edit was authored in one pass — each intermediate state was independently gate-verified (source assertions, eslint, and live-server probes) before its commit, not just diffed.
- Kept `"untrusted"` and `"unknown"` as two distinct literals per the plan's explicit prohibition against merging them (would let a tier-3 spoofing burst throttle header-less/local-dev traffic).

## Deviations from Plan

None — plan executed exactly as written. All must-have truths, prohibitions, and artifact assertions hold; T3 was executed rather than dropped, which the plan explicitly permits either way.

## Issues Encountered

- First run of the T3 live probe (over-long-address / plus-tag control) was executed against a server instance whose `"unknown"` rate-limit bucket had already been exhausted by an earlier probe in the same session, producing a false `429` instead of the expected `400`/`500`. Resolved by restarting the server fresh (module-scoped counter resets on process restart) and re-running the probe in isolation as the first two requests of that session — passed cleanly. Not a defect in the shipped code; an artifact of sequential manual probing sharing one long-lived dev server.

## User Setup Required

None — no external service configuration required. No new env var, dependency, or forker setup step was introduced (verified: `apps/web/package.json` unchanged, `packages/core/` unchanged, `site.config.ts` unchanged).

## Next Phase Readiness

- SUB-04 moves from BLOCKED to satisfied. ROADMAP SC#4's rate-limit half now holds behaviorally, not just by source read.
- Residual accepted risk (T-03-11, unchanged from 03-02): the counter is per-serverless-instance, in-memory, and resets on cold start — a distributed attacker or one who waits out a cold start still gets more than five attempts per instance. This is a bulk-abuse dampener, not a deterministic gate, and needs a distributed store (Vercel KV/Redis) that `REQUIREMENTS.md` puts Out of Scope. Not narrowed by this plan; carried forward unchanged.
- Three operator-checklist items (live Resend Audience confirmation, terminal-template SSR differential, post-partial-failure convergence) remain carried forward from `03-VERIFICATION.md`, requiring credentials this execution environment lacks — unchanged by this plan.
- Phase 03 (subscribe-path) is now fully complete: all 4 plans executed, SUB-04's rate-limit gap closed, no known blockers to Phase 4 (Notify Route).

---
*Phase: 03-subscribe-path*
*Completed: 2026-07-26*

## Self-Check: PASSED

- FOUND: `.planning/phases/03-subscribe-path/03-04-SUMMARY.md`
- FOUND: `apps/web/src/app/api/subscribe/route.ts`
- FOUND commit: `fe44aab` (T1)
- FOUND commit: `0af71b7` (T2)
- FOUND commit: `3f8f14e` (T3)
- FOUND commit: `8b78314` (docs: SUMMARY)
