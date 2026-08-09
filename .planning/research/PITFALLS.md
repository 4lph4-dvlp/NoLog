# Pitfalls Research

**Domain:** Bug-fixing an existing, deployed Next.js 16 App Router + React 19 blog on Vercel, backed by Notion — ISR caching, an unofficial Notion API dependency, and a Server/Client Component boundary that gates a secret
**Researched:** 2026-08-09
**Confidence:** MEDIUM overall (codebase facts below are HIGH — read directly from this repo; ecosystem/behavior claims are tagged individually since most rest on single- or cross-checked web sources, not official docs verified live against this exact Vercel project)

This file assumes the milestone's three fixes (presigned image URLs, "Content could not be loaded", collapsible sidebars) as scoped in `.planning/PROJECT.md`, and is written against the current code in `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/lib/notion.ts`, `apps/web/src/lib/notion-x.ts`, `apps/web/next.config.ts`, `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/site.config.ts`, and `packages/core/src/client.ts`.

---

## Critical Pitfalls

### Pitfall 1: Image-proxy route becomes an open SSRF/hotlinking proxy

**What goes wrong:**
A route handler like `/api/image-proxy?url=<notion-s3-url>` that accepts an arbitrary `url` query param and `fetch()`s it server-side will, unless deliberately locked down, let anyone request ANY URL through your server's egress — a classic Server-Side Request Forgery surface (internal network probing, abuse as an anonymous relay, cloud metadata endpoint access on some hosts) and an unbounded-cost open proxy (every request burns a Vercel Function invocation + egress bytes regardless of whether the URL is a Notion asset at all).

**Why it happens:**
The naive fix for "the `<Image>` src expired" is "just proxy it through my own server," and the fastest way to write that is to forward whatever URL the caller supplies.

**How to avoid:**
- Never accept a caller-supplied arbitrary URL parameter. Accept a Notion **page/block/property identifier** instead, and resolve the actual file URL server-side by re-reading it from the same cached `getPost`/`getPosts` data path already used for rendering (or querying Notion by the id you trust).
- If a URL must be accepted at all (e.g., you pass through the presigned URL already embedded in a `Post`), validate its hostname against an explicit allowlist matching `next.config.ts`'s existing `remotePatterns` exactly (`s3.us-west-2.amazonaws.com`, `prod-files-secure.s3.us-west-2.amazonaws.com`) — reject everything else with 400, not a silent pass-through.
- Set `redirect: "error"` on the server-side `fetch()` so a 3xx response from an allowlisted host can't redirect you off-allowlist (a documented SSRF bypass vector).
- Verify response `content-type` starts with `image/` before streaming it back; reject non-image content types even from allowlisted hosts.
- Never let this route double as a general reverse proxy for other API needs "since it's already there" — scope creep here is how allowlists rot.

**Warning signs:**
A route reads `req.nextUrl.searchParams.get("url")` (or similar) and calls `fetch()` on it with no hostname check; response is streamed back with no content-type assertion; the route has no rate limiting and egress cost is unbounded per unique URL requested.

**Phase to address:** Image fix phase (if a proxy route is the chosen approach — see Pitfall 3/4 for why it may not be the best option here).

---

### Pitfall 2: `unoptimized` "fixes" the crash but reintroduces the pre-`next/image` cost profile

**What goes wrong:**
Setting `unoptimized` on the thumbnail `<Image>` (in `HomePage.tsx`) sidesteps the optimizer's own upstream-fetch/caching layer, so it stops erroring on a since-changed URL — but it also means Next.js no longer resizes, reformats (AVIF/WebP), or serves device-appropriate variants. Every visitor, including mobile, downloads Notion's original full-resolution image at whatever size it was uploaded.

**Why it happens:**
It removes the symptom (an optimizer error/blank image) with a one-line prop change, which looks like a clean fix in a quick diff.

**How to avoid:** Don't reach for `unoptimized` as the actual fix. If it's used at all, scope it narrowly and temporarily (e.g., only as a fallback inside a proxy/re-signing path that itself already controls final byte size), not as the blanket fix for the presign-expiry bug — the bug is about *URL staleness*, not about the optimizer being incompatible with Notion's images.

**Warning signs:** `next/image` usage anywhere in `templates/default/` gains an `unoptimized` prop as part of this milestone's diff; Lighthouse/image payload size regresses after the "fix" ships.

**Phase to address:** Image fix phase.

---

### Pitfall 3: Shortening `revalidate` doesn't actually fix the root cause, and creates new load on the Notion API

**What goes wrong:**
ISR's stale-while-revalidate model means a page only regenerates on the *next request after* the `revalidate` window elapses — not on a timer. If a page sits idle (no visitors) for longer than the presigned URL's ~1h TTL, the cached HTML still carries the stale, now-expired URL no matter how short `revalidate` is set to (60s or 3s makes no difference to an idle page). Shortening `revalidate` to "fix" this only helps pages that get frequent traffic; it does nothing for low-traffic pages, and it increases Notion API call volume on every page that DOES get traffic, since each regeneration re-queries Notion (`getPosts`/`getPost`, which mint fresh presigned URLs).

**Why it happens:**
"Refresh more often" is an intuitive fix for staleness, but it misdiagnoses the mechanism — the bug is about *idle* time exceeding TTL, not about the polling interval being too long relative to visit frequency.

