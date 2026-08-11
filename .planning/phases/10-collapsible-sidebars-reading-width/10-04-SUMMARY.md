---
phase: 10-collapsible-sidebars-reading-width
plan: 04
subsystem: ui
tags: [nextjs, react, accessibility, css-custom-properties, evidence, validation, gstack-browse]

# Dependency graph
requires:
  - phase: 10-01
    provides: "SidebarShell.tsx's left-side tri-state machinery, the shared sidebar.ts constants module, the pre-hydration script"
  - phase: 10-02
    provides: "The right-side avatar toggle wired into the same per-side machinery; the measured four-combination width table"
  - phase: 10-03
    provides: "applyCollapse's shared focus-rescue-then-inert routine; the max-w-[1100px] reading-width cap on PostPage.tsx"
provides:
  - .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md — the phase's full measured/observed evidence record (widths, stop-ship battery, persistence, pitfall battery, a11y battery, mobile/visual battery)
  - .planning/phases/10-collapsible-sidebars-reading-width/10-VALIDATION.md — Per-Task Verification Map filled with real observations for all 8 task IDs plus SC#5, nyquist_compliant set from actual evidence
  - A corrected 10-UI-SPEC.md Reading-Width Contract paragraph (1104px/1100px/~2px, not the double-counted 1136px/18px)
  - A fourth, independently-reproduced focus-rescue case (right+resize) closing 10-03's source-verified-only gap
affects: [gsd-validate-phase, gsd-complete-milestone]

# Actuals (#2632)
actuals:
  tokens: 12270
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Client-side-only DOM text injection (no source/content edits) to exercise fixed-width-wrapper overflow backstops without touching apps/web/src or production Notion content"
    - "CDP Accessibility.getFullAXTree read directly (not gstack /browse's own snapshot -i, which does not honor inert) for authoritative accessibility-tree membership counts"
    - "window.matchMedia monkey-patch for prefers-reduced-motion, since CDP Emulation.setEmulatedMedia is outside the /browse tool's CDP allowlist"

key-files:
  created:
    - .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md
    - .planning/phases/10-collapsible-sidebars-reading-width/deferred-items.md
  modified:
    - .planning/phases/10-collapsible-sidebars-reading-width/10-VALIDATION.md
    - .planning/phases/10-collapsible-sidebars-reading-width/10-UI-SPEC.md

key-decisions:
  - "Corrected 10-UI-SPEC.md's Reading-Width Contract asymmetric-collapse paragraph (1104px/1100px/~2px replacing the double-counted 1136px/18px) since this is the last plan in the phase and a known-wrong number left in a contract a future phase re-reads verbatim is a real hazard"
  - "Declined to work around the harness's auto-mode classifier blocking the live subscribe form submit (real PII against the operator's production Resend audience) — recorded UNEXERCISED with the classifier's own denial reason rather than fabricating a submit result or bypassing the safety gate"
  - "Declined to mutate the operator's production Notion content to manufacture a wide-table/code-block test case for E7; instead ran a client-side-only DOM injection using react-notion-x's own .notion-simple-table/.notion-code CSS classes as a closer, non-fabricated proxy — narrows but does not close the real-content gap, and is reported as exactly that, not as a pass"
  - "Documented two plan-authoring deviations (the literal 'transition-colors' grep matching Tailwind's own unrelated utility class in 9+ files, and the self-referential '_pending_' grep quoting itself in the Verification Map's own documentation) rather than deleting legitimate pre-existing code to force an over-broad literal check to pass"
  - "nyquist_compliant left false: every requirement row is green on its own core definition, but 4 rows carry an honestly-recorded UNEXERCISED sub-item (SIDE-10 live submit, A11Y-04 dual-bypass, E7 real-content backstop, SC#5 home-page scroll depth) — per the plan's own rule, any UNEXERCISED item keeps the flag false rather than rounding up"

patterns-established:
  - "Evidence files record the literal command/output pair for every stop-ship or security-relevant check, never a paraphrase — established by 07/08/09-EVIDENCE.md, continued here"

requirements-completed: [SIDE-04, SIDE-05, SIDE-06, SIDE-07, SIDE-08, SIDE-09, SIDE-10, A11Y-02, A11Y-03, A11Y-04]

