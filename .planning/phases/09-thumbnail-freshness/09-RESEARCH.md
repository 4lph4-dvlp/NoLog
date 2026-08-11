# Phase 9: Thumbnail Freshness - Research

**Researched:** 2026-08-11
**Domain:** Next.js 16 App Router image proxy + Data Cache semantics, against an existing NoLog deployment
**Confidence:** HIGH for codebase facts (everything below cites a `Read` of the actual file); MEDIUM for the
Data Cache staleness mechanism (documented Next.js behaviour, not directly measured against this route this
session)

This is **not** a from-scratch architecture doc. `ARCHITECTURE.md` §1 already specifies the proxy-resolution
pattern and `09-CONTEXT.md` has locked the open choices (D-01…D-13). This document covers only the thin band
the phase scope asked for: resolving the IMG-02 mechanism contradiction, the `next/image`-to-route-handler
interaction, which resolution path is actually correct given the real `NologClient` constructor, the concrete
security-guard shapes, and validation architecture. It also surfaces three findings that neither `CONTEXT.md`
nor `ARCHITECTURE.md` mention, discovered by reading the code this session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All four `default`-template surfaces get the fix — `HomePage.tsx:41`, `SearchPage.tsx:59`,
  `CategoryPage.tsx:55`, `PostPage.tsx:89` — not just the two IMG-01/IMG-02 name.
- **D-02:** Extract the shared thumbnail rendering into one component (three card blocks are already
  byte-identical; the hero shares resolution logic but differs in shape/`priority`).
- **D-03:** The `terminal` template is **not** changed this phase.
- **D-04:** The email digest is **not** touched this phase (deferred idea, not silently skipped).
- **D-05:** The route **streams the bytes**; it does **not** 307-redirect. Not to be re-opened this phase.
- **D-06:** The response carries a **long `s-maxage` with `immutable`** so the CDN, not the Function, absorbs
  repeat requests.
- **D-07:** The route accepts **a Notion page identifier only, never a caller-supplied URL**.
  `Post.thumbnailType` (shipped v1.0) already distinguishes `"file"` (expiring) from `"external"` (stable);
  `packages/core` and the `Post` type must not change.
- **D-08:** **Reproduce IMG-02 before fixing it** — the ROADMAP's stated mechanism ("cached HTML carries an
  expired presign") is confirmed for `/` but **not** confirmed for `/post/[id]`, which Phase 8 measured as
  `ƒ (Dynamic)` with `cache-control: private, no-cache, no-store` on every request. This research resolves
  what the real mechanism is — see "Resolving the IMG-02 Contradiction" below.
- **D-09:** Failure state is the existing `bg-surface` grey box plus a centred `lucide-react` icon. No caption
  text.
- **D-10:** Failure is detected **client-side via `next/image`'s `onError`**, not a server-side pre-check.
- **D-11:** Verify **after** the fix only — one idle window, not two.
- **D-12:** Verification follows `PITFALLS.md` 13/14 — idle gap > Notion's ~1h presign lifetime, cold-cache
  load, check the **raw origin URL**, not `/_next/image?...`. `next dev` proves nothing (Pitfall 12).
- **D-13:** Do **not** simulate expiry with a hand-constructed stale URL — wait out the real gap.

### Claude's Discretion

- The route path and the shape of its identifier parameter.
- The shared component's name and file location, and how much of it is the client boundary.
- The exact `s-maxage` value and whether `stale-while-revalidate` accompanies it.
- The icon chosen from `lucide-react` and its size at each of the two card shapes.

### Deferred Ideas (OUT OF SCOPE)

- Using the proxy URL in the email digest (D-04).
- `terminal` template parity (TMPL-F01, D-03).
- A caption on the failure placeholder (D-09).
- Switching the proxy to a 307 redirect (D-05) — see this doc's note below: Next 16's own docs turn out to
  bear on this, recorded as an Open Question, not re-opened.
- Adding a new IMG requirement for search/category to REQUIREMENTS.md (D-01 covers them without it).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMG-01 | Home-feed thumbnails visible on first load after any idle gap | Confirmed mechanism (Full Route Cache, `/` is `PRERENDER`/`Expire 1y`) — unchanged from `ARCHITECTURE.md`. Fix: route + shared component, D-01/D-02. |
| IMG-02 | Post detail hero thumbnail visible under the same conditions | Mechanism corrected — see "Resolving the IMG-02 Contradiction". Same fix (D-01) closes it regardless of which cache layer was responsible. |
| IMG-03 | Route accepts only a Notion page id; rejects non-allowlisted host, redirect, non-image content-type | Concrete guard shapes below: `parsePageId`, hostname compare against `next.config.ts`, `redirect: "error"`, `content-type` check. |
| IMG-04 | Proper placeholder on genuine thumbnail failure | `ImageOff` from `lucide-react` (confirmed exported, already a dependency) + `onError`, per D-09/D-10. |
| IMG-05 | External thumbnails render unaffected, never touch the new path | `Post.thumbnailType === "external"` branch already exists as a signal; **the local `Post` type apps/web actually uses does not currently expose this field** — see Finding 1 below, load-bearing for this requirement. |

</phase_requirements>

## Summary

