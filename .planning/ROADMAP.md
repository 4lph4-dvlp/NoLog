# Roadmap: NoLog — Email Subscription for New Posts

## Overview

This milestone takes NoLog from "blog with no notification channel" to "forkers can optionally let visitors subscribe by email and get notified, once/day, via a digest email covering every post that went public since the last check" — using only Notion + Vercel + Resend, no new infrastructure. The path runs from the data layer that tracks what's been emailed (Phase 1), through the one-time backfill that protects every existing fork's back catalog (Phase 2), the subscribe path (Phase 3, buildable in parallel since it has no technical dependency on the notify side), the notify route itself (Phase 4, one digest per cron run rather than one email per post — pulled forward into v1 during roadmap review), the deliberately separate production cutover that enforces backfill-before-cron ordering (Phase 5), and finally the documentation that closes the feature's sharpest silent-failure gaps (Phase 6). Every phase preserves the project's core off-by-default, fail-closed contract: a forker who sets no Resend env vars sees no subscribe form and triggers no email logic, exactly like the existing Cusdis integration.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Notion Data Layer** - `NologClient` can query unemailed public posts and durably mark a post as emailed, with clear diagnostics when write access is missing
- [ ] **Phase 2: Backfill Script** - A one-time, throttled, resumable script marks every pre-existing public post as `Emailed` before the cron path ever runs
- [ ] **Phase 3: Subscribe Path** - A visitor can subscribe via a form that's fully gated, abuse-resistant, and enumeration-safe
- [ ] **Phase 4: Notify Route** - The cron-only notify route sends one digest email per run listing every newly-public post, isolated per-post-section and compliant
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
  2. `getUnemailedPublicPosts()` returns only posts where `status === "public"` and `Emailed` is unchecked, verified against a Notion database containing a mix of emailed, unemailed, and private posts.
  3. `markEmailed(pageId)` issues the correct Notion `checkbox` PATCH body shape (verified directly against Notion's current API reference, not assumed) and the change is visible on a subsequent read.
  4. When the Notion integration lacks "Update content" capability, `markEmailed` logs a distinguishable 403-specific message rather than a generic error, confirmed by temporarily revoking that capability and observing the log output.

**Plans**: 1/1 plans executed

- [x] 01-01-PLAN.md — Extend NologClient: getUnemailedPublicPosts() + markEmailed() (tracer happy path) and typed fail-loud errors NotionCapabilityError/MissingEmailedPropertyError (D-01/D-03)

### Phase 2: Backfill Script

**Goal**: Every pre-existing public post can be marked `Emailed` in one throttled, resumable run, so enabling the notify path never blasts a fork's entire back catalog on its first cron tick.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-03
**Success Criteria** (what must be TRUE):

  1. Running the backfill script against a database with N pre-existing public posts marks all N as `Emailed` and logs a final "N marked / M failed" count.
  2. Interrupting the script partway through and re-running it processes only posts still unmarked (check-before-write) and completes cleanly without re-marking or erroring on already-emailed posts.
  3. The script's request rate during a run stays within Notion's ~3 req/s limit, confirmed by inspecting timing/log output against a nontrivial post count.

**Plans**: TBD

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

**Plans**: TBD
**UI hint**: yes

### Phase 4: Notify Route

**Goal**: When one or more posts go public, the daily cron sends current subscribers a single digest email listing every newly-public post from that run via Resend's Broadcast API, isolated per-post-section on failure, CAN-SPAM/RFC 8058 compliant, and reachable only by an authenticated cron request.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04, NOTIFY-05, SEC-01, SEC-02
**Success Criteria** (what must be TRUE):

  1. Manually invoking `/api/notify-subscribers` with a valid `CRON_SECRET`-authenticated request when 3 posts have `Status=public` and `Emailed` unchecked results in current subscribers receiving **one** digest email listing all 3 posts (title, summary, link, OG-image thumbnail per post), sent via a single `resend.broadcasts.create()`/`.send()` call against an Audience (not a looped `emails.send()` and not 3 separate broadcasts) — confirmed against a live Resend send log.
  2. The digest email includes a working one-click unsubscribe link, the configured physical mailing address, and a "why you're receiving this" line.
  3. A request to `/api/notify-subscribers` with a missing or invalid `CRON_SECRET` is rejected via a timing-safe comparison before any Notion or Resend call executes, confirmed by testing both a wrong-secret and a no-secret request.
  4. With one post's content deliberately malformed (e.g., missing title), the digest still sends with the other eligible posts' sections included, and only those successfully-included posts are marked `Emailed`.
  5. If the digest send itself fails outright (not a per-post content issue), no posts from that run are marked `Emailed`, so all of them are picked up again by the next cron run.
  6. With `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset, `/api/notify-subscribers` no-ops immediately with no Notion query or send attempted — and `/api/subscribe` (Phase 3) is reconfirmed to exhibit the same no-op contract for its own required env vars.

**Plans**: TBD

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

  1. README.md and README_KR.md list `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, and `CRON_SECRET`, the `Emailed` Notion property, and the Notion "Update content" capability grant as its own explicit, separately-labeled setup step (not folded into "set env vars").
  2. README.md and README_KR.md instruct forkers to complete Resend domain/SPF/DKIM verification as a mandatory step, and state the correct quota (up to 1,000 contacts/month via Broadcast/Audience, not the 100/day transactional figure).
  3. README.md and README_KR.md state that the cron only fires on Production deployments and is evaluated in UTC.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in this dependency order: 1 → 2 → (3 parallel-safe at any point) → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Notion Data Layer | 1/1 | In Progress|  |
| 2. Backfill Script | 0/TBD | Not started | - |
| 3. Subscribe Path | 0/TBD | Not started | - |
| 4. Notify Route | 0/TBD | Not started | - |
| 5. Production Cutover | 0/TBD | Not started | - |
| 6. Documentation | 0/TBD | Not started | - |
