# Phase 4: Notify Route - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 2 (1 new, 1 edited)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/app/api/notify-subscribers/route.ts` | route/controller (cron-triggered) | request-response + batch (query → transform → external send → write-back) | `apps/web/src/app/api/subscribe/route.ts` | role-match (sibling API route, same fail-closed/logging conventions; different trust model — no rate limiter/origin check needed) |
| `apps/web/src/site.config.ts` | config | CRUD (static object edit) | itself (edit in place) | exact — extend existing `CONFIG` object, following `profile`/`sns` block shape |

Supporting seams (not new files, but load-bearing call targets — do not reimplement):

| Seam | Role | Source |
|------|------|--------|
| `getResend()` | service/provider (lazy singleton client) | `apps/web/src/lib/email.ts` |
| `NologClient.getUnemailedPublicPosts()` | model/service method (CRUD read) | `packages/core/src/client.ts` lines 253-288 |
| `NologClient.markEmailed(pageId)` | model/service method (CRUD write) | `packages/core/src/client.ts` lines 381-383 |
| `NotionCapabilityError` / `MissingEmailedPropertyError` | typed error classes | `packages/core/src/client.ts` lines 128-155 |
| `Post` type (`emailed`, `thumbnail`, `title`, `summary`) | model/type | `packages/core/src/types.ts` |

## Pattern Assignments

### `apps/web/src/app/api/notify-subscribers/route.ts` (route, request-response/batch)

**Analog:** `apps/web/src/app/api/subscribe/route.ts`

**Imports pattern** (subscribe route, line 1; email.ts line 1):
```typescript
import { getResend } from "@/lib/email";

export const runtime = "nodejs";
```
For the notify route, additionally import the Notion client accessor (wherever `apps/web/src/lib/notion.ts` exposes the singleton `NologClient` instance used elsewhere in `apps/web`) and `NotionCapabilityError` from `@4lph4/nolog-core` (or the equivalent workspace import path used by other `apps/web` files that import core types/errors) and `CONFIG` from `@/site.config`. Use `node:crypto`'s `timingSafeEqual` for the auth check (not present in the subscribe route — this route's auth model is a new pattern, see Auth pattern below).

**Config/env fail-closed pattern** (subscribe route lines 299-328 — D-22/D-23 stage 1):
```typescript
export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID ?? "";

  if (!apiKey || !audienceId) {
    if (!unconfiguredLogged) {
      unconfiguredLogged = true;
      const missing = [
        !apiKey ? "RESEND_API_KEY" : null,
        !audienceId ? "RESEND_AUDIENCE_ID" : null,
      ].filter(Boolean);
      console.error(
        `[Subscribe] Route called while unconfigured — missing: ${missing.join(", ")}. Further occurrences in this instance are not logged.`,
      );
    }
    return new Response(null, { status: 404 });
  }
  ...
```
**Copy the shape, not the response code or the latch-logging suppression.** Per D-14/D-15, the notify route:
- Does **not** return a disguising 404 for the missing-secret case — return a plain 401 (see Auth pattern below).
- **Does** log every failed/missing-secret attempt (D-15), unlike the subscribe route's `unconfiguredLogged`/`originRejectionLogged` one-shot latch pattern — do not reuse the latch-boolean idiom for the auth-failure log line. The latch idiom is still fine to reuse for the *separate* "unconfigured feature" no-op case (SEC-02: missing `RESEND_API_KEY`/`RESEND_AUDIENCE_ID`/physical address), where D-13-style operator signal-once logging is appropriate and matches this codebase's existing `unconfiguredLogged` precedent.

