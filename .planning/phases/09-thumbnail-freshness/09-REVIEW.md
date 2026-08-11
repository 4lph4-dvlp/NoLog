---
phase: 09-thumbnail-freshness
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/web/src/app/api/thumbnail/[id]/route.ts
  - apps/web/src/components/PostThumbnail.tsx
  - apps/web/src/components/Profile.tsx
  - apps/web/src/components/notion/MermaidBlock.tsx
  - apps/web/src/templates/default/CategoryPage.tsx
  - apps/web/src/templates/default/HomePage.tsx
  - apps/web/src/templates/default/PostPage.tsx
  - apps/web/src/templates/default/SearchPage.tsx
  - apps/web/src/templates/terminal/Layout.tsx
  - apps/web/src/templates/terminal/PostPage.tsx
  - apps/web/src/templates/terminal/components/TerminalConsole.tsx
  - apps/web/src/types/index.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-08-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed both provenance groups named in scope: Group A (`api/thumbnail/[id]/route.ts`,
`PostThumbnail.tsx`, `types/index.ts`, and the four `templates/default/*` surfaces — Phase 9's own
thumbnail-freshness work) and Group B (`Profile.tsx`, `MermaidBlock.tsx`,
`templates/terminal/Layout.tsx`, `templates/terminal/PostPage.tsx`,
`templates/terminal/components/TerminalConsole.tsx` — the post-merge lint-cleanup commit `9d535a5`).

The route (`api/thumbnail/[id]/route.ts`) is the security-sensitive surface and holds up well: the
raw path segment is never used for anything except `parsePageId()` (verified against
`notion-utils`'s implementation — its output is composed solely of hex digits and dashes, so
interpolating it into the outbound Notion URL is safe), no query string or other caller-controlled
data reaches the outbound fetch, the host allowlist mirrors `next.config.ts` exactly, `redirect:
"error"` closes the open-redirect vector, and the `content-type` assertion plus
`x-content-type-options: nosniff` are both present. `PostThumbnail.tsx` correctly special-cases
`thumbnailType !== "file"` before ever constructing the proxy path, matching the route's own
server-side rejection of the same case (IMG-05 enforced on both sides). No critical/blocker findings.
`npx eslint` and `npx tsc --noEmit` both pass clean on all 12 files, corroborating the plan's own
build/lint claims.

Group B's two behaviorally-edited files were checked against the specific hazards called out in
scope: `MermaidBlock.tsx`'s relocated render effect correctly scopes its `cancelled` flag per-effect-
run and its dependency array (`[code, mermaidReady, isDark]`) is equivalent to the pre-refactor
`renderDiagram`/`[renderDiagram, isDark]` pair — no state can go stale across a superseded run.
`TerminalConsole.tsx`'s relocated auto-typing effect tracks every `setTimeout` it schedules and
clears all of them on cleanup — but the cleanup does not reset `isTyping` back to `false`, a real gap
in an otherwise correct rewrite (see WR-01; currently unreachable by any in-repo caller, so scored a
warning rather than a blocker).

Three warnings and three info-level items are below; none are blocking. See details for exact
citations and fixes.

## Warnings

### WR-01: Auto-typing cleanup can leave `isTyping` permanently stuck true

**File:** `apps/web/src/templates/terminal/components/TerminalConsole.tsx:257-296`
**Issue:** The auto-typing effect's cleanup (`clearAll`, returned at lines 270 and 294) only clears
pending timers — it never resets the `isTyping` state. If this effect were ever re-run mid-sequence
with a new falsy `initialCommand` (dependency array is `[initialCommand]`, line 296), the cleanup
would fire after `setIsTyping(true)` (line 274) had already executed but before the terminating timer
at line 282-288 (which is the only code path that calls `setIsTyping(false)`) had a chance to run. The
`!initialCommand` early return (line 258) on the new effect invocation then skips scheduling anything
that would reset `isTyping`, permanently disabling the input (`disabled={isTyping}` at line 331) for
the remaining lifetime of the component instance.

None of the four current call sites (`HomePage.tsx` `initialCommand="neofetch"`, `CategoryPage.tsx`
`initialCommand="ls"`, `SearchPage.tsx` `initialCommand={\`find "${query}"\`}` which never reaches the
`isTyping`-setting branch because of the `path === "~/search"` early-return, and `PostPage.tsx`
`initialCommand=""` which never enters the effect body at all) pass a value that can transition from
truthy to falsy on an already-mounted instance, so this cannot currently be triggered — but it is a
real hole in the cleanup contract that a future caller (e.g. a dynamic search-as-you-type command) would
hit immediately.

**Fix:**
```tsx
const clearAll = () => {
  timers.forEach(clearTimeout);
  setIsTyping(false); // always leave the input usable, even on a cancelled run
};
```

### WR-02: No timeout on the outbound thumbnail fetch

