# Architecture Research

**Domain:** Adding a secret-gated, cron-triggered email-notification feature to an existing Next.js App Router + Notion-as-datastore blog template (NoLog)
**Researched:** 2026-07-24
**Confidence:** HIGH (grounded in direct inspection of `packages/core/src/client.ts`, `apps/web/src/lib/notion.ts`, `apps/web/src/components/comments/CommentSection.tsx`, and current Vercel/Next.js docs)

## Standard Architecture

### System Overview

This is not a greenfield domain — it's an *extension* of an already-mapped system (see `.planning/codebase/ARCHITECTURE.md`). The new pieces slot into two existing layers without adding a new one:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Next.js App Router (apps/web)                         │
│                                                                            │
│  ┌─────────────────────┐        ┌────────────────────────────────────┐  │
│  │ PostPage (Server)    │        │ /api/subscribe (route.ts)          │  │
│  │  └─ SubscribeSection │──────▶│  fail-closed on missing RESEND_*   │  │
│  │     (Server, gate)   │  POST  │  → Resend Audiences: add contact  │  │
│  │       └─ SubscribeForm       └────────────────────────────────────┘  │
│  │          (Client island)│                                            │
│  └─────────────────────┘                                                 │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ /api/notify-subscribers (route.ts) — triggered by vercel.json cron │ │
│  │  1. verify CRON_SECRET (fail-closed, checked first)                │ │
│  │  2. no-op if RESEND_API_KEY/RESEND_AUDIENCE_ID unset               │ │
│  │  3. getUnemailedPublicPosts() → per-post: send email, then         │ │
│  │     markEmailed(pageId) (isolated try/catch per post)              │ │
│  └───────────────────┬────────────────────────────────────────────────┘ │
└──────────────────────┼─────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              packages/core: NologClient (single class, extended)         │
│  Reads (existing):  getPosts, getPost, getCategories, getBlocks          │
│  Writes (new):      getUnemailedPublicPosts(), markEmailed(pageId)       │
│  Both share: same auth token, same getNotionHeaders(), same fetch()      │
│  wrapper — no second client, no new package                              │
└──────────────────────┬─────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  Notion REST API              │  Resend API (external, new dependency)   │
│  /v1/databases/{id}/query     │  Audiences.contacts.create (subscribe)   │
│  /v1/pages/{id}  PATCH (new)  │  Emails.send (notify)                    │
└──────────────────────────────────────────────────────────────────────────┘
```

**One-time, out-of-band process (not part of the request/response system above):**

```
Developer's machine ──▶ standalone backfill script ──▶ NologClient.getPosts()
                                                          + markEmailed(pageId) per post
                         (reads local .env, hits production Notion DB directly —
                          never touches Vercel, never goes through a route handler)
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| `NologClient` (extended) | Owns *all* Notion I/O — reads and writes — because it already owns auth/header/fetch plumbing | Add `markEmailed(pageId)` and `getUnemailedPublicPosts()` as public methods on the existing class; add a private `patchPage()` helper mirroring the existing private `queryDatabase()` helper |
| `SubscribeSection` (new, Server Component) | Reads server-only env vars, decides whether the feature is "on" for this deployment, renders nothing or delegates to the client island | Plain `async function` component, no `"use client"`, single `if (!configured) return null;` gate |
| `SubscribeForm` (new, Client Component) | Owns form state, client-side validation feedback, POSTs to `/api/subscribe` | `"use client"`, `useState` for pending/success/error, no direct env access, no knowledge of whether it's "enabled" — that decision was already made by its parent |
| `/api/subscribe` route | Validates input, honeypot check, fail-closed if env unset, calls Resend Audiences API, idempotent on duplicate email | Route Handler (`route.ts`), Node runtime (Resend SDK is not edge-safe by default) |
| `/api/notify-subscribers` route | Cron entry point only — never called by a browser. Verifies `CRON_SECRET`, no-ops if Resend unset, fetches unemailed posts, sends, marks emailed per-post | Route Handler (`route.ts`), Node runtime, `maxDuration` set explicitly (see Scaling Considerations) |
| Backfill script | One-time, idempotent, standalone — marks all pre-existing public posts as `Emailed` before the cron route is ever allowed to fire for real | Plain Node/TS script (e.g. via `tsx`) run manually from a developer machine against production Notion credentials, **not** a Vercel-deployed anything |
| `vercel.json` (new) | Declares the cron schedule that invokes `/api/notify-subscribers` | Added to repo root (there is currently no `vercel.json` in this project) |

