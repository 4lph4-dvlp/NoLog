# Phase 8: Content Rendering Fix - Pattern Map

**Mapped:** 2026-08-10
**Files analyzed:** 6 (2 modified + 1 modified/template-split + 2 deleted-content + 1 delete-whole-route)
**Analogs found:** 6 / 6 (all self-analogs — this phase edits/deletes the exact files Phase 7 last touched; Phase 7's PATTERNS.md already mapped the same four files and is reused per instruction rather than re-derived)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/web/src/lib/notion-x.ts` (MODIFIED — add UA, delete `describeFetchFailure` + probe, keep `isDiagnosticsEnabled`) | service/utility (data-access wrapper) | request-response, config-injection | itself (current state, `07-PATTERNS.md`'s analog map) + `apps/web/src/lib/notion.ts` (module-level constant convention) | exact (self) |
| `apps/web/src/app/post/[id]/page.tsx` (MODIFIED — replace 2 call sites, thread `contentFetchFailed`) | route (server component) | request-response, per-concern error isolation | itself (current state) | exact (self) |
| `apps/web/src/templates/default/PostPage.tsx` (MODIFIED — 2-way → 3-way branch at line 96-102) | component (presentational, server) | request-response, conditional render | itself (current state) | exact (self) |
| `apps/web/src/templates/terminal/PostPage.tsx` (UNCHANGED — confirm compiles) | component (presentational, client) | request-response | N/A — verification-only, no analog needed | not applicable |
| `apps/web/src/app/api/diagnose-page/route.ts` (DELETED in full) | route (API route handler) | request-response, secret-gated | N/A — deletion, no pattern to copy | not applicable |
| Shared UA constant (NEW export, module: Claude's Discretion — `lib/notion-x.ts` recommended) | config/constant | n/a | `apps/web/src/lib/notion.ts:6` (`NOTION_CACHE_TAG`), `apps/web/src/lib/notion-x.ts:33` (`DIAGNOSTICS_GATE_VALUE`), `apps/web/src/site.config.ts` (`CONFIG.revalidate`) | exact (repo has 3 live precedents for this exact shape) |
| `isRecordMapEmpty`-shaped helper (NEW, module: Claude's Discretion — `lib/notion-x.ts` recommended, could also live inline in `page.tsx` or the template) | utility (pure function) | transform | `apps/web/src/app/api/diagnose-page/route.ts:69` (`blockCount: Object.keys(recordMap?.block ?? {}).length` — being deleted, but its shape is the direct source for this helper per 08-RESEARCH Finding 4) | role-match (source is being deleted, but the expression is reusable) |

## Pattern Assignments

### `apps/web/src/lib/notion-x.ts` (service/utility)

**Analog:** itself, current state (read directly this session, full 172 lines).

**Full current file structure to preserve** (imports, doc-comment style, `NotionAPI` construction — lines 1-16):
```typescript
import { NotionAPI } from "notion-client";
import { parsePageId } from "notion-utils";

/**
 * Unofficial Notion API client for fetching full page content (recordMap).
 * ...
 */
const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
});
```
**Change required:** add `ofetchOptions.headers["User-Agent"]` to this exact constructor call — this is the one and only place D-06 permits the UA to be applied.

**Shared constant declaration pattern to copy** (module-level, exported, `UPPER_SNAKE_CASE`, with a comment explaining WHY, not what — matches `NOTION_CACHE_TAG` in `apps/web/src/lib/notion.ts:6` and `DIAGNOSTICS_GATE_VALUE` in this same file at line 33):
```typescript
// apps/web/src/lib/notion.ts:6 (file-local, NOT exported — closest sibling precedent)
const NOTION_CACHE_TAG = "notion-posts";

// apps/web/src/lib/notion-x.ts:33 (file-local, NOT exported — same file the UA constant will live in)
const DIAGNOSTICS_GATE_VALUE = "1";
```
The UA constant should be **exported** (unlike these two examples) since Phase 9 reuses it (D-06) — no exact in-repo precedent for an exported single-value string constant exists yet in this file, so follow `apps/web/src/lib/notion.ts:52` (`export const notion = nologClient.notion;`) for the export shape: a plain `export const NAME = value;`, no barrel re-export needed.

**Full constructor change to make** (this is the fix itself, D-01/D-02/D-03; the exact string is Claude's Discretion within D-03's shape):
```typescript
export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)";

const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
  ofetchOptions: {
    headers: {
      "User-Agent": NOLOG_USER_AGENT,
    },
  },
});
```

**What survives the teardown, verbatim, lines 25-38** — do not touch:
```typescript
export async function getPageRecordMap(pageId: string) {
  return notionX.getPage(pageId);
}

const DIAGNOSTICS_GATE_VALUE = "1";

export function isDiagnosticsEnabled(): boolean {
  return process.env.NOTION_DEBUG_DIAGNOSTICS === DIAGNOSTICS_GATE_VALUE;
}
```
**Landmine (flagged prominently, not a footnote):** `isDiagnosticsEnabled` is imported by `apps/web/src/lib/post-availability.ts:2` and called at line 116 (`buildResponseDetail`), and by `apps/web/src/app/api/diagnose-page/route.ts:2,40` (the route being deleted — that import disappears automatically with the route). `post-availability.ts` is **not modified this phase** and must keep compiling. Do not delete `isDiagnosticsEnabled`, `DIAGNOSTICS_GATE_VALUE`, or reorder them out of exported scope.

**What is deleted in full, lines 40-171** (confirmed no other export in this file depends on these private helpers, per `07-RESEARCH.md`/`08-RESEARCH.md` Finding 5):
```typescript
function isFetchErrorShape(err: unknown): err is Error & { status?: number; ... } { ... }   // lines 47-51
function describePageIdShape(pageId: string): "compact-32-hex" | "dashed-uuid" | "unrecognized" { ... }  // lines 54-62
const LOAD_PAGE_CHUNK_URL = "https://www.notion.so/api/v3/loadPageChunk";  // line 68
const BODY_EXCERPT_MAX_LENGTH = 200;  // line 71
export async function describeFetchFailure(error: unknown, pageId: string, allowProbe = false): Promise<string> { ... }  // lines 86-171, includes the D-04 raw-fetch probe
```
**Caution — `BODY_EXCERPT_MAX_LENGTH` name collision:** `apps/web/src/lib/post-availability.ts:37` declares its own **separate, file-local** `BODY_EXCERPT_MAX_LENGTH = 200` constant. Deleting `notion-x.ts`'s copy does not affect `post-availability.ts`'s copy — they are two independent module-scope `const`s with the same name in different files; no import ties them together. Do not "clean up" the one in `post-availability.ts` — it is out of scope (that file is not modified this phase).

**`isRecordMapEmpty`-shaped helper — recommended placement and pattern** (08-RESEARCH Finding 4; source expression to copy is `apps/web/src/app/api/diagnose-page/route.ts:69`, being deleted, but its shape is the direct source):
```typescript
// apps/web/src/app/api/diagnose-page/route.ts:69 (deleted file — shape only, not import)
blockCount: Object.keys(recordMap?.block ?? {}).length

// Recommended new helper in lib/notion-x.ts, exported alongside getPageRecordMap:
export function isRecordMapEmpty(recordMap: ExtendedRecordMap): boolean {
  return Object.keys(recordMap.block ?? {}).length <= 1;
}
```
Type `ExtendedRecordMap` comes from `notion-types` (already a direct dependency per `08-RESEARCH.md` Finding 3 — `notion-utils`/`notion-types` are confirmed direct deps, not transitive).

---

### `apps/web/src/app/post/[id]/page.tsx` (route, server component)

**Analog:** itself, current state (lines 1-166, read directly this session).

**Current imports to modify** (line 1-11 — remove `describeFetchFailure` from the `notion-x` import):
```typescript
import { getPost, getCategories, getPosts } from "@/lib/notion";
import { getPageRecordMap, describeFetchFailure } from "@/lib/notion-x";   // ← remove describeFetchFailure
import { classifyMissingPost } from "@/lib/post-availability";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";
import DefaultPostPage from "@/templates/default/PostPage";
import TerminalPostPage from "@/templates/terminal/PostPage";
import PostUnavailable from "@/components/PostUnavailable";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";
```
Becomes:
```typescript
import { getPageRecordMap, isRecordMapEmpty } from "@/lib/notion-x";  // if the helper lives here
```
(`isRecordMapEmpty` import only needed if the emptiness check happens in the route rather than the template — Claude's Discretion per 08-RESEARCH Finding 3's closing note.)

**Exact two call sites being replaced** (lines 115-121 and 132-145, verbatim current code):
```typescript
let recordMap: Awaited<ReturnType<typeof getPageRecordMap>> | null = null;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap] ${await describeFetchFailure(error, id, true)}`);
  recordMap = null;
}
...
let categories: string[] = [];
let relatedPosts: Post[] = [];
try {
  categories = await getCategories();
  if (post.category) {
    const allPosts = await getPosts();
    relatedPosts = allPosts.filter(p => p.category === post.category);
  }
} catch (error) {
  console.error(`[PostPage:chrome] ${await describeFetchFailure(error, id, false)}`);
  categories = [];
  relatedPosts = [];
}
```
**Replacement pattern — plain `console.error(prefix, error)`, matching `.claude/CLAUDE.md`'s own documented convention** ("Log error objects directly, not just strings, to preserve stack traces") — this is the exact style recommendation from `08-RESEARCH.md` Finding 5/Open Question 2, not invented here:
```typescript
let recordMap: Awaited<ReturnType<typeof getPageRecordMap>> | null = null;
let contentFetchFailed = false;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap]`, error);
  recordMap = null;
  contentFetchFailed = true;
}
...
} catch (error) {
  console.error(`[PostPage:chrome]`, error);
  categories = [];
  relatedPosts = [];
}
```
**Repo-wide precedent for this exact bracket-prefix + bare-error-object shape** (grep confirms it is the prevailing convention outside this phase's own describeFetchFailure-JSON deviation): `apps/web/src/app/layout.tsx` comment convention (no call, but same bracket style); nearest concrete match is `console.error(\`[Context] Description:\`, error)` as documented verbatim in `.claude/CLAUDE.md`'s Error Handling / Logging sections — this is a repo *convention document*, not a single file, so treat `.claude/CLAUDE.md` itself as the authority here rather than hunting for one more file-level example.

**Prop-threading precedent — how `recordMap`/`categories`/`relatedPosts`/`subscribeSlot` already travel from this route to a template** (lines 147-165, verbatim):
```tsx
if (CONFIG.template === "default") {
  return <DefaultPostPage post={post} recordMap={recordMap} />;
} else if (CONFIG.template === "terminal") {
  return (
    <TerminalPostPage
      post={post}
      recordMap={recordMap}
      categories={categories}
      relatedPosts={relatedPosts}
      subscribeSlot={<SubscribeSection variant="terminal" />}
    />
  );
}
return <DefaultPostPage post={post} recordMap={recordMap} />;
```
Adding one more prop to `DefaultPostPage` follows exactly this shape — add `contentFetchFailed={contentFetchFailed}` (and `isRecordMapEmpty(recordMap)`-derived boolean if computed here rather than in the template) to **both** `<DefaultPostPage .../>` call sites (lines 148 and 165), and to neither `<TerminalPostPage .../>` call site (confirmed zero change needed there, see below).

---

### `apps/web/src/templates/default/PostPage.tsx` (component, presentational)

**Analog:** itself, current state (lines 1-108, read directly this session).

**Current prop interface** (lines 9-12, exact):
```typescript
interface DefaultPostPageProps {
  post: Post;
  recordMap: any; // Allow any type since it's from notion-x which has complex types
}
```
**Recommended widened interface** (per 08-RESEARCH Finding 3 — narrows `any` to the real type as a side effect, not required but recommended since `ExtendedRecordMap` is already an installed type):
```typescript
import type { ExtendedRecordMap } from "notion-types";

interface DefaultPostPageProps {
  post: Post;
  recordMap: ExtendedRecordMap | null;
  contentFetchFailed: boolean;
}
```

**Exact ternary being split, lines 96-102, verbatim current code — this is the single locked target of the UI-SPEC:**
```tsx
<div className="notion-content-wrapper">
  {recordMap ? (
    <NotionPageRenderer recordMap={recordMap} />
  ) : (
    <p className="text-text-secondary italic">Content could not be loaded.</p>
  )}
</div>
```
**Replacement — exact markup and copy, locked by `08-UI-SPEC.md` Placement & Composition Notes (binding on token/copy, illustrative on structure):**
```tsx
<div className="notion-content-wrapper">
  {recordMap && !isRecordMapEmpty(recordMap) ? (
    <NotionPageRenderer recordMap={recordMap} />
  ) : contentFetchFailed ? (
    <p className="text-text-secondary italic">
      This post&apos;s content could not be loaded right now.
    </p>
  ) : (
    <p className="text-text-secondary italic">This post has no content yet.</p>
  )}
</div>
```
Both `<p>` elements reuse the exact class list (`text-text-secondary italic`) and exact wrapper (`.notion-content-wrapper`, `<article className="max-w-none mx-auto py-8 md:px-4">` at line 16) already present — no new token, no new spacing, no new color (per `08-UI-SPEC.md` Design System / Spacing Scale / Color sections, all "zero new").

**Everything else in this file (header, thumbnail, comments, lines 1-95 and 104-108) is untouched** — confirmed by `08-UI-SPEC.md`'s own scope statement: "this phase's diff is contained entirely to the one conditional inside `.notion-content-wrapper`."

---

### `apps/web/src/templates/terminal/PostPage.tsx` — confirmed zero changes required

Not read this session (out of scope, per `08-RESEARCH.md` Finding 3, `[VERIFIED: apps/web/src/templates/terminal/PostPage.tsx:13-19]`, already quoted verbatim in `07-PATTERNS.md`/`08-RESEARCH.md`):
```typescript
interface TerminalPostPageProps {
  post: Post;
  recordMap: any;
  categories: string[];
  relatedPosts: Post[];
  subscribeSlot?: React.ReactNode;
}
```
This is a **separate TypeScript interface** from `DefaultPostPageProps` — TypeScript does not unify them structurally when passed as JSX props. `post/[id]/page.tsx`'s terminal call site (lines 153-161) does not and will not pass `contentFetchFailed`. This compiles unchanged. **No pattern to copy — this file is confirmed out of scope, not merely deferred.**

---

### `apps/web/src/app/api/diagnose-page/route.ts` — deletion precedent

**No prior clean-file-deletion precedent exists elsewhere in this milestone** (Phases 1-7 only ever added files; this is the first deletion). No analog to copy — this is a straightforward `rm` of the entire file (82 lines, read in full this session), removing the route from the Next.js route list. The only pattern of note is **scope discipline**: the file's only two imports not shared elsewhere (`describeFetchFailure`, and its own `safeCompare`/`gateRejectionLogged` are file-local and die with it) confirm nothing else needs cleanup as a consequence of this specific deletion beyond the two `describeFetchFailure` call sites already covered above.

**Verification step to lift into the plan verbatim** (08-RESEARCH.md Finding 5's own checklist item):
```bash
npm run build --workspace=apps/web   # confirm /api/diagnose-page absent from route list
grep -rn "describeFetchFailure" apps/web/src   # confirm zero matches
```

---

## Shared Patterns

### Module-level exported constant, `UPPER_SNAKE_CASE`, single-value string
**Source:** `apps/web/src/lib/notion.ts:6` (`NOTION_CACHE_TAG`, file-local), `apps/web/src/lib/notion-x.ts:33` (`DIAGNOSTICS_GATE_VALUE`, file-local), `apps/web/src/site.config.ts` (`CONFIG.revalidate`, nested).
**Apply to:** the new `NOLOG_USER_AGENT` constant — same declaration shape, but `export`ed (unlike the two file-local examples) because Phase 9 needs to import it.
```typescript
export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)";
```

### Bracket-prefixed logging, bare error object (not JSON-stringified)
**Source:** `.claude/CLAUDE.md` Error Handling / Logging sections (repo-wide documented convention: `console.error(\`[Context] Description:\`, error)` — "Log error objects directly, not just strings, to preserve stack traces"). This supersedes Phase 7's own `describeFetchFailure`-JSON convention, which is being deleted specifically because it was the diagnostic-only deviation from this baseline.
**Apply to:** both replaced call sites in `post/[id]/page.tsx` (`[PostPage:recordMap]`, `[PostPage:chrome]`).
```typescript
console.error(`[PostPage:recordMap]`, error);
console.error(`[PostPage:chrome]`, error);
```

### Prop threading from route to template
**Source:** `apps/web/src/app/post/[id]/page.tsx:147-165` — `recordMap`, `categories`, `relatedPosts`, `subscribeSlot` all travel this exact way (computed above in the function body, passed as named JSX props at each of the 2-3 call sites for a given template branch).
**Apply to:** `contentFetchFailed` (and, if not computed inside the template, an `isRecordMapEmpty`-derived boolean) — add to both `<DefaultPostPage .../>` call sites, add to neither `<TerminalPostPage .../>` call site.

### Env-gated feature stays inert when unset
**Source:** Cusdis (`NEXT_PUBLIC_CUSDIS_APP_ID`), Resend (notify route env vars), `isDiagnosticsEnabled()` itself.
**Apply to:** nothing new this phase creates a gated feature — this pattern is cited only to reinforce D-05's refusal to add a `NOTION_USER_AGENT` env var: the phase's whole goal is fewer knobs, and the UA is deliberately the one outbound-request constant in this repo that is *not* env-gated.

## No Analog Found

None — every file this phase touches is either editing its own current-state code (self-analog, strongest possible match) or being deleted outright (no pattern needed). The two genuinely new pieces (`NOLOG_USER_AGENT`, `isRecordMapEmpty`) both have concrete same-repo shape precedents (module constants; the `blockCount` expression in the route being deleted), so nothing falls back to `08-RESEARCH.md`'s illustrative code alone.

## Metadata

**Analog search scope:** `apps/web/src/lib/`, `apps/web/src/app/post/[id]/`, `apps/web/src/templates/default/`, `apps/web/src/templates/terminal/`, `apps/web/src/app/api/diagnose-page/`, `apps/web/src/app/api/` (sibling routes, reference only)
**Files scanned:** `apps/web/src/lib/notion-x.ts`, `apps/web/src/lib/notion.ts`, `apps/web/src/lib/post-availability.ts`, `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/templates/default/PostPage.tsx`, `apps/web/src/app/api/diagnose-page/route.ts`, `07-PATTERNS.md` (reused per instruction, not re-derived)
**Pattern extraction date:** 2026-08-10

**Hard constraints carried forward into planning:**
- `packages/core` is read-only reference only — never modified (REQUIREMENTS.md D-05, published npm package).
- No new npm dependencies (D-07) — `notion-types`'s `ExtendedRecordMap`, `notion-utils` are already direct dependencies.
- `isDiagnosticsEnabled()` MUST survive the teardown — imported by `apps/web/src/lib/post-availability.ts:2,116`, a permanent, unmodified file. This is the second cross-file coupling landmine of this kind found in this milestone (07-CONTEXT flagged the first); treat it with the same weight.
- `apps/web/src/lib/post-availability.ts` has its OWN file-local `BODY_EXCERPT_MAX_LENGTH` constant (line 37) — do not confuse with or "clean up" alongside `notion-x.ts`'s copy being deleted; they are unrelated, same-named, different-file constants.
- `apps/web/src/templates/terminal/PostPage.tsx` needs zero changes and is confirmed to compile unchanged — its prop interface is structurally separate from `DefaultPostPageProps`.
- Zero test infrastructure exists and none may be added — no test-file analogs proposed above; verification is `npm run build`/`npm run lint` + grep + deployed-site observation, per `08-RESEARCH.md`'s Validation Architecture section.
