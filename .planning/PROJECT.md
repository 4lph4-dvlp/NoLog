# NoLog

## What This Is

NoLog is a fork-and-deploy blog template: a Notion database as the sole datastore, GitHub for source, and Vercel for hosting/ISR — no separate server, no separate database. Site owners write posts in Notion and flip a `status` property to `public` to publish. It ships with two optional, env-gated integrations that any forker can turn on or leave off: a Cusdis comment widget, and an email subscription feature (Resend Audiences/Broadcast API + a daily Vercel Cron digest) fully documented in `README.md`/`README_KR.md`.

## Core Value

A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.

## Current State

**Shipped: v1.0 — Email Subscription for New Posts** (2026-07-29). 6 phases, 17 plans, 20/20 v1 requirements complete. Full detail: `.planning/milestones/v1.0-ROADMAP.md`, `.planning/MILESTONES.md`.

Known override at close: Phase 5 (Production Cutover)'s automated verification-status check reported `missing` due to a stray `05-01-VERIFICATION.md` file shadowing the real, passing `05-VERIFICATION.md` in the tool's alphabetical file-picker — confirmed a tooling false-negative, not an actual gap. Full detail in `STATE.md` Deferred Items.

**v1.1 in progress — Phase 9 (Thumbnail Freshness) complete 2026-08-12.** Validated in Phase 9: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05. Thumbnails now render through a server-side proxy route (`/api/thumbnail/[id]`) that resolves Notion's short-lived presigned S3 URL per request, so a cold load after an arbitrarily long idle gap no longer shows blank images. Gap G-09-1, raised in UAT, was closed by plan 09-04: the presigned URL had still been leaking into the RSC flight payload because `PostThumbnail` was a Client Component receiving the whole `Post` object; the boundary was moved so the only Client Component in the path receives three primitives. Confirmed on the deployed site — 0 presigned-URL occurrences where 3 and 1 were previously measured. Two coverage gaps remain accepted-by-operator rather than observed: the host-allowlist guard's firing (Notion picks the presign host, so an off-allowlist case cannot be constructed from real data) and IMG-05's live half (no external-thumbnail post exists in the operator's database). Both are source-verified and corroborated by code review.

**Phase 10 (Collapsible Sidebars & Reading Width) complete 2026-08-14 — v1.1's last phase.** Validated: SIDE-01…SIDE-10 and A11Y-01…A11Y-05 (15 requirements, 4 plans, 4 waves). Readers collapse either sidebar independently — a hamburger on the left, a circular profile-image button on the right — and the article column reclaims the width. Measured live: `<main>` at 864px both-expanded, 1064/1104px one-collapsed, 1304px both-collapsed; the post-detail prose column is capped at 1100px and centred. State is a per-side tri-state (`null | true | false`) where only an explicit preference persists to `localStorage`; a blocking pre-hydration inline script (modelled on the installed `next-themes` technique) prevents any wrong-state flash. Collapsed panels are removed from the accessibility tree and tab order via `inert`, with focus rescued to the controlling toggle on **both** the click and the resize path. `templates/default/Layout.tsx` stayed a Server Component throughout — the phase's single stop-ship criterion — and the subscribe form was confirmed working end-to-end against the live Resend account after deploy.

Three findings from this phase are worth carrying forward. **(1)** Turbopack's Lightning CSS silently drops an entire `@property` block when the `syntax` descriptor is double-quoted — no error, no warning, and the grid then refuses to animate; both registrations use single quotes. **(2)** The UI-SPEC as written would have deleted the mobile theme toggle (it placed `ThemeToggle` in a `hidden md:flex` row, but the existing wrapper carried no `hidden` and therefore rendered at every viewport); resolved as two single-viewport renders. **(3)** Code review caught a real concurrency defect — both sides shared one transition-cleanup ref, so a second toggle within ~250ms cancelled the animation — fixed in `94904cb` and re-verified live.

Two verification items were accepted-by-operator rather than observed, so `10-VALIDATION.md` keeps `nyquist_compliant: false`: E7's wide-table/code-block backstop (no qualifying content exists in the operator's 3 posts; production Notion was deliberately not mutated) and SC#5's home-page sticky depth (the home page cannot scroll far enough). Both resolve as the blog gains content. Full detail in `STATE.md` Deferred Items (`uat_override`).

## Current Milestone: v1.1 Live Blog Bug Fixes & Reading Width

**Goal:** Fix the image and body-content rendering that is actually broken on the deployed blog (4lph4-bl0g.vercel.app), and give readers direct control over the content column's width.

**Target features:**
- **Home thumbnails load on first visit** — currently blank until a manual refresh. Leading hypothesis: Notion's presigned file URLs expire after ~1 hour, and ISR's stale-while-revalidate serves HTML carrying an already-expired URL; that request triggers regeneration, so the refresh succeeds. Root cause to be confirmed before a fix is chosen.
- **Post body renders instead of "Content could not be loaded."** — `getPageRecordMap()` (unofficial `notion-client`) fails and `post/[id]/page.tsx`'s catch nulls `recordMap`. The operator has confirmed the Notion pages ARE published to the web, so the cause is code/deploy-environment, not Notion sharing state. **Locked decision: keep the unofficial API + `react-notion-x`; fix the cause, do not rewrite the renderer against the official blocks API.** Secondary: that same catch swallows `getPageRecordMap`, `getCategories`, and `getPosts` failures as one undifferentiated block.
- **Collapsible left/right sidebars** — left toggle is a hamburger (≡) button, right toggle is a circular button showing the profile image. Each collapses independently, both auto-collapse below a viewport-width threshold, and the collapsed/expanded state persists via `localStorage`.