## Recommended Project Structure

```
packages/core/
├── src/
│   ├── client.ts            # NologClient — EXTEND, do not fork
│   │                         #   + private patchPage(pageId, properties)
│   │                         #   + public getUnemailedPublicPosts()
│   │                         #   + public markEmailed(pageId)
│   ├── types.ts              # Post — add `emailed: boolean` field (mirrors mapPageToPost)
│   └── index.ts               # barrel export — no change needed if methods are on NologClient
├── scripts/
│   └── backfill-emailed.ts   # NEW — standalone, run via `tsx` or `node --import tsx`
└── package.json               # add a `"backfill"` script entry for discoverability

apps/web/src/
├── app/
│   ├── api/
│   │   ├── og/route.tsx                 # existing, unchanged
│   │   ├── subscribe/route.ts           # NEW
│   │   └── notify-subscribers/route.ts  # NEW
│   └── post/[id]/page.tsx               # existing — add <SubscribeSection /> near CommentSection
├── components/
│   ├── comments/CommentSection.tsx      # existing — pattern reference, not touched
│   └── subscribe/                        # NEW — mirrors comments/ convention
│       ├── SubscribeSection.tsx         # Server Component — env gate, zero "use client"
│       └── SubscribeForm.tsx            # Client Component — form/UI only
├── lib/
│   ├── notion.ts                        # existing — add cache()-wrapped getUnemailedPublicPosts
│   └── email.ts                         # NEW — Resend client instantiation + send/subscribe helpers
└── site.config.ts                        # unchanged (this feature is env-gated, not config-gated)

vercel.json                               # NEW, repo root — cron entry targeting notify-subscribers
```

### Structure Rationale

