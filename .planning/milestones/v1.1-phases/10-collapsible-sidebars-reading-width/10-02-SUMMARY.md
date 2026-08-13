---
phase: 10-collapsible-sidebars-reading-width
plan: 02
subsystem: ui
tags: [nextjs, react, css-custom-properties, tailwindcss, accessibility, sidebar, next-image]

# Dependency graph
requires:
  - phase: 10-01
    provides: "apps/web/src/lib/sidebar.ts shared constants/vocabulary; SidebarShell.tsx's per-side Record-keyed tri-state machinery, ready for a second button to plug into"
provides:
  - apps/web/src/components/layout/SidebarToggleRight.tsx — circular avatar disclosure button, D-14 icon fallback, always-on accent ring
  - Both sides of SidebarShell.tsx now live: right side collapses independently via the same per-side machinery plan 10-01 built
  - Profile.tsx demoted from <aside> to <div> — right panel is a single complementary landmark
affects: [10-03-focus-and-inert, 10-04-evidence]

# Actuals (#2632)
actuals:
  tokens: 2250
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Second @property-registered CSS custom property (--profile-width) following plan 10-01's --sidebar-width pattern, sharing the single-quoted syntax fix"
    - "useState(false) + onError ternary-render icon fallback (D-14), copied from PostThumbnailImage.tsx's exact shape"
    - "Per-side mount-read effect refactored from two hardcoded 'left' blocks into one SIDES.forEach helper, invoked once for both sides"

key-files:
  created:
    - apps/web/src/components/layout/SidebarToggleRight.tsx
  modified:
    - apps/web/src/app/globals.css
    - apps/web/src/components/layout/SidebarShell.tsx
    - apps/web/src/components/Profile.tsx

key-decisions:
  - "Comments describing menu-semantics prohibitions and the <div>-not-landmark rationale deliberately avoid the literal strings 'aria-haspopup', 'role=\"menu\"', and '<aside' — the plan's own acceptance greps count those literal occurrences, and a comment mention would produce a false failure (mirrors 10-01's identical SubscribeSection precedent)"
  - "Mount-read effect in SidebarShell.tsx refactored to SIDES.forEach(...) rather than adding a second hardcoded 'right' block next to the existing 'left' block — keeps the per-side machinery at exactly one implementation, per the plan's explicit instruction not to fork the logic"

patterns-established:
  - "CHROME as a single static Tailwind class string (no conditional branch keyed on collapsed state) is the mechanism that guarantees the accent ring never dims or disappears between states (SIDE-09, D-12)"

requirements-completed: [SIDE-02, SIDE-03, SIDE-04, SIDE-09, A11Y-01, A11Y-05]

