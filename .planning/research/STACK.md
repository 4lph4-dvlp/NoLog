# Stack Research

**Domain:** Bug-fix milestone for a Next.js 16 / Notion-as-datastore blog template (image expiry, unofficial Notion renderer failure, sidebar UI state)
**Researched:** 2026-08-09
**Confidence:** HIGH for root-cause diagnosis and version facts (verified directly against npm registry API, GitHub REST API, and official Next.js/Notion docs); MEDIUM for "will fully fix in THIS deployment" claims (not yet live-verified against the actual Vercel function logs)

## Headline finding

**No new npm packages are needed for any of the three fixes.** This milestone is entirely `next.config.ts` semantics + one new Route Handler + one constructor-option change to code already in the repo + a hand-rolled localStorage pattern using patterns already proven in this codebase (`next-themes`, the `mounted`-guard convention documented in this repo's own `CLAUDE.md`). Anything that looks like "add a package" below is explicitly called out as **not needed** in "What NOT to Add."

---

## A. Next.js 16 image handling for expiring remote URLs

### Root cause chain (verified against primary sources)

1. Notion's file-object API returns an `expiry_time` field and states, verbatim: **"The URL is valid for one hour. If the link expires, send an API request to get an updated URL... Don't cache or statically reference these URLs. To refresh access, re-fetch the file object."** (developers.notion.com/reference/file-object, fetched 2026-08-09). `NologClient.getFileUrl()` (`packages/core/src/client.ts:66-76`) returns this raw, time-bounded S3 URL as `post.thumbnail` — it is baked into the props passed to `next/image` in both `HomePage.tsx` and `PostPage.tsx`.
2. That value gets baked into the ISR-generated HTML (`CONFIG.revalidate = 180`, `notion-posts` tag). Next.js's ISR uses stale-while-revalidate: after the 180s window elapses, the **first** visitor is served the **stale** HTML (with whatever presigned URL was current at *generation* time) while a regeneration happens in the background; only the **next** visitor after that regen completes gets the fresh URL. On a low-traffic blog, "stale" can persist far longer than 180s if nobody hits the page — so the embedded presigned URL can already be past its 1-hour window by the time a visitor's browser actually requests it.
3. The browser then requests `/_next/image?url=<expired-presigned-url>...`. Next's Image Optimizer fetches it fresh (confirmed via `packages/next/src/server/image-optimizer.ts` on the `vercel/next.js` canary branch, fetched 2026-08-09: on `!res.ok` it does `Log.error(...); throw new ImageError(res.status, '"url" parameter is valid but upstream response is invalid')` — **no negative-result caching**, so this isn't a "stuck 403 forever" bug). S3 returns 403 for the expired signature, the `ImageError` propagates, and the `<Image>` renders broken/blank.
4. On manual refresh, if the background regen from step 2 has completed, the visitor now gets HTML with a brand-new (valid) presigned URL from the just-refreshed Notion API response, and the image loads. This exactly matches the "blank until refresh" symptom and confirms the milestone's leading hypothesis.

### What Next.js 16 actually offers, and what does/doesn't apply

