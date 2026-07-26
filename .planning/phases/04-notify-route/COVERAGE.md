# Phase 4 — API Coverage Matrix

**Produced:** 2026-07-27 (plan time)

**External APIs in scope:**

1. **Resend**, via the already-installed `resend@6.18.0` Node SDK, constructed
   through `apps/web/src/lib/email.ts`'s `getResend()` (Phase 3 D-20). This phase
   is the first to touch the **Broadcast** surface.
2. **Notion REST API v1**, reached only through Phase 1's `NologClient`
   (`getUnemailedPublicPosts()` / `markEmailed()`), plus one additive extractor
   this phase adds to the mapper.

`INTEGRATE` is the default; every `OPT-OUT` carries a reason. This matrix is the
subtraction record, not a wish list. Per the coverage gate's second-integration
rule, this phase re-derives the Resend surface from a **full-coverage baseline** —
Phase 3's opt-outs are not carried over silently, and the rows Phase 3 opted out
of "because Phase 4 owns it" are re-decided here on their own merits.

| capability | decision | reason |
|---|---|---|
| `broadcasts.create` | INTEGRATE | The single send call per cron run (NOTIFY-03). Exactly one call site, outside every loop, asserted by a count gate in `04-01-PLAN.md` |
| `broadcasts.create` → `send: true` | INTEGRATE | Verified on `SendBroadcastOnCreationOptions` in the installed SDK types; collapses create+send into one round-trip, halving the failure surface to isolate |
| `broadcasts.create` → `audienceId` | INTEGRATE | Kept over the newer `segmentId`: both work in 6.18.0, and this one matches the already-shipped `RESEND_AUDIENCE_ID` env var, so no forker renames anything mid-milestone |
| `broadcasts.create` → `html` | INTEGRATE | The hand-rolled digest template string. `EmailRenderOptions` requires at least one of `react`/`html`/`text`; `html` is the one this phase supplies |
| `broadcasts.create` → `from` | INTEGRATE | Required by the API. Sourced from the new `CONFIG.notify.fromAddress`, empty by default so an unconfigured fork fails closed (SEC-02, D-09) |
| `broadcasts.create` → `subject` | INTEGRATE | Count-based and generic per D-02, built from the surviving section count and `CONFIG.site.title` |
| `broadcasts.create` `{ data, error }` tuple | INTEGRATE | Drives NOTIFY-05: a truthy `error` means mark nothing and return `send_failed`; only a clean result reaches the mark loop |
| `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag | INTEGRATE | Rendered as a **visible** footer link, closing NOTIFY-02 under either reading of Resend's header behaviour. Revises D-08 under D-08's own must-be-revisited clause |
| Resend automatic Audience unsubscribe / suppression | INTEGRATE | Consumed by sending broadcast-to-Audience at all; the suppression half is confirmed by Resend's docs. The visible link is the belt to that suspenders |
| `broadcasts.send(id)` as a separate call | OPT-OUT | Not needed — `send: true` on `create()` already sends. A second call adds a round-trip and a second failure point for no behavioural gain |
| `broadcasts.create` → `scheduledAt` | OPT-OUT | Not needed. The cron tick IS the schedule; deferring inside Resend adds a second invisible scheduler and makes "did it send?" ambiguous |
| `broadcasts.get` / `broadcasts.list` | OPT-OUT | Not needed — the route sends and returns. Reading state back costs latency inside the duration budget for information nothing branches on |
| `broadcasts.update` | OPT-OUT | Not needed — each run creates a fresh broadcast for that run's posts; nothing is ever edited after creation |
| `broadcasts.remove` | OPT-OUT | Not needed, and deliberately out of reach: this template must never delete a forker's send history |
| `broadcasts.create` → `name` / `previewText` | OPT-OUT | Not needed for v1's plain digest. `REQUIREMENTS.md` caps this at the plain per-post-section format; both are additive later with no data-shape impact |
| `broadcasts.create` → `replyTo` / `topicId` | OPT-OUT | Not needed. A reply-to has no v1 requirement, and a topic model is the substrate for the preference center `REQUIREMENTS.md` puts Out of Scope |
| `broadcasts.create` → `react` render option | OPT-OUT | Not needed. It would pull in `react-email`, explicitly rejected in `04-RESEARCH.md` § Don't Hand-Roll for a single one-layout email |
| `broadcasts.create` → `text` render option | OPT-OUT | Not needed for v1. A plain-text alternative part is a genuine future improvement, but no v1 requirement asks for one |
| Idempotency key on the broadcast create | OPT-OUT | Does not fix the real risk. A cron double-fire is two independent invocations computing separate payloads, so they share no key; closing it needs the Out-of-Scope distributed lock |
| Resend-side 429 / quota handling | OPT-OUT | Not needed at once-per-day volume. A 429 lands in the existing `send_failed` branch, which marks nothing, so the next run retries the identical set by construction |
| `emails.send` (transactional, per recipient) | OPT-OUT | Forbidden, not merely unused. Named as this project's expensive mistake in `PITFALLS.md` Pitfall 1; `04-01-PLAN.md` gates its absence from the route module |
| `emails.get` / delivery-status lookup | OPT-OUT | Not needed — nothing in the route branches on per-recipient delivery outcome; the operator reads the Resend dashboard instead |
| `contacts.create` / `contacts.update` | OPT-OUT | Owned by Phase 3's subscribe route, which this phase must not edit (SC#6 is a regression check). The notify route has no reason to write a contact |
| `contacts.get` / `.list` / `.remove` | OPT-OUT | Not needed — a broadcast targets the Audience as a whole. Staying unable to enumerate also keeps the route incapable of leaking a subscriber list into a log |
| `segments.*` / `audiences.*` lifecycle | OPT-OUT | Not needed — the forker creates the Audience in the dashboard and supplies its id. Creating or deleting one would fight the off-by-default contract |
| `domains.*` (create, verify, list) | OPT-OUT | Not needed — domain, SPF and DKIM verification is a dashboard step documented for forkers in Phase 6 (DOCS-02), never automated by the template |
| `apiKeys.*` | OPT-OUT | Not needed — the forker supplies their own key as an env var; the app never mints, rotates or reads a key back |
| Resend webhooks (delivery, bounce, complaint) | OPT-OUT | Not needed, and costly: a receiver is a second public endpoint with its own auth surface. No v1 requirement consumes delivery events |
| `automations.*` / `topics.*` | OPT-OUT | Not needed — exactly one email type exists, so there is nothing to automate between and nothing to segment by |
| Notion `POST /v1/databases/{id}/query` | INTEGRATE | Via `getUnemailedPublicPosts()`. Server-side filter on `status = public` AND `emailed` unchecked; the route never re-filters |
| Notion query pagination + `created_time` sort | INTEGRATE | Handled inside the client. The route consumes the returned array in order and applies no sort of its own (D-01) |
| Notion `PATCH /v1/pages/{id}` — `emailed` | INTEGRATE | Via `markEmailed()`, called only after a clean broadcast (NOTIFY-05) |
| Notion 403 — missing "Update content" | INTEGRATE | Caught as `NotionCapabilityError`, logged distinctly, and short-circuits remaining marks with an unmarked-count summary (`04-01-PLAN.md` Task 2) |
| Notion `files` property `type` discriminator | INTEGRATE | **New this phase.** Exposed as `Post.thumbnailType` so the digest never embeds a presigned URL that expires within the hour (`04-RESEARCH.md` Pitfall 1) |
| Notion 400 — `emailed` absent from schema | OPT-OUT | Reaches the route as a thrown error handled by the `query_failed` branch. Phase 1 already types it; the operator remedy is Phase 6's DOCS-01 setup step |
| Notion 429 / 529 retry with backoff | OPT-OUT | Owned by Phase 2's bulk backfill. This route writes at most `NOTIFY_BATCH_SIZE` pages once a day, sequentially; an unmarked post is simply re-found next run |
| Notion `GET /v1/blocks/{id}/children` | OPT-OUT | Not needed — the digest carries title, summary, link and thumbnail only (NOTIFY-01). Rendering post bodies into email is out of scope |
| Notion page create / archive / other writes | OPT-OUT | Not needed, and deliberately out of reach: Phase 1 D-04 locked `markEmailed()` to the checkbox alone; this template must never create or destroy content |
| Notion webhooks / database automations | OPT-OUT | Explicitly Out of Scope in `REQUIREMENTS.md` — requires a paid Notion plan and would silently break for free-plan forkers |

## Notes

- Every Resend `INTEGRATE` row is exercised from the single call site in
  `apps/web/src/app/api/notify-subscribers/route.ts`, through the one
  `getResend()` seam. No second Resend client is constructed anywhere in the
  monorepo.
- **No package is installed this phase.** `04-RESEARCH.md` § Package Legitimacy
  Audit records that `resend` was already installed and cleared in Phase 3 and
  that `node:crypto` is a Node built-in, so nothing crosses the install boundary
  and no legitimacy checkpoint applies. The supply-chain consideration is carried
  as `T-04-SC` in all three plans.
- The `audienceId` → `segmentId` rename is Resend's own, is in progress, and both
  fields are functional in the installed 6.18.0. Deferred deliberately; revisit
  when `audienceId` is actually removed, not when it is merely deprecated.
- The Notion rows are reached only through Phase 1's `NologClient`; this phase
  adds no new Notion call site and no new HTTP handling, only the additive
  `getFileType()` extractor feeding `Post.thumbnailType`.
