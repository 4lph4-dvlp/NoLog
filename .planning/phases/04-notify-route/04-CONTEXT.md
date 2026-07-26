# Phase 4: Notify Route - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

When one or more Notion posts go public, the daily Vercel Cron sends current subscribers a single digest email listing every newly-public post found in that run — via Resend's Broadcast API (never a per-subscriber send loop), isolated per-post-section on content failure, CAN-SPAM/RFC 8058 compliant, and reachable only by an authenticated cron request.

Requirements covered: NOTIFY-01, NOTIFY-02, NOTIFY-03, NOTIFY-04, NOTIFY-05, SEC-01, SEC-02 (see `.planning/REQUIREMENTS.md`).

This phase adds the notify route and its digest-email template only. It does NOT touch the subscribe path (Phase 3, complete), the backfill script (Phase 2, complete), `vercel.json`'s cron entry or the backfill-before-cron deploy ordering (Phase 5), or README documentation of the new env vars/config field (Phase 6). It depends on Phase 1 (`getUnemailedPublicPosts()`/`markEmailed()` on `NologClient`) and Phase 2 (the backfill script that must be run against production before this route's cron entry ever goes live — a Phase 5 concern, not this phase's).

</domain>

<decisions>
## Implementation Decisions

### Digest structure & subject line (NOTIFY-01)

- **D-01:** Posts within one digest are ordered **oldest-first** (by `created_time` ascending) — matches the query sort `.planning/research/ARCHITECTURE.md`'s example filter already uses, so display order matches query order with zero extra sort logic.
- **D-02:** The subject line is **count-based and generic**, e.g. `"{N} new post(s) on {site.title}"` — works identically whether the run found 1 post or many, with no branching logic needed between a "single post" and "multiple posts" subject format.
- **D-03:** Each post section's thumbnail image is the **raw Notion-uploaded `post.thumbnail`** (the existing public S3 URL already on the `Post` type), embedded directly via `<img src>` — NOT the `/api/og` generated branded card. Shows the post's actual image; needs no API round-trip and no dependency on `/api/og`'s edge runtime being reachable from this Node route. — **Reversibility:** reversible — swapping to `/api/og`-generated images later is a template-only change, no data-shape impact.
- **D-04:** No greeting/intro line above the post list — the digest goes straight into per-post sections. Matches `.planning/REQUIREMENTS.md`'s explicit "plain digest format is the ceiling for v1" Out of Scope entry (no rich/themed template).
- **D-05:** When a candidate post has **no thumbnail set** in Notion, that post's section renders **text-only** — no `<img>` tag at all (not a broken-image icon, not a site-wide fallback logo).

### CAN-SPAM address & compliance elements (NOTIFY-02)

- **D-06:** The required physical mailing address is a **new field in `apps/web/src/site.config.ts`** — matching the existing `profile`/`sns` configuration pattern. It's public information, not a secret, so there's no reason to make it an env var like `RESEND_API_KEY`. — **Reversibility:** reversible — moving it to an env var later is a config-source swap, not a data-contract change.
- **D-07:** The "why you're receiving this" line is a **short, direct one-liner** (e.g. "You're receiving this because you subscribed to new-post alerts on {site.title}.") — satisfies the legal requirement without extra detail (no subscription date/email echoed back).
- **D-08:** The one-click unsubscribe requirement (NOTIFY-02) is satisfied by **relying on Resend's automatic List-Unsubscribe handling** (per NOTIFY-03: Broadcast API to an Audience makes "unsubscribe handling and RFC 8058 compliance... automatic") — the digest template does NOT render its own explicit unsubscribe link/button in the body. **This is conditional on research confirming the behavior**: `.planning/PROJECT.md`'s Blockers/Concerns section already flags "Resend Broadcast API's confirmed-opt-in/domain-warmup behavior is thin in public docs — verify against a live Resend account during Phase 4 implementation." If research or live testing during this phase finds Resend's Broadcast+Audience send does NOT reliably inject a working one-click unsubscribe link/header, this decision must be revisited before the phase can close — do not silently ship without a working unsubscribe mechanism. — **Reversibility:** reversible — adding an explicit body link later is additive.
- **D-09:** If the physical address (D-06) is not configured, the notify route **fails closed — no-ops**, at the same tier as an unconfigured `RESEND_API_KEY`/`RESEND_AUDIENCE_ID`. Consistent with this project's recurring "fail-closed, not fail-open" theme (`.planning/PROJECT.md`): never send a CAN-SPAM-noncompliant email just because a forker forgot one config field.

