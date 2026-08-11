# Roadmap: NoLog

## Milestones

- ✅ **v1.0 Email Subscription for New Posts** — Phases 1-6 (shipped 2026-07-29)
- 🚧 **v1.1 Live Blog Bug Fixes & Reading Width** — Phases 7-10 (in progress)

## Overview

v1.1 is a defect-repair milestone against the live deployment (https://4lph4-bl0g.vercel.app), plus one UX feature. Two of the three defects reproduce **only on the deployed site** — `next dev` has no ISR — so this milestone's phases are shaped as much by *how a fix can be proven* as by what code changes. The content-rendering defect is split across two phases on purpose: its root cause is a MEDIUM-confidence hypothesis, not a fact, and the repo's own v1.0 process lesson (the CR-01 revert-then-refix cycle) is that diagnosing from code consistency instead of the live system costs a full round trip. Phase 7 exists to make the failure legible in production and capture the evidence; only then does Phase 8 lock a fix. Thumbnail freshness (Phase 9) and collapsible sidebars (Phase 10) follow, each file-disjoint from everything before it.

## Phases

<details>
<summary>✅ v1.0 Email Subscription for New Posts (Phases 1-6) — SHIPPED 2026-07-29</summary>

- [x] Phase 1: Notion Data Layer (2/2 plans) — completed 2026-07-25
- [x] Phase 2: Backfill Script (2/2 plans) — completed 2026-07-26
- [x] Phase 3: Subscribe Path (6/6 plans) — completed 2026-07-27
- [x] Phase 4: Notify Route (3/3 plans) — completed 2026-07-27
- [x] Phase 5: Production Cutover (2/2 plans) — completed 2026-07-29
- [x] Phase 6: Documentation (2/2 plans) — completed 2026-07-29

Full phase goals, success criteria, and plan-level detail archived to [`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md).

</details>

### 🚧 v1.1 Live Blog Bug Fixes & Reading Width (In Progress)

**Milestone Goal:** Fix the image and body-content rendering that is actually broken on the deployed blog, and give readers direct control over the content column's width.

- [x] **Phase 7: Content Failure Isolation & Live Diagnosis** - Make the post-detail failure legible in production and stop chrome failures from blanking the body (completed 2026-08-11)
- [x] **Phase 8: Content Rendering Fix** - Published posts render their Notion body on first visit, against the cause Phase 7 actually observed (completed 2026-08-11)
- [ ] **Phase 9: Thumbnail Freshness** - Thumbnails load on a first, cold visit no matter how long the site sat idle
- [ ] **Phase 10: Collapsible Sidebars & Reading Width** - Readers collapse either sidebar independently and reclaim the width for the article

## Phase Details

### Phase 7: Content Failure Isolation & Live Diagnosis

**Goal**: The operator can tell, from production logs, exactly which call in the post-detail render failed — and a failure in the page's chrome no longer blanks the post body
**Depends on**: Nothing (first phase of v1.1)
**Requirements**: CONT-01, CONT-02, CONT-04
**Success Criteria** (what must be TRUE):

  1. For a real failing request on the deployed site, a Vercel production log line names which one of the three fetches failed — `getPageRecordMap`, `getCategories`, or the related-posts `getPosts` — and the operator can point at exactly one of them. The three legs are no longer reported by one identical line.
  2. The operator holds captured live evidence from production (the failing call's actual HTTP status plus a response-body excerpt), recorded against `PITFALLS.md`'s six-candidate discriminating table with a named verdict — or an explicit "matches none of the six." A local `next dev` run does not satisfy this.
  3. On the deployed site, a post whose categories or related-posts fetch fails still renders its body. The body no longer disappears because of a chrome-level failure.
  4. A post that exists and is public never responds 404 or a full error page as a result of a content-fetch failure — `notFound()` is still reached only for a genuinely missing/non-public post, and no fetch leg is left to throw uncaught out of the render.

**Plans**: 3/3 plans complete

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Gated deep diagnostics + secret-gated `/api/diagnose-page` route (tracer), then the per-leg catch decomposition of `post/[id]/page.tsx` (SC#1, SC#3)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — App-level genuine-404-vs-transient discriminator + the `PostUnavailable` state, scoping `notFound()` (SC#4)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — Operator-driven live Production capture into `07-EVIDENCE.md`: six-candidate table filled, raw log lines pasted, named verdict (SC#2)

Notes for planning:

- Decompose by *concern*, not by call (PITFALLS 6): one catch for `recordMap` (content), one for `categories`+`relatedPosts` (chrome). Neither leg may be left to throw into `error.tsx` — whether a thrown Server Component error during ISR regeneration falls back to stale HTML or surfaces as a 500 is an **unverified open question** on this Next 16 / Vercel Fluid Compute setup.
- CONT-04 lands here rather than in Phase 8 because the try/catch decomposition *is* its fix — the same code change that makes the failure legible also isolates the blast radius. This phase may therefore resolve the reported symptom outright, if the real failing leg turns out to be categories or related posts. That outcome is a legitimate result of this phase, not a scope leak.
- Open questions to settle with a live check, not a code read: is `NOTION_TOKEN_V2` actually set in Production (`vercel env ls`)? Does the failing page load logged-out in an incognito tab?

### Phase 8: Content Rendering Fix

**Goal**: Every post the operator has published to the web renders its Notion body on a reader's first visit to the deployed site
**Depends on**: Phase 7 — **evidence gate.** Phase 7's CONT-02 evidence must exist and be verified before this phase is planned. Its fix shape is not decidable before then, and planning it earlier would bake the unverified react-notion-x #710 / `User-Agent` hypothesis into a PLAN.md — exactly the CR-01 failure mode D-08 exists to prevent.
**Requirements**: CONT-03, CONT-05
**Success Criteria** (what must be TRUE):

  1. On the deployed site, every post published to the web renders its Notion body on a cold first visit — verified across multiple posts and repeated over several requests spanning at least one genuine ISR regeneration, not one lucky load shortly after a deploy.
  2. The root cause the shipped fix targets is the one Phase 7's live evidence identified. If that evidence contradicted the #710 / `User-Agent` hypothesis, the fix reflects the evidence.
  3. A reader on a post whose Notion page genuinely has no content sees wording saying so, visibly distinct from the wording shown when the fetch failed. The two states are no longer the same sentence.
  4. The post still renders through `notion-client` + `react-notion-x` (D-01) — no renderer was rebuilt against the official blocks API, and no new npm dependency was added (D-07).

**Plans**: 4/4 plans complete

Plans:
**Wave 1**

- [x] 08-01-PLAN.md — The single-deploy code change: the `User-Agent` fix via `ofetchOptions` (tracer), the D-19 teardown of every diagnosis-only surface, and the CONT-05 split into two distinct sentences. Committed, deliberately unpushed.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 08-02-PLAN.md — Close or explicitly carry forward the `[ASSUMED]` emptiness heuristic by observing a real content-empty public Notion page through the production `getPage()` path (CONT-05)
- [x] 08-03-PLAN.md — Run and record Phase 7's two outstanding UAT tests, now unambiguous because the body renders again (D-15, closes 07-UAT.md)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 08-04-PLAN.md — The single push/deploy (D-14), then the deployed-site sign-off: the 3-request `x-vercel-cache` procedure across multiple posts (SC#1) plus D-19 production confirmation

Notes for planning:

- PITFALLS 15: a page cached from before the fix deployed will keep rendering regardless of whether anything was fixed. Force a real regeneration and repeat the check across several requests/minutes before calling it verified.
- `getPageRecordMap()` uses `ofetch`, not Next's patched `fetch` — it structurally cannot take `next: { revalidate, tags }`. Any caching treatment here is React `cache()` plus an explicit Data Cache wrapper, and the exact stable primitive in Next 16.2.4 must be checked directly, not assumed.

### Phase 9: Thumbnail Freshness

**Goal**: Readers see post thumbnails on their first load of the deployed site, however long it sat idle beforehand
**Depends on**: Nothing technically — file-disjoint from Phases 7-8 (verified in `research/ARCHITECTURE.md`). Sequenced after the content work by user impact, not by a build dependency.
**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05
**Success Criteria** (what must be TRUE):

  1. On the deployed site, after the home page has sat un-visited for longer than Notion's ~1h presign lifetime, a first load in a cold/incognito browser shows every thumbnail. The "blank, then fine after a manual refresh" sequence no longer occurs.
  2. The same idle-gap-then-cold-load check passes for a post detail page's hero thumbnail.
  3. A request to the thumbnail path is refused with a non-200 when it carries anything other than a Notion page identifier, when the resolved host falls outside the allowlist already declared in `next.config.ts`, when the origin answers with a redirect, or when the content type is not `image/*`.
  4. A post whose thumbnail genuinely fails to resolve shows a visible placeholder, not an empty box.
  5. A post whose thumbnail is an external (non-Notion-hosted) URL renders exactly as it does today, and its image request does not travel through the new resolution path.

**Plans**: 3/4 plans executed (09-04 added as gap closure for UAT gap G-09-1)

Plans:
**Wave 1**

- [x] 09-01-PLAN.md — The whole fix: local `Post` type field, the streaming proxy route with its four guards (tracer), then the rollout to all four `default` surfaces through one shared component, closed by the Tier 1 gate sweep (IMG-01…IMG-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 09-02-PLAN.md — Everything that costs no waiting: controlled-origin probes for the redirect and content-type guards, the deploy, the deployed guard battery, the placeholder observation, then the idle clock starts (IMG-03, IMG-04, IMG-05)

**Wave 3** *(blocked on Wave 2 completion — separated by the >1h idle window itself)*

- [x] 09-03-PLAN.md — The one idle window: the cold first request after the gap, the direct proxy-path check that the optimizer cannot mask, and the honest IMG-02 finding (IMG-01, IMG-02)

**Wave 4** *(gap closure — blocked on Wave 3; the idle window is already spent, so a redeploy costs nothing)*

- [ ] 09-04-PLAN.md — G-09-1: split the thumbnail client boundary so `post.thumbnail` never crosses it, then re-measure the served HTML until the presigned-URL count in the RSC payload is 0 where 09-02 measured 3 and 1 (IMG-01, IMG-02, IMG-04, IMG-05)

Notes for planning:

- Verification constraint (PITFALLS 12/13/14): `next dev` cannot reproduce this bug and testing minutes after a deploy cannot either — a fresh deploy has an empty ISR cache and a brand-new presign. Verification must follow PITFALLS 13's idle-gap procedure, and must check the **raw origin S3 URL** from page source, not the `/_next/image?...` wrapper, because the optimizer's own cache floor is 4h in Next 16 and can independently mask the result.
- **Planning correction to the line above (09-03-PLAN.md carries the full reasoning):** after the fix there *is* no raw S3 URL in page source — removing it is the fix. The pitfall's intent translates to requesting the **proxy path directly**, outside the optimizer; the optimizer's 4h floor spans the ~70-minute window and would otherwise replay pre-window bytes. The browser view is corroboration, not proof.
- **The tier ordering is structural, not advisory.** All the cheap evidence (source assertions, the deployed guard battery, the placeholder, the "no expiring URL is embedded any more" check) is collected in waves 1-2 *before* the clock starts, because any request during the window destroys it. That is why 09-02 and 09-03 are separate waves.
- Ruled out as fixes, per REQUIREMENTS.md Out of Scope: `unoptimized` on `next/image`, and shortening `CONFIG.revalidate`.
- D-05: `packages/core` and the `Post` type must not change. `Post.thumbnailType` (shipped v1.0) already carries the file-vs-external signal, so this is entirely additive `apps/web` work.
- Real implementation choice to settle in planning: 307-redirect vs. stream the bytes. Research recommends streaming unless redirect is explicitly verified against this deployment.
- Research flag: SUMMARY.md marks this phase "standard patterns, skip research-phase" — the proxy-resolution pattern is fully specified in `research/ARCHITECTURE.md` §1.

### Phase 10: Collapsible Sidebars & Reading Width

**Goal**: Readers control how wide the article column is on every `default`-template page, with the subscribe form intact and the whole thing usable by keyboard and screen reader
**Depends on**: Nothing technically — file-disjoint from Phases 7-9. Sequenced last because it is the only non-defect work in the milestone and carries the largest, most novel file surface.
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08, SIDE-09, SIDE-10, A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05
**Success Criteria** (what must be TRUE):

  1. A reader can collapse and expand each sidebar independently — a hamburger button for the left (search + categories), a circular profile-image button carrying a show/hide visual cue for the right (profile + subscribe) — and the article column visibly widens each time a side collapses.
  2. Before the reader has ever touched a toggle, both sidebars follow the viewport threshold live as the window is resized. After the first toggle click on a side, that side keeps the reader's choice across page navigation and return visits and further resizes no longer override it, with no wrong-state flash on first paint and no effect on the `< 768px` mobile layout.
  3. A forker with `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` set still sees the subscribe form and can successfully submit it after the change; `templates/default/Layout.tsx` is still a Server Component and no `NEXT_PUBLIC_RESEND_*` variable appears anywhere in the diff. **(Stop-ship: D-06 / SIDE-10. A diff that fails this ships a silently-disabled subscribe form to every configured forker.)**
  4. A keyboard-and-screen-reader user can operate both toggles: each reports its state via `aria-expanded` and names its panel via `aria-controls`; a collapsed sidebar is unreachable by Tab and absent from the accessibility tree; focus moves to the controlling toggle when a panel collapses while focus is inside it, whether the collapse came from a click or from a resize; and the avatar toggle announces an action ("Show profile sidebar"), distinct from the Profile card's own avatar `alt` text, with a matching `title` tooltip.
  5. A reader with `prefers-reduced-motion: reduce` gets an instant collapse with no transition, every other reader gets a smooth one, and both sidebars still stick on scroll after the transition ships.

**Plans**: TBD
**UI hint**: yes

Notes for planning:

- **D-03 threshold measurement is a planning-step activity inside this phase, not a separate phase.** Measure the real rendered content-column width at 1024 / 1152 / 1280 / 1366 before locking the provisional 1280px. The grid's side tracks are fixed-pixel, so effective content width changes non-linearly with viewport.
- D-02 (Option A: per-side state is `null | true | false`; only the explicit preference is persisted) is the single state model for this whole phase. It is not separable from the collapse mechanism — building a boolean model first and retrofitting the tri-state would mean designing it twice. This is why SIDE-05/06/07 are not split into a follow-on phase.
- The a11y requirements are likewise not a follow-on phase: `aria-expanded`/`aria-controls`, tree removal, focus handling and reduced-motion all live inside the same components and the same transition CSS. Shipping an inaccessible version first would be pure rework.
- Architecture is A+B+C+D composed, not a pick-one menu (`research/ARCHITECTURE.md` §3): client wrapper receiving server-rendered slots, `data-*` attributes on `<html>`, CSS custom-property overrides, blocking pre-hydration script alongside the existing `next-themes` setup.
- PITFALLS 9/10 are delayed-onset CSS traps: animating `transform`/`overflow` on an ancestor silently breaks the existing `sticky top-8` asides, and `grid-template-columns` routed through an unregistered custom property snaps instead of transitioning.

## Ordering Rationale

The three defects are **file-disjoint** — `research/ARCHITECTURE.md` verified this directly rather than assuming it. Fix 1 touches `templates/default/HomePage.tsx` + `PostPage.tsx` + a new `api/thumbnail/[id]/route.ts`; Fix 2 touches `app/post/[id]/page.tsx` + `lib/notion-x.ts`; Fix 3 touches `templates/default/Layout.tsx` + `app/layout.tsx` + `globals.css` + new `components/layout/*`. (The two "PostPage" names are different files and not a conflict.) So there is **no hard technical blocking between Phases 7/8, 9, and 10.** Ordering is driven by risk and user impact:

1. **Phase 7 first** — it is the only phase whose output is knowledge rather than code shape. Doing it first surfaces unknowns before any later scope is locked, and the highest-severity symptom ("Content could not be loaded.") lives here.
2. **Phase 8 immediately after, gated on Phase 7's evidence.** This is the one real dependency in the milestone, and it is deliberate: the gate is the phase boundary, not developer discipline. Precedent: v1.0 kept Phase 5 (Production Cutover) as its own phase for exactly this reason — to enforce backfill-before-cron ordering structurally.
3. **Phase 9 third.** Root cause and fix shape are already fully specified; it is mechanical, high-confidence, and depends on nothing Phase 7 discovers.
4. **Phase 10 last.** Zero technical dependency on anything before it, but it is new UX rather than a correctness fix, and it is the only work touching `Layout.tsx` / `app/layout.tsx` this milestone — sequencing it last means nothing else competes for review attention on those files.

**Where the operator could parallelize:** Phase 9 is safely concurrent with Phases 7-8 (zero shared files), and Phase 10 is concurrent with all of them. Phase 8 is the only one that must wait.

**One non-obvious caution if parallelizing:** every deploy invalidates the whole ISR cache. Phase 9's verification needs an uninterrupted idle gap of >1h on the deployed site, and Phase 7's evidence capture needs a real failing request against a cache that has not just been warmed. A deploy from one phase resets the other's verification window. If these run in parallel, batch the deploys and start the idle clock after the last one — otherwise the two phases will keep resetting each other and neither will produce trustworthy evidence.

## Progress

**Execution Order:** Phases execute in numeric order: 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Notion Data Layer | v1.0 | 2/2 | Complete | 2026-07-25 |
| 2. Backfill Script | v1.0 | 2/2 | Complete | 2026-07-26 |
| 3. Subscribe Path | v1.0 | 6/6 | Complete | 2026-07-27 |
| 4. Notify Route | v1.0 | 3/3 | Complete | 2026-07-27 |
| 5. Production Cutover | v1.0 | 2/2 | Complete | 2026-07-29 |
| 6. Documentation | v1.0 | 2/2 | Complete | 2026-07-29 |
| 7. Content Failure Isolation & Live Diagnosis | v1.1 | 3/3 | Complete   | 2026-08-11 |
| 8. Content Rendering Fix | v1.1 | 4/4 | Complete   | 2026-08-11 |
| 9. Thumbnail Freshness | v1.1 | 3/3 | In Progress|  |
| 10. Collapsible Sidebars & Reading Width | v1.1 | 0/TBD | Not started | - |

## Requirement Coverage (v1.1)

| Phase | Requirements | Count |
|-------|--------------|-------|
| 7 | CONT-01, CONT-02, CONT-04 | 3 |
| 8 | CONT-03, CONT-05 | 2 |
| 9 | IMG-01, IMG-02, IMG-03, IMG-04, IMG-05 | 5 |
| 10 | SIDE-01…SIDE-10, A11Y-01…A11Y-05 | 15 |
| **Total** | | **25 / 25** |

No orphans, no requirement mapped to more than one phase.

---
*Roadmap for v1.1 created: 2026-08-09*