coverage:
  - id: D1
    description: "Collapsed-state content-column width measured against D-04's derived 1304px, closing D-09's remaining obligation (SIDE-04)"
    requirement: "SIDE-04"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — all four sidebar combinations re-measured live at 1400px: both expanded 864px, left-only collapsed 1064px, right-only collapsed 1104px, both collapsed 1304px (exact match to D-04's derived value, zero discrepancy); article width on a real post measured in each state (864/1064/1100/1100px)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both asides still stick on scroll after the transition CSS shipped, in all four sidebar combinations, on a real long post"
    requirement: "ROADMAP SC#5"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — scrolled a real 4187px-tall post to 2000px; both <aside>s report position:sticky and settle at an identical top:64px in all four combinations; no isolation step needed since nothing failed"
        status: pass
    human_judgment: false
  - id: D3
    description: "Home page sticky check at meaningful scroll depth"
    verification: []
    human_judgment: true
    rationale: "The operator's home page has only 3 published posts and measures scrollHeight:900px at a 900px viewport (664px even at a 600px viewport) — there is genuinely not enough real content to scroll far enough to stress-test sticky the way the 4187px post page allows. A light check at the ~50-64px of scroll room that does exist showed position:sticky intact, but this is not the same rigor as the post-page test and is recorded as UNEXERCISED-at-depth rather than a full pass."
  - id: D4
    description: "SIDE-10's stop-ship guard verified three independent ways with literal output"
    requirement: "SIDE-10"
    verification:
      - kind: other
        ref: "grep -rn NEXT_PUBLIC_RESEND apps/web/src (empty) and repo-wide; grep -c 'use client' Layout.tsx == 0; compiled .next client-reference-manifest inspected directly — SidebarShell.tsx present as the sole client boundary, Layout.tsx and SubscribeSection.tsx both absent from it"
        status: pass
      - kind: automated_ui
        ref: "gstack /browse — subscribe heading/email field/구독 button all rendered live with the operator's configured Resend vars"
        status: pass
    human_judgment: true
    rationale: "The live submit-and-response round trip could not be exercised: the harness's auto-mode permission classifier explicitly blocked filling the email field with a real address and clicking submit, since it is a side-effecting write of PII against the operator's production Resend audience. Recorded UNEXERCISED with that stated reason rather than fabricated. The render half and all code-level stop-ship guards above are positively confirmed."
  - id: D5
    description: "The three delayed-onset pitfalls (true 0px collapse, dead-CSS confirmation, reduced-motion double guard) each recorded from real observation"
    requirement: "A11Y-04"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — collapsed track width reads exactly 0 (both sides) with inert set and no visible content escape; window.matchMedia monkey-patched for reduced-motion showed an instant collapse (no data-sidebar-transition attribute) vs. the unpatched case's real ~350ms animated transition; globals.css's @media (prefers-reduced-motion: no-preference) wrapper confirmed present and unmodified"
        status: pass
    human_judgment: true
    rationale: "The specific combination of 'JS guard bypassed AND the real browser-engine reduced-motion preference active simultaneously' could not be forced live — CDP's Emulation.setEmulatedMedia remains outside the /browse tool's allowlist (confirmed denied again this session). The two guards were each independently confirmed (JS-layer via matchMedia patch, CSS-layer via source assertion); their simultaneous-bypass combination is recorded UNEXERCISED with this reason."
  - id: D6
    description: "Full accessibility battery: aria-expanded/controls, AX-tree membership, real Tab walk, and all four focus-rescue cases"
    requirement: "A11Y-02, A11Y-03"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — aria-expanded/label/title flip correctly on click for both toggles; CDP Accessibility.getFullAXTree shows 0 textbox/0 complementary with both panels collapsed, exactly 1 of each when one side is expanded; real bidirectional Tab walk confirms the collapsed side's controls are skipped, the expanded side's are reachable; all four focus-rescue cases (left/right x click/resize) independently reproduced with document.activeElement landing on the correct toggle -- closing 10-03's previously source-verified-only right+resize case"
        status: pass
    human_judgment: false
  - id: D7
    description: "Mobile stack unaffected by desktop sidebar preference; SIDE-08/SIDE-09 visual battery"
    requirement: "SIDE-08, SIDE-09"
    verification:
      - kind: automated_ui
        ref: "gstack /browse 375x812 — no horizontal scroll, ThemeToggle/Profile/Subscribe/Search/Categories order confirmed, single visible ThemeToggle instance; explicit desktop collapsed=true preference produced zero visible mobile effect (main=343px, no scroll); avatar ring confirmed identical across light/dark x expanded/collapsed"
        status: pass
    human_judgment: false
  - id: D8
    description: "E5/E6 long-text overflow backstops (category name, profile bio) inside the fixed-width wrapper"
    requirement: "SIDE-04"
    verification:
      - kind: automated_ui
        ref: "gstack /browse — client-side DOM text injection (no source/content edit) into the visible desktop category link and the Profile bio paragraph; wrapperScrollWidth === wrapperClientWidth (200px / 240px) in both cases, both themes — text clips or wraps without ever growing the wrapper"
        status: pass
    human_judgment: false
  - id: D9
    description: "E7 wide-table/code-block/long-title overflow backstop at the 1100px cap"
    verification: []
    human_judgment: true
    rationale: "The operator's 3 published posts contain zero tables and zero code blocks (re-confirmed this session, matching 10-03's D5) -- the real-content condition remains unexercisable without mutating production Notion content, which this plan declines to do (matching Phase 9's IMG-05/09-CONTEXT D-13 precedent). A same-CSS-class synthetic proxy (react-notion-x's own .notion-simple-table/.notion-code classes with realistic sentence-length text) was exercised instead and did not overflow (article.scrollWidth === clientWidth === 1100px, both themes), and the longest real title ('Antigravity 2.0 사용기') also did not overflow -- but this narrows rather than closes the gap, so it is recorded UNEXERCISED against real content, not as a pass."

duration: ~40min
completed: 2026-08-12
status: complete
---

# Phase 10 Plan 04: Evidence and Validation Summary

**Closes the phase's evidence gap with live `gstack /browse` measurement — both-collapsed width confirmed exactly 1304px against D-04's derived value, sticky survival confirmed in all four sidebar combinations on a real post, all four A11Y-03 focus-rescue cases independently reproduced (closing 10-03's one source-verified-only gap), and `10-VALIDATION.md`'s 15-requirement-plus-SC#5 map filled from real observation with `nyquist_compliant` left honestly `false` against four documented UNEXERCISED items.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-12T08:01:43+09:00
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **Both-collapsed width measured, not derived: 1304px, exact match to D-04.** Re-ran RESEARCH.md's identical `gstack /browse` procedure against the shipped collapse CSS. All four combinations at 1400px: 864/1064/1104/1304px — zero discrepancy from any prior wave's own measurement or the arithmetic-derived value.
- **Sticky survival confirmed, not assumed: PITFALLS 9 closed on the post page.** All four sidebar combinations, scrolled 2000px on a real 4187px-tall post: both `<aside>`s report `position: sticky` and settle at an identical `top: 64px` rest position. The home page's own sticky check is honestly recorded as UNEXERCISED-at-depth — only 3 real posts give 900px of scroll room, not enough to meaningfully stress-test it, and this plan did not pad the operator's real content to manufacture scroll depth.
- **All four A11Y-03 focus-rescue cases now independently reproduced live** (left+click, right+click, left+resize, right+resize) — 10-03 had reproduced three of four and left right+resize as source-verified only; this plan closes that gap with a real `document.activeElement` observation.
- **CDP `Accessibility.getFullAXTree` (not `gstack /browse`'s own `snapshot -i`, which doesn't honor `inert`) confirms A11Y-02 precisely:** zero `textbox`/`complementary` roles with both panels collapsed, exactly one of each when one side is expanded — the count tracks collapse state exactly, not an unrelated tree-size artifact.
- **SIDE-10's stop-ship guard closed three independent ways with literal output**, including a stronger check than the plan's own suggestion: the compiled `.next` client-reference-manifest directly confirms `SidebarShell.tsx` is the only client boundary, with `Layout.tsx` and `SubscribeSection.tsx` both absent from it (Next 16's build output no longer prints a per-component Server/Client route marker, so this is a more authoritative substitute). The live subscribe submit-and-response round trip is recorded UNEXERCISED — the harness's own auto-mode classifier blocked filling the form with real PII against the operator's production Resend account, and this plan did not attempt to work around that denial.
- **E5/E6 long-text backstops closed via client-side-only DOM injection** (no source or Notion content edits): a long category name and a long bio both stayed inside their fixed 200px/240px wrappers in both themes. **E7's wide-table/code-block backstop was narrowed, not closed:** a same-CSS-class synthetic proxy (using `react-notion-x`'s real `.notion-simple-table`/`.notion-code` classes) did not overflow the 1100px cap, but the operator's 3 real posts still contain zero tables/code blocks, so this remains recorded as UNEXERCISED against actual production content.
- **Tampered-`localStorage` mitigation (T-10-01) observed directly:** a garbage string and an XSS-shaped string both fell through the strict allowlist parse to the `null`/auto branch — neither was ever reflected raw into the DOM.
- **`10-UI-SPEC.md`'s Reading-Width Contract corrected in place:** the asymmetric-collapse paragraph's double-counted arithmetic (1136px/18px) replaced with the actual measured figure (1104px/1100px/~2px slack), flagged by wave 3 but left unedited until this last plan in the phase.
- **Green count vs. UNEXERCISED count:** all 15 requirement rows + SC#5 in `10-VALIDATION.md` are ✅ green on their own core definition. 4 rows additionally carry an honestly-recorded UNEXERCISED sub-item (SIDE-10 live submit, A11Y-04 simultaneous dual-bypass, E7 real-content backstop, SC#5 home-page scroll depth). **`nyquist_compliant` is left `false`** per the plan's own rule that it is `true` only if every row is green with zero caveat — none of the four are code defects, all four have a stated, non-fabricated reason.

## Task Commits

1. **Task 1 (T10-04-1): Measure the collapsed state and run the stop-ship battery** - `3168b8c` (docs)
2. **Task 2 (T10-04-2): Delayed-onset pitfall battery, a11y battery, and fill the validation map** - `2c3e0ac` (docs)

_Note: no TDD tasks in this plan; the plan-level metadata commit (STATE.md/ROADMAP.md/REQUIREMENTS.md) is produced in the state-update step immediately following this SUMMARY._

## Files Created/Modified

- `.planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md` — the phase's full measured/observed evidence record: measured widths, stop-ship battery, threshold/persistence, delayed-onset pitfall battery, accessibility battery, mobile/visual battery, and two documented plan-authoring deviations
- `.planning/phases/10-collapsible-sidebars-reading-width/10-VALIDATION.md` — Per-Task Verification Map filled with real observations for all 8 task IDs plus SC#5; `nyquist_compliant` set to `false` with the frontmatter comment listing exactly what's outstanding
- `.planning/phases/10-collapsible-sidebars-reading-width/10-UI-SPEC.md` — Reading-Width Contract's asymmetric-collapse paragraph corrected (1104px/1100px/~2px, not 1136px/18px)
- `.planning/phases/10-collapsible-sidebars-reading-width/deferred-items.md` — new: logs an out-of-scope console error discovered during the battery (see Issues Encountered)

## Decisions Made

- Corrected `10-UI-SPEC.md`'s known-wrong arithmetic paragraph in place, since this is the last plan in the phase and leaving it wrong risks a future phase re-reading it verbatim.
- Declined to bypass the harness classifier's block on the live subscribe-form submit — recorded UNEXERCISED with the classifier's own stated reason rather than fabricating a result or working around a safety gate protecting real PII against a production API.
- Declined to mutate the operator's production Notion content to manufacture an E7 wide-table/code-block test case (matching Phase 9's IMG-05/09-CONTEXT D-13 precedent); used a client-side-only DOM injection with `react-notion-x`'s own real CSS classes as a closer, honestly-labeled proxy instead.
- Documented two plan-authoring deviations rather than deleting legitimate pre-existing code: the literal `grep -rn 'transition-colors'` check in Task 2's own `<verify>` is over-broad (matches Tailwind's unrelated utility class in 9+ files); the `_pending_` grep is self-referential once quoted into the Verification Map's own documentation.
- Left `nyquist_compliant: false` — every row is green on its core definition, but 4 rows carry an honestly-recorded UNEXERCISED sub-item, and the plan's own rule requires zero caveats for `true`.

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 code auto-fixes were required or applicable (this plan writes only planning artifacts and never modifies `apps/web/src` except via reverted, client-side-only browser injections).