coverage:
  - id: D1
    description: "Avatar toggle collapses/expands the right sidebar; main grows by exactly 240px at a 1400px viewport"
    requirement: "SIDE-02"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — measured main width 864px (both expanded) -> 1104px (right only collapsed) -> 864px (re-expanded), at 1400x900"
        status: pass
    human_judgment: false
  - id: D2
    description: "Either side collapses independently of the other; both collapsed gives 1304px at 1400px viewport"
    requirement: "SIDE-03, SIDE-04"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — four combinations measured: both expanded 864px, left-only collapsed 1064px, right-only collapsed 1104px, both collapsed 1304px; grid-template-columns read back matching each case"
        status: pass
    human_judgment: false
  - id: D3
    description: "Accent ring present and visually identical in both states and both themes; button reads as a control, not an account menu"
    requirement: "SIDE-09"
    verification:
      - kind: automated_ui
        ref: "gstack /browse screenshots — light/expanded, light/collapsed, dark/expanded, dark/collapsed all show the identical ring; hover shifts only ring color; source-asserted zero aria-haspopup/role=menu occurrences"
        status: pass
    human_judgment: false
  - id: D4
    description: "Avatar toggle stays operable and shows the icon fallback when the avatar asset 404s"
    requirement: "D-14 (carried via SIDE-02/SIDE-09 must_haves)"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — CONFIG.profile.avatarUrl temporarily repointed at a 404 path; button rendered the lucide User icon inside bg-surface-active with the ring unchanged, and still collapsed the panel on click; config change reverted (git diff clean afterward)"
        status: pass
    human_judgment: false
  - id: D5
    description: "aria-expanded and aria-controls report the avatar toggle's live state, targeting sidebar-right-panel"
    requirement: "A11Y-01"
    verification:
      - kind: automated_ui
        ref: "gstack /browse outerHTML read — aria-expanded=\"true\"/\"false\" matched panel state at each toggle; aria-controls=\"sidebar-right-panel\" present"
        status: pass
    human_judgment: false
  - id: D6
    description: "Avatar toggle's accessible name is action-phrased, matches title, and is distinct from the Profile card's own alt text; right panel is exactly one complementary region"
    requirement: "A11Y-05"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — outerHTML shows aria-label==title=='Show profile sidebar'/'Hide profile sidebar', image alt=\"\"; DOM query for #sidebar-right-panel and its descendants returned exactly one ASIDE with an implicit complementary role, zero nested landmarks"
        status: pass
    human_judgment: false
  - id: D7
    description: "Subscribe form still renders in the right panel; no publicly-prefixed Resend variable exists anywhere under apps/web/src"
    requirement: "SIDE-10 (re-checked, stop-ship)"
    verification:
      - kind: other
        ref: "grep -c 'use client' Layout.tsx == 0; grep -rn NEXT_PUBLIC_RESEND apps/web/src == empty; grep -c SubscribeSection SidebarShell.tsx == 0"
        status: pass
      - kind: automated_ui
        ref: "gstack /browse text dump — '새 글 알림 받기' / email field / '구독' button all rendered live (operator's Resend vars are configured)"
        status: pass
    human_judgment: false

duration: ~30min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 02: Right Sidebar Collapse (Avatar Toggle) Summary

**Circular profile-image disclosure button collapsing the right sidebar independently of the left, with an always-on accent ring, a `lucide-react` icon fallback on image failure, and `Profile.tsx`'s root demoted to a `<div>` so the panel is a single accessibility landmark.**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-08-12T07:00:00+09:00 (2026-08-11T22:00:00Z)
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Avatar click collapses/expands the right sidebar; `<main>` measured 864px → 1104px → 864px at a 1400px viewport (right-only collapse), exactly the +240px D-04 requires for that side.
- All four left/right combinations measured live: both expanded 864px, left-only collapsed 1064px, right-only collapsed 1104px, both collapsed 1304px — the two 32px gaps survive at every combination (SIDE-03, SIDE-04).
- The accent ring (`ring-2 ring-accent ring-offset-2 ring-offset-background`) is present and visually identical across all four combinations of {light, dark} × {expanded, collapsed}; hover shifts only its color, never its width or offset (SIDE-09, D-12).
- D-14's icon fallback exercised against a real 404: `CONFIG.profile.avatarUrl` was temporarily repointed at a nonexistent path, the button rendered the `lucide-react` `User` icon inside `bg-surface-active` with the ring unchanged, and still collapsed the panel on click; the config change was reverted and confirmed clean via `git diff`.
- `aria-expanded`/`aria-controls`/`aria-label`/`title` all read correctly off the live DOM; the two locked label strings ("Show profile sidebar" / "Hide profile sidebar") share no wording with `CONFIG.profile.name` ("4lph4").
- The right panel's accessibility subtree contains exactly one landmark — the outer `<aside id="sidebar-right-panel">` — after `Profile.tsx`'s root became a `<div>`; zero nested complementary regions.
- The stop-ship greps (`use client` count in `Layout.tsx`, `NEXT_PUBLIC_RESEND` anywhere, `SubscribeSection` in `SidebarShell.tsx`) all still pass after this plan's edits, and the subscribe form was observed rendering live with the operator's configured Resend vars.
- `SidebarShell.tsx`'s per-side machinery stayed a single implementation: the mount-read effect was refactored from a hardcoded "left" block into one `SIDES.forEach` helper rather than adding a second copy-pasted block for "right".

## Task Commits