| Option | What it does | Applies here? |
|---|---|---|
| `images.minimumCacheTTL` | TTL (seconds) for the **optimizer's own cache** of an already-successfully-optimized image, keyed by the exact request URL. Default in Next 16 is **14,400s (4 hours)**, "whichever is larger" vs. upstream `Cache-Control`. No cache-invalidation mechanism exists. | Irrelevant to the bug — it governs re-fetch frequency for a URL that *succeeded* once, not what happens when the URL is already expired on first fetch. Lowering it does not help; the URL is dead before the optimizer ever sees it. |
| `unoptimized={true}` / `images.unoptimized` | Skips Next's optimizer entirely; browser fetches `src` directly. | **Does not fix the bug** — the underlying S3 URL is still expired regardless of whether Next's optimizer sits in front of it. Removing the optimizer removes a debugging layer, not the root cause. |
| Custom `loader` / `images.loaderFile` | Lets you compute the final image URL yourself (given `src`, `width`, `quality`) instead of using Next's built-in `/_next/image` service. | Not the right tool — a loader still just transforms a URL you hand it; it can't "know" to re-fetch Notion for a live URL unless it becomes a full network call itself, which is exactly what a route-handler proxy already does more simply (see B). |
| `images.remotePatterns[].search` | **New emphasis in Next.js 16** (search added in 14.2.14, but 16's docs stress it as a security control): if set, the `src` query string must match **exactly**. Omitting `search` (as this project's `next.config.ts` already does) allows any query string — correct, since presigned query params change every request. | Already correctly configured — leave `search` unset for the S3 patterns. Do NOT add a `search` constraint; that would make every distinct presigned URL fail to match and 400 immediately. |
| `images.maximumRedirects` (added Next 16.0.0, default `3`) | Optimizer follows up to N HTTP redirects when fetching a remote image, and — this is the load-bearing fact for fix B below — **"these redirects do not need to satisfy remotePatterns"** on the redirect target. | This is what makes the proxy-redirect fix (B) work without touching `remotePatterns` at all: the initial `src` becomes a local, same-origin proxy path (always allowed), and the S3 redirect target is exempt from remotePatterns matching. |
| `images.qualities` | Allowlist of quality values Next 16 will serve (default `[75]`, became enforced in 16.0.0). | Unrelated to this bug; already fine at default since no explicit `quality` values are passed. |

**Next 15 → 16 changes relevant here:** `qualities` became an enforced allowlist (16.0.0), `maximumRedirects` and `dangerouslyAllowLocalIP` were added (16.0.0), `maximumResponseBody` (16.1.2) and `maximumDiskCacheSize` (16.1.7) were added. None of these are breaking for this project's current config, but `maximumRedirects` existing since 16.0.0 is the enabling fact for the proxy approach below — this project is on 16.2.4, so it already has it. (Source: Next.js official docs "Version History" table for the Image component, `nextjs.org/docs/app/api-reference/components/image`, fetched 2026-08-09, doc `lastUpdated: 2026-05-04`, version shown `16.3.0`.)

**Current npm-latest for `next` is 16.3.0** (published 2026-08-03, verified via `registry.npmjs.org` 2026-08-09); the project pins `16.2.4`. No upgrade is required for any of the above — every relevant field (`remotePatterns.search`, `maximumRedirects`) has existed since 16.0.0.

---

## B. Serving Notion-hosted images reliably — the fix

