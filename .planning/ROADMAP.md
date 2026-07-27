# Roadmap: NoLog — Email Subscription for New Posts

## Overview

This milestone takes NoLog from "blog with no notification channel" to "forkers can optionally let visitors subscribe by email and get notified, once/day, via a digest email covering every post that went public since the last check" — using only Notion + Vercel + Resend, no new infrastructure. The path runs from the data layer that tracks what's been emailed (Phase 1), through the one-time backfill that protects every existing fork's back catalog (Phase 2), the subscribe path (Phase 3, buildable in parallel since it has no technical dependency on the notify side), the notify route itself (Phase 4, one digest per cron run rather than one email per post — pulled forward into v1 during roadmap review), the deliberately separate production cutover that enforces backfill-before-cron ordering (Phase 5), and finally the documentation that closes the feature's sharpest silent-failure gaps (Phase 6). Every phase preserves the project's core off-by-default, fail-closed contract: a forker who sets no Resend env vars sees no subscribe form and triggers no email logic, exactly like the existing Cusdis integration.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Notion Data Layer** - `NologClient` can query unemailed public posts and durably mark a post as emailed, with clear diagnostics when write access is missing (completed 2026-07-25)
- [x] **Phase 2: Backfill Script** - A one-time, throttled, resumable script marks every pre-existing public post as `emailed` before the cron path ever runs (completed 2026-07-26)
- [x] **Phase 3: Subscribe Path** - A visitor can subscribe via a form that's fully gated, abuse-resistant, and enumeration-safe (completed 2026-07-27)
- [x] **Phase 4: Notify Route** - The cron-only notify route sends one digest email per run listing every newly-public post, isolated per-post-section and compliant (completed 2026-07-27)
- [ ] **Phase 5: Production Cutover** - The cron entry goes live only after the backfill is confirmed complete in production, as its own deliberate deploy step
- [ ] **Phase 6: Documentation** - README.md/README_KR.md close every silent-failure gap a forker could hit configuring this feature

## Phase Details

### Phase 1: Notion Data Layer

