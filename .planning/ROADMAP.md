# Roadmap: NoLog

## Milestones

- ✅ **v1.0 Email Subscription for New Posts** — Phases 1-6 (shipped 2026-07-29)
- ✅ **v1.1 Live Blog Bug Fixes & Reading Width** — Phases 7-10 (shipped 2026-08-14)
- 🔜 **Next milestone** — not yet scoped. Run `/gsd-new-milestone`.

## Phases

<details>
<summary>✅ v1.0 Email Subscription for New Posts (Phases 1-6) — SHIPPED 2026-07-29</summary>

- [x] Phase 1: Notion Data Layer (2/2 plans) — completed 2026-07-25
- [x] Phase 2: Backfill Script (2/2 plans) — completed 2026-07-26
- [x] Phase 3: Subscribe Path (6/6 plans) — completed 2026-07-27
- [x] Phase 4: Notify Route (3/3 plans) — completed 2026-07-27
- [x] Phase 5: Production Cutover (2/2 plans) — completed 2026-07-29
- [x] Phase 6: Documentation (2/2 plans) — completed 2026-07-29

Full phase goals, success criteria, and plan-level detail archived to
[`milestones/v1.0-ROADMAP.md`](milestones/v1.0-ROADMAP.md).
Requirements archived to [`milestones/v1.0-REQUIREMENTS.md`](milestones/v1.0-REQUIREMENTS.md).

</details>

<details>
<summary>✅ v1.1 Live Blog Bug Fixes & Reading Width (Phases 7-10) — SHIPPED 2026-08-14</summary>

- [x] Phase 7: Content Failure Isolation & Live Diagnosis (3/3 plans) — completed 2026-08-11
- [x] Phase 8: Content Rendering Fix (4/4 plans) — completed 2026-08-11
- [x] Phase 9: Thumbnail Freshness (4/4 plans) — completed 2026-08-12
- [x] Phase 10: Collapsible Sidebars & Reading Width (4/4 plans) — completed 2026-08-14

**Shipped:** post bodies render on first visit (root cause: Cloudflare answering `notion-client`'s
default `user-agent: node` with a 403 — established from captured production evidence before any fix
was written); home-feed and hero thumbnails survive an arbitrarily long idle gap via a server-side
proxy route that resolves Notion's ~1h presigned URL per request; and readers collapse either sidebar
independently to reclaim the article column's width, keyboard- and screen-reader-operable throughout.

**Audit:** 25/25 requirements satisfied, cross-phase integration passed, 0 functional blockers.
Status `tech_debt` for documentation debt only — see
[`milestones/v1.1-MILESTONE-AUDIT.md`](milestones/v1.1-MILESTONE-AUDIT.md).

Full phase goals, success criteria, and plan-level detail archived to
[`milestones/v1.1-ROADMAP.md`](milestones/v1.1-ROADMAP.md).
Requirements archived to [`milestones/v1.1-REQUIREMENTS.md`](milestones/v1.1-REQUIREMENTS.md).

</details>

## Next Milestone

Not yet scoped. `.planning/REQUIREMENTS.md` is intentionally absent — `/gsd-new-milestone` creates a
fresh one as part of its questioning → research → requirements → roadmap flow.

Carried forward as candidates (from `TODOS.md`, v2 requirement sections, and the v1.1 audit):

- **RSS feed (`/feed.xml`)** — a second, zero-infra notification channel. Deferred from both v1.0 and v1.1.
- **On-site "new post" indicator/badge** for return visitors.
- **Sidebar v2** — reset-to-auto affordance (SIDE-F01), icon-rail third collapse state (SIDE-F02),
  drag-to-resize (SIDE-F03).
- **`terminal` template parity** (TMPL-F01) with everything the `default` template gained in v1.1.
- **Content-rendering v2** — a manual retry control on a content-fetch failure (CONT-F01), and a
  cache/revalidation wrapper for `getPageRecordMap()` (CONT-F02, needs its own design pass since
  `notion-client` uses `ofetch`, not Next's patched `fetch`).
- **Test framework** — the repo still has zero test infrastructure by explicit constraint. Every phase
  so far verified by source assertion, `next build`, ESLint, and browser observation.
- **Pre-existing fail-open hardening** — empty-string env var defaults, silent catch-alls, a pagination
  gap in `NologClient`. Carried since v1.0.
- **Unvalidated dynamic route segment** interpolated into the Notion API URL in
  `app/post/[id]/page.tsx` — a known open security item, explicitly deferred twice.

Open from the v1.1 audit (non-blocking):

- Reconcile the four `status: draft` VALIDATION.md files with `/gsd-validate-phase`. Phase 10's
  `nyquist_compliant: false` is deliberate and should stay false until its two accepted-but-unobserved
  items are genuinely observed.
- Re-check Phase 10's E7 (wide table / code block at the 1100px cap) and SC#5 (home-page sticky at
  depth) once the blog has qualifying content.
- Refresh the codebase map — a drift advisory has been firing since Phase 10 planning.