1. **Task 1 (T10-02-1): Avatar toggle button — ring cue, decorative image, icon fallback** - `63fea29` (feat)
2. **Task 2 (T10-02-2): Wire the right side — shell invocation, CSS override, single landmark** - `de73bb1` (feat)

_Note: no TDD tasks in this plan; no plan-metadata commit yet — see Next Phase Readiness._

## Files Created/Modified

- `apps/web/src/components/layout/SidebarToggleRight.tsx` — circular 36px profile-image disclosure button; `useState(false)` + `onError` fallback shape copied from `PostThumbnailImage.tsx`; static `CHROME` class string carries the always-on ring
- `apps/web/src/app/globals.css` — `@property --profile-width` (single-quoted `syntax`, matching 10-01's fix) and `html[data-sidebar-right="collapsed"] { --profile-width: 0px; }`, both outside `.dark`
- `apps/web/src/components/layout/SidebarShell.tsx` — mount-read effect refactored to iterate both sides via one helper; `SidebarToggleRight` rendered in the pinned row immediately right of `ThemeToggle`
- `apps/web/src/components/Profile.tsx` — root element changed from `<aside>` to `<div>` with byte-identical `className`; one-line comment added explaining the landmark-collision rationale (worded to avoid tripping the plan's own literal-string grep)

## Decisions Made

- Comments explaining the menu-semantics prohibition and the landmark-demotion rationale deliberately avoid the literal strings the plan's own acceptance greps count (`aria-haspopup`, `role="menu"`, `<aside`) — mirrors plan 10-01's identical precedent for the word "SubscribeSection".
- The mount-read effect was refactored into a `SIDES.forEach` loop rather than adding a second hardcoded "right" block beside the existing "left" one, keeping the per-side state machinery at exactly one implementation as the plan required.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1/2/3 auto-fixes were required; the one comment-wording adjustment (avoiding literal grepped strings) is documentation-only and was anticipated by the plan's own precedent from 10-01, not a deviation from behavior.

## Issues Encountered

- The local `next dev` server crashed once (`free(): unaligned chunk detected in tcache 2`, a Turbopack-internal native crash) while repeatedly serving the deliberately-broken 404 avatar path during the D-14 fallback test. Not a code defect — restarted the dev server (`rm -rf .next` + fresh `npm run dev`) and the fallback test completed successfully on the second attempt, producing the same result.
- Two `gstack /browse` element refs went stale mid-sequence after a click changed the button's accessible name (label text change altered the ARIA node identity). Resolved by re-running `snapshot` to get fresh refs; no impact on the measured results, since `data-sidebar-*` attribute reads confirmed the actual DOM state independently at each step.

## User Setup Required

None — no external service configuration required. (The subscribe form observed rendering live in this session uses the operator's own pre-existing Resend configuration; nothing new was added.)

## Next Phase Readiness

- Both sidebars now collapse and expand fully independently, matching the architecture plan 10-01 established: shared constants module, per-side `@property`-registered CSS, pre-hydration script, and a client shell with ref-mirrored per-side state — now proven identically on both sides.
- `SidebarShell.tsx`'s per-side machinery (`handleToggle`, the mount-read effect, the `matchMedia` auto-collapse listener) is invoked for both `"left"` and `"right"` from one implementation each — no rewrite needed for plan 10-03.
- Plan 10-03 (focus/inert sequencing, A11Y-02/A11Y-03) inserts at the documented points in `handleToggle` (before the attribute flip) and the mount effect, exactly as 10-01's summary anticipated. The collapsing panel is deliberately not yet `inert` and focus is not yet rescued — this plan's own `<verification>` section names that as the intended residual, closed next by 10-03 doing `inert` and the focus rescue together (never `inert` alone, which would strand focus).
- No blockers. The plan-level metadata commit (STATE.md/ROADMAP.md/REQUIREMENTS.md) is produced in the state-update step immediately following this SUMMARY.

---
*Phase: 10-collapsible-sidebars-reading-width*
*Completed: 2026-08-12*

## Self-Check: PASSED
All referenced files and commit hashes verified present in the working tree / git history.
