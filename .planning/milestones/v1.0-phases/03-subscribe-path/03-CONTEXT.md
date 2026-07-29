# Phase 3: Subscribe Path - Context

**Gathered:** 2026-07-26
**Updated:** 2026-07-26 — second discussion pass added D-17 through D-26 (Resend contact semantics, SDK choice, route response contract, logging/PII policy, verification split)
**Status:** Ready for planning

<domain>
## Phase Boundary

A visitor can subscribe to new-post notifications through a form that is gated server-side (the secret `RESEND_API_KEY` never reaches the client bundle), resistant to bot and enumeration abuse, and entirely absent from the server-rendered HTML when the Resend env vars are unset — the same fail-closed contract the existing Cusdis integration follows, achieved by a different mechanism.

Requirements covered: SUB-01, SUB-02, SUB-03, SUB-04, SEC-03 (see `.planning/REQUIREMENTS.md`).

This phase adds the subscribe path only: the `SubscribeSection`/`SubscribeForm` component pair, their placement in both templates, and the `/api/subscribe` route handler. It does NOT touch the notify route or its `CRON_SECRET` handling (Phase 4), `vercel.json`/cron wiring (Phase 5), or README documentation of the new env vars (Phase 6). It has no technical dependency on Phases 1, 2, 4 or 5 and is shippable independently at any point.

</domain>

<decisions>
## Implementation Decisions

### Form placement & template coverage

- **D-01:** The subscribe form gets a **per-template placement**, not a single shared placement: in the `default` template it renders **under the `Profile` card** (right sidebar on desktop, and in the mobile block directly under `Profile` too — no responsive branch); in the `terminal` template it renders **below the post**. This deliberately diverges from `CommentSection`, which is placed identically (post-page bottom) in both templates. Rationale given by the user: the two templates have genuinely different visual languages, and a third-party developer building a *third* template will read both existing ones as the reference — so the per-template pattern being established here is the thing they should copy. — **Reversibility:** reversible — placement is two JSX insertion points; moving them later touches no data shape and no API contract.
- **D-02:** The `terminal` template gets a **terminal-specific visual variant** of the form (CLI-prompt aesthetic consistent with the rest of that template), not the same markup as the `default` variant. Same rationale as D-01 — the variant mechanism is itself the pattern being demonstrated for future templates. — **Reversibility:** reversible — collapsing back to a single visual treatment is a deletion, not a migration.
- **D-03:** Consequence of D-01 accepted knowingly: because `Profile` lives in `apps/web/src/templates/default/Layout.tsx`, the `default` template's subscribe form is rendered on **every page** (home, post, category, search) and re-mounts on every navigation — unlike the `terminal` template's, which appears only on post pages. This asymmetry is intentional, not an oversight.

### Env gating structure (SEC-03)

- **D-04:** Exactly **one** env gate exists: a single `SubscribeSection` Server Component reads `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` and either returns `null` or renders `<SubscribeForm variant="default" | "terminal" />`. Template-specific presentation is selected by a **`variant` prop**, not by duplicating the Section per template and not by two separate form components. Rationale: with N templates, a per-template gate means N places a future contributor could get fail-closed wrong; one gate means a new template physically cannot leak the form into an unconfigured fork. — **Reversibility:** reversible — the prop can be split into separate components later without changing the gate itself, which is the part that carries the security contract.

### Post-submit UX & copy

