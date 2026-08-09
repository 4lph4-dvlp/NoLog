# Phase 7: Content Failure Isolation & Live Diagnosis - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 4
**Analogs found:** 4 / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/app/post/[id]/page.tsx` (MODIFIED) | route (server component) | request-response, per-concern error isolation | `apps/web/src/app/layout.tsx:46-53` (per-concern catch), current file's own combined catch (before-state) | exact (self) + role-match (layout.tsx) |
| `apps/web/src/lib/notion-x.ts` (MODIFIED) | service/utility (data-access wrapper) | request-response, env-gated diagnostics | `apps/web/src/app/api/notify-subscribers/route.ts` (error-shape discrimination, structured logging), `packages/core/src/client.ts` (read-only reference, not to be copied verbatim since it must not be modified) | role-match |
| `apps/web/src/app/api/<debug-route>/route.ts` (NEW) | route (API route handler) | request-response, secret-gated | `apps/web/src/app/api/notify-subscribers/route.ts` (secret check first, `safeCompare`, `runtime="nodejs"`) + `apps/web/src/app/api/subscribe/route.ts` (bare-404 unconfigured posture, `unconfiguredLogged` latch) | exact (composite of two exact analogs) |
| `apps/web/src/components/PostUnavailable.tsx` (NEW) | component (presentational, server) | request-response (no data flow — pure render) | `apps/web/src/templates/default/PostPage.tsx` (header link markup, surface/border card conventions), `apps/web/src/app/layout.tsx` (no direct component analog, style-token reference only) | role-match |

## Pattern Assignments

### `apps/web/src/app/post/[id]/page.tsx` (route, per-concern error isolation)

**Analogs:** itself (current combined-catch state, to be split) + `apps/web/src/app/layout.tsx:46-53` (silent-degrade precedent)

**Current imports** (lines 1-9) — keep this import block, add `PostUnavailable` and (if D-04 probe lives here) nothing new required for logging itself:
```typescript
import { getPost, getCategories, getPosts } from "@/lib/notion";
import { getPageRecordMap } from "@/lib/notion-x";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";
import DefaultPostPage from "@/templates/default/PostPage";
import TerminalPostPage from "@/templates/terminal/PostPage";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";
```

**Current combined catch to be decomposed** (lines 55-80, exact current state):
```typescript
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  // Fetch full page recordMap for react-notion-x rendering
  let recordMap;
  let categories: string[] = [];
  let relatedPosts: Post[] = [];
  try {
    recordMap = await getPageRecordMap(id);
    categories = await getCategories();

    if (post.category) {
      const allPosts = await getPosts();
      relatedPosts = allPosts.filter(p => p.category === post.category);
    }
  } catch (error) {
    console.error("[PostPage] Failed to fetch page recordMap or categories:", error);
    recordMap = null;
    categories = [];
    relatedPosts = [];
  }
  ...
```

**Per-concern catch decomposition pattern to copy** — split into a `recordMap` try/catch and a `chrome` (categories + relatedPosts) try/catch, matching D-11's "split by concern, not by call":
```typescript
// [PostPage:recordMap] leg — content, isolated from chrome
let recordMap = null;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap] ${JSON.stringify({ name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) })}`);
  recordMap = null;
}

// [PostPage:chrome] leg — categories + relatedPosts, degrades silently (D-13)
let categories: string[] = [];
let relatedPosts: Post[] = [];
try {
  categories = await getCategories();
  if (post.category) {
    const allPosts = await getPosts();
    relatedPosts = allPosts.filter((p) => p.category === post.category);
  }
} catch (error) {
  console.error(`[PostPage:chrome] ${JSON.stringify({ name: error instanceof Error ? error.name : typeof error, message: error instanceof Error ? error.message : String(error) })}`);
  categories = [];
  relatedPosts = [];
}
```

**Silent-degrade precedent this mirrors** (`apps/web/src/app/layout.tsx:46-53`, exact current code):
```typescript
let categories: string[] = [];
try {
  categories = await getCategories();
} catch {
  // Gracefully degrade if Notion API is not configured yet
  categories = [];
}
```
Difference required by D-01: this phase's version must ADD a `[PostPage:chrome]`-prefixed `console.error` — `layout.tsx`'s precedent has no logging at all, do not copy that omission.

