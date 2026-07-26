# Phase 3: Subscribe Path - Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 6 (2 new components, 1 new server component, 1 new route, 1 new lib module, 2 edited templates)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/components/subscribe/SubscribeSection.tsx` | provider / gate (Server Component) | request-response (env-gated render) | `apps/web/src/components/comments/CommentSection.tsx` (gate logic only, lines 284-288) | role-match, diverges (must move gate to Server Component per D-04) |
| `apps/web/src/components/subscribe/SubscribeForm.tsx` | component (Client Component) | request-response (form submit → JSON) | `apps/web/src/components/comments/CommentSection.tsx` (copy/locale/state conventions) | role-match |
| `apps/web/src/app/api/subscribe/route.ts` | route / controller | request-response, CRUD (contact create/update) | `apps/web/src/app/api/og/route.tsx` | role-match, diverges (Node not Edge, POST not GET, JSON body not query params) |
| `apps/web/src/lib/email.ts` | service (client construction) | request-response | `apps/web/src/lib/notion.ts` | exact (same role: module-scoped external-API client construction under `src/lib/`) |
| `apps/web/src/templates/default/Layout.tsx` (edit) | component (layout) | request-response | itself (existing file, two insertion points) | exact |
| `apps/web/src/templates/terminal/PostPage.tsx` (edit) | component (page) | request-response | itself (existing file, one insertion point) | exact |

## Pattern Assignments

### `apps/web/src/components/subscribe/SubscribeSection.tsx` (Server Component, env gate)

**Analog:** `apps/web/src/components/comments/CommentSection.tsx`

**What to copy — the gate shape, NOT the component type.** `CommentSection` gates itself as a `"use client"` component reading `NEXT_PUBLIC_CUSDIS_APP_ID` (a value already safe for the client bundle). `SubscribeSection` must NOT copy that mechanically — D-04's whole point is this gate reads a *secret* (`RESEND_API_KEY`) and therefore MUST be a Server Component (no `"use client"` directive) so the check never enters client JS.

**Fail-closed gate pattern to copy** (`CommentSection.tsx` lines 284-288):
```typescript
// No app ID configured for this fork — stay invisible rather than fall back
// to a shared default (that would leak comments into someone else's Cusdis project).
if (!appId) {
  return null;
}
```

