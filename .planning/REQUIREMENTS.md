# Requirements: NoLog — Email Subscription for New Posts

**Defined:** 2026-07-24
**Core Value:** A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.

## v1 Requirements

Requirements for the email subscription feature. Derived from the approved `/autoplan` design doc plus this session's research pass (`.planning/research/`). Each maps to a roadmap phase.

### Data Layer (DATA)

- [ ] **DATA-01**: `NologClient` can query all public posts not yet marked `emailed`
- [ ] **DATA-02**: `NologClient` can mark a post as `emailed` after a successful send
- [ ] **DATA-03**: A one-time backfill script marks all pre-existing public posts as `emailed` before the first production cron run — throttled to Notion's ~3 req/s rate limit and safely re-runnable if interrupted
- [ ] **DATA-04**: `markEmailed` distinguishes a 403 (missing Notion "Update content" capability) from other failures in its logs, rather than treating it as a generic error

### Subscribe (SUB)

- [ ] **SUB-01**: A visitor can submit their email to subscribe to new-post notifications via a form on the blog
- [ ] **SUB-02**: The subscribe form is fully absent/inert when Resend env vars are unset — same fail-closed contract as the existing Cusdis comment integration
- [ ] **SUB-03**: Submitting an already-subscribed email returns the identical success response as a new subscription (no enumeration oracle for testing third-party addresses)
- [ ] **SUB-04**: The subscribe endpoint blocks bot submissions via a honeypot field and per-IP rate limiting

### Notification (NOTIFY)

- [ ] **NOTIFY-01**: When one or more Notion posts flip `Status` to `public`, current subscribers receive **a single digest email per cron run** listing every newly-public post found in that run (title, summary, link, OG-image thumbnail per post), within ~24h via the daily cron
- [ ] **NOTIFY-02**: Every notification email includes a one-click unsubscribe link, a forker-configurable physical mailing address, and a "why you're receiving this" line
- [ ] **NOTIFY-03**: The notify route sends via Resend's Broadcast API (one broadcast per cron run, not a per-subscriber send loop), so unsubscribe handling and RFC 8058 compliance are automatic
- [ ] **NOTIFY-04**: A problem building one post's section of the digest doesn't prevent the other posts from that run being included and sent (per-post isolation moves to the content-assembly stage, since there's now one email per run rather than one per post)
- [ ] **NOTIFY-05**: Only posts successfully included in a sent digest are marked `emailed`; if the whole send fails, no posts in that run are marked, so they're picked up again by the next run

### Access Control (SEC)

- [ ] **SEC-01**: `/api/notify-subscribers` rejects any request without a valid `CRON_SECRET`, checked first via a timing-safe comparison, before any other work runs
- [ ] **SEC-02**: `/api/notify-subscribers` and `/api/subscribe` both fail closed (no-op) if their required env vars are unset
- [ ] **SEC-03**: The subscribe form is gated server-side (a Server Component reads the secret env vars and conditionally renders the client form) — `RESEND_API_KEY` never reaches the client bundle, unlike Cusdis's public app ID pattern

### Deployment & Ops (OPS)

- [ ] **OPS-01**: `vercel.json`'s cron entry is added and deployed only after the backfill script has run and `getUnemailedPublicPosts()` is confirmed empty against production — a separate, deliberate commit, not bundled with the notify route's own deploy

### Documentation (DOCS)

- [ ] **DOCS-01**: README.md and README_KR.md document the new env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`), the `emailed` Notion property, and the Notion "Update content" capability grant as its own explicit setup step, separate from setting env vars
- [ ] **DOCS-02**: README.md and README_KR.md document Resend domain/SPF/DKIM verification as a mandatory setup step (not optional), and state the *correct* Broadcast/Audience quota (up to 1,000 contacts/month on the free tier) rather than the transactional Send API cap
- [ ] **DOCS-03**: README.md and README_KR.md state that the cron only fires on Production deployments, evaluated in UTC

## v2 Requirements

Deferred to future release. Tracked in `TODOS.md`, not in the current roadmap.

### Notifications (extended)

- **NOTF-01**: RSS feed (`/feed.xml`) as a second, zero-infra notification channel
- **NOTF-02**: On-site "new post" indicator/badge for return visitors
- **NOTF-03**: Lightweight non-blocking "you were just subscribed" notice — a cheap backstop for the no-confirmation-signup risk, conditional on real abuse reports actually appearing

> Note: same-day digest batching previously occupied the NOTF-03 slot (now reused above for the signup-notice item) but was pulled into v1 scope during roadmap review (2026-07-24) — see NOTIFY-01/04/05 above.

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
| Rich HTML/richly-designed digest template (theming, multi-column layout, etc.) | Conflicts with "minimal" core value — NOTIFY-01's plain per-post-section digest format is the ceiling for v1, not a stepping stone to a fancier layout. |
| Hardening pre-existing fail-open patterns found during codebase mapping (`NOTION_TOKEN`/`NOTION_DATABASE_ID` empty-string defaults, silent catch-alls, pagination gap) | Pre-existing and unrelated to this feature. Tracked in `TODOS.md` for a future, separate pass. |
| Adding a test framework to the repo | Zero test infrastructure exists today; a separate, larger undertaking than this feature. Tracked in `TODOS.md`. |

## Traceability

Which phases cover which requirements. Populated from `.planning/research/SUMMARY.md`'s suggested phase structure — confirmed during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1: Notion Data Layer | Gaps Found |
| DATA-02 | Phase 1: Notion Data Layer | Gaps Found |
| DATA-03 | Phase 2: Backfill Script | Pending |
| DATA-04 | Phase 1: Notion Data Layer | Gaps Found |
| SUB-01 | Phase 3: Subscribe Path | Pending |
| SUB-02 | Phase 3: Subscribe Path | Pending |
| SUB-03 | Phase 3: Subscribe Path | Pending |
| SUB-04 | Phase 3: Subscribe Path | Pending |
| NOTIFY-01 | Phase 4: Notify Route | Pending |
| NOTIFY-02 | Phase 4: Notify Route | Pending |
| NOTIFY-03 | Phase 4: Notify Route | Pending |
| NOTIFY-04 | Phase 4: Notify Route | Pending |
| NOTIFY-05 | Phase 4: Notify Route | Pending |
| SEC-01 | Phase 4: Notify Route | Pending |
| SEC-02 | Phase 4: Notify Route | Pending |
| SEC-03 | Phase 3: Subscribe Path | Pending |
| OPS-01 | Phase 5: Production Cutover | Pending |
| DOCS-01 | Phase 6: Documentation | Pending |
| DOCS-02 | Phase 6: Documentation | Pending |
| DOCS-03 | Phase 6: Documentation | Pending |

**Coverage:**

- v1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-24*
*Last updated: 2026-07-24 after pulling same-day digest batching into v1 scope (roadmap review)*
