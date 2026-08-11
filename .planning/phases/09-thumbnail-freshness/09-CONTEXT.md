# Phase 9: Thumbnail Freshness - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Readers see post thumbnails on their first load of the deployed site, however long it sat idle beforehand.
Notion's file URLs are presigned and expire in roughly an hour; cached HTML outlives them, so a page that sat
idle serves a URL that is already dead. The fix is to stop embedding the expiring URL at all — the page
references a stable path keyed on the post, and the URL is resolved server-side at request time.

Covers IMG-01 … IMG-05.

**Not in this phase:** the `terminal` template (out of scope for this milestone), the email digest's thumbnail
handling (see D-04), sidebars / reading width (Phase 10), and anything about post *content* rendering
(Phases 7-8, complete).

</domain>

<decisions>
## Implementation Decisions

### Scope — which surfaces get the fix

- **D-01:** **All four `default`-template surfaces get it**, not the two the requirements name. Scouting found
  `post.thumbnail` rendered through `next/image` in **four** places, not two:
  `templates/default/HomePage.tsx:41`, `SearchPage.tsx:59`, `CategoryPage.tsx:55` (three byte-identical 96px
  card blocks) and `PostPage.tsx:89` (the `aspect-video` hero). IMG-01 names the home feed and IMG-02 the post
  detail; **search and category carry the identical bug and appear in no requirement.** Fixing two of four
  would leave the same defect live on two pages and fork three identical blocks into two versions. Going
  beyond the requirement letter here is deliberate and recorded. — **Reversibility:** reversible.
- **D-02:** **Extract the shared thumbnail rendering into one component.** The three card blocks are already
  byte-identical, so the resolution path, the failure placeholder and the external-URL branch land in one
  place instead of four. Timing is favourable: Phase 10 will rework `Layout.tsx` and the surrounding grid, so
  consolidating the card internals first keeps the two phases from fighting over the same files. The hero
  differs in shape (`aspect-video`, `priority`) but shares the same resolution logic.
- **D-03:** The `terminal` template (`templates/terminal/PostPage.tsx:73`) is **not** changed — already
  settled in REQUIREMENTS.md's Out of Scope ("active template is `default`; terminal changes would double the
  surface with no live user"). It keeps rendering `post.thumbnail` directly and keeps the bug. Recorded so a
  reader does not mistake the omission for an oversight.
- **D-04:** The **email digest is not touched** this phase. `api/notify-subscribers/route.ts:76` deliberately
  drops Notion-hosted thumbnails from outbound mail because presigned URLs expire before the reader opens the
  message — and a stable proxy URL would in principle fix that. It is still out: no requirement covers mail
  thumbnails, and an email renders in a third-party client whose image-proxying and caching behave nothing
  like the site's, so it needs its own verification rather than riding on this one. Captured as a deferred
  idea, not silently skipped.

### The resolution path

- **D-05:** The route **streams the bytes**; it does not 307-redirect to the presigned URL. Streaming is the
  behaviour research recommended "unless redirect is explicitly verified against this deployment", and
  redirect has an unverified dependency — whether Vercel's image optimizer follows a 3xx from an allowlisted
  origin. If it does not, every thumbnail breaks. Streaming also keeps `PITFALLS.md` Pitfall 1's three guards
  — `redirect: "error"`, hostname allowlist, `content-type` must start with `image/` — enforceable in one
  place, because the bytes pass through code that can check them. Accepted cost: every image byte crosses a
  function. — **Reversibility:** costly — switching to redirect later changes the response contract and
  re-opens the optimizer question, though nothing persists that would need migrating.
- **D-06:** The response carries a **long `s-maxage` with `immutable`**, so Vercel's CDN holds the bytes and
  the function runs approximately once per image rather than once per request. This is what makes D-05's
  egress cost acceptable rather than theoretical. A Notion image's *content* does not change — only its URL
  does — so a long cache on the proxy path is correct, and it is the URL resolution, not the bytes, that must
  stay fresh.