- **D-05:** On success, the form is **replaced** by an inline success message — the input and button disappear. Not a persistent form with a note underneath, and not a toast (no toast system exists in the repo, and adding one conflicts with the "minimal" core value). Replacing the form also structurally discourages the repeat submissions that would otherwise trip D-09's rate limit.
- **D-06:** All form copy (label, placeholder, button, success and error messages) follows the **`CommentSection` pattern exactly**: `CONFIG.site.locale === "ko"` ternaries hardcoded inside the component. No new `subscribe` block is added to `site.config.ts`. Rationale: it is the only i18n convention that exists in this repo today, and keeping it avoids adding a setting Phase 6's README would then have to document. — **Reversibility:** reversible — extracting copy into `site.config.ts` later is purely additive.
- **D-07:** On a **genuine** server error (Resend outage, 5xx, network failure), the form stays mounted with the entered value preserved and shows an inline **generic** message ("try again in a moment" register) that does not reveal the cause. Note this path is explicitly distinct from "already subscribed", which SUB-03 forces to be byte-identical to a fresh success and therefore never reaches this branch.
- **D-08:** The success state is **not persisted** — `useState` only, no `localStorage`, no `sessionStorage`. A reload or navigation brings the form back. Rationale: a client-side "already subscribed" flag is state that can disagree with the server (it would keep hiding the form after the visitor unsubscribes), and duplicate submissions are already absorbed harmlessly by SUB-03's idempotent identical-response contract. — **Reversibility:** reversible — adding persistence later is additive and touches only the client component.

### Rate limiting (SUB-04)

- **D-09:** The rate-limit counter lives in a **module-scoped in-memory `Map`** inside the route handler — zero dependencies, zero new infrastructure (Redis/Vercel KV is already Out of Scope in `.planning/REQUIREMENTS.md`). Its limitations are accepted, not overlooked: the counter is per serverless instance and resets on cold start, so it is a bulk-abuse dampener rather than a deterministic gate. — **Reversibility:** reversible — swapping the store later is a local change behind one lookup, but note that doing so would require the new-infrastructure constraint to be revisited first.
- **D-10:** The threshold is **5 submissions per IP per 10 minutes**. A legitimate visitor subscribes once in their life and retries once or twice at most; a 10-minute window keeps the in-memory Map from growing unbounded and lets a false positive on a shared/NAT IP (office, school, café) clear itself quickly.
- **D-11:** A request over the limit receives a genuine **429** and the form shows a "try again shortly" message. This does **not** conflict with SUB-03: a 429 discloses nothing about whether the submitted address is already in the Audience, so the endpoint remains useless as an enumeration oracle. Chosen over a silent fake-success because a real person caught by a shared-IP false positive would otherwise walk away believing they subscribed.
- **D-12:** When the client IP cannot be determined (missing/empty `x-forwarded-for`, local dev, unusual proxy config), the request is bucketed under a **single shared `"unknown"` key** subject to the same 5-per-10-minutes limit — rather than being waved through or hard-rejected. Fail-closed direction: stripping the header cannot be used to bypass the limit, while local development with a single address still works.

### Bot blocking & email validation (SUB-04, SUB-03)

- **D-13:** A submission with the **honeypot field populated** receives a **fake success (200) identical to a real success** and is silently dropped — never added to the Audience. Returning 400 would tell a bot operator their bot was detected and hand them the feedback needed to route around the trap, defeating the pattern.
- **D-14:** The **time-on-page trap is NOT implemented**, despite `.planning/research/FEATURES.md` recommending it as the standard honeypot pairing. SUB-04's wording specifies honeypot + per-IP rate limiting, this phase is `mvp` mode, and a client-supplied timestamp is forgeable anyway while risking false positives against password-manager autofill and accessibility tooling. — **Reversibility:** reversible — additive; a hidden timestamp field and one server-side comparison can be added later without touching anything else.
- **D-15:** Email validation is **browser `<input type="email" required>` on the client plus a deliberately loose regex on the server** (presence of a local part, `@`, and a dotted domain) as a bypass guard. Strict RFC-style validation is explicitly rejected — over-blocking valid addresses (plus tags, new TLDs, unicode locals) is the classic bug of that approach. Final authority on address validity is Resend.
- **D-16:** The server **normalizes** the submitted address with `trim()` + lowercase before doing anything with it, so `" A@B.com "` and `a@b.com` resolve to the same contact and cannot create duplicate Audience entries. Accepted trade-off: RFC permits case-sensitive local parts, but effectively no real mail server honors that, and duplicate subscribers are the more likely real-world harm.

### Resend contact semantics (SUB-01, SUB-03)