**Auth pattern (new — no direct analog in this codebase; build from RESEARCH.md's verified Code Example):**
```typescript
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!cronSecret || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    console.error("[Notify] Unauthorized cron request rejected.");
    return new Response(null, { status: 401 });
  }
  ...
}
```
This must be the literal first statement in the handler (SEC-01, Pattern 1) — before the SEC-02 config-gate check, before any Notion/Resend call. Export `GET`, not `POST` (Vercel Cron invokes via GET with no body — confirmed in RESEARCH.md).

**Core batch pattern** (new shape — single digest, not per-post loop; RESEARCH.md Pattern 3, lines 169-181):
```typescript
// 1. Config gate (SEC-02) — mirrors subscribe route's D-22 shape but with a
//    200 no-op response, not a 404 (this route has no "hide existence" need).
const apiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;
const address = CONFIG.compliance?.physicalAddress; // D-06/D-09
if (!apiKey || !audienceId || !address) {
  return Response.json({ ok: true, code: "unconfigured" }, { status: 200 });
}

// 2. Query — reuse NologClient.getUnemailedPublicPosts() verbatim, do not
//    reimplement pagination/filter/sort (packages/core/src/client.ts:253-288
//    already returns oldest-first, public+unemailed only).
const candidates = await nologClient.getUnemailedPublicPosts();
if (candidates.length === 0) {
  return Response.json({ ok: true, code: "no_posts" }, { status: 200 });
}

// 3. Cap per D-10/D-11/D-12 — env-var-configurable batch size (e.g.
//    NOTIFY_BATCH_SIZE, default 50 per RESEARCH.md Pitfall 3).
const batchSize = Number(process.env.NOTIFY_BATCH_SIZE) || 50;
const batch = candidates.slice(0, batchSize);
const deferred = candidates.length - batch.length;
if (deferred > 0) {
  console.log(`[Notify] Deferred ${deferred} post(s) to next run (batch cap reached).`);
}

// 4. Assemble sections — per-post try/catch isolation (NOTIFY-04), a bad
//    section is dropped, not fatal. Treat file-type thumbnails as text-only
//    (RESEARCH.md Pitfall 1 — presigned URLs expire in 1hr).
const sections: { post: Post; html: string }[] = [];
for (const post of batch) {
  try {
    sections.push({ post, html: buildSectionHtml(post) });
  } catch (err) {
    console.error(`[Notify] Failed to build section for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}
if (sections.length === 0) {
  return Response.json({ ok: true, code: "no_sections" }, { status: 200 });
}

// 5. ONE send — never a per-post loop (RESEARCH.md Anti-Patterns, NOTIFY-03).
const resend = getResend();
const { error: sendError } = await resend.broadcasts.create({
  audienceId,
  from: `Your Blog <notify@yourdomain.com>`,
  subject: `${sections.length} new post${sections.length === 1 ? "" : "s"} on ${CONFIG.site.title}`,
  html: buildDigestHtml(sections, address),
  send: true,
});

if (sendError) {
  console.error(`[Notify] Broadcast send failed: ${sendError.message}`);
  return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
}

