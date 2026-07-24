# Pitfalls Research

**Domain:** Notify-subscribers-on-publish feature (Resend + Vercel Cron + Notion API) for NoLog
**Researched:** 2026-07-24
**Confidence:** MEDIUM-HIGH (official docs for Vercel/Notion behavior are explicit; some Resend Broadcast-specific edge cases are thin in public docs and marked LOW where noted)

This file intentionally excludes pitfalls already caught and fixed/accepted in the prior `/autoplan` pass (fail-open `CRON_SECRET`, timing-unsafe secret comparison, unescaped HTML/URLs in emails, missing per-post error isolation, backfill-before-first-run, the Cusdis fallback-ID leak, and the accepted concurrency/distributed-lock gap). Everything below is new.

## Critical Pitfalls

### Pitfall 1: Wrong Resend product quota gets documented and designed against

**What goes wrong:**
Resend has two separate quota systems that are easy to conflate: the transactional **Send Email API** (`emails.send()`) is capped at **100/day and 3,000/month on the free tier, with each recipient on a single email counted separately**, while the **Broadcast API** (sending to an Audience) is billed differently — **unlimited emails to up to 1,000 contacts/month**. The Key Decisions table already commits to "Resend (Audiences + Broadcast API)," but the Active requirements list still says to document "the Resend free-tier send ceiling (3,000/month, 100/day)" in the README — that number is the *transactional* cap, not the Broadcast cap that actually governs this feature. If the implementation ends up looping `emails.send()` once per subscriber (easy to reach for when writing "one email per new post, per-post error isolation") instead of one `broadcasts.send()` call, the 100/day transactional cap becomes a hard, silent ceiling: once a fork has >100 subscribers, some subscribers stop getting mail with no visible error banner (each individual send failure is swallowed by the per-post error isolation logic, which was designed to isolate *post* failures, not *recipient* failures within a post).

**Why it happens:**
The "Audiences + Broadcast API" decision and the "3,000/month, 100/day" figure both appear in the design docs but were written at different times against different Resend product pages; nobody reconciled which cap actually applies to the code path being built.

**How to avoid:**
- Confirm in the implementation phase that the notify route calls the Broadcast API (create broadcast targeting the Audience, then send) rather than iterating `emails.send()` per contact.
- Correct the README free-tier documentation to state the Broadcast/Audience limit ("unlimited sends to up to 1,000 contacts/month" on Resend's free tier) rather than the transactional Send API number, and note that the 1,000-contact ceiling is what forkers will actually hit as their subscriber list grows.
- If a future change reintroduces per-recipient sends (e.g., personalized unsubscribe links), re-derive which cap applies before shipping.

**Warning signs:**
- Code review shows a `for (subscriber of list) { resend.emails.send(...) }` loop instead of a single `resend.broadcasts.send()` call.
- README/docs cite "3,000/month" anywhere near the word "Audience" or "Broadcast."

**Phase to address:** Implementation phase that builds `/api/notify-subscribers` (verify the Broadcast API is actually used) and the documentation phase (fix the quota text before publishing).

---

### Pitfall 2: Domain verification is a hard prerequisite that fails silently as "it just doesn't send"

**What goes wrong:**
Resend requires the sending domain to complete SPF/DKIM DNS verification before *any* email will actually deliver — the API can return success on the send/broadcast call while the message never reaches an inbox, or verification can sit in "Temporary Failure" for up to 72 hours if DNS records are misconfigured. A forker who sets `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` and expects the feature to "just work" (per the Cusdis-style off-by-default pattern this repo relies on) may configure the vars, see the subscribe form appear, submit a test subscription successfully, publish a post, get no obvious error from the notify cron — and simply never receive the email, with no signal pointing at "your domain isn't verified yet."

**Why it happens:**
The env-var-gated pattern this repo uses elsewhere (Cusdis) only requires *setting a value* to activate the feature; Resend additionally requires an *out-of-band DNS step* that has nothing to do with env vars and can't be validated by the app at runtime without an extra API call.

**How to avoid:**
- Document explicitly in the README (next to the other new env vars) that `RESEND_API_KEY` alone is not sufficient — a verified sending domain in the Resend dashboard is required, with a link to Resend's domain verification docs, and a note that verification can take minutes to 48+ hours.
- Consider having `/api/notify-subscribers` check the send/broadcast API response for delivery-blocking errors (not just network failures) and log a distinguishable message (e.g., "domain not verified") rather than treating it identically to a generic per-post failure.

**Warning signs:**
- Support/issue reports of "I set up everything and no emails arrive, no errors anywhere."
- README doesn't mention DNS/domain verification as a setup step.

**Phase to address:** Documentation phase (README/README_KR update) — call this out as a required setup step, not an optional nicety.

---

### Pitfall 3: Vercel Cron has no retry and can double-fire — the notify route must be safe against both

**What goes wrong:**
Vercel's own docs state cron delivery is best-effort: a failed invocation is **not retried**, and the same scheduled run can **occasionally be invoked more than once**. The existing design already accepts "no distributed lock" as a limitation for *concurrent* requests, but the specific *cron-doubles-the-same-scheduled-run* case is a distinct risk from that: two near-simultaneous invocations of `/api/notify-subscribers` could each independently query "unemailed" posts, both see the same not-yet-marked post, and both broadcast it — sending duplicate emails to every subscriber for one post. Conversely, a missed/dropped invocation (transient network error on Vercel's side, not a bug in your code) means "once/day" isn't a guarantee; a day can simply be skipped with no log entry at all on your side.

