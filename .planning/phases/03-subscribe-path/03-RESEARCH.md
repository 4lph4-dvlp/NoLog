# Phase 3: Subscribe Path - Research

**Researched:** 2026-07-26
**Domain:** Env-gated subscribe form (Server/Client Component split) + a Node-runtime Next.js route handler calling the Resend contacts API, with in-memory abuse mitigation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Form placement & template coverage**
- **D-01:** Per-template placement — `default` template: under the `Profile` card (mobile block and desktop right `<aside>`, both after `<Profile />`, no responsive branch beyond that). `terminal` template: below the post, inside `PostPage.tsx`. Deliberately diverges from `CommentSection`'s identical-placement pattern, because a third-party developer building a third template should read the per-template pattern as the thing to copy.
- **D-02:** `terminal` gets a distinct CLI-prompt visual variant, not the `default` markup reused.
- **D-03:** Consequence accepted: `default`'s form renders on every page (home, post, category, search) and re-mounts on navigation, since `Profile` lives in `Layout.tsx`; `terminal`'s appears only on post pages. Intentional asymmetry.

**Env gating structure (SEC-03)**
- **D-04:** Exactly one env gate: a single `SubscribeSection` Server Component reads `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` and either returns `null` or renders `<SubscribeForm variant="default" | "terminal" />`. Variation lives in a `variant` prop, not in duplicated Sections or duplicated gates.

**Post-submit UX & copy**
- **D-05:** On success, the form is replaced by an inline success message (input/button disappear). No toast, no persistent form-plus-note.
- **D-06:** All copy follows `CommentSection`'s `CONFIG.site.locale === "ko"` ternary pattern, hardcoded in the component. No new `site.config.ts` block.
- **D-07:** On a genuine server error, the form stays mounted with the entered value preserved and shows a generic, cause-free message. Explicitly distinct from "already subscribed" (which never reaches this branch, per D-17/D-18).
- **D-08:** Success state is `useState`-only — no `localStorage`/`sessionStorage`. Reload brings the form back.

**Rate limiting (SUB-04)**
- **D-09:** Module-scoped in-memory `Map` inside the route handler. Per-instance, resets on cold start — accepted as a bulk-abuse dampener, not a deterministic gate.
- **D-10:** Threshold: 5 submissions per IP per 10 minutes.
- **D-11:** Over-limit request gets a genuine `429` and a "try again shortly" message. Does not conflict with SUB-03 — a 429 discloses nothing about Audience membership.
- **D-12:** Missing/empty client IP (`x-forwarded-for` absent/empty) is bucketed under a single shared `"unknown"` key, subject to the same 5-per-10-minutes limit. Not waved through, not hard-rejected.

**Bot blocking & email validation (SUB-04, SUB-03)**
- **D-13:** Honeypot-populated submission → fake `200` identical to real success, silently dropped, never added to the Audience.
- **D-14:** Time-on-page trap explicitly NOT implemented (out of scope for this pass — see Deferred Ideas).
- **D-15:** Email validation is client `<input type="email" required>` plus a deliberately loose server regex (local part + `@` + dotted domain) as a bypass guard only. No strict RFC-style validation. Resend is final authority on address validity.
- **D-16:** Server normalizes with `trim()` + lowercase before any further processing, to prevent case-variant duplicate Audience entries.

**Resend contact semantics (SUB-01, SUB-03)**
- **D-17:** On every accepted submission: `contacts.create` followed unconditionally by `contacts.update({ unsubscribed: false })` — no branch on the create response, no prior Audience read. Neutralizes `resend/resend-node#458` by construction rather than by testing SDK behavior.
- **D-18:** If `create` succeeds but the follow-up `update` fails: report the D-07 generic error, not success. No in-route retry loop. The path is idempotent — a visitor retry is the recovery mechanism.
- **D-17/D-18 consequence:** first-time and resubscribing addresses run through the identical code path, so SC#3's enumeration-safety is structural, not response-diffed after the fact.

**Resend client & dependency (SUB-01)**
- **D-19:** Official `resend` SDK, added to `apps/web` (not `packages/core`). Route is Node runtime, not Edge.
- **D-20:** Resend client constructed in `apps/web/src/lib/email.ts` — client construction only, no broadcast helpers, no templates. Phase 4 imports it.

**Route response contract (SUB-03, SUB-04, SEC-03)**
- **D-21:** `{ ok: true }` on success; `{ ok: false, code: "invalid_email" | "rate_limited" | "server_error" }` on failure — machine codes only, never display prose. Client maps `code` → locale-appropriate message via D-06's ternary convention.
- **D-22:** Unset env vars + direct call → `404`, indistinguishable from a route that never existed, plus a distinguishable server log line naming the missing var(s). Not `503` (leaks feature existence), not a fake `200` (worst outcome for a half-configured forker).
- **D-23:** Pipeline order: **env check → rate limit → honeypot → validation → Resend**. Honeypot-tripped requests DO consume the submitting IP's rate-limit budget — no path bypasses the limit. D-10's counter measures attempts, not subscriptions.

**Logging & PII (SUB-04, SEC-03)**
- **D-24:** Submitted email is never logged, on any path, in any form (not domain-only, not hashed). Log lines identify stage + Resend error, never the contact. The rate-limiter's IP key stays in process memory and is also never logged.
- **D-25:** Only failure/configuration events are logged: Resend errors, D-18's partial failure, D-22's unconfigured call. Honeypot drops and 429s are NOT logged (high-frequency, low-information, bot-driven log volume risk). Successful subscriptions are not logged either.

**Verification split (roadmap success criteria)**
- **D-26:** Closed inside this phase, no credentials required: SC#2 (unset env → no SSR form), SC#4 (honeypot/rate-limit rejection, exercised directly against the route), SC#5 (grep built client bundle for `RESEND_API_KEY`). Carried to an operator checklist: SC#1 (live Audience add) and the live half of SC#3 (two real submissions diffed).

