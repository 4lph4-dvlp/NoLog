# Phase 5: Production Cutover - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase is an operational runbook, not a feature build: it puts the notify path live in production, but only after the backfill (Phase 2) has been confirmed complete against the real production Notion database. The phase's entire purpose is enforcing a strict ordering — backfill confirmed empty, THEN (and only then) the `vercel.json` cron entry ships, as its own deliberate, separately-timestamped commit. No new application code is written here beyond `vercel.json` itself and whatever record documents the backfill confirmation. It also closes ROADMAP SC#3 by verifying the real Vercel Hobby `maxDuration` directly against the deployed project's dashboard, rather than trusting the research-derived 300s figure.

Requirements covered: OPS-01 (`.planning/REQUIREMENTS.md`).

Out of scope: any notify-route code changes (Phase 4, complete), backfill script changes (Phase 2, complete), README documentation (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Operator execution model

- **D-01:** Both live-system checks this phase requires — SC#1 (run backfill against production, confirm `getUnemailedPublicPosts()` returns zero) and SC#3 (check the real Vercel Hobby `maxDuration` in the deployed project's dashboard) — are performed by the user directly in this environment, not delegated to a subagent or assumed complete. The user runs the backfill script (dry-run, then live, per Phase 2's D-01/D-02) and checks the Vercel dashboard themselves, then reports results back in conversation. The executor confirms zero-unemailed-posts and the actual `maxDuration` value from what the user reports before proceeding to the cron-entry commit. This mirrors Phase 4's 04-03 operator-verification pattern — Claude has no live `NOTION_TOKEN`/`NOTION_DATABASE_ID` or Vercel dashboard access in this execution environment.

### Cron schedule configuration

- **D-02:** `vercel.json` itself is the "config file" for the cron schedule — there is no env-var-driven or build-time-generated schedule. A sensible default UTC time is committed directly into `vercel.json`'s `schedule` field; any forker who wants a different time edits that field directly. No new build step, no `NOTIFY_CRON_SCHEDULE` env var. — **Reversibility:** reversible — a build-time generation step could be added later without touching the notify route itself, but there's no reason to given Vercel doesn't support env-var interpolation inside `vercel.json` and the project's "no new infrastructure / minimal" principle rules out adding a generation step for this.
- **D-03:** The default schedule is **UTC 11:00** (`0 11 * * *`), chosen to land at 8 PM KST — the primary target audience (Korean-speaking blog visitors) gets the digest in the evening rather than the middle of their night. Phase 6's README should note this default is KST-oriented and point forkers at `vercel.json`'s `schedule` field if they want a different time zone's evening (or any other time).

### Two-commit deployment workflow

- **D-04:** No PR gating for either step. Both land as direct sequential commits to `main`, matching this project's existing commit pattern (no PRs used anywhere else in this milestone). Commit 1 records the backfill confirmation (the operator-verification result — zero unemailed posts confirmed against production). Commit 2, strictly after and separate from commit 1, adds the `vercel.json` cron entry. Vercel auto-deploys on push to `main`, so commit 2 going out is the actual go-live moment. — **Reversibility:** costly — once commit 2 lands and Vercel picks it up, the cron entry is live in production; reverting requires another commit plus waiting for the next deploy, and any cron ticks that already fired before the revert can't be undone (digests already sent).

### maxDuration contingency

- **D-05:** If the user's live dashboard check reports a `maxDuration` other than the assumed 300s, `NOTIFY_BATCH_SIZE`'s default (currently 50, set in `apps/web/src/app/api/notify-subscribers/route.ts`) is retuned immediately within this same phase — not deferred to a follow-up phase or TODO. This phase's plan should treat "confirm or correct the batch-size default" as part of SC#3's own acceptance criteria, not a separate concern.

### Claude's Discretion

- Exact wording/format of the commit-1 record documenting backfill confirmation (e.g., a short `05-*-SUMMARY.md`-style note vs. a STATE.md entry) — no strong preference expressed; follow the project's existing operator-verification documentation convention from `04-03-SUMMARY.md`/`04-03-VERIFICATION.md`.
- Exact `vercel.json` structure beyond the `crons` array's `path`/`schedule` fields (e.g., whether `functions`/`maxDuration` config is also set explicitly in `vercel.json` once SC#3's real figure is confirmed) — planner's call, informed by whatever the user reports from the dashboard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Operations (OPS) — OPS-01, the exact requirement this phase must satisfy
- `.planning/ROADMAP.md` §Phase 5: Production Cutover — Goal and the 3 success criteria this phase's plan must satisfy
- `.planning/PROJECT.md` §Constraints — the Vercel Hobby tier limits (cron once/day, ±59min precision, UTC-only) and the explicitly-unconfirmed `maxDuration` figure this phase's SC#3 resolves