The proxy pattern itself needs no more research — `ARCHITECTURE.md` §1 already nails it and `09-CONTEXT.md`
has settled every open choice. What this phase's planning actually needs is: (1) the real reason `/post/[id]`
renders dynamically and whether that makes IMG-02 a real bug via a *different* cache layer than IMG-01 (it
does — the Next.js Data Cache, not the Full Route Cache); (2) confirmation that `next/image` pointed at a
same-origin route needs no `remotePatterns` entry, and how the optimizer's own 4-hour `minimumCacheTTL` floor
interacts with whatever `Cache-Control` the new route sets (verified against Next 16.3.0's own docs); (3) which
of `ARCHITECTURE.md`'s two suggested resolution-path shapes is actually correct — and it turns out only one of
them is, for a reason neither `ARCHITECTURE.md` nor `CONTEXT.md` states (see Finding 2); and (4) three
previously-undocumented facts discovered by reading the actual code this session, the most consequential being
that **the `Post` type apps/web's templates actually import does not have `thumbnailType` on it** — a
compile-time gap directly in this phase's path, not a hypothetical.

**Primary recommendation:** Build the route exactly as `ARCHITECTURE.md` describes, but (a) construct the
uncached lookup as a **second `NologClient` instance with `fetchOptions: { cache: "no-store" }`**, never as an
unwrapped export off the existing `notion.ts` singleton (that singleton's constructor-baked `next: {revalidate:
180}` survives removal of the `cache()` wrapper — removing React's memoisation is not the same as removing
Next's Data Cache), and (b) add `thumbnailType: "file" | "external" | null` to `apps/web/src/types/index.ts`'s
`Post` interface before D-02's shared component tries to branch on it, since every one of the four call sites
imports `Post` from `@/types`, not from `@4lph4/nolog-core`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Thumbnail URL resolution (page id → fresh presigned URL) | API/Backend | — | Must run server-side, per-request-eligible; Notion mints the presign only when asked, so it cannot be baked into cached HTML or resolved client-side. |
| Image byte streaming (proxy response body) | API/Backend | — | Bytes must pass through the code that already ran the host/content-type guards (Pitfall 1); a redirect would move that authority to the client/optimizer. |
| Client-side failure detection → placeholder | Browser/Client | — | D-10: only the browser observes every real failure mode (proxy 5xx, optimizer error, dropped connection), including post-render ones a server probe structurally cannot see. |
| Edge caching of resolved image bytes | CDN/Static | API/Backend (origin) | D-06: the Vercel CDN, not the Function, must absorb repeat requests for the same page id — the Function only sets the header. |
| Presigned URL minting | External (Notion/S3) | — | Entirely Notion's infrastructure; the site only ever *asks* for the current value. |
| Optimized/resized image variant caching | CDN/Static (Vercel image optimizer) | — | A cache layer independent of the proxy's own edge cache — governed by `minimumCacheTTL` vs. the proxy's own `Cache-Control`, whichever is larger (verified, see Finding 4). |
| `thumbnailType` branch decision (file vs. external) | API/Backend (Server Component render) | — | Decided once per render from already-fetched `Post` data; keeps D-07's "no caller-supplied URL" contract intact — the client never chooses the path. |

## Project Constraints (from CLAUDE.md)

- All work must go through a GSD entry point (`/gsd-execute-phase` for this planned phase) — no direct edits
  outside the workflow.
- `@/` import alias required for all non-relative imports (`apps/web/tsconfig.json`).
- 2-space indentation, semicolons, ESLint (`eslint-config-next/core-web-vitals` + `/typescript`) must pass
  clean for any new file.
- Client components require the `"use client"` directive at the top; the codebase's established idiom for a
  client-only failure state is the `mounted`-guard pattern (`ThemeToggle.tsx`) — not directly needed here since
  `onError` doesn't require SSR/CSR reconciliation, but the *file-splitting* convention (a thin client "island"
  receiving Server Component data as props, never importing a secret-gated component directly) is directly
  relevant to D-02's shared component if it needs any Server-only data.
- Error handling convention: catch with `unknown`, log with a `[ComponentName]` bracket prefix via
  `console.error`/`console.warn`, never throw in a render path.
- No test framework may be added (`REQUIREMENTS.md` Out of Scope, carried from v1.0).

## Standard Stack

No new dependencies (D-07 / `REQUIREMENTS.md` D-07). Everything the route and component need is already
installed:

| Library | Version installed | Purpose in this phase | Why no new package |
|---------|---------|---------|--------------|
| `notion-utils` | ^7.10.0 (confirmed installed) | `parsePageId()` — validate/normalize the route's id param | Already a direct dependency of `apps/web`, already imported in `apps/web/src/lib/post-availability.ts:1` for the identical purpose. |
| `lucide-react` | ^1.14.0 in `package.json`, `1.31.0` resolved in `node_modules` (verified via `npm view`) | `ImageOff` icon for the failure placeholder (D-09) | Already a direct dependency; `ImageOff` confirmed exported (`node_modules/lucide-react/dist/esm/icons/index.mjs:830`: `export { default as ImageOff } from './image-off.mjs';`). |
| `next/image` | Next 16.2.4 (installed) | Existing `<Image fill>` usage at all four call sites, unchanged prop surface | Already in use; no upgrade needed. |
| Web Fetch API / `Response` | Node 22 runtime (built-in) | The proxy's own outbound `fetch()` to resolve + stream the image; `redirect: "error"`, `Response(stream, {...})` passthrough | Standard runtime API, zero install. |

**Installation:** none required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual iteration over the upstream fetch body | A hand-rolled `ReadableStream` reader loop | Unnecessary — passing `upstreamResponse.body` straight into `new Response(...)` streams without buffering and is the documented Next.js pattern (see Code Examples). Don't hand-roll this. |
| `parsePageId` (already installed) | A hand-written UUID/compact-hex regex | Would diverge from what Notion's own unofficial-API tooling accepts, and this repo already trusts `parsePageId` for the identical validate-a-page-id-from-a-route-param job in `post-availability.ts`. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages (D-07). Both third-party symbols used (`parsePageId` from
`notion-utils`, `ImageOff` from `lucide-react`) are already-installed dependencies confirmed in `package.json`
and verified present in the resolved `node_modules` tree this session (see Standard Stack table above).

## Resolving the IMG-02 Contradiction (Item 1 — highest-value finding)

**The question D-08 poses:** `ARCHITECTURE.md` §1 traces the bug through the **Full Route Cache** ("this HTML
... is what gets served to the NEXT visitor until a request triggers background regeneration"). Phase 8
measured that `/post/[id]` has **no** Full Route Cache entry at all — it is `ƒ (Dynamic)`,
`cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `x-vercel-cache: MISS` on every one
of 12 requests across a 232-second gap (`08-CACHE-EVIDENCE.md`). So the mechanism as written cannot be what
causes IMG-02, if it is real at all.

### Why `/post/[id]` is dynamic

**Root cause: the file exports no `generateStaticParams`.** Confirmed by direct grep of the whole `apps/web/src/app` and `apps/web/src/lib` trees for `generateStaticParams`, `export const dynamic`, `export const revalidate`,
and `export const runtime` — zero occurrences of the first three in `post/[id]/page.tsx` or anywhere upstream
of it. Next.js's own documented behaviour for a dynamic route segment with no `generateStaticParams`: *"If a
dynamic segment could be prerendered but isn't because it's missing `generateStaticParams`, the route will
fallback to dynamic rendering at request time."* `[CITED: nextjs.org — via web search summary of App Router
dynamic-routing docs, MEDIUM confidence — the underlying official page was not fetched verbatim this session]`
This matches Phase 8's measurement exactly: no known set of ids to prerender at build time → the whole route
pattern renders fresh, every request, with no Full Route Cache participation — not "ISR with a very short
window," genuinely uncached at the page-HTML level.

Two other candidates were checked and ruled out as the cause of the *page-level* dynamic classification:
- `lib/post-availability.ts:88`'s `cache: "no-store"` fetch — only reached inside the `!post` branch of
  `post/[id]/page.tsx` (line 65, `if (!post) { ... classifyMissingPost ... }`), which a successful post render
  never enters. `[VERIFIED: apps/web/src/app/post/[id]/page.tsx:61-90]` — quoted below in Finding 3.
- `getPageRecordMap()` (`lib/notion-x.ts`) — uses `notion-client`'s `ofetch`, not Next's patched global
  `fetch`, so it is invisible to Next's static/dynamic analysis entirely; it cannot be what marks the route
  dynamic (`ARCHITECTURE.md` §2 already established this for the content-fix phase).

### Given it's dynamic, where can a stale presign actually come from?

This is where the phase's own inherited evidence has a gap the plan needs to know about: **Phase 8's
measurements are entirely about `getPageRecordMap()` (the `notion-client`/`ofetch` call for the post body),
not about `getPost()` (the official-API call via `NologClient` that produces `post.thumbnail`).** These are
two structurally different fetches inside the same render. Phase 8's conclusion — "every row above is
therefore a live `loadPageChunk` call to Notion... not a cache read" (`08-CACHE-EVIDENCE.md`) — is true and
correctly scoped to the content-rendering bug it was measuring. It says nothing about whether `getPost(id)`'s
underlying call to `https://api.notion.com/v1/pages/{id}` was served fresh or from Next's **Data Cache**,
because an external HTTP probe of the outer page response cannot distinguish that — a Data Cache hit and a
live upstream call both produce the identical outer response headers Phase 8 recorded.

