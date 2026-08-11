# Phase 9: Thumbnail Freshness - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/app/api/thumbnail/[id]/route.ts` (NEW) | route (API handler) | streaming, validate-then-fetch, request-response | `apps/web/src/lib/post-availability.ts` (validate-id-then-fetch shape) + deleted `apps/web/src/app/api/diagnose-page/route.ts` (structural route precedent, gone — see git show below) | role-match (composite) |
| `apps/web/src/components/PostThumbnail.tsx` (NEW) | component (client island inside server template) | request-response, client-side error detection | `apps/web/src/components/ThemeToggle.tsx` (client-boundary shape) + `apps/web/src/components/PostUnavailable.tsx` (icon-in-surfaced-container pattern) | role-match (composite) |
| `apps/web/src/lib/thumbnail.ts` or inline helper (NEW, optional) — `resolveThumbnailSrc`-shaped ternary | utility (pure transform) | transform | `apps/web/src/lib/notion.ts` module-constant/export shape | role-match |
| `apps/web/src/types/index.ts` (MODIFIED — add `thumbnailType`) | type definition | n/a | itself, current state (11-field `Post` interface) | exact (self) |
| `apps/web/src/templates/default/HomePage.tsx` (MODIFIED — swap thumbnail block) | component (presentational, server) | request-response | itself, current state, lines 38-46 | exact (self) |
| `apps/web/src/templates/default/SearchPage.tsx` (MODIFIED — same swap) | component (presentational, server) | request-response | `HomePage.tsx` (byte-identical block, per 09-CONTEXT D-01) | exact |
| `apps/web/src/templates/default/CategoryPage.tsx` (MODIFIED — same swap) | component (presentational, server) | request-response | `HomePage.tsx` (byte-identical block) | exact |
| `apps/web/src/templates/default/PostPage.tsx` (MODIFIED — hero swap, `aspect-video`) | component (presentational, server) | request-response | itself, current state, lines 86-96 (differs in shape/`priority` from the card blocks) | exact (self) |

## Pattern Assignments

### `apps/web/src/app/api/thumbnail/[id]/route.ts` (route, streaming)

**Analog 1 — validate-then-fetch discipline:** `apps/web/src/lib/post-availability.ts` (full file read, 153 lines).

Imports and validation-first posture (lines 1-2, 69-76):
```typescript
import { parsePageId } from "notion-utils";
import { isDiagnosticsEnabled } from "@/lib/notion-x";

// 2. A string that is not a real Notion page identifier cannot name a
// real page. This also keeps caller-controlled input out of the outbound
// URL below (T-07-07) — the URL is built from `parsedId`, never from the
// raw `pageId` parameter.
const parsedId = parsePageId(pageId);
if (!parsedId) {
  return { verdict: "missing", detail: buildBasicDetail("missing", "invalid-id") };
}
```
Copy the discipline exactly: never let the raw route param reach the outbound URL — only `parsedId` (here, only `post.thumbnail`, itself derived server-side from `parsedId` via `getPost`). This route needs no `isDiagnosticsEnabled()`/detail-JSON machinery — that is `post-availability.ts`'s own diagnostic layer, not a shared contract; do not import it into the new route.

`cache: "no-store"` precedent for a must-be-fresh outbound fetch (lines 78-89, same file):
```typescript
// 3/4. Ask Notion directly. `cache: "no-store"` — this call must never be
// served from Next's Data Cache, or it would echo the very failure it is
// trying to discriminate.
try {
  const res = await fetch(`https://api.notion.com/v1/pages/${parsedId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
    },
    cache: "no-store",
  });
```
The new route achieves the equivalent freshness guarantee not via a raw `fetch`, but via a **second `NologClient` instance** (see Constructor pattern below) — reuse the *intent* (never let this specific lookup touch the Data Cache), not this literal fetch call.

**Analog 2 — nearest structural route precedent (deleted, historical only):** `apps/web/src/app/api/diagnose-page/route.ts`, retrievable via:
```
git show 427f8a8^:apps/web/src/app/api/diagnose-page/route.ts
```
Cite this to the executor as "closest structural precedent for a validate-then-fetch route in this repo, even though it no longer exists" — do not resurrect any of its diagnostic-JSON or secret-gate logic (that class of complexity is exactly what Phase 7/8 tore down). The only reusable shape is: `export const runtime = "nodejs"`, parse+validate the id param first, short-circuit with a plain non-200 `Response` before any outbound call on invalid input.

**Analog 3 — constructing a second `NologClient` with non-default `fetchOptions`:** `apps/web/src/lib/notion.ts:1-17` (full constructor block, quoted verbatim):
```typescript
import { cache } from "react";
import { CONFIG } from "@/site.config";
import { NologClient, type Post } from "@4lph4/nolog-core";