**File:** `apps/web/src/app/api/thumbnail/[id]/route.ts:91-102`
**Issue:** `fetch(post.thumbnail, { redirect: "error", headers: {...} })` has no `signal` /
`AbortController` timeout. A slow or hanging upstream S3 response ties up the whole Function
invocation with no fast-fail path; the request only ends when the platform's own function-duration
limit kicks in (itself explicitly flagged as unconfirmed for this project in `.claude/CLAUDE.md`'s
Constraints section). Every uncached-thumbnail request pays this risk, not just a rare edge case.
**Fix:**
```ts
upstream = await fetch(post.thumbnail, {
  redirect: "error",
  headers: { "User-Agent": NOLOG_USER_AGENT },
  signal: AbortSignal.timeout(8000),
});
```

### WR-03: `dangerouslySetInnerHTML` + Mermaid `securityLevel: "loose"` is a known XSS-adjacent pattern

**File:** `apps/web/src/components/notion/MermaidBlock.tsx:67-70` (initialize call) and `:186-189`
(`dangerouslySetInnerHTML={{ __html: svg }}`)
**Issue:** `mermaid.initialize({ ..., securityLevel: "loose", ... })` disables Mermaid's own label-
escaping/sandboxing, and the rendered SVG is injected verbatim via `dangerouslySetInnerHTML`. This is
a documented risk pattern for Mermaid.js: `loose` mode permits raw HTML/tags inside diagram labels,
and injecting that output directly into the DOM (rather than through Mermaid's own sanitizing render
target, or `securityLevel: "strict"`/`"sandbox"`) means any diagram source containing a crafted label
can execute script in the reader's session. This predates the reviewed diff (only the effect's
structure/guard changed in `9d535a5`, not this configuration) and the realistic exploitation path in
this project's current single-owner-authors-own-posts model is narrow — but it is present, unchanged,
in a file under review, and would become directly exploitable the moment this codebase gains any
multi-author or less-trusted-content-source Notion workspace.
**Fix:** Prefer `securityLevel: "strict"` (or `"sandbox"`, which renders into an iframe) unless a
specific diagram feature genuinely requires `loose`; if `loose` is required, sanitize `svg` (e.g. via
DOMPurify with an SVG-safe profile) before passing it to `dangerouslySetInnerHTML`.

## Info

### IN-01: Proxy path built without `encodeURIComponent`

**File:** `apps/web/src/components/PostThumbnail.tsx:41`
**Issue:** ``/api/thumbnail/${post.id}`` interpolates `post.id` directly. `post.id` is always a
Notion page UUID today (verified against `mapPageToPost()` in `packages/core/src/client.ts:125`,
which sets `id: page.id` straight from the Notion API), so this is not currently exploitable, but it
is a raw string interpolation into a URL path with no defensive encoding.
**Fix:** `` `/api/thumbnail/${encodeURIComponent(post.id)}` ``

### IN-02: Terminal template's `PostPage` bypasses the thumbnail-freshness fix entirely

**File:** `apps/web/src/templates/terminal/PostPage.tsx:70-80`
**Issue:** Unlike the four `default`-template surfaces, this file still renders
`<Image src={post.thumbnail} .../>` directly instead of going through `PostThumbnail`/the new proxy
route. For a `"file"`-type thumbnail this is the raw, ~1-hour-expiring presigned S3 URL — exactly the
staleness bug Phase 9 exists to fix — baked straight into this page's render. This is out of Phase 9's
stated rollout (`09-01-SUMMARY.md` explicitly scopes to the four `default` surfaces) and the
`terminal` template is inactive (`site.config.ts` sets `template: "default"`), so this is not a live
regression today, only a gap that would surface immediately if an operator switched templates.
**Fix:** When/if `terminal`'s `PostPage` is revisited, swap this block for
`<PostThumbnail post={post} variant="hero" />` to match the `default` template's behavior.

### IN-03: Near-identical card-list markup duplicated across three files

**File:** `apps/web/src/templates/default/HomePage.tsx:31-76`,
`apps/web/src/templates/default/SearchPage.tsx:50-93`,
`apps/web/src/templates/default/CategoryPage.tsx:45-90`
**Issue:** The `<article>...<PostThumbnail variant="card" />...</article>` block (title, summary,
category chip, tags, date) is byte-for-byte identical across all three files. This predates Phase 9 —
the diff only swapped each file's inline thumbnail markup for `<PostThumbnail>` — but it's directly
visible in every file reviewed here and is the same kind of duplication `PostThumbnail` itself was
introduced to eliminate for the thumbnail piece specifically.
**Fix:** Extract a shared `PostCard` component (post, and optionally a `showCategory`/`emptyState`
slot) the same way `PostThumbnail` was extracted, so all three surfaces stay in sync by construction.

---

_Reviewed: 2026-08-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
