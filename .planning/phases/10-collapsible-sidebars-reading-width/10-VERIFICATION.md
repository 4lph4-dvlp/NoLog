---
phase: 10-collapsible-sidebars-reading-width
verified: 2026-08-13T00:00:00Z
status: human_needed
score: 15/15 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "SIDE-10's live subscribe submit-and-response round trip: fill the email field on the right panel's subscribe form with a real address and click submit, using the operator's actual RESEND_API_KEY / RESEND_AUDIENCE_ID."
    expected: "The form submits successfully and the operator's Resend audience receives the new contact (or the API returns the expected success response)."
    why_human: "This is a real, side-effecting PII write against the operator's live production Resend account. The verifying agent's own tool-use classifier blocks side-effecting fill+submit actions against production services, exactly as it blocked this same check during plan 10-04's own evidence-gathering pass. The render half (form renders with a live email field and a submit button) and all three code-level stop-ship guards (NEXT_PUBLIC_RESEND greps, Layout.tsx Server Component status, compiled client-reference-manifest inspection) are independently confirmed positive in 10-EVIDENCE.md and re-confirmed live in this verification pass — only the actual submit-and-response round trip is unproven."
  - test: "A11Y-04's simultaneous JS-bypass + real-engine reduced-motion combination: with the browser engine's own prefers-reduced-motion: reduce active (not monkey-patched), manually force document.documentElement.setAttribute('data-sidebar-transition', 'active') and confirm the grid-template-columns transition still does not play."
    expected: "The CSS layer (@media (prefers-reduced-motion: no-preference) wrapper around the transition rule) suppresses the animation even when the JS-layer guard is bypassed by hand, proving the CSS guard holds independently rather than only in combination with the JS guard."
    why_human: "The gstack /browse headless session's CDP allowlist does not include Emulation.setEmulatedMedia, so the real browser-engine reduced-motion preference cannot be forced from this environment. The JS-layer guard (belt) and the CSS-layer source assertion (suspenders) are each independently confirmed in 10-EVIDENCE.md; only the specific both-bypassed-simultaneously combination needs a human running a real OS-level 'reduce motion' toggle."
  - test: "E7's real-content wide-table / wide-code-block / longest-title backstop: open a post containing an actual wide Notion table and an actual wide Notion code block at the fully-collapsed 1100px prose column, in both light and dark theme, and confirm nothing overflows or breaks."
    expected: "The table and code block render cleanly within the 1100px column with no horizontal overflow, matching the synthetic proxy's result."
    why_human: "The operator's 3 published posts contain zero tables and zero code blocks, so there is no real content to run this check against without mutating production Notion content — which this phase and its predecessor (Phase 9's IMG-05) both declined to do. A synthetic proxy using react-notion-x's own real CSS classes was exercised and did not overflow, but that narrows rather than closes the gap; a human with access to add or is willing to temporarily add qualifying content should confirm."
  - test: "SC#5's home-page sticky depth: with more real content on the home page than the operator's current 3 posts, scroll the home page far enough (e.g. 2000px, matching the post-page test's rigor) to confirm both <aside>s still stick."
    expected: "Both <aside>s remain position: sticky at their top-16 (64px) rest position throughout a deep scroll, matching the post-page result exactly."
    why_human: "The operator's home page currently has only 3 published posts and measures scrollHeight: 900px at a 900px viewport — there is no real content to scroll far enough to stress-test sticky positioning the way the 4187px-tall post page was tested. A light check at the ~50-64px of scroll room that does exist showed sticky intact, but this is not the same rigor as the post-page test. This will resolve itself once the operator publishes more posts; a human should re-run the check then, or explicitly accept the lighter-rigor result now."
---

# Phase 10: Collapsible Sidebars & Reading Width Verification Report

