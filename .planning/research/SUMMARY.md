# Project Research Summary

**Project:** NoLog — email subscription for new posts
**Domain:** Notify-on-publish email feature (Resend + Vercel Cron + Notion API) for a self-hosted, zero-infra blog template
**Researched:** 2026-07-24
**Confidence:** HIGH

## Executive Summary

This is a well-understood domain: "email subscribers when new content publishes" via Resend + Vercel Cron on top of Notion-as-datastore, with no new infrastructure. All four research passes converge on the same shape already locked into `PROJECT.md` — the research mainly *hardens* that design with concrete implementation details, corrects two factual errors that had crept into the plan, and surfaces one genuinely new risk (public-form enumeration) that the original `/autoplan` review didn't cover.

The recommended approach: extend the existing `NologClient` class (not a new client) with `markEmailed()`/`getUnemailedPublicPosts()`, gate the subscribe form with a Server-Component-reads-secret pattern (not the Cusdis client-side pattern, since `RESEND_API_KEY` is a secret), send via Resend's **Broadcast API** (not a looped transactional send — this is load-bearing, not a style choice), and treat the backfill-before-cron ordering as a deploy-sequence requirement enforced by shipping `vercel.json`'s cron entry as its own last, separate commit.

The main risks are two categories of "looks configured but silently doesn't work": (1) Resend requires domain SPF/DKIM verification that has nothing to do with env vars and fails with zero visible error, and (2) existing forks' Notion integrations are read-only today — `markEmailed()` will 403 until a forker manually grants "Update content" capability in the Notion Developer Portal, and unhandled this specific failure causes a **duplicate-email storm** (a post keeps re-qualifying as unemailed forever), not a benign no-op. Both are pure documentation/error-handling fixes, not architecture changes.

## Key Findings

### Recommended Stack

`resend` npm SDK `^6.18.0` (official, actively maintained, no breaking changes across the whole 2025-2026 v6.x line) is the only dependency this feature needs — no `react-email`, no form library, no queue. Vercel Cron (`vercel.json` `crons` array) remains the trigger, confirmed still current at 100 jobs/project on Hobby (once/day minimum, ±59min precision, UTC-only) — a stale "2 jobs" figure from old blog posts should not leak into forker docs. `CRON_SECRET` verification should use `crypto.timingSafeEqual` (Node built-in, zero new dependency) instead of Vercel's own documented naive `!==` sample, consistent with this project's fail-closed theme.

**Core technologies:**
- `resend` `^6.x` — Audience/Broadcast + contact management — official SDK, no viable competitor for Resend's own API
- Vercel Cron (`vercel.json`) — scheduled trigger, zero new infra, already locked into `PROJECT.md`
- `node:crypto` `timingSafeEqual` — constant-time `CRON_SECRET` comparison — built-in, no install

### Expected Features

**Must have (table stakes — legal/deliverability floor, not taste):**
- One-click unsubscribe (automatic if the Broadcast API is used against an Audience; manual `List-Unsubscribe` headers required if not)
- Physical mailing address in the email footer (forker-configurable) and a one-line "why you're receiving this" — CAN-SPAM's most commonly enforced, cheapest-to-satisfy requirement
- Honeypot + basic per-IP rate limiting on `/api/subscribe` — this is *not* optional given the already-decided no-confirmation-email premise; it's the compensating control for that decision
- **Identical response for new-vs-already-subscribed contacts** — a genuinely new finding: without this, the subscribe endpoint becomes an oracle for testing whether an arbitrary third-party email address is already on the list

**Should have (cheap, already scoped):** OG-image thumbnail in the email header (reuses `/api/og`, zero marginal infra).

**Explicitly not building (anti-features, already decided):** double opt-in, CAPTCHA, preference center, rich HTML digest, custom-built unsubscribe/suppression logic. A conditional P3 idea (a non-blocking "you were just subscribed" notice) is documented only as a future backstop if real abuse reports ever appear — not a v1 requirement.

### Architecture Approach

Two new route handlers with different trust boundaries (`/api/subscribe`, public/low-trust; `/api/notify-subscribers`, cron-only/high-trust) sit alongside an extended `NologClient` and a new `components/subscribe/` directory mirroring the existing `components/comments/` convention. No new package, no new client class.