const DATABASE_ID = process.env.NOTION_DATABASE_ID ?? "";
const NOTION_CACHE_TAG = "notion-posts";

const nologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: DATABASE_ID,
  fetchOptions: {
    next: {
      revalidate: CONFIG.revalidate,
      tags: [NOTION_CACHE_TAG],
    },
  },
});
```
The route's own client must be a **second, separate instance**, constructed the same way but with `fetchOptions: { cache: "no-store" }` instead of the `next: {...}` block — never an unwrapped export off this existing `nologClient` singleton (09-CONTEXT D-14; that singleton's constructor-baked `next: { revalidate: 180 }` survives removal of any `cache()` wrapper). Confirmed against the real constructor signature — `packages/core/src/client.ts:184` (`fetchOptions?: RequestInit`), `:193-201` (constructor stores it and wraps the internal `fetch`), `:311-334` (`getPost()` spreads `...this.fetchOptions` and independently re-applies `if (post.status !== "public") { return null; }`). Reuse `getPost()` on the new instance rather than hand-rolling a raw fetch — it inherits the public-status filter and `mapPageToPost()`'s file-URL extraction for free.

**Hostname allowlist — mirror `next.config.ts` exactly** (`apps/web/next.config.ts:1-18`, quoted verbatim):
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
    ],
  },
};

export default nextConfig;
```
The two literal hostnames the route's own allowlist must contain: `s3.us-west-2.amazonaws.com` and `prod-files-secure.s3.us-west-2.amazonaws.com`. Whether to duplicate these two literals in the route or import `next.config.ts`'s `remotePatterns` directly is Claude's Discretion (09-RESEARCH.md flags the import path as `[ASSUMED]`, no existing precedent for importing `next.config.ts` from application code) — duplicating the two literals is the safer default.

