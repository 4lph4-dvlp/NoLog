# Phase 3: Subscribe Path - Context

**Gathered:** 2026-07-26
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

### Claude's Discretion

- Exact copy wording for every string in both locales (D-06 fixes only the mechanism, not the text).
- Pending/in-flight submit affordance — disabled button, spinner, or label swap — no preference expressed.
- Field layout within each variant (input and button on one row vs. stacked), heading presence, and whether an explanatory one-liner sits above the input.
- The honeypot field's name and hiding technique.
- Cleanup strategy for expired entries in D-09's `Map` (sweep on write, lazy expiry on read, etc.).
- Exact file/module names beyond the `components/subscribe/` directory implied by the `components/comments/` convention, and where the Resend client is instantiated (research suggests `apps/web/src/lib/email.ts`).

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
- `.planning/research/PITFALLS.md` §"Integration Gotchas" → Resend (Audiences) row — re-adding a previously unsubscribed contact via `create` may silently recreate them as unsubscribed (`resend/resend-node#458`); verify against the actual SDK version rather than assuming a plain create resubscribes

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
- `apps/web/src/app/api/subscribe/route.ts` — new file; the repo's first non-Edge route handler.
- `apps/web/package.json` — the `resend` SDK is not currently a dependency anywhere in the monorepo (grep-confirmed) and must be added here, not to `packages/core`; `packages/core` stays Notion-only.
- Nothing in `packages/core` changes in this phase.

</code_context>

<specifics>
## Specific Ideas

The user reversed their own first answer on placement mid-discussion, and the reason is the most important signal in this document: NoLog is a **template other people fork and extend**, so the question is not only "where does the form look best" but "what will a third-party developer building a new template copy from what they see here". That drove D-01 and D-02 (per-template placement and a per-template visual variant, rather than one shared component reused verbatim as `CommentSection` does), and it is why D-04 keeps the env gate singular — the variation should live in presentation, never in the security boundary.

The second consistent thread: prefer honest signals to a visitor (D-07's inline error, D-11's real 429) but opaque signals to an attacker (D-13's fake-success honeypot). The dividing line the user drew is whether the response teaches an adversary something actionable, not whether it is "quiet".

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
