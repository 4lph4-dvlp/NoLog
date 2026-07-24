# NoLog

## What This Is

NoLog is a fork-and-deploy blog template: a Notion database as the sole datastore, GitHub for source, and Vercel for hosting/ISR — no separate server, no separate database. Site owners write posts in Notion and flip a `Status` property to `public` to publish. It ships with an optional Cusdis comment integration, gated entirely by an env var, that any forker can turn on or leave off.

## Core Value

A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.

## Requirements

### Validated

- ✓ Notion-as-datastore blog rendering (posts fetched via raw REST calls in `NologClient`, filtered on `status === "public"`) — existing
- ✓ ISR revalidation (180s, `notion-posts` cache tag) — existing
- ✓ Multiple page templates (`default`, `terminal`) — existing
- ✓ Optional Cusdis comment integration, off-by-default via `NEXT_PUBLIC_CUSDIS_APP_ID` — existing (fail-open bug in `CommentSection.tsx` found and fixed this session, commit `7d657c9`)
- ✓ OG image generation via `/api/og` (edge runtime) — existing

### Active

**Email subscription for new posts** — fully designed and approved via `/autoplan` on 2026-07-24 (see `.gstack/projects/4lph4-dvlp-NoLog/alpha-pi-main-design-20260724-161749.md` for the full design doc, status APPROVED). Summary:

- [ ] `packages/core`: add `getUnemailedPublicPosts()` and `markEmailed(pageId)` to `NologClient`
- [ ] One-time backfill script/step: mark all pre-existing public posts as `Emailed` before first cron run, so enabling the feature never blasts the back catalog
- [ ] `/api/notify-subscribers` route: fail-closed on missing `CRON_SECRET`, checks the secret before doing anything else, no-ops immediately if Resend env vars are unset
- [ ] **Same-day digest**: one cron run finds *all* unemailed public posts and sends **one email listing every post from that run** (title/summary/link/thumbnail per post), not one email per post — pulled forward into v1 scope during roadmap review on 2026-07-24 (was originally deferred to `TODOS.md`, relevant once Resend's 100/day cap became a real concern, but the user wants it now rather than waiting). A problem building one post's section of the digest must not prevent the other posts from being included and sent (isolation moves from per-post-email to per-post-section-within-the-digest).
- [ ] `vercel.json`: once/day cron entry targeting the notify route (Hobby-tier compatible)
- [ ] `/api/subscribe` route: adds a contact to a Resend Audience, honeypot + validation, fail-closed if env vars unset, idempotent on duplicate submission
- [ ] Subscribe form component: gated server-side (not via `NEXT_PUBLIC_*`, since `RESEND_API_KEY` is a secret) so it renders only when configured — same user-facing behavior as the Cusdis pattern, different mechanism
- [ ] Email template: title, summary, link, OG-image thumbnail as header (reusing `/api/og` via `<img src>`, since that route is edge runtime and can't be server-fetched) — now a per-post section repeated within a single digest email, not a standalone template
- [ ] Document new Notion property (`Emailed`, checkbox) and new env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`) in `README.md` and `README_KR.md`, including the *correct* Resend free-tier send ceiling (Broadcast/Audience: up to 1,000 contacts/month, not the 100/day transactional figure — corrected during research) and the "update content" Notion integration capability now required

These are hypotheses until shipped and validated.

### Out of Scope

- **RSS feed (`/feed.xml`)** — deferred to `TODOS.md`. Zero-infra alternative channel, doesn't block or change the email plan.
- **On-site "new post" indicator/badge** — deferred to `TODOS.md`. Independent of email/Resend, different blast radius, needs its own review pass.
- **Generic "on-publish" hook abstraction** — explicitly skipped as premature abstraction (only one consumer — email — exists today).
- **Notion automation webhook as the primary trigger** — ruled out as the *sole* trigger (creating/editing webhooks requires a paid Notion plan, which would silently break the feature for free-plan forkers). Documented as an optional fast-path for paid-plan forkers, not built this pass.
- **Hardening the pre-existing fail-open patterns found during codebase mapping** (`NOTION_TOKEN`/`NOTION_DATABASE_ID` silently defaulting to empty strings, silent catch-alls in page routes, a pagination gap that could return an incomplete post list) — pre-existing and unrelated to the email feature. Noted in Context below and added to `TODOS.md`, not pulled into this scope.
- **Adding a test framework to the repo** — zero test infrastructure exists today (no jest/vitest/playwright config, no `*.test.*` files). Larger, separate undertaking; tracked in `TODOS.md`.

## Context

**Stack:** TypeScript monorepo (`apps/web` + `packages/core`, npm workspaces), Next.js 16 App Router, React 19, `@notionhq/client` for typed calls but `NologClient` hand-rolls raw REST calls for the actual post-listing query (works around SDK bugs on inline databases), Tailwind CSS 4, deployed on Vercel. No test framework anywhere in the repo (confirmed independently during codebase mapping).

**This session's full history:** A complete `/office-hours` → `/autoplan` (CEO/Design/Eng/DX review) pass already ran for the email subscription feature and is APPROVED. All open questions from that process were resolved; see:
- Design doc: `~/.gstack/projects/4lph4-dvlp-NoLog/alpha-pi-main-design-20260724-161749.md`
- CEO plan: `~/.gstack/projects/4lph4-dvlp-NoLog/ceo-plans/2026-07-24-email-subscription.md`
- Eng test plan: `~/.gstack/projects/4lph4-dvlp-NoLog/alpha-pi-main-eng-review-test-plan-20260724-170000.md`
- Deferred work: `TODOS.md` (repo root)

**Known pre-existing issues (not in scope, found during codebase mapping 2026-07-24):**
- `NOTION_TOKEN` / `NOTION_DATABASE_ID` silently default to empty strings rather than failing loudly if unset.
- Several silent catch-all error handlers in page routes and the API client mask real failures.
- A pagination handling gap in `NologClient` could return an incomplete post list without surfacing an error.
- See `.planning/codebase/CONCERNS.md` for full detail.

**Recurring theme across every review phase this session:** "fail-closed, not fail-open" for anything env-gated — this is the actual spec for optional features in this repo, not a nice-to-have (motivated by the real Cusdis privacy leak found and fixed this session).

## Constraints

- **No new infrastructure**: Only Notion + Vercel + GitHub — the stack NoLog already requires. No new DB server, no new complex service configuration.
- **Off-by-default, config-gated, exactly like Cusdis**: A forker who sets no env vars sees no subscribe form and has no active email logic.
- **Generic for any forker's own Notion workspace + their own Resend account**: not hardcoded to the template author's instance.
- **Minimal**: Plain email (title, summary, link, thumbnail). No confirmation/double-opt-in flow, no preference center.
- **Vercel Hobby tier limits**: cron frequency capped at once/day, ±59min scheduling precision, UTC-only. Function `maxDuration` is contested between research sources (10s per one source, 300s under Fluid Compute per another) — **unconfirmed, must be verified directly against the target Vercel project's dashboard** before finalizing notify-route batch size; regardless, the backfill must run standalone, never through that route.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approach B: dedicated `/api/notify-subscribers` route + Vercel Cron (once/day), webhook as documented-only fast path | Only option that doesn't depend on visitor traffic, doesn't couple email side-effects to page render, and works on every forker's Notion plan tier | — Pending |
| Resend (Audiences + Broadcast API) over Buttondown | Buttondown caps free tier at 100 subscribers and gates API access behind $29/mo; Resend's free tier supports the full flow for free | — Pending |
| One digest email per cron run (not one email per post), pulled forward into v1 | User asked how multi-post-per-day was handled during roadmap review; decided not to wait for the "Resend 100/day cap becomes a problem" trigger originally planned in `TODOS.md` — wanted it now | — Pending |
| RSS deferred rather than bundled into this pass | User's explicit choice at the final `/autoplan` approval gate, re-confirmed after the CEO review's dual-voice subagent argued for bundling it | ✓ Good |
| Server-component env-var gating (not `NEXT_PUBLIC_*`) for the subscribe form | `RESEND_API_KEY` is a secret, unlike Cusdis's public app ID — found by the DX review's dual-voice subagent as the most significant architectural gap of the session | ✓ Good |
| Concurrency/distributed-lock gap on the notify route accepted as a limitation, not fixed | A real fix needs new infrastructure (Vercel KV/Redis), which conflicts with the explicit "no new infrastructure" constraint | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-24 after initialization*