**How to avoid:**
- Treat "shorten `revalidate`" as, at best, a partial mitigation for high-traffic pages, never the actual fix.
- If used, know Notion's documented rate limit: an average of ~3 requests/second per integration (bursts allowed), which the docs describe as roughly 2,700 requests per 15 minutes; exceeding it returns `429` with a `Retry-After` header (MEDIUM confidence — [developers.notion.com/reference/request-limits](https://developers.notion.com/reference/request-limits)). For a single-operator low-traffic blog this ceiling is unlikely to be hit from `revalidate` alone, but home + every post + every category page independently regenerating on a short interval under real traffic is additive against the same integration token — size this against actual expected traffic before committing to a number, don't just pick "30s" because it feels safer.
- Separately: Next.js 16 raised the **image optimizer's own** `images.minimumCacheTTL` default from 60s to 4 hours (MEDIUM confidence, official Next 16 upgrade guide). This repo's `next.config.ts` does not set `minimumCacheTTL` explicitly, so it now inherits the 4h default — a *second*, independent cache layer from the page's 180s ISR `revalidate`. Don't conflate the two: shortening page `revalidate` has zero effect on how long the image optimizer itself may continue serving a previously-fetched (possibly now-broken) optimized image variant for the same exact `/_next/image?url=...` request.

**Warning signs:** `CONFIG.revalidate` gets tuned down as the "fix" with no change to how the URL is sourced; the fix "works" in manual testing (because testing itself generates traffic, defeating the idle-gap bug) but the underlying bug ships unfixed.

**Phase to address:** Image fix phase.

---

### Pitfall 4: Pre-fetching/re-signing at request time defeats ISR and turns a static page dynamic