- **D-07:** The route accepts **a Notion page identifier, never a caller-supplied URL** (PITFALLS 1). The file
  URL is resolved server-side from data the site already trusts. `Post.thumbnailType` (shipped v1.0) already
  distinguishes `"file"` (Notion-hosted, expiring) from `"external"` (a pasted public URL) — IMG-05 requires
  external thumbnails to render exactly as they do today and **not** pass through the new path, and the signal
  to branch on already exists. `packages/core` and the published `Post` type must not change
  (REQUIREMENTS.md D-05).

  **⚠ Added 2026-08-10 from `09-RESEARCH.md` — a compile-blocking gap.** The four template call sites import
  `Post` from `apps/web/src/types/index.ts`, a **local duplicate** of the published type — and that local copy
  has `thumbnail` but **not `thumbnailType`** (`apps/web/src/types/index.ts:16`; the field exists only in
  `packages/core/src/types.ts:19-28`). The first line of D-02's shared component that reads
  `post.thumbnailType` therefore fails `tsc`. The fix is a one-field addition to the **local** type, which is
  `apps/web`-only and leaves the published package untouched — D-05 is about `packages/core`, and this is not
  that. Recorded here because it is invisible from the requirement and would surface as a build failure
  mid-execution.

- **D-14:** **The uncached lookup must be a second `NologClient` constructed with `cache: "no-store"` — not an
  un-`cache()`-wrapped export off the existing singleton.** `ARCHITECTURE.md` §1 offered both as equivalent
  options and pointed at `getUnemailedPublicPosts()` as the precedent. `09-RESEARCH.md` found that option
  wrong: `apps/web/src/lib/notion.ts:8-16` bakes
  `fetchOptions: { next: { revalidate: CONFIG.revalidate, tags: [...] } }` into the **constructor**, so every
  call through that instance carries the 180s Data Cache entry regardless of whether React's `cache()` wrapper
  is present. Removing the wrapper strips only React's per-render memoization; the fetch still reads the very
  cache this phase exists to bypass. **Following the documented precedent would have shipped the bug unfixed
  while every check passed.** — **Reversibility:** reversible.

### IMG-02 — verify the premise before building against it

- **D-08:** **Reproduce IMG-02 before fixing it.** The ROADMAP frames both IMG-01 and IMG-02 as "cached HTML
  carries an expired presigned URL". That mechanism is confirmed for the home page — `/` serves
  `x-vercel-cache: PRERENDER` with `Revalidate 3m / Expire 1y`, so idle prerendered HTML can hold a dead URL
  indefinitely. **It is not confirmed for the post page:** Phase 8 measured `/post/[id]` as `ƒ (Dynamic)` with
  `cache-control: private, no-cache, no-store` and `x-vercel-cache: MISS` on every request. No page HTML is
  cached there, so any staleness must come from `getPost`'s Data Cache entry (`next: { revalidate: 180 }`) —
  a different mechanism with a 3-minute lifetime, not an hour. Measure what actually happens on a post page
  before writing a fix whose justification assumes otherwise.

  **Why this is worth the time.** Three plausible, specific, code-or-doc-derived premises have been overturned
  by measurement in this milestone already: `getPost` throws (it does not), an empty Notion page returns one
  block key (it returns three), `/post/[id]` is ISR-cached (it is dynamic). This is the fourth candidate and
  it comes from the same source as the third.

  The fix itself is applied to all four surfaces regardless (D-01), so IMG-02 is covered either way — what the
  measurement decides is what IMG-02's verification criterion should say, and whether the ROADMAP's stated
  mechanism for it needs correcting.

  **⚠ Resolved 2026-08-10 by `09-RESEARCH.md` — IMG-02 is real, but by a different mechanism than either
  document said.** `/post/[id]` is dynamic because it has **no `generateStaticParams`**, not because of any
  dynamic API. That only means the *page HTML* is uncached. The `getPost(id)` call inside it — the one that
  produces `post.thumbnail` — still lands in Next's **Data Cache** under the constructor-baked
  `next: { revalidate: 180 }`, and the Data Cache uses the same lazy stale-while-revalidate model as ISR: on a
  low-traffic site an entry can sit far past its `revalidate` window because nothing proactively refreshes it.
  So a post page can serve a presigned URL older than an hour.

  **Corrections this makes to inherited documents, both worth carrying forward:**
  `ARCHITECTURE.md` §1 blamed the Full Route Cache for both pages — right for `/`, wrong for `/post/[id]`.
  And Phase 8's measurement, which is what raised the doubt, never actually bore on this: it measured
  `getPageRecordMap`, which uses `ofetch` and is structurally absent from the Data Cache — a different fetch
  from `getPost` entirely.

  **Confidence is MEDIUM, not HIGH.** This is inferred from documented Data Cache behaviour, not measured.
  D-08's live check therefore still runs, now with a specific thing to look for: whether a post page's
  thumbnail URL can be observed older than the presign lifetime. Recorded as an open question rather than
  promoted to fact.

### Failure state (IMG-04)

