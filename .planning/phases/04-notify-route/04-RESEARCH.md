# Phase 4: Notify Route - Research

**Researched:** 2026-07-27
**Domain:** Cron-triggered digest email (Resend Broadcast API + Vercel Cron + Notion write-back) for an existing Next.js/Notion blog template
**Confidence:** HIGH

## Summary

This phase is unusually pre-researched — `.planning/research/ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`, and `FEATURES.md` (2026-07-24) already cover the overall shape correctly. This document does **not** repeat that material; it (a) resolves the two explicitly-flagged open verification gaps, (b) reconciles one real drift between that prior research and the current locked requirements, and (c) surfaces one previously-undocumented pitfall found while verifying the codebase directly.

**The two flagged gaps are now resolved with direct evidence:**

1. **Vercel Hobby `maxDuration` is 300 seconds (default AND maximum), not 10 seconds** — confirmed directly against Vercel's current docs (fetched 2026-07-27). Fluid Compute is enabled by default for all plans including Hobby; no opt-in action is required. This decisively favors the higher end of the range `PROJECT.md`/D-11 flagged as contested, and Phase 5 SC#3's live-dashboard check should only need to *confirm* this, not adjudicate between two very different numbers.
2. **Resend's Broadcast-to-Audience unsubscribe handling is confirmed for the parts that matter, but NOT fully confirmed for the specific claim D-08 hinges on.** Resend's own docs confirm (CITED): sending a Broadcast to an Audience/Segment makes Resend "automatically handle the unsubscribe flow" (suppression-list add, no login/friction). What the *fetched* official docs do **not** explicitly state is whether the RFC 8058 `List-Unsubscribe`/`List-Unsubscribe-Post` HTTP headers are injected unconditionally, independent of whether the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag appears anywhere in the email body. This is a genuine documentation gap, not a settled fact — see Open Question 1 and the recommendation below.

**Primary recommendation:** Build the route exactly as the existing research describes (fail-closed `CRON_SECRET` check first, Node runtime, Broadcast API, per-post-section isolation, mark-after-successful-send), but with three corrections this document adds: (1) reconcile the send/mark flow to a **single digest** model (see Architecture Patterns → Pattern 3 reconciliation) rather than the prior per-post-send-loop diagram, (2) render the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag as a **visible unsubscribe link in the footer** rather than relying purely on invisible header injection (closes the D-08 ambiguity at near-zero cost), and (3) treat any post whose `thumbnail` is a Notion-uploaded **file-type** image (not an external URL) as **text-only** in the digest, because Notion's file URLs are presigned and expire after exactly 1 hour — long before most subscribers will open a once-daily digest email.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `CRON_SECRET` authentication | API/Backend | — | Route-handler-level check; no browser, no session, no DB involved |
| Env-var fail-closed gate (SEC-02) | API/Backend | — | Same handler, checked immediately after auth |
| Unemailed-post query | API/Backend | Database/Storage (Notion) | `NologClient.getUnemailedPublicPosts()` runs server-side inside the route; Notion is the actual store |
| Digest content assembly (per-post section, thumbnail, subject) | API/Backend | — | Pure server-side string/template building, no rendering framework involved |
| Digest send (Broadcast API) | API/Backend | External Service (Resend) | Route calls Resend; Resend owns delivery, suppression list, and (per this research) unsubscribe/RFC 8058 mechanics |
| `emailed` mark-back | Database/Storage (Notion) | API/Backend | Durable state lives in Notion; the route only triggers the write |
| Physical mailing address / "why you're receiving this" copy | API/Backend (reads `site.config.ts`) | — | Static config read server-side at send time, not exposed to any client bundle |
| Thumbnail image rendering in the recipient's inbox | External Service (Notion S3 or subscriber's mail client image proxy) | — | Neither Vercel nor this app serves the image bytes — the `<img src>` points directly at Notion's (possibly expiring) file URL or an external URL; see Pitfall below |

## Project Constraints (from CLAUDE.md)

Extracted from `.claude/CLAUDE.md` (project-level, binding on this phase):

