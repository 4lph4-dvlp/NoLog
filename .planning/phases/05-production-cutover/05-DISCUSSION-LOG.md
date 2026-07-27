# Phase 5: Production Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 5-Production Cutover
**Areas discussed:** Operator execution model, Cron schedule time (UTC), Two-commit deployment workflow, maxDuration contingency

---

## Operator execution model

| Option | Description | Selected |
|--------|-------------|----------|
| User runs directly, shares results here | Dry-run → live run → confirm zero unemailed posts, results pasted into this conversation, Claude confirms before proceeding | ✓ |
| Already run in production, treat as complete | Backfill already done outside this session; just proceed to cron commit | |

**User's choice:** User runs directly, shares results here.
**Notes:** Applies to both SC#1 (backfill confirmation) and, by the same reasoning (no Vercel dashboard access in this environment), SC#3 (maxDuration check) — the user checks the dashboard and reports the figure.

---

## Cron schedule time (UTC)

| Option | Description | Selected |
|--------|-------------|----------|
| KST evening default (UTC 23:00, ~7 AM KST) | Initial framing — later corrected | |
| UTC 00:00, arbitrary | Neutral default | |
| Direct specify | User names an exact value | ✓ (after a clarifying detour) |

**User's choice:** Korea evening, specifically 8 PM KST → UTC 11:00 (`0 11 * * *`).
**Notes:** A clarifying sub-question was asked first: since `vercel.json`'s cron `schedule` field is static (Vercel doesn't support env-var interpolation), does "operator can configure via a config file" mean `vercel.json` itself is that file (default shipped, forker edits directly)? User confirmed yes. Then asked for the actual default value; user specified 8 PM KST, converted to UTC 11:00.

---

## Two-commit deployment workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Two direct sequential commits to main | Matches this project's existing no-PR commit pattern; commit 1 records backfill confirmation, commit 2 (strictly after) adds the vercel.json cron entry | ✓ |
| PR-gate the cron commit only | Backfill confirmation commit direct-to-main; cron-entry commit goes through a PR the user merges explicitly | |

**User's choice:** Two direct sequential commits to main.
**Notes:** No PRs are used anywhere else in this milestone; user saw no reason to introduce one here.

---

## maxDuration contingency

| Option | Description | Selected |
|--------|-------------|----------|
| Retune NOTIFY_BATCH_SIZE immediately in this phase | If the live dashboard figure differs from the assumed 300s, adjust the batch-size default now, as part of SC#3's own acceptance | ✓ |
| Record the finding only, defer adjustment | Note the discrepancy; only act if it later causes a real problem | |

**User's choice:** Retune immediately in this phase.
**Notes:** Treated as part of SC#3's acceptance criteria, not a separate follow-up.

---

## Claude's Discretion

- Exact wording/format of the commit-1 record documenting backfill confirmation — follow the existing `04-03-SUMMARY.md`/`04-03-VERIFICATION.md` operator-verification documentation convention.
- Exact `vercel.json` structure beyond the `crons` array's `path`/`schedule` fields (e.g., explicit `functions`/`maxDuration` config) — planner's call, informed by what the user reports from the dashboard.

## Deferred Ideas

None — all four areas stayed within Phase 5's production-cutover boundary.