- **`packages/core/scripts/`** (not `apps/web`): the backfill script needs the same `NologClient` the app uses, but must run *outside* Next.js entirely — putting it in `packages/core` keeps it colocated with the class it drives and makes `npm run backfill --workspace=@4lph4/nolog-core` a discoverable, documented command distinct from anything Vercel deploys.
- **`components/subscribe/` mirrors `components/comments/`**: this repo already has an established convention (one directory per optional, env-gated feature, containing exactly the component(s) for that feature). Following it is lower-friction than inventing a new grouping scheme.
- **`lib/email.ts` separate from `lib/notion.ts`**: `lib/notion.ts`'s entire existing pattern is "wrap `NologClient` methods with React `cache()` for ISR/request dedup." Resend calls are one-shot, mutating, and *must not* be deduplicated or cached — mixing them into `notion.ts` would invite someone to wrap `sendNotificationEmail` in `cache()` by copy-paste habit. A separate file makes the different contract obvious.
- **Two route handlers, not one with a mode param**: `/api/subscribe` (public, low-trust, called by any visitor's browser) and `/api/notify-subscribers` (private, high-trust, called only by Vercel Cron with a secret) have completely different trust boundaries. Collapsing them into one route with a `?mode=` switch would make it easy to accidentally expose the notify path to public traffic.

## Architectural Patterns

### Pattern 1: Extend `NologClient`, don't split reads/writes into separate clients

**What:** Add `markEmailed(pageId)` and `getUnemailedPublicPosts()` as public methods on the *existing* `NologClient` class in `packages/core/src/client.ts`, using a new private `patchPage()` helper that mirrors the existing private `queryDatabase()` helper (same `getNotionHeaders()`, same base URL pattern, same `fetchOptions` spread).

**When to use:** When the new operation targets the *same resource* (Notion pages in the same database) with the *same auth* as existing operations, and there is exactly one production consumer of the write path (the cron route + the backfill script) — not enough distinct axes of variation to justify a second class.

**Trade-offs:**
- *For:* Zero new auth/header/fetch-wrapper code to maintain; one class to reason about; matches this file's existing internal convention of grouping methods by comment banner (`// ─── Property extractors ───`, `// ─── Mapper ───` already exist — a `// ─── Mutations ───` banner above the new methods is the natural continuation, not a new pattern).
- *Against:* `NologClient` becomes a class with both read and write responsibilities, which is a mild violation of read/write separation. This is fine here — the class already isn't a pure query object (it does pagination, mapping, validation) and the whole point of `packages/core` is "the one thing that knows how to talk to this specific Notion database."

**Why NOT a separate class/mixin:** A `NologWriteClient` or a mixin pattern would require either (a) instantiating two clients with the same token/databaseId (duplicated config, two places that can drift), or (b) composition (`NologClient` holds a `NologWriteClient` instance) — pure ceremony for two methods. Revisit only if a second, unrelated write concern shows up later (e.g., if the deferred "on-site new-post badge" feature from `TODOS.md` needs its own Notion writes).

**Example:**
```typescript
// packages/core/src/client.ts — inside the existing NologClient class

// ─── Mutations ──────────────────────────────────────────────────────────

private async patchPage(pageId: string, properties: Record<string, unknown>): Promise<void> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: this.getNotionHeaders(),
    body: JSON.stringify({ properties }),
    ...this.fetchOptions,
  });

  if (!res.ok) {
    throw new Error(`Notion patch failed: ${res.status} ${await res.text()}`);
  }
}

public async markEmailed(pageId: string): Promise<void> {
  await this.patchPage(pageId, { Emailed: { checkbox: true } });
}

public async getUnemailedPublicPosts(): Promise<Post[]> {
  // Reuses the existing queryDatabase() pagination loop — same shape as getPosts(),
  // with an additional filter clause (Notion supports compound `and` filters).
  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: "created_time", direction: "ascending" }], // oldest-first: don't skip the backlog if a run is interrupted
    filter: {
      and: [
        { property: "status", select: { equals: "public" } },
        { property: "Emailed", checkbox: { equals: false } },
      ],
    },
  };
  // ... identical do/while pagination loop to getPosts(), returning mapPageToPost(page)
}
```

Note: `getUnemailedPublicPosts()` must **not** be wrapped in `apps/web/src/lib/notion.ts`'s `cache()` the way `getPosts` is — the cron route calls it once per invocation and the result must reflect the true current Notion state, not a request-deduped or ISR-cached snapshot. If it's exposed through `lib/notion.ts` at all (only needed if a page component ever needs it — currently it doesn't), export it as a plain `async function`, not inside `cache()`.

### Pattern 2: Server-Component env gate + Client-Component island ("secret-gated optional feature")

**What:** A Server Component (`SubscribeSection`) reads `process.env.RESEND_API_KEY` / `RESEND_AUDIENCE_ID` server-side and either returns `null` or renders the Client Component (`SubscribeForm`). The Client Component never touches the env vars and doesn't know it's "optional" — it just renders a form.

**When to use:** Any time a feature's on/off switch is derived from a *secret* (not a value safe to ship to the browser, unlike Cusdis's public app ID). This is the case here: `RESEND_API_KEY` cannot be `NEXT_PUBLIC_*`, so — unlike `CommentSection`, which self-gates using `process.env.NEXT_PUBLIC_CUSDIS_APP_ID` read directly inside the Client Component — the gate for this feature *cannot* live inside the Client Component. It must live one level up, in a Server Component parent.

**Trade-offs:**
- *For:* This is Next.js's own documented composition pattern (Server Components rendered as children/props of Client Components, or — as here, the simpler case — a Server Component conditionally choosing whether to render a Client Component at all). No new dependency, no client-side network round-trip to "ask" if the feature is enabled (which would cause layout shift and contradicts this repo's server-first rendering constraint, documented in `.planning/codebase/ARCHITECTURE.md`). Verified against current Next.js docs (`nextjs.org/docs/app/getting-started/server-and-client-components`).
- *Against:* None significant for this use case — this is the "cleaner established pattern" the question asked about, not a workaround.

**Why NOT `next/dynamic(..., { ssr: false })`:** `dynamic()` with `ssr: false` only defers *when* a client component's code runs (skips server-side render, still ships and hydrates client-side) — it does not gate *whether* the component is included in the client bundle graph, and it cannot read server secrets to decide anything. Using it here would still ship `SubscribeForm`'s JS to every visitor regardless of configuration, just with a loading flash. It solves a different problem (avoiding SSR for a component that needs browser-only APIs), not this one.

