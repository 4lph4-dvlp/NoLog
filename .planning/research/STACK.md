# Stack Research

**Domain:** Email-on-publish notification feature (Resend + Vercel Cron) for an existing Notion-to-Vercel blog template
**Researched:** 2026-07-24
**Confidence:** MEDIUM-HIGH (primary sources are Vercel's and Resend's own docs, fetched and cross-checked directly; a few community/blog sources used only for corroboration, flagged where relied upon)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `resend` (npm) | `^6.18.0` (latest as of 2026-07-21; pin to `^6.x`, do not float `latest`) | Node/TS SDK for sending transactional emails and managing Audience contacts | Official first-party SDK, actively maintained (multiple releases per month through July 2026), typed, small surface area (`resend.emails.send`, `resend.contacts.create`, `resend.audiences.*`, `resend.broadcasts.*`). No meaningful competing SDK for Resend's own API. |
| Vercel Cron (`vercel.json` `crons` array) | N/A (platform feature, not a package) | Scheduled trigger for `/api/notify-subscribers` once/day | Zero new infrastructure — it's the trigger PROJECT.md already locked in. No polling service, no external scheduler needed. Confirmed still current in Vercel's 2026-06-16-dated docs. |
| Node.js built-in `crypto.timingSafeEqual` | Built into Node.js runtime (no install) | Constant-time comparison of `CRON_SECRET` against the incoming `Authorization` header | Avoids a timing side-channel on the one secret-comparison this feature needs. Zero-dependency, already available in the Node.js serverless runtime Vercel functions run on (not the Edge runtime — see Version Compatibility below). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None additional required | — | — | This feature needs no new dependencies beyond `resend`. Honeypot field for the subscribe form and email HTML templating are trivial enough to hand-roll (a plain `<input>` styled `display:none` + a template string / JSX-to-string for the email body) — do not add `react-email` or a form library for this scope. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `resend` CLI test mode / `delivered@resend.dev` test address | Verify `emails.send` wiring without spending real send quota | Resend's docs use `delivered@resend.dev` as a safe test recipient in all examples — use it in local/dev testing before wiring a real subscriber flow. |
| Vercel CLI (`vercel dev` is **not** sufficient for cron) | Local testing of the cron route | Vercel explicitly states there is **no support for `vercel dev`, `next dev`, or other framework-native dev servers running cron on a schedule.** Test the route locally by just hitting the URL directly (e.g. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/notify-subscribers`); rely on Vercel's own cron trigger only in deployed environments. |

## Installation

```bash
# Core
npm install resend

# No dev dependencies needed for this feature specifically
```

Add to `apps/web/package.json` (or wherever the API routes live in the monorepo) — `resend` has zero peer dependencies of concern for a Next.js 16 / React 19 project.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Resend `contacts.create` + `broadcasts` for the subscriber list/send | Resend `emails.send` in a loop over subscriber emails (skip Audiences/Broadcasts entirely) | If you want to avoid the Audiences data model altogether (e.g., you're already storing subscriber emails somewhere else, like a Notion database). Trade-off: you lose Resend's built-in unsubscribe handling and CAN-SPAM-required unsubscribe link, and you must manage per-day/per-request throttling yourself against the 100/day Hobby-tier-adjacent free-plan cap. **Not recommended** here since PROJECT.md already locked in Audiences as the contact store — but noting it because a plain "loop over `emails.send`" is the wrong first instinct people have when they think "just send emails," and it silently drops CAN-SPAM compliance (no unsubscribe link) unless hand-added. |
| Node's built-in `crypto.timingSafeEqual` | `npm install safe-compare` (or similar micro-packages like `string-timing-safe-equal`) | If you want a one-liner that already handles the "buffers must be equal length" footgun (see Pitfall below) without writing the wrapper yourself. Given this is a single call site in one route handler, hand-rolling a 5-line wrapper (below) is preferable to adding a dependency for one function. |
| Vercel Cron (`vercel.json`) | Notion database automation webhook (Notion-side, paid-plan-gated) | Already correctly deferred per PROJECT.md — only relevant for forkers on a paid Notion plan who want near-instant (vs. once/day) notification latency. Document as an optional fast-path, do not build this pass. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `authHeader === \`Bearer ${cronSecret}\`` (naive `===` string compare) | This is literally the code sample shown in Vercel's own docs (`manage-cron-jobs`), but naive string equality is not constant-time in V8 — it short-circuits on the first mismatched byte, theoretically leaking timing information about how many leading characters matched. For a single low-value internal endpoint the practical risk is low, but the project's own recurring theme this session is "fail-closed, not fail-open" and this is a one-line fix. | `crypto.timingSafeEqual` on same-length buffers, with a length-check guard that does NOT early-return on mismatch in a way that leaks length (see Pitfall/pattern below). |
| Any Edge Runtime declaration (`export const runtime = 'edge'`) on `/api/notify-subscribers` | Node's `crypto.timingSafeEqual` and full `node:crypto` are not guaranteed available in the Edge runtime the same way as Node.js serverless functions (Edge runtime is a restricted, browser-like/V8-isolate runtime; `node:crypto` support there is limited and version-dependent — the existing `/api/og` route deliberately opts INTO edge for image generation, but that's a different tradeoff). Since the notify route needs full `node:crypto`, `resend` (which itself expects a Node-like `fetch`/`Buffer` environment), and no latency-critical edge requirement, default (Node.js) runtime is correct — simply omit the `runtime` export. | Default (Node.js) serverless runtime — this is already what the rest of the app's non-OG API routes use implicitly. |
| Vercel's Hobby cron limit of "2 jobs" (a figure that shows up in several older/community blog posts, e.g. from `runhooks.app`) | **Stale/outdated** — Vercel's current (2026-06-16-dated) official docs state Hobby is **100 cron jobs per project**, same as Pro/Enterprise; the Hobby-specific restrictions are (1) minimum interval of once/day and (2) reduced scheduling precision (±59 min instead of per-minute). This project only needs 1 cron entry so the job-count limit doesn't bind either way, but don't let this stale "2 jobs" figure leak into documentation for forkers. | Cite the once/day + ±59min precision limits only; don't mention a job-count ceiling since 100 is generous and non-binding. |
| A distributed lock (Redis/Vercel KV) to fully solve cron concurrent-invocation races | Explicitly out of scope per PROJECT.md ("no new infrastructure"), and Vercel's own docs confirm this is the textbook fix — but it requires new infra you've already ruled out. | Idempotent design instead: the `Emailed` checkbox property on each Notion page IS the idempotency marker Vercel's own docs recommend ("check state before making changes... e.g. if not already active, then activate"). As long as `markEmailed(pageId)` happens per-post immediately after a successful send (not batched at the end), a rare double-invocation just redundantly checks the same posts and finds them already marked — safe by construction, no lock needed. This validates the existing design decision in PROJECT.md; call it out explicitly in the phase plan as *why* per-post marking (not end-of-batch marking) is the correct order of operations. |