**Adapted for this file** (per RESEARCH.md's already-verified example, reproduce this shape):
```typescript
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

No imports block to copy beyond this — this file has no auth pattern (env presence check is the entire "auth"), no error handling (nothing can throw), no validation (that's the route's job).

---

### `apps/web/src/components/subscribe/SubscribeForm.tsx` (Client Component)

**Analog:** `apps/web/src/components/comments/CommentSection.tsx`

**Imports pattern** (lines 1-5) — copy the `"use client"` + locale-config import shape:
```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/site.config";
```
(Omit `useTheme`/`next-themes` — not needed; this form has no theme-dependent DOM.)

**Locale copy ternary pattern to copy verbatim** (lines 294-301, D-06 adopts this exactly):
```typescript
<h3 className="text-2xl font-bold text-text-primary mb-2">
  {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
</h3>
<p className="text-sm text-text-secondary mb-6">
  {CONFIG.site.locale === "ko"
    ? "댓글은 관리자의 검토 후 등록이 되니 잠시 기다려 주세요."
    : "Comments will be published after administrator review. Please wait."}
</p>
```
Apply the identical `CONFIG.site.locale === "ko" ? "…" : "…"` shape to every string in `SubscribeForm`: label, placeholder, button text, success message, and each `code`-to-message mapping from D-21 (`invalid_email`, `rate_limited`, `server_error`, and the network-failure fallback).

**Hydration-safety pattern to copy** (lines 108-117, 291-305) — `CommentSection` uses a `mounted` guard + `setTimeout(0)` to avoid hydration mismatch on theme-dependent markup. `SubscribeForm` does not need the `mounted` guard itself (no theme dependency, no external script), but SHOULD still follow the repo convention: initialize state with `useState`, no `localStorage`/`sessionStorage` (per D-08 — this is an explicit divergence to note, not an oversight).

**State shape** (new — no exact analog in repo, but follows `CommentSection`'s `useState` convention at line 108): track `pending`, `success`, `error` (code union), and the entered `email` value (preserved on error per D-07). Honeypot value also lives in local `useState` (RESEARCH.md Code Examples § Honeypot field gives the exact JSX for the hidden input — off-screen + `aria-hidden` + `tabIndex={-1}`, not `display:none`).

**No error-boundary/try-catch precedent exists for a client fetch in this repo** — this is new territory. Follow the CLAUDE.md house convention: `catch (error: unknown)`, `error instanceof Error ? error.message : String(error)`, log with `[SubscribeForm] message` prefix — but per D-24, never log the submitted email even client-side.

**Variant prop** — new pattern (no direct analog); `variant: "default" | "terminal"` switches only the JSX/Tailwind classes rendered, never the fetch logic, per D-02's "variation lives in presentation, never in the security boundary."

---

### `apps/web/src/app/api/subscribe/route.ts` (route handler, Node runtime, POST)

**Analog:** `apps/web/src/app/api/og/route.tsx`

**Diverges on:** runtime (`edge` → must be `nodejs` per D-19), HTTP method (`GET` → `POST`), input source (query params → JSON body), and this is the **first** route handler in the repo doing input validation or returning a structured error body — so most of the pipeline logic (rate limiting, honeypot, validation) has no in-repo analog and must follow RESEARCH.md's Pattern 2/3 code examples directly.

**What to copy from `api/og/route.tsx` — the house style of a route handler file:**

**Runtime declaration pattern** (line 5) — copy the *convention* of explicitly declaring runtime even when it matches the default:
```typescript
export const runtime = "edge";
```
becomes, per D-19/RESEARCH.md Pattern 2:
```typescript
export const runtime = "nodejs";
```

**Error handling / logging pattern to copy** (lines 88-92):
```typescript
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[OG Route Error] ${message}`);
    return new Response("Failed to generate image", { status: 500 });
}
```
Adapt the `[Context] message` prefix convention to `[Subscribe] …` per D-25's logging scope (only failure/config events — never the submitted email, per D-24). RESEARCH.md's exact log lines to reuse verbatim:
```typescript
console.error(`[Subscribe] Resend contact create failed: ${createError.message}`);
console.error(`[Subscribe] Resend contact update (post-create) failed: ${updateError.message}`);
```

**Response shape pattern to copy** (`new Response(..., { status })` convention, line 91) — extends to `Response.json(body, { status })` for this route's JSON contract (D-21):
```typescript
return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
return Response.json({ ok: false, code: "rate_limited" }, { status: 429 });
return Response.json({ ok: false, code: "server_error" }, { status: 500 });
return Response.json({ ok: true }, { status: 200 });
```

**No analog exists for:** the D-23 pipeline (env check → rate limit → honeypot → validation → Resend), the module-scoped rate-limit `Map`, or the create+update pair. These are new patterns this phase establishes — implement exactly as specified in RESEARCH.md § Architecture Patterns Pattern 2 and Pattern 3 (both already verified against Next.js 16 docs and Resend's API reference; reproduced there as copy-paste-ready code).

---

### `apps/web/src/lib/email.ts` (service — client construction only)

**Analog:** `apps/web/src/lib/notion.ts`

**Module shape to copy** — a `src/lib/*.ts` file that constructs and exports a single external-API client instance from `process.env`, nothing else:
```typescript
// apps/web/src/lib/notion.ts (lines 1-17), the pattern to mirror
import { CONFIG } from "@/site.config";
import { NologClient, type Post } from "@4lph4/nolog-core";

const DATABASE_ID = process.env.NOTION_DATABASE_ID ?? "";

const nologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: DATABASE_ID,
  fetchOptions: { next: { revalidate: CONFIG.revalidate, tags: [NOTION_CACHE_TAG] } },
});
```
```typescript
// Re-export convenience pattern (line 36) — same idiom `email.ts` should use
export const notion = nologClient.notion;
```

**Adapted for `email.ts`** per D-20 (client construction only, no helpers, no templates) and RESEARCH.md's already-verified shape:
```typescript
import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
```
Note `notion.ts` uses `?? ""` fallback for missing env vars because `NologClient` is constructed unconditionally at module load and callers get an empty/null-ish result on missing config. `email.ts` should follow the same "construct unconditionally, let the caller gate" division of responsibility — the presence check lives in `SubscribeSection` (render-time gate) and the route handler (request-time gate per D-22), never inside `email.ts` itself.

---

### `apps/web/src/templates/default/Layout.tsx` (edit — two insertion points)

**Analog:** itself; also `apps/web/src/components/Profile.tsx` for the sidebar-card visual/width constraints the `default` variant must fit inside (`aside` at lines 40, 51 uses `hidden md:block sticky top-8 self-start`; `Profile` itself is `flex flex-col items-center text-center gap-4 p-6 bg-surface border border-border rounded-2xl shadow-sm`).

**Two exact insertion points** (per D-01/D-03), both directly after `<Profile />`:

Mobile block (line 28):
```tsx
<div className="md:hidden flex flex-col gap-4 relative">
  {/* 1. Profile */}
  <Profile />
  {/* INSERT: <SubscribeSection variant="default" /> here */}
  {/* 2. Search */}
  <SearchBar />
```

Desktop right `<aside>` (lines 51-53):
```tsx
<aside className="hidden md:block sticky top-8 self-start">
  <Profile />
  {/* INSERT: <SubscribeSection variant="default" /> here */}
</aside>
```
Import to add: `import { SubscribeSection } from "@/components/subscribe/SubscribeSection";` — follows the existing `@/components/*` import convention already used for `Profile`, `SearchBar`, `CategoryList`, `ThemeToggle` (lines 1-4).

---

### `apps/web/src/templates/terminal/PostPage.tsx` (edit — one insertion point)

**Analog:** itself; `CommentSection` usage in the same file is the direct precedent for import + placement style.

**Existing `CommentSection` import + placement to mirror the mechanics of** (lines 5, 89-91):
```tsx
import { CommentSection } from "@/components/comments/CommentSection";
...
<div className="mt-16">
   <CommentSection postId={post.id} postTitle={post.title} />
</div>
```

**Insertion point** — per D-01, the `terminal` variant goes below the post, i.e. after the `<article>` closes (line 92) and before the `TerminalConsole` block (line 95):
```tsx
      </article>

      {/* INSERT: <SubscribeSection variant="terminal" /> here, per D-01 */}

      {/* Terminal Area (Below the post) */}
      <div className="w-full h-[50vh] flex border-t border-terminal-border pt-8">
```
Import to add: `import { SubscribeSection } from "@/components/subscribe/SubscribeSection";`. Note the CLI-prompt visual variant (D-02) should draw on the `terminal-*` Tailwind tokens already used throughout this file (`text-terminal-prompt`, `text-terminal-dim`, `border-terminal-border`, `bg-terminal-bg`) — do not introduce new colors, per RESEARCH.md's "Reusable Assets" note.

---

## Shared Patterns

### Locale copy ternary (D-06)
**Source:** `apps/web/src/components/comments/CommentSection.tsx` lines 294-301, 309-316
**Apply to:** `SubscribeForm.tsx` — every visitor-facing string (label, placeholder, button, success message, each D-21 error code's mapped message)
```typescript
{CONFIG.site.locale === "ko" ? "<한국어>" : "<English>"}
```

### Fail-closed env gate (D-04, structurally copied then relocated to Server Component)
**Source:** `apps/web/src/components/comments/CommentSection.tsx` lines 284-288
**Apply to:** `SubscribeSection.tsx` (gate logic) and `route.ts` (D-22's 404 pipeline stage — same "absent config → invisible/opaque" posture, different mechanism: `return null` vs `404` response)
```typescript
if (!configured) return null; // or: return new Response(null, { status: 404 }) in the route
```

### `[Context] message` error logging
**Source:** `apps/web/src/app/api/og/route.tsx` lines 88-91 (`console.error(\`[OG Route Error] ${message}\`)`)
**Apply to:** `route.ts` — use `[Subscribe] <what failed>: ${error.message}` per D-25, and CRITICALLY never interpolate the submitted email address into any log line (D-24).

### `src/lib/*.ts` external-client-construction-only module
**Source:** `apps/web/src/lib/notion.ts` (whole file — 37 lines, single responsibility: construct client from env, re-export)
**Apply to:** `apps/web/src/lib/email.ts` — same shape, smaller (D-20 explicitly restricts it to client construction, no helper functions).

### `@/` import alias, never relative paths
**Source:** every analog file above (`@/site.config`, `@/components/Profile`, `@/lib/notion`, etc.)
**Apply to:** all new files in this phase — `import { CONFIG } from "@/site.config"`, `import { resend } from "@/lib/email"`, `import { SubscribeSection } from "@/components/subscribe/SubscribeSection"`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Rate-limit `Map` logic in `route.ts` | utility (in-route) | in-memory state | No existing in-memory stateful abuse-mitigation code exists anywhere in the repo (confirmed by RESEARCH.md); implement per RESEARCH.md § Architecture Patterns Pattern 2's verified code example directly, not from a codebase analog |
| Honeypot field markup in `SubscribeForm.tsx` | component (form field) | n/a | No prior form exists in this repo at all (search/comment widgets are the only interactive surfaces, neither is a submitting form); use RESEARCH.md § Code Examples' verified off-screen + `aria-hidden` + `tabIndex={-1}` pattern |
| Resend `contacts.create`/`.update` unconditional pair (D-17) | service call | CRUD (external API) | No prior external-API-mutation call exists in the repo (Notion access is read-only); use RESEARCH.md § Architecture Patterns Pattern 3's verified call shapes directly |

## Metadata

**Analog search scope:** `apps/web/src/components/`, `apps/web/src/app/api/`, `apps/web/src/lib/`, `apps/web/src/templates/`
**Files scanned:** `CommentSection.tsx`, `api/og/route.tsx`, `lib/notion.ts`, `site.config.ts`, `templates/default/Layout.tsx`, `templates/terminal/PostPage.tsx`, `components/Profile.tsx`
**Pattern extraction date:** 2026-07-26