// 6. Mark-after-send only — isolated per-post, a 403 must not block the rest.
for (const { post } of sections) {
  try {
    await nologClient.markEmailed(post.id);
  } catch (err) {
    if (err instanceof NotionCapabilityError) {
      console.error(`[Notify] markEmailed capability error for post ${post.id}: ${err.message}`);
    } else {
      console.error(`[Notify] markEmailed failed for post ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

return Response.json({ ok: true, code: "sent", count: sections.length }, { status: 200 });
```

**Error handling pattern** (subscribe route lines 413-449 — generic try/catch around external SDK calls):
```typescript
try {
  const resend = getResend();
  const { error } = await resend.contacts.create({ ... });
  if (error) {
    console.error(`[Subscribe] Resend contact create failed: ${error.message}`);
  }
  ...
} catch {
  return Response.json({ ok: false, code: "server_error" }, { status: 500 });
}
```
Apply the same `[Context] message` bracket-prefix convention (`[Notify]` instead of `[Subscribe]`), and the same `error instanceof Error ? error.message : String(error)` extraction (see `packages/core/src/client.ts` catch blocks, e.g. lines 278-285, and CLAUDE.md's Error Handling conventions). Unlike subscribe's fully generic catch-all 500, the notify route's mark step must catch and log `NotionCapabilityError` distinctly per-post (isolated, non-aborting) rather than collapsing into one generic branch.

**Response contract note:** Subscribe route's D-21 machine-code `{ ok, code }` JSON contract is worth continuing for internal/operator consistency, but this route's caller (Vercel Cron / the operator) has no enumeration-safety requirement the way a public-facing form does — feel free to include more descriptive `code` values (`"unconfigured"`, `"no_posts"`, `"sent"`, `"send_failed"`) than subscribe's deliberately sparse set.

---

### `apps/web/src/site.config.ts` (config, CRUD)

**Analog:** itself — extend in place, following the existing `profile`/`sns` block pattern (lines 22-36).

**Pattern to copy** (lines 21-36, block shape convention):
```typescript
/** Profile sidebar */
profile: {
  name: "4lph4",
  bio: "Life's plus 4lph4",
  greeting: "Thanks for visiting! This is 4lph4's blog.",
  avatarUrl: "/avatar.png",
},

/** Social / contact links - set to "" to hide */
sns: {
  github: "https://github.com/4lph4-dvlp",
  ...
  twitter: "",
},
```
Add a new top-level block for D-06's CAN-SPAM physical address, same shape (plain string field(s), JSDoc comment above, empty string as the "unset" sentinel matching `sns`'s `""` = hide convention — consistent with D-09's fail-closed behavior when unset):
```typescript
/** CAN-SPAM required physical mailing address for the notify digest footer. Leave "" to disable notify sends entirely (fail-closed per D-09). */
compliance: {
  physicalAddress: "",
},
```
`export type SiteConfig = typeof CONFIG;` (line 57) requires no change — it derives automatically from the object shape.

## Shared Patterns

### Bracket-prefixed logging
**Source:** `apps/web/src/app/api/subscribe/route.ts` (all `console.error`/`console.log` calls, e.g. lines 257-259, 323-325, 422)
**Apply to:** All new logging in `notify-subscribers/route.ts` — use `[Notify] ...` prefix consistently, one sentence, minimal detail (D-16: no secret values, no header contents, no IP).

### Typed Notion error handling
**Source:** `packages/core/src/client.ts` lines 121-155 (`NotionCapabilityError`, `MissingEmailedPropertyError`), consumed via `instanceof` checks
**Apply to:** The `markEmailed` per-post loop in the notify route — catch `NotionCapabilityError` distinctly (per Phase 1's design intent, explicitly called out in the class's own JSDoc at line 124: "so a caller (e.g. Phase 4's notify route) can log this distinctly").

### Lazy external-client singleton
**Source:** `apps/web/src/lib/email.ts` lines 19-26 (`getResend()`)
**Apply to:** Import and call `getResend()` exactly as-is in the notify route — do not construct a second `Resend` instance or duplicate the deferred-construction logic.

### Fail-closed config gate, checked before any external call
**Source:** `apps/web/src/app/api/subscribe/route.ts` lines 299-328 (D-22/D-23 stage 1)
**Apply to:** The notify route's SEC-02 gate (env vars + `CONFIG.compliance.physicalAddress`) — same "check first, no-op response if unset" shape, but with a 200 `{ ok: true, code: "unconfigured" }` response instead of subscribe's bare 404 (no "hide existence" rationale applies here per D-14).

### Error message extraction convention
**Source:** CLAUDE.md Error Handling section; exemplified throughout `packages/core/src/client.ts` and `apps/web/src/app/api/subscribe/route.ts`
**Apply to:** Every catch block in the new route: `error instanceof Error ? error.message : String(error)`.

## No Analog Found

None — both files in scope have a directly applicable analog (subscribe route for the route file, the config object itself for the config edit). The single genuinely new sub-pattern (timing-safe `CRON_SECRET` comparison) has no in-repo precedent but is fully specified with a verified code example in `04-RESEARCH.md`'s Code Examples section (`safeCompare` wrapper) — treat that as the authoritative source for this one new piece.

## Metadata

**Analog search scope:** `apps/web/src/app/api/**`, `apps/web/src/lib/**`, `packages/core/src/**`, `apps/web/src/site.config.ts`
**Files scanned:** 4 (subscribe route, email.ts, client.ts, site.config.ts)
**Pattern extraction date:** 2026-07-27