**Phase Goal:** Readers control how wide the article column is on every `default`-template page, with the
subscribe form intact and the whole thing usable by keyboard and screen reader
**Verified:** 2026-08-13
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All 15 requirement rows (SIDE-01…10, A11Y-01…05) plus ROADMAP SC#5 were checked against the current
codebase (not the SUMMARYs' claims) and against the post-review state (CR-01 fixed, WR-01 documented,
IN-01 deliberately unfixed).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SIDE-01: Hamburger collapses/expands left sidebar; `<main>` grows by exactly 200px | ✓ VERIFIED | `SidebarToggleLeft.tsx` wired to `handleToggle("left")`; `10-EVIDENCE.md` §Measured widths: 864px→1064px (+200px exact), matches `grid-template-columns` read `0px 1064px 240px` |
| 2 | SIDE-02: Avatar toggle collapses/expands right sidebar; `<main>` grows by exactly 240px | ✓ VERIFIED | `SidebarToggleRight.tsx` wired to `handleToggle("right")`; `10-EVIDENCE.md`: 864px→1104px (+240px exact) |
| 3 | SIDE-03: The two sides are independent | ✓ VERIFIED | `10-EVIDENCE.md` §Measured widths: all four combinations (864/1064/1104/1304px) measured live and match expectation exactly |
| 4 | SIDE-04: Article column visibly widens on collapse | ✓ VERIFIED | `PostPage.tsx:26` `max-w-[1100px] mx-auto py-8 md:px-4`; `10-EVIDENCE.md`: article 864px→1100px both collapsed, a real +236px payoff |
| 5 | SIDE-05: Auto-collapse follows 1280px threshold live before any click | ✓ VERIFIED | `SidebarShell.tsx:243-267` `matchMedia` listener derived from `SIDEBAR_BREAKPOINT_PX`; `10-EVIDENCE.md` §Threshold: 1281/1280 expanded, 1279 collapsed, zero `localStorage` writes across the sweep |
| 6 | SIDE-06: Explicit preference persists across reload/navigation, no resize override | ✓ VERIFIED | `handleToggle` writes `localStorage` and sets `prefRef`; auto-collapse listener returns early when `prefRef.current[side] !== null` (`SidebarShell.tsx:250`); `10-EVIDENCE.md`: survives reload, resize to 800px, and real post navigation |
| 7 | SIDE-07: No wrong-state flash on cold reload | ✓ VERIFIED | Pre-hydration `<script>` in `apps/web/src/app/layout.tsx:86-93`, first child of `<body>`, before `<Analytics/>`/`<ThemeProvider>`; `10-EVIDENCE.md`: 5 cold reloads with saved preference, `data-sidebar-left` correct immediately, zero hydration warnings (method caveat honestly recorded — DOM-read, not frame-by-frame eye review) |
| 8 | SIDE-08: Desktop preference has no mobile effect | ✓ VERIFIED | `Layout.tsx`'s `md:hidden` mobile block references neither `--sidebar-width`/`--profile-width` nor `SidebarShell`; `10-EVIDENCE.md`: 375×812 stack order Profile/Subscribe/Search/Categories, one visible ThemeToggle, no toggle row, no horizontal scroll |
| 9 | SIDE-09: Avatar toggle carries an always-on visual cue | ✓ VERIFIED | `SidebarToggleRight.tsx` `CHROME` constant includes `ring-2 ring-accent ring-offset-2 ring-offset-background` in the static (non-conditional) class string; `10-EVIDENCE.md`: ring confirmed visually identical across both themes and both states |
| 10 | SIDE-10 (stop-ship): Subscribe form intact, `Layout.tsx` stays Server Component, no `NEXT_PUBLIC_RESEND_*` | ✓ VERIFIED (render + code-level guards) / render+guards positive, live submit round-trip unexercised | `grep -c 'use client' apps/web/src/templates/default/Layout.tsx` = 0 (re-run in this pass); `grep -rn 'NEXT_PUBLIC_RESEND' apps/web/src` empty (re-run); `SidebarShell.tsx` never imports `SubscribeSection` (0 occurrences); `.next` client-reference-manifest confirms `Layout.tsx`/`SubscribeSection.tsx` absent from client bundle, `SidebarShell.tsx` present; form observed rendering live. Live submit-and-response round trip is UNEXERCISED — see Human Verification #1 |
| 11 | A11Y-01: Both toggles report `aria-expanded`/`aria-controls` | ✓ VERIFIED | Both `SidebarToggleLeft.tsx` and `SidebarToggleRight.tsx` set `aria-expanded={!collapsed}` and `aria-controls={SIDEBAR_PANEL_IDS.left/right}`; `10-EVIDENCE.md` §Accessibility battery: both attrs flip correctly before/after click |
| 12 | A11Y-02: Collapsed panel absent from a11y tree and Tab order | ✓ VERIFIED | `SidebarShell.tsx`'s `applyCollapse` sets/removes native `inert` directly on the panel DOM node (never `display`/`visibility`); `10-EVIDENCE.md`: AX-tree node counts track collapse state exactly (zero `textbox`/`complementary` when both collapsed), real bidirectional Tab walk confirms collapsed panel skipped |
| 13 | A11Y-03: Focus rescued to controlling toggle on both click and resize collapse paths | ✓ VERIFIED | `applyCollapse` (`SidebarShell.tsx:197-235`) checks `document.activeElement` containment and calls `.focus()` on the toggle ref BEFORE the `inert` write, in the same synchronous call, shared by both `handleToggle` and the `matchMedia` listener; `10-EVIDENCE.md`: all 4 focus-rescue cases (left/right × click/resize) independently reproduced with correct `document.activeElement` |
| 14 | A11Y-04: Reduced motion disables the transition | ✓ VERIFIED (JS + CSS layers independently) / simultaneous-bypass combination unexercised | `applyCollapse` checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches` before adding the transition attribute; `globals.css:93-98` wraps the transition rule in `@media (prefers-reduced-motion: no-preference)`; `10-EVIDENCE.md`: JS-patched reduced-motion produces instant collapse, unpatched produces the animated ~200ms path — both observed live. The simultaneous JS-bypass + real-engine-reduce combination is UNEXERCISED — see Human Verification #2 |
| 15 | A11Y-05: Avatar toggle's accessible name is action-phrased, distinct from Profile `alt`, matches `title` | ✓ VERIFIED | `SidebarToggleRight.tsx`: one `label` binding passed to both `aria-label` and `title`; strings `"Show profile sidebar"`/`"Hide profile sidebar"` share no substring with `CONFIG.profile.name` ("4lph4"); `<Image alt="" .../>` on the toggle (decorative) vs `Profile.tsx`'s own `alt={profile.name}` on the 80px avatar — no collision |
| 16 | ROADMAP SC#5: Both `<aside>`s still stick on scroll after the transition CSS shipped | ✓ VERIFIED on post page / UNEXERCISED at depth on home page | `10-EVIDENCE.md` §Delayed-onset pitfall battery: all four combinations confirm `position: sticky`, settling at `top: 64px` after a 2000px scroll on a real 4187px-tall post. Home page: only a light ~50-64px check performed (only 3 real posts, 900px `scrollHeight`) — see Human Verification #4 |

**Score:** 15/15 core requirement definitions verified; 4 of those 15 rows (SIDE-10, A11Y-04, plus SC#5,
and E7's contribution to SIDE-04) carry an honestly-recorded UNEXERCISED sub-item, each routed to human
verification below rather than silently passed or treated as a defect.

### Post-Review State (CR-01 / WR-01 / IN-01)

| Item | Claimed disposition | Verified in current tree? |
|---|---|---|
| CR-01 (Critical) | Fixed, commit `94904cb` — per-side `pendingTransitionCleanupRef`, `finish()` only clears the shared attribute when the other side has no pending cleanup, `scheduleTransitionCleanup(side)` runs BEFORE the attribute is (re)set | ✓ Confirmed by direct read of `SidebarShell.tsx:64-235` — `pendingTransitionCleanupRef` is `Record<SidebarSide, (() => void) \| null>`, `finish()` checks `otherSide` before removing the attribute, `applyCollapse` calls `scheduleTransitionCleanup(side)` then `document.documentElement.setAttribute(...)`, and the unmount cleanup flushes both sides |
| WR-01 (Warning) | Resolved as documentation, commit `e099307` — derivation written into `10-UI-SPEC.md`'s Positioning & Sticky Contract; E5/E6 rows corrected from `top-8` to `top-16` | ✓ Confirmed — `10-UI-SPEC.md:199-207` states the arithmetic (toggle row bottom edge 59px, panels settle at 64px, 5px clearance); E5/E6 rows (lines 432, 440) now read `top-16`. No code changed, matching the claim |
| IN-01 (Info) | Deliberately not fixed — inline ref-callback closures | ✓ Confirmed — `SidebarShell.tsx:297,307,321,333` still use inline `ref={(el) => {...}}` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/web/src/lib/sidebar.ts` | Single source of truth for threshold/storage/attr vocabulary | ✓ VERIFIED | All 13 exports present; `1280` exists only here (repo-wide grep confirms) |
| `apps/web/src/components/layout/SidebarShell.tsx` | Client wrapper, per-side tri-state, both toggles, focus-rescue+inert | ✓ VERIFIED | Confirmed wired, both sides live, CR-01-fixed |
| `apps/web/src/components/layout/SidebarToggleLeft.tsx` | Hamburger disclosure button | ✓ VERIFIED | `Menu` glyph unconditional, forwarded ref, `aria-label===title` |
| `apps/web/src/components/layout/SidebarToggleRight.tsx` | Avatar disclosure button | ✓ VERIFIED | Always-on ring, `onError` fallback to `User` icon, `alt=""` |
| `apps/web/src/app/globals.css` | `@property` registrations, collapsed overrides, click-only transition | ✓ VERIFIED | Both `@property` blocks single-quoted; `data-sidebar-left/right="collapsed"` overrides present; transition wrapped in `no-preference` media query |
| `apps/web/src/app/layout.tsx` | Pre-hydration script | ✓ VERIFIED | `dangerouslySetInnerHTML` with `initSidebarState.toString()`, first child of `<body>` |
| `apps/web/src/templates/default/Layout.tsx` | Server Component, builds slots, no client directive | ✓ VERIFIED | 0 `use client`, `SubscribeSection` constructed here (5 occurrences incl. comment), `SidebarShell` receives pre-rendered `ReactNode` |
| `apps/web/src/components/Profile.tsx` | Root demoted `<aside>`→`<div>` | ✓ VERIFIED | 0 `<aside` occurrences, className byte-identical |
| `apps/web/src/templates/default/PostPage.tsx` | Prose column capped at 1100px | ✓ VERIFIED | `max-w-[1100px] mx-auto py-8 md:px-4`, `max-w-none` removed |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `app/layout.tsx` | `lib/sidebar.ts` | imports + `.toString()`-serialized initializer | ✓ WIRED | Confirmed at `app/layout.tsx:5-10, 86-93` |
| `SidebarShell.tsx` | `lib/sidebar.ts` | same `SIDEBAR_BREAKPOINT_PX` for `matchMedia` | ✓ WIRED | `SidebarShell.tsx:244` derives from the imported constant, no second literal |
| `templates/default/Layout.tsx` | `SidebarShell.tsx` | `leftSlot`/`rightSlot` pre-rendered ReactNode props | ✓ WIRED | Confirmed — `Layout.tsx:52-71` |
| `globals.css` | `SidebarShell.tsx` | `data-sidebar-left/right` attribute-scoped `--sidebar-width`/`--profile-width` override | ✓ WIRED | Confirmed — grid container consumes `var(--sidebar-width)`/`var(--profile-width)` in its Tailwind arbitrary-value class |
| `SidebarToggleRight.tsx` | `site.config.ts` | `CONFIG.profile.avatarUrl` direct import | ✓ WIRED | Confirmed, no `process.env` read in `site.config.ts` |
| `SidebarShell.tsx` | two `<aside>` panels | per-side ref, `document.activeElement` containment + `inert` | ✓ WIRED | Confirmed — `applyCollapse` uses `panelRefs.current[side]` |
| `SidebarShell.tsx` | two toggle buttons | per-side ref, `.focus()` target | ✓ WIRED | Confirmed — `toggleRefs.current[side]?.focus()` fires before the `inert` write |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense (no server data query feeds this feature) — the relevant "data
flow" is client state (localStorage/matchMedia) to rendered DOM attributes/CSS custom properties, traced
above via Key Link Verification and confirmed live in `10-EVIDENCE.md`'s measured widths.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Lint clean | `npm run lint --prefix apps/web` | exit 0, no errors | ✓ PASS |
| Build clean, all 11 routes | `npm run build --prefix apps/web` | Compiled successfully, TypeScript finished, 9/9 static pages generated | ✓ PASS |
| Stop-ship: no client directive in `Layout.tsx` | `grep -c 'use client' apps/web/src/templates/default/Layout.tsx` | `0` | ✓ PASS |
| Stop-ship: no public Resend var repo-wide | `grep -rn 'NEXT_PUBLIC_RESEND' apps/web/src` | no output, exit 1 | ✓ PASS |
| Stop-ship: `SubscribeSection` never in `SidebarShell.tsx` | `grep -c 'SubscribeSection' apps/web/src/components/layout/SidebarShell.tsx` | `0` | ✓ PASS |
| Threshold single-source | `grep -rln '1280\|1279' apps/web/src` (excl. `.ts`/`.tsx`/`.css` other than `sidebar.ts`) | only `apps/web/src/lib/sidebar.ts` | ✓ PASS |
| CR-01 fix present | direct read of `SidebarShell.tsx` | per-side ref, ordering matches commit description | ✓ PASS |
| No new npm dependency this phase | `git diff --stat <phase-10-first-commit>^ HEAD -- package.json apps/web/package.json packages/core/package.json` | empty diff | ✓ PASS |
| Terminal template / `packages/core` untouched | git log check | 0 phase-10 commits touch `templates/terminal` | ✓ PASS |
| Scope fences (icon rail, drag-resize, reset-to-auto) absent | `grep -rniE 'icon.?rail\|drag.?to.?resize\|reset.?to.?auto' apps/web/src` | no matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repo and none is declared by phase 10's plans —
this project has zero test infrastructure by explicit constraint (confirmed via `10-VALIDATION.md`'s "Test
Infrastructure" table: "none — project hard constraint"). Step 7c: SKIPPED — no probes to run; verification
relies on source assertions, lint, build, and the browser-observation evidence already captured in
`10-EVIDENCE.md` and independently re-run in this pass.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SIDE-01 | 10-01 | Hamburger collapse/expand left | ✓ SATISFIED | See Truth #1 |
| SIDE-02 | 10-02 | Avatar collapse/expand right | ✓ SATISFIED | See Truth #2 |
| SIDE-03 | 10-02 | Independent sides | ✓ SATISFIED | See Truth #3 |
| SIDE-04 | 10-01, 10-02, 10-03 | Article visibly widens | ✓ SATISFIED | See Truth #4 |
| SIDE-05 | 10-01 | Auto-collapse follows threshold | ✓ SATISFIED | See Truth #5 |
| SIDE-06 | 10-01 | Explicit preference persists | ✓ SATISFIED | See Truth #6 |
| SIDE-07 | 10-01 | No wrong-state flash | ✓ SATISFIED | See Truth #7 |
| SIDE-08 | 10-01 | No mobile effect | ✓ SATISFIED | See Truth #8 |
| SIDE-09 | 10-02 | Avatar visual cue | ✓ SATISFIED | See Truth #9 |
| SIDE-10 | 10-01, 10-02, 10-04 | Subscribe form intact (stop-ship) | ✓ SATISFIED (render + code guards); live submit UNEXERCISED | See Truth #10 |
| A11Y-01 | 10-01, 10-02 | aria-expanded/aria-controls | ✓ SATISFIED | See Truth #11 |
| A11Y-02 | 10-03 | Removed from a11y tree | ✓ SATISFIED | See Truth #12 |
| A11Y-03 | 10-03 | Focus rescue | ✓ SATISFIED | See Truth #13 |
| A11Y-04 | 10-01 | Reduced motion | ✓ SATISFIED (both layers independently); simultaneous-bypass UNEXERCISED | See Truth #14 |
| A11Y-05 | 10-02 | Distinct accessible name | ✓ SATISFIED | See Truth #15 |

No orphaned requirements — REQUIREMENTS.md's traceability table maps all 15 IDs to Phase 10 and each ID
appears in at least one plan's `requirements` frontmatter field (10-01: SIDE-01/04/05/06/07/08/10/A11Y-01/04;
10-02: SIDE-02/03/04/09/A11Y-01/05; 10-03: SIDE-04/A11Y-02/03; 10-04 re-verifies all).