**Why NOT a client-side "is this enabled?" fetch:** Would require exposing a new unauthenticated endpoint just to leak a boolean, adds a request, adds layout shift, and is strictly worse than a value the server already knows at render time for free.

**Example:**
```typescript
// apps/web/src/components/subscribe/SubscribeSection.tsx
// Server Component — no "use client" directive.
import { SubscribeForm } from "./SubscribeForm";

export function SubscribeSection() {
  const configured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_AUDIENCE_ID
  );

  if (!configured) return null; // inert for forkers who set no env vars — same contract as CommentSection

  return <SubscribeForm />;
}
```
```typescript
// apps/web/src/components/subscribe/SubscribeForm.tsx
"use client";
// Form state/UX only. Never reads RESEND_* — doesn't need to, and couldn't anyway
// (these are server-only secrets, not NEXT_PUBLIC_*).
```

**Bundle-cost note:** "Zero client bundle cost when disabled" is accurate at the *page/route* level: Next.js's React Server Components flight protocol only emits a script reference for a Client Component into the payload of pages that actually render it. If `SubscribeSection` returns `null` for a given deployment, `SubscribeForm`'s chunk is never referenced in any rendered page, so browsers for that deployment never fetch it. (The chunk file still exists in `.next`'s build output regardless, since Next.js can't know at *build* time which runtime env vars will be set — this is a build-artifact detail, not a user-facing cost.)

### Pattern 3: Fail-closed secret verification, checked first, before any other work

**What:** `/api/notify-subscribers` verifies `CRON_SECRET` (e.g., `Bearer` header match) as the *very first* statement in the handler, before touching Notion or Resend. `/api/subscribe` checks `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` presence before validating input.

**When to use:** Any route that (a) is reachable by the public internet (Vercel Cron hits a normal HTTP endpoint — nothing stops anyone else from calling it), and (b) does something with side effects (sends email, writes to Notion) if misconfigured or unauthorized.

**Trade-offs:** This is not optional stylistically here — it's the repo's own stated, hard-won lesson this session (`PROJECT.md`: "fail-closed, not fail-open... motivated by the real Cusdis privacy leak found and fixed this session"). Treat this as a project-level non-negotiable, not a nice-to-have pattern to weigh against alternatives.

## Data Flow

### Subscribe Flow (visitor-facing, low trust)

```
Visitor fills form → SubscribeForm (client) → POST /api/subscribe
                                                    ↓
                                    check RESEND_API_KEY/RESEND_AUDIENCE_ID set?
                                          no → 503/no-op (fail-closed)
                                          yes ↓
                                    honeypot + email validation
                                          ↓
                                    Resend Audiences API: add contact
                                    (idempotent — Resend upserts by email)
                                          ↓
                                    200 → SubscribeForm shows success state
```

### Notify Flow (cron-triggered, high trust)

```
Vercel Cron (once/day, per vercel.json) → GET/POST /api/notify-subscribers
                                                    ↓
                                    verify CRON_SECRET header — first line of handler
                                          fail → 401, stop (no Notion/Resend calls at all)
                                          ok ↓
                                    RESEND_API_KEY/RESEND_AUDIENCE_ID set?
                                          no → no-op, 200 (feature simply inert)
                                          yes ↓
                                    NologClient.getUnemailedPublicPosts()
                                          (Notion query: status=public AND Emailed=false)
                                          ↓
                                    for each post (sequential, isolated try/catch):
                                          send email via Resend
                                            (thumbnail = <img src="/api/og?...">, since
                                             /api/og is edge runtime and can't be
                                             server-fetched from this Node route directly —
                                             it must be a publicly reachable URL embedded
                                             in the email HTML, not fetched server-side)
                                          on success → NologClient.markEmailed(pageId)
                                          on failure → log, continue to next post
                                                        (one bad post never blocks the batch)
```

### Backfill Flow (one-time, out-of-band, human-triggered)