### Batch overflow policy (NOTIFY-01, Scaling)

- **D-10:** The notify route **caps the number of unemailed posts processed per cron invocation** rather than attempting an unbounded batch. `.planning/research/PITFALLS.md`'s Performance Traps section explicitly flags unbounded per-run processing as a risk if posts accumulate (e.g., cron down for days) and total request time approaches the Vercel Function `maxDuration` budget. Posts beyond the cap are simply not processed this run — `getUnemailedPublicPosts()`'s natural "still unemailed" semantics pick them up on the next successful run, no special resume logic needed.
- **D-11:** The cap value is **configurable via an env var** (exact name left to planner), not hardcoded. Rationale: the actual Vercel Hobby `maxDuration` figure is unconfirmed at this research stage (10s per `.planning/PROJECT.md`'s constraint text vs. 300s under Fluid Compute per `.planning/research/ARCHITECTURE.md`'s Scaling Considerations, sourced from Vercel's current docs) — Phase 5's SC#3 verifies the real value directly against the deployed project's dashboard. An env var lets the batch size be tuned once that's confirmed, without a code change.
- **D-12:** The cap is measured by **post count**, not elapsed time — simple, predictable ("process at most N posts this run"), and the rule stays consistent regardless of Notion/Resend API latency variance. A soft time-based cutoff was considered and rejected as unnecessary added complexity for this project's actual scale.
- **D-13:** When the cap is reached and posts remain unprocessed, the route logs a **distinguishable operator-facing line** stating how many posts were deferred to the next run. Matches this project's repeated pattern (Phase 3's D-22, D-25) of always giving the operator a clear signal even when the external/subscriber-facing behavior stays silent.

### CRON_SECRET verification & failure response (SEC-01)

