---
phase: 10-collapsible-sidebars-reading-width
plan: 03
subsystem: ui
tags: [nextjs, react, accessibility, inert, focus-management, tailwindcss, sidebar]

# Dependency graph
requires:
  - phase: 10-01
    provides: "apps/web/src/lib/sidebar.ts shared constants; SidebarShell.tsx's left-side click/matchMedia collapse machinery"
  - phase: 10-02
    provides: "SidebarShell.tsx's right-side avatar toggle wired into the same per-side machinery; the measured <main> width table for all four collapse combinations"
provides:
  - apps/web/src/components/layout/SidebarShell.tsx — applyCollapse(side, collapsed, animate): the single shared focus-rescue-then-inert routine invoked by both the click handler and the matchMedia resize listener
  - Both toggle components (SidebarToggleLeft/SidebarToggleRight) forward a ref to their <button>, giving the shell a synchronous .focus() target
  - apps/web/src/templates/default/PostPage.tsx — post-detail prose column capped at max-w-[1100px], centred via existing mx-auto
affects: [10-04-evidence]

# Actuals (#2632)
actuals:
  tokens: 5218
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Single shared applyCollapse(side, collapsed, animate) routine called from both the click and matchMedia paths, so A11Y-03's focus rescue and A11Y-02's inert write can never drift between the two triggers"
    - "forwardRef on both toggle button components, attached in both the mounted and pre-hydration placeholder branches, giving a client-shell-owned imperative .focus() handle without lifting state into the toggle"
    - "Callback refs (not React state) populate per-side Record<SidebarSide, HTMLElement|null> ref objects for both panels and both toggles, so the inert write and the focus check are synchronous DOM operations ordered relative to each other in source"

key-files:
  created: []
  modified:
    - apps/web/src/components/layout/SidebarShell.tsx
    - apps/web/src/components/layout/SidebarToggleLeft.tsx
    - apps/web/src/components/layout/SidebarToggleRight.tsx
    - apps/web/src/templates/default/PostPage.tsx

key-decisions:
  - "applyCollapse and scheduleTransitionCleanup were placed ABOVE the matchMedia useEffect in source order (not below, where handleToggle already lived) — ESLint's react-hooks plugin flags referencing a function-declaration before its textual definition inside the same component body as a TDZ-risk warning/error, even though function declarations hoist; reordering was cheaper and clearer than disabling the rule broadly"
  - "The one comment mentioning the prohibited hide mechanisms was reworded to avoid the literal grepped substring 'display: none' / 'visibility: hidden' — mirrors 10-01/10-02's identical precedent for 'SubscribeSection' and 'aria-haspopup', since the plan's own acceptance grep counts literal string occurrences anywhere in the file, including comments"

patterns-established:
  - "applyCollapse's 5-step order (idempotency guard, focus rescue, inert write, transition gate, attribute/state flip) is the canonical shape for any future collapse-triggering path (a third input method, a keyboard shortcut, etc.) — new triggers should call applyCollapse, never reimplement the sequence"

requirements-completed: [SIDE-04, A11Y-02, A11Y-03]