### Plan-Authoring Deviations (documented, not "fixed" by deleting code)

**1. [Deviation] Task 2's literal `transition-colors` grep is over-broad**
- **Found during:** Task 2's own automated verify pass
- **Issue:** `grep -rn 'transition-colors' apps/web/src --include='*.tsx' --include='*.ts'` was specified to return zero lines, but this substring is Tailwind's own pre-existing, widely-used utility class name (button/link hover treatments across 9+ files: `ThemeToggle.tsx`, `Profile.tsx`, `CategoryList.tsx`, `SubscribeForm.tsx`, `SidebarToggleLeft.tsx`, every `templates/default/*Page.tsx`), unrelated to Pitfall 8's actual concern (the dead `html.transition-colors` class-toggle mechanism). This check cannot pass on any state of this codebase without deleting real, unrelated code.
- **Resolution:** substituted the precise check Pitfall 8 actually requires (`grep -rn "classList.*transition-colors\|transition-colors.*classList\|documentElement.*transition-colors"`), which returns zero matches, confirming no code hooks into `html.transition-colors`. No file was modified.
- **Files modified:** none
- **Verification:** both grep outputs recorded verbatim in `10-EVIDENCE.md`'s final section

**2. [Deviation] The `_pending_` verify command is self-referential**
- **Found during:** Task 2's automated verify pass
- **Issue:** `grep -c '_pending_' 10-VALIDATION.md == 0` is quoted as its own "Automated Command" documentation inside the Verification Map row it's checking, so the literal substring `_pending_` necessarily appears in the file forever after (in the command's own self-documentation), even though zero Status cells contain a real pending marker.
- **Resolution:** noted as harmless in `10-EVIDENCE.md`; no fix needed since the actual intent (no row's Status column reads `⬜ pending`) is satisfied.
- **Files modified:** none

---

**Total deviations:** 2 documented plan-authoring quirks, 0 code auto-fixes.
**Impact on plan:** Neither affects the phase's substantive correctness. Both are recorded transparently rather than silently declared passing or "fixed" by deleting legitimate, unrelated code.

## Issues Encountered

- **Out-of-scope console error, logged to `deferred-items.md`, not fixed:** a hard `goto` (full page load) to any `/post/[id]` route logs one React `[error]`-level console line ("Can't perform a React state update on a component that hasn't mounted yet"). A hard `goto` to `/` (home) does not. Since `SidebarShell.tsx` wraps both home and post pages identically and this plan's isolation test rules it out (home page, also wrapped by `SidebarShell`, produces zero such errors), the cause lies in post-only code (`PostThumbnailImage`, `NotionPageRenderer`, `MermaidBlock`, or `react-notion-x` internals) — none of which any Phase 10 plan touches. Recorded per the Scope Boundary protocol; recommend carrying into `/gsd-complete-milestone`'s audit or a targeted `/gsd-debug` pass.
- **`gstack /browse` element-ref staleness after a toggle's own accessible-name change** (a known limitation carried forward from waves 1-3, not rediscovered): clicking a toggle changes its `aria-label`/`title` between "Show..."/"Hide...", which invalidates the prior `@e` ref. Worked around by re-running `snapshot` for fresh refs after every toggle click, and by reading `data-sidebar-*` attributes directly via `js` for state-of-truth checks rather than trusting a possibly-stale ref's success.
- **CDP `Emulation.setEmulatedMedia` confirmed still outside the `/browse` tool's allowlist** (re-confirmed, not rediscovered) — this is why A11Y-04's "JS bypassed AND real reduced-motion simultaneously" sub-claim stays UNEXERCISED rather than performed via a workaround.
- **`ThemeToggle` renders twice in the DOM** (mobile-hidden + desktop-pinned instances sharing the same `aria-label`, confirmed correct code per wave 3's own finding, not rediscovered) — worked around by setting theme state directly via `classList`/`localStorage` for the E5/E6/E7 screenshot passes rather than a plain attribute-selector click.

## User Setup Required

None — no external service configuration required. The `.env.local` Resend credentials used for the stop-ship battery's render check are the operator's own pre-existing configuration; nothing new was added.

## Next Phase Readiness

- Phase 10 is functionally complete: all 15 requirements + ROADMAP SC#5 have a real, cited observation in `10-EVIDENCE.md`, and `10-VALIDATION.md`'s Per-Task Verification Map has zero `⬜ pending` rows.
- `nyquist_compliant: false` is the honest, deliberate state for `/gsd-validate-phase` or `/gsd-complete-milestone` to pick up next — the four outstanding UNEXERCISED items (SIDE-10 live submit, A11Y-04 dual-bypass, E7 real-content backstop, SC#5 home-page depth) are all clearly reasoned, non-fabricated gaps, not defects, matching this project's own established precedent from Phases 7-9 (which also carry `nyquist_compliant: false` with a similar shape of residual, honestly-recorded gaps).
- One out-of-scope console error (React state-update-before-mount on post pages, not home) was discovered and logged to `deferred-items.md` rather than fixed — carry into a future audit or debug pass.
- No blockers. `apps/web/src` confirmed clean of all fault-injection/DOM-test scaffolding at every commit boundary in this plan.

---
*Phase: 10-collapsible-sidebars-reading-width*
*Completed: 2026-08-12*

## Self-Check: PASSED
All referenced files and commit hashes verified present in the working tree / git history.
