# Phase 5 — API Coverage Matrix

**Produced:** 2026-07-27 (plan time)

## Declaration: no external API integration in this phase

Phase 5 integrates **no new external API or SDK**, so there is no capability surface to decide `INTEGRATE` / `OPT-OUT` against. This is a reasoned declaration, not an omission — the reasoning is below.

**What this phase actually writes:**

1. `vercel.json` — a static JSON config file holding one `crons` entry (`path`, `schedule`). It is read by the Vercel build/deploy platform, not called by this codebase. No client is constructed, no request is issued from application code, and no SDK is added to `package.json`.
2. `apps/web/src/app/api/notify-subscribers/route.ts` — one numeric constant (`NOTIFY_BATCH_SIZE_DEFAULT`) and its explanatory comment, retuned against the operator-read function duration ceiling per 05-CONTEXT.md D-05. No call site, argument shape, or response handling changes.
3. `.planning/phases/05-production-cutover/05-01-VERIFICATION.md` — a planning-directory record. No runtime surface at all.

**Why the surfaces this phase exercises are already covered:**

| External API | Where its coverage lives | Why nothing is re-derived here |
|---|---|---|
| Notion REST API v1 (`getUnemailedPublicPosts`, `markEmailed`) | `.planning/phases/01-notion-data-layer/COVERAGE.md` scope, then `.planning/phases/02-backfill-script/COVERAGE.md` | This phase *invokes* the already-shipped Phase 2 backfill CLI against production; it adds no method, parameter, or error branch. The operator runs it — the agent holds no credentials |
| Resend (Broadcast / Audience) | `.planning/phases/03-subscribe-path/COVERAGE.md` and `.planning/phases/04-notify-route/COVERAGE.md` | Phase 4 re-derived the Broadcast surface from a full-coverage baseline. This phase changes only how many posts one already-covered `broadcasts.create` call may carry, which is a numeric cap on existing behaviour, not a new capability |
| Vercel Cron | n/a — platform configuration, not an API this codebase calls | The `crons` schema (`path`, `schedule`) is consumed by Vercel's deploy pipeline. The application never imports a Vercel SDK; `@vercel/analytics` and `@vercel/og` were already in the tree before this phase and are untouched by it |

**Platform constraints carried into the plans rather than into a coverage row** (from PROJECT.md Constraints and 04-RESEARCH.md Pitfall 3): Vercel Hobby caps cron frequency at once per day, evaluates schedules in UTC with roughly ±59 minutes of slack, and fires cron only on Production deployments. The function `maxDuration` figure is deliberately *not* taken from documentation here — ROADMAP SC#3 requires it be read from the deployed project's own dashboard, which is 05-01 Task 1's job, and it feeds 05-01 Task 3's batch-size arithmetic.

**Package Legitimacy Gate:** not applicable. Neither plan runs an `npm` / `pip` / `cargo` install task; no package enters the dependency tree in this phase.

---
*Phase: 05-production-cutover*
*Coverage declared at plan time, 2026-07-27*
