# Requirements: NoLog — Milestone v1.1 "Live Blog Bug Fixes & Reading Width"

**Defined:** 2026-08-09
**Core Value:** A forker can go from "empty Notion database" to "live, working blog" using only Notion + Vercel + GitHub — no infrastructure to provision, no service to babysit, and every optional feature stays inert until its env vars are explicitly set.

**Scope note:** This is a defect-repair + UX milestone against the live deployment (https://4lph4-bl0g.vercel.app), not a feature milestone. Requirements are derived from three operator-reported defects plus `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY, 2026-08-09).

## Locked Decisions

Decisions made at requirement-scoping time. Downstream planning must not re-litigate these.

| # | Decision | Rationale |
|---|----------|-----------|
| D-01 | Keep the unofficial `notion-client` + `react-notion-x` rendering path. Do NOT rewrite against the official `@notionhq/client` blocks API. | Operator's explicit choice. Research (STACK.md) found `react-notion-x` is actively maintained (repo pushed 2026-08-08) and the leading root-cause candidate is fixable on the installed version with no upgrade. |
| D-02 | Sidebar auto-collapse uses **Option A** semantics: per-side state is `null \| true \| false`. While `null` (user has never toggled that side), the panel follows the viewport threshold on every resize. The first toggle click writes an explicit preference that viewport changes no longer override. Only the explicit preference is persisted to `localStorage` — never the transient auto-state. | The three stated requirements ("auto-collapse below a threshold", "persists in localStorage", "each side independent") are individually true under three competing designs (FEATURES.md Options A/B/C). Only A avoids the resize-fights-the-user failure mode documented in GitLab issues #27340/#378544/#580565. Option B was explicitly recommended against by research. |
| D-03 | Auto-collapse threshold is **provisionally 1280px**, to be confirmed by measuring the real rendered content-column width at 1024 / 1152 / 1280 / 1366 during the sidebar phase's planning step. | Derived from this layout's own pixel budget (`--sidebar-width: 200px`, `--profile-width: 240px`, `--max-content-width: 1400px` in `globals.css:41-43`), not a generic industry midpoint. The grid's side tracks are fixed-pixel, so the effective content width changes non-linearly with viewport. |
| D-04 | Sidebars **push**, they do not overlay. Collapsing a side returns its width to the center column. | An overlay does not widen `<main>`, so it would not solve the milestone's actual complaint. The existing grid (`fixed | fixed | 1fr`) already reflows correctly for push with no rewrite. |
| D-05 | The thumbnail fix must NOT change the `Post` type in `packages/core`. | `@4lph4/nolog-core` is a published npm package; a `Post` shape change is a breaking change for other forkers. `Post.thumbnailType` (shipped v1.0) already carries the file-vs-external signal the fix needs. |
| D-06 | `apps/web/src/templates/default/Layout.tsx` stays a Server Component. Sidebar client state is introduced via a client wrapper receiving server-rendered content as children/props. | `SubscribeSection` gates on the SECRET `RESEND_API_KEY` and is rendered directly inside `Layout.tsx`. A naive `"use client"` on `Layout.tsx` moves that gate into client code, where the non-`NEXT_PUBLIC_*` var is `undefined`, silently disabling the subscribe form for every configured forker. The repo already has the correct precedent (`subscribeSlot` children-as-prop, `post/[id]/page.tsx:94`). |
| D-07 | No new npm dependencies and no new infrastructure. | Project's standing hard constraint. Research confirmed all three fixes are achievable with installed versions. |
| D-08 | Root cause of the content-rendering failure must be established from **live production evidence** (actual status code + response body) before a fix is locked in. | The repo's own recorded process lesson from v1.0 (the CR-01 revert-then-refix cycle) is that diagnosing from internal code consistency instead of the live external system costs a full round trip. The `User-Agent`/#710 hypothesis is MEDIUM confidence, not established fact. |

## v1.1 Requirements

### Content Rendering (CONT)

- [x] **CONT-01**: Operator can tell, from production logs, which of the three data fetches in `post/[id]/page.tsx` (`getPageRecordMap`, `getCategories`, related-posts `getPosts`) actually failed — the current single combined try/catch reports all three identically and makes diagnosis impossible
- [x] **CONT-02**: Operator has captured the real failure evidence from the deployed site (HTTP status + response body from the failing call), sufficient to discriminate among the candidate causes in `PITFALLS.md` — **closed 2026-08-09**, see `phases/07-*/07-EVIDENCE.md`: 403 + `text/html` Cloudflare page captured against Production `dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz`, six-candidate table judged, verdict named (candidate 2, User-Agent)
- [x] **CONT-03**: Reader sees the post's Notion content rendered on first visit, for every post published to the web — the "Content could not be loaded." fallback no longer appears for a healthy post — **closed 2026-08-10 on the deployed site.** Root cause was Cloudflare answering `notion-client`'s default `user-agent: node` with 403 (Phase 7 evidence); the fix sets an honest self-identifying User-Agent via `ofetchOptions`. Verified across all three public posts over four passes spanning ~9 minutes — see `phases/08-*/08-CACHE-EVIDENCE.md`. Note: `/post/[id]` is a dynamic route, so SC#1's literal "ISR regeneration" wording is unsatisfiable and is recorded as met-in-substance, not claimed.
- [x] **CONT-04**: A failure to load categories or related posts no longer prevents the post body from rendering — **closed 2026-08-10.** Implemented in Phase 7 (per-concern catch decomposition) and its live half observed in Phase 8 under D-15: a forced chrome-leg throw left the body rendering at HTTP 200 with exactly one `[PostPage:chrome]` line and zero `[PostPage:recordMap]` lines (`phases/07-*/07-UAT.md` Test 1). The earlier `[~]` downgrade is resolved — it was correct while the observation was missing.
- [x] **CONT-05**: Reader sees distinct wording for "this post has no content yet" versus "the content could not be fetched" — the two states are no longer collapsed into one message

### Thumbnail Freshness (IMG)

- [x] **IMG-01**: Reader sees home-feed post thumbnails on their first page load, with no manual refresh, including after the site has sat idle longer than Notion's presigned-URL lifetime
- [x] **IMG-02**: Reader sees the post detail page's hero thumbnail under the same conditions as IMG-01
- [x] **IMG-03**: The image path accepts only a Notion page identifier and resolves the file URL server-side — it never accepts an arbitrary URL from the client, and rejects any resolved host outside the allowlist already declared in `next.config.ts`
- [x] **IMG-04**: Reader sees a proper placeholder instead of an empty box when a thumbnail genuinely fails to load
- [x] **IMG-05**: Posts whose thumbnail is an external (non-Notion-hosted) URL continue to render exactly as they do today, without passing through the new resolution path

### Sidebar Collapse (SIDE)

- [x] **SIDE-01**: Reader can collapse and expand the left sidebar (search + categories) using a hamburger (three-line) button
- [ ] **SIDE-02**: Reader can collapse and expand the right sidebar (profile + subscribe) using a circular button showing the site owner's profile image
- [ ] **SIDE-03**: Reader can collapse one sidebar while leaving the other expanded — the two sides are independent
- [x] **SIDE-04**: The article column visibly widens to reclaim the freed space when a sidebar collapses
- [x] **SIDE-05**: Before the reader has ever used a toggle, both sidebars collapse automatically below the threshold width and expand automatically above it, updating live as the window is resized
- [x] **SIDE-06**: Once the reader clicks a toggle, that side's state persists across page navigation and return visits, and subsequent window resizes no longer override it (D-02)
- [x] **SIDE-07**: Reader never sees the wrong sidebar state flash on first paint before the persisted state is applied
- [x] **SIDE-08**: A persisted desktop sidebar preference has no effect on the mobile layout (< 768px), which has no sidebars to collapse
- [ ] **SIDE-09**: The avatar toggle carries a visual cue (badge or ring) marking it as a show/hide control rather than an account menu
- [x] **SIDE-10**: A forker with the Resend env vars set still sees and can use the subscribe form after the sidebar change (regression guard for D-06)

### Sidebar Accessibility (A11Y)

- [x] **A11Y-01**: Both toggle buttons expose their state via `aria-expanded` and point at the panel they control via `aria-controls`
- [ ] **A11Y-02**: A collapsed sidebar is removed from the accessibility tree, so screen-reader and keyboard users cannot tab into content that is not visible
- [ ] **A11Y-03**: Keyboard focus is never stranded — if a panel collapses while focus is inside it, focus moves to that panel's toggle button
- [x] **A11Y-04**: The collapse transition is disabled for readers who have set `prefers-reduced-motion: reduce`
- [ ] **A11Y-05**: The avatar toggle has an action-phrased accessible name (e.g. "Show profile sidebar") distinct from the Profile card's own avatar `alt` text, plus a matching hover tooltip following `ThemeToggle.tsx`'s existing `title` convention

## v2 Requirements

Deferred to a future release. Tracked but not in this roadmap.

### Sidebar

- **SIDE-F01**: Reset-to-auto affordance that clears an explicit override and returns a side to viewport-driven behavior
- **SIDE-F02**: Third "icon rail" collapse state between fully open and fully hidden
- **SIDE-F03**: Drag-to-resize sidebars

### Content Rendering

- **CONT-F01**: Manual retry control on a content-fetch failure
- **CONT-F02**: Cache/revalidation wrapper for `getPageRecordMap()` matching the ISR treatment `lib/notion.ts` gives the official-API calls (research found `notion-client` uses `ofetch`, not Next's patched `fetch`, so it cannot use `next: {revalidate, tags}` — this needs its own design pass)

### Template Parity

- **TMPL-F01**: Bring the `terminal` template to parity with whatever the `default` template gains this milestone

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Rewriting post rendering against the official `@notionhq/client` blocks API | D-01 — operator's explicit choice; would require hand-building a full block renderer |
| The `terminal` template | Active template is `default` (`site.config.ts:11`); terminal changes would double the surface with no live user |
| Validating the dynamic route segment before it reaches the Notion API URL in `post/[id]/page.tsx` | Known open security item carried from v1.0. Explicitly offered at scoping and declined by the operator to keep this milestone at three items. Still tracked in `PROJECT.md`. |
| RSS feed (`/feed.xml`) | Carried from v1.0's deferred list; unrelated to these defects |
| Adding a test framework | Carried from v1.0's deferred list; a separate, larger undertaking |
| Hardening the pre-existing fail-open patterns (empty-string env defaults, silent catch-alls, pagination gap) | Carried from v1.0; unrelated to these defects, except where `post/[id]/page.tsx`'s combined catch is directly implicated (CONT-01) |
| `unoptimized` on `next/image` as the thumbnail fix | PITFALLS.md — the bug is URL staleness, not optimizer incompatibility; this would ship full-resolution Notion originals to every visitor |
| Shortening `CONFIG.revalidate` as the thumbnail fix | PITFALLS.md — ISR regeneration is request-triggered, not timer-driven, so this does not fix the idle-gap case and risks Notion rate limits |
| Any new infrastructure (Vercel KV, Redis, CDN worker, cookie store) | D-07 / standing project constraint |
| New npm dependencies | D-07 — research confirmed none are needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONT-01 | Phase 7 | Complete |
| CONT-02 | Phase 7 | Complete |
| CONT-03 | Phase 8 | Complete |
| CONT-04 | Phase 7 | Complete |
| CONT-05 | Phase 8 | Complete |
| IMG-01 | Phase 9 | Complete |
| IMG-02 | Phase 9 | Complete |
| IMG-03 | Phase 9 | Complete |
| IMG-04 | Phase 9 | Complete |
| IMG-05 | Phase 9 | Complete |
| SIDE-01 | Phase 10 | Complete |
| SIDE-02 | Phase 10 | Pending |
| SIDE-03 | Phase 10 | Pending |
| SIDE-04 | Phase 10 | Complete |
| SIDE-05 | Phase 10 | Complete |
| SIDE-06 | Phase 10 | Complete |
| SIDE-07 | Phase 10 | Complete |
| SIDE-08 | Phase 10 | Complete |
| SIDE-09 | Phase 10 | Pending |
| SIDE-10 | Phase 10 | Complete |
| A11Y-01 | Phase 10 | Complete |
| A11Y-02 | Phase 10 | Pending |
| A11Y-03 | Phase 10 | Pending |
| A11Y-04 | Phase 10 | Complete |
| A11Y-05 | Phase 10 | Pending |

**Coverage:**

- v1.1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0
- No requirement is mapped to more than one phase.

Per-phase totals: Phase 7 → 3 (CONT-01/02/04), Phase 8 → 2 (CONT-03/05), Phase 9 → 5 (IMG-01…05), Phase 10 → 15 (SIDE-01…10, A11Y-01…05).

**Phase-boundary note (D-08):** CONT-01/CONT-02 sit in Phase 7 and CONT-03 sits in Phase 8 deliberately — Phase 8 cannot be planned until Phase 7's live production evidence exists. CONT-04 is mapped to Phase 7 rather than Phase 8 because the try/catch decomposition that satisfies CONT-01 is the same code change that satisfies CONT-04.

## Verification Notes

Carried from `PITFALLS.md` — two of the three defects reproduce **only on the deployed site**, so these constrain how any of the above can be marked complete:

- `next dev` has no ISR. A local pass proves nothing for IMG-01/IMG-02 or CONT-03.
- Testing immediately after a deploy gives false confidence: the cache is freshly warm and the expired-presigned-URL path is not yet reachable. IMG-01 verification requires an idle gap exceeding Notion's ~1h presign lifetime, then a reload.
- Browser cache can mask an unfixed image bug — verify with a cold cache.
- CONT-02 requires reading the actual Vercel production logs, not reasoning from code.

---
*Requirements defined: 2026-08-09*
*Last updated: 2026-08-09 after roadmap creation (Phases 7-10)*
