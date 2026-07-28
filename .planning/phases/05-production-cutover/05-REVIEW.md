---
phase: 05-production-cutover
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - apps/web/src/app/api/notify-subscribers/route.ts
  - apps/web/vercel.json
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Verified the diff between `diff_base` and `HEAD` for both files directly: `route.ts`'s change (commit `ad54eaf`) is confirmed comment-only — the `NOTIFY_BATCH_SIZE_DEFAULT` literal stays `50`, only the block comment above it was rewritten, and no other line in the file changed. `vercel.json` (commit `73a4d19`) is a clean new file containing exactly one `crons` entry (`path: "/api/notify-subscribers"`, `schedule: "0 11 * * *"`) — valid 5-field cron syntax, a plausible daily UTC schedule consistent with the Hobby-tier once-per-day/UTC-only constraint, no `functions`/`maxDuration` block, no stray fields, and no secrets. The route's `SEC-01` auth gate correctly implements Vercel's documented cron-auth contract (`Authorization: Bearer $CRON_SECRET`, constant-time comparison, fail-closed on a missing/mismatched secret), and this phase deliberately omits pinning `functions.maxDuration` in `vercel.json` — a decision already reasoned through in `05-02-PLAN.md` (batch size, not duration ceiling, is the sizing lever) rather than an oversight, so it is not re-litigated here.

The one substantive gap found during this pass is in the batch-size override path that the sizing comment (rewritten this phase) hangs its entire safety argument on: `NOTIFY_BATCH_SIZE` accepts any positive integer with no upper clamp, so an operator value larger than the sizing model's own `N_max=110` bound can silently defeat the analysis this phase just went to the trouble of writing into the comment. This is filed as a Warning, not a Critical, since it requires write access to the project's own environment variables to trigger (not attacker-reachable), but it is a real correctness gap directly adjacent to this phase's changes. An Info item restates — for traceability only, not as a new finding — that the previously-accepted duplicate-invocation race (`WR-02`, `04-REVIEW.md`) is now live in production as of this phase's `vercel.json` commit.

## Warnings

### WR-01: `NOTIFY_BATCH_SIZE` env override has no upper clamp, so it can exceed the sizing model's own safety margin and cause a mid-run timeout after the digest has already sent

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:251-253`
**Issue:**
```ts
const parsedBatchSize = Number.parseInt(process.env.NOTIFY_BATCH_SIZE ?? "", 10);
const batchSize =
  Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : NOTIFY_BATCH_SIZE_DEFAULT;
```
The only validation on the override is "parses to a positive integer." There is no ceiling. This phase's own rewritten comment (lines 9-22) derives `N_max = floor((0.6 * 300 - 15) / 1.5) = 110` as the safe upper bound implied by the confirmed 300s `maxDuration`, and states the default of 50 is comfortably inside it — but nothing in the code enforces that any operator-set override stays inside that bound too. If `NOTIFY_BATCH_SIZE` is ever set above ~110 (typo, copy-pasted example, a well-intentioned "let's clear the whole queue at once" override), the function can time out mid-execution. Critically, the marking loop (lines 348-367) runs *after* the broadcast has already been sent (line 318-332) — a timeout here means subscribers have already received the digest for posts that remain unmarked as `emailed`, so those exact posts are re-queried as "unemailed" and re-sent to every subscriber in a future run. This is the same failure mode `WR-02`/the duplicate-invocation race describes, but reachable through ordinary misconfiguration rather than concurrent execution, and it undermines the specific arithmetic this phase's comment change was written to establish.
**Fix:** Clamp the override to the same `N_max` the comment already derives (or to a smaller, hard-coded ceiling), and log when a supplied value is clamped so the operator can see it happened:
```ts
const NOTIFY_BATCH_SIZE_MAX = 110; // N_max per the sizing comment above; keep in sync if maxDuration changes
const parsedBatchSize = Number.parseInt(process.env.NOTIFY_BATCH_SIZE ?? "", 10);
const requestedBatchSize =
  Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : NOTIFY_BATCH_SIZE_DEFAULT;
const batchSize = Math.min(requestedBatchSize, NOTIFY_BATCH_SIZE_MAX);
if (requestedBatchSize > NOTIFY_BATCH_SIZE_MAX) {
  console.log(`[Notify] NOTIFY_BATCH_SIZE=${requestedBatchSize} exceeds the safe ceiling; clamped to ${NOTIFY_BATCH_SIZE_MAX}.`);
}
```

## Info

### IN-01: The previously-accepted duplicate-invocation race is now reachable in production as of this phase's cron entry

**File:** `apps/web/vercel.json:1-8`, `apps/web/src/app/api/notify-subscribers/route.ts` (query at line 236, send at line 318, mark loop at line 348)
**Issue:** Not a new finding — restated here for traceability only. `04-REVIEW.md` `WR-02` already documented and `REQUIREMENTS.md` already accepts, as a permanent design limitation, that two overlapping invocations of this route (e.g., a manual re-trigger while a scheduled run is in flight, or a Vercel-documented "may invoke the same scheduled run more than once" delivery anomaly) can both query the same unemailed posts and both send a broadcast before either marks — producing a duplicate whole-digest send. This phase's `vercel.json` is what actually puts a live, scheduled trigger in front of that previously-theoretical path. No new mitigation is being requested here; flagging only so the accepted risk is visible in the phase where it went live, in case the acceptance decision is ever revisited.
**Fix:** None required — already an accepted limitation. If revisited, `04-REVIEW.md WR-02`'s suggested mitigations (Notion-property lock, KV entry, or confirming Vercel's own overlap-prevention guarantees for this plan tier) remain the starting point.

---

_Reviewed: 2026-07-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
