# Feature Research: Collapsible Sidebars + Failure-State UX

**Domain:** Content/blog reading UI — collapsible side panels, remote-image failure states, remote-content failure states
**Milestone:** v1.1 Live Blog Bug Fixes & Reading Width
**Researched:** 2026-08-09
**Confidence:** MEDIUM (cross-checked web sources: MDN, W3C WAI-ARIA APG, Docusaurus/GitLab/GitHub issue trackers, UX-pattern write-ups; no single-source claims treated as settled — see per-item confidence below. No official Anthropic/framework doc-server access was available in this run, so nothing here is HIGH/"vendor-verified"; treat as strong community consensus, not spec.)

Existing code inspected: `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/templates/default/PostPage.tsx`, `apps/web/src/templates/default/HomePage.tsx`, `apps/web/src/components/Profile.tsx`, `apps/web/src/components/CategoryList.tsx`, `apps/web/src/components/ThemeToggle.tsx`, `apps/web/src/app/globals.css`.

---

## Part 1 — Item 3: Collapsible Left/Right Sidebars

### How well-regarded sites do this (what was actually checked)

- **Docusaurus** (docs-site reference): collapsible sidebar toggle lives outside/adjacent to the sidebar, not inside it, so it stays reachable when the panel is hidden. Docusaurus shipped a dedicated fix for sidebar-collapse animation under `prefers-reduced-motion` (facebook/docusaurus PR #8971), confirming this is a real, previously-missed a11y gap in a widely-used product, not a hypothetical.
- **Notion, Linear, Slack** (as cited by the off-canvas pattern literature reviewed): use the **push** pattern for their primary sidebar — the sidebar is persistent navigation, so hiding it should reflow the content into the freed space, not float a temporary layer over it.
- **Figma / map/canvas tools**: use **overlay** for side panels, because their content area must never involuntarily resize (canvas coordinates matter).
- **GitLab** (via public issue tracker, `gitlab-org/gitlab-foss#27340`, `gitlab-org/gitlab#378544`, `gitlab-org/gitlab#580565`): real, filed bugs about sidebar-collapse state — "sidebar remains invisible when loading a narrow viewport, then expands unexpectedly," and explicit maintainer pushback that "persisting a setting the user didn't explicitly set is problematic." This is the closest thing to documented industry consensus on the auto-collapse-vs-manual-override question, and it directly supports treating viewport-driven collapse and user-driven collapse as two different pieces of state (see below).
- **W3C WAI-ARIA Authoring Practices Guide** (APG) — Disclosure pattern: the correct ARIA pattern class for a collapsible region toggle (as opposed to tabs, dialogs, or menus).
- **MDN** — `prefers-reduced-motion`, `aria-expanded` reference pages, confirming the attribute/media-query mechanics independent of any one vendor's implementation.

### Toggle affordance

| Behavior | Table stakes / Differentiator | Notes |
|---|---|---|
| Toggle button is **pinned outside the collapsing region**, at a fixed position regardless of panel state | Table stakes | If the button lives inside the sidebar, it disappears when collapsed and the panel becomes unrecoverable without a page reload. Docusaurus and every push-drawer implementation reviewed keep the toggle external. For NoLog, the natural pinned position is the same fixed/sticky header row that already hosts `ThemeToggle` (`Layout.tsx:22`, `top-4 right-4` / `top-6 right-4`), not inside `<aside>`. |
| Toggle **icon/state changes** to reflect open vs. collapsed (e.g., hamburger ↔ X, or chevron direction flip) | Table stakes | A toggle that looks identical in both states forces the user to test it to learn the current state. `ThemeToggle.tsx` already models this correctly (Sun ↔ Moon swap tied to `resolvedTheme`) — the sidebar toggles should follow the same swapped-icon pattern, not a single static icon. |
| Hit target ≥ 40×40px (WCAG 2.5.5 / 2.5.8 target-size guidance, commonly cited alongside these patterns) | Table stakes | `ThemeToggle.tsx` currently uses `p-2` around an 18px icon — effectively ~34px box. Match or exceed that for the new toggles; a circular avatar toggle especially needs a generous hit area since users will misjudge a small circle's clickable bounds. |
| Layout reflows the content column smoothly when a panel collapses (push, not layout jump) | Table stakes | `Layout.tsx:41` currently uses a fixed 3-column CSS grid (`grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)]`). Collapsing a column must animate the grid-template-columns (or a wrapper width) rather than snapping, or it reads as a layout bug, not a feature. |
| Transition duration ~150–250ms ease | Differentiator (but expected once you have a transition at all) | `globals.css` already defines `--transition-fast: 150ms ease` and `--transition-base: 200ms ease` — reuse these tokens instead of inventing new timing values, both for consistency and because `ThemeToggle`/hover states already train the user's eye to that pacing. |
| Toggle remains visible/functional while the panel is mid-transition (not disabled during animation) | Differentiator | Prevents "double-click did nothing" complaints from users who click again mid-animation. |

### Auto-collapse behavior — the central ambiguity (per the question's framing)

This is the part of the milestone's stated design that is genuinely underspecified, and the research confirms it's a known, filed, argued-about problem elsewhere (GitLab, wekan), not a solved one. There is no single universal convention; there are competing conventions with real tradeoffs. Enumerated:

**Option A — "Auto-collapse is ephemeral, manual choice is sticky" (most-supported by the sources reviewed)**
- Maintain two separate pieces of state per side: (1) an **explicit user preference**, set only when the user clicks the toggle, persisted to `localStorage`; and (2) the **effective rendered state**, computed as `userPreference ?? (viewportWidth < threshold ? collapsed : expanded)`.
- If the user never touches the toggle, the panel purely follows the viewport threshold on every resize — collapses below it, expands above it, with no memory required.
- The moment the user clicks the toggle, that becomes the new fixed preference and viewport changes stop overriding it, until the user clicks again (or, optionally, explicitly "resets to auto").
- This matches the GitLab maintainer position found in research ("persisting a setting the user didn't explicitly set is problematic") and avoids the "site fights the user" failure mode (user expands sidebar on a wide screen, resizes narrower, and it snaps back closed against their expressed intent — or the reverse, it won't collapse when they explicitly asked it to on a screen that's still nominally "wide").
- Tradeoff: needs 3 logical states per side (unset/auto, explicit-open, explicit-closed), not a plain boolean, so persistence and default-render logic are slightly more code than a naive boolean flag.

**Option B — "Last rendered state always wins, viewport included" (simple boolean, most common naive implementation)**
- Persist a single `collapsed: boolean` per side. Every resize event that crosses the threshold overwrites it.
- Simple to build, but reproduces exactly the GitLab-documented bug class: a user who manually opens the sidebar on a wide monitor, then resizes the browser (not even to mobile — just narrower), loses their choice silently, and if they resize back up, the site does not restore what they explicitly asked for, because the boolean was already overwritten by the transient resize.
- **Do not use this** for a milestone whose whole premise is "give readers direct control" — it produces control that evaporates on the first resize.

**Option C — "Manual choice always wins, even below threshold" (never auto-override an explicit choice)**
- If the user explicitly expands a sidebar, keep it expanded even when the window is later resized under the threshold, potentially squeezing the content column exactly as badly as the current unfixed bug.
- This is the literal, maximal interpretation of "respect the user's explicit choice," but it defeats the auto-collapse requirement's actual purpose (protecting reading width on small viewports) and risks reproducing the very problem this milestone exists to fix, if the user's last action before shrinking the window was "expand."
- Reasonable **only** with a floor: fall back to forced-collapsed below a hard minimum (e.g., mobile breakpoint `md`, 768px) regardless of preference, since below that width there is no 3-column grid at all today (`Layout.tsx:27` mobile branch is a single column) — so this scenario is moot on true mobile, only relevant in the "narrow desktop window" band between ~768–1280px.

**Recommendation for requirement-scoping:** Option A (ephemeral auto state + sticky explicit override, `null | true | false` per side) is the pattern actually supported by both the general sidebar-collapse literature reviewed and the specific GitLab bug reports found. It is also the only option that satisfies all three stated requirements simultaneously ("auto-collapse below threshold" + "persists in localStorage" + reads as intentional, not flaky) without contradiction. Flag for requirement-scoping: **the milestone context's own three bullets don't actually resolve which of A/B/C is intended** — "auto-collapse below a threshold" and "state persists via localStorage" are individually true statements under all three options; only Option A avoids them contradicting each other in the return-to-wide-screen / resize-below-threshold-after-manual-expand cases described in the question. This needs an explicit decision, not an inferred one.

**Threshold value found in research vs. this project's own proposed value:** general UX literature reviewed cites icon-rail collapse commonly starting around 768–1024px and full off-canvas below 768px — but that's for admin/app sidebars with an icon-only intermediate state, which NoLog's design doesn't have (design is binary open/collapsed, not open/icon-rail/closed). NoLog's own `PROJECT.md` already proposes 1280px based on its own grid-width math (232px effective content column at `md`/768px is unusably narrow) — that project-specific, math-derived number is more trustworthy here than a generic industry midpoint, since it's derived from this exact layout's actual pixel budget (`--sidebar-width: 200px`, `--profile-width: 240px`, `--max-content-width: 1400px`, all in `globals.css:41-43`). Flag: **confirm 1280px (or whatever value is chosen) against the real rendered content-column width at a few in-between viewport sizes (1024, 1152, 1280, 1366) before locking it, since the grid math changes as `--sidebar-width`/`--profile-width` are fixed pixel tracks, not fractional.**

### Persistence

| Behavior | Category | Notes |
|---|---|---|
| Persist **per-side** state independently (left ≠ right key) | Table stakes | Matches the milestone's own explicit requirement ("each collapses independently"). Two separate `localStorage` keys (e.g. `nolog:sidebar:left`, `nolog:sidebar:right`), not one combined key — simpler to reason about and matches `ThemeToggle`'s existing single-concern-per-key pattern (next-themes owns its own key). |
| Persist **only the explicit user choice**, not the auto-collapsed transient state | Table stakes (given Option A above) | Prevents the resize-driven state from ever being written to storage and later misread as "the user chose this." |
| Do **not** apply persisted desktop sidebar state on mobile viewports (< `md`, 768px) | Table stakes | Mobile today has no sidebars at all — it's a single stacked column (`Layout.tsx:27-38`). There is nothing to collapse/expand on mobile in the current design, so a persisted preference must not leak in and hide/show elements that don't exist in that layout. This also matches the general finding that "separate states for mobile and desktop viewports" is standard practice. |
| Guard `localStorage` access for SSR/hydration, matching the existing `mounted` guard pattern | Table stakes, dependency-bound | `ThemeToggle.tsx` already solves exactly this problem (`useState(false)` + `useEffect` + placeholder render) to avoid hydration mismatches from client-only state. The sidebar toggle state should reuse that same guard shape, not reinvent it, since a naive `localStorage.getItem` at render time will crash or mismatch during SSR. |
| Reset-to-auto affordance (a way to clear the explicit override and return to viewport-driven behavior) | Differentiator, not required for MVP | Nice for a "site felt broken, how do I fix it" support case, but adds UI surface (a third control or long-press) the milestone didn't ask for. Defer unless a real complaint shows up. |

### Accessibility table stakes

All of the following are standard, not optional, per W3C APG's Disclosure pattern and MDN's `aria-expanded` reference — cross-checked across two independent authoritative sources, so treat this whole block as solid:

- **`aria-expanded="true"|"false"`** on the toggle `<button>`, reflecting current state, updated synchronously with the click handler (not after an animation completes).
- **`aria-controls="<id-of-the-aside>"`** on the toggle, pointing at the sidebar's `id`. (APG notes this is only strictly optional when the toggle is immediately, visually adjacent to the controlled region in DOM order — NoLog's toggle will live in the header, not adjacent to the `<aside>`, so `aria-controls` should be included, not omitted.)
- **Real `<button>` element**, not a clickable `<div>`, for keyboard operability (Enter/Space) and role semantics for free — matches the existing `ThemeToggle.tsx` implementation already using `<button>`.
- **Focus is not lost** when a panel collapses. If the collapsed panel currently holds keyboard focus (e.g., user was tabbing through `SearchBar`/`CategoryList` and then triggers collapse via a different control, or an auto-collapse fires from resize while focus is inside), focus must move to a sane place (typically the toggle button itself) rather than to `<body>` or nowhere.
- **Collapsed panel is removed from the accessibility tree**, not just visually hidden — i.e. use conditional rendering / `hidden` attribute / `inert`, not just `opacity:0`/`width:0` with content still present. Otherwise screen-reader and keyboard-tab users can navigate into content that's invisible on screen, which is a worse experience than not having the feature. (`Layout.tsx` already partially demonstrates awareness of this contrast: the mobile branch uses `md:hidden` and desktop branch uses `hidden md:block` — genuinely removing the other from layout via Tailwind's `hidden` utility rather than just visual truncation. The same discipline needs to extend to the new collapse states.)
- **`prefers-reduced-motion: reduce`** disables/shortens the collapse transition. Concretely: `@media (prefers-reduced-motion: reduce) { /* collapse-transition rule */ { transition: none } }`. This is not a hypothetical nice-to-have — Docusaurus shipped a real fix for missing this exact behavior (PR #8971), meaning even well-resourced, accessibility-conscious projects ship this gap first and patch it later. Build it in from the start rather than as a follow-up.

### Overlay vs push — which fits NoLog

- **Recommendation: push**, not overlay, for both sidebars, at the widths where sidebars are relevant (≥ 768px `md` breakpoint, where the 3-column grid already exists). Rationale, grounded in the research: the push/overlay split found in the literature maps to "is the panel primary navigation the user treats as part of the page, or a temporary modal layer over content." NoLog's sidebars (search, categories, profile, subscribe) are exactly the former — persistent, page-scoped chrome, not a temporary drawer — matching the Notion/Linear/Slack push examples, not the Figma/canvas overlay examples.
- Push is also mechanically the *right* fix for the milestone's actual complaint ("the reading column is too narrow") — an overlay by definition does not return the freed width to the content column, it just hides the panel behind/above it, so overlay would not solve the stated problem. Push is the only one of the two patterns that widens `<main>` when a sidebar collapses.
- Below `md` (768px), current mobile layout is a single stacked column with no sidebars at all — the push/overlay question doesn't apply there, since collapsing further isn't meaningful when the page is already one column.
- Implementation note (dependency-bound): `Layout.tsx:41`'s desktop grid uses **fixed-pixel tracks** for the two side columns (`var(--sidebar-width)` = 200px, `var(--profile-width)` = 240px) and `1fr` for `<main>`. This is actually convenient for push: collapsing a side column to `0` (or removing its track) lets the `1fr` center column absorb the freed space automatically via CSS grid's own reflow, with a `grid-template-columns` transition — no manual width math needed in JS.

### The circular-profile-image toggle specifically

Honest finding: **no established pattern search surfaced an avatar being used as a sidebar show/hide toggle.** This appears to be an atypical choice, not a known convention with prior art. What was found and is directly relevant:

- The nearly-universal meaning of a circular avatar/profile-photo button across web software (documented broadly in profile/menu-design UX writing, though not a single canonical citation) is **"open my account/profile menu,"** not "show/hide a layout panel." A returning user who clicks it expecting an account dropdown and instead sees the sidebar toggle will be confused at least once.
- This is compounded here because NoLog's right sidebar's actual content (once expanded) *is* a `Profile` component (`Profile.tsx`) showing that same avatar again, name, bio, and social links — so the interaction reads as "click my own photo to... reveal a card about myself," which is a slightly circular (pun acknowledged) but not incoherent mapping, since the toggle and the thing it reveals are thematically the same entity. That partially mitigates the "this looks like an account menu" risk, because there's no separate "account" concept anywhere in NoLog (it's a single-owner blog, not a multi-user app) — so there's no competing "account menu" the user could confuse it with. This is a meaningfully different context than, e.g., a SaaS app header where an avatar reliably means "your account."
- Given the user has already locked this as the chosen direction, treat it as **table stakes to execute well, not a decision to relitigate** — but the mitigations below are close to mandatory to avoid it reading as broken:
  - **`aria-label` must describe the action, not the image** — e.g. `aria-label="Show profile sidebar"` / `"Hide profile sidebar"`, not `aria-label={profile.name}` (which `Profile.tsx`'s own avatar `alt` currently uses, `alt={profile.name}`, appropriately, for the *content* image — but the *toggle* button needs its own distinct, action-phrased label, not a copy of that).
  - **A visible tooltip/`title` on hover/focus**, same pattern `ThemeToggle.tsx` already uses (`title={isDark ? "..." : "..."}`) — reuse that exact convention for consistency and because it's the cheapest disambiguation available.
  - **A small state-indicating visual cue on the button itself** (e.g., a chevron badge overlaid on the avatar edge, or a colored ring when open vs. closed) so the icon alone hints "toggle," not "portrait." This is a differentiator, not table stakes, but meaningfully reduces first-click confusion versus a bare circular photo with no affordance cue at all.
  - **Consistent visual language with the left hamburger toggle** — same size, same fixed position on the opposite side, same hover/focus treatment — so the pair reads as "two matching controls," reinforcing "these are toggles" through symmetry even though their icons differ.

---

## Part 2 — Items 1 & 2: Failure-State UX (brief, since these are defect repairs)

These are single-correct-outcome bugs (image loads; content renders), but both currently have **no graceful degradation** on the failure path, which the research says is itself a gap worth closing as part of the fix, not scope creep:

| Behavior | Category | Notes / dependency |
|---|---|---|
| Home-feed thumbnails and post hero images show a **skeleton/blur placeholder** while loading, not a blank space | Table stakes | Applies to `HomePage.tsx:38-47` (24×24 grid thumbnails) and `PostPage.tsx:83-93` (hero image). Both already use `next/image`'s `fill` mode inside a sized wrapper (`relative w-24 h-24` / `relative w-full aspect-video`) — good foundation, since the wrapper already reserves layout space (no CLS risk), it just currently shows nothing until the image resolves. |
| **`onError` fallback**, not a silent blank box, when the remote (Notion presigned S3) URL genuinely fails/expires | Table stakes | Directly relevant to the root cause named in `PROJECT.md` (presigned URLs expiring under ISR stale-while-revalidate). Even after the root cause is fixed, a URL can still occasionally fail (network blip, Notion outage) — an `onError`-driven fallback (placeholder icon or blurred last-good state) is the standard, not an edge case to skip. |
| Distinguish **"no content"** from **"fetch failed"** in the post-body failure text | Table stakes | Current text (`PostPage.tsx:100`, `"Content could not be loaded."`) is a single undifferentiated string for both cases, and per `PROJECT.md`'s own noted secondary issue, the same catch swallows `getPageRecordMap`, `getCategories`, and `getPosts` failures identically. A reader seeing "could not be loaded" on a post that genuinely has no body content (a title-only post) gets an alarming error message for a non-error state — table-stakes fix is to at minimum branch the copy (empty vs. failed), even before any retry mechanic is added. |
| Retry affordance (button, or automatic ISR-driven retry messaging) on content-fetch failure | Differentiator | Not required to consider the bug "fixed" — the milestone's bar is "content renders instead of the fallback text," i.e., fixing the root cause removes the need for the fallback to be seen at all in the common case. A manual retry button is a reasonable differentiator if the team wants defense-in-depth, but it's new UI surface beyond "repair the defect," so treat as optional/P2. |
| Do **not** silently retry-loop or auto-refresh the page to "fix" a failed load | Anti-feature | Auto-refresh-on-failure is a common instinct (mirrors "well it works after a manual refresh") but masks the underlying bug with client-side thrashing, can create refresh loops on a persistently-broken URL, and contradicts the milestone's own stated goal of fixing root cause rather than working around symptoms. |

---

## Feature Dependencies

```
Sidebar collapse (per-side state) ──requires──> Fixed toggle position outside <aside> (Layout.tsx header row)
Sidebar collapse (per-side state) ──requires──> aria-expanded/aria-controls wiring on toggle <button>
Sidebar collapse (localStorage persistence) ──requires──> mounted-guard SSR pattern (already proven in ThemeToggle.tsx)
Auto-collapse threshold ──requires──> resolved content-column width math at threshold (own grid vars in globals.css)
Push-not-overlay layout ──requires──> Layout.tsx's existing CSS grid (fixed side tracks + 1fr main) — no rewrite needed, just animatable tracks
Circular avatar toggle mitigations (aria-label, tooltip, visual cue) ──requires──> Profile.tsx avatar markup as the base to extend, not replace
Image failure fallback (item 1) ──unrelated-to──> Sidebar work (different files: HomePage.tsx/PostPage.tsx/next/image vs. Layout.tsx)
Content failure differentiation (item 2) ──unrelated-to──> Sidebar work (different files: post/[id]/page.tsx vs. Layout.tsx)
```

### Dependency Notes

- **Sidebar collapse requires the mounted-guard SSR pattern:** any `localStorage`-backed React state needs the same `useState(false)` + `useEffect` + placeholder-render trick `ThemeToggle.tsx` already uses, or the new toggles will hydration-mismatch exactly the way `ThemeToggle` was written specifically to avoid. This is a direct, in-repo precedent to follow, not a new pattern to invent.
- **Push layout requires no structural rewrite:** `Layout.tsx`'s desktop grid (`grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)]`) already has the right shape for push-style collapse — this lowers the complexity estimate for that sub-feature from "redesign the layout" to "animate/conditionally-render existing grid tracks."
- **Items 1 and 2 are independent of item 3 and of each other** — different files, different root causes (presigned URL lifecycle vs. `getPageRecordMap()` failure vs. a UI layout feature). No sequencing constraint between them; they can be built/verified in any order or in parallel.

---

## MVP Definition

### Launch With (v1.1, this milestone)

- [ ] Home-feed and post-hero images render correctly on first load (item 1 — root-cause fix, not a workaround)
- [ ] Post body renders Notion content on first load (item 2 — root-cause fix, keeping `react-notion-x`/unofficial API per the locked decision)
- [ ] Left sidebar (hamburger) and right sidebar (circular avatar) each independently toggle open/collapsed
- [ ] Both toggles are pinned outside their `<aside>`, with icon/visual state reflecting open vs. collapsed
- [ ] Content column visibly widens (push, animated) when either sidebar collapses
- [ ] Auto-collapse below the chosen width threshold (1280px proposed, to be confirmed against real rendered widths)
- [ ] Explicit user toggle clicks persist per-side in `localStorage`, and take precedence over auto-collapse on subsequent renders at the same or narrower width (Option A semantics — **needs explicit confirmation as a locked decision, not inferred**)
- [ ] `aria-expanded`/`aria-controls` on both toggles; collapsed panels removed from the a11y tree; focus doesn't strand in a collapsed panel
- [ ] Transition respects `prefers-reduced-motion`
- [ ] Avatar toggle has an action-phrased `aria-label` and hover tooltip distinct from the Profile card's own avatar `alt` text

### Add After Validation (v1.x)

- [ ] Reset-to-auto affordance for sidebar state (only if users report the persisted-forever behavior as confusing)
- [ ] Distinct copy for "post has no content" vs. "content fetch failed" (worth doing now if cheap, but not required to close the bug)
- [ ] Manual retry button on content-fetch failure

### Future Consideration (v2+)

- [ ] Third, icon-rail collapse state (between fully open and fully hidden) — explicitly not part of this milestone's binary open/collapsed design, and adds real complexity (three states × two sides × persistence × a11y) for a benefit not requested here.
- [ ] Resizable (drag-to-resize) sidebars — a related but materially larger feature seen in some of the research (shadcn resizable sidebar examples); out of scope for a "collapse/expand" milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Fix home thumbnail load (item 1) | HIGH | LOW–MEDIUM (root-cause dependent) | P1 |
| Fix post body render (item 2) | HIGH | LOW–MEDIUM (root-cause dependent) | P1 |
| Left/right independent collapse + push layout | HIGH | MEDIUM | P1 |
| Auto-collapse threshold with sticky manual override (Option A) | HIGH (this is what prevents it "feeling broken") | MEDIUM | P1 |
| Accessibility wiring (aria-expanded/controls, focus, reduced-motion) | MEDIUM (invisible to most users, essential to some, and cheap to build in from the start vs. retrofit) | LOW | P1 |
| Avatar-toggle mitigations (aria-label, tooltip, visual cue) | MEDIUM | LOW | P1 |
| Reset-to-auto control | LOW–MEDIUM | LOW | P3 |
| Differentiated empty-vs-failed content copy | LOW–MEDIUM | LOW | P2 |
| Retry button on content failure | LOW | MEDIUM | P3 |

**Priority key:** P1 must-have for this milestone to read as "done, not broken." P2 should-have if cheap. P3 explicitly deferred.

---

## Sources

- W3C WAI-ARIA Authoring Practices Guide, Disclosure pattern — https://www.w3.org/WAI/ARIA/apg/patterns/accordion/ (accordion/disclosure family is the correct pattern class)
- MDN, `aria-expanded` reference — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded
- MDN, `prefers-reduced-motion` — https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion and "Using media queries for accessibility" — https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_media_queries/Using_media_queries_for_accessibility
- Docusaurus, `fix(theme): fix collapsible sidebar behavior when prefers-reduced-motion` PR #8971 — https://github.com/facebook/docusaurus/pull/8971
- GitLab issue tracker (real-world auto-collapse/manual-override bug reports) — https://gitlab.com/gitlab-org/gitlab-foss/-/issues/27340, https://gitlab.com/gitlab-org/gitlab/-/issues/378544, https://gitlab.com/gitlab-org/gitlab/-/issues/580565
- Off-canvas push vs. overlay pattern discussion (Foundation for Sites docs, FlyonUI drawer docs, general write-ups) — https://get.foundation/sites/docs/off-canvas.html, https://flyonui.com/docs/overlays/drawer/
- Sidebar collapse/responsive breakpoint conventions (general UX write-ups, cross-checked against this project's own grid math in `globals.css`) — https://www.uxpin.com/studio/blog/sidebar-tutorial/, https://fluxui.dev/blog/2025-09-03-collapsible-sidebars
- Next.js Image component docs (placeholder/blur, `onError`) — https://nextjs.org/docs/pages/api-reference/components/image
- Notion's own sidebar controls (official help doc, as an example of a "click to collapse/expand, drag to resize" pattern) — https://www.notion.com/help/navigate-with-the-sidebar
- NN/g menu-design and icon-design guidance (adjacent, not a direct avatar-as-toggle citation — reported honestly as a gap in prior art) — https://www.nngroup.com/articles/menu-design/, https://www.nngroup.com/topic/icons/

---
*Feature research for: NoLog v1.1 collapsible sidebars + failure-state UX*
*Researched: 2026-08-09*