- **D-17:** On every accepted submission the route calls `contacts.create` and then **always** calls `contacts.update({ unsubscribed: false })` — unconditionally, without first reading the Audience. This makes the outcome independent of the `resend/resend-node#458` behavior recorded in `PITFALLS.md` (a `create` on a previously-unsubscribed address may silently recreate them as still-unsubscribed): whatever the SDK version does on create, the second call fixes the state. Rationale: the alternative — branching on the create response — puts the correctness of the feature on a response shape that is undocumented and version-dependent, and the cost of being wrong is the project's worst failure mode (the visitor sees "subscribed" and never receives mail). Cost is one extra API call per subscription, at a volume where that is free. Submitting the form is itself the opt-in signal that justifies clearing a prior unsubscribe. — **Reversibility:** reversible — deleting the second call is a one-line change behind `lib/email.ts`.
- **D-18:** When `create` succeeds but the follow-up `update` fails, the visitor gets the **D-07 generic error** (form stays mounted, value preserved, no cause disclosed) rather than a success. Rationale: the requested end state (subscribed *and* receiving) was not reached, so reporting success would be the silent failure D-17 exists to prevent; the whole path is idempotent, so the visitor's retry is safe and is the recovery mechanism. Accepted trade-off: a brand-new subscriber whose `create` already succeeded sees an error despite being registered — harmless, because their retry converges to the same state. No retry loop is added inside the route (D-18 deliberately does not adopt Phase 2's fixed-backoff retry — that would make a visitor-facing serverless request wait on a second failure).
- **D-17/D-18 consequence for SC#3:** because the create+update pair runs identically for a first-time address and a resubscribing one, the response for both is produced by the same code path — the enumeration-safety criterion is satisfied structurally, not by after-the-fact response matching.

### Resend client & dependency (SUB-01)

- **D-19:** `/api/subscribe` uses the **official `resend` SDK**, added as a dependency of `apps/web` (currently installed nowhere in the monorepo). `packages/core` stays Notion-only. The route is therefore Node runtime, not Edge. Rationale: `NologClient`'s hand-rolled Notion REST calls are a documented *workaround for SDK bugs on inline databases*, not a house preference — the repo still depends on `@notionhq/client`. Phase 4 needs the Broadcast API, where `PITFALLS.md` Pitfall 1 shows the expensive mistake (a per-subscriber `emails.send()` loop instead of one `broadcasts.send()`) is exactly the kind of thing a hand-rolled client invites. — **Reversibility:** reversible — D-20 confines the SDK to one module, so swapping to raw `fetch` later touches one file.
- **D-20:** The Resend client is constructed in **`apps/web/src/lib/email.ts`**, which holds client construction only — no broadcast helpers, no email templates, nothing Phase 4-shaped. Phase 4 imports it rather than building its own. Rationale: this is not speculative generality (it is where the client would live anyway), and it gives Phase 4 a single seam without Phase 3 depending on Phase 4 in any way — Phase 3 remains independently shippable.

### Route response contract (SUB-03, SUB-04, SEC-03)

- **D-21:** `/api/subscribe` returns `{ ok: true }` on success and `{ ok: false, code: "invalid_email" | "rate_limited" | "server_error" }` on failure — **machine codes, never display prose**. The form maps `code` to a message through D-06's `CONFIG.site.locale` ternaries. Rationale: if the server returned user-facing sentences, locale branching would exist in two places and D-06's convention would break at the first error message. The codes disclose nothing about whether an address is already subscribed, so the enumeration contract is untouched. — **Reversibility:** reversible — adding codes is additive; the client's fallback for an unknown code is the generic error.
- **D-22:** When `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` are unset and the route is called directly (the form is absent, so this is only ever a scanner or a half-configured forker), it returns **404** — externally indistinguishable from a deployment that never had the route — **plus a distinguishable server log line** naming the missing vars. Rationale: 404 matches the off-by-default narrative and leaks nothing, while the log line is what stops a forker who set one var and not the other from landing in `PITFALLS.md` Pitfall 2's silent-configuration-failure trap. Chosen over 503 (tells a scanner the feature exists but is unconfigured) and over a fake 200 (the worst outcome for the person actually trying to set it up).
- **D-23:** Request pipeline order is **env check → rate limit → honeypot → validation → Resend**. This fixes the one position `.planning/research/ARCHITECTURE.md`'s Subscribe Flow left unspecified. Honeypot-tripped requests **do** consume the submitting IP's budget, so no path — including the bot path — bypasses the limit, and a bot exhausts its own quota within 5 requests. A legitimate visitor never populates the honeypot, so this costs them nothing. Note this means D-10's counter measures *attempts*, not *subscriptions*.