**Goal**: `NologClient` can identify which public posts haven't been emailed yet and durably mark a post as emailed once a send succeeds, with 403s from missing write capability distinguishable from other failures.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-04
**Success Criteria** (what must be TRUE):

  1. A manual mark-then-requery test confirms a post is excluded from `getUnemailedPublicPosts()` immediately after `markEmailed(pageId)` succeeds against it.
  2. `getUnemailedPublicPosts()` returns only posts where `status === "public"` and `emailed` is unchecked, verified against a Notion database containing a mix of emailed, unemailed, and private posts.
  3. `markEmailed(pageId)` issues the correct Notion `checkbox` PATCH body shape (verified directly against Notion's current API reference, not assumed) and the change is visible on a subsequent read.
  4. When the Notion integration lacks "Update content" capability, `markEmailed` logs a distinguishable 403-specific message rather than a generic error, confirmed by temporarily revoking that capability and observing the log output.

**Plans**: 2/2 plans executed

- [x] 01-01-PLAN.md — Extend NologClient: getUnemailedPublicPosts() + markEmailed() (tracer happy path) and typed fail-loud errors NotionCapabilityError/MissingEmailedPropertyError (D-01/D-03)
- [x] 01-02-PLAN.md — Gap closure (CR-01): correct both getPosts() and getUnemailedPublicPosts() query filters from lowercase "status" to canonical "Status" — **RETRACTED 2026-07-25: CR-01 was a misdiagnosis (live DB confirmed lowercase "status" is correct); reverted in 588496d. See 01-VERIFICATION.md ## CORRECTION.**

### Phase 2: Backfill Script

**Goal**: Every pre-existing public post can be marked `emailed` in one throttled, resumable run, so enabling the notify path never blasts a fork's entire back catalog on its first cron tick.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-03
**Success Criteria** (what must be TRUE):

  1. Running the backfill script against a database with N pre-existing public posts marks all N as `emailed` and logs a final "N marked / M failed" count.
  2. Interrupting the script partway through and re-running it processes only posts still unmarked (check-before-write) and completes cleanly without re-marking or erroring on already-emailed posts.
  3. The script's request rate during a run stays within Notion's ~3 req/s limit, confirmed by inspecting timing/log output against a nontrivial post count.

**Plans**: 2/2 plans executed

- [x] 02-01-PLAN.md — Backfill CLI: end-to-end dry-run preview tracer (D-01/D-03), throttled write loop with N marked/M failed summary and exit codes (D-04/D-06/D-08/D-09/D-10), and single fixed-backoff retry on a Notion rate-limit response (D-07/D-14)
- [x] 02-02-PLAN.md — Gap closure: shared `isSystemicAbort` classifier checked at both loop catch sites so a revoked capability or a mid-run schema change aborts once instead of failing per-post (D-04), plus COVERAGE.md cell-length fixes that unblock the api-coverage seal gate

### Phase 3: Subscribe Path

**Goal**: A visitor can subscribe to new-post notifications through a form that's fully gated server-side, resistant to bot/enumeration abuse, and absent entirely when unconfigured.
**Mode:** mvp
**Depends on**: Nothing (fully decoupled from Phases 1, 2, 4, 5 — can be built and shipped independently, at any point)
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SEC-03
**Success Criteria** (what must be TRUE):

  1. A visitor can submit a valid email via the subscribe form and it's added to the Resend Audience.
  2. With `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset, the `SubscribeSection` Server Component renders no form at all in the server-rendered HTML (not merely hidden client-side) — mirroring Cusdis's fail-closed contract.
  3. Submitting the same email twice returns an identical success response both times (status code and body diffed), with no observable difference that would let a caller test whether a third-party address is already subscribed.
  4. A submission with the honeypot field populated, or one submitted past the per-IP rate limit, is rejected/dropped rather than added to the Audience.
  5. Inspecting the built client-side JS bundle confirms `RESEND_API_KEY` never appears in it, verified via grep against build output rather than visual absence of the form alone.

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: end-to-end subscribe on the default template — Resend SDK + `lib/email.ts`, the single Server-Component env gate, the client form, and the Node route through the unconditional `contacts.create`+`update` pair; then the fail-closed 404 boundary that closes SC#2 and SC#5

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Abuse resistance: per-IP in-memory rate limit (5 per 10 min, `"unknown"` bucket) and the server-side honeypot fake-success, inserted in D-23 order so no path bypasses the counter
- [x] 03-03-PLAN.md — Terminal template: CLI-prompt visual variant behind the same `variant` prop, placed below the post via a Server-rendered `subscribeSlot` because that template's post page is a client module

**Wave 3** *(gap closure — blocked on Wave 2 completion)*

- [x] 03-04-PLAN.md — Gap closure (CR-01, Critical): the per-IP rate limiter keyed on the first entry of the client-suppliable `x-forwarded-for`, so a fabricated header per request minted a fresh bucket (0 of 8 spoofed POSTs refused). Re-derives the key from `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for` (last entry, platform-first, verified against Vercel's request-headers docs), collapses a platform-header-less value into one shared bucket, and adds an expiry-independent 2000-key ceiling on the counter map. Closes ROADMAP SC#4's rate-limit half and unblocks SUB-04

**Wave 4** *(gap closure — blocked on Wave 3 completion)*

- [x] 03-05-PLAN.md — Gap closure (CR-01 *origin*, Critical — a NEW finding from the regenerated 2026-07-26 review, not the closed rate-limit-key defect that reused the same label): `POST /api/subscribe` performed no Origin validation and `Request.json()` acted on a body regardless of its declared media type, so any third-party page could drive a visitor's browser into enrolling an arbitrary victim in the owner's Resend Audience — no double opt-in exists downstream to catch it. Adds `isSameOriginRequest`, comparing the `Origin` header's parsed host against the request's **own** `x-forwarded-host`/`host` rather than the static `CONFIG.site.url` (which would reject every Vercel preview deployment and every local run, and trust the template author's domain on a fork that never edited it), positioned ahead of the rate limiter so forged traffic cannot weaponise the counter; plus `hasJsonContentType` requiring `application/json` before the parse, removing the preflight-free delivery mechanism. Refusals reuse the existing `400`/`invalid_email` verbatim so SUB-03's no-enumeration-oracle contract is unchanged. Closes no REQUIREMENTS.md ID (none covers cross-site request authorization) and protects SUB-01…SUB-04 + SEC-03 as non-regression

**Wave 5** *(gap closure — blocked on Wave 4 completion)*

- [x] 03-06-PLAN.md — Gap closure (CR-01, Critical — the sole blocker from the 2026-07-26 review): the configuration gate at D-23 stage 1 wrote an unlatched `console.error` on every request when the route is unconfigured. That branch runs before the origin check and before the rate limiter, and — since the subscribe feature is off-by-default — is the path every fresh fork actually executes, so a trivial anonymous request loop drove unbounded operator-log volume and cost. Adds `unconfiguredLogged`, a module-scope boolean latch identical in shape to `03-05`'s `originRejectionLogged` (D-25), bounding the log to one line per serverless instance while leaving the bare `404` **outside** the latch so SUB-02's indistinguishable-from-undeployed contract is byte-for-byte unchanged; the message keeps its missing-variable diagnostic and gains a "further occurrences are not logged" note. Adds no console call site (the module holds exactly four, unchanged). Closes no REQUIREMENTS.md ID (none covers operator-log-volume containment) and protects SUB-02 + SUB-03 as non-regression

**UI hint**: yes

### Phase 4: Notify Route

**Goal**: When one or more posts go public, the daily cron sends current subscribers a single digest email listing every newly-public post from that run via Resend's Broadcast API, isolated per-post-section on failure, CAN-SPAM/RFC 8058 compliant, and reachable only by an authenticated cron request.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04, NOTIFY-05, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):

  1. Manually invoking `/api/notify-subscribers` with a valid `CRON_SECRET`-authenticated request when 3 posts have `Status=public` and `emailed` unchecked results in current subscribers receiving **one** digest email listing all 3 posts (title, summary, link, OG-image thumbnail per post), sent via a single `resend.broadcasts.create()`/`.send()` call against an Audience (not a looped `emails.send()` and not 3 separate broadcasts) — confirmed against a live Resend send log.
  2. The digest email includes a working one-click unsubscribe link, the configured physical mailing address, and a "why you're receiving this" line.
  3. A request to `/api/notify-subscribers` with a missing or invalid `CRON_SECRET` is rejected via a timing-safe comparison before any Notion or Resend call executes, confirmed by testing both a wrong-secret and a no-secret request.
  4. With one post's content deliberately malformed (e.g., missing title), the digest still sends with the other eligible posts' sections included, and only those successfully-included posts are marked `emailed`.
  5. If the digest send itself fails outright (not a per-post content issue), no posts from that run are marked `emailed`, so all of them are picked up again by the next cron run.
  6. With `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset, `/api/notify-subscribers` no-ops immediately with no Notion query or send attempted — and `/api/subscribe` (Phase 3) is reconfirmed to exhibit the same no-op contract for its own required env vars.

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: the whole authenticated path end to end — timing-safe `CRON_SECRET` gate as the first statement (SEC-01/D-14/D-15/D-16/D-17), fail-closed config gate covering the new `CONFIG.notify` block (SEC-02/D-06/D-09), capped query, one digest with a CAN-SPAM footer carrying a visible unsubscribe link (D-01..D-08, D-08 revised under its own escape hatch), exactly one `broadcasts.create` (NOTIFY-03), mark-after-send only (NOTIFY-05); then per-post-section isolation (NOTIFY-04), capability-aware marking, and the `NOTIFY_BATCH_SIZE` cap (D-10..D-13)

**Wave 2** *(blocked on Wave 1 — same route file)*

- [x] 04-02-PLAN.md — Thumbnails that survive delivery latency: expose Notion's `file` vs `external` discriminator as `Post.thumbnailType` via a new `getFileType()` extractor, then embed an `<img>` only for permanent external URLs and render Notion-hosted (1-hour presigned) thumbnails text-only like D-05's no-thumbnail case, with a per-run operator signal (04-RESEARCH.md Pitfall 1)

**Wave 3** *(blocked on Wave 2 — blocking operator checkpoint)*

- [x] 04-03-PLAN.md — Operator verification against live Resend + Notion: closes SC#1, SC#2, SC#4, SC#5 by observed outcome (one broadcast in the send log, one email received, a malformed post dropped while the rest send and mark, a failed send marking nothing) and discharges D-08's must-be-revisited clause by clicking the unsubscribe link in a delivered message

### Phase 5: Production Cutover

**Goal**: The notify path goes live in production only after the backfill has been confirmed complete, so the very first cron tick never emails a new subscriber the entire back catalog.
**Mode:** mvp
**Depends on**: Phase 2, Phase 4
**Requirements**: OPS-01
**Success Criteria** (what must be TRUE):

  1. The backfill script has been run against the production Notion database, and `getUnemailedPublicPosts()` returns zero posts when queried directly against production afterward.
  2. `vercel.json`'s cron entry is added and deployed as its own separate commit, created only after criterion 1 is confirmed — verified by checking the commit history shows the cron-entry commit strictly after the backfill-confirmation step, not bundled with the notify route's own deploy.
  3. The actual Vercel Hobby `maxDuration` limit for the target project has been verified directly against the deployed project's settings (not assumed from docs), and the notify route's batch size is confirmed to fit within it.

**Plans**: TBD

### Phase 6: Documentation

**Goal**: A forker can configure and safely enable the email feature using only README.md/README_KR.md, with none of the feature's known silent-failure traps left undocumented.
**Mode:** mvp
**Depends on**: Phase 3, Phase 5
**Requirements**: DOCS-01, DOCS-02, DOCS-03
**Success Criteria** (what must be TRUE):

  1. README.md and README_KR.md list `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, and `CRON_SECRET`, the `emailed` Notion property, and the Notion "Update content" capability grant as its own explicit, separately-labeled setup step (not folded into "set env vars").
  2. README.md and README_KR.md instruct forkers to complete Resend domain/SPF/DKIM verification as a mandatory step, and state the correct quota (up to 1,000 contacts/month via Broadcast/Audience, not the 100/day transactional figure).
  3. README.md and README_KR.md state that the cron only fires on Production deployments and is evaluated in UTC.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in this dependency order: 1 → 2 → (3 parallel-safe at any point) → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Notion Data Layer | 2/2 | Complete    | 2026-07-25 |
| 2. Backfill Script | 2/2 | Complete    | 2026-07-26 |
| 3. Subscribe Path | 6/6 | Complete    | 2026-07-27 |
| 4. Notify Route | 3/3 | Complete    | 2026-07-27 |
| 5. Production Cutover | 0/TBD | Not started | - |
| 6. Documentation | 0/TBD | Not started | - |