**Major components:**
1. `NologClient` (extended, `packages/core/src/client.ts`) — adds a private `patchPage()` helper and public `markEmailed(pageId)`/`getUnemailedPublicPosts()`, following the file's own `// ─── Mutations ───` banner convention
2. `SubscribeSection` (Server Component, new) — reads `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` server-side, conditionally renders `SubscribeForm` (Client Component) — this is the corrected gating mechanism from the DX review, generalized: Cusdis's client-side env-read pattern **cannot** be reused here because the env var is a secret, not a `NEXT_PUBLIC_*` value
3. `/api/notify-subscribers` (Route Handler, Node runtime, cron-only) — `CRON_SECRET` check as literally the first line of the function, before any Notion or Resend call
4. Standalone backfill script (`packages/core/scripts/backfill-emailed.ts`) — run via `tsx` from a developer machine, never through a Vercel route, with throttling and resumability against Notion's ~3 req/s limit

### Critical Pitfalls

1. **Wrong Resend quota documented/designed against** — the Active requirements text says "3,000/month, 100/day" (the *transactional* Send API cap); the actual applicable limit for Broadcast/Audience sends is "unlimited sends to up to 1,000 contacts/month." Fix: confirm the notify route calls `broadcasts.send()` (never a looped `emails.send()`), and correct this figure before it ships in any README.
2. **Resend domain verification is a silent-failure trap** — SPF/DKIM verification is a hard prerequisite for delivery, completely disconnected from env-var configuration, can take up to 72h, and produces zero visible error if skipped. Must be documented as its own mandatory setup step.
3. **Missing Notion "Update content" capability causes a duplicate-email storm, not a no-op** — every existing fork's integration is read-only today; `markEmailed()` 403s until a forker manually grants write capability in the Notion Developer Portal, and because the checkbox never gets set, the same post re-qualifies as "unemailed" and gets re-broadcast on every subsequent cron run.
4. **Vercel Cron has no retry and can double-fire** — bias the mark/send ordering and treat "duplicate email to everyone for one post" as the worse failure mode to design against, given no distributed lock is available (explicitly ruled out by the "no new infrastructure" constraint).
5. **Backfill is the single highest-volume write burst this feature will ever produce** — must throttle against Notion's ~3 req/s average limit and be resumable, or a rate-limited partial completion defeats the entire purpose of running it before the first cron tick.

## Implications for Roadmap

### Phase 1: Notion Data Layer
**Rationale:** Every other phase depends on this contract existing first — the backfill script, the notify route, and the `Emailed` Notion property all need `markEmailed()`/`getUnemailedPublicPosts()` defined before anything else can be built or tested against real behavior.
**Delivers:** `patchPage()` helper, `markEmailed(pageId)`, `getUnemailedPublicPosts()` on `NologClient`; `emailed` field on `Post`/`mapPageToPost`; the `Emailed` checkbox property added to the Notion database schema; a manual verification step (mark a post, immediately re-query, confirm exclusion) before considering this phase done.
**Addresses:** none from FEATURES.md directly — this is the load-bearing data-layer phase everything else calls.
**Avoids:** Pitfall 6 (query-after-write property-shape bug mistaken for consistency lag) — verify the exact `checkbox` PATCH body shape against Notion's current API reference, don't assume.

### Phase 2: Backfill Script
**Rationale:** Must exist and run successfully against production *before* the notify route is ever allowed to go live on a schedule — this is a hard ordering dependency, not a nice-to-have.
**Delivers:** Standalone `packages/core/scripts/backfill-emailed.ts`, throttled to Notion's ~3 req/s limit, resumable/idempotent (check-before-write per post), logging a final "N marked / M failed" count.
**Uses:** `NologClient.getPosts()` + `markEmailed()` from Phase 1.
**Avoids:** Pitfall 7 (rate-limit burst partially completing the backfill, defeating its own purpose).