**Streaming shape — no precedent exists anywhere in this repo.** Confirmed by reading every route under `apps/web/src/app/api/` (`subscribe`, `notify-subscribers`, `og`) — none stream a proxied upstream body; `og/route.tsx` generates an image via `@vercel/og`, it does not proxy one. State this plainly to the planner rather than inventing a house style. Canonical Next 16 shape (per 09-RESEARCH.md, Next 16.3.0 docs, `nextjs.org/docs/app/api-reference/file-conventions/route`):
```typescript
const upstream = await fetch(resolvedUrl, { redirect: "error" });
// guard checks on upstream.status / upstream.headers here, before returning
return new Response(upstream.body, {
  status: 200,
  headers: {
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "public, s-maxage=<TBD>, immutable",
  },
});
```
Pass `upstream.body` (already a `ReadableStream`) straight into the `Response` constructor — never buffer via `.arrayBuffer()`/`.text()` first (defeats D-05's streaming design).

**`runtime = "nodejs"` precedent** — every existing secret/Notion-touching route in this repo declares it explicitly: `apps/web/src/app/api/subscribe/route.ts:3` (`export const runtime = "nodejs";`). Copy verbatim.

**Optional defensive User-Agent** — `apps/web/src/lib/notion-x.ts:14-19` exports `NOLOG_USER_AGENT`, added specifically anticipating this phase's reuse (per its own comment: "Exported... because Phase 9's thumbnail-proxy work reuses it"). Import and set `"User-Agent": NOLOG_USER_AGENT` on the route's outbound `fetch()` — zero cost, no evidence it's required, but the constant exists for exactly this.

---

### `apps/web/src/components/PostThumbnail.tsx` (client-island component)

**Analog 1 — the client-boundary shape:** `apps/web/src/components/ThemeToggle.tsx` (full file, 51 lines, quoted above in full). Relevant pattern: `"use client"` at the top, hook-driven local state (`useState`), no import of any secret-gated Server Component. `PostThumbnail` follows the identical shape — a `"use client"` file receiving `post` as a plain prop from its Server Component parent (`HomePage.tsx` etc.), never importing anything env-gated itself. This is the D-06/Phase-7 precedent the task description flags: `templates/terminal/PostPage.tsx`'s `subscribeSlot` pattern (an *already-rendered* server element passed as a prop, never a direct import inside a client-directive file) is the reason `SubscribeSection`'s env gate isn't swallowed by crossing a client boundary — `PostThumbnail` has no analogous secret-gated dependency, so this constraint doesn't bind here directly, but the discipline ("a client file never directly imports a server-only/env-gated module") is the one to carry forward if the component ever needs one.

**Analog 2 — icon inside a surfaced container with a theme token:** `apps/web/src/components/PostUnavailable.tsx` (full file, 34 lines, quoted above). Relevant excerpt (lines 12-19):
```tsx
export default function PostUnavailable() {
  return (
    <div className="max-w-none mx-auto py-8 md:px-4">
      <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6 rounded-xl border border-border bg-surface">
        <CloudOff className="w-10 h-10 text-warning" strokeWidth={1.5} />
```
Copy: `lucide-react` icon as a direct child of a flex-centered container, `strokeWidth={1.5}`, a `text-*` color token as the icon's only styling. Phase 9's placeholder differs deliberately in token choice — `09-UI-SPEC.md` locks `ImageOff` at `text-text-tertiary` (not `text-warning`, since a missing thumbnail is not a warning/error condition the reader must act on) — and in container: the existing `bg-surface` wrapper already present at all four call sites, centered via `absolute inset-0 flex items-center justify-center` rather than `PostUnavailable`'s own padded/bordered block (that block is a full-page state; the thumbnail placeholder lives inside an existing fixed-size box).

**Failure detection — client-side `onError`, no server precedent to copy from** (D-10 is a new mechanism in this codebase; no existing `<Image onError>` usage found). Illustrative shape locked by `09-UI-SPEC.md` (not prescriptive on internal JSX structure, binding on token/size/color):
```tsx
"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { Post } from "@/types";

const WRAPPER = {
  card: "relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface",
  hero: "relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10",
} as const;
const ICON_SIZE = { card: "w-8 h-8", hero: "w-12 h-12" } as const;

export function PostThumbnail({ post, variant }: { post: Post; variant: "card" | "hero" }) {
  const [failed, setFailed] = useState(false);
  if (!post.thumbnail) return null;

  const src = post.thumbnailType === "external" ? post.thumbnail : `/api/thumbnail/${post.id}`;

  return (
    <div className={WRAPPER[variant]}>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className={`${ICON_SIZE[variant]} text-text-tertiary`} strokeWidth={1.5} />
        </div>
      ) : (
        <Image
          src={src}
          alt={post.title}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          {...(variant === "card" ? { sizes: "96px" } : { priority: true })}
        />
      )}
    </div>
  );
}
```

---

### `resolveThumbnailSrc`-shaped helper (NEW, optional inline-vs-extracted)

**Analog:** `apps/web/src/lib/notion.ts`'s file-scope constant/export convention (see full excerpt above under the route section) — if extracted to its own file, follow the same `export const`/`export function` shape used throughout `lib/`. Given the ternary is only 3 lines and used once (inside `PostThumbnail.tsx`), 09-CONTEXT leaves the exact file location to Claude's Discretion; inlining directly in `PostThumbnail.tsx` (as shown above) avoids a near-empty new file and satisfies D-02's "lives in one place" requirement equally well as a separate `lib/thumbnail.ts`.

---

### `apps/web/src/types/index.ts` (MODIFIED — add `thumbnailType`)

**Analog:** itself, current state (full 39-line file, quoted above). Current `Post` interface (lines 5-38) ends at `emailed: boolean;` with **no `thumbnailType` field** — confirmed absent, not renamed. The published `packages/core/src/types.ts:16-28` has both:
```typescript
thumbnail: string | null;
thumbnailType: "file" | "external" | null;
```
**Required change, minimal and additive** — add one field mirroring `packages/core` exactly, immediately after the existing `thumbnail` field for readability (order is not load-bearing to TypeScript but keeps the two type definitions visually diffable):
```typescript
/** Thumbnail image URL from the `Thumbnail` (files) property */
thumbnail: string | null;

/** Distinguishes a Notion-hosted (expiring) file URL from a stable pasted external URL */
thumbnailType: "file" | "external" | null;
```
**This must be the first code change in the phase** — every one of the four call sites and the new `PostThumbnail.tsx` component reads `post.thumbnailType`, and `tsc` fails immediately without it (09-RESEARCH.md Finding 1 / Pitfall N2). `packages/core/src/types.ts` itself is **read-only reference only** — do not touch it (REQUIREMENTS.md D-05).

**Landmine — the `terminal` template also imports this same local type** (`apps/web/src/templates/terminal/PostPage.tsx`, confirmed via `08-PATTERNS.md`'s prior read: its `TerminalPostPageProps` interface is separate from `DefaultPostPageProps` but both ultimately reference the shared `@/types` `Post`). Adding a field to `Post` is additive and cannot break `terminal`'s compilation (TypeScript structural typing — an extra field on an object type passed around is always safe); `terminal` needs zero changes per D-03 and none are implied by this addition.

---

### `apps/web/src/templates/default/HomePage.tsx` / `SearchPage.tsx` / `CategoryPage.tsx` (MODIFIED — card call sites)

**Analog:** `HomePage.tsx`, current state, lines 38-46 (verbatim, read this session):
```tsx
{post.thumbnail && (
  <div className="relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface">
    <Image
      src={post.thumbnail}
      alt={post.title}
      fill
      className="object-cover"
      sizes="96px"
    />
  </div>
)}
```
Confirmed byte-identical in `SearchPage.tsx:56-64` and `CategoryPage.tsx:52-60` per 09-CONTEXT D-01/D-02 (not independently re-read this session — CONTEXT.md's line-number citations are treated as authoritative, consistent with "closest analog is itself" for all three).

**Replacement, all three files identically:**
```tsx
<PostThumbnail post={post} variant="card" />
```
Still nested inside the same surrounding `<Link href={...} className="flex gap-4">` — only the inner thumbnail block changes; the `{post.thumbnail && (...)}` guard moves inside `PostThumbnail` itself (`if (!post.thumbnail) return null;`), so the call site drops the guard.

**Import to add at all three files:**
```tsx
import { PostThumbnail } from "@/components/PostThumbnail";
```

---

### `apps/web/src/templates/default/PostPage.tsx` (MODIFIED — hero call site)

**Analog:** itself, current state, lines 86-96 (per 09-CONTEXT.md's citation `PostPage.tsx:86-94`; not independently re-read — Phase 8's `08-PATTERNS.md` already read this file's surrounding structure at lines 96-102, a different region, confirming the file's general shape without re-reading the hero block). Differs from the card blocks in wrapper class (`aspect-video`) and carries `priority` instead of `sizes`.

**Replacement:**
```tsx
<PostThumbnail post={post} variant="hero" />
```
Same position in the DOM (header-adjacent, before `.notion-content-wrapper` — that region is Phase 8's, untouched by this phase per the file-disjoint note in 09-CONTEXT.md).

---

## Shared Patterns

### Second `NologClient` instance for a must-bypass-Data-Cache lookup
**Source:** `apps/web/src/lib/notion.ts:8-17` (constructor shape) + `packages/core/src/client.ts:184-201,311-334` (how `fetchOptions` is applied and what `getPost` returns/filters).
**Apply to:** the new route only. **Do not** add an unwrapped export to `notion.ts` calling the existing `nologClient` singleton (09-CONTEXT D-14, 09-RESEARCH.md Pitfall N1) — that singleton's baked `next: { revalidate: 180 }` survives removal of any `cache()` wrapper.
```typescript
const freshNologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: process.env.NOTION_DATABASE_ID ?? "",
  fetchOptions: { cache: "no-store" },
});
```

### Validate-id-before-outbound-call discipline
**Source:** `apps/web/src/lib/post-availability.ts:69-76` — `parsePageId()` first, short-circuit on falsy parse, only the parsed id ever reaches an outbound URL.
**Apply to:** the new route's `GET` handler, before any `NologClient` call.

### `runtime = "nodejs"` on any route touching Notion/secrets
**Source:** `apps/web/src/app/api/subscribe/route.ts:3`.
**Apply to:** the new thumbnail route.

### Client-island component receiving server-fetched data as a prop
**Source:** `apps/web/src/components/ThemeToggle.tsx` (client boundary shape) + `apps/web/src/app/post/[id]/page.tsx`'s `subscribeSlot` prop-threading precedent (an already-rendered server element passed down, never imported directly inside a client file) — cited from `08-PATTERNS.md`, not re-read this session.
**Apply to:** `PostThumbnail.tsx` — receives `post: Post` as a plain prop; imports nothing secret-gated itself.

### Icon-in-surfaced-container with a muted theme token
**Source:** `apps/web/src/components/PostUnavailable.tsx:16` (`<CloudOff className="w-10 h-10 text-warning" strokeWidth={1.5} />`).
**Apply to:** `PostThumbnail.tsx`'s failure branch — `ImageOff`, `text-text-tertiary` (not `text-warning` — deliberate token deviation per `09-UI-SPEC.md`'s Color section rationale), `strokeWidth={1.5}`, sizes `w-8 h-8` (card) / `w-12 h-12` (hero).

### Hostname allowlist mirrors `next.config.ts` exactly
**Source:** `apps/web/next.config.ts:5-13` — `s3.us-west-2.amazonaws.com`, `prod-files-secure.s3.us-west-2.amazonaws.com`.
**Apply to:** the new route's IMG-03 host guard.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Streaming a fetch response body through a route handler | route | streaming | No precedent anywhere in this repo (`subscribe`, `notify-subscribers`, `og` all checked — none stream a proxied upstream body). Use the canonical Next 16 shape from `09-RESEARCH.md` (`new Response(upstream.body, {...})`) rather than inventing a house style. |
| `next/image`'s `onError` client-side failure detection | component | event-driven | No existing `<Image onError>` usage found anywhere in the codebase. `09-UI-SPEC.md`'s illustrative markup is the closest thing to a precedent and is treated as binding on the visual contract, illustrative on internal JSX structure. |
| Importing `next.config.ts`'s `remotePatterns` from application code | utility | transform | No precedent in this repo for importing `next.config.ts` outside the Next.js build pipeline itself — `09-RESEARCH.md` flags this `[ASSUMED]`, not confirmed. Default to duplicating the two literal hostnames instead. |

## Metadata

**Analog search scope:** `apps/web/src/lib/`, `apps/web/src/components/`, `apps/web/src/templates/default/`, `apps/web/src/app/api/` (all existing routes), `apps/web/src/types/`, `packages/core/src/` (read-only reference), `apps/web/next.config.ts`.
**Files scanned:** `apps/web/src/lib/notion.ts`, `apps/web/src/lib/post-availability.ts`, `apps/web/src/lib/notion-x.ts` (constant only), `apps/web/src/components/PostUnavailable.tsx`, `apps/web/src/components/ThemeToggle.tsx`, `apps/web/src/types/index.ts`, `packages/core/src/client.ts`, `packages/core/src/types.ts`, `apps/web/next.config.ts`, `apps/web/src/templates/default/HomePage.tsx`, `apps/web/src/app/api/subscribe/route.ts`, plus `git show` of the deleted `apps/web/src/app/api/diagnose-page/route.ts` for historical structural reference.
**Pattern extraction date:** 2026-08-11

**Hard constraints carried forward into planning:**
- `packages/core` is read-only reference only — never modified (REQUIREMENTS.md D-05, published npm package).
- No new npm dependencies (D-07) — `notion-utils` (`parsePageId`) and `lucide-react` (`ImageOff`) are both already direct dependencies.
- `apps/web/src/types/index.ts`'s `thumbnailType` addition must land **before** any file reads `post.thumbnailType`, or `tsc`/`next build` fails immediately (Pitfall N2).
- The second `NologClient` instance must be constructed with `fetchOptions: { cache: "no-store" }` — never as an unwrapped export off the existing `nologClient` singleton in `notion.ts` (D-14, Pitfall N1).
- `terminal` template gets zero changes (D-03) and is unaffected by the additive `Post` type change — confirmed safe by TypeScript structural typing.
- The hostname allowlist inside the new route must contain exactly `s3.us-west-2.amazonaws.com` and `prod-files-secure.s3.us-west-2.amazonaws.com` — no more, no fewer.
- Zero test infrastructure exists and none may be added — no test-file analogs proposed above; verification is `npm run build`/`npm run lint`, source assertions, and deployed-site idle-gap observation only.
