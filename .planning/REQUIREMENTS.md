# Requirements: NoLog — Email Subscription for New Posts

**Defined:** 2026-07-24
**Core Value:** A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.

## v1 Requirements

Requirements for the email subscription feature. Derived from the approved `/autoplan` design doc plus this session's research pass (`.planning/research/`). Each maps to a roadmap phase.

### Data Layer (DATA)

- [ ] **DATA-01**: `NologClient` can query all public posts not yet marked `Emailed`
- [ ] **DATA-02**: `NologClient` can mark a post as `Emailed` after a successful send
- [ ] **DATA-03**: A one-time backfill script marks all pre-existing public posts as `Emailed` before the first production cron run — throttled to Notion's ~3 req/s rate limit and safely re-runnable if interrupted
- [ ] **DATA-04**: `markEmailed` distinguishes a 403 (missing Notion "Update content" capability) from other failures in its logs, rather than treating it as a generic error

### Subscribe (SUB)

- [ ] **SUB-01**: A visitor can submit their email to subscribe to new-post notifications via a form on the blog
- [ ] **SUB-02**: The subscribe form is fully absent/inert when Resend env vars are unset — same fail-closed contract as the existing Cusdis comment integration
- [ ] **SUB-03**: Submitting an already-subscribed email returns the identical success response as a new subscription (no enumeration oracle for testing third-party addresses)
- [ ] **SUB-04**: The subscribe endpoint blocks bot submissions via a honeypot field and per-IP rate limiting

### Notification (NOTIFY)

- [ ] **NOTIFY-01**: When a Notion post's `Status` flips to `public`, all current subscribers receive an email with title, summary, link, and OG-image thumbnail within ~24h via the daily cron
- [ ] **NOTIFY-02**: Every notification email includes a one-click unsubscribe link, a forker-configurable physical mailing address, and a "why you're receiving this" line
- [ ] **NOTIFY-03**: The notify route sends via Resend's Broadcast API (not a per-subscriber send loop), so unsubscribe handling and RFC 8058 compliance are automatic
- [ ] **NOTIFY-04**: A failure sending or marking one post never blocks notification of other posts in the same run (per-post isolation)

### Access Control (SEC)

- [ ] **SEC-01**: `/api/notify-subscribers` rejects any request without a valid `CRON_SECRET`, checked first via a timing-safe comparison, before any other work runs
- [ ] **SEC-02**: `/api/notify-subscribers` and `/api/subscribe` both fail closed (no-op) if their required env vars are unset
- [ ] **SEC-03**: The subscribe form is gated server-side (a Server Component reads the secret env vars and conditionally renders the client form) — `RESEND_API_KEY` never reaches the client bundle, unlike Cusdis's public app ID pattern

### Deployment & Ops (OPS)

- [ ] **OPS-01**: `vercel.json`'s cron entry is added and deployed only after the backfill script has run and `getUnemailedPublicPosts()` is confirmed empty against production — a separate, deliberate commit, not bundled with the notify route's own deploy

### Documentation (DOCS)

- [ ] **DOCS-01**: README.md and README_KR.md document the new env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`), the `Emailed` Notion property, and the Notion "Update content" capability grant as its own explicit setup step, separate from setting env vars
- [ ] **DOCS-02**: README.md and README_KR.md document Resend domain/SPF/DKIM verification as a mandatory setup step (not optional), and state the *correct* Broadcast/Audience quota (up to 1,000 contacts/month on the free tier) rather than the transactional Send API cap
- [ ] **DOCS-03**: README.md and README_KR.md state that the cron only fires on Production deployments, evaluated in UTC

## v2 Requirements

Deferred to future release. Tracked in `TODOS.md`, not in the current roadmap.

### Notifications (extended)

- **NOTF-01**: RSS feed (`/feed.xml`) as a second, zero-infra notification channel
- **NOTF-02**: On-site "new post" indicator/badge for return visitors
- **NOTF-03**: Batch same-day multiple publishes into one digest email
- **NOTF-04**: Lightweight non-blocking "you were just subscribed" notice — a cheap backstop for the no-confirmation-signup risk, conditional on real abuse reports actually appearing

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Generic "on-publish" hook abstraction | Premature abstraction — exactly one consumer (email) exists today. Revisit only if a second channel (Slack, Discord, RSS-as-push) is actually being built. |
| Notion database automation webhook as the trigger | Requires a paid Notion plan to create/edit; would silently break for free-plan forkers. Documented as an optional fast-path for paid-plan forkers, not built this pass. |
| Distributed lock / Redis-backed concurrency guard on the notify route | Would fully close the cron-double-fire race, but requires new infrastructure (Vercel KV/Redis), conflicting with the explicit "no new infrastructure" constraint. Accepted as a limitation; mitigated via idempotent per-post marking instead. |
| Double opt-in / confirmation-click gate before signup | Already decided against as part of "keep it minimal." The abuse risk is real but bounded at this project's actual scale (≤1 email/day, one-click unsubscribe from message one); mitigated instead via honeypot + rate limiting + enumeration-safe responses. |
| CAPTCHA on the subscribe form | Disproportionate friction (accessibility, mobile UX, third-party script overhead) for a low-traffic personal/small-team blog's actual bot-abuse volume. |
| Preference center (topics, frequency, digest vs. per-post) | Only one email type exists — nothing to preference between. Pure premature complexity. |
| Rich HTML digest / multi-post roundup template | Conflicts with "minimal" core value and presupposes a batching model (see NOTF-03) that hasn't been built. |
| Hardening pre-existing fail-open patterns found during codebase mapping (`NOTION_TOKEN`/`NOTION_DATABASE_ID` empty-string defaults, silent catch-alls, pagination gap) | Pre-existing and unrelated to this feature. Tracked in `TODOS.md` for a future, separate pass. |
| Adding a test framework to the repo | Zero test infrastructure exists today; a separate, larger undertaking than this feature. Tracked in `TODOS.md`. |

## Traceability

Which phases cover which requirements. Populated from `.planning/research/SUMMARY.md`'s suggested phase structure — confirmed during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1: Notion Data Layer | Pending |
| DATA-02 | Phase 1: Notion Data Layer | Pending |
| DATA-03 | Phase 2: Backfill Script | Pending |
| DATA-04 | Phase 1: Notion Data Layer | Pending |
| SUB-01 | Phase 3: Subscribe Path | Pending |
| SUB-02 | Phase 3: Subscribe Path | Pending |
| SUB-03 | Phase 3: Subscribe Path | Pending |
| SUB-04 | Phase 3: Subscribe Path | Pending |
| NOTIFY-01 | Phase 4: Notify Route | Pending |
| NOTIFY-02 | Phase 4: Notify Route | Pending |
| NOTIFY-03 | Phase 4: Notify Route | Pending |
| NOTIFY-04 | Phase 4: Notify Route | Pending |
| SEC-01 | Phase 4: Notify Route | Pending |
| SEC-02 | Phase 3: Subscribe Path / Phase 4: Notify Route | Pending |
| SEC-03 | Phase 3: Subscribe Path | Pending |
| OPS-01 | Phase 5: Production Cutover | Pending |
| DOCS-01 | Phase 6: Documentation | Pending |
| DOCS-02 | Phase 6: Documentation | Pending |
| DOCS-03 | Phase 6: Documentation | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-24*
*Last updated: 2026-07-24 after initial definition*