```
Developer runs `node`/`tsx` script locally (or via `npm run backfill`)
    ↓ reads NOTION_TOKEN/NOTION_DATABASE_ID from local env, NOT from Vercel
NologClient.getPosts() → all currently-public posts
    ↓
for each: NologClient.markEmailed(pageId)   (idempotent — safe to re-run;
                                              re-marking an already-Emailed post is a no-op)
    ↓
Confirm getUnemailedPublicPosts() returns [] before enabling cron
```

### Key Data Flows

1. **Subscribe and notify are fully decoupled at the data level.** Resend Audience membership (who gets emailed) and Notion's `Emailed` checkbox (what has been sent) are independent state machines that only meet inside `/api/notify-subscribers`'s send loop. This means `/api/subscribe` can ship and go live before `/api/notify-subscribers` exists with zero risk — subscribers just accumulate silently until the notify path is live. (Shipping them in the same milestone is still right for coherent UX, but there's no *technical* ordering dependency between them.)
2. **The `Emailed` checkbox is the only piece of durable state this feature adds**, and it lives in Notion, not in any new datastore — consistent with the project's "no new infrastructure" constraint. This is also the single point of idempotency: as long as `markEmailed` is called after (not before) a successful send, a crashed or retried cron invocation can never double-email a post, only under-email it (safe failure direction).
3. **The backfill script and the cron route both funnel through the exact same `NologClient` methods** (`getUnemailedPublicPosts`/`markEmailed`). This is intentional and load-bearing: it guarantees the backfill script exercises the identical code path production will later use, so "does the query filter actually work" gets validated once, manually, before it's ever run unattended.

## Scaling Considerations

This project's real constraint axis isn't traffic (it's a static/ISR blog) — it's **Resend's send ceiling and Vercel Hobby's execution model.**

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small blog, <100 posts total, occasional new post | Current design as specified is correct and sufficient: once/day cron, sequential per-post send loop, no queue |
| Blog nearing Resend free tier (3,000 sends/mo, 100/day) | The deferred "batch same-day multiple publishes into one email" (already noted in `PROJECT.md` Out of Scope) becomes relevant *before* any code-architecture change is needed — it's a template/content change (one email listing N posts), not a new component |
| Many forkers running the same template simultaneously | Not this project's scaling axis at all — each fork is its own isolated Vercel deployment + Notion DB + Resend account; there is no shared backend to scale |

### Scaling Priorities

1. **First real limit: Vercel Function `maxDuration` on the notify route.** `PROJECT.md`'s stated constraint is a 10-second Hobby timeout; current Vercel documentation (checked 2026-07-24, with Fluid Compute — Vercel's now-default compute model) states Hobby's default *and* maximum duration is actually 300 seconds, not 10. **This is worth re-verifying directly in the target Vercel project's dashboard/`vercel.json` before finalizing the route's batch size assumptions** — if 300s is accurate for this deployment, the notify route can safely process a larger per-run batch than a 10s budget would allow, and the "run backfill outside the route" decision is *even more* clearly correct (a large one-time backlog is exactly the case where any per-invocation duration ceiling — 10s or 300s — is the wrong tool; a script run from a terminal has no such ceiling at all).
2. **Second limit: Resend's 100/day cap.** Sequential per-post sends inside one cron invocation are fine until a single deploy's cron tick would need to send more than 100 emails in one run (i.e., more than 100 posts became unemailed since the last successful tick) — extremely unlikely for a personal blog publishing at human pace, but worth a defensive check: if `getUnemailedPublicPosts()` ever returns >100, that's itself a signal something upstream (e.g., a failed prior run's `markEmailed` calls) needs investigation, not silent throttled sending.

## Anti-Patterns

### Anti-Pattern 1: Gating the subscribe form inside the Client Component, à la `CommentSection`

**What people do:** Copy `CommentSection`'s pattern verbatim — read `process.env.SOMETHING` inside the `"use client"` component and `return null` if unset.

**Why it's wrong:** `CommentSection` can do this safely only because `NEXT_PUBLIC_CUSDIS_APP_ID` is deliberately public (Next.js inlines `NEXT_PUBLIC_*` vars into the client bundle at build time). `RESEND_API_KEY` is a secret. If a `"use client"` component tried to read `process.env.RESEND_API_KEY`, Next.js would resolve it to `undefined` in the browser bundle at best (it's simply not inlined) — but the deeper danger is a future edit "fixing" that by prefixing it `NEXT_PUBLIC_RESEND_API_KEY`, which would ship the Resend API key to every visitor's browser. This is precisely the class of mistake the DX review already flagged this session as the most significant architectural gap.