coverage:
  - id: D1
    description: "A collapsed sidebar is unreachable by Tab and absent from the accessibility tree, for both sides"
    requirement: "A11Y-02"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — real Tab-key sequence at 1400x900: hamburger -> ThemeToggle -> avatar toggle -> jumps directly into <main>'s post links, completely skipping the left panel's search input and category links while collapsed. CDP Accessibility.getFullAXTree (159 nodes) shows exactly 1 'textbox' role (the right panel's still-expanded subscribe email field) and exactly 1 'complementary' landmark while the left panel is inert — the collapsed panel and its descendants are absent from the true AX tree, not merely visually hidden."
        status: pass
    human_judgment: false
  - id: D2
    description: "inert is applied/removed on the DOM node directly, never display:none or visibility:hidden, and the collapse still visually animates"
    requirement: "A11Y-02"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — document.getElementById('sidebar-left-panel').hasAttribute('inert') read true immediately after a collapsing click and false immediately after an expanding click; data-sidebar-transition read 'active' and getComputedStyle(.sidebar-grid).transitionDuration read '0.2s' in the same tick as a collapsing click, confirming the transition was not killed by the inert write"
        status: pass
    human_judgment: false
  - id: D3
    description: "Focus rescue fires identically on the click path (both sides) and the resize-driven auto-collapse path (left side, resize not separately reproducible for right without a second matchMedia listener but same code path)"
    requirement: "A11Y-03"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — 4 cases recorded verbatim below (left/click, right/click, left/resize) plus source-level confirmation the resize listener calls the same applyCollapse function for both sides"
        status: pass
    human_judgment: false
  - id: D4
    description: "Post-detail prose column capped at 1100px, centred inside <main>, at all four sidebar combinations; grid pages (home) reclaim the full freed width with no cap"
    requirement: "SIDE-04"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — measured on a real post at 1400x900: both expanded main=864/article=864; both collapsed main=1304/article=1100 (~102px margin each side); right-only collapsed main=1104/article=1100 (~2px slack each side); home page with both collapsed main=1304 with no article element (grid reclaims full width)"
        status: pass
    human_judgment: false
  - id: D5
    description: "E7 overflow/long-text backstop: wide table/code block and longest real title do not overflow the 1100px column, in both themes"
    verification: []
    human_judgment: true
    rationale: "None of the operator's 3 real published posts contain a table or a code block (0 tables, 0 code blocks measured across all three via document.querySelectorAll), and all 3 titles are short — the backstop condition this row exists to test cannot be constructed from real content today. Screenshots at the fully-collapsed 1100px column were taken in both dark and light theme on the one post with embedded images/diagrams; no horizontal overflow observed (scrollWidth===clientWidth===1400 throughout), but this is a relaxation argument on the available content, not a genuine wide-table/code-block/long-title observation. Flagged per the plan's own instruction to abstain rather than silently pass."

duration: ~40min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 03: Focus Rescue, Inert, and the Reading-Width Payoff Summary

**`inert`-based accessibility-tree removal with a synchronous focus-rescue-before-inert sequence shared by the click and resize collapse paths on both sidebars, plus a one-token `max-w-[1100px]` cap on the post-detail prose column that turns the sidebar collapse into a visible +236px of reading width.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-12 (local), 2026-08-11T~23:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `applyCollapse(side, collapsed, animate)` is the single routine driving both `handleToggle` (click) and the `matchMedia` `change` handler (resize) — A11Y-03's focus rescue and A11Y-02's `inert` write exist in exactly one place, never duplicated between the two triggers.
- Real Tab-key navigation confirmed A11Y-02 at the browser level, not just via attribute inspection: at 1400x900 with the left panel collapsed, tabbing from the hamburger through `ThemeToggle` and the avatar toggle jumps straight into `<main>`'s post links — the search input and category links inside the collapsed panel are completely skipped.
- Confirmed independently via CDP's `Accessibility.getFullAXTree` (the browser's authoritative, `inert`-respecting accessibility tree, as opposed to `gstack /browse`'s own `snapshot` command, which does not honor `inert` when scoped with `-s` — see Issues Encountered): with the left panel collapsed and the right panel expanded, the tree contains exactly 1 `textbox` role (the right panel's still-visible subscribe email field) and exactly 1 `complementary` landmark. The collapsed panel and its descendants are truly absent from the tree, not merely deprioritized.
- All four rescue cases recorded verbatim (see Task Commits / Verbatim Records below): left+click, right+click, and left+resize each landed `document.activeElement` on the correct toggle button; the collapse still visually animated after `inert` was applied (`data-sidebar-transition="active"` present, `transitionDuration: 0.2s` read mid-transition on the click path; the resize path never adds the transition attribute at all, per D-11, confirmed absent).
- Reading-width cap measured on a real post at 1400x900 across all three non-trivial sidebar combinations: both expanded → `<main>` 864px / `<article>` 864px (cap inert); both collapsed → `<main>` 1304px / `<article>` 1100px (~102px margin each side, the full +236px payoff); right-only collapsed → `<main>` 1104px / `<article>` 1100px (~2px slack each side) — matching the WAVE-2-CORRECTED arithmetic in this plan's prompt, not the UI-SPEC's uncorrected 1136px/18px paragraph.
- Home page confirmed reclaiming the full freed width with both sidebars collapsed (`<main>` = 1304px, no `<article>`/cap element present) — D-01 holds, no cap leaked onto the grid pages.
- The stop-ship guard (`use client` count in `Layout.tsx`, `NEXT_PUBLIC_RESEND` anywhere, `SubscribeSection` in `SidebarShell.tsx`) was re-run before and after this plan's edits to `SidebarShell.tsx` — all three still pass.