### Anti-Patterns Found

None. Scanned all 9 review-flagged files (`sidebar.ts`, `SidebarShell.tsx`, `SidebarToggleLeft.tsx`,
`SidebarToggleRight.tsx`, `globals.css`, `app/layout.tsx`, `templates/default/Layout.tsx`,
`templates/default/PostPage.tsx`, `Profile.tsx`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and
stub-shaped patterns. Only legitimate "placeholder" occurrences found are the documented
`ThemeToggle`-style mounted-guard idiom comments, not debt markers or unimplemented code. No unreferenced
debt markers — no blocker.

### Human Verification Required

See frontmatter `human_verification` list. Four items, all honestly pre-flagged by plan 10-04's own
`10-VALIDATION.md` (`nyquist_compliant: false`) rather than surfaced fresh by this verification pass:

1. **SIDE-10's live subscribe submit-and-response round trip** — blocked by tool classifier against
   production PII/Resend; render half and all code-level guards are positive.
2. **A11Y-04's simultaneous JS-bypass + real-engine reduced-motion combination** — CDP
   `Emulation.setEmulatedMedia` unavailable to the browsing tool; each layer verified independently.
3. **E7's real-content wide-table/code-block/longest-title backstop** — no qualifying content exists in
   the operator's 3 published posts; a same-CSS-class synthetic proxy was exercised and did not overflow.
4. **SC#5's home-page sticky depth** — only 3 real posts, 900px `scrollHeight`, not enough room to run the
   same 2000px-scroll rigor the post page received; a light check at available depth showed sticky intact.

### Gaps Summary

No code defects found. All 15 requirement rows plus ROADMAP SC#5 are true on their core definition, backed
by direct source reads (not SUMMARY.md claims) and by live browser evidence in `10-EVIDENCE.md`, which this
verification pass independently spot-checked (lint, build, all stop-ship greps, CR-01/WR-01/IN-01 source
state) rather than trusting at face value. The four UNEXERCISED sub-items are honestly recorded, environment-
constrained (production PII/Resend, CDP tooling gap, real content scarcity) rather than code gaps, and match
this project's own established precedent (Phases 7-9 also shipped with `nyquist_compliant: false`). Per this
agent's adversarial-verification mandate, an honestly-recorded gap in runtime observation is routed to human
verification rather than silently passed — hence `status: human_needed` rather than `passed`, even though
zero code-level blockers exist.

---

_Verified: 2026-08-13_
_Verifier: Claude (gsd-verifier)_