**Recommended approach: a same-origin Route Handler that redirects to a freshly-signed URL, fetched at request time.** This is the standard, widely-used community pattern for this exact problem (no single dominant npm package implements it — it's normally hand-rolled in ~20-30 lines because the logic is trivial and workspace-specific). Concretely:

- New file: `apps/web/src/app/api/notion-image/[pageId]/route.ts`
  - `export const runtime = "nodejs";` (matches this repo's existing convention in `api/subscribe/route.ts` and `api/notify-subscribers/route.ts`).
  - On `GET`, re-fetch the page from Notion (via `NologClient`/the existing `getPost()` server-loader, or a lighter direct property read) to obtain a **live** `thumbnail` URL, then `return Response.redirect(freshUrl, 307)` (or `NextResponse.redirect`).
  - Because the fetch happens at request time — not at ISR-generation time — the URL handed back is always within its fresh 1-hour window, decoupling image freshness from HTML/ISR staleness entirely.
- Change `HomePage.tsx` (`apps/web/src/templates/default/HomePage.tsx:41`) and `PostPage.tsx` (`apps/web/src/templates/default/PostPage.tsx:86`) to point `<Image src={...}>` at `/api/notion-image/${post.id}` instead of `post.thumbnail` directly.
- **No change needed to `apps/web/next.config.ts` remotePatterns** — the initial `src` is now a local path (always allowed), and the S3 redirect target is exempt from `remotePatterns` matching per the `maximumRedirects` doc note above. The existing S3 `remotePatterns` entries can stay as-is (harmless, and still relevant if any Notion page-body images are ever referenced directly rather than through the proxy — see the note on `react-notion-x`'s own image mapping below).
- Minor, acceptable tradeoff: Next's optimizer will still cache the **optimized output** of `/api/notion-image/[id]` for `minimumCacheTTL` (4h default) or the proxy's own `Cache-Control`, whichever is larger. Since the proxy route itself has no explicit `Cache-Control`, Next.js will apply its 4h default — meaning a thumbnail image *swapped in Notion* could take up to ~4h to visibly update through the optimizer's cache. This is a pre-existing-class tradeoff (not a regression) and out of scope to tune further this milestone; if it matters later, set a short `Cache-Control` on the proxy response.

**Alternatives considered and rejected:**

| Alternative | Why not chosen |
|---|---|
| `notion-utils`' `defaultMapImageUrl` | This helper is designed for `react-notion-x`'s **recordMap block images** (i.e., images embedded inside a page's *content*, item C's domain), not for **database property files** (the `thumbnail` files-type property read via `@notionhq/client`/`NologClient`). It doesn't apply to the Home-feed thumbnail path, which never touches `react-notion-x`. |
| A CDN/Cloudflare-Worker re-signing layer (seen in community writeups, e.g. macarthur.me's "Serving Notion Presigned Images with Cloudflare Workers") | Violates this project's explicit "no new infrastructure beyond Notion + Vercel + GitHub" constraint — it's a second hosting/compute surface. |
| Downloading and self-hosting images at build time (also a common community workaround) | Requires a build-time fetch step and a place to persist the downloaded files (Vercel Blob/S3/etc.) — new infrastructure, and stale relative to Notion edits until the next full rebuild. Rejected for the same reason as the CDN option. |
| `images.unoptimized` + direct S3 `src` | Doesn't address the root cause (see table in section A) — the URL is still dead on arrival regardless of whether Next's optimizer is in the path. |

---

## C. `notion-client` on Vercel — the second fix

### Exact current versions (verified directly against `registry.npmjs.org`, 2026-08-09)

| Package | Installed (this repo) | npm `latest` | Published |
|---|---|---|---|
| `notion-client` | `^7.10.0` | `7.10.0` | 2026-03-19 |
| `notion-types` | `^7.10.0` | `7.10.0` | 2026-03-19 |
| `notion-utils` | `^7.10.0` | `7.10.0` | 2026-03-19 |
| `react-notion-x` | `^7.10.0` | `7.10.0` | 2026-03-19 |

**This project is already on npm's current-latest for the whole `react-notion-x` monorepo family.** No package-manager upgrade is available today that would change behavior.

### The exact bug, found in a 5-day-old GitHub issue

**GitHub issue [NotionX/react-notion-x#710](https://github.com/NotionX/react-notion-x/issues/710)**, opened 2026-08-04, still open as of 2026-08-09: *"notion-client requests now 403 (Cloudflare) because no User-Agent is sent."*

- **Root cause (from the issue body):** Notion's Cloudflare front now rejects `www.notion.so/api/v3/...` POST requests that carry no `User-Agent` header. Node's `undici`-based `fetch` (used internally by `notion-client` on Node 24, and functionally identical on the Node runtime Vercel uses) sends no default UA. Reproduced by the reporter: an otherwise-identical request differing only in the presence of a `User-Agent` header returns 403 vs. 200.
- **Confirmed by an actual fix already merged upstream:** commit `28d3192` ("feat(notion-client): send default User-Agent", author `@Souler`) adds `'User-Agent': 'notion-client (+https://github.com/NotionX/react-notion-x)'` to every outgoing header set in `packages/notion-client/src/notion-api.ts` (verified by fetching the commit's patch via the GitHub REST API, 2026-08-09). It is bundled into GitHub tag **`v7.10.1`, released 2026-08-08** — **but as of this check `notion-client`'s npm `dist-tags.latest` is still `7.10.0`; `v7.10.1` has not been published to npm yet.**
- This is a highly plausible, currently-live root cause for item 2: `apps/web/src/lib/notion-x.ts` constructs `NotionAPI` with only `authToken`, sending no `User-Agent`, so `getPageRecordMap()` would throw on Vercel exactly the way it would for the issue reporter; `apps/web/src/app/post/[id]/page.tsx`'s catch (line 75-80) then sets `recordMap = null`, producing the observed "Content could not be loaded." fallback. This is consistent with — and does not require — a Notion sharing/permissions problem, matching the operator's confirmation that the pages ARE published.

### The fix — works TODAY on the currently-installed 7.10.0, no version bump required

`ofetchOptions` is already a documented constructor option on the installed `7.10.0` (confirmed by reading `packages/notion-client/src/notion-api.ts` from the npm-published `v7.10.0` tag directly, 2026-08-09):

```typescript
// apps/web/src/lib/notion-x.ts
const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
  ofetchOptions: {
    headers: {
      "User-Agent": "NoLog (+https://github.com/<owner>/NoLog)",
    },
  },
});
```

No new dependency, no `package.json` change. Optional follow-up (not required this milestone): once `notion-client@7.10.1`+ lands on npm, `npm update notion-client notion-types notion-utils react-notion-x` would make the explicit header technically redundant (the library will send its own default UA) — but leaving the explicit header in place is harmless and slightly more defensive against Notion changing its bot-detection rules again.

### Maintenance status (verified via GitHub REST API, 2026-08-09)

- Repo `NotionX/react-notion-x`: `pushed_at: 2026-08-08T09:15:30Z` (i.e., **yesterday** relative to this research date) — actively maintained, not abandoned.
- `open_issues_count: 184` — a large but not unusual number for a widely-forked unofficial-API wrapper used by hundreds of Notion-blog templates; not itself a red flag.
- A release shipping specifically to fix this exact bug class landed within 4 days of the bug being reported — a strong, current signal of active stewardship.
- Runtime requirement: `notion-client` uses Node's `fetch`; this project's `apps/web/src/app/post/[id]/page.tsx` has no `export const runtime = "edge"` (unlike `api/og/route.tsx`, which explicitly opts into edge), so it already runs on the Node.js runtime by default — compatible.

---

## D. Client-side UI state persistence for collapsible sidebars

### How `next-themes` (0.4.6, installed & npm-latest, published 2025-03-11) avoids flash — and what to reuse

Verified against the `pacocoursey/next-themes` README (fetched 2026-08-09): `ThemeProvider` injects a small **blocking inline script** into the document before the rest of the page paints, which reads the stored preference (localStorage, key `theme` by default) and sets the correct attribute (`class` in this project's `ThemeProvider.tsx`) on `<html>` **before hydration**, avoiding both a visible flash and a hydration-mismatch warning. This requires `suppressHydrationWarning` on `<html>` (already necessary wherever `next-themes` touches that element) because the attribute next-themes sets doesn't match what the server rendered.

**This is the correct model to reuse for the sidebar-collapse state**, since the requirement (`localStorage` persistence, no flash) is structurally identical to the dark-mode problem this project already solved. Two viable implementations, in order of fidelity:

1. **Hand-rolled blocking inline script** (closest fidelity to `next-themes`'s technique): a small `<script dangerouslySetInnerHTML={...}>` placed in the root layout (or `Layout.tsx`) that runs before paint, reads `localStorage.getItem("nolog_sidebar_left")` / `"nolog_sidebar_right"`, and toggles a class/attribute on the sidebar wrapper synchronously. `next-themes` itself only manages its own `class`/`data-theme` attribute — it does not expose a generic API for arbitrary extra state, so this piece must be hand-written; there's no package to install for it.
2. **This repo's existing `mounted`-guard convention** (documented in this repo's own `CLAUDE.md` under "Conditional Rendering" / "React Patterns": `useState(false)` → `useEffect` sets `true` → server/first-paint renders a matching-dimension placeholder). This is simpler to write and consistent with how `ThemeToggle`-adjacent client components already behave in this codebase, at the cost of a very brief hydration-only flash (acceptable for a sidebar collapse toggle, much less visually jarring than a full dark/light flash, since default-expanded is a reasonable placeholder state).

Given the milestone also requires **auto-collapse below a viewport width** — which the server cannot know at render time without a cookie (this project doesn't use cookies anywhere and the requirement explicitly specifies `localStorage`, not cookies) — a *perfect* zero-flash first paint isn't achievable purely with option 1 either, unless the inline script also runs a `matchMedia` check pre-paint and combines it with the stored preference. Recommendation: use the blocking-script technique (option 1) for the *stored preference*, and let CSS media queries (not JS) own the *viewport-driven* auto-collapse threshold, since CSS breakpoints apply before any JS executes and need no hydration reconciliation at all — only the *user-toggled override* of that state needs JS/localStorage.

### Tailwind CSS 4 (installed `^4`, npm-latest `4.3.3`, published 2026-07-16, verified 2026-08-09) — what's relevant, what isn't

- **`@container` queries are the wrong tool here.** Container queries (`@container` on a parent + `@sm:`/`@md:` on descendants) respond to a *containing element's* own size, not the viewport — useful for component-level responsiveness inside a fluid layout, not for "collapse when the *browser window* is narrow," which is what the milestone specifies (`768px` grid activation point, proposed `1280px` collapse threshold — both viewport-relative). Do not reach for `@container` for this feature.
- **What to use instead:** Tailwind v4's existing arbitrary-variant syntax already supports one-off viewport breakpoints with no config change: `min-[1280px]:grid-cols-[...]`, matching this codebase's existing pattern of inlining pixel thresholds directly in `Layout.tsx` (e.g., its current `md:` grid activation). This is the lowest-friction option and requires no changes to `globals.css`.
- **Alternative if a *named*, reusable breakpoint is preferred** (e.g., because the same `1280px` threshold needs to be referenced from multiple components): Tailwind v4's CSS-first config lets you declare `--breakpoint-<name>: <value>` inside an `@theme` block in `globals.css`, then use it as an ordinary variant (`sidebar-collapse:hidden`). **Note:** this project's `globals.css` currently has no `@theme` block at all — its custom properties (`--sidebar-width`, `--profile-width`, etc.) are plain CSS variables, not Tailwind theme tokens — so adopting `@theme` here would be a first for this codebase. Given there's exactly one threshold value needed, the arbitrary-variant approach (no `@theme` block) is the better fit for this milestone's scope; introduce `@theme` only if a second/third breakpoint reuse case appears later.

---

## Recommended Stack — installed versions to use as-is (no upgrades required)

### Core Technologies

| Technology | Installed | npm-latest (checked 2026-08-09) | Why keep current pin |
|---|---|---|---|
| `next` | 16.2.4 | 16.3.0 (2026-08-03) | All image-config fields this milestone needs (`remotePatterns.search`, `maximumRedirects`) shipped in 16.0.0 — no upgrade needed to fix the image bug. |
| `notion-client` / `notion-types` / `notion-utils` / `react-notion-x` | `^7.10.0` | 7.10.0 (2026-03-19) on npm; GitHub has an unreleased-to-npm `v7.10.1` tag (2026-08-08) with the User-Agent fix | The fix ships via a constructor option (`ofetchOptions`) already present in the installed version — no version bump required to unblock item 2. |
| `next-themes` | 0.4.6 | 0.4.6 (2025-03-11) | Already current-latest; its blocking-inline-script technique is the pattern to imitate for sidebar state, not a library to extend. |
| `tailwindcss` | `^4` | 4.3.3 (2026-07-16) | Arbitrary-variant breakpoints (`min-[1280px]:`) work at the installed major version; no minor-version-specific feature is required. |

### Supporting Libraries

None to add. All three fixes are config + one new Route Handler + one constructor-option change + hand-rolled JS using patterns this codebase already has.

## Installation

```bash
# No installs required for this milestone.
# Optional, deferred follow-up once notion-client 7.10.1 reaches npm:
npm install notion-client@^7.10.1 notion-types@^7.10.1 notion-utils@^7.10.1 react-notion-x@^7.10.1 --prefix apps/web
```

## What NOT to Add

| Avoid | Why | Use Instead |
|---|---|---|
| A CDN/edge-worker image re-signing service (Cloudflare Workers, R2, etc.) | New infrastructure beyond Notion + Vercel + GitHub — violates this project's explicit constraint | A Vercel Route Handler proxy (`/api/notion-image/[pageId]`) — already within the existing stack |
| `notion-utils`'s `defaultMapImageUrl` for the Home-feed/thumbnail bug | It targets `react-notion-x` **recordMap block images**, not the database `thumbnail` **files property** this bug is about — wrong layer | The route-handler proxy in section B |
| Replacing `notion-client`/`react-notion-x` with the official Notion blocks API | Explicitly locked out of scope by this milestone's decision | Keep the unofficial client; fix via the `ofetchOptions` User-Agent header |
| `images.unoptimized` as "the fix" for expiring thumbnails | Doesn't address root cause — the S3 URL is dead on arrival either way | The proxy-redirect pattern |
| A test framework, RSS feed, or Vercel KV/Redis | Explicitly out of scope per this milestone's constraints | N/A |
| Cookie-based SSR for sidebar collapse state (seen in some UI-kit sidebar implementations) | This project's requirement explicitly specifies `localStorage`, and the codebase has no cookie infrastructure anywhere else | Blocking inline script (localStorage) + CSS media query for the viewport-driven auto-collapse |

## Stack Patterns by Variant

**If the User-Agent fix in `notion-x.ts` alone doesn't resolve item 2 in production:**
- Next hypothesis to test: Vercel's serverless outbound IP ranges being IP-blocked by Notion's Cloudflare front (distinct from the UA-sniffing issue in #710, and NOT confirmed by any source found in this research — flagged as an open question below).
- Check actual Vercel function logs for the literal status code/response body `getPageRecordMap()` throws, rather than assuming issue #710 is the only cause.

**If `notion-client@7.10.1`+ becomes available on npm during/after this milestone:**
- Upgrading is safe and makes the explicit `User-Agent` header redundant (but harmless to keep).

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| `next@16.2.4` | `images.maximumRedirects` (default 3), `images.remotePatterns[].search` (optional) | Both available since Next 16.0.0; no upgrade needed for the proxy-redirect approach in section B. |
| `notion-client@7.10.0` | `ofetchOptions` constructor field | Present in the installed version (verified against the npm-published `v7.10.0` source directly) — the UA fix does not require upgrading to `7.10.1`. |
| `next-themes@0.4.6` | Next.js App Router / React 19 | No known incompatibility; its blocking-script technique is framework-version-agnostic (it's just an injected `<script>`). |
| `tailwindcss@^4` | Arbitrary variants (`min-[Npx]:`) | Available since Tailwind v4.0; no minimum patch version required. |

## Open Questions

- **Not yet live-verified:** whether adding the `User-Agent` header to `notion-x.ts` actually resolves the "Content could not be loaded." error on THIS specific deployment (4lph4-bl0g.vercel.app) — issue #710 is a strong, recent, exact-symptom match from the library's own GitHub repo, but it was not cross-checked against this project's actual Vercel function logs/error text during this research pass. Recommend capturing the real thrown error (status code + body) from `getPageRecordMap()` in production before/after the fix to confirm.
- **Unconfirmed:** whether Notion's Cloudflare protection also blocks by source IP (in addition to missing User-Agent) for Vercel's serverless IP ranges specifically. No source found in this research addresses IP-based blocking for `notion-client`/Vercel; the only confirmed mechanism is the missing-UA 403.
- **Not measured:** the real-world gap between "last ISR regen" and "presigned URL expiry" on the live site — i.e., whether the SWR staleness window is typically minutes or hours on 4lph4-bl0g.vercel.app's actual traffic pattern. Doesn't change the recommended fix (the proxy fix is correct regardless of the gap's size), but would confirm the diagnosis with certainty if instrumented.
- **`notion-client@7.10.1`'s exact npm publish date is unknown** — only its GitHub tag date (2026-08-08) was confirmed; npm's registry still showed `7.10.0` as latest as of 2026-08-09. Re-check before deciding whether to fold an upgrade into this milestone or defer it.

## Sources

- `registry.npmjs.org` (direct API queries for `notion-client`, `notion-types`, `notion-utils`, `react-notion-x`, `next-themes`, `next`, `tailwindcss`) — fetched 2026-08-09, primary source (the actual package registry)
- `api.github.com/repos/NotionX/react-notion-x` (repo metadata, releases, tag `v7.10.1`, commit `28d3192` patch, `open_issues_count`, `pushed_at`) — fetched 2026-08-09, primary source
- [GitHub issue NotionX/react-notion-x#710](https://github.com/NotionX/react-notion-x/issues/710) — "notion-client requests now 403 (Cloudflare) because no User-Agent is sent," opened 2026-08-04 — HIGH confidence, primary source, current
- `raw.githubusercontent.com/NotionX/react-notion-x/v7.10.0/packages/notion-client/src/notion-api.ts` — confirmed `ofetchOptions` constructor field exists in the installed version — fetched 2026-08-09, primary source
- [Next.js Image Component docs](https://nextjs.org/docs/app/api-reference/components/image) (`lastUpdated: 2026-05-04`, doc version shown `16.3.0`) — fetched 2026-08-09, official docs, includes full Version History table used for the 15→16 delta
- `github.com/vercel/next.js/blob/canary/packages/next/src/server/image-optimizer.ts` — confirmed no negative-caching of upstream fetch failures — fetched 2026-08-09, primary source
- [Notion API file object reference](https://developers.notion.com/reference/file-object) — confirmed 1-hour URL expiry and "don't cache" guidance verbatim — fetched 2026-08-09, official docs
- [pacocoursey/next-themes README](https://github.com/pacocoursey/next-themes) — confirmed blocking-inline-script + localStorage mechanism and `suppressHydrationWarning` requirement — fetched 2026-08-09, primary source
- WebSearch aggregation on Tailwind CSS v4 container queries and `@theme`/arbitrary-breakpoint syntax — MEDIUM confidence (search-engine synthesis, cross-referenced against multiple independent Tailwind-focused blog posts, not a single official-docs fetch); core claims (container queries are viewport-independent, `min-[Npx]:` arbitrary variants exist, `@theme --breakpoint-*` is the v4 named-breakpoint mechanism) are consistent with publicly documented Tailwind v4 behavior and were not contradicted by any source found
- This repo: `.planning/PROJECT.md`, `apps/web/next.config.ts`, `apps/web/src/lib/notion-x.ts`, `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/templates/default/HomePage.tsx`, `apps/web/src/templates/default/PostPage.tsx`, `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/components/ThemeProvider.tsx`, `apps/web/src/app/globals.css`, `apps/web/package.json`, `packages/core/src/client.ts` — read directly, 2026-08-09

---
*Stack research for: NoLog v1.1 "Live Blog Bug Fixes & Reading Width"*
*Researched: 2026-08-09*