`getPost()`'s fetch **is** eligible for Next's Data Cache: `lib/notion.ts:8-17` constructs the shared
`nologClient` with `fetchOptions: { next: { revalidate: CONFIG.revalidate, tags: [NOTION_CACHE_TAG] } }`
(`CONFIG.revalidate` = 180, `apps/web/src/site.config.ts:57`), and `packages/core/src/client.ts:313-316`'s
`getPost()` spreads `...this.fetchOptions` directly into its raw `fetch()` call. `[VERIFIED:
apps/web/src/lib/notion.ts:8-17, packages/core/src/client.ts:311-338]`

Per Next.js's official caching guide (fetched this session, HIGH confidence — `nextjs.org/docs/app/guides/caching-without-cache-components`, `lastUpdated: 2026-06-23`, version `16.3.0`): *"By default, Next.js will cache
any `fetch()` requests that are reachable before any Request-time APIs are used."* No dynamic API (`cookies()`,
`headers()`, `searchParams`) is used anywhere before `getPost(id)` is called in `post/[id]/page.tsx` — the only
thing that precedes it is `await params`, which is not itself a Request-time API in this sense. The Data Cache
and the Full Route Cache are documented as **independent layers** of Next's four-layer caching model; a route
losing Full Route Cache eligibility (because it has no `generateStaticParams`) does not, by itself, disable the
Data Cache for the individual `fetch()` calls made during its (fresh, per-request) render.

**Conclusion (MEDIUM confidence — documented mechanism, not measured against this exact route this session):**
`getPost(id)`'s Data Cache entry can go stale by exactly the same lazy, stale-while-revalidate model that
makes ISR possible for `/` — the 180-second `revalidate` is not a hard TTL; it is the point after which the
**next** request for that same fetch key triggers a background refresh, and if no request arrives during a gap,
the entry is not proactively evicted. A specific post that isn't visited for over an hour can have its
`getPost(id)` Data Cache entry — including the now-expired `post.thumbnail` presign it carries — served
unrefreshed on the next visit, even though the *page* itself is freshly server-rendered on every request. **This
means IMG-02 is a real, distinct bug, via the Data Cache rather than the Full Route Cache — a different layer
than IMG-01's, not the same one `ARCHITECTURE.md` names.**

**What this does NOT change:** the planned fix. Phase 9's fix already bypasses both mechanisms by construction
(D-07: the route resolves the URL server-side, per-request, from a source that is neither the Full Route Cache
nor a `revalidate`-tagged Data Cache entry). IMG-02's success criterion should say "the `getPost()` Data Cache
entry" rather than "ISR page cache," which is the correction D-08 asked this research to make.

**What would fully close this loop (not done this session — recorded as an Open Question):** a temporary
latency-timing log around `getPost()`'s internal `fetch()` during the actual idle-gap verification window
(D-11/D-12) would discriminate a near-instant Data Cache hit from a live several-hundred-millisecond Notion
round trip, giving direct evidence rather than documented-behaviour inference. Given D-11 spends the one
available idle window on the fix's own claim, this is not proposed as additional phase work — just named so
the planner and a future debugger know the discriminating test exists if IMG-02 ever needs re-diagnosis.

### Whether the home page's mechanism is confirmed as `ARCHITECTURE.md` describes it

**Yes, unaffected by the above.** `/` has no dynamic route segment, so it *does* participate in the Full Route
Cache — Phase 8 measured `x-vercel-cache: PRERENDER`, `Revalidate 3m / Expire 1y` for it (`08-CACHE-EVIDENCE.md`
line 63). `ARCHITECTURE.md` §1's lifetime trace is accurate for IMG-01 as written; only its extension to
IMG-02 needed correcting.

## `next/image` → Same-Origin Route Handler (Item 2)

**Confirmed, HIGH confidence — Next.js 16.3.0 official docs, fetched this session
(`nextjs.org/docs/app/api-reference/components/image`, `lastUpdated: 2026-05-04`):**

- `src` accepts "An internal path string" with no `remotePatterns` requirement — that configuration item is
  documented as being for "An absolute external URL (must be configured with `remotePatterns`)." A same-origin
  `<Image src="/api/thumbnail/{id}" fill />` needs zero `next.config.ts` changes. `[CITED:
  nextjs.org/docs/app/api-reference/components/image]`
- **`minimumCacheTTL` default in this Next.js release is `14400` seconds (4 hours)**, confirmed directly from
  the docs' own code sample (not inferred from a changelog entry): `minimumCacheTTL: 14400, // 4 hours`.
  `[CITED: nextjs.org/docs/app/api-reference/components/image]`
