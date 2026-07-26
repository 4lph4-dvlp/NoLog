# Phase 4: Notify Route - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 4-Notify Route
**Areas discussed:** Digest structure & subject line, CAN-SPAM address configuration, Batch overflow policy, CRON_SECRET failure response

---

## Digest structure & subject line

| Option | Description | Selected |
|--------|-------------|----------|
| Oldest-first | Matches the existing query sort in ARCHITECTURE.md's example filter | ✓ |
| Newest-first | Typical newsletter convention, most recent first | |
| You decide | | |

**User's choice:** Oldest-first
**Notes:** Chosen because it keeps display order identical to the query's own sort order (created_time ascending), avoiding any extra sort logic.

| Option | Description | Selected |
|--------|-------------|----------|
| Count-based generic phrase | e.g. "N new posts on [site.title]" — works for 1 or many posts | ✓ |
| Show post title when exactly one post | More specific for single-post runs, needs branching logic | |
| You decide | | |

**User's choice:** Count-based generic phrase

| Option | Description | Selected |
|--------|-------------|----------|
| Raw Notion-uploaded thumbnail | post.thumbnail S3 URL directly via <img src>, no /api/og round-trip | ✓ |
| /api/og generated branded card | Consistent branded image via title+category, but not the real post image | |
| You decide | | |

**User's choice:** Raw Notion-uploaded thumbnail

| Option | Description | Selected |
|--------|-------------|----------|
| No intro line | Straight into post sections, matches "plain digest" constraint | ✓ |
| Short one-line intro | e.g. "Here's what's new on [site]:" | |
| You decide | | |

**User's choice:** No intro line

**Follow-up:** Fallback when a post has no thumbnail set.

| Option | Description | Selected |
|--------|-------------|----------|
| Text-only, no image | Cleaner than a broken image icon or empty box | ✓ |
| Fall back to site-wide default image/logo | Visually consistent but needs a new config value | |
| You decide | | |

**User's choice:** Text-only, no image

---

## CAN-SPAM address configuration

| Option | Description | Selected |
|--------|-------------|----------|
| site.config.ts new field | Matches profile/sns pattern — public info, not a secret | ✓ |
| New env var (e.g. MAILING_ADDRESS) | Matches RESEND_API_KEY-style pattern | |
| You decide | | |

**User's choice:** site.config.ts new field

| Option | Description | Selected |
|--------|-------------|----------|
| Short direct one-line | e.g. "You're receiving this because you subscribed..." | ✓ |
| Include subscription date/email | More detail, but redundant with the recipient's own inbox context | |
| You decide | | |

**User's choice:** Short direct one-line

| Option | Description | Selected |
|--------|-------------|----------|
| Rely on Resend automatic handling only | Per NOTIFY-03's "unsubscribe handling... automatic" claim | ✓ |
| Also add an explicit link in the body | Belt-and-suspenders, but may duplicate Resend's own mechanism | |
| You decide | | |

**User's choice:** Rely on Resend automatic handling only
**Notes:** Flagged in CONTEXT.md as conditional on research verifying Resend's Broadcast+Audience actually injects a working one-click unsubscribe link — PROJECT.md already names this as a thin-documented area needing live verification.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-closed no-op | Same tier as unconfigured RESEND_API_KEY/RESEND_AUDIENCE_ID | ✓ |
| Send anyway, omit the address line | Risks a CAN-SPAM-noncompliant send | |
| You decide | | |

**User's choice:** Fail-closed no-op

---

## Batch overflow policy

| Option | Description | Selected |
|--------|-------------|----------|
| Cap it | PITFALLS.md flags unbounded processing as a maxDuration risk | ✓ |
| No cap — attempt everything found | Simpler, but risky if many posts accumulate | |
| You decide | | |

**User's choice:** Cap it

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable via env var | maxDuration figure is unconfirmed (10s vs 300s), tunable after Phase 5 verifies it | ✓ |
| Hardcoded constant | Simpler, needs a code change once the real limit is known | |
| You decide | | |

**User's choice:** Configurable via env var

| Option | Description | Selected |
|--------|-------------|----------|
| Post count | Simple, predictable, independent of API latency variance | ✓ |
| Elapsed time (soft timeout) | Adapts to real latency but more complex | |
| You decide | | |

**User's choice:** Post count

| Option | Description | Selected |
|--------|-------------|----------|
| Add a distinguishable log line | Matches the project's repeated operator-visibility pattern (D-22, D-25) | ✓ |
| No log — silently roll to next run | Simpler, but leaves the operator with no signal | |
| You decide | | |

**User's choice:** Add a distinguishable log line

---

## CRON_SECRET failure response

| Option | Description | Selected |
|--------|-------------|----------|
| 401 explicit rejection | Standard REST convention; caller is Vercel infra, not the general public | ✓ |
| 404 hide-existence style | Reuses Phase 3's D-22 pattern, but that pattern's rationale doesn't apply here | |
| You decide | | |

**User's choice:** 401 explicit rejection

| Option | Description | Selected |
|--------|-------------|----------|
| Log it | Unlike Phase 3's honeypot/429 (public, high-frequency), any failed attempt here is inherently suspicious | ✓ |
| Don't log | Treats it like routine noise, which it isn't for this route's trust model | |
| You decide | | |

**User's choice:** Log it

| Option | Description | Selected |
|--------|-------------|----------|
| Failure fact only, no detail | Matches D-24's minimal-logged-detail principle | ✓ |
| Include header presence/IP | More useful for debugging but conflicts with minimal-logging theme | |
| You decide | | |

**User's choice:** Failure fact only, no detail

| Option | Description | Selected |
|--------|-------------|----------|
| Same Authorization: Bearer for manual + cron | No separate backdoor path; operator uses curl with the same header | ✓ |
| Separate manual-testing path (e.g. query param) | Convenience, but widens attack surface | |
| You decide | | |

**User's choice:** Same Authorization: Bearer for manual + cron

---

## Claude's Discretion

- Exact HTML/inline-CSS structure and typography of the digest email beyond the fixed decisions (spacing, whether title is itself a link, font stack)
- Exact copy wording for the subject line and "why you're receiving this" line beyond their fixed shape
- Exact env var name for the batch cap
- HTTP method the route accepts (Vercel Cron default — platform-convention detail)
- Exact `crypto.timingSafeEqual` wrapper mechanism (SEC-01 already locks "timing-safe comparison" as a requirement)
- Log line prefix/format — follow the existing `[Notify] message` bracket-prefix convention

## Deferred Ideas

None — all discussion stayed within Phase 4's notify-route boundary. No scope creep occurred.