### Existing Codebase
- `apps/web/src/app/api/notify-subscribers/route.ts` lines 1–16 — `NOTIFY_BATCH_SIZE_DEFAULT` (currently 50) and its comment explaining the reasoning against the assumed-but-unconfirmed 300s figure; this is what D-05's contingency retunes if the live check differs
- `packages/core/scripts/backfill.ts` and `packages/core/package.json`'s `backfill` npm script — the exact command the operator runs for SC#1 (dry-run first, per Phase 2's D-01/D-02)
- No `vercel.json` exists yet in the repo — this phase creates it for the first time

### Prior Phase Context (carried forward)
- `.planning/phases/02-backfill-script/02-CONTEXT.md` D-01/D-02 — dry-run-first, no-extra-confirmation-gate convention the operator's live backfill run (D-01 this phase) follows exactly
- `.planning/phases/04-notify-route/04-CONTEXT.md` D-10/D-11 — the `NOTIFY_BATCH_SIZE` env var's origin and its explicit deferral of final sizing to this phase's SC#3
- `.planning/phases/04-notify-route/04-RESEARCH.md` Pitfall 3 (confirmed) — Vercel Hobby `maxDuration` is 300s default/max under Fluid Compute (default-enabled), fetched 2026-07-27 against current Vercel docs; this phase's SC#3 only needs to confirm this holds for the specific target project, not adjudicate between two very different numbers
- `.planning/STATE.md` §Blockers/Concerns — "RESOLVED 2026-07-27" entry noting Phase 5 SC#3 still owns confirming the specific deployed project's setting even though the general Hobby figure is resolved
- `.planning/phases/04-notify-route/04-03-SUMMARY.md` / `04-03-VERIFICATION.md` — the operator-verification documentation convention D-01/Claude's Discretion this phase should follow for recording the backfill confirmation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getUnemailedPublicPosts()` (`packages/core/src/client.ts`) — the exact method the operator's post-backfill check calls to confirm zero unemailed posts (SC#1); no new code needed, just direct invocation/verification
- `packages/core/scripts/backfill.ts` + its `npm run backfill` wrapper (Phase 2) — already handles dry-run, live run, retry, and abort-on-systemic-error; this phase only needs the operator to actually run it against production

### Established Patterns
- Direct-commit-to-main workflow (no PRs used anywhere in this milestone) — D-04 continues this rather than introducing PR gating for the first time
- `[Context] message` bracket-prefixed console logging convention — not directly relevant to this phase's `vercel.json`-only change, but worth keeping in mind if SC#3's contingency (D-05) requires editing the route file's batch-size comment

### Integration Points
- `vercel.json` (repo root, new file) — the sole new artifact besides the batch-size tuning contingency; only a `crons` array entry (`path: "/api/notify-subscribers"`, `schedule: "0 11 * * *"`) is required, per D-02/D-03
- `apps/web/src/app/api/notify-subscribers/route.ts` `NOTIFY_BATCH_SIZE_DEFAULT` — the single line D-05's contingency would touch if the live `maxDuration` check surfaces a different figure

</code_context>

<specifics>
## Specific Ideas

The user's priorities across this discussion: keep the operator (user) directly in the loop for both live-system checks rather than assuming completion or delegating to a subagent that lacks credentials; keep `vercel.json` itself as the single, editable source of truth for the cron schedule rather than adding any indirection (env var, build step) that the project's minimal/no-new-infrastructure principle would reject; default the digest to 8 PM Korea time (UTC 11:00) since the target audience is Korean-speaking; and stay consistent with the project's existing direct-to-main commit pattern rather than introducing PR review for this one phase.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — all four areas stayed within Phase 5's production-cutover boundary. No scope creep occurred.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 5.

</deferred>

---

*Phase: 5-Production Cutover*
*Context gathered: 2026-07-27*