## Stack Patterns by Variant

**If sending the actual notification email (transactional, one-to-one per subscriber):**
- Use `resend.emails.send()` (not `broadcasts.send()`) if you loop per-subscriber, OR `resend.broadcasts.create()` + `resend.broadcasts.send()` if you send once to the whole Audience.
- Because: `emails.send()` is subject to the same 100/day, 3,000/month caps but gives you full per-recipient control (e.g., easy to skip a subscriber who already unsubscribed by checking Audience state first). `broadcasts` is purpose-built for "send one email to an Audience" and handles Resend's own unsubscribe/list-management plumbing (including the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag) for you — **this is very likely the better fit for this feature** since the design doc describes "one email per published post, to the whole subscriber list," which is exactly the Broadcast API's use case, not a transactional per-user email. Recommend `broadcasts.create()` + `broadcasts.send()` targeting the single configured `RESEND_AUDIENCE_ID`, over hand-looping `emails.send()`.

**If adding a new subscriber (the `/api/subscribe` route):**
- Use `resend.contacts.create({ email, audienceId, unsubscribed: false })`.
- Because: this is the documented, idempotent-by-design way to add to an Audience (Resend's docs describe an "upsert or skip existing" choice on create) — matches the PROJECT.md requirement "idempotent on duplicate submission" with zero custom de-dup logic needed.

**If verifying the cron secret:**
- Use a small wrapper around `crypto.timingSafeEqual`, not a bare `===`.
- Because: `crypto.timingSafeEqual` throws (rather than returning `false`) if the two buffers differ in length, and naively catching that and returning `false` immediately reintroduces a timing side-channel that leaks secret length. The correct minimal pattern:

```typescript
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Always do a full-cost comparison, even on length mismatch,
  // so the response time doesn't leak the secret's length.
  if (bufA.length !== bufB.length) {
    // Compare bufA against itself (always true) to burn equivalent time,
    // then force the overall result to false.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET;

  // Fail CLOSED: no secret configured = no access, ever.
  if (!cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return new Response("Unauthorized", { status: 401 });
  }
  // ... proceed
}
```

This is a straightforward extension of Vercel's own documented pattern (`if (!cronSecret || authHeader !== \`Bearer ${cronSecret}\`)`), swapping the naive `!==` for the constant-time `!safeCompare(...)`, while preserving Vercel's exact fail-closed structure (missing secret = 401, matches PROJECT.md's "fail-closed on missing CRON_SECRET" requirement verbatim).

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `resend@6.18.0` | Node.js 18+ (any Node LTS Vercel's Node.js runtime uses), Next.js 16 App Router route handlers | No React/Next-version coupling; it's a plain HTTP client wrapper around `fetch`, so it works identically in any Next.js route handler regardless of React 19 vs earlier. |
| `crypto.timingSafeEqual` | Node.js serverless runtime only (default Next.js API route runtime) | Do **not** add `export const runtime = "edge"` to `/api/notify-subscribers` or `/api/subscribe` — full `node:crypto` support in Vercel's Edge runtime is inconsistent/limited compared to the default Node.js runtime, and there is no latency reason to opt into edge for a once-a-day cron-triggered route. This differs from the existing `/api/og` route, which correctly uses edge for a different reason (fast, globally-distributed image generation on user-facing requests) — do not copy that pattern here. |
| Vercel Cron `crons` array in `vercel.json` | Any Next.js App Router route handler that exports a `GET` function | Vercel invokes cron jobs with an HTTP `GET` to the configured `path` — the route handler must export `GET` (not `POST`), and cannot rely on a request body since cron invocations carry none. |
| Vercel Cron on Hobby | Once-per-day cron expressions only | Any expression Vercel calculates as running more than once/day will **fail at deploy time**, not silently misbehave — this is a hard deploy-time validation, not a runtime surprise, which is good: a forker who accidentally sets `0 * * * *` gets an immediate, loud deploy failure rather than a silent throttling. Document this clearly for forkers so a bad cron expression in `vercel.json` doesn't confuse them at deploy time. |

## Notable Gotchas for This Feature Specifically

1. **Vercel Hobby cron timing is imprecise by design (±59 minutes).** A `0 8 * * *` expression can fire anywhere from 08:00:00 to 08:59:59 UTC, and the timezone is *always* UTC (not configurable). This is fine for a "check for newly-published posts once a day" feature, but should be documented for forkers who might expect exact-time delivery.

2. **Vercel cron delivery is best-effort, not guaranteed exactly-once.** Vercel's docs explicitly warn crons can be skipped (transient network errors — no invocation, no log) or double-invoked, and instruct designing for idempotent/reconciliation-based logic. This directly validates the PROJECT.md design of `getUnemailedPublicPosts()` + per-post `markEmailed(pageId)`: a missed day just means the next day's run catches up on unsent posts (reconciliation), and a duplicate invocation is a no-op because already-marked posts are filtered out (idempotency). No additional design change needed here — just confirms the existing plan is exactly the pattern Vercel recommends.

3. **Vercel does not retry failed cron invocations.** If `/api/notify-subscribers` throws unhandled, that day's run is simply lost (visible only in logs) — reinforces the PROJECT.md requirement for "per-post error isolation (one failure doesn't block the batch)": wrap each post's send+mark in its own try/catch inside the batch loop so one bad post doesn't abort the whole run and lose every other post's notification for that invocation.

4. **`crons` route handlers only receive GET, with no body** — don't design `/api/notify-subscribers` expecting a POST payload; all context must come from the Notion query itself, not the cron invocation.

5. **Resend's Broadcast API supports merge-tag personalization** (`{{{FIRST_NAME|fallback}}}`, `{{{EMAIL}}}`, `{{{RESEND_UNSUBSCRIBE_URL}}}`) — the unsubscribe merge tag in particular should be included in the email template regardless of minimal-scope constraints, since Resend needs it present for its own compliance/unsubscribe-link handling on Broadcasts (distinct from PROJECT.md's explicitly out-of-scope "preference center" — this is just the required unsubscribe link, not a preference UI).

6. **No official Resend Node SDK breaking changes were found in the 2025–2026 release history** searched (v6.12.4 through v6.18.0, ~May–July 2026) — releases in this window were additive (suppression-list management, OAuth grants, idempotency keys for forwarding, `ContactImports`). One community post (`dev.to/nathanhamlett`) references breaking changes in an old **v1.0.1**, from years prior to the current v6.x line — not relevant to a fresh `npm install resend` today, flagging only so it isn't confused with anything current.

## Sources

- https://vercel.com/docs/cron-jobs (fetched directly, dated 2026-06-16) — cron expression format, `vercel-cron/1.0` user agent, `x-vercel-cron-schedule` header — HIGH (official first-party docs, directly fetched)
- https://vercel.com/docs/cron-jobs/manage-cron-jobs (fetched directly, dated 2026-06-02) — CRON_SECRET auth code sample, concurrency/idempotency guidance, error handling, redirect behavior, local-dev limitations — HIGH (official first-party docs, directly fetched)
- https://vercel.com/docs/cron-jobs/usage-and-pricing (fetched directly, dated 2026-06-16) — authoritative Hobby/Pro/Enterprise limits table (100 jobs/project, once-per-day minimum on Hobby, ±59min precision) — HIGH, and this specifically **supersedes** the stale "2 jobs" figure found in older community blog posts during the same research pass
- https://resend.com/docs/api-reference/contacts/create-contact (fetched directly) — `resend.contacts.create()` signature and response shape — HIGH (official first-party docs)
- https://resend.com/docs/api-reference/emails/send-email (fetched directly) — `resend.emails.send()` signature, response shape, `delivered@resend.dev` test address — HIGH (official first-party docs)
- https://github.com/resend/resend-node/releases (fetched directly) — version history v6.12.4 → v6.18.0, no breaking changes in this window — HIGH (official repo)
- https://resend.com/blog/broadcast-api and https://resend.com/features/broadcasts (web search) — Broadcast API merge-tag personalization, unsubscribe merge tag — MEDIUM (Resend's own blog/marketing pages, not API reference docs, but first-party)
- WebSearch results on Node.js `crypto.timingSafeEqual` (multiple sources: GeeksforGeeks, runebook.dev, w3schools) — buffer-length-mismatch throw behavior — MEDIUM (cross-checked across independent sources, consistent)
- WebSearch on timing-safe-equal length-leak mitigation pattern (Simon Willison TIL, Cloudflare Workers docs, `safe-compare` npm package docs) — constant-time-regardless-of-length pattern — MEDIUM (cross-checked across independent sources, consistent; this specific "compare against self on mismatch" pattern is a known idiom, not this researcher's invention)
- dev.to/nathanhamlett Resend SDK v1.0.1 breaking-changes post — LOW confidence, and explicitly not applicable to current v6.x (noted only to disambiguate)

---
*Stack research for: NoLog email-subscription-on-publish feature*
*Researched: 2026-07-24*