**Why it happens:**
Developers read "Cron Jobs run once daily" and assume "exactly once." Vercel's docs are explicit that cron is delivery-best-effort and recommend idempotent, reconciliation-based designs plus locking — but a single-server lock isn't available here per the "no new infrastructure" constraint, so the *practical* mitigation has to live in the write-then-check-before-send order, not in a lock.

**How to avoid:**
- Order operations so the PATCH that marks a post `Emailed` happens *before* (or atomically as close as possible to) the send call, not after — if send fails after mark, that's an acceptable "missed email" failure mode; if mark fails after send succeeds, that's a duplicate-email failure mode. Given no distributed lock, treat "duplicate email to all subscribers for one post" as the worse outcome and bias toward marking-then-sending, accepting that a crash between mark and send means a post silently never emails (already partially mitigated by per-post isolation and the fact this is a low-stakes, once-daily batch).
- Because there's no retry, don't rely on Vercel to catch a dropped invocation — if "day N's cron never fired" is a real risk the team cares about, the `getUnemailedPublicPosts()` query already provides natural self-healing (next successful run picks up anything still unmarked), so no extra retry logic is needed as long as posts are marked as a durable Notion property rather than in-memory state.
- Do not add any assumption elsewhere in the code that "notify runs exactly once per calendar day."

**Warning signs:**
- Subscribers report receiving the same post notification twice.
- A day appears to be silently skipped in Vercel's cron invocation logs with no corresponding function log.

**Phase to address:** Implementation phase for `/api/notify-subscribers` — decide and document the mark-vs-send ordering tradeoff explicitly; this is a design choice, not a bug to "fix."

---

### Pitfall 4: Cron only fires on Production deployments, in UTC — easy to "test" against the wrong environment or wrong time