- **Runtime:** Route must run on Node.js runtime, never Edge (`export const runtime = "nodejs"` or simply omit a runtime export — this repo's convention per `/api/subscribe/route.ts` is to declare it explicitly).
- **Logging:** All console output must use the `[Context]` bracket-prefix convention, e.g. `[Notify] ...` — matches `[Subscribe]` in Phase 3's route and `[OG Route Error]` in the existing OG route.
- **Error handling:** Catch errors with `catch (error: unknown)`; never let errors escape to a component render path; use `error instanceof Error ? error.message : String(error)` when extracting messages; return null/empty defaults rather than throwing across module boundaries where established elsewhere.
- **Naming:** camelCase functions/variables, `ALL_CAPS` module constants (matches `EMAIL_PATTERN`, `RATE_LIMIT_MAX` etc. in `/api/subscribe/route.ts`), PascalCase types/interfaces.
- **Imports:** Use `@/` alias for all non-relative imports within `apps/web`.
- **Comments:** Explain *why*, not *what*; use section-divider comments (`// ─── Section ────`) for grouping, matching `client.ts`'s existing `// ─── Mutations ───` banner.
- **Module design:** Named exports; single-responsibility files; write-path methods (like `markEmailed`) must never be `cache()`-wrapped (explicit anti-pattern already documented in `.planning/research/ARCHITECTURE.md` Anti-Pattern 4).
- **GSD workflow enforcement:** File edits for this phase must happen through `/gsd-execute-phase`, not ad hoc — noted for the planner/executor, not actionable at research time.

These are treated as binding, same as CONTEXT.md's locked decisions — the plan should not introduce patterns that contradict them (e.g., no default-export route handler pattern, no un-prefixed console logs).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIFY-01 | Single digest per cron run, listing every newly-public post (title, summary, link, thumbnail), within ~24h | Architecture Patterns (digest reconciliation), Common Pitfalls (thumbnail expiry), Code Examples (digest assembly) |
| NOTIFY-02 | One-click unsubscribe link, forker-configurable physical address, "why you're receiving this" line | Open Question 1 (unsubscribe confirmation), Code Examples (template footer), `site.config.ts` extension pattern |
| NOTIFY-03 | Sends via Resend Broadcast API (one broadcast/run), not a per-subscriber loop | Standard Stack (verified SDK shape), Code Examples (`broadcasts.create`/`.send`) |
| NOTIFY-04 | Per-post-section isolation at content-assembly stage (not per-post send) | Architecture Patterns Pattern 3 (reconciliation with prior per-post-send research) |
| NOTIFY-05 | Mark `emailed` only for posts in a successfully sent digest; whole-send failure marks nothing | Architecture Patterns Pattern 3, Common Pitfalls (cron double-fire risk re-scoped to whole-digest blast radius) |
| SEC-01 | Reject any request without valid `CRON_SECRET`, timing-safe comparison, checked first | Standard Stack (`crypto.timingSafeEqual` verified throw behavior), Code Examples (`safeCompare`) |
| SEC-02 | Both `/api/notify-subscribers` and `/api/subscribe` fail closed on missing env vars | Environment Availability, Common Pitfalls (D-14 vs D-22 divergence already resolved in CONTEXT.md, carried forward here) |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `^6.18.0` (already installed at `apps/web`; confirmed still latest on npm registry, published 2026-07-21) `[VERIFIED: npm registry]` | Resend Node SDK — `resend.broadcasts.create()`/`.send()` for the digest; already used for `resend.contacts.create/update` in Phase 3 | Already a dependency, already vetted (Phase 3 approved it past the SUS/too-new false-positive check) — this phase adds no new package | 
| Node built-in `node:crypto` (`timingSafeEqual`) | Built into Node.js runtime, no install | Constant-time comparison of `CRON_SECRET` | Zero-dependency; confirmed available in Vercel's default (non-Edge) Node.js function runtime `[CITED: nodejs.org/api/crypto.html]` |
| Vercel Cron (`vercel.json` `crons` array) | Platform feature | Scheduled trigger — **not added in this phase** (Phase 5), but the route must be built to match its exact invocation contract | Confirmed current 2026-07-27 against `vercel.com/docs/cron-jobs/manage-cron-jobs` `[CITED]` |

### Supporting

No new libraries required. Confirmed again this session: hand-rolled HTML template string is correct for this scope (no `react-email`, matches `resend.broadcasts.create()`'s accepted `html: string` field, verified directly in the installed package's type definitions — see below).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `broadcasts.create({ audienceId })` | `broadcasts.create({ segmentId })` | Resend has renamed "Audiences" to "Segments" platform-wide; the installed SDK's `SegmentOptions` type marks `audienceId` `@deprecated` in favor of `segmentId`, but **both fields are still present and functional** in `resend@6.18.0` (verified directly from `node_modules/resend/dist/index.d.mts`, `[VERIFIED: installed package]`). No code or env var rename is required this phase — continue using the already-shipped `RESEND_AUDIENCE_ID` env var value passed as `audienceId`. Flag as a low-priority future cleanup, not a blocker. |
| Single `broadcasts.create({ ..., send: true })` call | `broadcasts.create()` then separate `.send(id)` call | The installed SDK supports `send: true` directly on `create()` (`SendBroadcastOnCreationOptions`, verified in type defs) — this collapses two API round-trips into one, which is strictly better for staying inside the maxDuration budget and reduces the failure surface (one call to isolate, not two). Recommend `send: true` on `create()` unless a scheduling delay is wanted. |

**Installation:**
```bash
# No new packages — resend is already installed at apps/web (Phase 3)
```

**Version verification:** `npm view resend version` → `6.18.0`, `npm view resend time.modified` → `2026-07-21T14:13:00.057Z` — confirmed current, matches the installed `apps/web/package.json` entry (`"resend": "^6.18.0"`). `[VERIFIED: npm registry]`

## Package Legitimacy Audit

**No new external packages are installed in this phase.** This phase reuses:
- `resend` (already installed, Phase 3 — legitimacy already verified and approved in `03-RESEARCH.md`/`03-01-PLAN.md`, npm SUS/too-new false-positive confirmed and overridden by the user)
- Node.js built-in `node:crypto` (not a package)

No `package-legitimacy check` run was needed; nothing new crosses the install boundary. If the planner introduces any new dependency during planning (not expected), run the gate then.

**Packages removed due to [SLOP] verdict:** none (n/a — no new packages)
**Packages flagged as suspicious [SUS]:** none (n/a — no new packages)

## Architecture Patterns

### System Architecture Diagram

```
Vercel Cron (once/day, vercel.json — added in Phase 5, NOT this phase)
        │  GET request, Authorization: Bearer <CRON_SECRET> auto-attached by Vercel
        ▼
┌───────────────────────────────────────────────────────────────────────┐
│ GET /api/notify-subscribers  (Node runtime)                           │
│                                                                         │
│ 1. safeCompare(authHeader, `Bearer ${CRON_SECRET}`) — FIRST statement  │
│      fail → 401, stop. No Notion/Resend call has happened yet.        │
│ 2. RESEND_API_KEY / RESEND_AUDIENCE_ID / physical address configured?  │
│      no  → no-op, 200 (feature inert; matches SEC-02)                  │
│ 3. NologClient.getUnemailedPublicPosts()  (oldest-first, capped at     │
│    NOTIFY_BATCH_SIZE posts — D-10/D-11/D-12)                           │
│      zero posts → no-op, 200 (nothing to send, nothing to mark)       │
│ 4. Assemble ONE digest:                                                │
│      for each candidate post (isolated per-post try/catch):           │
│        build a <section> — title, summary, link, thumbnail-or-text    │
│        on section-build failure → log, EXCLUDE this post's section    │
│        (NOTIFY-04) — does NOT abort the whole digest                  │
│    → produces: successfulPosts[], html body string, subject line      │
│      if successfulPosts is empty → no-op, 200 (nothing worth sending) │
│ 5. ONE resend.broadcasts.create({ audienceId, subject, html,          │
│      send: true }) call — NOT a loop, NOT one call per post           │
│      throws / returns error → log, mark NOTHING, return 200 (NOTIFY-05)│
│ 6. On successful send: for each post in successfulPosts,               │
│      NologClient.markEmailed(pageId) (isolated try/catch per post;    │
│      a single 403 here is a capability-grant problem, not a reason to │
│      abort marking the rest)                                          │
│ 7. Log a distinguishable line if the batch cap (step 3) deferred any   │
│    posts to next run (D-13)                                            │
└───────────────────┬─────────────────────────────────────────────────┘
                     │
                     ▼
        packages/core: NologClient (Phase 1, unchanged this phase)
        getUnemailedPublicPosts() / markEmailed(pageId)
                     │
                     ▼
        Notion REST API (query + PATCH)          Resend Broadcast API
                                                   (create + send against
                                                    the configured Audience)
```

### Recommended Project Structure

```
apps/web/src/
├── app/api/notify-subscribers/
│   └── route.ts              # NEW — the entire feature's entry point
├── lib/
│   └── email.ts               # UNCHANGED — getResend() reused as-is (Phase 3)
└── site.config.ts             # EDIT — add physical-address field (D-06)
```

No new component, no new `lib/` file is required for a route this small — a single `route.ts` containing the auth check, the digest-assembly helper(s), and the send/mark loop is consistent with `/api/subscribe/route.ts`'s existing shape (helper functions colocated above the exported `POST`/`GET`, not split into separate files). If the digest HTML template grows past a comfortable single-file size, extracting a `buildDigestHtml()` helper into a sibling file is a reasonable, low-risk planner discretion call — not required by any research finding.

### Pattern 1: Fail-closed secret verification, checked first (carried forward, confirmed)

Unchanged from `.planning/research/ARCHITECTURE.md` Pattern 3 / Anti-Pattern 2 — confirmed still correct and still the first line of the handler. Newly confirmed this session: Vercel's own current docs (`vercel.com/docs/cron-jobs/manage-cron-jobs`, fetched 2026-07-27) state verbatim: *"The value of the variable will be automatically sent as an `Authorization` header when Vercel invokes your cron job... The `authorization` header will have the `Bearer` prefix for the value."* `[CITED: vercel.com/docs/cron-jobs/manage-cron-jobs]` — this directly confirms D-17's assumption that a manual `curl -H "Authorization: Bearer $CRON_SECRET"` test request is byte-identical to what Vercel's own infrastructure sends.

Also confirmed: Vercel invokes cron routes via **`GET`, with no body** (Vercel's own code sample exports `GET`, not `POST`) `[CITED]` — resolves the Claude's Discretion item on HTTP method. Export `GET`, not `POST`.

### Pattern 2: `crypto.timingSafeEqual` buffer-length guard (verified throw behavior)

**Confirmed** (not merely cited from a blog): Node's `crypto.timingSafeEqual(a, b)` throws (a `TypeError`/`RangeError`-class error, not a boolean `false`) when `a` and `b` have different byte lengths `[CITED: nodejs.org/api/crypto.html, cross-checked via Node/Deno/Bun docs]`. A naive `try { return timingSafeEqual(a,b) } catch { return false }` reintroduces a timing side-channel (mismatched-length requests fail fast; matched-length-wrong-content requests take the full comparison time) — the length check itself must not leak via early-return timing. See Code Examples for the exact wrapper.

### Pattern 3: Single-digest content assembly with per-post-section isolation (RECONCILES prior research)

**What changed and why this matters for planning:** `.planning/research/ARCHITECTURE.md`'s "Notify Flow" diagram and `.planning/research/PITFALLS.md`'s Pitfall 3 both describe a **per-post send loop** ("for each post... send email via Resend... on success → markEmailed"), because that research predates the same-day-digest-batching decision that was pulled into v1 scope *later the same day* (see `STATE.md`: "Roadmap review: same-day digest batching pulled forward into v1 scope... 2026-07-24"). NOTIFY-01/04/05 as currently written describe a **fundamentally different shape**: exactly ONE `broadcasts.create()`/`.send()` call per cron run, covering every eligible post found that run, with isolation moved from "per-post send" to "per-post content-assembly." **The planner must build against NOTIFY-01/04/05 and this document, not against the older per-post-loop diagrams in `ARCHITECTURE.md`/`PITFALLS.md`** — those documents are still correct on everything *except* the send-loop shape (fail-closed ordering, batch-cap rationale, Notion capability/403 handling, backfill-before-cron ordering all still apply unchanged).

**Concretely, the corrected mark-vs-send ordering per NOTIFY-05:**
1. Build all post sections first (each isolated — a bad section is dropped, not fatal).
2. If zero sections survive, no-op (no send, no marks).
3. Send **once**, for the whole digest.
4. Only on a successful send: mark **every post whose section survived step 1** as `emailed` (isolated per-post — a single `markEmailed` failure, e.g. a 403 from a missing Notion capability, must not stop marking the rest, and must be logged distinguishably per the existing `NotionCapabilityError` pattern from Phase 1).
5. If the send itself fails (step 3), mark nothing — every eligible post remains unemailed and is naturally picked up by the next run's query (no special resume logic, consistent with the existing reconciliation design).

**Re-scoped cron-double-fire risk:** Pitfall 3's "no distributed lock" acceptance still applies, but the blast radius changed: a double-fired cron invocation now risks **one duplicate whole-digest send to every subscriber** (not one duplicate single-post email), since both invocations could independently query the same unemailed set before either one marks. This remains an accepted, documented limitation (`REQUIREMENTS.md` Out of Scope: "Distributed lock... Accepted as a limitation") — no new mitigation is required, but the plan's acceptance criteria and any manual-testing writeup should describe the risk in these (whole-digest) terms, not the old (single-post) terms.

### Anti-Patterns to Avoid

- **Looping `emails.send()` per subscriber or per post** — still the #1 anti-pattern from `PITFALLS.md` Pitfall 1, now doubly true: even under the new single-digest model, the temptation to iterate posts and call `emails.send()` once per post must be resisted — it's still exactly one `broadcasts.create()`/`.send()` call for the *entire* digest, not one per post section.
- **Treating the per-post isolation try/catch as a "send" isolation** — under the reconciled model (Pattern 3 above), per-post isolation happens only at *section-building* time, before any network call to Resend. Do not wrap the single `broadcasts.send()` call itself in a per-post loop — there is exactly one send call, full stop.
- **Copying the old `ARCHITECTURE.md` "Notify Flow" pseudocode verbatim** — it shows `<img src="/api/og?...">` and a per-post send/mark loop, both superseded (D-03 locks the raw thumbnail, not `/api/og`; NOTIFY-01/04/05 lock the single-digest model). Treat that diagram as historical context, not a build target.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unsubscribe link generation / suppression list | A custom unsubscribe endpoint + Notion/KV-backed suppression table | Resend's Audience-level automatic unsubscribe handling (`{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag) | Already decided project-wide; reinventing this reintroduces exactly the RFC 8058/suppression-list complexity Resend exists to absorb |
| Constant-time secret comparison | A bespoke loop comparing bytes "carefully" | `node:crypto.timingSafeEqual` with the length-safe wrapper (Code Examples below) | Timing-safe comparison is a well-known hard-to-get-right primitive; Node ships a correct one |
| Digest HTML templating engine | `react-email`, MJML, or a custom templating DSL | Plain template-string HTML (matches `STACK.md`'s existing "no new dependency" call, reaffirmed this session) | One email type, one layout, no personalization beyond merge tags Resend already handles — a templating library adds weight with zero benefit at this scope |

**Key insight:** every "hard part" of this phase (unsubscribe compliance, constant-time comparison, Notion pagination/rate-limit handling) already has a load-bearing library or platform primitive designated by prior research or this document — there is no genuinely novel hard problem left to hand-roll in Phase 4.

## Common Pitfalls

### Pitfall 1 (NEW — not in prior research): Notion file-type thumbnails expire 1 hour after the page is fetched, breaking the embedded `<img>` in a digest opened later

**What goes wrong:** Notion's API returns a **temporary, presigned S3 URL for `file`-type properties** (i.e., images uploaded directly into Notion, as opposed to `external`-type properties, i.e., a pasted public URL). Notion's own docs state this explicitly: *"The `url` is a temporary signed link that expires after 1 hour. Re-fetch the page to refresh it."* `[CITED: developers.notion.com/docs/retrieving-files]`. D-03 locks the digest's thumbnail source as "the raw Notion-uploaded `post.thumbnail`... embedded directly via `<img src>`." If a post's thumbnail was uploaded to Notion (the common case for a personal blog dragging images in, versus pasting an external URL), the URL captured at cron-run time is only valid for ~1 hour. A digest sent by an 08:00 UTC cron run and opened by a subscriber at lunch, that evening, or the next day — the overwhelmingly common case for a "check email once a day" email — will show a broken image for that post's thumbnail. This is the same expiry mechanism `apps/web/src/site.config.ts`'s own comment already references ("ISR revalidation interval in seconds (30 mins to prevent image expiration)") for the *website* — but the website's fix (frequent ISR revalidation refetching a fresh URL on each render) has no equivalent for a one-shot outbound email; there is no "revalidation" for an email already delivered to an inbox.

**Why it happens:** D-03 was decided based on avoiding an `/api/og` round-trip dependency, without the thumbnail-URL-expiry mechanic being in scope for that discussion — a reasonable oversight given the discussion's focus was "which image source," not "how long is that URL valid."

**How to avoid:** At content-assembly time (Pattern 3, step 1), distinguish the two Notion file-property types. `NologClient`'s `getFileUrl()` (in `packages/core/src/client.ts`) already branches on `file.type === "file"` vs `file.type === "external"` internally but currently returns only the resolved URL string, discarding which branch was taken. The digest template needs that distinction back: treat a `file`-type thumbnail as equivalent to D-05's "no thumbnail set" case (render text-only, no `<img>` tag), and only embed the URL directly for an `external`-type thumbnail (which Notion does not expire). This requires either (a) a small `Post`-level addition exposing the file-vs-external distinction, or (b) a notify-route-local re-fetch of just the thumbnail file property immediately before assembling each section (adds Notion API calls, complexity, and re-introduces the 1-hour window at a smaller scale — not recommended). Option (a) is simpler and lower-risk; flag as a planning-time decision, not a locked one, since it's a code-shape choice within D-03/D-05's existing boundaries, not a new product decision. **Recommend option (a).**

**Warning signs:** A subscriber reports a broken/red-X thumbnail image in a received digest for a post that displays its thumbnail correctly on the live site.

**Phase to address:** This phase — the digest-assembly step must be built with this distinction from the start, since it is much cheaper to build correctly now than to retrofit after `NOTIFY-01`'s "OG-image thumbnail per post" criterion has already shipped believing raw URLs are always valid.

### Pitfall 2 (research-gap resolution): Resend's Broadcast unsubscribe mechanism is confirmed at the product level, not confirmed at the HTTP-header level, in fetched official docs

See Open Question 1 below for the full evidentiary trail. Practical mitigation, at near-zero cost: **render the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag as a visible text link** in the digest footer (next to the physical address and "why you're receiving this" line — both already planned per D-06/D-07), rather than omitting all unsubscribe markup from the body as D-08 originally specified. This satisfies NOTIFY-02's "one-click unsubscribe link" requirement with certainty regardless of how Resend's header-injection mechanism actually behaves, and costs one more line in a footer that already contains two other required lines.

### Pitfall 3 (confirmed, restated with exact numbers): Vercel Hobby `maxDuration` — the contested figure is resolved

`vercel.com/docs/functions/configuring-functions/duration` (fetched 2026-07-27, `last_updated: 2026-07-01`) states, in a duration-limits table: **Hobby: Default 300s (5 minutes), Maximum 300s (5 minutes)**, under Fluid Compute, which is **enabled by default** — no dashboard opt-in action is described as necessary for a current project. `[CITED: vercel.com/docs/functions/configuring-functions/duration]` This resolves `PROJECT.md`'s "10s vs 300s" contested range decisively in favor of 300s for any project created under, or migrated to, Vercel's current default compute model. **Residual uncertainty Phase 5 SC#3 still owns:** whether the *specific* target Vercel project (which may predate Fluid Compute's default rollout) has an explicit legacy `maxDuration` override still configured in its dashboard Function settings that would need to be raised — this document narrows the range to "almost certainly 300s," it does not replace the live check.

**Practical batch-cap sizing implication for D-11's env var:** with a 300s budget, and the notify route's actual Notion work being one paginated query (100/page) plus per-post `markEmailed` PATCH calls (throttled implicitly by sequential awaiting, well under Notion's ~3 req/s average limit) plus exactly one or two Resend API calls total (not per-post), the realistic bottleneck is Notion's own per-request latency, not the 300s ceiling. A **generous default of 50 posts per run** comfortably fits inside 300s even accounting for network latency variance, while still being small enough that a digest listing 50 new posts remains a sane email a human would actually read. This specific number is a reasoned default, not derived from an authoritative source — `[ASSUMED]`; the env var makes it trivially adjustable once Phase 5 confirms the live project's actual setting.

### Pitfall 4 (confirmed, restated): Cron delivery is best-effort — no retry, possible double-fire, Production-only, UTC ±59min

Re-confirmed directly against `vercel.com/docs/cron-jobs/manage-cron-jobs` (fetched 2026-07-27), verbatim: *"Vercel will not retry an invocation if a cron job fails,"* and *"Cron delivery can also occasionally invoke the same scheduled run more than once... Design your operations to be idempotent and reconciliation-based."* `[CITED]` Also re-confirmed: *"Hobby users have two cron job restrictions. First, cron jobs can only run once per day... Second, Vercel may invoke these cron jobs at any point within the specified hour."* `[CITED]` No new mitigation required beyond what CONTEXT.md/prior research already locked in — restated here with fresh citations so the planner isn't relying on a 3-day-old, not-directly-re-verified claim for a security/reliability-relevant behavior.

### Pitfall 5 (confirmed): `crypto.timingSafeEqual` throws on length mismatch — the naive Vercel-docs sample is not timing-safe

Vercel's **own** documented cron-secret example (fetched 2026-07-27, same page as Pitfall 4) uses `authHeader !== \`Bearer ${cronSecret}\`` — a naive, non-constant-time string comparison. This is the code sample a planner/implementer copy-pasting directly from Vercel's docs would land on. SEC-01 explicitly requires a timing-safe comparison, so this sample must be adapted, not used verbatim. See Code Examples for the corrected wrapper.

## Code Examples

### Length-safe `timingSafeEqual` wrapper (SEC-01)

```typescript
// Source: pattern verified against Node.js crypto.timingSafeEqual documented throw
// behavior (nodejs.org/api/crypto.html) — buffers of different byteLength throw,
// so a naive try/catch returning false on that throw reintroduces a timing leak
// proportional to whether lengths matched. Burn equivalent time on a length
// mismatch instead of short-circuiting.
import { timingSafeEqual } from "node:crypto";

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // burn comparable time; result discarded
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
```

### Route handler skeleton (SEC-01, SEC-02, Pattern 1/3)

```typescript
// apps/web/src/app/api/notify-subscribers/route.ts
export const runtime = "nodejs";

export async function GET(request: Request) {
  // SEC-01 — first statement, no Notion/Resend call before this resolves.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!cronSecret || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    // D-16: minimal detail only.
    console.error("[Notify] Unauthorized cron request rejected.");
    return new Response(null, { status: 401 }); // D-14: plain, explicit 401
  }

  // SEC-02 — fail closed on any required config being unset.
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const address = CONFIG.compliance?.physicalAddress; // D-06/D-09
  if (!apiKey || !audienceId || !address) {
    return Response.json({ ok: true, code: "unconfigured" }, { status: 200 });
  }

  // ... getUnemailedPublicPosts (capped), assemble sections (isolated),
  //     one broadcasts.create({ audienceId, subject, html, send: true }),
  //     on success: markEmailed per surviving post (isolated).
}
```

### Resend Broadcast create+send in one call — verified against the installed SDK

```typescript
// Source: directly inspected node_modules/resend/dist/index.d.mts (resend@6.18.0,
// already installed at apps/web) — CreateBroadcastOptions =
// RequireAtLeastOne<EmailRenderOptions> & RequireAtLeastOne<SegmentOptions> & ...
// SegmentOptions has BOTH `segmentId` (preferred) and `audienceId` (@deprecated,
// still functional). `send: true` on create() avoids a second .send(id) call.
const { data, error } = await resend.broadcasts.create({
  audienceId: process.env.RESEND_AUDIENCE_ID!, // matches the already-shipped env var name
  from: "Your Blog <notify@yourdomain.com>",
  subject: `${posts.length} new post${posts.length === 1 ? "" : "s"} on ${CONFIG.site.title}`,
  html: digestHtml, // includes {{{RESEND_UNSUBSCRIBE_URL}}} rendered as a visible link
  send: true,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Vercel Hobby Serverless Functions capped at 1–60s `maxDuration` | Fluid Compute default: 300s default AND max for Hobby, enabled by default | Fluid Compute became the default compute model ahead of this research's 2026-07-01-dated docs snapshot | Directly resolves D-11's batch-cap sizing question in favor of a much larger safe default than the 10s figure in `PROJECT.md`'s original constraint text |
| Resend "Audiences" | Resend "Segments" (Audiences deprecated but still functional) | Ongoing platform rename, in progress as of this research; `audienceId` still accepted | No code change required this phase — `RESEND_AUDIENCE_ID`/`audienceId` continues to work; note as a future cleanup only |

**Deprecated/outdated:**
- `resend.broadcasts.create({ audienceId })` — functional but marked `@deprecated` in favor of `segmentId` in the installed SDK's own type definitions. Not urgent to change.
- The `.planning/research/ARCHITECTURE.md` "Notify Flow" per-post-send-loop diagram — superseded by the single-digest model (Pattern 3 reconciliation above). Still correct on everything else in that document.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A default batch cap of 50 posts/run comfortably fits Vercel's confirmed 300s Hobby budget | Common Pitfalls, Pitfall 3 | Low — it's env-var-configurable (D-11); if wrong, an operator just lowers the number, no code change |
| A2 | Resend does not itself require or auto-inject a physical mailing address into Broadcast emails (confirmed only by its *absence* from every official Resend doc page fetched this session, not by an explicit "you must add this yourself" statement) | NOTIFY-02, D-06 | Low — the project already plans to add the address manually (D-06); if Resend does auto-add something, the two would coexist harmlessly (a duplicate line, not a compliance gap) |
| A3 | Option (a) in Pitfall 1 (exposing file-vs-external distinction on `Post`/thumbnail) is the lower-risk fix versus a notify-route-local re-fetch | Common Pitfalls, Pitfall 1 | Medium — if the planner instead chooses the re-fetch approach, it still works, just adds Notion API calls and a smaller expiry window; not a correctness risk, an efficiency/complexity tradeoff |

**If this table is empty:** N/A — see rows above. All other claims in this document are `[CITED]` or `[VERIFIED]` against official docs or direct package/file inspection performed this session.

## Open Questions

1. **Does Resend inject `List-Unsubscribe`/`List-Unsubscribe-Post` (RFC 8058) HTTP headers on every Broadcast-to-Audience send unconditionally, or only when the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag is present in the body?**
   - What we know: Resend's official docs (`resend.com/docs/dashboard/segments/introduction`, fetched 2026-07-27) state plainly: *"When you send emails to your Segment, Resend will automatically handle the unsubscribe flow for you"* — this covers suppression-list behavior and no-login/friction unsubscribe, satisfying the CAN-SPAM/UX table-stakes items regardless of the header question. Separately, `resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails` explicitly instructs *manually* adding `List-Unsubscribe` headers only for the transactional `/emails` endpoint, implying (by omission, not by direct statement) that Broadcasts don't need this manual step.
   - What's unclear: No directly-fetched, quotable sentence from an official `resend.com/docs/*` page states "Broadcasts always receive `List-Unsubscribe`/`List-Unsubscribe-Post` HTTP headers regardless of body content." This specific claim appears only in third-party/aggregated WebSearch summaries (e.g., SEO-oriented guide sites), which are not being treated as authoritative here.
   - Recommendation: Do not treat D-08's "no explicit link in the body" as safe to ship as originally written. Render the `{{{RESEND_UNSUBSCRIBE_URL}}}` merge tag as a **visible unsubscribe link** in the footer (see Pitfall 2). This satisfies NOTIFY-02 with certainty under either interpretation of Resend's header behavior, at the cost of one footer line the template already needed room for (alongside D-06's address and D-07's "why" line). Recommend the phase's plan formally revise D-08 to: "one-click unsubscribe is satisfied by a visible `{{{RESEND_UNSUBSCRIBE_URL}}}` link rendered in the digest footer; Resend's Broadcast/Audience send additionally provides suppression-list and (per Resend's own product description) automatic unsubscribe-flow handling on top of that visible link" — matching D-08's own explicit "must be revisited before the phase can close" escape hatch.

2. **Should `markEmailed`'s 403 handling (already built in Phase 1 as `NotionCapabilityError`) get any *additional* per-invocation behavior in this phase**, e.g. skipping all remaining `markEmailed` calls in the same run once one 403 is seen (since a missing capability grant will 403 identically for every post in the batch, not just one)?
   - What we know: `NotionCapabilityError` is already thrown distinctly and can be caught with `instanceof`. Per-post isolation (NOTIFY-04's spirit extended to the mark step) suggests still attempting every mark call even if the first one 403s, to keep the logic simple and uniform.
   - What's unclear: Whether attempting N redundant 403-doomed PATCH calls in a row (once the capability is confirmed missing) is worth short-circuiting for efficiency/log-noise reasons.
   - Recommendation: Leave as planner's discretion — not large enough to warrant a locked decision. A simple "log once for the first 403 seen in a run, then skip remaining mark attempts and log a distinguishable 'N posts left unmarked due to missing capability' summary line" is a reasonable, low-risk optimization but not required for correctness (the posts remain correctly unemailed and get retried next run either way).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm package | Broadcast send | ✓ (installed, Phase 3) | 6.18.0 | — |
| `RESEND_API_KEY` env var | Broadcast send | Not verifiable in this execution environment (no live credentials) | — | Route fails closed (no-op) per SEC-02 if unset — this is the correct, tested behavior, not a gap |
| `RESEND_AUDIENCE_ID` env var | Broadcast target | Same as above | — | Same fail-closed behavior |
| `CRON_SECRET` env var | SEC-01 auth | Same as above | — | Missing secret → 401 on every request (fail-closed, matches Vercel's own documented pattern) |
| Notion integration "Update content" capability | `markEmailed` | Not verifiable in this execution environment | — | Already-built `NotionCapabilityError` (Phase 1) surfaces this distinctly; documentation of the required grant step is Phase 6's responsibility |
| Live Resend account (for confirming actual unsubscribe/header behavior beyond docs) | Open Question 1 | Not available in this execution environment | — | Recommendation above (visible footer link) closes the gap without needing live confirmation; a live test remains valuable but is not a hard blocker per this document's mitigation |

**Missing dependencies with no fallback:** none — every credential-dependent path already has a documented, correct fail-closed fallback.

**Missing dependencies with fallback:** all four env-var-gated dependencies above; the live-account confirmation for Open Question 1.

## Validation Architecture

This project has no test framework (explicitly Out of Scope in `REQUIREMENTS.md`; confirmed zero `jest`/`vitest`/`*.test.*` files repo-wide, same as Phase 3's `03-VALIDATION.md` finding). Verification for this phase follows the same `curl`/manual-inspection pattern Phase 3 established.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — `curl`/log-inspection snippets against a running `next dev`/`next start`, matching `03-VALIDATION.md`'s precedent |
| Config file | none |
| Quick run command | `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/notify-subscribers` |
| Full suite command | Same snippet set, run against `npm run build --workspace=apps/web && npm run start --workspace=apps/web` with real (or Resend test-mode) credentials |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Missing/invalid `CRON_SECRET` → 401, before any Notion/Resend call | curl + log inspection | `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/notify-subscribers` (no header) → expect `401`; repeat with a wrong Bearer value → expect `401`; confirm no `[Notify]` line other than the rejection log appears | ❌ Wave 0 |
| SEC-02 | Unset `RESEND_API_KEY`/`RESEND_AUDIENCE_ID`/address → no-op 200, no Notion query, no send | curl + log inspection, with valid `CRON_SECRET` but env vars unset | `env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run build ... ; curl ... ` → expect `200`, no Resend-error log line | ❌ Wave 0 |
| NOTIFY-03 | Exactly one `broadcasts.create()`/`.send()` call, not a loop | code inspection (grep) | `grep -n "resend.broadcasts" apps/web/src/app/api/notify-subscribers/route.ts` → confirm exactly one call site, no loop construct around it | ❌ Wave 0 |
| NOTIFY-04 | One malformed post's section doesn't block the others | manual test with a deliberately malformed candidate post (e.g. missing title) against a real/staging Notion DB | Manual — requires live Notion credentials, same carried-forward blocker as Phases 1/2/3 | ❌ Wave 0 (manual, credentials-gated) |
| NOTIFY-05 | Whole-send failure marks nothing; success marks all surviving posts | manual test — simulate a Resend failure (e.g. invalid API key mid-test) and confirm zero `markEmailed` calls fire; then a real success and confirm all fire | Manual — requires live Resend/Notion credentials | ❌ Wave 0 (manual, credentials-gated) |

### Sampling Rate

- **Per task commit:** run the curl snippet(s) covering what the task touched (auth-check tasks → SEC-01 snippet; config-gate tasks → SEC-02 snippet).
- **Per wave merge:** run all locally-closable snippets (SEC-01, SEC-02, NOTIFY-03 grep) against a fresh build.
- **Phase gate:** all locally-closable checks green before `/gsd-verify-work`; NOTIFY-04/NOTIFY-05's live-credential checks are carried to the operator checklist, matching Phase 1–3's precedent for credential-gated verification (`nyquist_compliant` stays `false` until an operator with real credentials runs them, exactly as Phases 1–2 already recorded in `STATE.md`).

### Wave 0 Gaps

- [ ] No test files exist for this route yet — none are required given the project's explicit no-test-framework stance; the curl snippets above serve as the Wave 0 verification harness.
- [ ] A live Notion workspace + live Resend account with a configured, verified sending domain — required for NOTIFY-04/NOTIFY-05's full closure, same carried-forward blocker documented in every prior phase's `STATE.md` entries.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | `CRON_SECRET` Bearer-token check via `crypto.timingSafeEqual` (SEC-01) — this route's only "authentication," and it is the correct control for a machine-to-machine, single-shared-secret trust boundary |
| V3 Session Management | No | No session state; this is a stateless, single-request cron endpoint |
| V4 Access Control | Yes | Binary allow/deny on the single secret; no roles/permissions model needed at this scope |
| V5 Input Validation | Partial | The route accepts no user-supplied body (Vercel Cron sends `GET` with no body) — the only "input" is the `Authorization` header itself, validated by the timing-safe comparison. Post content read from Notion is treated as trusted (already-validated at write time via the Notion UI), consistent with the rest of this codebase's trust model |
| V6 Cryptography | Yes | `node:crypto.timingSafeEqual` — never hand-roll a constant-time comparison; already the plan per SEC-01 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Timing attack against `CRON_SECRET` comparison | Information Disclosure | `crypto.timingSafeEqual` with length-safe wrapper (this document's Code Examples) |
| Unauthenticated request triggering unbounded Notion/Resend API usage (cost/quota exhaustion) | Denial of Service | Fail-closed auth check as literally the first statement in the handler (Pattern 1) — no work happens before the check passes |
| Duplicate-send storm from a missing Notion "Update content" capability (403 on every `markEmailed`, but posts already sent) | Repudiation / DoS-adjacent (spam to subscribers) | Distinguishable 403 logging (already built, Phase 1's `NotionCapabilityError`) + documentation of the capability-grant step (Phase 6) |
| Log-injection via attacker-controlled header values reaching a log line | Tampering | D-16 already locks "minimal detail only" logging for this route — no header contents are logged, closing this off entirely rather than needing to sanitize |

## Sources

### Primary (HIGH confidence)
- `vercel.com/docs/cron-jobs/manage-cron-jobs` (fetched 2026-07-27, `last_updated: 2026-06-02`) — Authorization header auto-injection, GET-only invocation, no-retry/double-fire behavior, Production-only + UTC ±59min Hobby limits
- `vercel.com/docs/functions/configuring-functions/duration` (fetched 2026-07-27, `last_updated: 2026-07-01`) — Hobby maxDuration 300s default/max table under Fluid Compute (default-enabled)
- `developers.notion.com/docs/retrieving-files` (fetched 2026-07-27) — 1-hour presigned URL expiry for `file`-type Notion properties
- Direct inspection: `node_modules/resend/dist/index.d.mts` (installed `resend@6.18.0`) — exact `CreateBroadcastOptions`/`SegmentOptions` shape, `audienceId`/`segmentId` both present, `send: true` on `create()`
- Direct inspection: `packages/core/src/client.ts`, `apps/web/src/lib/email.ts`, `apps/web/src/app/api/subscribe/route.ts`, `apps/web/src/site.config.ts`, `apps/web/next.config.ts` (this session)
- `npm view resend version` / `time.modified` (fetched 2026-07-27) — confirms `6.18.0` current

### Secondary (MEDIUM confidence)
- `resend.com/docs/dashboard/segments/introduction` (fetched via WebFetch 2026-07-27) — "Resend will automatically handle the unsubscribe flow for you" when sending to a Segment/Audience
- `resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails` (fetched 2026-07-27) — manual `List-Unsubscribe` header instruction for transactional-only sends, implying but not directly stating Broadcast automation
- `resend.com/docs/api-reference/broadcasts/create-broadcast` / `send-broadcast` (fetched 2026-07-27) — request-body parameter shapes, cross-checked against installed SDK types

### Tertiary (LOW confidence — flagged, not relied upon as authoritative)
- WebSearch-synthesized claims that Resend "injects RFC 8058 `List-Unsubscribe`/`List-Unsubscribe-Post` headers automatically" on every Broadcast send — this specific phrasing traces to aggregated third-party SEO/guide content (e.g. `smtpedia.com`), not a directly quotable resend.com page fetched this session. Treated as unverified; see Open Question 1 and this document's mitigating recommendation (visible footer link) rather than assuming this claim is settled fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified directly against the installed `resend` package's type definitions and the npm registry, not just docs
- Architecture: HIGH — reconciles a real drift between prior research and current locked requirements, grounded in direct reading of `REQUIREMENTS.md`/`ROADMAP.md`/`STATE.md`
- Pitfalls: HIGH for the two research-gap items (both resolved with direct primary-source fetches); MEDIUM for the newly-surfaced thumbnail-expiry pitfall (mechanism is HIGH-confidence/CITED, but the recommended fix is this document's own reasoning, not an externally-validated pattern)

**Research date:** 2026-07-27
**Valid until:** 30 days (Resend's Audiences→Segments rename and Vercel's Fluid Compute defaults are both areas of active platform change; re-verify if this phase's implementation slips past late August 2026)