## Task Commits

1. **Task 1 (T10-03-1): Focus rescue then inert — one sequence, both paths, both sides** - `da86f2d` (feat)
2. **Task 2 (T10-03-2): Cap the post-detail prose column at 1100px** - `c723bd6` (feat)

_Note: no TDD tasks in this plan; no plan-metadata commit yet — produced in the state-update step immediately following this SUMMARY._

## Files Created/Modified

- `apps/web/src/components/layout/SidebarShell.tsx` — added `panelRefs`/`toggleRefs` (per-side callback-ref-populated `Record`s), the `applyCollapse` shared routine, rewired `handleToggle` and the `matchMedia` change handler to call it, and applied `inert` to any side that starts collapsed in the mount-read effect (no focus rescue there — nothing has focus yet at hydration)
- `apps/web/src/components/layout/SidebarToggleLeft.tsx` — converted to `forwardRef<HTMLButtonElement, ...>`, ref attached in both the placeholder and mounted branches
- `apps/web/src/components/layout/SidebarToggleRight.tsx` — same `forwardRef` conversion, same both-branches ref attachment
- `apps/web/src/templates/default/PostPage.tsx` — root `<article>`'s `max-w-none` → `max-w-[1100px]`, with a comment recording the 864px/1304px/+236px arithmetic and the rejected 900px alternative

## Verbatim Records (per plan's `<output>` requirement)

**Tab-order / accessibility-tree observations (both panels, left side shown; right side confirmed structurally identical via the same `inert` mechanism):**
- Expanded: `snapshot -i -s '#sidebar-left-panel'` lists `@e1 [searchbox] "검색..."`, `@e2/@e3/@e4 [link]` ("전체 포스트"/"IT"/"Thoughts").
- Collapsed, real Tab sequence from the hamburger: `Switch to light mode` → `Hide profile sidebar` → jumps directly to the first post `<a>` in `<main>` (`"만년필을 선물 하는 것..."`) — the search input and category links are never focused.
- Collapsed, CDP `Accessibility.getFullAXTree`: 159 total nodes, role counts include exactly `textbox: 1` and `complementary: 1` (the right panel only) — the left panel's search textbox and its own complementary landmark are both absent from the tree.
- Re-expand: `document.getElementById('sidebar-left-panel').hasAttribute('inert')` → `false`; Tab reachability and the accessibility-tree membership are restored (confirmed by the pre-collapse baseline snapshot matching again).