**What goes wrong:**
Vercel cron jobs execute **only against Production deployments**; Preview/branch deployments are silently ignored, and schedules are always evaluated in **UTC with no timezone/DST support**, defined in `vercel.json` and requiring a redeploy to change. A forker (or the template's own CI) testing the feature on a preview URL will see the cron simply never fire and may conclude the feature is broken, when in fact cron doesn't run there at all. Similarly, "once/day" schedules picked without converting to UTC can land at an unintuitive local time for non-UTC forkers.

**Why it happens:**
This is undocumented-by-omission in most cron tutorials; the assumption "it's just an HTTP endpoint, I can curl it or preview-deploy and see it fire" doesn't hold for Vercel Cron specifically.

**How to avoid:**
- Document in the README that the cron only runs after the project is promoted to Production on Vercel, and that manual testing of the route (via the `CRON_SECRET`-authenticated request) must be done by calling the deployed Production URL directly rather than waiting on/deploying to a preview branch.
- State the cron schedule in the README in both UTC and note that it's not adjustable per-forker's timezone without editing `vercel.json`.

**Warning signs:**
- "The cron never runs" issues that turn out to be testing on a preview deployment.
- Confusion about "why did my post from last night email out at a weird time."

**Phase to address:** Documentation phase and the `vercel.json` cron-entry phase — call out Production-only execution and UTC scheduling directly next to the cron config.

---

### Pitfall 5: Existing forks' Notion integration may lack "Update content" capability — PATCH fails with 403, not a soft failure

**What goes wrong:**
Notion's API requires the integration connection to have explicit **"Update content" capability** granted in the Notion integration's Developer Portal settings; without it, `pages.update` (the PATCH call `markEmailed(pageId)` depends on) returns a **403 `restricted_resource`** error, distinct from an auth or rate-limit failure. Every existing NoLog fork's Notion integration was set up only to *read* posts — there was never a reason to grant write/update capability before this feature existed. When a forker upgrades to pull in the email feature, the integration silently retains read-only capability unless the forker separately visits the Notion Developer Portal and adds "Update content" — a step with zero connection to setting env vars, meaning the existing "off-by-default via env vars" mental model does not cover this dependency at all. The result: the notify route's write path 403s on every single run, `markEmailed` never succeeds, and (combined with Pitfall 3's mark-before-send ordering recommendation) posts could get correctly emailed once but then attempted again every day forever since the checkbox never gets set — i.e., this failure mode directly causes a duplicate-email storm, not just a silent no-op.

**Why it happens:**
Capability grants live in the Notion integration configuration (a workspace-level admin setting), completely outside this repo's env vars, and are invisible unless someone explicitly reads Notion's integration settings UI.

**How to avoid:**
- Document as a required, explicit setup step (separate line item from "set env vars") in the README: "In your Notion integration's configuration, under Capabilities, enable 'Update content' in addition to the read capability you already granted." Put this immediately next to instructions for the new `Emailed` checkbox property.
- In `markEmailed()`, catch a 403 specifically and log/surface a distinguishable message ("Notion integration lacks Update content capability — see README") rather than letting it fall into generic per-post error isolation, since this failure mode recurs identically on every run rather than being a one-off transient error.

**Warning signs:**
- Same post gets emailed to subscribers more than once across consecutive days.
- Logs show 403 `restricted_resource` on every `markEmailed` call.

**Phase to address:** `packages/core` phase that adds `markEmailed()` (add explicit 403 handling/logging) and documentation phase (add the capability-grant step to README/README_KR).

---

### Pitfall 6: Notion write-then-read ordering within the same run is not guaranteed instantaneous-consistent — but the real risk is cross-run, not same-request

**What goes wrong:**
There's no official Notion documentation stating strict read-your-writes consistency guarantees for `pages.update` immediately followed by a `databases.query`/data source query filtered on that same property. In practice, developer reports (Notion community/Retool threads) about "PATCH returned 200 but the query didn't reflect it" have generally traced back to malformed request bodies (e.g., not wrapping `rich_text`/`checkbox` values correctly) rather than genuine server-side staleness — but this is not the same as an official consistency SLA, and Notion's own rate-limit docs describe the API as generally "eventually consistent" in spirit (bursts tolerated, no hard synchronous guarantee documented). For this feature specifically, the practical risk window is not "read directly after write in the same function call" (the design already writes `Emailed` per-post right after sending, not in a tight read-write loop within the same request) — it's the **cross-run race** already flagged as an accepted limitation (two overlapping cron invocations both reading "unemailed" before either write lands). The additional, not-yet-called-out risk: if the checkbox PATCH call itself fails validation silently (e.g., wrong property shape sent to a `checkbox` type vs. expecting a `rich_text`-style array), the symptom looks identical to "consistency lag" — same post keeps reappearing as unemailed — which will misdirect debugging toward "Notion is slow to sync" instead of the actual bug (malformed PATCH body).

**Why it happens:**
Notion's official docs don't publish a consistency SLA for query-after-write, so teams default to either assuming instant consistency (usually true in practice) or over-engineering retry/backoff for a problem that's actually a request-shape bug.

**How to avoid:**
- When implementing `markEmailed(pageId)`, verify the exact PATCH body shape for a `checkbox` property against Notion's current API reference before writing it (checkbox properties expect `{ "Emailed": { "checkbox": true } }`, not a bare boolean) and add a test/manual check that a subsequent `getUnemailedPublicPosts()` call genuinely excludes the just-marked page before considering the feature done.
- Don't add speculative retry/backoff logic for "eventual consistency" without first confirming (via a manual test in the actual target Notion workspace) that a genuine lag exists — treat repeated "unemailed" reappearance as a body-shape bug first, a consistency issue second.

**Warning signs:**
- A specific post keeps reappearing in `getUnemailedPublicPosts()` results across multiple cron runs despite `markEmailed` reporting success (200) each time.
- No 403/429 errors logged, ruling out capability/rate-limit causes — points toward a malformed property update body.

**Phase to address:** `packages/core` phase implementing `markEmailed()`/`getUnemailedPublicPosts()` — add a manual verification step (call mark, then immediately re-query, confirm exclusion) as part of that phase's acceptance criteria.

---

### Pitfall 7: Notion's ~3 req/s average rate limit interacts badly with the batch-write pattern, especially during backfill

**What goes wrong:**
Notion enforces an **average of ~3 requests/second per integration** (bursts tolerated, sustained excess throttled with 429 + `Retry-After`). The one-time backfill script (marking the entire pre-existing back catalog as `Emailed` before the first cron run) is exactly the workload most likely to burst past this: a fork with hundreds of historical posts issuing one PATCH per post in a tight loop will hit 429s partway through, and if the backfill script doesn't handle 429/`Retry-After` itself, it can exit early having marked only some posts — which, combined with "backfill exists specifically to prevent blasting the back catalog," could paradoxically leave a subset of old posts unmarked and cause them to be picked up and emailed by the very first production cron run (the exact failure the backfill step was built to prevent).

**Why it happens:**
Rate limits are easy to overlook for a "one-time backfill script" mentally categorized as a low-risk, run-once operation, but it's precisely the highest-volume write burst this feature will ever produce.

**How to avoid:**
- The backfill script must respect `Retry-After` on 429 responses and/or throttle itself to well under 3 req/s (e.g., serialize requests with a small delay, or batch with exponential backoff) rather than firing all PATCH calls concurrently.
- The backfill script should be idempotent and resumable (safe to re-run if interrupted partway) — check-before-write per post so a second run doesn't double-count or fail on already-marked posts, and log a final count of "N posts marked / M posts failed" so an interrupted run is visible rather than silently partial.

**Warning signs:**
- Backfill script completes "successfully" but the first production cron run still emails a batch of unexpectedly old posts.
- 429 responses appear in backfill logs.

**Phase to address:** The backfill-script phase explicitly called out in Active requirements — add rate-limit-aware throttling and resumability as acceptance criteria, not just "runs once before first cron."

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Looping `emails.send()` per subscriber instead of one `broadcasts.send()` call | Simpler per-recipient error handling, matches "per-post isolation" mental model | Hits the 100/day transactional cap fast; each subscriber is billed against the wrong quota entirely | Never for this feature — Broadcast API is the already-approved decision; don't let implementation drift back to per-recipient loops |
| No 403-specific handling in `markEmailed()` (treat all write failures identically) | Less code in v1 | 403 (missing Notion capability) recurs on every run and silently causes duplicate-email storms rather than a one-off error | Acceptable only if the README setup step for "Update content" capability is unmissable and tested against a fresh fork |
| Backfill script fires all PATCH requests with no throttling | Fastest to write, "it's a one-time script" | Partial completion under Notion's rate limit defeats the backfill's entire purpose | Never — this is the single highest-volume write burst the feature produces |
| Treating Vercel Cron's "once/day" as a delivery guarantee (no idempotency check on skip) | Simpler mental model | A dropped invocation silently skips a day with zero visibility; a doubled invocation double-emails | Acceptable to skip *retry* logic (Vercel doesn't support it anyway) but never acceptable to skip idempotency (mark-before/after-send ordering) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Resend (Broadcasts) | Assuming the transactional 100/day cap applies to Audience-based sends | Confirm and document the Broadcast/Audience quota (unlimited sends to up to 1,000 contacts/month on free tier) separately from the transactional Send API cap |
| Resend (domain) | Treating a successful send/broadcast API response as proof of delivery | Document domain verification (SPF/DKIM, up to 48-72h propagation) as a mandatory setup step distinct from setting `RESEND_API_KEY` |
| Resend (Audiences) | Re-adding a previously unsubscribed contact via `create` can silently recreate them as unsubscribed rather than resubscribing (known SDK behavior gap, see `resend/resend-node#458`) | If `/api/subscribe` needs to support "resubscribe after unsubscribe," explicitly test this path against the real API/SDK version in use rather than assuming a plain create call resubscribes |
| Vercel Cron | Testing the notify route against a Preview deployment and concluding the feature is broken when cron simply never fires there | Document Production-only cron execution; test by calling the deployed Production URL with the `CRON_SECRET` header directly |
| Vercel Cron | Assuming failed invocations retry | Design the route to be safely re-run daily even after a missed day (natural side effect of the "unemailed posts" query already being reconciliation-based) |
| Notion (capabilities) | Assuming an existing read-only integration automatically gains write capability once `markEmailed` code ships | Document the explicit Developer Portal step to enable "Update content" capability, separate from env-var setup |
| Notion (rate limit) | Firing a batch PATCH backfill with no throttling | Throttle to ~3 req/s or below, honor `Retry-After` on 429, make the script resumable/idempotent |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Backfill script running all writes concurrently (`Promise.all` over every historical post) | 429s from Notion partway through; incomplete marking | Serialize/throttle writes with delay or small concurrency limit, respect `Retry-After` | Any fork with more than roughly a few dozen historical posts, given ~3 req/s sustained average |
| Notify route doing multiple sequential Notion API calls (query unemailed + per-post mark) inside Vercel's 10s Hobby function budget | Function times out mid-batch if enough new posts accumulated between cron runs (e.g., after a missed day per Pitfall 3) | Cap the number of posts processed per invocation; if more remain, they'll be picked up the following day since the query is always "still unemailed" | Once accumulated unemailed posts + Notion round-trip latency pushes total request time near 10s — realistic if a fork misses a cron day or two and then publishes several posts before the next run |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Documenting the wrong Resend quota tier in public README | Forkers under-provision or over-provision expectations; not itself a security bug but a trust/credibility issue for an open-source template | Verify quota numbers against the actual API being called (Broadcast vs transactional) before publishing |
| No distinguishable logging for Notion 403 (`restricted_resource`) vs generic Notion errors in `markEmailed` | A permissions misconfiguration masquerades as "flaky Notion API," delaying detection of a bug that causes duplicate-email spam to every subscriber | Log/handle 403 specifically with an actionable message pointing at the Developer Portal capability setting |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| No feedback path for "domain not verified yet" | Forker configures everything, sees no errors, subscribers never receive email, gives up | Add a distinguishable log line (not necessarily user-facing UI, but at minimum a clear server log) when Resend indicates delivery-blocking domain issues |
| README doesn't distinguish "set env vars" from "grant Notion capability" as two separate setup actions | Forker completes the env-var checklist, believes feature is fully configured, then hits silent 403s in production | Structure README setup steps as an ordered checklist that explicitly separates env vars, Notion property creation, and Notion integration capability grant |

## "Looks Done But Isn't" Checklist

- [ ] **Notify route uses Broadcast API, not a per-subscriber send loop** — verify by reading the actual `resend.*` call in `/api/notify-subscribers`, not just the design doc.
- [ ] **README documents the Broadcast/Audience quota (contacts-based), not the transactional 100/day figure** — verify by re-reading the published README against Resend's current docs at ship time (limits can change).
- [ ] **README documents domain verification as a mandatory step** — verify a fresh fork's README walkthrough includes DNS setup before "you're done."
- [ ] **README documents granting "Update content" Notion capability as an explicit, separate step from env vars** — verify by testing against a Notion integration created before this feature existed (read-only) and confirming the PATCH 403s until the capability is added, then confirming the fix works.
- [ ] **Backfill script throttles/handles 429 and is safely re-runnable** — verify by checking for a delay/backoff mechanism and a check-before-write per post, not just "loops over all posts."
- [ ] **`markEmailed` distinguishes 403 from other failures in logs** — verify by reading the catch block, not assuming generic error handling covers it adequately.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Duplicate email sent to all subscribers (overlapping cron + missing capability, or mark-after-send crash) | LOW | No infra to roll back; note it in a project changelog/known-issues if it happens, fix the ordering/capability bug, no data corruption since Notion remains source of truth |
| Backfill partially completed due to rate limiting | LOW | Re-run the (idempotent, check-before-write) backfill script; already-marked posts are skipped safely |
| Wrong quota documented in README | LOW | Edit README, no code change needed |
| Forker's integration missing Update content capability discovered in production | LOW | One-time manual step in Notion Developer Portal; no code deploy required |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Wrong Resend quota / send-loop vs Broadcast API | `/api/notify-subscribers` implementation + docs phase | Code review confirms `broadcasts.send()` usage; README quota text matches Resend's current Broadcast/Audience docs |
| Domain verification silent failure | Documentation phase | README includes DNS/domain-verification step before "you're done" |
| Cron no-retry / possible double-fire | `/api/notify-subscribers` implementation phase | Explicit written decision on mark-vs-send ordering; test by manually invoking the route twice in immediate succession and confirming no duplicate broadcast |
| Cron Production-only / UTC-only | `vercel.json` + docs phase | README states Production-only execution and UTC schedule explicitly |
| Missing Notion "Update content" capability (403) | `packages/core` `markEmailed()` phase + docs phase | Test against a read-only integration first (expect 403), then confirm the documented capability-grant step resolves it; code has distinguishable 403 logging |
| Query-after-write property shape bug mistaken for consistency lag | `packages/core` `markEmailed()`/`getUnemailedPublicPosts()` phase | Manual test: mark a post, immediately re-query, confirm exclusion, before considering the phase done |
| Backfill rate-limit burst | Backfill script phase | Script includes throttling/backoff and is demonstrated resumable (kill mid-run, re-run, confirm completion without duplication or omission) |

## Sources

- [Managing Domains - Resend](https://resend.com/docs/dashboard/domains/introduction)
- [Usage Limits / Rate Limit - Resend](https://resend.com/docs/api-reference/rate-limit)
- [Resend account quotas and limits](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- [Manage subscribers with Resend Audiences](https://resend.com/blog/manage-subscribers-using-resend-audiences)
- [Send Broadcast API reference - Resend](https://resend.com/docs/api-reference/broadcasts/send-broadcast)
- [Broadcast API announcement - Resend](https://resend.com/blog/broadcast-api)
- [Bug: Programmatically creating a subscribed contact leads to an unsubscribed contact — resend/resend-node#458](https://github.com/resend/resend-node/issues/458)
- [Verify Webhooks Requests - Resend](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests)
- [Cron Jobs - Vercel Docs](https://vercel.com/docs/cron-jobs)
- [Managing Cron Jobs - Vercel Docs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Troubleshooting Vercel Cron Jobs - Vercel Knowledge Base](https://vercel.com/kb/guide/troubleshooting-vercel-cron-jobs)
- [Best Practices Learned from Production Use of Vercel Cron](https://zenn.dev/asoventure/articles/2026-06-28-vercel-cron-best-practices?locale=en)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
- [What can I do about Vercel Functions timing out? - Vercel Knowledge Base](https://vercel.com/kb/guide/what-can-i-do-about-vercel-serverless-functions-timing-out)
- [Notion API request limits](https://developers.notion.com/reference/request-limits)
- [Notion API rate limits are breaking your automation](https://dev.to/kanta13jp1/notion-api-rate-limits-are-breaking-your-automation-heres-the-real-fix-o5p)
- [Update a page's properties - 403 restricted_resource capability requirement (via search aggregation)](https://developers.notion.com/reference/update-page-markdown)
- [Notion connections / capabilities - Notion Help Center](https://www.notion.com/help/create-integrations-with-the-notion-api)
- [Notion API page doesn't Update even if REST query has 200 response - Retool Forum](https://community.retool.com/t/notion-api-page-doesnt-update-even-if-rest-query-has-200-response/21252)

---
*Pitfalls research for: NoLog email-subscription-on-publish feature (Resend + Vercel Cron + Notion API)*
*Researched: 2026-07-24*