**Do this instead:** Gate one level up, in a Server Component parent (`SubscribeSection`, Pattern 2 above). The Client Component should have no branch that depends on whether the feature is configured at all.

### Anti-Pattern 2: Making the cron route's first action anything other than the secret check

**What people do:** Structure the handler as "do the work, and somewhere in there check auth," or worse, check auth after already having fetched from Notion "since that's harmless read-only data anyway."

**Why it's wrong:** Any Vercel Cron target is a normal public URL. Doing *any* work — even a read — before verifying `CRON_SECRET` means an attacker who discovers the route can trigger unlimited Notion API calls (quota/cost impact) or, worse, cause premature/duplicate email sends if the check is only skipped on the write path but not the read path in some refactor later.

**Do this instead:** `CRON_SECRET` verification is line one of the handler function, full stop, with an immediate early return on failure. No Notion client is even instantiated before that check passes.

### Anti-Pattern 3: Letting the cron entry go live before the backfill has run

**What people do:** Merge `vercel.json` (with the cron entry) in the same deploy as the notify route and consider the backfill script "a nice-to-have, run it whenever." Because Vercel Cron is schedule-driven, not manually gated, the very first scheduled tick after that deploy will run against whatever Notion state exists at that moment.

**Why it's wrong:** If the backfill hasn't marked pre-existing posts as `Emailed` yet, and even one subscriber has already signed up (via an already-live `/api/subscribe`), the first cron tick emails that subscriber the *entire back catalog* in one run — exactly the failure mode the feature was designed to avoid. This is a hard ordering dependency, not a style preference.

**Do this instead:** Treat "backfill script has been run and `getUnemailedPublicPosts()` confirmed empty" as a documented, required manual gate that happens *before* `vercel.json`'s cron entry is added to the deploy — not merely before the feature is "used." Concretely: land and deploy the notify route and the backfill script together, run the backfill immediately, confirm it's empty, and only *then* commit/deploy the `vercel.json` cron entry (a second, small, deliberate commit) — rather than shipping all pieces including the schedule in one shot. Document this exact order in `README.md`.

### Anti-Pattern 4: Caching or `React.cache()`-wrapping any write path

**What people do:** Follow `apps/web/src/lib/notion.ts`'s existing convention (every `NologClient` read method gets wrapped in `cache()`) reflexively, including for `getUnemailedPublicPosts` or a hypothetical wrapped `markEmailed`.

**Why it's wrong:** `cache()` deduplicates identical calls *within a single render*, which is meaningless for a route handler that isn't rendering React, and actively dangerous if ever reused in a context where it could mask that a mutation ran or didn't. `markEmailed` must never be memoized under any circumstance.

**Do this instead:** Keep write-path methods as plain exported `async function`s, not `cache()`-wrapped, and keep them out of `lib/notion.ts` (see Structure Rationale) so there's no visual precedent nudging someone to wrap them.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Notion REST API (writes) | `NologClient.patchPage()` — same `fetch()` + `getNotionHeaders()` pattern as existing reads, new PATCH verb | Requires the forker's Notion integration to have "update content" capability, not just "read content" — this is a new setup step vs. today's read-only integration and must be documented (already flagged in `PROJECT.md` Active requirements) |
| Resend (Audiences API) | `/api/subscribe` route calls Resend's contact-create endpoint for a configured Audience | Free tier: 1,000 contacts, 3,000 sends/mo, 100 sends/day — document these ceilings, they're real constraints on this specific integration |
| Resend (send/broadcast) | `/api/notify-subscribers` route calls Resend's email-send endpoint per post | Node runtime required (Resend's SDK is not verified edge-safe); keep this route on the default Node runtime, unlike `/api/og` which is intentionally edge |
| `/api/og` (existing, edge) | Referenced via `<img src="https://.../api/og?...">` inside the outbound email HTML, not fetched server-side | Edge routes can't be invoked via server-side `fetch()` from another route in the same deployment during a build/serverless context the way a same-origin browser request could — and more importantly, email clients need a plain public URL for the image anyway, so this is the correct approach regardless |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `apps/web` ↔ `packages/core` | Import of `NologClient` class + `Post` type, same as all existing usage | No new boundary — new methods live on the same imported class. Remember the existing dev-loop gotcha: `packages/core`'s `package.json` points `main`/`module`/`types` at `dist/`, so during local development the core package needs `npm run dev` (tsup `--watch`) running, or a fresh `npm run build`, before `apps/web` picks up new methods — this will bite whoever implements `markEmailed`/`getUnemailedPublicPosts` if they only edit `src/` and expect hot-reload without rebuilding `packages/core` |
| `SubscribeSection` (Server) ↔ `SubscribeForm` (Client) | Server renders/omits the Client Component; no data passed across the boundary beyond the decision to render at all | No env values, no secrets, cross this boundary — by design |
| `/api/subscribe` ↔ `/api/notify-subscribers` | None — no shared code, no shared state beyond both ultimately touching the same Resend account and (for notify) the same Notion database | Keep them as two independent route files; resist the urge to factor out a shared "Resend client" singleton beyond a simple `lib/email.ts` helper, since their trust boundaries and runtime triggers are entirely different |