**`notFound()` boundary — do NOT move inside a try without `unstable_rethrow`.** Current code already keeps `notFound()` (line 60) entirely outside any try, which is safe by construction (see RESEARCH.md "notFound() vs try/catch"). If the planner adds an app-level discriminating check before `notFound()` for D-12, and that check needs to share a `try` with `notFound()`, import and use:
```typescript
import { unstable_rethrow } from "next/navigation";
// inside catch:
unstable_rethrow(error); // rethrows notFound()/redirect() unchanged
console.error(`[PostPage:post] ${...}`); // only reached for a REAL error
```

**Rendering `PostUnavailable` in place of `notFound()`** — the return-site pattern (only reachable if D-12's discriminator is added):
```typescript
if (CONFIG.template === "default") {
  return <DefaultPostPage post={post} recordMap={recordMap} />;
}
```
becomes, at the discriminator branch:
```typescript
if (/* discriminator judges transient */) {
  return <PostUnavailable />;
}
```

---

### `apps/web/src/lib/notion-x.ts` (service/utility, env-gated diagnostics)

**Analog:** current file itself (bare passthrough, to be extended) + `apps/web/src/app/api/notify-subscribers/route.ts` for structured error-shape discrimination and logging conventions.

**Current full file** (unchanged imports/doc-comment convention to preserve):
```typescript
import { NotionAPI } from "notion-client";

/**
 * Unofficial Notion API client for fetching full page content (recordMap).
 * ...
 */
const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
});

export async function getPageRecordMap(pageId: string) {
  return notionX.getPage(pageId);
}
```

**Error-shape discrimination pattern to copy** (adapted from RESEARCH.md's verified `ofetch`/`notion-client` findings, following this repo's `error instanceof Error` type-guard convention used throughout `apps/web/src/app/api/subscribe/route.ts` and `notify-subscribers/route.ts`):
```typescript
function isFetchErrorShape(err: unknown): err is Error & { status?: number; data?: unknown; response?: Response } {
  return err instanceof Error && err.name === "FetchError" && "status" in err;
}
```

**Env-gated deep diagnostics pattern** — mirrors the `unconfiguredLogged`-style module-scope latch convention (see below) plus this repo's `error instanceof Error ? error.message : String(error)` idiom (used verbatim in `notify-subscribers/route.ts` lines 237-238, `subscribe/route.ts` throughout):
```typescript
const DEBUG_GATE = process.env.NOTION_DEBUG_DIAGNOSTICS === "1"; // name: Claude's Discretion, D-02

export async function getPageRecordMap(pageId: string) {
  try {
    return await notionX.getPage(pageId);
  } catch (error) {
    if (!DEBUG_GATE) throw error; // ungated leg-naming happens at the call site (PostPage), rethrow unchanged
    // D-03/D-04: gated deep capture — status, content-type, body excerpt, error name/message, page-id shape
    // D-04 raw-fetch probe fires here only when isFetchErrorShape(error) is false or error.status is undefined
    throw error; // still rethrow after logging — page.tsx owns the leg-named [PostPage:recordMap] line
  }
}
```

**Module-scope one-shot log latch precedent to copy if diagnostics need spam protection** (`apps/web/src/app/api/subscribe/route.ts:181`, `:173`):
```typescript
let unconfiguredLogged = false;
// ... inside the gate:
if (!unconfiguredLogged) {
  unconfiguredLogged = true;
  console.error(`[Subscribe] Route called while unconfigured — missing: ${missing.join(", ")}. Further occurrences in this instance are not logged.`);
}
```

---

### `apps/web/src/app/api/<debug-route>/route.ts` (NEW, API route handler)

**Analogs:** `apps/web/src/app/api/notify-subscribers/route.ts` (secret-check-first shape, `safeCompare`) + `apps/web/src/app/api/subscribe/route.ts` (bare-404 unconfigured posture)

**Runtime + secret-check-first pattern to copy** (`notify-subscribers/route.ts` lines 1-52):
```typescript
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

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

**Fail-closed 404 gate posture to copy** (D-07 requires BOTH the debug flag AND a dedicated secret; response is bare 404 on either failure, per `subscribe/route.ts` lines 299-328, NOT `notify-subscribers`'s 401 — see RESEARCH.md Pitfall C):
```typescript
export async function GET(request: Request) {
  const debugGateOn = process.env.NOTION_DEBUG_DIAGNOSTICS === "1"; // same flag as notion-x.ts's D-02 gate
  const routeSecret = process.env.NOTION_DEBUG_ROUTE_SECRET; // name: Claude's Discretion, distinct from CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? "";

  if (!debugGateOn || !routeSecret || !safeCompare(authHeader, `Bearer ${routeSecret}`)) {
    if (!unconfiguredLogged) {
      unconfiguredLogged = true;
      console.error("[DebugRoute] Route called while unconfigured or unauthorized. Further occurrences in this instance are not logged.");
    }
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("id");
  if (!pageId) return Response.json({ ok: false, code: "missing_id" }, { status: 400 });

  // call getPageRecordMap(pageId), capture the same deep diagnostics as lib/notion-x.ts
}
```

**JSON response-shape convention to copy** (used identically in both existing routes — `{ ok: boolean, code: string, ...extra }`, always via `Response.json(...)`):
```typescript
return Response.json({ ok: true, code: "unconfigured" }, { status: 200 });
return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
```

**Error-catch-and-report pattern** (`notify-subscribers/route.ts` lines 235-241, the exact per-call try/catch shape to copy for the debug route's `getPageRecordMap` invocation):
```typescript
try {
  candidates = await getUnemailedPublicPosts();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Notify] Unemailed-post query failed: ${message}`);
  return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
}
```

---

### `apps/web/src/components/PostUnavailable.tsx` (NEW, presentational component)

**Analog:** `apps/web/src/templates/default/PostPage.tsx` (header "Back to feed" link markup, lines 19-25; card/surface conventions used site-wide)

**Imports pattern to copy** (subset of `DefaultPostPage.tsx`'s imports — only what's needed):
```typescript
import Link from "next/link";
import { ArrowLeft, CloudOff } from "lucide-react";
```

**"Back to feed" link — exact markup to reuse verbatim** (`apps/web/src/templates/default/PostPage.tsx:19-25`):
```typescript
<Link
  href="/"
  className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-accent transition-colors mb-6"
>
  <ArrowLeft className="w-4 h-4" />
  {CONFIG.site.locale === "ko" ? "목록으로" : "Back to feed"}
</Link>
```
Note: 07-UI-SPEC.md's copywriting contract explicitly overrides this — the new component is **English-only, unlocalized** (no `CONFIG.site.locale` branching), and uses `text-accent`/`hover:text-accent-hover` rather than `text-text-tertiary`/`hover:text-accent`. Copy the link's structural shape (icon + label, `inline-flex items-center gap-1`), not its exact class list or locale branch.

**Existing "content could not be loaded" fallback text — the sibling this component is distinct from** (`DefaultPostPage.tsx:96-102`, untouched by this phase per D-14, useful only as a reference for existing fallback-copy tone in the codebase):
```typescript
<div className="notion-content-wrapper">
  {recordMap ? (
    <NotionPageRenderer recordMap={recordMap} />
  ) : (
    <p className="text-text-secondary italic">Content could not be loaded.</p>
  )}
</div>
```

**Outer article width wrapper to match** (`DefaultPostPage.tsx:16`, so `PostUnavailable` doesn't visibly jump the content column):
```typescript
<article className="max-w-none mx-auto py-8 md:px-4">
```

**Full markup shape** — 07-UI-SPEC.md supplies a complete illustrative JSX block (binding on token/copy/spacing, not on exact structure); reproduced here as the concrete pattern to implement against:
```tsx
<div className="max-w-none mx-auto py-8 md:px-4">
  <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6 rounded-xl border border-border bg-surface">
    <CloudOff className="w-10 h-10 text-warning" strokeWidth={1.5} />
    <h1 className="text-2xl font-semibold text-text-primary">
      This post is temporarily unavailable
    </h1>
    <p className="max-w-md text-text-secondary text-base">
      We couldn&apos;t load this post from Notion right now. This is usually
      temporary — please check back in a few minutes.
    </p>
    <Link
      href="/"
      className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors mt-2"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to feed
    </Link>
  </div>
</div>
```
No props needed — the component takes no `post` data (unlike `DefaultPostPage`), matching UI-SPEC's "template-agnostic, standalone" placement decision.

---

## Shared Patterns

### Bracket-prefixed structured logging (D-01/D-05)
**Source:** used consistently across `apps/web/src/app/api/notify-subscribers/route.ts` (`[Notify] ...`), `apps/web/src/app/api/subscribe/route.ts` (`[Subscribe] ...`), and `apps/web/src/app/layout.tsx` (comment convention, though that instance lacks a log call).
**Apply to:** all new `console.error`/`console.log` lines in `post/[id]/page.tsx` and `lib/notion-x.ts`.
```typescript
console.error(`[Notify] Unemailed-post query failed: ${message}`);
console.error(`[Subscribe] Cross-origin submission rejected — expected host ${boundedExpected}, received origin ${boundedOrigin}.`);
```
This phase's new convention extends the bracket prefix with a colon-separated leg name — `[PostPage:recordMap]`, `[PostPage:chrome]` — and a single-line JSON payload after the prefix (D-05), which has no prior exact precedent in the repo but follows the same "prefix + message" shape.

### `error instanceof Error ? error.message : String(error)` idiom
**Source:** `apps/web/src/app/api/notify-subscribers/route.ts` (lines 237-238, 279-281, 328-330, 355, 362-363) — used identically at every catch site in that file.
**Apply to:** every new catch block in `post/[id]/page.tsx` and `lib/notion-x.ts` that needs to safely extract an error message.
```typescript
const message = error instanceof Error ? error.message : String(error);
```

### Module-scope one-shot log latch
**Source:** `unconfiguredLogged` (`subscribe/route.ts:181`, `notify-subscribers/route.ts:30`) and `originRejectionLogged` (`subscribe/route.ts:173`).
**Apply to:** the new debug route's unconfigured/unauthorized-gate log line, and optionally `lib/notion-x.ts`'s deep-diagnostics gate if repeated probe failures would otherwise spam logs.
```typescript
let unconfiguredLogged = false;
if (!unconfiguredLogged) {
  unconfiguredLogged = true;
  console.error(`[Context] ... Further occurrences in this instance are not logged.`);
}
```

### Fail-closed 404-on-misconfiguration posture
**Source:** `apps/web/src/app/api/subscribe/route.ts:299-328` — bare `new Response(null, { status: 404 })`, indistinguishable from a route that never existed.
**Apply to:** the new debug route (D-07 explicitly requires this posture, not `notify-subscribers`'s 401 — see RESEARCH.md Pitfall C).

### `export const runtime = "nodejs"` declaration
**Source:** both existing API routes (`notify-subscribers/route.ts:7`, `subscribe/route.ts:3`).
**Apply to:** the new debug route (needed for `getPageRecordMap`'s cookie-bearing fetch and any Node-only APIs).

### Silent chrome-failure degradation to empty array
**Source:** `apps/web/src/app/layout.tsx:46-53`.
**Apply to:** the `[PostPage:chrome]` catch block in `post/[id]/page.tsx` (D-13) — same degrade-to-`[]` shape, but this phase's version must add the logging that `layout.tsx`'s precedent omits.

## No Analog Found

None — all four files have a strong existing analog in the codebase (see table above). No file requires falling back to RESEARCH.md's illustrative code alone; RESEARCH.md's snippets were used only to fill in mechanical details (e.g. `ofetch`'s `FetchError` shape) that have no prior in-repo precedent since this is the first `notion-client`-specific error handling in the codebase.

## Metadata

**Analog search scope:** `apps/web/src/app/`, `apps/web/src/app/api/`, `apps/web/src/lib/`, `apps/web/src/templates/`, `apps/web/src/components/`, `packages/core/src/` (read-only reference)
**Files scanned:** `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/lib/notion-x.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/api/notify-subscribers/route.ts`, `apps/web/src/app/api/subscribe/route.ts`, `apps/web/src/templates/default/PostPage.tsx`, `packages/core/src/client.ts` (read-only, not modified)
**Pattern extraction date:** 2026-08-09

**Hard constraints carried forward:**
- `packages/core` is read-only reference only — never modified (REQUIREMENTS.md D-05, published npm package).
- No new npm dependencies (D-07) — `lucide-react`, `next/link`, `next/navigation` (`unstable_rethrow`) are all already present.
- No test files/infrastructure proposed or referenced — repo has zero test infrastructure and none may be added.
