# Milestones

## v1.0 Email Subscription for New Posts (Shipped: 2026-07-29)

**Phases completed:** 6 phases, 17 plans, 33 tasks

**Key accomplishments:**

- `NologClient` extended with `getUnemailedPublicPosts()`/`markEmailed()` and two `instanceof`-checkable error classes (`NotionCapabilityError`, `MissingEmailedPropertyError`); package builds clean and `apps/web` typechecks, but the phase's live-Notion manual verification scripts have NOT been run in this environment (no test credentials available).
- Corrected the Notion database query-filter property key from lowercase "status" to canonical "Status" in both getPosts() and getUnemailedPublicPosts(), closing CR-01 from 01-VERIFICATION.md
- Throttled, resumable `backfill` CLI (400ms serial writes, one bounded 429/529 retry, three-way abort/continue/retry error classification) draining `getUnemailedPublicPosts()` via a new npm script wrapper — zero changes to Phase 1's `NologClient`.
- Shared `isSystemicAbort()` type guard now gates both the outer per-post catch and the rate-limit retry's inner catch in backfill.ts, closing the window where a revoked capability or a mid-run schema change could be misclassified as ordinary per-post noise; COVERAGE.md's two over-length cells were rebalanced (not truncated) to pass the api-coverage gate.
- Server-gated Resend subscribe form (SubscribeSection/SubscribeForm) wired through a Node-runtime `/api/subscribe` route to Resend's contacts API, with a fail-closed 404 boundary and a lazily-constructed client to keep unconfigured forks buildable.
- Inserted a module-scoped per-IP rate limiter (5/10min, D-10) and a server-side honeypot check (D-13) into `/api/subscribe`, completing the full five-stage D-23 pipeline with zero new dependencies and zero added log output.
- Added a CLI-prompt presentation branch to SubscribeForm and wired it into the terminal template's post page via a Server-rendered `subscribeSlot` prop, keeping `SubscribeSection` as the feature's single environment gate even though the terminal template is a client-directive file.
- Replaced the client-spoofable `x-forwarded-for`-only rate-limit key with a platform-header-first tiered derivation, and added an expiry-independent 2000-key hard ceiling on the counter map — closing both halves of review finding CR-01.
- Closed the fresh code-review's Critical finding (CR-01 origin, T-03-19): `POST /api/subscribe` now refuses any request whose `Origin` host disagrees with the request's own `x-forwarded-host`/`host`, positioned ahead of the rate limiter, plus a JSON media-type precondition (T-03-20) that removes the CORS-preflight-free delivery mechanism — closing the path that let any third-party page drive a visitor's browser into enrolling an arbitrary victim's address in the site owner's Resend Audience.
- Wrapped the configuration-gate `console.error` in `apps/web/src/app/api/subscribe/route.ts` with a per-instance `unconfiguredLogged` boolean latch (mirroring 03-05's `originRejectionLogged`), leaving the bare 404 refusal itself unlatched — closing CR-01 without changing any response, status, or machine code.
- Cron-only `GET /api/notify-subscribers` with a timing-safe auth gate, a single-digest Resend broadcast covering every unemailed public post, per-post-section isolation, capability-aware mark-after-send, and a `NOTIFY_BATCH_SIZE` overflow cap.
- `Post.thumbnailType` discriminator plus a digest thumbnail gate that embeds only permanent external URLs and silently downgrades Notion-hosted presigned URLs (which expire one hour after fetch) to text-only, with a single per-run operator log line reporting the downgrade count.
- Production Notion database confirmed at zero unemailed public posts; deployed Vercel project's real 300s maxDuration and apps/web Root Directory recorded from the operator's own dashboard; NOTIFY_BATCH_SIZE_DEFAULT confirmed (still 50) against that figure rather than documentation alone.
- Added a complete, self-contained `## Email Notifications (Optional)` setup section (English + Korean) with a 7-step path, dedicated 4-var env block, and inline failure-mode warnings at the exact step each silent-failure trap would be hit — no other file touched.
- Added the email feature to the top-of-document surfaces of both READMEs — a `Notifications`/`알림` mermaid subgraph, a `**Resend**` Core Services row, and an `Optional email digest` Features bullet — extending the exact three-touchpoint pattern Cusdis already uses, with no source files touched.

**Known overrides:** 1 — Phase 5 (Production Cutover) verification-status check reported `missing` due to a stray `05-01-VERIFICATION.md` file (per-plan coverage doc, no top-level `status:` key) alphabetically shadowing the real, passing `05-VERIFICATION.md` (`status: passed`, 3/3 ROADMAP success criteria) in the tool's file-picker. Confirmed a tooling false-negative, not an actual gap; user chose to proceed with the override. Full detail in `STATE.md` Deferred Items.

---