**Milestone context:**
- The 3-column grid in `apps/web/src/templates/default/Layout.tsx:41` activates at `md` (768px), where the content column is squeezed to roughly 232px (1400px max width; 200px + 240px sidebars, 32px gaps, 32px padding). The auto-collapse threshold must sit well above `md` — proposed default: collapse below 1280px, expand at/above it.
- `Layout.tsx` is shared by home, category, and search as well as post pages, so the sidebar work applies site-wide by construction (not scoped to the post page).
- Target template is `default` (`site.config.ts: template: "default"`). The `terminal` template is out of scope this milestone.

**Deferred to a later milestone** (carried from `TODOS.md` and REQUIREMENTS.md's v2 section):
- RSS feed (`/feed.xml`) as a second, zero-infra notification channel
- On-site "new post" indicator/badge for return visitors
- Lightweight non-blocking "you were just subscribed" notice (conditional on real abuse reports)
- Pre-existing fail-open patterns found during codebase mapping (empty-string env var defaults, silent catch-alls, pagination gap)
- Unvalidated dynamic route segment interpolated into the Notion API URL in `apps/web/src/app/post/[id]/page.tsx` (flagged post-Phase-1; explicitly considered for this milestone and declined by the user to keep scope at three items)
- Adding a test framework to the repo (currently zero test infrastructure)

## Requirements

### Validated

- ✓ Notion-as-datastore blog rendering (posts fetched via raw REST calls in `NologClient`, filtered on `status === "public"`) — existing
- ✓ ISR revalidation (180s, `notion-posts` cache tag) — existing
- ✓ Multiple page templates (`default`, `terminal`) — existing
- ✓ Optional Cusdis comment integration, off-by-default via `NEXT_PUBLIC_CUSDIS_APP_ID` — existing (fail-open bug in `CommentSection.tsx` found and fixed this session, commit `7d657c9`)
- ✓ OG image generation via `/api/og` (edge runtime) — existing
- ✓ `NologClient.getUnemailedPublicPosts()` / `markEmailed(pageId)`, typed `NotionCapabilityError`/`MissingEmailedPropertyError` — Phase 1 (live-verified against production Notion DB 2026-07-25)
- ✓ One-time backfill script (`packages/core/scripts/backfill.ts`): throttled, resumable, dry-run-first, marks all pre-existing public posts `emailed` before cron ever runs — Phase 2 (live-verified against production 2026-07-26), and re-run against production immediately before cutover — Phase 5 (2026-07-29, confirmed `getUnemailedPublicPosts()` returns zero)
- ✓ `/api/subscribe` route + subscribe form component: honeypot + validation, fail-closed if Resend env vars unset, idempotent on duplicate submission, server-gated (not `NEXT_PUBLIC_*`, since `RESEND_API_KEY` is a secret) — Phase 3 (live-verified against operator's own Resend account 2026-07-27)
- ✓ `/api/notify-subscribers` route: fail-closed on missing `CRON_SECRET` (checked before anything else), same-day digest (one email per cron run listing every newly-public post, per-post-section isolation so one bad post doesn't block the rest), no-op if Resend env vars unset — Phase 4 (live-verified against Resend + Notion 2026-07-27)
- ✓ Production cutover (OPS-01): `vercel.json` cron entry (`0 11 * * *`, once/day, Hobby-tier compatible) added and deployed as its own commit, strictly after the backfill was confirmed complete in production — Phase 5 (2026-07-29; live dashboard maxDuration confirmed 300s, batch size 50 validated against it, manual cron trigger returned 200 with no email sent)
- ✓ Forker-facing documentation (DOCS-01/02/03): `README.md`/`README_KR.md` "Email Notifications (Optional)" section — 4 env vars (corrected from 3 named in DOCS-01's summary text), `emailed` Notion property, "Update content" capability as its own step, mandatory Resend domain verification, correct quota (1,000 contacts/month, not the 100/day transactional figure), Production-only/UTC cron behavior, diagram/table/feature-list updates — Phase 6 (2026-07-29; goal verification included a live headless-browser Mermaid render and live fetches of the cited Resend/Notion/Vercel doc pages)
- ✓ Post content renders on first visit (CONT-01…CONT-05) — Phases 7-8. Root cause was Cloudflare answering `notion-client`'s default `user-agent: node` with a 403; fixed with an honest self-identifying User-Agent via `ofetchOptions`. Established from captured live production evidence before any fix was written (D-08), per the repo's own CR-01 process lesson.
- ✓ Thumbnail freshness (IMG-01…IMG-05) — Phase 9. Server-side proxy route resolves Notion's ~1h presigned S3 URL per request instead of baking it into cached HTML.
- ✓ Collapsible sidebars + reading width (SIDE-01…SIDE-10, A11Y-01…A11Y-05) — Phase 10 (2026-08-14). Live-verified on the deployed site; two backstop items accepted-by-operator rather than observed (see Current State).

### Active

None — v1.1's three target features are all delivered and their phases closed. The next milestone has
not been scoped yet; run `/gsd-complete-milestone` to archive v1.1, then `/gsd-new-milestone`.

Moved to Validated below on 2026-08-14 (all three v1.1 items):

- ✓ Home-feed thumbnails render on a visitor's first load, without a manual refresh — Phase 9
- ✓ Post bodies render their Notion content instead of the "Content could not be loaded." fallback — Phases 7-8
- ✓ Reader can collapse/expand the left (search + categories) and right (profile + subscribe) sidebars independently, with auto-collapse below a width threshold and `localStorage` persistence — Phase 10

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
- **Vercel Hobby tier limits**: cron frequency capped at once/day, ±59min scheduling precision, UTC-only. Function `maxDuration` — confirmed **300s** directly against the deployed project's dashboard (Phase 5, 2026-07-29; Fluid Compute enabled), matching the documentation-derived figure; `NOTIFY_BATCH_SIZE_DEFAULT` (50) validated against it (`N_max = floor((0.6*300-15)/1.5) = 110`). The backfill runs standalone, never through the cron route.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Approach B: dedicated `/api/notify-subscribers` route + Vercel Cron (once/day), webhook as documented-only fast path | Only option that doesn't depend on visitor traffic, doesn't couple email side-effects to page render, and works on every forker's Notion plan tier | ✓ Good — live in production since Phase 5 |
| Resend (Audiences + Broadcast API) over Buttondown | Buttondown caps free tier at 100 subscribers and gates API access behind $29/mo; Resend's free tier supports the full flow for free | ✓ Good — live-verified end to end (Phases 3-5) |
| One digest email per cron run (not one email per post), pulled forward into v1 | User asked how multi-post-per-day was handled during roadmap review; decided not to wait for the "Resend 100/day cap becomes a problem" trigger originally planned in `TODOS.md` — wanted it now | ✓ Good — shipped and live-verified in Phase 4 |
| RSS deferred rather than bundled into this pass | User's explicit choice at the final `/autoplan` approval gate, re-confirmed after the CEO review's dual-voice subagent argued for bundling it | ✓ Good |
| Server-component env-var gating (not `NEXT_PUBLIC_*`) for the subscribe form | `RESEND_API_KEY` is a secret, unlike Cusdis's public app ID — found by the DX review's dual-voice subagent as the most significant architectural gap of the session | ✓ Good |
| Concurrency/distributed-lock gap on the notify route accepted as a limitation, not fixed | A real fix needs new infrastructure (Vercel KV/Redis), which conflicts with the explicit "no new infrastructure" constraint | — Pending |
| Notion property names are lowercase-first camelCase (`status`, `emailed`, `summary`, etc.), not capitalized — confirmed against the live production DB screenshot, not assumed from code-internal consistency | An initial gap-closure pass ("CR-01") wrongly capitalized the `status` filter based on `mapPageToPost()`'s primary/fallback key order; reverted after live-DB evidence. Also caught and fixed an independent bug: `summary` had a typo'd fallback key and always rendered empty. | ✓ Good |
| DOCS-01's env-var count (3) corrected to 4 in the shipped README docs | Direct code inspection of `route.ts`'s fail-closed gate (Phase 6 research) found it actually checks `NOTIFY_PHYSICAL_ADDRESS` alongside the 3 vars DOCS-01's summary text named; CONTEXT.md's own D-03/canonical_refs already had all 4, so this was a requirement-summary gap, not a locked-decision violation | ✓ Good |
| README's original claim that leaving `CONFIG.notify.fromAddress` at its shipped default "no-ops" the notify route was corrected to state the truth: the gate only rejects a blank value, not the default (code review CR-01) | The route only checks emptiness, never equality against the shipped default — a forker who forgets to change it gets a live send under an identity/domain they don't control, not a silent no-op. Docs-only fix chosen over a code change to keep Phase 6 in scope | ✓ Good — verified against `route.ts:210-230` during goal verification |
| README now documents that the public subscribe form activates independently on 2 of the 4 notify env vars (`RESEND_API_KEY`+`RESEND_AUDIENCE_ID`), regardless of `CRON_SECRET`/`NOTIFY_PHYSICAL_ADDRESS` | Code review (WR-01) found this second, narrower gate was undocumented — a forker could unknowingly expose a live public PII-collecting form mid-setup. User chose to document it rather than accept as out of scope | ✓ Good |

**Process lesson (Phase 1):** when a defect diagnosis rests on internal code consistency rather than the live external system, verify against the real system before "fixing" — the CR-01 revert-then-refix cycle cost a full extra round trip that direct DB inspection would have skipped.

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
*Last updated: 2026-08-14 after Phase 10 (Collapsible Sidebars & Reading Width) completed — v1.1's final phase*
