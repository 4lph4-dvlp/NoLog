# Feature Research

**Domain:** Email notification-on-publish for a self-hosted blog (not a general newsletter/CRM product)
**Researched:** 2026-07-24
**Confidence:** HIGH (legal/deliverability norms are well-documented, cross-checked across multiple independent sources; Resend-specific mechanics confirmed against Resend's own docs)

## Scope Note

This researches only the narrow feature "email a subscriber list when a post goes public," constrained by the decisions already locked in `PROJECT.md`: minimal template (title/summary/link/thumbnail), no confirmation/double-opt-in, no preference center, no rich digest, Resend Audiences + Broadcast API, off-by-default/config-gated. This document does not re-litigate those decisions — it identifies what's legally/practically non-negotiable *within* that minimal shape, and flags the one open risk (no-confirmation signup) explicitly called out for eng review in the milestone context.

## Feature Landscape

### Table Stakes (Users/Law Expect These)

Features that are non-negotiable even in a minimal build — missing them is a legal or deliverability failure, not a taste preference.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click unsubscribe link in every email | CAN-SPAM requires a functioning opt-out link honored within 10 business days (30-day link validity); GDPR requires withdrawal "as easy as" giving consent. Gmail/Yahoo bulk-sender rules (Feb 2024+) require RFC 8058 one-click unsubscribe for senders of 5,000+ msgs/day — NoLog is far under that threshold, but implementing it is nearly free via Resend and future-proofs against volume growth. | LOW | Resend's Broadcast API auto-injects the unsubscribe mechanism when a Broadcast is sent against an Audience (the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag resolves and Resend automatically handles the unsubscribe flow, including RFC 8058 compliance for Broadcasts). Confirm the notify route actually uses the Broadcast API (not raw `/emails` send) so this is automatic — if it uses the transactional send endpoint instead, the `List-Unsubscribe` / `List-Unsubscribe-Post` headers must be added manually. |
| Unsubscribe takes effect without further login/payment/friction | CAN-SPAM: no fee, no login, no "tell us why" gate before honoring an opt-out; an email address is sufficient. | LOW | Resend audience unsubscribe already satisfies this — don't build a custom preference/login gate on top of it. |
| Clear sender identity — accurate From name, working Reply-To, non-deceptive subject line | CAN-SPAM prohibits misleading header/subject info; also a basic trust/deliverability signal (looks-like-phishing kills open rates and triggers spam filters). | LOW | Use the blog's actual name as From name; subject = post title, not clickbait. |
| Physical mailing address in the email footer | CAN-SPAM's clearest, most-overlooked requirement for any commercial-ish bulk email; even though a personal blog's "new post" email is a defensible gray area (arguably not "commercial advertisement"), the cost of including a mailing address is one template line and it's the single most common trigger the FTC actually enforces on. Skipping it is the highest legal-risk-per-effort-saved corner in this feature. | LOW | Make it a forker-supplied config value (env var or Notion-settings field), not hardcoded — consistent with the project's "generic for any forker" constraint. If a forker leaves it blank, document that they're accepting the residual CAN-SPAM risk rather than silently omitting it. |
| "Why am I receiving this" line in the email body | Not strictly legal, but table stakes for trust: recipients who don't recognize why they're getting an email mark-as-spam at a much higher rate, which is the actual deliverability killer (spam complaint rate, not the law, is what gets a sending domain blocklisted). | LOW | One sentence: "You're receiving this because you subscribed to updates from [blog name]." plus the unsubscribe link right next to it. |
| Basic bot/abuse mitigation on the public subscribe form | The form has no confirmation email gate (explicit decision), so it's the only line of defense against automated spam-signup bots and against being used to enter throwaway/garbage addresses that bounce and damage sender reputation. | LOW | Honeypot hidden field (bots fill every field blindly, humans never see it) + a minimal time-on-page check (reject submissions faster than a human could plausibly fill the form) is the standard low-friction combo — no CAPTCHA needed at this volume/threat level. |
| Rate limiting / abuse throttling on `/api/subscribe` by IP | Without a confirmation gate, this endpoint is the one place someone could (a) mass-add arbitrary third-party email addresses as an annoyance/"listbombing" vector, or (b) probe the endpoint to enumerate whether an address already exists in the Audience (an information-disclosure oracle if the response differs for "already subscribed" vs "new"). | LOW-MEDIUM | Already partially covered by the planned idempotent-on-duplicate behavior — just make sure the *response* is identical (generic "you're subscribed" success) whether the contact was new or already existed, so the endpoint can't be used to test arbitrary addresses. Add a simple per-IP rate limit (in-memory or Vercel Edge Config, not a new infra dependency) to blunt bulk-add abuse. |
| Immediate, stable unsubscribe (not "processed within N days" from the recipient's perspective) | Table stakes for user expectation even though CAN-SPAM's legal floor is 10 business days — modern mailbox providers and users expect same-request effect. | LOW | Resend audience unsubscribe is effectively instant; no extra work needed beyond using it correctly. |

### Differentiators (Competitive Advantage)

**Largely N/A by design.** The explicit product decision this session was "keep it minimal" — this feature is not meant to differentiate NoLog from other blog templates on newsletter sophistication; it's meant to be the smallest correct implementation. The one item below is worth calling a soft differentiator only because it's already scoped and costs nothing extra:

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| OG-image thumbnail in the email header (already planned, reusing `/api/og`) | Most zero-infra/DIY blog-notification setups send plain text or a bare link; a branded thumbnail makes the email feel like a "real" product touch at zero marginal infra cost since the OG route already exists. | LOW | Already scoped in `PROJECT.md`. Not worth expanding beyond this — do not add a full HTML digest, multi-post layout, or theming system on top of it (see anti-features). |

Everything else in this space (segmentation, send-time optimization, A/B subject lines, engagement analytics, preference centers) is explicitly out of scope for this project's goals and would contradict the "minimal, zero-infra" core value.

### Anti-Features (Commonly Requested, Often Problematic — or Already Decided Against)

| Feature | Why Requested | Why Problematic (or why already decided against) | Alternative |
|---------|---------------|-----------------------|-------------|
| Double opt-in / confirmation-click gate before an address becomes active | Standard newsletter-tool default; genuinely reduces spam complaints and blocks "listbombing" (someone subscribing a victim's address they don't own) at the source — this is the real, documented risk of skipping it. | Already explicitly decided against in `PROJECT.md` as part of "keep it minimal." The risk is real but *bounded* at this project's actual scale: a single low-frequency (≤1/day) blog send is not the mass-newsletter-spam-blocklist scenario double opt-in exists to prevent, and Resend's own audience/unsubscribe handling means any wrongly-subscribed victim can remove themselves in one click on the very first email. Flagged for eng review per milestone context, not re-litigated here. | If the abuse risk becomes real in practice (reports of unwanted subscriptions), the cheapest first mitigation is *not* re-adding a confirmation gate — it's a lightweight immediate "you were just subscribed to X — unsubscribe here" notice on signup (distinct from a blocking confirmation: it doesn't gate delivery, it just makes the action visible to the real mailbox owner immediately). Worth surfacing to eng review as a low-friction middle ground if the no-confirmation risk needs a cheap backstop later. |
| CAPTCHA on the subscribe form | Seems like the "serious" anti-bot answer. | Adds real friction (accessibility complaints, mobile UX tax, third-party script/privacy overhead) that's disproportionate to a low-traffic personal/small-team blog's actual bot-abuse volume; honeypot + rate limit is the standard proportionate response at this scale. | Honeypot + IP rate limit (see table stakes above). |
| Preference center (topics, frequency, digest vs. per-post) | Feels like basic newsletter hygiene once you have >1 email type. | Explicitly out of scope in `PROJECT.md`; there is only one email type (new-post notification), so a preference center has nothing to preference between — pure premature complexity. | Single unsubscribe link is the only "preference" that exists or needs to exist. |
| Rich HTML digest / multi-post roundup design | Looks more "professional" / matches what commercial newsletter tools ship by default. | Explicitly out of scope; also directly conflicts with the "batch same-day multiple publishes" deferral already logged in `TODOS.md` — a digest format presupposes a batching model that hasn't been built. | Plain single-post template: title, summary, link, OG thumbnail. |
| Re-implementing unsubscribe/contact-management instead of using Resend Audiences' built-in handling | Feels more "under our control." | Reinvents RFC 8058 compliance, bounce/complaint handling, and suppression-list logic that Resend already provides for free within its Audience/Broadcast model — high effort, high risk of getting the legal/deliverability details wrong, zero benefit. | Use Resend Audiences + Broadcast API as already decided; only add manual `List-Unsubscribe` headers if the implementation ends up using the transactional `/emails` endpoint instead of Broadcast. |
| Bounce/complaint webhook handling, sender reputation dashboards, list-hygiene automation | Real newsletter operators need this at scale. | Out of proportion to Resend's free tier (3,000/mo, 100/day) and this project's zero-infra constraint — would require a webhook receiver and persistent state NoLog doesn't have. | Rely on Resend's own dashboard and automatic suppression handling; revisit only if volume ever approaches paid-tier territory. |

## Feature Dependencies

```
One-click unsubscribe (table stakes)
    └──requires──> Resend Broadcast API usage (not raw transactional send)
                       └──if absent──> manual List-Unsubscribe / List-Unsubscribe-Post headers required instead

Bot/abuse mitigation on /api/subscribe (table stakes)
    └──substitutes-for──> Double opt-in confirmation gate (anti-feature, deliberately skipped)

Idempotent-on-duplicate signup (already planned)
    └──enhances──> Enumeration-safe /api/subscribe (identical response for new vs. existing contact)

Physical address + "why am I receiving this" line
    └──enhances──> Spam-complaint rate (lower complaints = healthier sender reputation over time)

Rich HTML digest / preference center (anti-features)
    └──conflicts──> "Minimal" core value and current single-email-type design
```

### Dependency Notes

- **One-click unsubscribe requires Broadcast API usage:** Resend only auto-handles RFC 8058 headers and the unsubscribe merge variable for emails sent through the Broadcast API against an Audience. If `/api/notify-subscribers` ends up calling the plain `/emails` send endpoint for any reason (e.g., per-recipient personalization needs), the headers must be added by hand — this is a build-time decision worth confirming during implementation, not assuming.
- **Bot mitigation substitutes for double opt-in:** these two are alternative answers to the same problem (garbage/malicious signups). Since double opt-in is off the table, the honeypot + rate-limit + enumeration-safe-response combo is *the* mitigation layer, not an optional add-on — treat it as equally mandatory as the feature it's compensating for.
- **Enumeration-safety enhances idempotency:** the planned idempotent-duplicate-submission behavior needs to fail closed on information leakage too — "already subscribed" and "newly subscribed" must look identical to the caller, or the endpoint becomes an oracle for testing arbitrary third-party email addresses.
- **Minimal template conflicts with digest/preference-center asks:** any future request to add these should be treated as a new milestone-level decision, not a quiet scope-creep addition to this one.

## MVP Definition

### Launch With (v1) — matches `PROJECT.md` Active scope

- [ ] Resend Audience-backed subscribe form with honeypot + basic rate limiting — anti-abuse is not optional when confirmation is skipped
- [ ] `/api/subscribe`: identical success response regardless of new-vs-existing contact (no enumeration oracle)
- [ ] `/api/notify-subscribers` via Resend Broadcast API (or manual RFC 8058 headers if Broadcast API isn't used) — legal/deliverability floor
- [ ] Email template: title, summary, link, OG thumbnail, "why you're receiving this" line, unsubscribe link, physical address (forker-configurable) — the actual legal/trust minimum, not an arbitrary design choice
- [ ] Fail-closed behavior on missing env vars (already planned) — consistent with this session's "fail-closed, not fail-open" theme

### Add After Validation (v1.x)

- [ ] Lightweight post-signup notice email ("you were just subscribed — unsubscribe here") as a cheap backstop to the no-confirmation risk, if real-world abuse reports ever materialize — trigger: actual complaint(s) from wrongly-subscribed third parties, not speculative risk
- [ ] Same-day batching into one email (already tracked in `TODOS.md`) — trigger: Resend's 100/day cap becomes a real constraint

### Future Consideration (v2+)

- [ ] RSS feed as an alternative, confirmation-free subscription channel (already deferred to `TODOS.md`) — defer because it doesn't block or interact with the email path
- [ ] On-site "new post" badge (already deferred to `TODOS.md`) — defer, independent surface with its own review needs
- [ ] Preference center / topics / digest format — defer indefinitely; only revisit if a second distinct email type is ever introduced

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| One-click unsubscribe (Resend Broadcast/RFC 8058) | HIGH (legal + deliverability) | LOW | P1 |
| Physical address in footer | MEDIUM (legal defensibility) | LOW | P1 |
| "Why you're receiving this" line | MEDIUM (spam-complaint reduction) | LOW | P1 |
| Honeypot + rate limit on subscribe form | HIGH (only anti-abuse layer given no confirmation) | LOW | P1 |
| Enumeration-safe subscribe response | MEDIUM (privacy/abuse-surface reduction) | LOW | P1 |
| OG-thumbnail in email | LOW-MEDIUM (polish) | LOW (route already exists) | P2 |
| Post-signup "you were subscribed" notice | MEDIUM (backstop for no-confirmation risk) | LOW | P3 (conditional trigger, not default v1) |
| Same-day batching | LOW at current volume | MEDIUM | P3 |
| Preference center / digest | N/A (out of scope) | HIGH | Not planned |

**Priority key:**
- P1: Must have for launch (legal/deliverability floor + the one available anti-abuse layer)
- P2: Should have, cheap and already scoped
- P3: Conditional — only if a specific trigger condition occurs

## Competitor / Reference Implementation Analysis

Framed as reference patterns rather than competitors, since NoLog isn't competing on newsletter sophistication:

| Pattern | Substack/Ghost (hosted platforms) | Typical DIY "new post → Mailgun/SendGrid" scripts | NoLog's Approach |
|---------|-----------------------------------|----------------------------------------------------|-------------------|
| Opt-in flow | Single opt-in by default, relies on platform-wide reputation and built-in abuse tooling | Usually no confirmation either (same zero-infra motivation), often *also* skip physical address and enumeration-safety — a common corner-cutting pattern worth explicitly not copying | Single opt-in (decided), but pairs it with honeypot + rate limit + enumeration-safe response — the parts DIY scripts usually skip |
| Unsubscribe | Fully managed, platform-wide suppression list | Frequently hand-rolled and inconsistent (missed List-Unsubscribe headers, broken links after redeploys) | Delegated entirely to Resend Audiences — same reliability as hosted platforms, without hosting the list logic |
| Template richness | Rich HTML, author branding, sometimes digest options | Usually plain text or a bare link, minimal effort | Deliberately minimal but slightly richer than typical DIY (OG thumbnail) at no added infra cost |

## Sources

- CAN-SPAM Act compliance and physical address requirement: [Shopify CAN-SPAM guide](https://www.shopify.com/blog/can-spam-act), [FTC CAN-SPAM Compliance Guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business), [Tomba: CAN-SPAM Physical Address Requirement](https://tomba.io/blog/can-spam-physical-address-requirement) — HIGH confidence (FTC is primary source)
- One-click unsubscribe / RFC 8058 / Gmail-Yahoo bulk sender rules: [RFC 8058 (RFC Editor)](https://www.rfc-editor.org/rfc/rfc8058.html), [Valimail: One-click unsubscribe](https://www.valimail.com/blog/one-click-unsubscribe/), [Mailgun: What is RFC 8058?](https://www.mailgun.com/blog/deliverability/what-is-rfc-8058/), [Google's own sender guidelines](https://support.google.com/mail/answer/14229414?hl=en) — HIGH confidence (RFC + vendor primary docs)
- Resend-specific mechanics (Broadcast API auto-handling unsubscribe/RFC 8058, manual headers required for transactional send): [Resend: Managing Unsubscribed Contacts](https://resend.com/docs/dashboard/audiences/managing-unsubscribe-list), [Resend: Add unsubscribe link to transactional emails](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails), [Resend Broadcast API blog post](https://resend.com/blog/broadcast-api) — HIGH confidence (vendor primary docs)
- Double vs. single opt-in deliverability/spam-complaint data: [Litmus: Single vs Double Opt-In](https://www.litmus.com/blog/single-opt-in-vs-double-opt-in-case-for-soi"), [Mailjet: Double Opt-In](https://www.mailjet.com/blog/deliverability/double-opt-in-should-i-or-shouldnt-i/) — MEDIUM-HIGH confidence (vendor blogs with cited benchmark data, some incentive to favor their own opt-in tooling)
- Newsletter signup abuse / listbombing risk of single opt-in: [captcha.eu: What Is Newsletter Signup Abuse?](https://www.captcha.eu/what-is-newsletter-signup-abuse/), [Wikipedia: Opt-in email](https://en.wikipedia.org/wiki/Opt-in_email), [Suped: Why am I getting strange newsletter signups?](https://www.suped.com/learn/email-deliverability/why-am-i-getting-a-lot-of-strange-signups-to-my-newsletter) — MEDIUM-HIGH confidence, cross-checked across independent sources
- GDPR consent/unsubscribe requirements for newsletters: [iubenda: Email/Newsletter Compliance Guide](https://www.iubenda.com/en/help/5640-email-newsletter-compliance-guide/), [TermsFeed: GDPR Email Newsletters](https://www.termsfeed.com/blog/gdpr-email-newsletters/) — MEDIUM confidence (legal-adjacent vendor content, not primary regulatory text, but consistent across sources)
- Honeypot anti-bot pattern for signup forms without confirmation: [Auth0: Honeypots — A Simple Trap for Spam Registration Bots](https://auth0.com/blog/honeypots-simple-bot-trap/), [Vero: Add a Honeypot to Website Forms](https://www.getvero.com/resources/add-a-honeypot-to-website-forms-to-reduce-spam/) — HIGH confidence (well-established, widely corroborated pattern)
- Minimal notification email content/design norms: [Stripo: Notification emails examples and best practices](https://stripo.email/blog/notification-emails-examples-and-best-practices/), [MailCharts: Plain Text Emails](https://www.mailcharts.com/blog/plain-text-emails-get-maximum-impact-from-a-minimalist-look) — MEDIUM confidence (industry blog consensus, not a formal standard)

---
*Feature research for: email-notification-on-publish for a self-hosted Notion-to-Vercel blog (NoLog)*
*Researched: 2026-07-24*