### Claude's Discretion
- Exact copy wording for every string in both locales, including the `code` → message mapping.
- Pending/in-flight submit affordance (disabled button, spinner, label swap).
- Field layout within each variant (one row vs. stacked, heading presence, explanatory one-liner).
- The honeypot field's name and hiding technique.
- Cleanup strategy for expired entries in D-09's `Map`.
- Exact file/module names beyond `components/subscribe/` and the now-fixed `lib/email.ts` (D-20).
- Exact log-line wording/level for D-25 events, following `[Context] message`.
- Whether the D-22 404 uses `new Response(null, { status: 404 })` or Next's `notFound()` equivalent in a route handler.

### Deferred Ideas (OUT OF SCOPE)
- Time-on-page bot trap (D-14) — revisit only if real bot signups appear.
- Extracting form copy into `site.config.ts` (D-06) — belongs to a future i18n-wide pass.
- Subscribe form on additional placements (home feed, etc.) — belongs to a growth/conversion pass.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUB-01 | A visitor can submit their email to subscribe via a form on the blog | Resend `contacts.create`/`contacts.update` shapes (Standard Stack, Code Examples); route pipeline (Architecture Patterns Pattern 3) |
| SUB-02 | Subscribe form fully absent/inert when Resend env vars unset — same fail-closed contract as Cusdis | Server/Client boundary research (Architecture Patterns Pattern 1); SSR-absence verification method (Validation Architecture) |
| SUB-03 | Duplicate-email submission returns identical success response — no enumeration oracle | D-17/D-18 shared-code-path analysis; Resend contact semantics (Common Pitfalls, Code Examples) |
| SUB-04 | Endpoint blocks bots via honeypot + per-IP rate limiting | Honeypot accessibility technique (Code Examples); `x-forwarded-for` extraction on Vercel (Common Pitfalls); in-memory `Map` behavior across invocations (Common Pitfalls) |
| SEC-03 | Subscribe form gated server-side; `RESEND_API_KEY` never reaches client bundle | Server Component env-gate pattern (Architecture Patterns Pattern 1); bundle-grep verification method (Validation Architecture) |
</phase_requirements>

## Summary

This phase is additive to an already-researched design: `.planning/research/ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md`, and `STACK.md` (2026-07-24 session) already specify the `SubscribeSection`/`SubscribeForm` split, the `resend` SDK pin, the honeypot+rate-limit+enumeration-safety mitigation stack, and the `resend/resend-node#458` gotcha that D-17 neutralizes structurally. This document does not re-derive those — it verifies the exact API call shapes, Next.js 16 route-handler mechanics, and the Vercel header behavior D-12 depends on, all against current (2026-07-26) sources, and translates D-01 through D-26 into concrete file-level guidance grounded in the actual repo (`CommentSection.tsx`, `Layout.tsx`, `terminal/PostPage.tsx`, `api/og/route.tsx`, `site.config.ts`, `globals.css`).

Three findings matter most for planning. First, `resend.contacts.create()` and `resend.contacts.update()` both accept `email` as an identifier and return `{ object: "contact", id }` — the exact shapes needed for D-17's unconditional create-then-update pair. Second, `resend/resend-node#458` is **closed as "not planned"** by the Resend maintainers — there is no upstream fix coming, which confirms D-17's structural workaround is the permanent answer, not a stopgap to remove later. Third, Vercel's own request-headers documentation confirms `x-forwarded-for` carries the public client IP and can be a comma-separated list (take the first entry) — it does not document the header ever being empty on a direct Vercel request, but D-12's "unknown" bucket is still the correct defensive default for local dev, unusual proxy chains, and any future platform change.

The `resend` npm package legitimacy check returned a `SUS` "too-new" signal — this is a **false positive** the planner should not act on: `npm view resend time.created` shows first publication in 2017 (166 published versions, 8.6M weekly downloads, official `resend/resend-node` GitHub repo, no postinstall script). The seam's heuristic is reading the *latest version's* publish timestamp (2026-07-21, five days before this research), not the package's creation date. See Package Legitimacy Audit below.