### Phase 3: Subscribe Path
**Rationale:** Fully decoupled from the notify path at the data level (Resend Audience membership and Notion's `Emailed` state are independent) — can be built, deployed, and left live with zero technical risk even before the notify route exists. Can run in parallel with Phases 1–2/4.
**Delivers:** `/api/subscribe` route (honeypot, per-IP rate limit, fail-closed if env vars unset, **identical response for new-vs-existing contact**), `SubscribeSection` (Server Component env gate) + `SubscribeForm` (Client Component), added near `CommentSection` in the post page.
**Addresses:** FEATURES.md's P1 anti-abuse and enumeration-safety requirements — the compensating control for the already-decided no-confirmation-email premise.
**Implements:** Architecture Pattern 2 (Server-Component gate + Client-Component island) — explicitly not the Cusdis client-side-env-read pattern, since `RESEND_API_KEY` is a secret.

### Phase 4: Notify Route
**Rationale:** Depends on Phase 1's client methods and benefits from Phase 2 having already exercised the query/patch behavior once, manually, before anything is cron-triggered.
**Delivers:** `/api/notify-subscribers` (Node runtime, `CRON_SECRET` check as literally the first line via `timingSafeEqual`, no-op if Resend env vars unset, per-post isolated try/catch, `resend.broadcasts.create()`/`.send()` — not a looped `emails.send()` — with the OG-image thumbnail embedded as a public `<img src>` URL since `/api/og` is edge runtime and can't be server-fetched). Deployed *without* a cron trigger yet — tested manually via a `CRON_SECRET`-authenticated request against the deployed Production URL.
**Avoids:** Pitfall 1 (wrong quota / send-loop instead of Broadcast API) and Pitfall 3 (cron no-retry/double-fire — explicit mark-vs-send ordering decision, documented, not just implemented).

### Phase 5: Production Cutover
**Rationale:** This is the single most consequence-bearing ordering step this whole feature has — Architecture Anti-Pattern 3 states plainly that letting the cron entry go live before the backfill runs means the first tick emails a new subscriber the *entire back catalog*.
**Delivers:** Backfill run against production, `getUnemailedPublicPosts()` confirmed empty, **then and only then** `vercel.json`'s cron entry added as its own separate, deliberate commit/deploy.
**Avoids:** Pitfall 3's failure mode and Architecture Anti-Pattern 3 directly.

### Phase 6: Documentation
**Rationale:** Several of this feature's sharpest failure modes (domain verification, Notion capability grant, correct quota figures, Production-only/UTC cron behavior) are pure documentation gaps that would otherwise look like silent bugs to a forker — cheapest phase to build, highest support-burden reduction if done well.
**Delivers:** README.md/README_KR.md updated with: new env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`); the `Emailed` Notion property; **the "Update content" Notion capability grant as an explicit, separate step from env vars** (not bundled into "set env vars"); Resend domain/SPF/DKIM verification as a mandatory step; the *corrected* Broadcast/Audience quota figure (up to 1,000 contacts/month, not the transactional 100/day cap); a note that cron only fires on Production deployments, in UTC.
**Addresses:** Pitfalls 1, 2, 4, 5 — all four are primarily documentation fixes.

### Phase Ordering Rationale

- Phases 1 → 2 → (3 parallel, 4 depends on 1–2) → 5 → 6 is the dependency chain. Phase 3 (subscribe path) has no technical dependency on 1, 2, 4, or 5 and can be built at any point — but shipping it noticeably before the notify path exists just means subscribers accumulate silently with no functional risk, which is fine.
- Phase 5 is deliberately its own phase (not folded into Phase 4) specifically so the ordering is enforced by the phase/deploy structure itself, not left to developer discipline — this mirrors the Architecture research's explicit recommendation to make the cron-entry commit separate and last.
- Phase 6 comes last but should not be treated as an afterthought — several of the "silent failure" pitfalls (domain verification, Notion capability) are *entirely* mitigated by documentation quality alone, since no runtime code change can detect them in advance.

### Research Flags

Phases likely needing deeper research/manual verification during planning or execution:
- **Phase 1:** Verify the exact Notion `checkbox` PATCH body shape against Notion's *current* API reference before writing `markEmailed()` — Pitfall 6 warns this is easy to get subtly wrong in a way that masquerades as a consistency bug.
- **Phase 4:** Resend's Broadcast API has thin public documentation on whether contacts must be "confirmed" before receiving a broadcast, or whether new accounts face a domain-reputation warmup period — verify directly against a live Resend account during implementation, not from docs alone.
- **Phase 4/5:** The Vercel Hobby function `maxDuration` figure is contested between two research passes (10s per one source, 300s under Fluid Compute per another, both citing official Vercel docs) — verify directly against the actual target Vercel project's dashboard/config before finalizing notify-route batch-size assumptions, rather than trusting either figure from docs alone.

Phases with standard, well-established patterns (skip a dedicated research-phase):
- **Phase 2:** Rate-limit-aware backfill scripts are a well-understood pattern (throttle + `Retry-After` handling + resumability) — implementation guidance, not open research.
- **Phase 3:** Server-Component env-gate + Client-Component island is Next.js's own documented composition pattern, already verified against current docs in this research pass.
- **Phase 6:** Documentation work — no research needed beyond citing the corrected figures already established here.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Resend and Vercel Cron mechanics fetched directly from official, dated first-party docs; timing-safe-compare pattern cross-checked across independent sources |
| Features | HIGH | Legal/deliverability norms (CAN-SPAM, GDPR, RFC 8058) are FTC/RFC primary sources; Resend-specific mechanics confirmed against Resend's own docs |
| Architecture | HIGH | Grounded in direct inspection of the actual `packages/core/src/client.ts`, `apps/web/src/lib/notion.ts`, and `CommentSection.tsx` source, plus current Next.js/Vercel docs |
| Pitfalls | MEDIUM-HIGH | Vercel/Notion behavior confirmed via official docs; some Resend Broadcast-specific edge cases (confirmed-opt-in requirement, warmup periods) are thin in public docs and explicitly flagged as needing live-account verification |

**Overall confidence:** HIGH

### Gaps to Address

- **Vercel Hobby `maxDuration` (10s vs. 300s under Fluid Compute)** — two research passes cite official-looking sources for contradictory figures. Do not assume either; check the actual target Vercel project's dashboard/config before finalizing Phase 4's batch-size assumptions. This also means `PROJECT.md`'s existing "10 second" constraint line should be treated as unconfirmed, not settled fact, until checked.
- **Resend Broadcast confirmed-opt-in / warmup requirements** — not documented publicly in enough depth; verify against a live Resend account during Phase 4 implementation.
- **The Active requirements text in `PROJECT.md` currently states the wrong Resend quota** (100/day, 3,000/month — the transactional cap) — this should be corrected to the Broadcast/Audience figure (up to 1,000 contacts/month) as part of Phase 6, and the discrepancy should be reflected in `PROJECT.md` itself at the next phase transition.

## Sources

### Primary (HIGH confidence)
- https://vercel.com/docs/cron-jobs, /manage-cron-jobs, /usage-and-pricing (fetched directly, dated 2026-06-02/16) — cron config, auth, limits
- https://vercel.com/docs/functions/configuring-functions/duration, /runtimes, /limitations (fetched directly, dated 2026-07-01) — function duration, runtime behavior
- https://resend.com/docs/api-reference/* (contacts, emails, broadcasts) — official SDK/API reference
- https://developers.notion.com/reference/request-limits and integration capabilities docs — rate limits, "Update content" capability requirement
- FTC CAN-SPAM Compliance Guide, RFC 8058 (RFC Editor) — legal/deliverability floor
- Direct source inspection: `packages/core/src/client.ts`, `apps/web/src/lib/notion.ts`, `apps/web/src/components/comments/CommentSection.tsx`, `apps/web/src/app/api/og/route.tsx`

### Secondary (MEDIUM confidence)
- Resend blog/marketing pages on Broadcast API — merge-tag personalization, unsubscribe handling (first-party but not API-reference-grade)
- Vendor blogs (Litmus, Mailjet) on single vs. double opt-in tradeoffs — cited benchmark data, some vendor incentive bias noted
- Community reports (Notion/Retool forums) on query-after-write behavior — used to distinguish "likely a body-shape bug" from "genuine consistency lag"

### Tertiary (LOW confidence)
- Older community blog posts citing a stale "2 cron jobs" Hobby limit — explicitly superseded by current official docs, flagged so it doesn't leak into forker-facing documentation
- A single dev.to post referencing Resend SDK v1.0.1 breaking changes — not applicable to the current v6.x line, noted only to disambiguate

---
*Research completed: 2026-07-24*
*Ready for roadmap: yes*
