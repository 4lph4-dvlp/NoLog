# Phase 9: Thumbnail Freshness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 9-Thumbnail Freshness
**Areas discussed:** Scope (four surfaces vs two), Redirect vs streaming, Whether IMG-02 is a real bug, Failure placeholder

---

## Scouting done before the discussion (it changed what was worth asking)

Two facts were established before any question was put:

1. **The bug lives in four places, not two.** `post.thumbnail` is rendered through `next/image` at
   `templates/default/HomePage.tsx:41`, `SearchPage.tsx:59`, `CategoryPage.tsx:55` and `PostPage.tsx:89`. The
   first three are byte-identical 96px card blocks. IMG-01 names the home feed and IMG-02 the post detail;
   search and category appear in **no requirement**. The ROADMAP's own file list for this phase named only
   `HomePage.tsx` and `PostPage.tsx`.
2. **IMG-02's stated mechanism does not match the measured route.** The ROADMAP frames both IMG-01 and IMG-02
   as "cached HTML carries an expired presigned URL". Phase 8 measured `/post/[id]` as `ƒ (Dynamic)` with
   `cache-control: private, no-cache, no-store` — no page HTML is cached there at all, while `/` is
   `PRERENDER` with `Expire 1y`.

A third, smaller find surfaced during the same scan and became its own question: the email digest
(`api/notify-subscribers/route.ts:120`) already works around this bug by dropping Notion-hosted thumbnails
from outbound mail entirely.

---

## Scope — four surfaces vs two

### Q1 — Which surfaces get the fix

| Option | Description | Selected |
|--------|-------------|----------|
| All four | Same resolution path everywhere; the three card blocks are already identical so the marginal cost is near zero; a reader cannot be told why only search results have broken thumbnails | ✓ |
| The two the requirements name | Cleanest scope, smallest verification surface; forks three identical blocks into two versions and leaves the defect live on two pages | |
| All four **plus** a new IMG-06 | Most precise traceability; means editing REQUIREMENTS.md and ROADMAP mid-milestone | |

**User's choice:** All four.

### Q2 — De-duplication

| Option | Description | Selected |
|--------|-------------|----------|
| Extract a shared component | Resolution path, placeholder and external-URL branch land in one place; sequencing it before Phase 10 reworks the same directory reduces collision | ✓ |
| Edit each file in place | Smallest diff, easiest review; the same change made four times, and four places to find next time | |
| Share the logic only, keep the JSX | Middle ground — removes logic duplication, preserves the 96px-vs-hero markup difference | |

**User's choice:** Extract a shared component.

### Q3 — The email digest

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it alone this phase | No requirement covers mail thumbnails; email clients proxy and cache images on their own terms, so it needs its own verification rather than riding on the site's | ✓ |
| Fix it too | A stable proxy URL would end the `downgraded` workaround; efficient to do while the path is fresh | |
| Decide after the proxy is verified | Defers the call to when redirect-vs-stream is settled | |

**User's choice:** Leave it alone; captured as a deferred idea.

---

## Redirect vs streaming

### Q1 — How the route returns the image

| Option | Description | Selected |
|--------|-------------|----------|
| Stream the bytes | Behaviour is certain; keeps PITFALLS 1's three guards (`redirect: "error"`, host allowlist, `content-type`) enforceable in one place; matches research's recommendation absent a verified redirect | ✓ |
| 307 redirect | Near-zero function cost; depends on the Vercel image optimizer following a 3xx from an allowlisted origin, which is unverified — if it does not, every thumbnail breaks | |
| Measure first, then choose | Consistent with this milestone's habit; but measuring requires building and deploying the route anyway | |

**User's choice:** Stream the bytes.

### Q2 — Caching the proxy response

| Option | Description | Selected |
|--------|-------------|----------|
| Long `s-maxage` + `immutable` | CDN holds the bytes so the function runs ~once per image; this is what makes streaming's egress cost acceptable rather than theoretical | ✓ |
| Defaults, no header | Simple; the Next image optimizer's own 4h cache absorbs some of it, then every request runs the function again | |
| Leave it to the planner | Cache lifetime is arguably an implementation detail; but PITFALLS 14 warns that cache layers mask verification, so the layer count is worth fixing now | |

**User's choice:** Long `s-maxage` + `immutable`.

---

## Whether IMG-02 is a real bug

### Q1 — Verify the premise or build against it

| Option | Description | Selected |
|--------|-------------|----------|
| Reproduce before fixing | The ROADMAP's mechanism for IMG-02 does not match the measured route; three premises have already been overturned by measurement this milestone, and this one comes from the same source as the third | ✓ |
| Just fix it alongside | The four-surface fix covers IMG-02 regardless; fast and harmless — but leaves no grounds for saying it was fixed, and no clear verification criterion | |
| Fix first, measure after | Ships sooner; after the fix the original symptom is unobservable, so it stays unknown permanently | |

**User's choice:** Reproduce before fixing.

### Q2 — How many idle windows

| Option | Description | Selected |
|--------|-------------|----------|
| One, after the fix | The bug's first-hand evidence already exists — the operator experienced it as a user, which is what put IMG-01 on the roadmap. Spend the window on the claim that needs proving | ✓ |
| Two — before and after | Most rigorous, mirrors Phase 7's treatment of the recordMap bug; costs 2h+ of untouched site | |
| Synthesise an expired URL instead of waiting | Fast; exactly the substitute PITFALLS 13 warns against, with no guarantee it exercises the same path | |

**User's choice:** One window, after the fix.

---

## Failure placeholder (IMG-04)

### Q1 — What a failed thumbnail shows

| Option | Description | Selected |
|--------|-------------|----------|
| Grey box + icon | Keeps the existing `bg-surface`, adds a centred `lucide-react` icon (already a dependency); turns a blank rectangle into something read as "no image" rather than "still loading" | ✓ |
| The existing grey box is enough | Zero additional work; arguable whether an empty grey rectangle satisfies IMG-04's "proper placeholder" | |
| Icon plus caption | Most explicit; no room in a 96px card, and new copy opens a default-language question | |

**User's choice:** Grey box + icon.

### Q2 — Where failure is detected

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side `onError` | Covers every path by which a reader actually fails to see an image, including failures after render; costs a client boundary on the thumbnail | ✓ |
| Server-side pre-check | No client code; adds a network call per render (PITFALLS 4's dynamic-drift trap) and cannot see post-render failures | |
| Both | Most thorough; keeps two paths and inherits the server check's drawbacks | |

**User's choice:** Client-side `onError`.

---

## Claude's Discretion

- The route path and the shape of its identifier parameter.
- The shared component's name, location, and how much of it sits inside the client boundary.
- The exact `s-maxage` value and whether `stale-while-revalidate` accompanies it.
- The `lucide-react` icon and its size at each card shape.

## Deferred Ideas

- Using the proxy URL in the email digest so Notion-hosted thumbnails stop being dropped from mail.
- `terminal` template parity (TMPL-F01).
- A caption on the failure placeholder.
- Switching to a 307 redirect if byte cost ever matters — requires verifying the optimizer follows redirects.
- Formalising search/category coverage as a new IMG requirement.

**Scope creep redirected:** one item — the email digest fix — was raised, judged genuinely tempting, and
declined with a reason rather than absorbed.