- **D-09:** A failed thumbnail shows the **existing `bg-surface` grey box plus a centred image icon** from
  `lucide-react` (already a dependency — no new package, D-07 of REQUIREMENTS.md). All four surfaces already
  wrap the image in a `bg-surface` div, so half of IMG-04 exists today; the icon is what turns a blank grey
  rectangle into something a reader reads as "no image" rather than "still loading". No caption text: the
  96px card has no room for it, and copy would raise a default-language question this milestone has no reason
  to open.
- **D-10:** Failure is detected **client-side via `next/image`'s `onError`**, not by a server-side pre-check.
  `onError` covers every path by which a reader actually fails to see an image — proxy failure, optimizer
  failure, a dropped connection — including failures that happen after render, which a server check
  structurally cannot see. A server-side probe would also add a network call per render, which is
  `PITFALLS.md` Pitfall 4's "silently becomes dynamic" trap. Accepted cost: the thumbnail component (or a thin
  inner part of it) must be a Client Component.

### Verification

- **D-11:** **Verify after the fix only — one idle window, not two.** Proving the bug and then proving the fix
  would need two separate >1h untouched windows and cost most of a day. The bug's first-hand evidence already
  exists: the operator experienced it as a user (blank thumbnails, fine after a manual refresh), and that
  report is what put this milestone's IMG requirements on the roadmap. So the window is spent on the claim
  that actually needs proving.
- **D-12:** Verification follows `PITFALLS.md` 13 and 14 without shortcuts: an idle gap longer than Notion's
  ~1h presign lifetime with no visits, then a cold-cache load; and the check reads the **raw origin URL from
  the page source**, not the `/_next/image?...` wrapper — Next 16's image optimizer has its own 4-hour cache
  floor that can independently mask the result. `next dev` proves nothing here (PITFALLS 12).
- **D-13:** Do **not** simulate expiry by hand-constructing a stale presigned URL instead of waiting. It is
  faster and it is precisely the substitute PITFALLS 13 warns against — there is no guarantee the synthetic
  case exercises the same path as a genuinely idle one.

### Claude's Discretion

- The route path and the shape of its identifier parameter.
- The shared component's name and file location, and how much of it is the client boundary.
- The exact `s-maxage` value and whether `stale-while-revalidate` accompanies it.
- The icon chosen from `lucide-react` and its size at each of the two card shapes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The specification for this fix
- `.planning/research/ARCHITECTURE.md` §1 — the proxy-resolution pattern, described as fully specified.
  `SUMMARY.md` marks this phase "standard patterns, skip research-phase" on the strength of it.
- `.planning/research/PITFALLS.md` — **Pitfall 1** (never accept a caller-supplied URL; allowlist hostnames;
  `redirect: "error"`; assert `content-type` starts with `image/`), **Pitfall 2** (`unoptimized` is not the
  fix), **Pitfall 3** (shortening `revalidate` is not the fix), **Pitfall 4** (do not add a per-request live
  call and silently make the page dynamic), **Pitfall 12** (`next dev` proves nothing), **Pitfall 13** (the
  idle-gap procedure), **Pitfall 14** (check the raw origin URL, not `/_next/image`).

### Requirements and scope
- `.planning/REQUIREMENTS.md` — IMG-01 … IMG-05; locked D-05 (`packages/core` and the `Post` type must not
  change) and D-07 (no new dependencies, no new infrastructure); the Out of Scope table, which rules out
  `unoptimized` and shortening `CONFIG.revalidate` **as fixes**, and excludes the `terminal` template.
- `.planning/ROADMAP.md` §"Phase 9" — the five success criteria and the note that the redirect-vs-stream
  choice is a planning decision (settled here as D-05).

### Measurements this phase inherits — do not re-derive
- `.planning/phases/08-content-rendering-fix/08-CACHE-EVIDENCE.md` — the measured route classifications:
  `/post/[id]` is `ƒ (Dynamic)`, `cache-control: private, no-cache, no-store`, `x-vercel-cache: MISS` always;
  `/` is `PRERENDER`, `Revalidate 3m / Expire 1y`. **D-08 rests entirely on this.**
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-EVIDENCE.md` — the milestone's worked
  example of capturing live production evidence, and the six-candidate discipline behind it.

### Code under change
- `apps/web/src/templates/default/HomePage.tsx:38-46`, `SearchPage.tsx:56-64`, `CategoryPage.tsx:52-60` —
  the three byte-identical 96px card blocks.
- `apps/web/src/templates/default/PostPage.tsx:86-94` — the `aspect-video` hero, carries `priority`.
- `apps/web/next.config.ts` — `images.remotePatterns` already allowlists `s3.us-west-2.amazonaws.com` and
  `prod-files-secure.s3.us-west-2.amazonaws.com`. IMG-03's host allowlist must match this exactly.
- `packages/core/src/types.ts:16-28` — `Post.thumbnail` and `Post.thumbnailType`. **Read-only** (D-05).
- `apps/web/src/app/api/notify-subscribers/route.ts:67-121` — the email path's existing file-vs-external
  handling. **Not modified** (D-04), but read it before touching `thumbnailType` semantics anywhere.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Post.thumbnailType`** — shipped in v1.0 precisely so a consumer can tell an expiring Notion file URL from
  a stable pasted one. IMG-05's branch already has its signal; nothing in `packages/core` needs to change.