### Logging & PII (SUB-04, SEC-03)

- **D-24:** The submitted email address is **never written to any log**, on any path — not on success, not on Resend failure, not domain-only, not hashed. Rationale: Vercel runtime logs are visible to anyone with dashboard access, and a forker who never thought about it would otherwise be accumulating a plaintext subscriber list there as a side effect of running the template. What debugging actually needs is *which stage failed*, not *who*. Consequence: log lines identify the stage and the Resend error, never the contact. (D-09's in-memory `Map` keys on the client IP; that stays in process memory and is likewise never logged.) — **Reversibility:** reversible in code, but note that anything already logged cannot be un-logged, which is why the strict direction is the default.
- **D-25:** Only **failure and configuration** events are logged: Resend errors, D-18's partial failure, and D-22's unconfigured call. **Honeypot drops and 429s are not logged at all** — they are high-frequency and low-information, and logging them would let a bot drive a forker's log volume. Successful subscriptions are not logged either (with D-24 in force, such a line could only say "one happened", which Vercel's short log retention makes useless for analytics anyway).

### Verification split (roadmap success criteria)

- **D-26:** Success criteria are split by what a live Resend account is needed for. **Closed inside this phase, no credentials required:** SC#2 (unset env → no form in server-rendered HTML), SC#4 (honeypot / over-limit submissions rejected, exercised against the route directly), SC#5 (grep the built client bundle for `RESEND_API_KEY`). **Carried to an operator checklist:** SC#1 (address actually lands in the Audience) and the live half of SC#3 (two real submissions diffed). Rationale: Phases 1 and 2 both deferred their *entire* live-verification set for want of credentials; this phase deliberately closes everything that a local build can prove rather than repeating that. The carried items go in the phase's validation document with the same operator-confirmation shape Phase 2 used.

### Claude's Discretion

- Exact copy wording for every string in both locales (D-06 fixes only the mechanism, not the text), including the `code` → message mapping introduced by D-21.
- Pending/in-flight submit affordance — disabled button, spinner, or label swap — no preference expressed.
- Field layout within each variant (input and button on one row vs. stacked), heading presence, and whether an explanatory one-liner sits above the input.
- The honeypot field's name and hiding technique.
- Cleanup strategy for expired entries in D-09's `Map` (sweep on write, lazy expiry on read, etc.).
- Exact file/module names beyond the `components/subscribe/` directory implied by the `components/comments/` convention. (`apps/web/src/lib/email.ts` is now fixed by D-20, no longer discretionary.)
- Exact log-line wording and level for the D-25 events, following the repo's `[Context] message` prefix convention.
- Whether the D-22 404 is produced via `new Response(null, { status: 404 })` or Next's `notFound()` equivalent in a route handler.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Subscribe (SUB) and §Access Control (SEC) — SUB-01 through SUB-04 and SEC-03, the exact requirement wording this phase must satisfy
- `.planning/REQUIREMENTS.md` §Out of Scope — double opt-in, CAPTCHA, preference center, and a distributed/Redis-backed rate limiter are all explicitly excluded; do not reintroduce them
- `.planning/ROADMAP.md` §Phase 3: Subscribe Path — the Goal and the 5 success criteria the plan must satisfy, including criterion 5 (grep the built client bundle to prove `RESEND_API_KEY` never appears in it)
- `.planning/PROJECT.md` §Constraints and §Key Decisions — the fail-closed theme, "no new infrastructure", and the locked server-component-gating decision

