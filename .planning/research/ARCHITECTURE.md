# Architecture Research — v1.1 Integration Map

**Domain:** Subsequent-milestone integration (bug fixes + feature) into an existing Next.js 16 App Router blog
**Researched:** 2026-08-09
**Confidence:** HIGH (all claims verified by reading the actual files in this repo, plus the `notion-client` v7.10.0 type declarations installed in `node_modules`)

This is not a greenfield architecture doc. It is an integration map: where each of the three v1.1 fixes actually lands in the existing codebase, what's new vs. modified, and what it costs against this project's locked constraints (no new infra, generic for any forker, `packages/core` is published).

---

## 1. Image Freshness Architecture

### Full lifetime trace of a thumbnail URL

```
Notion "thumbnail" files property (S3 presigned URL, Notion-side TTL ≈ 1h)
        │
        ▼
packages/core/src/client.ts: getFileUrl() reads files[0].file.url  ← RAW URL CAPTURED HERE
        │  mapPageToPost() also runs getFileType() → "file" | "external" | null
        ▼
Post.thumbnail (string | null) + Post.thumbnailType ("file"|"external"|null)
   (packages/core/src/types.ts — thumbnailType already documents the 1h S3 expiry
    in its own JSDoc, added in v1.0 for the email-digest fail-open logic)
        │
        ▼
apps/web/src/lib/notion.ts: getPosts()/getPost() — React cache() wrapper around
NologClient, whose constructor bakes in fetchOptions: { next: { revalidate: 180,
tags: ["notion-posts"] } }.  ← URL IS NOW INSIDE A CACHED fetch()
        │
        ▼
apps/web/src/templates/default/HomePage.tsx / PostPage.tsx:
  <Image src={post.thumbnail} .../>  ← URL SERIALIZED INTO SERVER-RENDERED HTML
        │
        ▼
Next Full Route Cache (ISR) entry for "/" or "/post/[id]"
  — this HTML, containing the (possibly already-old) presigned URL, is what gets
    served to the NEXT visitor until a request triggers background regeneration.
  — CRITICAL: Next's ISR regeneration is *lazy*, not a background timer. If zero
    traffic arrives for hours, the 180s "revalidate" number is irrelevant — the
    cached HTML is served as-is, however old it actually is, and only THAT
    request triggers a background regen (visitor sees the stale page; the NEXT
    visitor sees the fresh one). This is the actual mechanism behind "blank on
    first visit, fixed after refresh": low-traffic blog, presign expired during
    the gap, first hit of the day serves the stale/expired HTML.
        │
        ▼
Browser requests /_next/image?url=<encoded-presigned-url>&w=...&q=75
  (next.config.ts remotePatterns already allow-lists both S3 hosts Notion uses:
   s3.us-west-2.amazonaws.com, prod-files-secure.s3.us-west-2.amazonaws.com)
        │
        ▼
Vercel's image optimizer fetches the ORIGIN presigned URL server-side.
  If the presign already expired (per the trace above), S3 returns 403/expired →
  optimizer has nothing to serve → broken/blank image in the browser.
```