- **D-14:** A missing or invalid `CRON_SECRET` gets a **plain, explicit 401** response — not a hide-existence 404 style like Phase 3's D-22. Rationale: D-22's "look like the route doesn't exist" posture exists because `/api/subscribe`'s 404 branch could be hit by any anonymous visitor or scanner; this route is meant to be called only by Vercel's own cron infrastructure (or the operator manually testing it), so there's no "general public" audience whose probing needs misdirecting — a standard, explicit 401 is the correct REST convention here and doesn't need D-22's obfuscation rationale.
- **D-15:** Failed `CRON_SECRET` attempts (missing or wrong) **are logged** — unlike Phase 3's D-25, which deliberately does NOT log honeypot/429 hits because those are high-frequency, low-information, publicly-triggerable noise. This route has a fundamentally different trust model: nobody legitimate should ever hit it without the correct secret, so any failed attempt is inherently a signal worth an operator's attention, not routine noise.
- **D-16:** The failure log captures **only the failure fact, no detail** (e.g. `"[Notify] Unauthorized cron request rejected"`) — no logged secret value, no logged IP, no logged header contents. Matches D-24's minimal-logged-detail principle from Phase 3 (extended here: even though this route's failed attempts are worth logging at all per D-15, what gets logged stays minimal).
- **D-17:** Manual invocation of the route (ROADMAP SC#1 explicitly requires this be testable) uses the **exact same `Authorization: Bearer {CRON_SECRET}` header** Vercel's own cron trigger sends when the `CRON_SECRET` env var is configured on the project — no separate manual-testing auth path (e.g. a query-param shortcut), which would only widen the attack surface for no real benefit (the operator can send the same header via `curl` as easily as a query param).

### Claude's Discretion

- Exact HTML/inline-CSS structure and typography of the digest email beyond what D-01 through D-05 fix (section spacing, whether the title is a link itself or the link sits below the summary, font stack for the plain-text-adjacent HTML email) — no strong preference expressed, follow email-client-safe conventions (inline styles, no external stylesheet, table-based layout only if genuinely needed for client compatibility).
- Exact wording of the subject-line template and the "why you're receiving this" line beyond D-02/D-07's fixed shape.
- Exact env var name for the batch cap (D-11) — e.g. `NOTIFY_BATCH_SIZE` or similar; planner's call.
- HTTP method the route accepts (Vercel Cron's default invocation method, GET vs POST) — a platform-convention detail for research/planner to confirm against current Vercel docs, not a user-vision decision.
- Whether the `CRON_SECRET` comparison uses Node's `crypto.timingSafeEqual` directly or a small wrapper — SEC-01 already locks "timing-safe comparison" as a requirement; the exact mechanism is implementation detail.
- Log line prefix/format for D-13's truncation notice and D-16's rejection notice — follow the existing `[Notify] message` bracket-prefix convention already established by `[Subscribe]` in Phase 3's `route.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Notification (NOTIFY) — NOTIFY-01 through NOTIFY-05, the exact requirement wording this phase must satisfy
- `.planning/REQUIREMENTS.md` §Access Control (SEC) — SEC-01, SEC-02 (SEC-03 is Phase 3, already complete)
- `.planning/REQUIREMENTS.md` §Out of Scope — double opt-in, CAPTCHA, preference center, distributed/Redis-backed locking, and rich/themed digest templates are all explicitly excluded; do not reintroduce them
- `.planning/ROADMAP.md` §Phase 4: Notify Route — the Goal and the 6 success criteria the plan must satisfy, including SC#1's Broadcast-API-not-a-send-loop requirement and SC#6's regression check on Phase 3's `/api/subscribe` no-op contract
- `.planning/PROJECT.md` §Constraints and §Key Decisions — the fail-closed theme, "no new infrastructure", Approach B (dedicated route + Vercel Cron) and Resend-over-Buttondown decisions, the accepted concurrency/distributed-lock-gap limitation, and the contested Vercel `maxDuration` figure (D-11's rationale)

### Research (2026-07-24 session — this phase is unusually heavily pre-researched; read in full before planning, not just skimmed)
- `.planning/research/ARCHITECTURE.md` §"Notify Flow (cron-triggered, high trust)" — the exact request-path ordering this route follows (secret check → env check → query → per-post send/mark loop)
- `.planning/research/ARCHITECTURE.md` §"Pattern 3: Fail-closed secret verification, checked first" — CRON_SECRET must be line one of the handler, before any Notion/Resend call
- `.planning/research/ARCHITECTURE.md` §"Suggested Build Order" — the load-bearing sequencing (extend `NologClient` → backfill validates it → subscribe route independent → notify route → run backfill against prod → cron entry last); this phase is step 4 in that order
- `.planning/research/ARCHITECTURE.md` §"Scaling Considerations" — the `maxDuration` uncertainty (10s vs. 300s) directly motivating D-10/D-11's batch cap, and the Resend 100/day-vs-Broadcast distinction
- `.planning/research/ARCHITECTURE.md` §"Anti-Pattern 2" — cron route's first action must be the secret check, full stop, no exceptions for "harmless reads"
- `.planning/research/PITFALLS.md` §Pitfall 1 — Broadcast API vs. transactional Send API quota confusion; verify the implementation actually calls `broadcasts.send()`, never loops `emails.send()`
- `.planning/research/PITFALLS.md` §Pitfall 3 — Vercel Cron has no retry and can double-fire; the accepted mark-after-send ordering (already locked by NOTIFY-05) and why no distributed lock exists here
- `.planning/research/PITFALLS.md` §Pitfall 4 — cron only fires on Production deployments, UTC-only; relevant when this phase's plan writes manual-testing instructions
- `.planning/research/PITFALLS.md` §Pitfall 5 — missing Notion "Update content" capability causes 403 on `markEmailed`, and combined with mark-after-send ordering, causes a duplicate-email storm, not a silent failure, if unhandled
- `.planning/research/PITFALLS.md` §Performance Traps — the exact maxDuration/batch-size risk D-10 through D-13 close
- `.planning/research/PITFALLS.md` §"Looks Done But Isn't" Checklist — verification checklist the plan's acceptance criteria should mirror

### Existing Codebase
- `packages/core/src/client.ts` — `NologClient.getUnemailedPublicPosts()`/`markEmailed(pageId)`, `NotionCapabilityError`/`MissingEmailedPropertyError` (Phase 1, complete) — this phase's route calls these directly, does not reimplement
- `apps/web/src/lib/email.ts` — `getResend()` (Phase 3, complete) — this route imports and reuses this exact seam, does not construct its own Resend client
- `apps/web/src/app/api/subscribe/route.ts` — the sibling route this phase's notify route sits alongside; read for the established D-21 (machine-code response contract), D-24/D-25 (logging discipline) conventions this phase's D-15/D-16 extend and deliberately diverge from where the trust model differs
- `apps/web/src/site.config.ts` — where D-06's new physical-address field is added, alongside the existing `profile`/`sns`/`site` blocks
- `apps/web/src/app/api/og/route.tsx` — the existing Edge-runtime route; NOT used by this phase per D-03, but referenced in research as the reason `/api/og` can't be server-fetched from this Node route

### Prior Phase Context (carried forward)
- `.planning/phases/01-notion-data-layer/01-CONTEXT.md` — D-02 ("once emailed, always emailed" — no unpublish/republish reset), D-03 (403 must be a typed, catchable error) — both directly consumed by this phase's send/mark loop
- `.planning/phases/02-backfill-script/02-CONTEXT.md` — the abort-on-systemic-error vs. continue-on-per-post-error split (D-04/D-05/D-06 there) is a useful precedent for this phase's own per-post-section isolation (NOTIFY-04), though this phase's exact isolation boundary (a digest *section*, not a whole email) is new
- `.planning/phases/03-subscribe-path/03-CONTEXT.md` — D-19/D-20 (Resend SDK confined to `apps/web`, `lib/email.ts` as the sole construction seam — this phase imports it), D-24/D-25 (logging/PII discipline baseline this phase's D-15/D-16 extend), D-06 (`CONFIG.site.locale` i18n ternary pattern, relevant if the digest template needs Korean/English copy), D-22 (opaque external response + informative internal log line pattern, referenced and deliberately diverged from in D-14)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NologClient.getUnemailedPublicPosts()` / `markEmailed(pageId)` (`packages/core/src/client.ts`, Phase 1) — the exact data layer this route's core loop calls; do not reimplement any Notion query/patch logic here
- `getResend()` (`apps/web/src/lib/email.ts`, Phase 3) — the lazy Resend client accessor; this route imports it exactly as Phase 3 designed it to be imported
- `Post` type (`packages/core/src/types.ts`) — already has `emailed: boolean`, `thumbnail`, `title`, `summary` fields this phase's digest template needs directly

### Established Patterns
- `[Context] message` bracket-prefixed console logging convention (`[Subscribe]` in Phase 3's `route.ts`, `[OG Route Error]` in the existing OG route) — this phase's `[Notify]`-prefixed logs continue it
- Machine-code (`{ ok, code }`) JSON response contract from Phase 3's `route.ts` D-21 — worth considering for consistency, though this route's caller is Vercel Cron/the operator, not a client-side form parsing `code` values, so the response shape doesn't carry the same enumeration-safety requirement Phase 3's does
- Fail-closed-first, checked-before-any-other-work pattern (Phase 3's D-22 for the 404 config gate) — this phase's D-14/D-17 apply the same principle to CRON_SECRET verification, per `.planning/research/ARCHITECTURE.md`'s explicit Anti-Pattern 2 warning

### Integration Points
- `apps/web/src/app/api/notify-subscribers/route.ts` — new file, Node runtime (not Edge — Resend SDK is not edge-safe), the first route in this repo triggered by Vercel Cron rather than a client
- `apps/web/src/site.config.ts` — new physical-address field (D-06) added alongside `profile`/`sns`
- `vercel.json` — NOT created in this phase (Phase 5); this phase's plan should note the route works standalone and is manually testable before any cron entry exists
- Nothing in `packages/core` changes in this phase — Phase 1 already completed the data-layer extension this route consumes

</code_context>

<specifics>
## Specific Ideas

This phase inherits an unusually deep and specific research base from the 2026-07-24 `/office-hours` → `/autoplan` session — most of the "HOW" (route structure, ordering, mark-vs-send timing per NOTIFY-05, Broadcast-vs-transactional API choice) was already locked before this discussion even started. What this discussion resolved was the remaining genuine product-vision gaps the research explicitly left open: digest presentation (ordering, subject line, thumbnail source), where a legally-required but product-level config value lives (the CAN-SPAM address), a scaling/safety policy the research flagged as a real risk but didn't resolve (batch overflow), and a trust-model distinction this phase's route has from its sibling `/api/subscribe` (D-14/D-15's explicit-401-and-log-it stance, versus Phase 3's hide-existence-and-stay-silent stance) — the same "who is this response/log for" question Phase 3 asked, answered differently here because the audience genuinely differs (Vercel's own infra + the operator, not the general public).

The one decision (D-08, unsubscribe link) that carries a real open verification risk was flagged explicitly rather than assumed — `PROJECT.md`'s own Blockers/Concerns section already named Resend's Broadcast/Audience unsubscribe behavior as thin-documented and needing live verification. The planner/researcher should treat this as a must-verify-early item, not a might-get-to-it item, since the whole shape of the digest template (does it need its own unsubscribe link markup or not) depends on the answer.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — all four areas stayed within Phase 4's notify-route boundary. No scope creep occurred.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 4.

</deferred>

---

*Phase: 4-Notify Route*
*Context gathered: 2026-07-27*