## Suggested Build Order

This is the load-bearing answer to "what needs to exist before what":

1. **`packages/core`: extend `NologClient`** (`patchPage`, `markEmailed`, `getUnemailedPublicPosts`; add `emailed` to `Post`/`mapPageToPost`) and rebuild the package. Nothing else can be built or tested against real behavior until this exists — the backfill script, the notify route, and the Notion property itself (`Emailed` checkbox) all depend on this contract being defined first. Add the Notion `Emailed` checkbox property in the forker's database as part of this same phase (it's a prerequisite for `markEmailed` to have anywhere to write).

2. **Backfill script** (`packages/core/scripts/backfill-emailed.ts`), built and run manually against a real/staging Notion DB, exercising the new `NologClient` methods end-to-end for the first time. This validates the Notion filter query and the PATCH call work before anything is cron-triggered or public-facing.

3. **`/api/subscribe` route + `SubscribeSection`/`SubscribeForm` components** — independent of steps 4–5 (see Data Flow point 1), can be built, deployed, and left live with no downstream risk even before the notify path exists.

4. **`/api/notify-subscribers` route** — depends on step 1's client methods and benefits from step 2 having already validated the query/patch behavior. Deploy this route **without** a cron trigger yet; test it manually (e.g., a signed request with the correct `CRON_SECRET` header) to confirm behavior against production data.

5. **Run the backfill script against production** (if not already done in step 2 against the real production DB) and confirm `getUnemailedPublicPosts()` returns empty.

6. **`vercel.json` cron entry** — added and deployed *last*, only after step 5 is confirmed. This is deliberately its own small commit/deploy, not bundled with step 4, so the ordering is enforced by the deploy sequence itself rather than by developer discipline alone.

Steps 3 can happen in parallel with steps 1–2/4–6 (no dependency), but steps 1 → 2 → (4, 5) → 6 are a strict chain.

## Sources

- Direct inspection: `packages/core/src/client.ts`, `apps/web/src/lib/notion.ts`, `apps/web/src/components/comments/CommentSection.tsx`, `apps/web/src/app/api/og/route.tsx`, `apps/web/package.json`, `packages/core/package.json` (all read 2026-07-24)
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` (2026-07-24 snapshots)
- [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — composition pattern for passing/gating Server-rendered content around Client Components (fetched 2026-07-24)
- [Vercel: Configuring Maximum Duration for Vercel Functions](https://vercel.com/docs/functions/configuring-functions/duration) — current (2026-07-01-dated doc) Hobby duration limits: default and max both 300s under Fluid Compute, which is Vercel's default compute model as of this research date — **this contradicts the 10s figure recorded in `PROJECT.md`'s constraints and should be reconciled by checking the actual target Vercel project's dashboard setting before finalizing notify-route batch-size assumptions** (fetched 2026-07-24)
- [Vercel: Runtimes](https://vercel.com/docs/functions/runtimes) — general Functions behavior (regions, concurrency, archiving) (fetched 2026-07-24)

---
*Architecture research for: NoLog email-subscription-on-publish integration*
*Researched: 2026-07-24*