**Where the bug actually lives:** not in `mapPageToPost()` (correctly captures whatever URL Notion returns at fetch time — this part is doing its job) and not in the `next/image` optimizer (correctly fetches whatever URL it's given). It lives at the **ISR cache boundary in `apps/web/src/lib/notion.ts`**, specifically in the *lazy* nature of ISR regeneration: the page's cached HTML can be arbitrarily older than `CONFIG.revalidate` (180s) suggests, because nothing proactively regenerates it — only a real request does, and that request itself gets served the stale copy.

One inconsistency worth surfacing to whoever plans this phase: `apps/web/src/site.config.ts:57` sets `revalidate: 180` with the comment `/** ISR revalidation interval in seconds (30 mins to prevent image expiration) */` — the comment says 30 minutes, the value is 3 minutes. Not a blocker (180s is *more* protective than 30 min, not less), but the comment is stale/wrong and should be reconciled — and either way, shortening this number further doesn't fix the actual mechanism (see below).

### Candidate architectures, evaluated against this project's constraints

| Candidate | Layer touched | Fixes root cause? | Cost |
|---|---|---|---|
| **Image proxy route handler** (new `apps/web/src/app/api/thumbnail/[id]/route.ts`) | New apps/web route; `HomePage.tsx`/`PostPage.tsx` swap `src` | **Yes.** Decouples the *embedded* URL from the *resolved* URL: HTML forever embeds a stable `/api/thumbnail/{postId}` reference (the Post ID never expires); the actual presigned URL is resolved fresh at the moment a browser requests the image, not at the moment the page was last regenerated. | Low. Zero `packages/core` changes (see below). One extra Notion API round-trip per uncached image request, tunable via the proxy's own `Cache-Control` header (recommend well under the ~1h presign window, e.g. 30 min, to bound the request rate without reintroducing the same failure mode at a smaller scale). |
| **`unoptimized` / custom `loader`** | `next.config.ts` / per-`Image` prop | **No.** `unoptimized` just skips Vercel's optimizer and has the browser fetch the *same already-possibly-expired* URL directly — same failure, one less indirection. A custom `loader` *could* be pointed at the same proxy endpoint above, but at that point it's not a distinct architecture — it's plumbing into the proxy route, i.e. a restatement of option 1. | N/A as a standalone fix. |
| **Shorten `revalidate`** | `site.config.ts` | **No, only reduces probability.** ISR regeneration is request-triggered, not a timer — a low-traffic personal blog can go far longer than any `revalidate` value between real hits. Shortening to e.g. 60s narrows the window somewhat but cannot guarantee freshness after an idle gap, which is exactly the scenario in the bug report. | Low effort, but doesn't actually solve it — not recommended as the fix (may be worth doing anyway for unrelated content freshness, but frame it as unrelated). |
| **Cache by page ID, not by URL** | Conceptual — this *is* the design principle behind the proxy route | **Yes** — this is the same architecture as option 1, restated. The fix is: never bake the ephemeral resource (the presigned URL) into long-lived HTML; bake the stable reference (the Notion page ID) and resolve the ephemeral resource at request time. | Same as option 1. |

**Recommendation: image proxy route (`/api/thumbnail/[id]`), gated by the existing `Post.thumbnailType` field.**

Concretely:
- `thumbnailType === "file"` → known-expiring S3 presigned URL → route through the proxy.
- `thumbnailType === "external"` → forker pasted a public URL, doesn't expire → use `post.thumbnail` directly, no proxy needed.

This distinction **already exists in the published `packages/core` package** (`Post.thumbnailType`, added in v1.0 for the email-digest fail-open logic — see its JSDoc in `packages/core/src/types.ts:18-28`). That means **this fix requires zero changes to `packages/core` and zero changes to the `Post` shape** — the entire fix is additive apps/web-only work, which sidesteps the published-package breaking-change constraint entirely. This is the single most load-bearing finding of this section.

Route handler design notes for whoever plans this phase:
- It must **not** reuse the module-level `getPost()`/`getPosts()` exported from `apps/web/src/lib/notion.ts` — those are wrapped in `cache()` around a `NologClient` instance whose `fetchOptions` bakes in `next: { revalidate: 180, tags: [...] }` at construction time. Calling them would just hit the *same* stale ISR-backed data path this fix exists to bypass.
- Instead, construct a fresh, unmemoized lookup — either instantiate a second `NologClient` (imported straight from `@4lph4/nolog-core`, same as `notion.ts` already does) with `fetchOptions: { cache: "no-store" }`, or add a small dedicated uncached export to `notion.ts` following the exact precedent already set by `getUnemailedPublicPosts()`/`markEmailed()` (both deliberately un-`cache()`-wrapped, with a comment explaining why — same rationale applies here: this route must observe live state, never a memoized read).
- Whether the route **redirects (307)** to the resolved presigned URL or **streams the bytes itself** is a real implementation choice to settle during planning, not research: redirecting is simpler but depends on unverified behavior (does Vercel's image optimizer follow a redirect from a same-origin `/api/...` source when resolving `<Image src="/api/thumbnail/...">`?); streaming is guaranteed to work with `next/image` and with a plain `<img>` fallback, at the cost of proxying bytes through the function. Recommend streaming as the default unless redirect is explicitly verified against the deployed Vercel project.
- `next.config.ts`'s `remotePatterns` need **no changes** either way — they gate what the *client-facing* `<Image src="https://...">` optimizer is allowed to fetch from directly; a same-origin `/api/thumbnail/...` path doesn't go through that allow-list, and if the route streams bytes server-side, it's an ordinary outbound `fetch()`, not subject to `remotePatterns` at all.

**Files: new vs. modified**
- NEW: `apps/web/src/app/api/thumbnail/[id]/route.ts`
- NEW (recommended, avoids duplicating the `thumbnailType` ternary): `apps/web/src/lib/thumbnail.ts` — a single `resolveThumbnailSrc(post)` helper
- MODIFIED: `apps/web/src/templates/default/HomePage.tsx` (thumbnail `src`)
- MODIFIED: `apps/web/src/templates/default/PostPage.tsx` (hero thumbnail `src`)
- UNCHANGED: `packages/core/*` (both `client.ts` and `types.ts` — the metadata this fix needs already shipped in v1.0)
- UNCHANGED: `next.config.ts`

---

## 2. Content-Fetch Architecture

### What `getPageRecordMap()` actually is, verified against the installed package

`apps/web/src/lib/notion-x.ts` wraps `notion-client` v7.10.0's `NotionAPI.getPage()`. Checked the installed type declarations directly (`node_modules/notion-client/build/index.d.ts`): this library's HTTP layer is **`ofetch`**, a separate library from the global `fetch()` Next.js patches for its Data Cache. `NotionAPI.getPage()` accepts an `ofetchOptions` parameter — `ofetch`'s own config shape, which has **no concept of `next: { revalidate, tags }`**. This is the concrete, verified reason `getPageRecordMap()` has no `cache()`/ISR wrapper while everything in `notion.ts` does: **it structurally cannot participate in Next's fetch-level Data Cache the way `NologClient`'s raw `fetch()` calls do.** This is not an oversight to "fix" by copying the `notion.ts` pattern — the pattern doesn't apply to this library.

**Runtime:** `apps/web/src/app/post/[id]/page.tsx` has no `export const runtime = "edge"` (confirmed by grep — contrast with `apps/web/src/app/api/og/route.tsx`, which explicitly sets `runtime = "edge"`). It executes in the default Node.js serverless runtime, which is also required practically: `notion-client`/`ofetch` are not edge-safe. This pins the whole post-detail render path to Node runtime; not something to change now, but a constraint on any future move toward edge rendering for that route.

**Actual freshness cadence (a subtlety worth stating precisely):** because `getPageRecordMap()` has zero caching of its own, it re-executes on every ISR regeneration of `/post/[id]` — which is already driven by the *other* cached calls in that render (`getPost()`, `getCategories()`, `getPosts()`, all tagged `notion-posts`/180s). In practice the recordMap is already about as fresh as the rest of the page, just via the "whole page regenerates together" mechanism, not an explicit cache entry of its own. Wrapping it in `unstable_cache` (or whatever Next 16's current stable caching primitive is — see note below) would add an explicit `notion-posts` tag for future on-demand `revalidateTag()` support and dedupe concurrent in-flight regenerations, but **it would not, by itself, fix the failure-blast-radius problem below** — that's a render-time bug, not a caching-cadence bug.

### The actual blast radius bug

`post/[id]/page.tsx` wraps **three unrelated calls** in one `try`/`catch`:

```ts
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
```

If `getCategories()` or the `getPosts()`-for-related-posts call throws for *any* reason — a transient Notion REST hiccup, a rate limit, anything — `recordMap` gets nulled **even though the recordMap fetch itself already succeeded** a line earlier. `templates/default/PostPage.tsx` then renders "Content could not be loaded." purely because of a categories/related-posts failure. Given the operator has confirmed the Notion pages **are** published to the web, this undifferentiated catch is the leading candidate for why the symptom appears at all: today it is architecturally impossible to tell, from the current logging, whether a given failure was the `notion-client` call, the categories call, or the related-posts call — they all produce the identical console line and the identical user-facing fallback.

This also poisons the ISR cache the way section 1 describes for images: whatever the render produces (good or the caught-null fallback) gets baked into that post's cached HTML for the current revalidate window, so one transient failure at regen time shows the fallback to every visitor until the next real regeneration — not just the one unlucky request.

**Fix: decompose into three independent `try`/`catch` blocks**, each defaulting only its own output and logging its own distinct prefix (`[PostPage] Failed to fetch recordMap:`, `[PostPage] Failed to fetch categories:`, `[PostPage] Failed to fetch related posts:`). This alone turns "Content could not be loaded" back into a signal that means what it says, and is the prerequisite for actually diagnosing the reported bug rather than continuing to guess at it. Secondary, optional hardening: a small retry-with-backoff (1–2 attempts) inside `getPageRecordMap()` itself, since it's the one call in this trio not covered by Next's own fetch-level retry/cache semantics.

### Should this second Notion client live in `packages/core` or stay in `apps/web`?

**Stay in `apps/web`.** Three independent reasons converge:

1. `notion-x.ts`'s own docstring already states the intended separation: "Used exclusively for page rendering via react-notion-x. For database queries... we still use the official `@notionhq/client` in `notion.ts`." This isn't accidental placement — it's a documented boundary.
2. `packages/core` today has **zero** dependency on `notion-client`, `notion-types`, or `react-notion-x` (its `client.ts` only imports `@notionhq/client`). Moving `getPageRecordMap()` there would force every consumer of the published `@4lph4/nolog-core` package — including forkers who never render Notion pages through `react-notion-x` at all — to pull in that dependency tree. That's a strictly worse published-package cost than anything Fix 1 incurs (Fix 1 needs zero `packages/core` changes at all).
3. `getPageRecordMap()` is tightly coupled to a rendering concern (`react-notion-x`'s `ExtendedRecordMap` shape), not a data-modeling concern (`Post`). It belongs next to its consumer (`NotionPageRenderer.tsx`, `PostPage.tsx`), which is exactly where it already is.

**Recommended caching treatment (matches the rest of the data layer without moving the file):** wrap `getPageRecordMap()` in React's `cache()` at minimum (cheap, matches the `notion.ts` pattern for read-only per-request dedupe), and add an explicit Next Data Cache wrapper (`unstable_cache`, or whatever the equivalent stable primitive is in this Next 16.2.4 release — **flag this as a verification item for the phase that implements it**, since the caching-primitive API surface has moved across recent Next major versions and this project's exact version should be checked directly rather than assumed) keyed by `pageId`, tagged `notion-posts` (reusing the existing tag, not inventing a new one — this is what "matches the rest of the data layer" means concretely), with `revalidate: CONFIG.revalidate`. This is about consistency and future on-demand-invalidation support, not the primary fix — the try/catch decomposition above is.

**Files: new vs. modified**
- MODIFIED: `apps/web/src/app/post/[id]/page.tsx` — three independent try/catch blocks
- MODIFIED: `apps/web/src/lib/notion-x.ts` — add caching wrapper (React `cache()` + Data Cache tag), optional retry
- UNCHANGED: `packages/core/*` — this client stays out of the published package entirely
- UNCHANGED: `apps/web/src/templates/default/PostPage.tsx` (the presentational template) — it already correctly renders the fallback only when `recordMap` is falsy; no change needed there, the bug is upstream in the route's data-fetching orchestration

---

## 3. Sidebar State Architecture

### The hazard, stated first because it's the constraint everything else must satisfy

`apps/web/src/templates/default/Layout.tsx` is a **Server Component**. It directly renders `<SubscribeSection variant="default" />` in two places (mobile stack and the desktop right `<aside>`). `SubscribeSection` (`apps/web/src/components/subscribe/SubscribeSection.tsx`) is *deliberately* a Server Component whose entire job is to read `process.env.RESEND_API_KEY` / `process.env.RESEND_AUDIENCE_ID` (secrets, not `NEXT_PUBLIC_*`) server-side and render `null` if unconfigured — its own docstring calls this out as "the one and only env gate for the subscribe feature."

If `Layout.tsx` is naively converted to `"use client"` (the obvious move to hold sidebar-collapse `useState`) **while still directly importing and rendering `<SubscribeSection />`**, Next.js has to pull that import into the client module graph. Since `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` are not `NEXT_PUBLIC_*`, Next does not statically inline them into client bundles — so `process.env.RESEND_API_KEY` evaluates to `undefined` in the browser build, `configured` is always `false`, and **the subscribe form silently disappears for every forker who has it configured** — a straight regression of the shipped v1.0 feature, not a secret leak, but a real and silent breakage that would be easy to ship unnoticed (the page still renders fine, just minus the form).

The codebase has already solved exactly this problem once, for the terminal template: `post/[id]/page.tsx` builds `<SubscribeSection variant="terminal" />` in the Server Component and passes it down as an **already-rendered element** via a `subscribeSlot` prop, with an explicit comment: "never as a direct import inside the client-directive terminal template (D-01, D-04, SEC-03)." The sidebar work must follow the identical pattern.

### Mapping the four options against that constraint

| Option | What it does | Compatible with the hazard above? |
|---|---|---|
| **A. Client wrapper around the whole grid** | A new client component owns collapse state, receives the sidebar contents as `children`/slot props from a Server Component parent | **Yes, and required** — this is the mechanism that keeps `Layout.tsx` server-side while still getting client state. `SubscribeSection`'s rendered *output* crosses the server/client boundary as an RSC payload; its *source* (the env check) never executes in the browser. |
| **B. Two independent client toggle components driving CSS via `data-*` on a shared ancestor** | Small client buttons flip `data-*` attributes | **Yes** — these are new, small, self-contained client components; they don't need to import `SubscribeSection` at all. |
| **C. CSS custom properties (`--sidebar-width`/`--profile-width`) flipped by a class/attribute** | Reuses the custom properties that already exist in `globals.css` | **Yes** — this is the mechanism, not a competing option; it's how B's `data-*` attribute actually changes the rendered width, via new attribute-scoped selectors in `globals.css` (e.g. `html[data-sidebar-left="collapsed"] { --sidebar-width: ...; }`). |
| **D. Blocking inline script in `app/layout.tsx`, mirroring `next-themes`** | Synchronous script before hydration sets DOM attributes from `localStorage` so first paint is already correct | **Yes, and required for constraint (c)** — same technique already in production in this codebase via `next-themes` (`ThemeProvider.tsx`'s `attribute="class"` + `app/layout.tsx`'s `suppressHydrationWarning` on `<html>`). |

**These four are not mutually exclusive alternatives — they compose into one architecture.** A is the *placement* of client state (where the boundary goes), B/C together are the *mechanism* by which that state changes rendered layout, and D is what prevents the flash on first paint. Presenting them as a pick-one menu would be a false framing; the correct design uses A + B + C + D together.

### Concrete design

- New client state lives on `document.documentElement` (the `<html>` tag), as two new attributes (e.g. `data-sidebar-left="expanded"|"collapsed"`, `data-sidebar-right="expanded"|"collapsed"`) — **not** on a wrapper `<div>` inside `Layout.tsx`, because a wrapper div doesn't exist yet at the point a pre-hydration script needs to run, whereas `<html>` does (this is exactly why `next-themes` targets `<html>` for its `.dark` class, and the same reasoning applies here). `apps/web/src/app/layout.tsx` already sets `suppressHydrationWarning` on `<html>` — that already covers attribute-mismatch warnings for these two new attributes as well (it's element-scoped, not per-attribute), so no additional prop is needed there.
- `globals.css` gets new attribute-scoped custom-property overrides for the collapsed state of `--sidebar-width`/`--profile-width` (values TBD in planning — e.g. `0px` to fully hide, or a narrow rail width that keeps a toggle affordance visible), plus a transition and a rule to hide inner content (`SearchBar`/`CategoryList`, `Profile`/`SubscribeSection`) without reflow jank when collapsed.
- The auto-collapse-below-a-width-threshold requirement (proposed default 1280px, per `PROJECT.md`) is a `matchMedia`/resize listener living in the new client component, not a pure CSS media query — because it must *also* write to `localStorage` and interact with the user's manual toggle state (manual override vs. viewport-driven default), which CSS alone can't express.
- `CONFIG.profile.avatarUrl` (needed for the right toggle's circular profile-image button) is a plain literal in `site.config.ts` with no `process.env` reads anywhere in that file (confirmed by reading it) — safe to import directly into a new client component, no need to thread it through Profile.tsx.

**Files: new vs. modified**
- NEW: `apps/web/src/components/layout/SidebarShell.tsx` (client) — owns both collapse booleans, the `matchMedia`/resize listener, `localStorage` read/write, sets the two `data-*` attributes on `document.documentElement`, replaces the two grid `<div>` blocks currently hand-written in `Layout.tsx`
- NEW: toggle button component(s) (client) — hamburger left toggle, circular-avatar right toggle; can live inside `SidebarShell.tsx` or be split out (e.g. `SidebarToggle.tsx`) depending on how the state is shared (a small context or lifted state in `SidebarShell` either way)
- MODIFIED: `apps/web/src/templates/default/Layout.tsx` — **stays a Server Component.** Changes from directly writing the grid markup to building the left/right slot JSX (`SearchBar`+`CategoryList`, `Profile`+`SubscribeSection`) and passing them as props/children into `<SidebarShell>`
- MODIFIED: `apps/web/src/app/layout.tsx` — add the blocking inline pre-hydration script (new, alongside the existing `next-themes` setup, not replacing it)
- MODIFIED: `apps/web/src/app/globals.css` — new attribute-scoped custom-property overrides, transition, collapsed-content-hiding rules
- UNCHANGED: `apps/web/src/components/subscribe/SubscribeSection.tsx` — must not be touched or re-parented into a client module
- UNCHANGED (already client components today, confirmed by reading their headers): `SearchBar.tsx`, `CategoryList.tsx` — their existing "use client" status is unrelated to and unaffected by this work
- UNCHANGED (already a Server Component, confirmed): `Profile.tsx` — stays server-rendered, composed the same way it is today

Scope note carried from `PROJECT.md`: the auto-collapse/toggle UI is a desktop (`md:` and above) concern layered on top of the existing 3-column grid — the existing `md:hidden` mobile stacked layout is untouched by this work and needs no new toggle logic of its own.

---

## Build Order

All three fixes are **file-disjoint** — verified directly, not assumed:

| | Fix 1 (thumbnails) | Fix 2 (content) | Fix 3 (sidebars) |
|---|---|---|---|
| Fix 1 touches | `HomePage.tsx`, `PostPage.tsx` (template), new `api/thumbnail/[id]/route.ts` | — | — |
| Fix 2 touches | — | `app/post/[id]/page.tsx` (route), `lib/notion-x.ts` | — |
| Fix 3 touches | — | — | `templates/default/Layout.tsx`, `app/layout.tsx`, `globals.css`, new `components/layout/*` |

Note the two "PostPage" names that could look like a conflict are two different files: Fix 1 touches `apps/web/src/templates/default/PostPage.tsx` (presentational template — thumbnail `<Image src>`), Fix 2 touches `apps/web/src/app/post/[id]/page.tsx` (the route/data-fetching component — try/catch decomposition). No overlap.

**Recommended order: Fix 2 → Fix 1 → Fix 3, with Fix 1 and Fix 2 safely parallelizable if the workflow supports it.**

Reasoning:

1. **Fix 2 first.** Unlike Fix 1 and Fix 3, part of Fix 2's work is genuinely diagnostic, not just implementation: the try/catch decomposition is a prerequisite for even *knowing* which of the three wrapped calls is the real cause of "Content could not be loaded" on pages the operator has confirmed are published. Doing this first surfaces unknowns (does the real failure turn out to be the categories call, not `notion-client` at all?) before later phases' scope gets locked in, and it's the highest-severity of the three symptoms.
2. **Fix 1 second (or in parallel with Fix 2 — zero shared files).** Its root cause and fix shape are already fully specified (this document nails down the mechanism precisely), it's mechanical to build, and it doesn't depend on anything Fix 2 discovers.
3. **Fix 3 third.** Zero technical dependency on 1 or 2 (confirmed disjoint file sets), but it's the only one of the three that is new UX rather than a correctness bug — sequencing it last is a prioritization call (ship the two broken-experience fixes before spending effort on sidebar polish), not a technical blocker. It also has the largest and most novel file surface (new client components, a new pre-hydration script pattern, CSS changes), so building it last means it's the only work touching `Layout.tsx`/`app/layout.tsx` this milestone — nothing else in this milestone competes for review attention on those files.

---

## Sources

- Direct file reads of every path listed in this milestone's `<files_to_read>` (all cited inline above by path/line where relevant)
- `node_modules/notion-client/build/index.d.ts` (v7.10.0, installed in this repo) — verified `NotionAPI.getPage()`'s HTTP layer (`ofetch`) and its lack of Next.js `next: {revalidate, tags}` support, the load-bearing fact behind Section 2's runtime/caching analysis
- `apps/web/next.config.ts` — verified `images.remotePatterns` already allow-lists both Notion S3 hosts (`s3.us-west-2.amazonaws.com`, `prod-files-secure.s3.us-west-2.amazonaws.com`)
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` — existing project/codebase context, cross-checked against live file reads rather than trusted verbatim

---
*Architecture research for: NoLog v1.1 milestone integration*
*Researched: 2026-08-09*