- **The interaction that matters for D-06:** *"The expiration (or rather Max Age) of the optimized image is
  defined by either the `minimumCacheTTL` or the upstream image `Cache-Control` header, whichever is
  larger."* `[CITED: nextjs.org/docs/app/api-reference/components/image]` — this is a genuine finding for the
  planner, not just a confirmation of `PITFALLS.md` Pitfall 14: whatever `s-maxage` the new route sets, the
  optimizer will hold the **resized/reformatted variant** for **at least** 4 hours regardless (unless the
  route's own header is set even longer). This is not a problem for freshness — the proxy always resolves the
  *current* presign at request time, so a 4-hour-stale optimizer cache only means the visible bytes could be up
  to 4h behind Notion's actual file content, which changes rarely — but it does mean the underlying proxy
  Function will, in practice, run even less often per unique image size than D-06's own `s-maxage` alone would
  suggest, since the optimizer's floor dominates whenever the route's own `s-maxage` is set shorter than 4h.
- **A second, unprompted finding relevant to the already-locked D-05 (stream, not redirect):** *"The default
  image optimization loader will follow HTTP redirects when fetching remote images up to 3 times... For your
  convenience, these redirects do not need to satisfy `remotePatterns`."* `[CITED:
  nextjs.org/docs/app/api-reference/components/image]` — this is new, official-docs evidence bearing directly
  on D-05's own stated justification ("streaming... unless redirect is explicitly verified against this
  deployment"). It suggests the optimizer likely *would* follow a same-origin-route → S3 307 redirect without
  needing the S3 host in `remotePatterns` at all. **This does not reopen D-05** (streaming is locked, costly to
  reverse per D-05's own reversibility note, and this finding doesn't retroactively make streaming wrong) — it
  is recorded here only because a future revisit of the deferred "switch to redirect" idea would start from
  this fact instead of an unverified assumption. Filed under Open Questions, not acted on.
- `Good to know: For security reasons, the Image Optimization API using the default loader will not forward
  headers when fetching the src image.` `[CITED: nextjs.org/docs/app/api-reference/components/image]` — not
  a blocker here (the new route needs no request headers from the visitor's browser to resolve a thumbnail),
  but worth the planner knowing if a future auth-gated asset is ever considered.

## Which Resolution-Path Shape Is Actually Correct (Item 3)

`ARCHITECTURE.md` §1 offers two shapes: **(a)** a second `NologClient` instance constructed with
`fetchOptions: { cache: "no-store" }`, or **(b)** "a small dedicated uncached export to `notion.ts` following
the exact precedent already set by `getUnemailedPublicPosts()`/`markEmailed()` (both deliberately un-`cache()`-
wrapped)."

**Finding 2 (HIGH confidence, verified by reading the actual client code): only shape (a) is correct. Shape (b)
does not do what its own precedent's comment claims, and following it here would reproduce the exact bug this
phase exists to fix.**

`apps/web/src/lib/notion.ts:39-48` reads:

```ts
// Deliberately not memoised (no `cache` wrapper) — the notify cron must
// observe fresh state on every invocation, never a memoised read from an
// earlier request in the same render pass...
export async function getUnemailedPublicPosts(): Promise<Post[]> {
  return nologClient.getUnemailedPublicPosts();
}
```

`[VERIFIED: apps/web/src/lib/notion.ts:35-48]` — quoted verbatim. This comment is correct about what it
claims (React's `cache()` per-render memoisation) and silent about what it doesn't: `nologClient` here is the
**same module-level singleton** constructed at `notion.ts:8-17` with `fetchOptions: { next: { revalidate:
CONFIG.revalidate, tags: [NOTION_CACHE_TAG] } }`. Every method on that instance — `getPosts`, `getPost`,
`getCategories`, `getUnemailedPublicPosts`, `markEmailed` — spreads `...this.fetchOptions` into its own raw
`fetch()` call inside `packages/core/src/client.ts` (verified at `queryDatabase()` line 226, `getPost()` line
315, `patchPage()` line 369). Removing the `cache()` wrapper only removes React's **per-render** dedup; it does
**not** remove the `next: { revalidate: 180 }` option that the shared instance bakes into every request it
makes, cache-wrapped or not. **A new export built the same way — `export async function
getFreshThumbnailUrl(id) { return nologClient.getPost(id); }` — would still be subject to Next's Data Cache**,
which is precisely the mechanism Finding "Resolving the IMG-02 Contradiction" above says is the actual, live
source of staleness for a post page. Following `ARCHITECTURE.md`'s option (b) literally would ship a fix that
does not fix the bug.

**The only correct approach is (a):** instantiate a **second, separate `NologClient`**, e.g.

```ts
const freshNologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: DATABASE_ID,
  fetchOptions: { cache: "no-store" },
});
```

Confirmed viable against the real constructor: `NologClientOptions.fetchOptions?: RequestInit`
(`packages/core/src/client.ts:178-185`), and the constructor stores it as `this.fetchOptions`, later spread
into every raw `fetch()` call the instance makes. `[VERIFIED: packages/core/src/client.ts:178-204,
311-338]` — passing `{ cache: "no-store" }` here overrides per-request caching entirely for calls made through
this specific instance, without touching the original `nologClient` singleton the rest of the app depends on.

**A secondary, free benefit of using this second client's own `.getPost(id)` method (rather than a hand-rolled
fetch inside the route):** `getPost()` already re-applies the `status !== "public"` filter and returns `null`
for a non-public post — `[VERIFIED: packages/core/src/client.ts:328-334]`, quoted: `if (post.status !==
"public") { return null; }`. Reusing it means the thumbnail route automatically inherits "don't serve an
image for an unpublished post" with zero extra code, and it reuses `mapPageToPost()`'s existing property
extraction (including `getFileUrl`/`getFileType`) instead of duplicating it — directly avoiding the class of
mistake `STATE.md`'s CR-01 correction already paid for once (duplicated property-extraction logic drifting
from the real schema).

## Concrete Security Guard Shapes (Item 4)

### `parsePageId` behaviour (already used in this repo)

`apps/web/src/lib/post-availability.ts:1,73` already imports and calls `parsePageId` from `notion-utils` for
the identical purpose (validate a route's id param before building an outbound Notion URL). Its type signature,
read directly from the installed package:

```ts
declare const parsePageId: (id?: string | undefined | null, { uuid }?: {
    uuid?: boolean;
}) => string | undefined;
```

`[VERIFIED: node_modules/notion-utils/build/index.d.ts:187-189]` — quoted verbatim. Its implementation (also
read directly):

```js
var parsePageId = (id = "", { uuid = true } = {}) => {
  if (!id) return;
  id = id.split("?")[0];
  if (!id) return;
  const match = id.match(pageIdRe);
  if (match) {
    return uuid ? idToUuid(match[1]) : match[1];
  }
  const match2 = id.match(pageId2Re);
  if (match2) {
    return uuid ? match2[1] : match2[1].replaceAll("-", "");
  }
  return;
};
```

with `pageIdRe = /\b([\da-f]{32})\b/` and `pageId2Re = /\b([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\b/`.
`[VERIFIED: node_modules/notion-utils/build/index.js:333-348]` — quoted verbatim. With default options
(`uuid: true`, matching `post-availability.ts`'s call site, which passes no options), it returns a
**dashed-UUID string** or `undefined`.

**Note for the planner:** both regexes are **word-boundary matched, not anchored** — a 32-hex or dashed-UUID
substring embedded anywhere in a longer garbage string still matches. This is not a security gap **as long as
only the returned `parsedId` — never the raw route param — is used to build the outbound URL and to key the
resolution lookup**, exactly the pattern `post-availability.ts:73` already establishes and its own comment
states: *"This also keeps caller-controlled input out of the outbound URL below... the URL is built from
`parsedId`, never from the raw `pageId` parameter."* `[VERIFIED: apps/web/src/lib/post-availability.ts:69-76]`.
The new route must follow the identical discipline.

### Hostname allowlist

`next.config.ts`'s `images.remotePatterns` — the single source of truth IMG-03 must mirror — reads, in full:

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
    ],
  },
};
```

`[VERIFIED: apps/web/next.config.ts:1-18]` — quoted verbatim; the two exact hostnames are
`s3.us-west-2.amazonaws.com` and `prod-files-secure.s3.us-west-2.amazonaws.com`.

Two implementation shapes, left to the planner (not one of D-01…D-13's fixed points, but worth naming):
1. **Duplicate the two literals** as a small array inside the route file — simplest, zero import risk, but a
   second place that can drift from `next.config.ts` if a forker ever adds a third Notion region host.
2. **Import `nextConfig` from `../../../../next.config` (or via a relative path to the project root) and read
   `.images?.remotePatterns`** at the route — single source of truth, matches IMG-03's literal wording ("the
   allowlist already declared in `next.config.ts`") most precisely. `next.config.ts` is a plain object export
   with no side effects and no Next-internal imports beyond the `NextConfig` type, so importing it elsewhere is
   not itself unsafe — but there is **no existing precedent in this repo** for importing `next.config.ts` from
   application code, so this is `[ASSUMED]` to work cleanly rather than confirmed; the planner should treat it
   as an implementation detail to sanity-check with `next build`/`tsc`, not as a locked pattern.

Either way, compare `new URL(resolvedThumbnailUrl).hostname` against the allowlist and reject (non-200) on
no match — this is the IMG-03 guard, matching `PITFALLS.md` Pitfall 1's stated control exactly.

### `redirect: "error"` on the outbound `fetch()`

`[CITED: MDN — RequestInit.redirect]`: setting `redirect: "error"` on a `fetch()` call means *"Reject the
promise with a network error when a redirect status is returned."* If the resolved presigned URL's host
answers with a 3xx (a compromised/tampered response from an otherwise-allowlisted host, or S3 behaving
unexpectedly), the `fetch()` call throws instead of silently following it — the route's own try/catch turns
that into a non-200 response, closing the SSRF-adjacent redirect-bypass vector `PITFALLS.md` Pitfall 1 names.
This is standard, spec-defined Fetch API behaviour, present in Node's built-in `fetch` (undici-backed) with no
version caveat for Node 22 (installed, confirmed via `node --version`).

### Content-type assertion

`res.headers.get("content-type")?.startsWith("image/")` — checkable from the `Response` object's headers
immediately upon the `fetch()` promise resolving, **before** any part of the body is read or streamed, so this
guard costs nothing against the streaming design (D-05). Reject non-`image/*` with a non-200, matching
`PITFALLS.md` Pitfall 1 and IMG-03's literal wording.

### Streaming without buffering

Confirmed pattern, Next.js 16.3.0 official docs (`nextjs.org/docs/app/api-reference/file-conventions/route`,
`lastUpdated: 2026-04-30`, fetched this session): a Route Handler can return `new Response(stream, {...})`
where `stream` is a `ReadableStream`, and the docs' own streaming example builds one from scratch via
`iteratorToStream`. For a pure pass-through of an already-fetched upstream `Response`, the simpler and more
direct pattern — not shown in the docs example because that example is generating content, not proxying it —
is to pass the upstream `Response`'s own `.body` (already a `ReadableStream`) straight into the constructor:

```ts
const upstream = await fetch(resolvedUrl, { redirect: "error" });
// ... guard checks on upstream.status / upstream.headers here, before returning ...
return new Response(upstream.body, {
  status: 200,
  headers: {
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "public, s-maxage=<TBD>, immutable",
  },
});
```

This never buffers the full image into memory (unlike `await upstream.arrayBuffer()` then constructing a new
`Response` from that buffer, which would). `[CITED: nextjs.org/docs/app/api-reference/file-conventions/route
— Streaming section, general `Response`/`ReadableStream` mechanics confirmed against the documented example]`.
The exact `s-maxage` value is explicitly Claude's Discretion (09-CONTEXT.md) — not filled in here.

## Findings Not Asked For Directly, But Load-Bearing

### Finding 1 — `apps/web/src/types/index.ts`'s `Post` interface does not have `thumbnailType`

**HIGH confidence, verified by reading both files this session.** `packages/core/src/types.ts:16-28`'s `Post`
interface has:

```ts
thumbnail: string | null;
thumbnailType: "file" | "external" | null;
```

`[VERIFIED: packages/core/src/types.ts:16-28]` — quoted verbatim (the `thumbnailType` line is the load-bearing
one). But every one of the four call sites this phase touches imports `Post` from the **local, duplicate**
`apps/web/src/types/index.ts`, not from `@4lph4/nolog-core`:

```
apps/web/src/templates/default/HomePage.tsx:1:import type { Post } from "@/types";
apps/web/src/templates/default/SearchPage.tsx:1:import type { Post } from "@/types";
apps/web/src/templates/default/CategoryPage.tsx:1:import type { Post } from "@/types";
apps/web/src/templates/default/PostPage.tsx:1:import type { Post } from "@/types";
apps/web/src/app/post/[id]/page.tsx:7:import type { Post } from "@/types";
```

`[VERIFIED: grep across apps/web/src, cross-checked against Read of each import line]`. And
`apps/web/src/types/index.ts`'s own `Post` interface (read in full this session) has **11 fields ending in
`emailed: boolean`, with no `thumbnailType` field anywhere in it** — `[VERIFIED: apps/web/src/types/index.ts:
1-51]`, the full file quoted in this research's tool transcript; the field is genuinely absent, not renamed.

This is not currently a compile error (assigning a `packages/core` `Post`, which has *more* fields, to a
variable typed against the narrower local `Post` interface is allowed by TypeScript's structural typing), which
is exactly why it has never surfaced before now — nothing in `apps/web` has ever tried to *read*
`post.thumbnailType`. IMG-05's whole mechanism, and D-02's shared component, require reading it. **The first
time D-02's component (or any of the four call sites) writes `post.thumbnailType === "external"`, `tsc` will
error with "Property 'thumbnailType' does not exist on type 'Post'."**

**Fix, in-scope and minimal:** add the one field to `apps/web/src/types/index.ts`'s local `Post` interface,
mirroring `packages/core`'s field exactly (`thumbnailType: "file" | "external" | null;`). This is an apps/web-
only change and does **not** touch `packages/core` — fully compliant with D-05/REQUIREMENTS.md D-05 ("the
thumbnail fix must NOT change the `Post` type in `packages/core`" — that constraint is about the *published*
package; this is the separate, already-known-duplicate local mirror the codebase's own CLAUDE.md documents
under "Duplicate Post Type Definition"). The alternative — switching all five import sites to
`@4lph4/nolog-core`'s `Post` instead of `@/types`'s — is a larger, unnecessary diff for this phase; not
recommended.

### Finding 2

Covered above under "Which Resolution-Path Shape Is Actually Correct."

### Finding 3 — `NOLOG_USER_AGENT` was exported specifically anticipating this phase

`apps/web/src/lib/notion-x.ts:14-19` reads:

```ts
// D-05: hardcoded, not forker-configurable — no env var, no site.config.ts
// field. D-19's whole premise is that a forker ends up with zero net new
// env vars; an honest self-identifying UA is the fix itself (D-01/D-03),
// not a per-deployment knob. Exported (unlike DIAGNOSTICS_GATE_VALUE below)
// because Phase 9's thumbnail-proxy work reuses it (D-06).
export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)";
```

`[VERIFIED: apps/web/src/lib/notion-x.ts:14-19]` — quoted verbatim, including the literal string value.
Phase 7/8's root cause (`STATE.md`, Phase 7 Plan 03 entry) was Cloudflare answering `notion-client`'s
default `user-agent: node` with a 403 in front of the **unofficial** `www.notion.so` endpoint — that finding
does not, by itself, establish that Notion's **official** REST API (`api.notion.com`, used by `getPost()`) or
S3 (used to fetch the actual image bytes) have the same block in place; no evidence in this repo suggests they
do. But the comment above is explicit that this exact constant was exported *for* Phase 9's reuse, and it costs
nothing to set `"User-Agent": NOLOG_USER_AGENT` on the route's own outbound `fetch()` call(s) defensively —
recommended as a small, cheap hedge, not because a failure was observed.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Page-id validation from a route param | A hand-written UUID/32-hex regex | `parsePageId` from `notion-utils` (already installed, already used identically in `post-availability.ts`) | Avoids drift from what this repo already trusts for the same job; one behaviour to reason about, not two. |
| Redirect-following control | Manual `Location` header inspection/looping | `fetch(url, { redirect: "error" })` | Standard Fetch API behaviour (MDN, confirmed this session); a hand-rolled check is more code for an identical guarantee. |
| Streaming the proxied bytes | A manual `ReadableStream` reader/writer loop | `new Response(upstream.body, {...})` passthrough | Documented Next.js pattern; hand-rolling risks accidentally buffering (e.g. via `.text()`/`.arrayBuffer()` first) and defeats the point of streaming. |
| A fresh, uncached Notion page lookup | A raw `fetch()` + manual `mapPageToPost()`-equivalent re-implementation inside the route | A second `NologClient` instance's own `.getPost(id)` (Finding 2) | Reuses the already-correct `status`-filtering and file-property extraction from `packages/core`; duplicating it is the exact mistake class `STATE.md`'s CR-01 correction already cost a round trip on. |
| Hostname allowlist | A second, hand-maintained literal that can drift from `next.config.ts` | Either the duplicated-but-identical literal, or (preferred, unverified-as-precedent) importing `next.config.ts`'s own `remotePatterns` | See "Hostname allowlist" above — either is acceptable, but don't invent a third shape. |

**Key insight:** every "don't hand-roll" item above already has a working precedent *somewhere in this exact
repo* — this phase's job is to reuse them, not invent parallel versions.

## Common Pitfalls

Inherited from `PITFALLS.md` and still binding — cited, not restated in full (see canonical doc for complete
text):

- **Pitfall 1** — open SSRF/hotlinking proxy. Addressed by the four guards above (id-only input, hostname
  allowlist, `redirect: "error"`, content-type check).
- **Pitfall 2** — `unoptimized` is not the fix. Ruled out at requirements time (`REQUIREMENTS.md` Out of
  Scope); nothing in this research changes that.
- **Pitfall 3** — shortening `revalidate` is not the fix. Same status.
- **Pitfall 4** — a per-request live call that silently makes a page dynamic. Not applicable to the proxy
  itself (it is its own new route, not a change to `/` or `/post/[id]`'s own render), but directly relevant to
  Finding 2: constructing the second `NologClient` must happen **inside the route handler**, not by adding an
  uncached fetch to `post/[id]/page.tsx`'s or `HomePage.tsx`'s own render path — that would be exactly this
  pitfall, applied to the wrong file.
- **Pitfall 12** — `next dev` proves nothing for this bug class (no ISR, no idle window). D-12 already commits
  to deployed-site-only verification.
- **Pitfall 13** — testing immediately after deploy never reaches the failure window. D-11/D-12's idle-gap
  procedure already accounts for this.
- **Pitfall 14** — check the raw origin URL, not `/_next/image?...` — reinforced by this research's Finding
  on `minimumCacheTTL` above: the optimizer's own cache can mask a true result for up to 4 hours (or longer, if
  the route's own `s-maxage` exceeds it), independent of whether the underlying presign is fresh.

**Two new pitfalls specific to this phase, found this session, not in `PITFALLS.md`:**

### Pitfall N1: Following `ARCHITECTURE.md`'s "precedent" (option b) literally reproduces the bug

**What goes wrong:** Adding an unwrapped export to `notion.ts` that calls a method on the existing
`nologClient` singleton — "just like `getUnemailedPublicPosts()`" — looks like it produces a fresh, uncached
read, because the code comment next to that precedent says "deliberately not memoised." It does not: the
singleton's constructor-baked `next: { revalidate: 180 }` fetchOptions are still spread into every call that
instance makes, memoised or not. **How to avoid:** always construct a *second* `NologClient` instance with
`fetchOptions: { cache: "no-store" }` for anything that must bypass Next's Data Cache, per Finding 2 above.
**Warning sign:** a diff that adds a new export to `notion.ts` calling `nologClient.<method>()` (the *existing*
singleton) without also constructing a new client instance.

### Pitfall N2: Branching on `post.thumbnailType` fails to compile until the local type is fixed

**What goes wrong:** D-02's shared component and any of the four call sites will hit "Property 'thumbnailType'
does not exist on type 'Post'" the moment they try to read it, because the `Post` type they actually import
(`@/types`, not `@4lph4/nolog-core`) doesn't declare the field (Finding 1). **How to avoid:** add the field to
`apps/web/src/types/index.ts` as the very first code change in this phase, before writing anything that reads
it. **Warning sign:** a `tsc`/`next build` failure citing `thumbnailType` on a file under `templates/default/`.

## Code Examples

Illustrative skeletons only — not literal, complete implementations. Every constant/value shown is verified
per the citations above; anything marked TBD is intentionally left to the planner (Claude's Discretion per
`09-CONTEXT.md`).

### Route skeleton (`apps/web/src/app/api/thumbnail/[id]/route.ts` — exact path is Claude's Discretion)

```ts
import { parsePageId } from "notion-utils";
import { NologClient } from "@4lph4/nolog-core";
import { NOLOG_USER_AGENT } from "@/lib/notion-x"; // Finding 3 — defensive reuse

export const runtime = "nodejs";

// Second, separate instance — Finding 2. Never reuse apps/web/src/lib/notion.ts's
// `nologClient` singleton, wrapped or unwrapped: its constructor-baked
// `next: { revalidate: 180 }` survives removal of React's cache() wrapper.
const freshNologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: process.env.NOTION_DATABASE_ID ?? "",
  fetchOptions: { cache: "no-store" },
});

// Mirrors next.config.ts's images.remotePatterns exactly (apps/web/next.config.ts:5-14).
const ALLOWED_HOSTS = new Set([
  "s3.us-west-2.amazonaws.com",
  "prod-files-secure.s3.us-west-2.amazonaws.com",
]);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsedId = parsePageId(id); // undefined for anything not a real page id
  if (!parsedId) {
    return new Response(null, { status: 400 });
  }

  const post = await freshNologClient.getPost(parsedId); // null for missing/non-public
  if (!post || post.thumbnailType !== "file" || !post.thumbnail) {
    return new Response(null, { status: 404 });
  }

  let hostname: string;
  try {
    hostname = new URL(post.thumbnail).hostname;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(hostname)) {
    return new Response(null, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(post.thumbnail, {
      redirect: "error", // Pitfall 1 — reject a 3xx from an otherwise-allowlisted host
      headers: { "User-Agent": NOLOG_USER_AGENT },
    });
  } catch {
    return new Response(null, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    return new Response(null, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      // s-maxage value and stale-while-revalidate presence: Claude's Discretion (09-CONTEXT.md).
      "cache-control": "public, s-maxage=<TBD>, immutable",
    },
  });
}
```

### `Post` type fix (`apps/web/src/types/index.ts` — Finding 1, do this first)

```ts
export interface Post {
  // ...existing 11 fields, unchanged...
  thumbnailType: "file" | "external" | null; // mirrors packages/core/src/types.ts:28
}
```

## Runtime State Inventory

Not applicable — this is not a rename/refactor/migration phase. Skipped per instructions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js runtime (route handler) | The new proxy route | ✓ | Node 22.23.1 installed locally; Vercel Production confirmed Node-runtime-compatible (existing `notify-subscribers`/`subscribe` routes already run `runtime = "nodejs"`) | — |
| `notion-utils` | `parsePageId` | ✓ | `^7.10.0` in `package.json`, confirmed present in `node_modules` | — |
| `lucide-react` | `ImageOff` icon | ✓ | `^1.14.0` in `package.json`, `1.31.0` resolved (confirmed via `npm view`) | — |
| Vercel Function `maxDuration` | The proxy's outbound fetches | ✓ | 300s, Fluid Compute enabled — already confirmed against the real dashboard in Phase 5 (`05-01-VERIFICATION.md` row P2, cited in `STATE.md`) | Not a concern at this route's scale — a single Notion GET + a single S3 GET, streamed, well under any duration ceiling. |
| Two Notion S3 hosts reachable from Vercel's network | The proxy's outbound image fetch | ✓ (implied — the existing `<Image>` optimizer already fetches from these same hosts today) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — everything needed is already installed and already reachable
from the current deployment.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` (absent-defaults-to-enabled would also
apply) — section required. No test framework exists and none may be added (`REQUIREMENTS.md` Out of Scope).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — source assertions, `next build` (which runs `tsc`), ESLint, and deployed-site observation only |
| Config file | `apps/web/eslint.config.mjs` (lint), `apps/web/tsconfig.json` (typecheck via `next build`) |
| Quick run command | `npm run lint --prefix apps/web` |
| Full suite command | `npm run build --prefix apps/web` (fails on any type error, including the Finding 1 gap if unaddressed) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Command / Procedure | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMG-01 | Home feed thumbnails visible after idle gap | manual, deployed-only | D-11/D-12/D-13 idle-gap procedure (`PITFALLS.md` 13/14): wait > Notion's ~1h presign TTL with the site untouched, cold-cache load, read the raw origin URL from page source | N/A — no automated test possible (Pitfall 12) |
| IMG-02 | Post hero thumbnail visible after the same idle gap | manual, deployed-only | Same single idle window as IMG-01 (D-11: one window covers both) | N/A |
| IMG-03a | Non-page-identifier input rejected | automated-ish (curl) | `curl -i https://<deployed>/api/thumbnail/not-a-real-id` — expect non-200, no idle gap needed | Route doesn't exist yet — this phase creates it |
| IMG-03b | Resolved host outside allowlist rejected | source inspection + optional curl | Confirm `ALLOWED_HOSTS`-equivalent check exists and covers exactly the two `next.config.ts` hosts; live-testing this branch needs a Notion page whose thumbnail property somehow resolves off-allowlist, which isn't constructible without tampering — source review is the practical ceiling here | — |
| IMG-03c | Redirect from origin rejected | source inspection | Confirm `redirect: "error"` is present on the outbound `fetch()` — a live redirecting S3 asset isn't something this project can construct on demand | — |
| IMG-03d | Non-`image/*` content-type rejected | source inspection + optional live check | Confirm the content-type guard exists; can optionally be curl-tested against a real non-image Notion file if one exists in the workspace | — |
| IMG-04 | Placeholder shown on genuine failure | manual, deployed or local | Force a failure path (e.g. temporarily point the route at a non-existent id, or observe a real 404/502 from the route) and confirm the `ImageOff` placeholder renders via `onError` — no idle gap required, reproducible on demand | — |
| IMG-05 | External thumbnail bypasses the new path entirely | source inspection + live check | Confirm the component's branch never constructs a `/api/thumbnail/...` src when `thumbnailType === "external"`; verify against a real post carrying an external thumbnail (no idle gap needed — external URLs don't expire) | — |

### Sampling Rate

- **Per task/plan commit:** `npm run lint --prefix apps/web` (fast, catches the Finding 1/N2 class of error
  immediately).
- **Per wave merge:** `npm run build --prefix apps/web` (full typecheck + production build).
- **Phase gate:** the deployed-site idle-gap procedure (D-11/D-12/D-13), run exactly once, after the fix is
  live — this is the only check that can validate IMG-01/IMG-02's actual claim.

### Wave 0 Gaps

None — no test framework is being introduced this phase (consistent with the standing Out-of-Scope item), and
the existing `next build`/ESLint tooling already covers everything short of live-deployment behaviour.

## Security Domain

`security_enforcement` is `true`, `security_asvs_level: 1` in `.planning/config.json` — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | The route serves already-public thumbnails for already-public posts; no new auth surface, matching the existing site-wide "no reader authentication" model. |
| V3 Session Management | No | Stateless GET, no session involved. |
| V4 Access Control | Partial | The route must independently re-apply "post is public" filtering (inherited free via `getPost()`'s existing `status !== "public"` check, Finding 2) — a post that later becomes non-public must not keep serving its thumbnail through this route. |
| V5 Input Validation | Yes | `parsePageId()` on the route param (rejects anything that isn't a real Notion page id); hostname allowlist compare; content-type assertion. |
| V6 Cryptography | No | No cryptographic operations in this route. |
| SSRF (OWASP ASVS' server-side request forgery category — exact clause number not verified this session, cited by name) | Yes | Accept only an id, never a caller-supplied URL (D-07); hostname allowlist; `redirect: "error"`. `[CITED: OWASP ASVS SSRF category, name only — not independently verified against a specific ASVS 4.x/5.x clause this session]` |

### Known Threat Patterns for This Route

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via a caller-controlled URL parameter | Tampering / Information Disclosure | Route accepts only a Notion page id; the URL is resolved server-side from trusted data, never taken from the request (D-07, `PITFALLS.md` Pitfall 1). |
| Open/anonymous proxy abuse (egress-cost DoS) | Denial of Service | Same id-only-input constraint means the route cannot be used to fetch arbitrary attacker-chosen URLs at all; the hostname allowlist is a second, independent layer even if the id-resolution step were ever compromised. |
| Redirect-based allowlist bypass | Tampering | `redirect: "error"` on the outbound fetch (verified MDN behaviour, this doc). |
| Content-type confusion (e.g., an allowlisted host somehow serving HTML/script) | Tampering | Content-type must start with `image/` before the body is streamed back. |
| Unbounded Function invocation / egress cost | Denial of Service | D-06's long `s-maxage` + `immutable` puts the CDN, not the Function, in the repeat-request path — the Function runs roughly once per unique image size per cache period, not once per visitor. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Importing `next.config.ts`'s `remotePatterns` array into the new route handler works cleanly with no circular-import or build-time issue | Concrete Security Guard Shapes — Hostname allowlist | Low — the fallback (duplicating the two literal hostnames) is already verified-safe and trivial to use instead; worst case is a slightly less DRY route, not a broken one. |
| A2 | Notion's official REST API (`api.notion.com`) and the two S3 hosts do not block Node's default `User-Agent` the way Cloudflare blocked it in front of `notion-client`'s unofficial endpoint | Finding 3 | Low — if wrong, the route would fail closed (non-200/502), which is the safe direction; setting `NOLOG_USER_AGENT` defensively (recommended) removes the risk entirely regardless of whether the underlying assumption is true. |
| A3 | The Data Cache staleness mechanism described for IMG-02 (stale-while-revalidate persisting past 180s during an idle gap) is the actual live cause, rather than some other, unconsidered mechanism | Resolving the IMG-02 Contradiction | Medium — if wrong, IMG-02's success criterion still holds (the fix bypasses the Data Cache regardless of whether it's the true cause), but the *diagnosis* recorded for future debuggers would be inaccurate. The discriminating test (latency-timing log during the idle-gap window) is named as the way to close this if it ever matters. |

## Open Questions

1. **Whether Vercel's image optimizer would actually follow a same-origin-route → S3 307 redirect (relevant
   only if the deferred "switch to redirect" idea is ever revisited).**
   - What we know: Next 16.3.0's own docs confirm the optimizer follows up to 3 redirects and that such
     redirects "do not need to satisfy `remotePatterns`" `[CITED: nextjs.org/docs/app/api-reference/components/image]`.
   - What's unclear: whether this applies identically when the *first* hop is a same-origin internal path
     (`/api/thumbnail/...`) rather than an already-external URL, and whether Vercel's specific deployment
     configuration (Fluid Compute, etc.) changes this.
   - Recommendation: not needed for this phase (D-05 already locks streaming); record for whoever revisits the
     deferred idea.

2. **Whether the Data Cache is genuinely the mechanism behind IMG-02, or whether some other factor is
   involved.**
   - What we know: documented Next.js caching semantics support this conclusion (Resolving the IMG-02
     Contradiction, above); Phase 8's evidence doesn't rule it out (it measured a different fetch entirely).
   - What's unclear: no direct timing measurement was taken this session.
   - Recommendation: not blocking — the planned fix bypasses this mechanism regardless of whether it's exactly
     right. If IMG-02 ever needs re-diagnosis, add a temporary latency log around `getPost()`'s internal fetch.

3. **Exact `s-maxage` value and whether to pair it with `stale-while-revalidate`.**
   - Explicitly Claude's Discretion per `09-CONTEXT.md` — not a research gap, just flagging that this document
     deliberately leaves it as `<TBD>` in the Code Examples skeleton.

## Sources

### Primary (HIGH confidence)
- Direct `Read` of every file cited inline above: `apps/web/src/app/post/[id]/page.tsx`,
  `apps/web/src/lib/notion.ts`, `packages/core/src/client.ts`, `packages/core/src/types.ts`,
  `apps/web/next.config.ts`, `apps/web/src/lib/post-availability.ts`, `apps/web/src/lib/notion-x.ts`,
  `apps/web/src/types/index.ts`, all four `templates/default/*.tsx` call sites,
  `apps/web/src/app/api/notify-subscribers/route.ts`, `apps/web/src/app/api/subscribe/route.ts`,
  `apps/web/src/components/ThemeToggle.tsx`, `apps/web/src/components/PostUnavailable.tsx`,
  `apps/web/src/site.config.ts`, `apps/web/package.json`.
- Direct read of installed package internals: `node_modules/notion-utils/build/index.d.ts` and `index.js`
  (`parsePageId` signature and regex source), `node_modules/lucide-react/dist/esm/icons/index.mjs`
  (`ImageOff` export confirmed).
- `nextjs.org/docs/app/api-reference/components/image` — fetched verbatim this session, version `16.3.0`,
  `lastUpdated: 2026-05-04`.
- `nextjs.org/docs/app/api-reference/file-conventions/route` — fetched verbatim this session, version
  `16.3.0`, `lastUpdated: 2026-04-30`.
- `nextjs.org/docs/app/guides/caching-without-cache-components` — fetched verbatim this session, version
  `16.3.0`, `lastUpdated: 2026-06-23`.
- MDN `RequestInit.redirect` — `"error"` behaviour confirmed via targeted fetch this session.

### Secondary (MEDIUM confidence)
- "generateStaticParams absence → fully dynamic rendering" — sourced from a web-search summary of Next.js App
  Router docs, not a verbatim fetch of the specific canonical page; cross-checked against Phase 8's own direct
  measurement (`08-CACHE-EVIDENCE.md`), which independently confirms the *symptom* (no Full Route Cache
  participation) even though this research didn't fetch the exact doc page stating the *cause* verbatim.
- The Data Cache staleness mechanism for IMG-02 — documented Next.js behaviour applied by inference to this
  specific route; not directly measured this session (see Open Question 2 / Assumption A3).

### Tertiary (LOW confidence)
- OWASP ASVS SSRF category naming (Security Domain table) — cited by name only, exact clause number not
  independently verified against a specific ASVS version this session.

## Metadata

**Confidence breakdown:**
- Codebase facts (client.ts, notion.ts, types.ts, next.config.ts, post-availability.ts, notion-x.ts, the four
  templates): HIGH — every claim cites a `Read` this session with a quoted excerpt.
- `next/image`/optimizer interaction, streaming pattern, `redirect: "error"`: HIGH — official Next.js 16.3.0
  docs and MDN, fetched verbatim this session.
- IMG-02's Data Cache mechanism: MEDIUM — documented Next.js caching architecture, correctly applied by
  inference to this route's specific fetch calls, but not independently timed/measured against the live
  deployment this session.
- Security ASVS categorization: LOW-MEDIUM — the controls themselves (input validation, SSRF mitigation) are
  well-established and directly derived from `PITFALLS.md` Pitfall 1 plus this session's own analysis; the
  exact ASVS clause numbering is not independently verified.

**Research date:** 2026-08-11
**Valid until:** Next.js/Vercel platform behaviour is fast-moving relative to this repo's own code — treat the
Next.js-docs-sourced claims (minimumCacheTTL default, redirect-following, Data Cache semantics) as valid for
~30 days or until the installed Next.js version changes, whichever comes first. The codebase-fact claims remain
valid until the cited files change.