### Research (2026-07-24 session)
- `.planning/research/ARCHITECTURE.md` §"Component Responsibilities" and the `SubscribeSection`/`SubscribeForm` split — the exact two-component shape D-04 builds on, including why `next/dynamic({ ssr: false })` does NOT solve this problem
- `.planning/research/ARCHITECTURE.md` §"Subscribe Flow (visitor-facing, low trust)" — the request-path ordering (env check → honeypot → validation → Resend) this route should follow
- `.planning/research/ARCHITECTURE.md` §"Bundle-cost note" — why a `null`-returning Server Component means the form's JS chunk is never referenced on that deployment
- `.planning/research/FEATURES.md` §"Table stakes" rows on bot mitigation and per-IP rate limiting — establishes that honeypot + rate limit + enumeration-safe response is *the* compensating layer for skipping double opt-in, not an optional add-on
- `.planning/research/PITFALLS.md` §"Integration Gotchas" → Resend (Audiences) row — re-adding a previously unsubscribed contact via `create` may silently recreate them as unsubscribed (`resend/resend-node#458`). **D-17 neutralizes this** by always following `create` with an explicit `update({ unsubscribed: false })`; read the row anyway so the reason for the second call is not "optimized away" during planning or review
- `.planning/research/PITFALLS.md` §"Pitfall 1: Wrong Resend product quota" — why D-19 picks the official SDK: the expensive mistake it describes (a per-subscriber `emails.send()` loop instead of one `broadcasts.send()`) is Phase 4's, but the client this phase establishes is what Phase 4 will reach for
- `.planning/research/PITFALLS.md` §"Pitfall 2: Domain verification" — the silent-configuration-failure class D-22's server log line exists to interrupt; the full fix is Phase 6's README work, not this phase's

### Existing Codebase
- `apps/web/src/components/comments/CommentSection.tsx` — the convention this phase mirrors and deliberately diverges from: the env-absent `if (!appId) return null` gate (lines 284–288), and the `CONFIG.site.locale === "ko"` copy ternaries D-06 adopts
- `apps/web/src/templates/default/Layout.tsx` — both the mobile `md:hidden` block and the desktop 3-column grid render `<Profile />`; D-01 places the form directly under it in both
- `apps/web/src/components/Profile.tsx` — the sidebar card the `default` variant sits beneath; its width and visual treatment constrain that variant's layout
- `apps/web/src/templates/terminal/PostPage.tsx` — where the `terminal` variant goes; note `CommentSection` sits in an `mt-16` wrapper and a `TerminalConsole` block follows the article
- `apps/web/src/app/api/og/route.tsx` — the only existing route handler in the repo; reference for route-file conventions (this one is Edge runtime; `/api/subscribe` must be Node runtime because the Resend SDK is not edge-safe)
- `apps/web/src/site.config.ts` — `CONFIG.site.locale` (read by D-06) and `CONFIG.template` (selects which template renders)