**What goes wrong:**
Adding a data path that re-fetches or re-signs the image URL "just in time" per visitor request (e.g., inside a Route Handler hit on every page load, or inside a Server Component that intentionally opts out of caching) removes the benefit ISR gives you: served-from-cache static HTML. Every page view now makes a live Notion API call, adding latency to every request, multiplying Notion API load roughly by pageview count instead of by regeneration count, and creating a new single point of failure (if Notion is briefly unreachable, every visitor's request fails, not just the one background regen).

**Why it happens:**
It looks like the most "correct" fix (always get a live URL) without noticing it silently opts the route out of the caching model the rest of the app depends on.

**How to avoid:** Keep image URL resolution inside the SAME cached, tagged data fetch already used for the rest of the page (`getPosts()`/`getPost()` in `apps/web/src/lib/notion.ts`, which already carries `next: { revalidate, tags: ["notion-posts"] }`). Don't add a second, differently-cached (or uncached) data path just for the thumbnail URL — that's how a page silently becomes dynamic (`force-dynamic` in practice, even without the literal export) one field at a time.

**Warning signs:** A new `fetch()` call to Notion appears outside `packages/core/src/client.ts`'s existing patterns, without the shared `fetchOptions`/tag; the page's response time or Vercel Function invocation count jumps after deploy; `next build` output no longer marks the post/home route as static/ISR.

**Phase to address:** Image fix phase.

---

### Pitfall 5: Diagnosing the `recordMap` failure by code inspection alone (repeating the CR-01 mistake)

**What goes wrong:**
This repo's own recorded process lesson (`PROJECT.md` Key Decisions) is that a prior fix ("CR-01," the `status` property casing) was made by inferring behavior from internal code consistency rather than checking the live external system, and had to be reverted after costing a full round trip. The same failure mode applies directly here: `notion-client`'s `getPage()` can fail for several structurally different reasons, and picking one from reading `notion-x.ts` alone (rather than gathering evidence) risks another wasted round trip.

**Known candidate causes, and what distinguishes them:**

| Candidate cause | What it looks like | Discriminating evidence |
|---|---|---|
| Notion/Cloudflare blocking Vercel's rotating serverless egress IPs | Works locally, fails only in prod; error is a 403 or an HTML "challenge" page instead of JSON | Add a temporary debug log of the raw response `status` + first 200 chars of body inside `getPageRecordMap()`'s catch (currently there is none — the failure is swallowed silently in `post/[id]/page.tsx`'s combined catch). A non-JSON body or `text/html` response body containing a challenge/Cloudflare marker is diagnostic; a clean `401`/`404` JSON body is not this. |
| `fetch` / runtime differences under Next 16 (edge vs nodejs runtime, missing User-Agent, following/not-following redirects) | Consistent failure across both environments once headers differ, or works in one Next.js runtime and not the other | Confirm which runtime the route/page is executing in (`export const runtime = "nodejs"` vs default/edge) and whether `notion-client` requires Node-only APIs; a runtime mismatch would surface as an import/require error, not a network error — check the actual thrown error's `name`/message, not just "it failed." |
| Page ID format (dashed UUID vs compact) | `getPage()` throws immediately on a malformed ID, before any network call | `notion-client`'s `get_page`-equivalent accepts both dashed and 32-char compact formats per its own docs (LOW confidence, single source) — unlikely root cause on its own, but verify by logging the exact `id` value passed into `getPageRecordMap(id)` and confirming it matches one of the two accepted shapes. |
| Database row vs "shared page" distinction, and whether a page inside a database inherits the parent's public sharing | Some posts render, others don't; or all fail identically | Sharing inherits from a shared parent (database) down to child pages UNLESS a specific row's Share settings were narrowed ("Access Restricted") — Notion explicitly supports overriding a single row to NOT inherit (MEDIUM confidence). Discriminator: open the exact failing page's URL directly in an **incognito/logged-out** browser tab (not the operator's authenticated session, which can see restricted pages regardless) — if it 404s or prompts to request access there, that row's sharing was overridden; if it loads fine logged-out, sharing is not the cause. |
| `NOTION_TOKEN_V2` cookie expiry | Works, then stops working after some time, correlating with a Notion session/password change | This repo's `notion-x.ts` currently passes `process.env.NOTION_TOKEN_V2 \|\| undefined` — i.e., unauthenticated unless that var is explicitly set. Discriminator: run `vercel env ls` and check whether `NOTION_TOKEN_V2` is actually set in the Production environment. If it is NOT set (matching local `.env` also unset), cookie expiry is structurally impossible as the cause — the client is running unauthenticated end-to-end and the failure must be sharing state or IP blocking, not a stale cookie. If it IS set, diff it against a freshly captured cookie and check for staleness. |
| Notion-side 2025–2026 changes to the unofficial endpoint | Failure started at a specific point in time uncorrelated with any deploy in this repo | Check whether the failure predates or postdates a Vercel deploy — if it started with no corresponding commit, it's more likely Notion/infra-side; correlate against Vercel's deployment history and any incident reports. |

**How to avoid the meta-mistake:** Before writing any fix, capture at minimum: (1) the actual thrown error's message/stack from a temporary log statement in `getPageRecordMap()`'s call site, deployed and observed in Vercel's function logs against a real failing request; (2) a direct comparison of the unofficial endpoint's response (status + body shape) from local vs. from a temporary Vercel debug route, for the SAME page ID. Do not ship a "fix" whose justification is "the code suggests X" without one of these two pieces of live evidence, mirroring the explicit process lesson already recorded in `PROJECT.md`.

**Warning signs:** A plan or PR description says "likely caused by X" with no attached log line, curl output, or response body as evidence; the fix changes `notion-x.ts` behavior without first adding the diagnostic logging the current code lacks entirely.

**Phase to address:** Content-rendering-fix phase — and specifically, this phase's FIRST plan/step should be "add logging + gather the two pieces of live evidence above," not "write the fix," given the repo's own precedent.

---

### Pitfall 6: Splitting the combined try/catch in `post/[id]/page.tsx` causes new failure modes worse than the one being fixed

**What goes wrong:**
`post/[id]/page.tsx` currently wraps `getPageRecordMap`, `getCategories`, and `getPosts` (for related posts) in one try/catch that nulls/empties all three on any failure. Splitting them into independent try/catches is reasonable in principle (isolates one bad call from nuking unrelated data), but two specific mistakes are easy to make when doing it:
1. **Misusing `notFound()` for a content-render failure.** `notFound()` is already correctly called earlier in the file for a genuinely missing/non-public post. If someone adds a second `notFound()` call inside the split-out `recordMap` catch (reasoning "no content = not found"), that's wrong — the post DOES exist (its metadata already rendered via `generateMetadata`), and returning a 404 for it breaks SEO, breaks the OG card that was just generated, and misrepresents a real, live post as missing.
2. **Letting an error escape uncaught "because `error.tsx` will catch it."** `error.tsx` is a client-only React error boundary (must start with `"use client"`) that only catches errors that escape a Server Component's render entirely. If any of the three fetches is deliberately left un-caught to "let error.tsx handle it," EVERY visitor to a post experiencing a transient hiccup on the categories or related-posts query — a much more common, and much less severe, failure than the recordMap bug — now gets a full error page instead of the post rendering with an empty categories list. That's a regression in the common case to (maybe) fix the rare case.

**Why it happens:** "One catch is doing too much" is a legitimate code-quality observation (and matches `CONCERNS.md`'s own criticism of overly-broad catches), but the fix-shape people reach for (split into three, let the important one throw) optimizes for visibility of the specific bug being chased at the cost of the page's existing fail-safe behavior for everything else.

**How Next.js actually behaves when a Server Component throws during ISR regeneration (verify before relying on this):**
Documented/intended behavior: if a background ISR regeneration throws, Next.js is supposed to keep serving the previously-cached (stale) page unaltered, and retry regeneration on a subsequent request (MEDIUM confidence — official Next.js "How Revalidation Works" guide). However, there are real reported production cases (e.g., `vercel/next.js` issue #54797) of a thrown error surfacing as a 500 to the visitor instead of falling back to the stale cached page — a documented discrepancy between intended and observed behavior in some configurations. **This is an Open Question for this specific Next 16 / Vercel Fluid Compute setup and must not be assumed safe without direct verification** (see Pitfall 15's verification approach) — "an uncaught throw is fine because ISR falls back to stale" is exactly the kind of code-inspection-only reasoning Pitfall 5 warns against.

**How to avoid:**
- Keep `notFound()` scoped exclusively to "post itself doesn't exist / isn't public" (already correct as written) — never call it from inside a content-render catch.
- Split the try/catch by *concern*, not by call: one catch for `recordMap` (content rendering), one for `categories`+`relatedPosts` (site chrome), each logging which specific call failed and why (extends the existing `CONCERNS.md` D-01/"silent exception swallowing" fix pattern) — but neither should be left to throw uncaught into `error.tsx`, given the ISR fallback behavior above is unverified for this deployment.
- If `error.tsx` is added at all this milestone, scope its blast radius deliberately (e.g., only for genuinely fatal path-not-found-adjacent cases) and test it against a real ISR regeneration failure in the deployed environment before trusting it as a safety net.

**Warning signs:** A diff adds a second `notFound()` call anywhere below the initial `if (!post) notFound()`; a diff removes a try/catch around `getPageRecordMap`/`getCategories`/`getPosts` without replacing it with an equally fail-safe (never-throw-to-caller) pattern; `error.tsx` is added without a documented test against a live, deployed ISR regeneration failure.

**Phase to address:** Content-rendering-fix phase.

---

### Pitfall 7: localStorage-driven initial sidebar state causes hydration mismatch / flash of wrong layout

**What goes wrong:**
The server has no `window`/`localStorage`, so it must render some default (e.g., "expanded") for both sidebars. If a client component then reads `localStorage` synchronously in its initial `useState` (or in an unguarded `useEffect` that updates state on mount without a hydration-safe pattern), the client's first render for a returning visitor with "collapsed" saved will briefly show "expanded" (matching SSR), then flip to "collapsed" a beat after hydration — a visible layout jump, and, if done via `useState(() => localStorage.getItem(...))` directly, a React hydration mismatch warning because the server-rendered markup and the client's first render disagree.

**Why it happens:** It's the most direct way to write "restore saved state," and it's easy to not notice the SSR/CSR disagreement until it's visibly janky in prod (dev's fast refresh can mask timing issues).

**How to avoid:**
This repo already has a working precedent for exactly this class of problem: `ThemeToggle.tsx` uses a `mounted` guard (`useState(false)` → `useEffect` sets `true`) and renders a fixed-size placeholder until mounted, and `ThemeProvider.tsx` wraps `next-themes`, which itself avoids flash-of-wrong-theme via a blocking inline script injected before hydration. For the sidebar:
- Reuse the `mounted`-guard idiom for the LEAST janky-but-simplest option (accepts a one-frame default-state render), consistent with existing repo conventions, OR
- For a flash-free result, add a small blocking inline `<script>` in `<head>` (same technique `next-themes` uses under the hood) that reads `localStorage` and sets a `data-sidebar-state` attribute/class on `<html>` before first paint, then have the CSS/component read that attribute instead of re-deriving state after hydration. This is more code to maintain but eliminates the visible jump entirely — pick this if the flash is user-visible enough to matter (likely, since it changes grid column widths, not just colors).
- Do NOT read `localStorage` directly inside a value passed to `useState()`'s initializer without a mount guard — that's the specific pattern that produces the hydration warning.

**Warning signs:** React hydration mismatch warning in the browser console on first load with a saved "collapsed" state; visible layout jump (3-col → 2-col or vice versa) shortly after page paint, most noticeable on slower connections/devices.

**Phase to address:** Sidebar phase.

---

### Pitfall 8: A `"use client"` boundary drawn too high swallows `SubscribeSection`'s secret-dependent gate

**What goes wrong:**
`SubscribeSection` is deliberately a Server Component (`apps/web/src/components/subscribe/SubscribeSection.tsx`) that reads `process.env.RESEND_API_KEY` / `RESEND_AUDIENCE_ID` directly — this only works because it never enters client-bundled code. It's rendered directly inside `templates/default/Layout.tsx`'s right `<aside>`, and `Layout.tsx` is currently a plain Server Component. If the sidebar-collapse feature is implemented by marking `Layout.tsx` itself (or the `<aside>` wrapping `SubscribeSection`) `"use client"` to get `useState`/`useEffect`/`localStorage` access, one of two things happens: either the secret env var resolves to `undefined` in the client bundle (Next.js only inlines `NEXT_PUBLIC_*` vars into client code), silently disabling the subscribe form for every forker regardless of configuration — the same fail-open shape as the Cusdis privacy bug this repo already found and fixed once — or, if someone "fixes" that breakage by renaming the var to `NEXT_PUBLIC_RESEND_API_KEY`, the secret API key ships to every visitor's browser, a direct secret leak.

**Why it happens:** The instinctive fix for "I need client-side state (useState/localStorage) somewhere in this layout" is "mark the file `use client`," without noticing a secret-gated Server Component is a sibling in the same file.

**How to avoid:**
Keep `Layout.tsx` a Server Component. Extract ONLY the collapse/expand interactive chrome (open/close button, width state, localStorage read/write) into small `"use client"` "island" components that receive their Server-Component children as already-rendered `children` props — the exact pattern this repo already documents and uses in `post/[id]/page.tsx` (see its comment: "The gate is constructed here, in a Server Component, and passed down as an already-rendered element — never as a direct import inside the client-directive terminal template"). Concretely: `<CollapsibleAside>{<SubscribeSection variant="default" />}</CollapsibleAside>` where `CollapsibleAside` is the client component and never imports `SubscribeSection` itself.

**Warning signs:** `"use client"` appears at the top of `Layout.tsx` or any file that also imports `SubscribeSection` directly; `RESEND_API_KEY` stops working (form disappears) even with env vars correctly set in Vercel; any `NEXT_PUBLIC_` prefix appears near `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` in a diff — treat that as a stop-ship finding, not a normal review comment.

**Phase to address:** Sidebar phase.

---

### Pitfall 9: Collapse transitions using `transform` on an ancestor silently break `position: sticky`

**What goes wrong:**
Both sidebars are `sticky top-8 self-start` today (`Layout.tsx`). Two independent, easy-to-miss CSS interactions can silently un-stick them once a collapse animation is added:
- **`transform` on an ancestor.** A transformed ancestor establishes a new containing block, and while the CSS spec's intent for sticky positioning is scroll-anchor-relative (not containing-block-relative), in practice this distorts or breaks sticky's viewport-relative behavior, and browsers disagree on exactly how (Chromium and Firefox produce different, both-buggy-looking results per the CSS working group's own tracked issue). If the collapse animation is implemented by wrapping both `<aside>`s (or the whole grid) in a wrapper that animates via `transform: translateX(...)` for a slide effect, the sticky asides inside it will misbehave.
- **`overflow` (other than `visible`) on an ancestor.** If any wrapper introduced for the animation sets `overflow: hidden`/`auto`/`scroll` (a common way to clip a sliding panel), that ancestor becomes the sticky element's scroll reference instead of the viewport — the `<aside>` will "stick" relative to that div, not the page, which if the div itself doesn't scroll, means it never appears to stick at all.

**Why it happens:** Both are non-obvious, delayed-onset bugs — the sidebar works perfectly with an instant (no-transition) collapse/expand, and only breaks once someone adds the animation, at which point it's easy to blame the animation timing rather than realize `position: sticky` silently stopped functioning.

**How to avoid:**
- Animate properties on the `<aside>` itself (its own `width`, or the grid container's `grid-template-columns`/`gap`) rather than wrapping it in a `transform`-animated container.
- If a wrapper is unavoidable, prefer `overflow: clip` only where it doesn't also need to serve as an animation boundary, and audit every new wrapper `div` introduced by this feature against both rules before merging.
- Manually test: after the collapse animation ships, scroll a real post/home page far enough that the aside's sticky behavior should engage, and confirm it still sticks — this is a runtime CSS behavior, not something TypeScript or ESLint will catch.

**Warning signs:** Sidebar scrolls off-screen with the page instead of sticking, but only after the collapse-transition CSS is added; works fine when the transition is temporarily disabled (`transition: none`) for a quick isolation test.

**Phase to address:** Sidebar phase.

---

### Pitfall 10: `grid-template-columns` driven by a CSS custom property doesn't animate even though the property itself is animatable

**What goes wrong:**
`Layout.tsx`'s desktop grid is currently `grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)]` — Tailwind arbitrary value syntax that resolves to `grid-template-columns: var(--sidebar-width) 1fr var(--profile-width)`. Modern browsers do support animating `grid-template-columns` directly (Chrome/Edge 107+, Firefox 66+, Safari 16+ — MEDIUM confidence, web.dev). But when the animated value is *routed through* a plain (unregistered) CSS custom property, the browser treats that custom property's value as an opaque string for interpolation purposes and the grid snaps discretely rather than transitioning smoothly — CSS custom properties only interpolate correctly when registered via `@property` with an explicit `syntax` (e.g. `<length>`).

**How to avoid:** Either (a) register the width variables with `@property --sidebar-width { syntax: '<length>'; inherits: true; initial-value: 240px; }` (and confirm target-browser support for `@property` is acceptable for this project), or (b) skip the custom-property indirection for the animated case and transition two explicit `grid-template-columns` literal values directly (e.g., driven by a `data-collapsed` attribute selector, each branch setting a literal `grid-template-columns` value), which animates correctly in all the browsers listed above without any `@property` registration.

**Warning signs:** The collapse "works" (columns end up at the right final size) but visibly snaps/jumps instead of smoothly transitioning, especially noticeable when `prefers-reduced-motion` is NOT set and a smooth transition was actually intended.

**Phase to address:** Sidebar phase.

---

### Pitfall 11: Collapsing a panel while focus is inside it strands keyboard/screen-reader users

**What goes wrong:**
If a user has tabbed into the left sidebar (search input, a category link) and then either the auto-collapse-on-viewport-shrink logic or a manual toggle collapses/hides that `<aside>`, the browser silently moves focus to `<body>` with no announcement — disorienting for keyboard and screen-reader users, who lose their place with no indication of what happened.

**How to avoid:** Before collapsing, check whether `document.activeElement` is a descendant of the collapsing `<aside>`; if so, explicitly move focus to the toggle button that caused the collapse (or to `<main>`) rather than letting it fall through to `<body>`. Also respect `prefers-reduced-motion: reduce` — skip the width/transform transition entirely (instant show/hide) when it matches, which incidentally also reduces exposure to the sticky/transform interaction in Pitfall 9 for those users.

**Warning signs:** Manual keyboard-only test: tab into a sidebar control, trigger collapse (resize the window past the auto-collapse threshold, or hit the toggle), then press Tab again — if focus visibly jumps to the very top of the page/URL bar instead of somewhere sensible, this pitfall is present.

**Phase to address:** Sidebar phase.

---

### Pitfall 12: Verifying against `next dev` never exercises the actual bugs

**What goes wrong:**
`next dev` recompiles/refetches on essentially every request — there is no ISR stale-while-revalidate window and no meaningfully idle cache. The home-thumbnail bug (which depends on a page sitting cached-and-idle past the presign TTL) and any IP-blocking-flavored cause of the `recordMap` bug (dev runs from a developer machine's IP, not Vercel's) structurally cannot reproduce in `next dev`. A "looks fixed in dev" signal is close to meaningless for either of these two bugs.

**How to avoid:** Sign off both the image fix and the content-rendering fix only against a real deployment (Preview or Production), using the concrete repro procedures in Pitfalls 13–15, never against local dev output alone.

**Warning signs:** A PR/plan's verification section cites only `npm run dev` / localhost screenshots for either the image bug or the recordMap bug.

**Phase to address:** Image fix phase and Content-rendering-fix phase (both — call this out explicitly in each phase's verification/UAT steps).

---

### Pitfall 13: Testing immediately after deploy never reaches the failure window

**What goes wrong:**
A fresh deploy has an empty ISR cache. The first visit to any page triggers a synchronous build with a brand-new (not-yet-expired) presigned URL — testing at this moment will always show working thumbnails, producing false confidence that the fix worked (or, before a fix, false confidence the bug doesn't exist). The bug specifically requires an **idle gap longer than the presign TTL** (~1 hour) with no visits, so the cached HTML's embedded URL crosses expiry before anyone triggers a background regeneration.

**Concrete, reproducible verification procedure for the image fix:**
1. Visit a post/home page to force a fresh ISR build; note the exact presigned URL from the rendered HTML source (view-source, find the `s3.us-west-2.amazonaws.com`/`prod-files-secure...` URL, and read its `X-Amz-Expires`/expiry-related query param if present, or just note the wall-clock time).
2. Do not visit that page again until at least ~60+ minutes have passed (the presign TTL).
3. After that window, load the page in a fresh incognito window (to bypass the visiting browser's own cache) — this request is what determines whether ISR's still-stale HTML (carrying the now-expired URL) gets served. **Before the fix:** thumbnail should be visibly broken (403/blank) on this load, because ISR hasn't regenerated yet (nobody visited to trigger it) even though the window elapsed.
4. Reload once more — this second hit is what actually triggers ISR's background regeneration. A third load shortly after should show a fresh, working image if this is genuinely stale-URL-in-cache behavior.
5. **After the fix ships**, repeat steps 1–4 in full — the fix should make step 3 no longer show a broken image (i.e., collapse the "broken → still broken → fixed on next load" sequence into "always works," regardless of idle time), not merely make step 4 recover faster.

**Warning signs:** A "verified fixed" claim based on testing done within minutes of a deploy, or based only on a single immediate reload.

**Phase to address:** Image fix phase.

---

### Pitfall 14: Two independent cache layers can each separately mask whether the image fix actually worked

**What goes wrong:**
There are at least two caches sitting between "the raw presigned URL is valid" and "the visitor sees an image": (1) the page's own ISR cache (180s `revalidate`), and (2) the Next.js image optimizer's own server-side cache for `/_next/image?url=...&w=...` requests, whose default TTL floor (`images.minimumCacheTTL`) is **4 hours by default as of Next.js 16** (this repo does not override it in `next.config.ts`) — independent of the page's 180s window. Testing only via the rendered `<img>` tag / `/_next/image` path can show a "working" image purely because the optimizer's own cache still has last hour's successfully-fetched, still-valid-at-fetch-time bytes cached, telling you nothing about whether the ROOT presigned URL embedded in the current page HTML is actually fresh.

**How to avoid:** When verifying, always check the raw origin URL directly (curl the `s3.us-west-2.amazonaws.com/...`/`prod-files-secure...s3...amazonaws.com/...` URL found in the page's HTML source, not the `/_next/image?...` wrapper URL) to confirm root freshness, independent of either cache layer. If testing the optimizer path specifically, be aware a `200` there does not prove the underlying Notion URL is currently valid — it may be serving a cached copy from up to 4 hours ago.

**Warning signs:** "It works" verified only by looking at the rendered page in a browser without checking network requests/response codes for the actual Notion S3 origin request.

**Phase to address:** Image fix phase.

---

### Pitfall 15: A "fixed" recordMap can be an artifact of a warm cache or an intermittent condition, not an actual fix

**What goes wrong:**
Because `post/[id]/page.tsx` currently swallows the `recordMap` failure silently (nulls it, no user-facing error), a page that already rendered successfully (cached from before the "fix" was even deployed) will keep showing content regardless of whether the underlying cause was addressed — testing against an already-warm cache proves nothing about the fix. Separately, if the cause is intermittent (a transient rate limit, an occasional IP-block on some but not all of Vercel's rotating egress IPs), a single successful post-deploy check can pass by luck.

**How to avoid:** After deploying the fix, force a genuine regeneration (wait out the 180s `revalidate` window and make a fresh request, or use the existing on-demand revalidation path already wired to the `notion-posts` cache tag) and repeat the check several times across a few minutes/requests before declaring the bug fixed — a single green check is not sufficient evidence given the swallowed-error design and the possibility of an intermittent root cause.

**Warning signs:** "Verified fixed" based on a single page load, especially one loaded shortly after the fix's own deploy (which itself forces a fresh regeneration and may mask an intermittent issue).

**Phase to address:** Content-rendering-fix phase.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| `unoptimized` on the Notion `<Image>` | Removes optimizer errors immediately | Full-resolution originals hit every device; no format/size negotiation | Never as the permanent fix; only as a temporary, explicitly-flagged stopgap while the real fix ships |
| Shortening `revalidate` without addressing idle-gap staleness | Looks like it "helps," easy one-line change | Doesn't fix low-traffic pages at all; adds Notion API load across all pages sharing the token | Only as a documented, deliberate mitigation alongside the real fix, never as the sole fix |
| Splitting the combined try/catch and letting one leg throw uncaught "for visibility" | Surfaces the specific bug being chased loudly | Regresses the common case (categories/related-posts hiccups) into a full error page for every visitor | Never — always replace with an equally fail-safe (never-throw-to-caller) pattern per call |
| Marking `Layout.tsx` (or its aside) `"use client"` wholesale instead of extracting a client island | Fastest path to `useState`/localStorage access | Breaks or leaks `SubscribeSection`'s secret env-var gate | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|--------------------|
| Notion file properties (presigned S3 URLs) | Treating the URL as a stable asset URL that can be cached indefinitely or referenced later | Treat it as short-lived (≈1h); resolve it fresh inside the already-cached ISR data path, never store/reuse a URL beyond a single render's data fetch |
| `notion-client` (unofficial API) | Diagnosing failures from code inspection instead of live evidence (the CR-01 mistake, repeated) | Capture the actual thrown error + a direct prod-vs-local response comparison before writing any fix (Pitfall 5) |
| Next.js image optimizer (`/_next/image`) | Assuming its cache TTL matches the page's ISR `revalidate` | They're independent; Next 16's `minimumCacheTTL` defaults to 4h regardless of page `revalidate` — verify against the raw origin URL, not the optimizer path (Pitfall 14) |
| `SubscribeSection` (secret-gated Server Component) | Widening a `"use client"` boundary to cover it because a sibling needs client hooks | Extract a client "island" that receives the Server Component as `children`, per the existing `post/[id]/page.tsx` pattern |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Image proxy route with no allowlist/caching discipline | Vercel Function invocation count and egress cost scale with any URL requested, not just real thumbnails | Allowlist hostnames, reject non-image content-types, set `redirect: "error"` (Pitfall 1) | As soon as the route URL is discoverable/guessable by anyone, not at any particular traffic scale |
| Request-time re-signing/pre-fetching of images | Every page view becomes a live Notion API call; latency and Notion rate-limit exposure scale with pageviews, not with ISR regenerations | Keep image resolution inside the existing cached `getPosts`/`getPost` data path (Pitfall 4) | Breaks ISR's caching model immediately, worsens proportionally with traffic |
| Shortened `revalidate` across all pages sharing one Notion integration token | Aggregate Notion API call volume rises; risk of `429`s under real traffic across home + N posts + categories | Size any `revalidate` change against actual expected traffic, not intuition; know Notion's ~3 req/s average limit (Pitfall 3) | Depends on traffic; unlikely at current single-operator scale, real risk if the fork ever gets meaningful traffic |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Image proxy accepts an arbitrary `url` param | SSRF (internal network probing, cloud metadata access on some hosts), open/anonymous relay abuse | Accept an id, resolve the URL server-side from trusted data; if a URL param is unavoidable, allowlist hostnames and set `redirect: "error"` (Pitfall 1) |
| `"use client"` boundary drawn around `SubscribeSection` | Secret (`RESEND_API_KEY`) either silently no-ops the feature for every forker (fail-open, same shape as the fixed Cusdis bug) or — if "fixed" by renaming to `NEXT_PUBLIC_*` — leaks the secret to every browser | Never let a client-directive file import `SubscribeSection` directly; pass it down as pre-rendered `children` from a Server Component (Pitfall 8) |
| Proxy route streaming responses without content-type verification | A malicious/compromised allowlisted-but-attacker-influenced path could serve non-image content (e.g., HTML with an XSS payload) that a naive proxy blindly forwards | Verify `content-type` starts with `image/` before streaming the response back; reject otherwise |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| localStorage-driven sidebar state read without a hydration guard | Visible layout jump (3-col → 2-col) shortly after page paint; console hydration warnings | Reuse the existing `mounted`-guard idiom from `ThemeToggle.tsx`, or a pre-hydration blocking script like `next-themes` uses, for flash-free restoration (Pitfall 7) |
| Collapsing a panel while keyboard focus is inside it | Focus silently lands on `<body>`, disorienting keyboard/screen-reader users | Explicitly move focus to the triggering toggle or `<main>` before/at collapse (Pitfall 11) |
| Ignoring `prefers-reduced-motion` for the collapse transition | Motion-sensitive users get an unwanted, potentially vestibular-triggering animation on every toggle and every auto-collapse resize | Skip the transition (instant show/hide) when `prefers-reduced-motion: reduce` matches |
| Sticky sidebar silently stops sticking after the animation ships | Confusing "it worked yesterday" regression report with no obvious code-review-visible cause | Manually scroll-test sticky behavior specifically after adding any transition CSS touching an ancestor of either `<aside>` (Pitfall 9) |

## "Looks Done But Isn't" Checklist

- [ ] **Image fix:** Often "verified" only via `next dev` or immediately post-deploy — verify against a real idle-then-reload cycle on the deployed site per Pitfall 13's procedure, checking the raw origin URL per Pitfall 14, not just the rendered `<img>`.
- [ ] **`recordMap` fix:** Often "verified" against an already-warm ISR cache or a single lucky request — force a genuine regeneration and repeat the check several times per Pitfall 15 before declaring it fixed; also confirm the diagnostic evidence from Pitfall 5 (actual error message/response, not a guess) was captured before the fix was written.
- [ ] **Sidebar collapse:** Often "done" visually while missing: hydration-safe initial state (Pitfall 7), the Server/Client boundary around `SubscribeSection` (Pitfall 8), sticky behavior surviving the transition (Pitfall 9), keyboard focus handling on collapse (Pitfall 11), and `prefers-reduced-motion` support.
- [ ] **Error-handling changes to `post/[id]/page.tsx`:** Often "done" once it compiles and one happy-path post renders — verify `notFound()` is still scoped only to the missing/non-public case (not to content-render failures), and that no leg of the fetch is left to throw uncaught into an unverified `error.tsx`/ISR-fallback assumption (Pitfall 6).
- [ ] **Any new image-proxy route:** Often "done" once it renders images correctly — verify it rejects an arbitrary out-of-allowlist URL with a non-200, rejects a redirect response from an allowlisted host, and rejects a non-`image/*` content-type (Pitfall 1).

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Open image-proxy shipped without allowlist | LOW | Add hostname allowlist + `redirect: "error"` + content-type check as a follow-up commit; no data migration needed since it's stateless |
| `notFound()` wrongly called from a content-render catch | LOW | Remove the erroneous call, restore graceful-degradation behavior; redeploy triggers ISR regeneration on next visit |
| `"use client"` accidentally swallows `SubscribeSection`'s gate | MEDIUM | Revert the boundary change, re-extract as a client island receiving `children`; audit whether the secret was ever exposed in a deployed client bundle (check build output / browser devtools Sources for the literal key) if a `NEXT_PUBLIC_` rename was involved — rotate the Resend API key if so |
| Sticky sidebar breaks after animation ships | LOW | Remove `transform`/`overflow` from the offending ancestor, move the animated property to the `<aside>` or grid container directly |
| Shortened `revalidate` doesn't fix the idle-gap bug, ships as "the fix" | MEDIUM | Revisit with a real fix (proxy/re-resolve approach); no rollback of user-visible harm needed since the symptom (occasionally broken thumbnail) was pre-existing, just still present |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. Open image-proxy SSRF/hotlinking | Image fix phase | Attempt a request with an out-of-allowlist URL and confirm non-200; attempt a redirect-serving allowlisted URL and confirm it's rejected |
| 2. `unoptimized` reintroduces full-cost images | Image fix phase | Diff review: no `unoptimized` prop added as the primary fix; image payload size checked pre/post |
| 3. Shortened `revalidate` mistaken for the fix | Image fix phase | Confirm the fix addresses idle-gap staleness specifically (Pitfall 13's procedure), not just visit-frequency-dependent freshness |
| 4. Request-time re-signing defeats ISR | Image fix phase | `next build` output still marks the page static/ISR; response time doesn't regress to "live Notion call per request" |
| 5. Guessing the `recordMap` cause from code alone | Content-rendering-fix phase | Diagnostic evidence (log line + prod-vs-local response comparison) exists and is cited before the fix is written |
| 6. Split try/catch breaks `notFound()`/ISR assumptions | Content-rendering-fix phase | `notFound()` still scoped to missing/non-public post only; no leg of the fetch throws uncaught without a verified ISR-fallback test |
| 7. Hydration mismatch on sidebar state | Sidebar phase | No hydration warning in console on a returning visitor with a saved "collapsed" state |
| 8. Client boundary swallows `SubscribeSection` secret gate | Sidebar phase | `SubscribeSection` still renders correctly with env vars set; no `NEXT_PUBLIC_RESEND_*` var introduced; `Layout.tsx` (or files importing `SubscribeSection`) remain Server Components |
| 9. Sticky breaks under transform/overflow ancestor | Sidebar phase | Manual scroll test of both asides after the collapse transition ships |
| 10. `grid-template-columns` via CSS var doesn't animate | Sidebar phase | Visual check: transition is smooth, not a snap, at the target browsers |
| 11. Focus loss on collapse | Sidebar phase | Keyboard-only test: tab into sidebar, trigger collapse, confirm focus lands somewhere sensible |
| 12. `next dev` never exercises the real bugs | Image fix phase, Content-rendering-fix phase | Verification steps explicitly reference a deployed URL, not localhost |
| 13. Testing right after deploy misses the failure window | Image fix phase | Verification procedure includes an idle-gap step (Pitfall 13) |
| 14. Two cache layers mask the image fix's real status | Image fix phase | Verification checks the raw origin S3 URL directly, not just `/_next/image` |
| 15. `recordMap` fix verified against a warm/lucky cache | Content-rendering-fix phase | Verification forces a genuine regeneration and repeats the check multiple times |

## Open Questions

- **Whether a thrown Server Component error during ISR regeneration reliably falls back to the stale cached page on this specific Next.js 16 / Vercel (Fluid Compute) configuration, or can surface as a 500** — official docs and a real reported GitHub issue (#54797) disagree in at least some configurations. Must be verified directly against the deployed project (deliberately throw in a scratch/debug route, observe behavior) before any redesign of `post/[id]/page.tsx`'s error handling relies on "ISR protects us" as a safety argument.
- **Whether Vercel serverless egress IPs are actually being blocked by Notion/Cloudflare for this specific project** — this is a plausible, documented-elsewhere failure mode (seen in an unrelated Notion MCP server context) but is NOT yet confirmed for this repo's `notion-client` usage; Pitfall 5's discriminating diagnostics must be run before treating it as the cause.
- **Whether `NOTION_TOKEN_V2` is actually set in this project's Vercel Production environment** — the code defaults to unauthenticated (`|| undefined`) if unset, which would rule out cookie-expiry as a cause entirely; this needs a direct `vercel env ls` check, not an assumption from the source file alone.
- **Actual current/expected traffic volume for 4lph4-bl0g.vercel.app** — needed to size whether shortening `revalidate` risks Notion's ~3 req/s rate limit in practice, versus being a non-issue at this project's real scale.
- **Whether the specific failing post(s)' individual Notion rows have had their "Share to web" setting explicitly overridden away from the parent database's** — requires the incognito-tab check in Pitfall 5's table, not yet performed as part of this research.

## Sources

- This repository: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/lib/notion.ts`, `apps/web/src/lib/notion-x.ts`, `apps/web/next.config.ts`, `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/templates/default/HomePage.tsx`, `apps/web/src/site.config.ts`, `apps/web/src/components/subscribe/SubscribeSection.tsx`, `apps/web/src/components/ThemeToggle.tsx`, `apps/web/src/components/ThemeProvider.tsx`, `packages/core/src/client.ts` — HIGH confidence (read directly).
- [Notion API request limits](https://developers.notion.com/reference/request-limits) — MEDIUM confidence (official docs, via web search summary).
- [Next.js Upgrading: Version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) — `images.minimumCacheTTL` default change 60s → 4h — MEDIUM confidence (official docs, via web search summary).
- [Next.js: Guides — How Revalidation Works](https://nextjs.org/docs/app/guides/how-revalidation-works) — MEDIUM confidence (official docs).
- [vercel/next.js Discussion #90639 — Caching images from CDN with signed urls](https://github.com/vercel/next.js/discussions/90639) — MEDIUM confidence.
- [vercel/next.js Issue #54797 — serving broken page (500) after revalidate instead of cached one](https://github.com/vercel/next.js/issues/54797) — LOW/MEDIUM confidence (single reported case, not confirmed against this project) — flagged as Open Question above.
- [SSRF in Next.js: Image Optimization, Server Component fetch(), and API Route Webhooks](https://vibeappscanner.com/vulnerability-in/ssrf-nextjs) — LOW/MEDIUM confidence (third-party security write-up).
- [Polypane — Getting stuck: all the ways position:sticky can fail](https://polypane.app/blog/getting-stuck-all-the-ways-position-sticky-can-fail/) — MEDIUM confidence (cross-checked against MDN and CSSWG discussion).
- [w3c/csswg-drafts #3186 — Sticky positioning with transform between it and reference box](https://github.com/w3c/csswg-drafts/issues/3186) — MEDIUM confidence (spec-body discussion, cross-checked).
- [web.dev — CSS animated grid layouts](https://web.dev/articles/css-animated-grid-layouts) — MEDIUM confidence (official-adjacent source).
- [Vercel Academy — Errors and Not Found](https://vercel.com/academy/nextjs-foundations/errors-and-not-found) and [Next.js — Learn: Error Handling](https://nextjs.org/learn/dashboard-app/error-handling) — MEDIUM confidence (official/official-adjacent docs).
- [Cloudflare blocks MCP server IP when making API calls to notion.com — makenotion/notion-mcp-server #252](https://github.com/makenotion/notion-mcp-server/issues/252) — LOW confidence (analogous case, different client/context, not confirmed for `notion-client`/this project).
- [npm — notion-client](https://www.npmjs.com/package/notion-client) — LOW confidence (package README claim re: accepted page-id formats, single source).
- Notion sharing/permissions inheritance behavior — LOW/MEDIUM confidence, synthesized from [Notion Help Center — Sharing & permissions](https://www.notion.com/help/sharing-and-permissions) and third-party guides; not confirmed against this project's specific database/rows.

---
*Pitfalls research for: NoLog v1.1 (Live Blog Bug Fixes & Reading Width)*
*Researched: 2026-08-09*