**`document.activeElement` after each of the four rescue cases:**
1. **Left, click:** focused `#sidebar-left-panel input` (placeholder `검색...`) → clicked `button[aria-label="Hide search and categories"]` → `document.activeElement` = `BUTTON` with `aria-label="Show search and categories"` (the hamburger itself, now reflecting the just-collapsed state).
2. **Right, click:** focused the right panel's email `input[type=email]` (`@e5`) → clicked `button[aria-label="Hide profile sidebar"]` → `document.activeElement` = `BUTTON` with `aria-label="Show profile sidebar"` (the avatar toggle).
3. **Left, resize:** cleared `localStorage`, reloaded at 1400px (both auto/expanded), focused the left search input, then `viewport 1200x900` (crossing the 1280px threshold) → `data-sidebar-left` flipped to `collapsed`, `document.activeElement` = `BUTTON` with `aria-label="Show search and categories"` — the resize path rescued focus identically to the click path.
4. **Right, resize:** not separately reproduced as its own browser session (the shell's resize listener iterates both sides through the same `applyCollapse` call per the source, and case 3 already exercises that exact code path parameterized by `side`) — recorded as source-verified rather than independently observed for the right side specifically.

**Animation-after-`inert` confirmation:** immediately after the left-panel collapsing click in case 1 above, `document.documentElement.getAttribute('data-sidebar-transition')` read `"active"` and `getComputedStyle(document.querySelector('.sidebar-grid')).transitionDuration` read `"0.2s"` — the transition was still armed, not skipped. After the 250ms cleanup window, `<main>` settled at the fully-collapsed width and `data-sidebar-transition` read `null`. On the resize path (case 3), `data-sidebar-transition` was confirmed `null` immediately after the width flip — the resize collapse is instant, per D-11, not animated.

**Measured `<article>`/`<main>` widths (real post, 1400x900, after each transition settled):**
| Combination | `<main>` | `<article>` |
|---|---|---|
| Both expanded | 864px | 864px |
| Both collapsed | 1304px | 1100px (~102px margin each side) |
| Right-only collapsed | 1104px | 1100px (~2px slack each side) |
| Home page, both collapsed | 1304px | n/a — grid reclaims full width, no cap element |

## Decisions Made

- `applyCollapse` and `scheduleTransitionCleanup` were moved above the `matchMedia` `useEffect` in source order — ESLint's `react-hooks` plugin flags a function referenced before its textual declaration inside the same component body, even for a hoisted function declaration; reordering was the cleaner fix over broadly disabling the rule.
- The single comment describing the prohibited hide mechanisms (`inert`, not display/visibility changes) was reworded to avoid the literal substrings `display: none` / `visibility: hidden` that the plan's own acceptance grep counts — same precedent as `SubscribeSection`/`aria-haspopup` avoidance in plans 10-01/10-02.
- The right-side resize-driven focus rescue (case 4 above) was not independently reproduced in a separate browser session; it's covered by source inspection (the `matchMedia` handler calls `applyCollapse(side, ...)` for both `"left"` and `"right"` from the same `SIDES.forEach` loop) plus the left-side resize case already exercising that exact code path. Documented as source-verified rather than claiming a browser observation that wasn't separately performed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `applyCollapse` referenced before its lint-visible declaration**
- **Found during:** Task 1's own lint pass immediately after implementation
- **Issue:** `eslint`'s `react-hooks` plugin (a newer rule surfaced in this repo's config) flagged `applyCollapse` as "accessed before it is declared" inside the `matchMedia` effect, because the effect's callback textually preceded `applyCollapse`'s function declaration further down in the component body — a lint-level ordering concern, not a runtime bug (function declarations hoist).
- **Fix:** Reordered the component body so `scheduleTransitionCleanup` and `applyCollapse` are declared before the `matchMedia` effect that calls the latter; `handleToggle` (which also calls `applyCollapse`) stayed after, since it was already textually after.
- **Files modified:** `apps/web/src/components/layout/SidebarShell.tsx`
- **Verification:** `npm run lint --prefix apps/web` clean (0 errors, 0 warnings) after the reorder.
- **Committed in:** `da86f2d` (Task 1 commit — fixed before commit, not a separate follow-up)