- **`bg-surface` wrappers** — all four surfaces already render the image inside a surfaced div, so IMG-04
  starts from a grey box rather than an empty one.
- **The existing secret-gated route precedents** (`api/subscribe`, `api/notify-subscribers`) — established
  shapes for a route handler's validation-first posture, even though this route needs no secret.
- **`lucide-react`** — already a dependency; D-09's icon needs no new package.
- **`next.config.ts` `remotePatterns`** — the allowlist IMG-03 must mirror already exists and is the single
  source of truth for it.

### Established Patterns
- Reader-facing fallback copy in this repo is unlocalized English — relevant to D-09's choice of an icon over
  a caption.
- `next/image` with `fill` + a sized wrapper is the established idiom at all four sites.
- No test infrastructure exists and none may be added; verification is source assertions, `next build`,
  ESLint, and deployed-site observation.

### Integration Points
- One new route under `apps/web/src/app/api/`.
- One new shared component under `apps/web/src/components/`.
- Four call sites in `templates/default/`.
- **File-disjoint from Phases 7 and 8** — this phase touches none of `post/[id]/page.tsx`, `lib/notion-x.ts`,
  or `lib/post-availability.ts`. It **does** touch `templates/default/PostPage.tsx`, which Phase 8 edited, but
  a different region of it (the hero image, not the content-fallback branch).
- **Phase 10 overlap warning:** Phase 10 reworks `templates/default/Layout.tsx` and the grid. It does not own
  the card internals this phase consolidates, but both phases live in `templates/default/`. D-02's extraction
  is sequenced first partly to reduce that collision.

### Non-obvious findings from this discussion
1. **Four surfaces, not two.** The ROADMAP's file list for this phase named `HomePage.tsx` and `PostPage.tsx`;
   `SearchPage.tsx` and `CategoryPage.tsx` carry byte-identical thumbnail blocks and appear in no requirement.
2. **IMG-02's stated mechanism does not match the measured route.** See D-08.
3. **The email digest already works around this bug** by dropping Notion-hosted thumbnails entirely
   (`notify-subscribers/route.ts:120`, the `downgraded` path). A stable proxy URL would make that workaround
   unnecessary — deferred, not taken (D-04).

</code_context>

<specifics>
## Specific Ideas

- The failure state should read as "there is no image here", not as "something is still loading" — that is the
  distinction the icon buys over a bare grey rectangle.
- The proxy should be boring: one identifier in, image bytes out, three guards, a long cache header. Every
  extra capability it grows is allowlist rot (PITFALLS 1's closing warning).
- Consolidating the three identical card blocks should read in the diff as a de-duplication, not as a redesign
  — the rendered output for a working thumbnail should be unchanged.

</specifics>

<deferred>
## Deferred Ideas

- **Using the proxy URL in the email digest** so Notion-hosted thumbnails stop being dropped from outbound
  mail (`notify-subscribers/route.ts`'s `downgraded` path). Real and tempting; out of scope here because no
  requirement covers it and email clients proxy and cache images on their own terms, so it needs separate
  verification (D-04).
- **`terminal` template parity** for the thumbnail fix — TMPL-F01, out of scope this milestone (D-03).
- **A caption on the failure placeholder** — declined for space and to avoid opening the fork template's
  default-language question (D-09).
- **Switching the proxy to a 307 redirect** if the byte cost ever matters — would need the Vercel image
  optimizer's redirect-following behaviour verified against this deployment first (D-05).
- **Adding a new IMG requirement for search/category** — the fix covers them (D-01); formalising them in
  REQUIREMENTS.md was considered and skipped to avoid editing milestone planning documents mid-flight.

</deferred>

---

*Phase: 9-Thumbnail Freshness*
*Context gathered: 2026-08-10*