### Prior Phase Context (carried forward)
- `.planning/phases/01-notion-data-layer/01-CONTEXT.md` — Phase 1's D-03 established that typed, `catch`-able errors are the house style for anything a caller must branch on, a deliberate departure from the repo's swallow-everything convention; the same reasoning applies to this route's failure branches
- `.planning/phases/02-backfill-script/02-CONTEXT.md` — no direct dependency, but it records the same fail-fast-on-setup-error posture this phase's env gate continues

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommentSection.tsx`'s `if (!appId) return null` gate — the exact fail-closed shape SEC-03 needs, except it must move from a Client Component to a Server Component so the secret is never serialized into the client payload. It is the pattern to copy structurally, and the anti-pattern to avoid mechanically.
- `CONFIG.site.locale` ternaries in `CommentSection.tsx` — the ready-made i18n idiom D-06 adopts verbatim.
- Tailwind design tokens already defined in `globals.css` (`bg-surface`, `text-text-primary`, `border-border`, and the `terminal-*` family used across `templates/terminal/`) — both variants should compose these rather than introduce new colors; dark/light is handled for free.

### Established Patterns
- One directory per optional, env-gated feature under `apps/web/src/components/` (`comments/` today) — `subscribe/` follows it directly.
- `"use client"` only where hooks are actually needed; pages and layouts stay async Server Components. The Section/Form split in D-04 is this rule applied to a secret-reading boundary.
- Zero test framework exists in the repo (confirmed, tracked in `TODOS.md`). The roadmap's success criteria for this phase are therefore manual/inspection-based — notably criterion 5, which is a grep against build output, not a unit test.
- No route handler in the repo does input validation today (`/api/og` only reads query params), so `/api/subscribe`'s validation and error-shape conventions are being established, not extended.

### Integration Points
- `apps/web/src/templates/default/Layout.tsx` — two insertion points (mobile block after `<Profile />`, desktop right `<aside>` after `<Profile />`), per D-01 and D-03.
- `apps/web/src/templates/terminal/PostPage.tsx` — one insertion point below the article, per D-01.
- `apps/web/src/app/api/subscribe/route.ts` — new file; the repo's first non-Edge route handler, and the first to do input validation or return a structured error body (D-21).
- `apps/web/src/lib/email.ts` — new file per D-20; Resend client construction only. Phase 4 imports it; nothing else in Phase 3 depends on it beyond the route.
- `apps/web/package.json` — the `resend` SDK is not currently a dependency anywhere in the monorepo (grep-confirmed) and must be added here, not to `packages/core`; `packages/core` stays Notion-only (D-19).
- Nothing in `packages/core` changes in this phase.

</code_context>

<specifics>
## Specific Ideas

The user reversed their own first answer on placement mid-discussion, and the reason is the most important signal in this document: NoLog is a **template other people fork and extend**, so the question is not only "where does the form look best" but "what will a third-party developer building a new template copy from what they see here". That drove D-01 and D-02 (per-template placement and a per-template visual variant, rather than one shared component reused verbatim as `CommentSection` does), and it is why D-04 keeps the env gate singular — the variation should live in presentation, never in the security boundary.

The second consistent thread: prefer honest signals to a visitor (D-07's inline error, D-11's real 429) but opaque signals to an attacker (D-13's fake-success honeypot). The dividing line the user drew is whether the response teaches an adversary something actionable, not whether it is "quiet".

The second pass (D-17 through D-26) extended that same dividing line to a third audience — **the forker operating the deployment**. D-22 is the clearest case: the *external* response is the maximally opaque 404, while the *server log* says exactly which env var is missing. D-24/D-25 are the mirror image: the log is where honesty is owed, so it must not be diluted with bot noise (D-25) or contaminated with subscriber addresses the forker never agreed to collect (D-24). Where the earlier pass asked "does this teach an attacker anything", this pass asked "does the person who has to run this deployment learn what they need, and nothing they shouldn't be holding".

The third thread is a preference for **structural correctness over verified correctness** when a third-party behavior is undocumented. D-17 does not test what `resend-node` does on a re-create; it makes the answer not matter. D-17/D-18's shared code path makes SC#3's enumeration-safety a property of the implementation rather than something to confirm by diffing responses afterward. D-26 continues the same instinct from the opposite side — close everything a local build can prove now, and stop carrying whole verification sets forward the way Phases 1 and 2 both had to.

</specifics>

<deferred>
## Deferred Ideas

- **Time-on-page bot trap** (D-14) — researched and recommended by `.planning/research/FEATURES.md`, consciously left out of this phase's scope. Revisit only if real bot signups actually appear; it pairs naturally with `TODOS.md`'s NOTF-03 "you were just subscribed" notice, which is v2 and gated on the same trigger.
- **Extracting form copy into `site.config.ts`** (D-06) — a forker-friendliness improvement that belongs with any future pass that revisits i18n across the whole template, not with this feature alone.
- **Subscribe form on the home feed / additional placements** — considered and rejected during the placement discussion; belongs to a growth/conversion pass, not this one.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 3.

</deferred>

---

*Phase: 3-Subscribe Path*
*Context gathered: 2026-07-26*