**Primary recommendation:** Build `SubscribeSection` (Server) → `SubscribeForm` (Client, `variant` prop) exactly as D-04 specifies, route all Resend calls through `apps/web/src/lib/email.ts` (D-20), and implement the route handler's pipeline in the exact D-23 order using `Response.json(body, { status })` (or `NextResponse.json`), a module-scoped `Map` keyed by the first entry of `x-forwarded-for` split on comma (falling back to `"unknown"`), and the unconditional `create` → `update({ unsubscribed: false })` pair for every accepted submission.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Env-configured / not-configured decision (SEC-03 gate) | Frontend Server (SSR) | — | `SubscribeSection` reads `process.env.RESEND_API_KEY`/`RESEND_AUDIENCE_ID` at render time; this must happen server-side because the value is a secret, never a `NEXT_PUBLIC_*` var (Anti-Pattern 1 in `ARCHITECTURE.md`) |
| Form rendering, client-side validation feedback, submit state | Browser / Client | — | `SubscribeForm` is a `"use client"` island; owns `useState` for pending/success/error, has no knowledge of whether the feature is "on" |
| Honeypot field rendering | Browser / Client | — | The hidden input is pure DOM/CSS; its presence in the client bundle is unavoidable once `SubscribeForm` ships (bundle-cost note below) |
| Request body parsing, honeypot check, email validation, rate-limit check | API / Backend | — | `/api/subscribe` route handler, Node runtime — all D-23 pipeline stages except the final Resend call live here |
| Per-IP rate-limit counter storage | API / Backend | — | Module-scoped in-memory `Map` inside the route handler process (D-09); explicitly not a separate store |
| Contact create/update against Resend | API / Backend | External Service (Resend) | Route handler calls `resend.contacts.create`/`.update`; Resend owns the actual Audience persistence |
| Secret exclusion from client bundle | Frontend Server (SSR) / Build boundary | Browser / Client (verification target) | Enforced by the Server/Client Component split at the React Server Components flight-protocol level, verified post-build by grepping `.next/static` output (not a runtime check) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | `6.18.0` (confirmed current via `npm view resend version`, 2026-07-26) | Official Node/TS SDK for `contacts.create`/`contacts.update` against a Resend Audience | Locked by D-19; official first-party SDK, 8.6M weekly downloads, no viable alternative for Resend's own API `[VERIFIED: npm registry]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in `node:crypto` | Built-in (Node 22.23.1 confirmed in this environment) | Not required by this phase | `timingSafeEqual` is a Phase 4 concern (`CRON_SECRET` comparison) — D-04's env gate is a presence check (`Boolean(a && b)`), not a secret comparison, so no crypto import is needed in `/api/subscribe` |
| None additional | — | — | Honeypot field and rate-limit `Map` are hand-rollable per `STACK.md`; do not add a form library, a bot-detection SaaS, or a KV/Redis client (all explicitly out of scope per `REQUIREMENTS.md`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module-scoped `Map` rate limiter (D-09, locked) | Vercel KV / Upstash Redis | Deterministic across instances, but is new infrastructure — explicitly out of scope; not worth reconsidering |
| Deliberately loose server email regex (D-15, locked) | `zod` `.email()` or a full RFC 5322 validator | Stricter validation rejects valid real-world addresses (plus-tags, new TLDs) — the exact failure mode D-15 rejects; do not introduce |
| `resend.contacts.create` + unconditional `.update` (D-17, locked) | Read Audience state first, branch on prior `unsubscribed` status | Makes correctness depend on an undocumented, version-dependent SDK response shape — exactly what D-17 was designed to avoid |

**Installation:**
```bash
npm install resend --workspace=apps/web
```

**Version verification:** `npm view resend version` → `6.18.0` (matches `STACK.md`'s `^6.18.0` recommendation from the 2026-07-24 research session; no breaking changes have landed in the intervening two days). `npm view resend time.created` → `2017-02-25T13:01:05.309Z` (package is 9+ years old — see Package Legitimacy Audit for why the automated check flagged it anyway).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `resend` | npm | 9+ yrs (first published 2017-02-25; seam's `publishedAt` signal reflects the *latest version's* release date, 2026-07-21, not package creation) | 8,616,444/wk | `github.com/resend/resend-node` | `SUS` (raw seam output — reason: `"too-new"`) | **Approved — false positive, verified.** `npm view resend time.created` confirms 2017 origin; 166 published versions; official first-party SDK for the already-locked Resend integration (D-19); no `postinstall` script (`npm view resend scripts.postinstall` → empty) |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `resend` — flagged only due to a heuristic misreading "latest version publish date" as "package age." Cross-verified via `npm view resend time.created` (2017), `npm view resend versions` (166 entries), and the official GitHub repo link returned by the registry itself. **No `checkpoint:human-verify` is warranted** given this direct, tool-based contradiction of the "too-new" signal — but the planner should still note in the plan that this package was audited and cleared, so a future reviewer doesn't re-trip on the same seam output.

## Architecture Patterns

### System Architecture Diagram

```
Visitor's browser
    │
    │ 1. GET / (or /post/[id], /category/[slug], /search)
    ▼
Next.js Server Component render (Layout.tsx / PostPage.tsx)
    │
    ├─ default template: Layout.tsx renders <Profile/> then <SubscribeSection variant="default"/>
    │                      (mobile block AND desktop <aside>, per D-01/D-03 — two insertion points)
    └─ terminal template: PostPage.tsx renders <SubscribeSection variant="terminal"/> below the article
                            (one insertion point, post pages only)
    │
    ▼
SubscribeSection (Server Component, no "use client")
    │  reads process.env.RESEND_API_KEY / RESEND_AUDIENCE_ID
    │
    ├─ unset ──▶ return null  (nothing enters the RSC flight payload — SC#2/SEC-03)
    │
    └─ set ──▶ <SubscribeForm variant={variant} />
                    │
                    ▼
        SubscribeForm (Client Component, "use client")
            renders <input type="email">, honeypot <input>, submit button
            on submit ──▶ POST /api/subscribe  { email, <honeypot-field-name>: "" }
                                │
                                ▼
                ┌───────────────────────────────────────────────────┐
                │ /api/subscribe route handler (Node runtime)         │
                │                                                     │
                │ 1. env check:  RESEND_API_KEY && RESEND_AUDIENCE_ID │
                │      missing ──▶ 404 + server log naming the var   │
                │                                                     │
                │ 2. rate limit: Map.get(ip ?? "unknown")             │
                │      over 5/10min ──▶ 429  (SUB-04, D-11)          │
                │                                                     │
                │ 3. honeypot: field populated?                       │
                │      yes ──▶ fake 200 identical to success, drop   │
                │              (still consumed the rate-limit slot)  │
                │                                                     │
                │ 4. validation: trim+lowercase (D-16), loose regex  │
                │      fail ──▶ { ok:false, code:"invalid_email" }   │
                │                                                     │
                │ 5. resend.contacts.create({ email, audienceId })    │
                │    resend.contacts.update({ email, unsubscribed:false }) — ALWAYS, unconditionally (D-17)
                │      create/update fails ──▶ { ok:false, code:"server_error" } (D-18, no retry)
                │      both succeed ──▶ { ok:true }                  │
                └───────────────────────────────────────────────────┘
                                │
                                ▼
                        Resend API (external) — Audience contact store
```

### Recommended Project Structure
```
apps/web/src/
├── app/
│   └── api/
│       └── subscribe/
│           └── route.ts              # NEW — Node runtime, POST handler, D-23 pipeline
├── components/
│   └── subscribe/                    # NEW — mirrors components/comments/ convention
│       ├── SubscribeSection.tsx      # Server Component — single env gate (D-04)
│       └── SubscribeForm.tsx         # Client Component — variant prop, honeypot, D-05/D-07/D-08 state
├── lib/
│   └── email.ts                      # NEW — Resend client construction only (D-20)
├── templates/
│   ├── default/Layout.tsx            # EDIT — two insertion points after <Profile/> (D-01/D-03)
│   └── terminal/PostPage.tsx         # EDIT — one insertion point below the article (D-01)
└── site.config.ts                    # UNCHANGED (D-06 — no new config block)
```

### Pattern 1: Server-Component env gate + Client-Component island

**What:** `SubscribeSection` (Server) reads the two env vars and either returns `null` or renders `SubscribeForm` (Client) with a `variant` prop. Already fully specified in `.planning/research/ARCHITECTURE.md` Pattern 2 — re-cited here because it is the exact mechanism SEC-03 and SC#2 depend on.

**When to use:** Any feature gated on a *secret* (not a `NEXT_PUBLIC_*` value). This is why `CommentSection`'s self-gating pattern (reading `NEXT_PUBLIC_CUSDIS_APP_ID` inside a `"use client"` component) is the pattern to structurally diverge from, per D-04's rationale and `ARCHITECTURE.md` Anti-Pattern 1.

**Example (verified against this repo's actual `CommentSection.tsx` gate + Next.js 16 Server/Client Component composition, current as of 2026-07-26):**
```typescript
// apps/web/src/components/subscribe/SubscribeSection.tsx
import { SubscribeForm } from "./SubscribeForm";

interface SubscribeSectionProps {
  variant: "default" | "terminal";
}

export function SubscribeSection({ variant }: SubscribeSectionProps) {
  const configured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID
  );

  if (!configured) return null; // SC#2: nothing enters the RSC payload for this render

  return <SubscribeForm variant={variant} />;
}
```

**Bundle-cost confirmation:** Next.js's React Server Components flight protocol only emits a script reference for a Client Component into a page's payload when that page actually renders it. A `null`-returning `SubscribeSection` means `SubscribeForm`'s chunk is referenced by zero rendered pages on an unconfigured deployment — this is a build-artifact detail (the chunk file still exists in `.next/`), not a runtime leak, and is orthogonal to the SC#5 grep check (which targets the literal string `RESEND_API_KEY`, not chunk presence).

### Pattern 2: D-23 pipeline order in the route handler

**What:** `env check → rate limit → honeypot → validation → Resend`, each stage an early return, verified against current Next.js 16 route handler conventions.

**Verified route handler mechanics (Next.js 16.2.11 docs, fetched 2026-07-26):**
- `export async function POST(request: Request) { ... }` — the Web `Request`/`Response` APIs, optionally the `NextRequest`/`NextResponse` extensions.
- Body: `const body = await request.json();`
- Response with status: `return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });` or the `NextResponse.json(...)` equivalent — both are current, verified syntax `[CITED: nextjs.org/docs/app/getting-started/route-handlers]`.
- POST route handlers are **not cached by default** (only `GET` can opt into caching via `export const dynamic = 'force-static'`) — no caching concern for this mutating endpoint `[CITED: nextjs.org/docs/app/getting-started/route-handlers]`.
- Default runtime is `nodejs` when `export const runtime` is omitted; explicitly declaring `export const runtime = "nodejs"` is optional documentation, not required for correctness `[CITED: nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime]`. Given D-19 locks Node runtime and the existing `/api/og/route.tsx` shows the repo's convention of declaring `runtime` explicitly for the *opposite* case (`"edge"`), declaring `export const runtime = "nodejs"` explicitly in `/api/subscribe/route.ts` is recommended for symmetry/self-documentation even though it's the default.

**Example (client-IP extraction + rate limiter, grounded in Vercel's authoritative header docs):**
```typescript
// apps/web/src/app/api/subscribe/route.ts (excerpt)
export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // D-10
const RATE_LIMIT_MAX = 5; // D-10

// Module-scoped — persists only within one serverless instance's lifetime (D-09).
const attempts = new Map<string, { count: number; windowStart: number }>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  // Vercel docs: x-forwarded-for is the public client IP, and may be a
  // comma-separated list when multiple proxies are involved — take the first entry.
  const ip = forwarded?.split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : "unknown"; // D-12
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}
```
*Source basis: `x-forwarded-for` = "The public IP address of the client that made the request" and "may be a comma-separated list" behavior is Vercel's own documented pattern (`[CITED: vercel.com/docs/headers/request-headers]`); Vercel's docs also note `x-forwarded-for` is overwritten (not forwarded from upstream) when the deployment sits behind another proxy, which is a defense-in-depth argument for D-12's fail-closed "unknown" bucket rather than trusting the header blindly.*

### Pattern 3: Unconditional create-then-update (D-17) — exact Resend call shapes

**What:** Verified against Resend's own API reference (fetched 2026-07-26):

```typescript
// apps/web/src/lib/email.ts
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
```

```typescript
// apps/web/src/app/api/subscribe/route.ts (excerpt) — D-17/D-18
import { resend } from "@/lib/email";

const audienceId = process.env.RESEND_AUDIENCE_ID!;

const { error: createError } = await resend.contacts.create({
  email: normalizedEmail,
  audienceId,
  unsubscribed: false,
});

if (createError) {
  // [Subscribe] Resend create failed — never logs normalizedEmail (D-24)
  console.error(`[Subscribe] Resend contact create failed: ${createError.message}`);
  return Response.json({ ok: false, code: "server_error" }, { status: 500 });
}

// Unconditional follow-up — neutralizes resend/resend-node#458 regardless of
// what `create` actually did under the hood (D-17).
const { error: updateError } = await resend.contacts.update({
  email: normalizedEmail,
  audienceId,
  unsubscribed: false,
});

if (updateError) {
  // D-18: create succeeded but the follow-up didn't — report the generic
  // error, not success, since "subscribed and receiving" wasn't reached.
  console.error(`[Subscribe] Resend contact update (post-create) failed: ${updateError.message}`);
  return Response.json({ ok: false, code: "server_error" }, { status: 500 });
}

return Response.json({ ok: true });
```

**Verified shapes** `[CITED: resend.com/docs/api-reference/contacts/create-contact]` `[CITED: resend.com/docs/api-reference/contacts/update-contact]`:
- `contacts.create({ email, audienceId, firstName?, lastName?, unsubscribed? })` → `{ data: { object: "contact", id }, error }` (Node SDK wraps the raw API response in a `{ data, error }` tuple, per Resend's standard SDK convention — confirm this exact tuple shape against the installed `resend@6.18.0` TypeScript types during implementation, since the fetched docs pages show the *raw* request/response body, not the SDK wrapper, verbatim).
- `contacts.update({ id?, email?, audienceId?, unsubscribed?, ... })` — accepts either `id` or `email` as the identifier; `email` is the natural choice here since the route never has a prior `id` to hand.

**`resend/resend-node#458` status** `[CITED: github.com/resend/resend-node/issues/458]`: filed 2025-01-15, describes exactly the bug D-17 was designed around ("Whether I send it as true or false, [the contact is] always created as an unsubscribed contact"), and is **closed as "not planned."** No maintainer fix is coming — D-17's unconditional `update` call is the permanent mitigation, not a temporary workaround to remove once Resend patches it.

### Anti-Patterns to Avoid
- **Reading `RESEND_API_KEY` inside `SubscribeForm` (a `"use client"` component):** the exact mistake `ARCHITECTURE.md` Anti-Pattern 1 already documents — the danger isn't just "it won't work," it's the future "fix" of prefixing it `NEXT_PUBLIC_RESEND_API_KEY`, which would ship the secret to every visitor.
- **Branching on the `contacts.create` response to decide whether a follow-up `update` is needed:** defeats the entire point of D-17 — the follow-up must be unconditional, not conditional on inspecting `error` or a resubscribe-specific response field.
- **`cache()`-wrapping any call inside `/api/subscribe`:** this route is a one-shot mutation, not a read — the same reasoning `ARCHITECTURE.md` Anti-Pattern 4 gives for `markEmailed()` applies identically here.
- **`display: none` or `visibility: hidden` on the honeypot field:** both are trivially detected via `getComputedStyle()` by moderately sophisticated bots — see Code Examples below for the off-screen technique instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Accessible bot-honeypot hiding | A hand-invented CSS trick (e.g., `display:none`, `font-size:0`) with no `aria-hidden`/`tabindex` handling | The documented off-screen (`position:absolute; left:-9999px` or similar) + `aria-hidden="true"` + `tabIndex={-1}` + non-standard `autoComplete` combination | Naive hiding is both bot-detectable (`getComputedStyle`) and screen-reader-unsafe; this is a well-trodden, well-documented pattern with known failure modes, not something to improvise `[CITED: css-tricks.com/building-a-honeypot-field-that-works]` |
| Enumeration-safe "already subscribed" handling | A manual read-then-branch ("check if contact exists, return different codes") | D-17/D-18's unconditional create+update pair, whose response codes are identical for both cases by construction | The manual version is exactly the "response differs for new vs. existing" oracle SUB-03 forbids, and is also the pattern that would re-expose `resend/resend-node#458`'s bug by relying on `create`'s response shape |
| Email address validation | A full RFC 5322 regex or a validation library | Browser `<input type="email">` + D-15's deliberately loose server regex | Locked by D-15 — strict validation over-blocks valid real-world addresses; Resend is the final authority |
| Rate-limit storage | Redis/Vercel KV client | The module-scoped `Map` (D-09) | New infrastructure is explicitly out of scope; the `Map`'s per-instance/cold-start limitations are an accepted tradeoff, not a gap to "fix" with more infrastructure |

**Key insight:** every "don't hand-roll" row above is a place where a *plausible-looking* custom implementation quietly reintroduces a problem this phase's locked decisions already solved (an enumeration oracle, a bot-visible honeypot, an over-strict email gate). The correct posture during planning is "assemble the pieces D-01–D-26 specify," not "improve on them."

## Common Pitfalls

### Pitfall 1: Treating `resend.contacts.create`'s response as proof the contact is subscribed
**What goes wrong:** A developer reads `contacts.create`'s success response (`{ object: "contact", id }`) as confirmation the contact is now active and subscribed, and skips the D-17 follow-up `update` call "since create already worked."
**Why it happens:** The response shape gives no visible signal that the created contact might silently be `unsubscribed: true` under the hood — this is exactly `resend/resend-node#458`'s bug, and it's invisible without inspecting the Audience dashboard or making a follow-up `contacts.get` call.
**How to avoid:** Treat D-17's `update` call as mandatory and unconditional in the plan's task list — not an "if time permits" hardening step.
**Warning signs:** A plan or PR that calls `contacts.create` and returns `{ ok: true }` without a subsequent `contacts.update({ unsubscribed: false })` call.

### Pitfall 2: `x-forwarded-for` handling that trusts a single, un-split value
**What goes wrong:** Code that does `request.headers.get("x-forwarded-for")` and uses the raw string directly as a `Map` key, without splitting on comma, can end up with inconsistent keys for the same physical client if intermediate proxies append additional hops to the header.
**Why it happens:** Vercel's own example code in some contexts shows the bare header read; the comma-separated-list behavior is documented but easy to miss on a first pass `[CITED: vercel.com/docs/headers/request-headers]`.
**How to avoid:** Always `.split(",")[0]?.trim()` before using the value as a rate-limit key, and fall back to `"unknown"` on empty/missing (D-12).
**Warning signs:** Rate-limit `Map` growing with near-duplicate keys that differ only by trailing proxy-hop IPs.

### Pitfall 3: Confusing "no test framework" with "no way to verify this phase's automatable criteria"
**What goes wrong:** Because the repo genuinely has zero test infrastructure (confirmed: no `jest`/`vitest`/`playwright` config, no `*.test.*`/`*.spec.*` files anywhere — matches `TODOS.md`'s standing note), a plan might default to marking every success criterion "manual, needs operator" — including SC#2, SC#4, and SC#5, which D-26 explicitly says do NOT need live credentials.
**Why it happens:** "No test framework" and "no live Resend account" are two different constraints; conflating them under-verifies criteria this phase can actually close locally.
**How to avoid:** Use the shell-script/curl-based verification approach in the Validation Architecture section below for SC#2/SC#4/SC#5 — these require a built Next.js app and `curl`, not a test runner and not live credentials.
**Warning signs:** A VALIDATION.md that carries SC#2, SC#4, or SC#5 to the operator checklist alongside SC#1/SC#3, contradicting D-26.

### Pitfall 4 (from prior research, re-flagged for this phase specifically): Wrong Resend product quota
**What goes wrong:** `PITFALLS.md` Pitfall 1 documents a Broadcast-vs-transactional quota confusion for the *notify* route (Phase 4). It does not directly apply to `/api/subscribe`'s `contacts.create`/`.update` calls (Audience/contact management is a different quota axis — contacts count toward the 1,000-contact Audience ceiling, not the send caps), but a plan reviewer should not conflate "adding a contact" with "sending an email" when reasoning about rate limits — this phase's rate limiter (D-09/D-10) is an abuse control, unrelated to Resend's own quotas.
**How to avoid:** Keep this phase's rate-limit discussion scoped to bot/abuse mitigation; the 1,000-contact Audience ceiling is a Phase 6 documentation concern, not a Phase 3 code concern.

## Code Examples

### Honeypot field (React, verified accessibility pattern)
```typescript
// apps/web/src/components/subscribe/SubscribeForm.tsx (excerpt)
// Field name deliberately plausible, not literally "honeypot" — bots that
// pattern-match on suspicious field names skip obviously-named traps.
<div
  aria-hidden="true"
  style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}
>
  <label htmlFor="company">
    {CONFIG.site.locale === "ko" ? "회사명 (입력하지 마세요)" : "Company (leave blank)"}
  </label>
  <input
    id="company"
    name="company"
    type="text"
    tabIndex={-1}
    autoComplete="off"
    value={honeypot}
    onChange={(e) => setHoneypot(e.target.value)}
  />
</div>
```
*Source basis: off-screen positioning over `display:none`/`visibility:hidden` (both trivially detected via `getComputedStyle()`), `aria-hidden="true"` to exclude from the accessibility tree, `tabIndex={-1}` to exclude from keyboard tab order, non-standard `autoComplete` value to reduce password-manager false-positive fills `[CITED: css-tricks.com/building-a-honeypot-field-that-works]`. This is a documented, known-tradeoffs pattern — password managers filling hidden/off-screen fields is a recognized residual false-positive source, which is exactly why D-13 responds with a fake success rather than a hard block: a false-positive human never sees anything different from a real success.*

### Route handler status-code responses (Next.js 16, verified)
```typescript
// D-21's machine codes, never display prose
return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
return Response.json({ ok: false, code: "rate_limited" }, { status: 429 });
return Response.json({ ok: false, code: "server_error" }, { status: 500 });
return Response.json({ ok: true }, { status: 200 });
```
*Source basis: `[CITED: nextjs.org/docs/app/getting-started/route-handlers]` — `Response.json(body, { status })` is the current, verified syntax for Next.js 16 App Router route handlers; `NextResponse.json(...)` is the drop-in equivalent if `NextRequest`/`NextResponse` are already imported for other reasons (e.g., typed params).*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Resend Audiences scoped per-Audience (a contact only "exists" inside one Audience) | Contacts are now global entities identified by email, can belong to zero/one/multiple Audiences, and count once toward quota regardless of Audience count | Noted in Resend's "New Contacts Experience" changelog (fetched 2026-07-26, exact date not stated) | Does not change this phase's code — `audienceId` is still a required/expected parameter on `create`/`update` calls targeting a specific Audience — but worth knowing if a future phase needs cross-Audience contact logic |
| Older Next.js API Routes (`pages/api/`) | App Router Route Handlers (`app/**/route.ts`) using Web `Request`/`Response` | Established well before Next.js 16; already the convention this repo follows (`/api/og/route.tsx`) | No migration needed — this phase's new route follows the existing convention exactly |

**Deprecated/outdated:** None directly relevant to this phase's implementation surfaced during this research pass.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The Node SDK's `contacts.create`/`contacts.update` wrap the raw API response in a `{ data, error }` tuple (standard Resend SDK convention across `emails.send` etc.) | Architecture Patterns Pattern 3 | Low — this is Resend's consistent SDK convention across all documented methods; if wrong, a TypeScript compile error surfaces immediately during implementation, it will not silently misbehave |
| A2 | `x-forwarded-for` is never literally absent on a direct Vercel request (only empty/unusual in local dev or non-standard proxy chains) | Architecture Patterns Pattern 2, Common Pitfalls 2 | Low — D-12's "unknown" bucket already handles the absent case defensively regardless of whether it's common or rare in production |
| A3 | The honeypot field-hiding technique (off-screen + `aria-hidden` + `tabIndex={-1}`) is sufficient against the bot sophistication level this project actually faces (a low-traffic personal/small-team blog, per `FEATURES.md`'s threat-model framing) | Code Examples | Low-Medium — a well-resourced attacker running a full headless browser with computed-style inspection could still detect this; accepted because CAPTCHA is explicitly out of scope and this matches the project's stated threat model |

## Open Questions

1. **Exact Node SDK response tuple field names (`data`/`error` vs. something else) for `contacts.create`/`contacts.update` on `resend@6.18.0` specifically**
   - What we know: Resend's HTTP API reference shows the raw request/response bodies; the SDK's TypeScript wrapper convention (`{ data, error }`) is consistent across other documented methods (`emails.send`) but was not independently re-verified against the installed package's `.d.ts` files in this research pass (package is not yet installed in this repo).
   - What's unclear: Whether `6.18.0` specifically uses `{ data, error }` or an alternate shape for the contacts methods.
   - Recommendation: During implementation, `npm install resend` and read the generated TypeScript types (`node_modules/resend/dist/*.d.ts` or hover-inspect in an editor) before finalizing the exact destructuring pattern in the route handler — this is a five-minute check, not a research gap that blocks planning.

2. **Whether Resend's `contacts.create` silently no-ops (vs. errors) when the email already exists in the Audience, prior to the D-17 `update` call**
   - What we know: The bug in `resend/resend-node#458` is specifically about the *unsubscribed* status after create/recreate, not about whether `create` itself errors on a duplicate email.
   - What's unclear: Whether `create` on an existing contact returns a success response (idempotent upsert) or an error the route needs to explicitly tolerate before proceeding to the `update` call.
   - Recommendation: Since D-17's design does not branch on the `create` response at all for the success path, this only matters for D-18's error-classification: the route should likely treat a "contact already exists" error from `create` (if that's the actual behavior) as non-fatal and proceed to the `update` call anyway, rather than surfacing it as `server_error`. Flag this as a specific implementation detail for the plan to verify against a live Resend sandbox before finalizing the exact `createError` handling — this is exactly the "carried to operator checklist" territory D-26 already anticipates for SC#1/SC#3's live half.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Route handler runtime, `resend` SDK | Yes | v22.23.1 | — |
| npm | Package install, monorepo workspace commands | Yes | 12.0.1 | — |
| `resend` npm package | D-19's SDK dependency | Not yet installed in `apps/web` (confirmed via `ls node_modules/resend` → not found) | Registry version `6.18.0` confirmed installable | Install as part of this phase's first task |
| Live `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` | SC#1 (live Audience add), live half of SC#3 | Not available in this execution environment (no credentials set) | — | Per D-26, these two criteria are carried to an operator checklist — not blocking for planning or for closing SC#2/SC#4/SC#5 locally |
| Vercel deployment (for testing actual `x-forwarded-for` values in production) | D-12's real-world header behavior | Not available in this execution environment | — | Local `curl` testing against `next dev`/`next start` will show `x-forwarded-for` as unset/empty (matches the D-12 "unknown" bucket path) — this is expected and does not block phase completion, since D-12's behavior is defined for exactly this case |

**Missing dependencies with no fallback:** none — every missing dependency above either has a documented fallback or is explicitly carried to the operator checklist by D-26.

**Missing dependencies with fallback:** `resend` package (install during phase execution); live Resend credentials (operator checklist per D-26); production `x-forwarded-for` values (D-12's "unknown" bucket already covers the local/absent case correctly).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | **None** — zero `jest`/`vitest`/`playwright` config and zero `*.test.*`/`*.spec.*` files exist anywhere in the repo (confirmed via `find`), matching `TODOS.md`'s standing note and `CONTEXT.md`'s "Established Patterns" section |
| Config file | none — see Wave 0 Gaps |
| Quick run command | `curl`-based shell commands against a running `next dev`/`next start` instance (see Phase Requirements → Test Map below); no `npm test` equivalent exists |
| Full suite command | `npm run build --workspace=apps/web` (build) followed by the same `curl`/`grep` commands run against `next start`'s output |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SUB-02 / SEC-03 (SC#2) | `SubscribeSection` renders no form in SSR HTML when env unset | build + grep differential | Build once with `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` set (fake values are fine — this test never calls Resend) and once unset; `curl` the rendered page each time and `grep -c` for a stable marker unique to the form (e.g. a `data-testid="subscribe-form"` attribute Claude's Discretion should assign); expect >0 matches when configured, exactly 0 when unset | ❌ Wave 0 — no script exists yet; write as a documented shell snippet in VALIDATION.md, not a new test file (no framework to put it in) |
| SUB-04 (SC#4, honeypot half) | Honeypot-populated submission is dropped with a fake success, never reaches Resend | curl script, structural inference | Set `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` to obviously-invalid placeholder values (env check passes, but any real Resend call would loudly fail); `curl -X POST /api/subscribe -d '{"email":"test@example.com","company":"bot-filled"}'`; expect `{ ok: true }` / 200 AND no `[Subscribe] Resend contact create failed` log line — the absence of a Resend-error log combined with a 200 response is the evidence the honeypot check short-circuited *before* the Resend call (D-23's pipeline order), without needing live credentials | ❌ Wave 0 — same as above, shell snippet in VALIDATION.md |
| SUB-04 (SC#4, rate-limit half) | 6th submission within 10 minutes from one IP returns 429 | curl loop | `for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:3000/api/subscribe -d "{\"email\":\"test$i@example.com\"}"; done` — expect five `200`s (or `400`s if using a fake domain that trips D-15's regex — use a syntactically valid throwaway domain) then a `429` on the 6th | ❌ Wave 0 — shell snippet in VALIDATION.md |
| SEC-03 (SC#5) | `RESEND_API_KEY` never appears in the built client-side JS bundle | grep built output | `npm run build --workspace=apps/web && grep -rl "RESEND_API_KEY" apps/web/.next/static/ ; echo "exit: $?"` — expect no matches (`grep -l` prints nothing, exit code 1) | ❌ Wave 0 — shell snippet in VALIDATION.md |
| SUB-03 (SC#3, structural half) | Duplicate-email submission runs through the identical code path as a first-time submission (no code-level branch on prior state) | code review, not a runtime test | Confirm during plan-checker/code-review that the route's success path contains no `if (contactAlreadyExists)`-style branch before the unconditional `create`+`update` pair | N/A — this half of SC#3 is closed by code inspection, not an automated command; the *response-diffing* half (two live submissions actually compared byte-for-byte) is explicitly carried to the operator checklist per D-26 |
| SUB-01 (SC#1) | Valid email submission actually lands in the Resend Audience | live manual test | N/A — requires a real `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` and dashboard inspection | Carried to operator checklist (D-26) |

### Sampling Rate
- **Per task commit:** Run the relevant `curl`/`grep` snippet(s) for whatever this task touched (e.g., after implementing the route handler, run the SC#4 honeypot and rate-limit checks; after implementing `SubscribeSection`, run the SC#2 build-diff check).
- **Per wave merge:** Run all four locally-closable checks (SC#2, SC#4 both halves, SC#5) against a fresh `npm run build && npm run start`.
- **Phase gate:** All four locally-closable checks green before `/gsd-verify-work`; SC#1 and SC#3's live-diff half explicitly deferred to the operator checklist per D-26, not blocking phase completion.

### Wave 0 Gaps
- No test framework exists and none is being added this phase (matches `REQUIREMENTS.md`'s Out of Scope: "Adding a test framework to the repo"). The `curl`/`grep` commands above are documented directly in the phase's VALIDATION.md as copy-pasteable shell snippets — this is consistent with Phase 1 and Phase 2's precedent (both used manual/scripted verification, no test files).
- No new test config, fixtures, or `conftest.py`-equivalent needed — there is no test runner to configure.
- Framework install: none — deliberately out of scope per `REQUIREMENTS.md`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | No | No user accounts or sessions exist anywhere in this feature |
| V3 Session Management | No | Stateless form submission; no session/cookie involved |
| V4 Access Control | Yes | The env-gate (D-04) is the access-control boundary — it is a *feature availability* gate, not a user-permission gate; standard control is "fail closed on missing configuration," already the pattern (`SubscribeSection` returning `null`, `/api/subscribe` returning `404` per D-22) |
| V5 Input Validation | Yes | D-15's loose email regex + D-16's normalization + D-13's honeypot are the input-validation layer; standard control for the deliberately loose regex is documented rationale (not over-blocking), consistent with OWASP's own guidance against over-strict email regexes |
| V6 Cryptography | No | No secret comparison happens in this route (unlike Phase 4's `CRON_SECRET` check) — the env gate is a presence check, not a value comparison, so `timingSafeEqual` is out of scope for this phase specifically |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Third-party address enumeration via response-diffing | Information Disclosure | D-17/D-18's structurally-identical create+update code path (already locked) — response is byte-identical regardless of prior subscription state, not achieved by after-the-fact response normalization |
| Bulk/bot signup abuse (listbombing, garbage addresses) | Denial of Service (resource/reputation) | D-13's honeypot (silent fake-success drop) + D-09/D-10's per-IP rate limit (genuine 429) — both mandatory since double opt-in is explicitly out of scope |
| Secret leakage into client bundle | Information Disclosure | D-04's Server-Component-only env read + SC#5's build-output grep as a verification backstop, not just a design intention |
| Cross-Site Request Forgery on `/api/subscribe` | Spoofing / Tampering | **Not a meaningful threat for this specific endpoint** — the route is intentionally public and unauthenticated (no session-bound state to forge); an attacker who could mount a CSRF attack could already just POST to the endpoint directly with no session needed, so CSRF tokens would add complexity without closing any additional attack surface. The honeypot + rate limit already cover the actual abuse vector (automated mass submission) regardless of request origin |
| Cross-Origin form auto-submission bypassing CORS to trigger the route | Spoofing | Same reasoning as above — CORS gates *response readability* by JS, not request execution; a cross-origin `<form>` POST already reaches the route today without any CORS header change, and is already covered by the honeypot/rate-limit layer, not a gap this phase needs to additionally close |

## Sources

### Primary (HIGH confidence)
- `[CITED: nextjs.org/docs/app/getting-started/route-handlers]` — fetched directly 2026-07-26, version 16.2.11, `lastUpdated: 2026-03-03` — Route Handler body-parsing/response/caching conventions
- `[CITED: nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime]` — fetched directly 2026-07-26, `lastUpdated: 2026-03-13` — `runtime` config default and valid values
- `[CITED: vercel.com/docs/headers/request-headers]` — fetched directly 2026-07-26, `last_updated: 2025-12-13` — `x-forwarded-for` exact semantics, proxy-overwrite behavior, `x-vercel-forwarded-for`/`x-real-ip` equivalents
- Direct inspection: `apps/web/src/components/comments/CommentSection.tsx`, `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/templates/terminal/PostPage.tsx`, `apps/web/src/app/api/og/route.tsx`, `apps/web/src/site.config.ts`, `apps/web/src/components/Profile.tsx`, `apps/web/src/app/globals.css`, `apps/web/package.json`, `.planning/config.json` (all read 2026-07-26)
- `npm view resend version` → `6.18.0`; `npm view resend time.created` → `2017-02-25T13:01:05.309Z`; `npm view resend versions` → 166 entries; `npm view resend scripts.postinstall` → empty `[VERIFIED: npm registry]`
- `gsd-tools query package-legitimacy check --ecosystem npm resend` → `SUS`/`too-new` (raw seam output, independently contradicted by the direct `npm view` calls above)

### Secondary (MEDIUM confidence)
- `[CITED: resend.com/docs/api-reference/contacts/create-contact]` — fetched 2026-07-26, request/response body shapes for `contacts.create`
- `[CITED: resend.com/docs/api-reference/contacts/update-contact]` — fetched 2026-07-26, request/response body shapes for `contacts.update`
- `[CITED: github.com/resend/resend-node/issues/458]` — fetched 2026-07-26, confirms "closed as not planned" status
- `[CITED: css-tricks.com/building-a-honeypot-field-that-works]` — fetched 2026-07-26, honeypot hiding-technique tradeoffs and field-naming guidance

### Tertiary (LOW confidence)
- WebSearch-only results on general honeypot/autofill gotchas (not independently re-fetched from a single authoritative source) — used only to corroborate the CSS-Tricks findings, not as a standalone source
- Prior-session research (`.planning/research/{FEATURES,ARCHITECTURE,PITFALLS,STACK}.md`, 2026-07-24) — treated as already-vetted project context, re-cited rather than re-verified in this pass except where this document explicitly re-checked a specific claim (Resend contact shapes, `#458` status, Next.js 16 route handler syntax, `x-forwarded-for` semantics)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `resend@6.18.0` version and origin directly verified via `npm view`; API shapes directly fetched from Resend's own docs pages
- Architecture: HIGH — builds directly on the already-HIGH-confidence `ARCHITECTURE.md` from the 2026-07-24 session, re-verified against current Next.js 16.2.11 docs and actual repo files
- Pitfalls: MEDIUM-HIGH — `resend/resend-node#458`'s closed-as-not-planned status is a direct, dated finding; the honeypot-technique guidance is MEDIUM (industry-consensus blog source, not a formal spec) but consistent across corroborating results

**Research date:** 2026-07-26
**Valid until:** 2026-08-25 (30 days — stable domain; re-check `resend` package version and the `#458` issue status if implementation is delayed past this window, since Resend ships frequent SDK releases)