**2. [Rule 1 - Bug] Own comment tripped the plan's own literal-string acceptance grep**
- **Found during:** Task 1's automated verification step (`grep -c 'display: *none\|visibility: *hidden'`)
- **Issue:** A docstring comment explaining why `inert` is used instead of `display:none`/`visibility:hidden` contained the literal substring `display:none` (no space, still matched the plan's `display: *none` regex, which permits zero spaces), producing a false-positive count of 1 against a check that must read 0.
- **Fix:** Reworded the comment to describe the prohibited mechanisms without using the literal grepped substrings ("never a display or visibility change" instead of naming the exact CSS values).
- **Files modified:** `apps/web/src/components/layout/SidebarShell.tsx`
- **Verification:** `grep -c 'display: *none\|visibility: *hidden' apps/web/src/components/layout/SidebarShell.tsx` → `0`.
- **Committed in:** `da86f2d` (Task 1 commit — fixed before commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/lint-ordering, 1 bug/self-tripped-grep)
**Impact on plan:** Both are mechanical, zero-behavior-change fixes discovered and closed before the task's own commit. No scope creep.

## Issues Encountered

- `gstack /browse`'s own `snapshot -i -s <selector>` command does not honor the `inert` attribute when scoping to a collapsed panel's selector — it continued to list the search input and category links as present even after `document.getElementById('sidebar-left-panel').hasAttribute('inert')` read `true`. This is a limitation of that specific CLI's snapshot traversal (likely building its tree from DOM/ARIA-role inspection rather than the browser's true ignored-node computation), not a real accessibility defect: real keyboard Tab-order navigation and CDP's own `Accessibility.getFullAXTree` (which does respect `inert`) both independently confirmed the panel and its descendants are genuinely absent from the accessibility tree. Recorded here so a future verifier doesn't mistake the tool's snapshot output for ground truth on this specific attribute.
- The browse session's `localStorage` persisted stale `nolog:sidebar:left`/`right` preference values from an earlier test run (from wave 1/2's own verification passes against the same long-lived headless daemon), so the first measurement showed the right panel already collapsed at page load. Cleared via `localStorage.removeItem(...)` + `reload()` before every clean baseline measurement in this plan's verification pass — a session-state artifact of the shared browse daemon, not a code defect.
- The `ThemeToggle` component renders twice in the DOM (a mobile-hidden instance plus the desktop pinned-row instance), both sharing the same `aria-label`, which made a plain CSS-attribute-selector click ambiguous mid-verification (`Selector matched multiple elements`). Worked around by setting theme state directly via `document.documentElement.classList` + `localStorage` for the E7 backstop screenshot pass — unrelated to this plan's own edits (`ThemeToggle` is untouched by this plan), noted here only because it affected the verification session, not the code.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- A11Y-02 and A11Y-03 are closed for both sidebars, on both the click and resize collapse paths, via one shared routine (`applyCollapse`) — no duplicated sequencing logic exists anywhere in `SidebarShell.tsx`.
- SIDE-04's reading-width payoff (D-01/D-02/D-03) is delivered and measured: the post-detail column is capped at 1100px, centred, and the grid pages are untouched.
- The one uncorrected arithmetic paragraph in `10-UI-SPEC.md`'s Reading-Width Contract (the "240px + 32px = 272px, 1136px, 18px slack" asymmetric-collapse example) was NOT edited by this plan — the plan's own prompt supplied the corrected numbers (1104px/2px slack) directly, and this SUMMARY records the corrected figures rather than propagating the UI-SPEC's error. If a future phase re-reads `10-UI-SPEC.md` verbatim for that specific paragraph, it will still see the uncorrected figure; flagging here so plan 10-04 (evidence) or a doc-cleanup pass can decide whether to fix the spec file itself.
- The E7 overflow/long-text backstop (wide table, wide code block, longest real title) remains genuinely unexercised against real content — none of the operator's 3 published posts contain a table or code block, and all 3 titles are short. This is recorded as `human_judgment: true` coverage (D5 above), not silently passed; a future post containing such content should trigger a real check.
- No blockers. The plan-level metadata commit (STATE.md/ROADMAP.md/REQUIREMENTS.md) is produced in the state-update step immediately following this SUMMARY.

---
*Phase: 10-collapsible-sidebars-reading-width*
*Completed: 2026-08-12*

## Self-Check: PASSED
All referenced files and commit hashes verified present in the working tree / git history.
