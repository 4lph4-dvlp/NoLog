---
phase: 10
slug: collapsible-sidebars-reading-width
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
# nyquist_compliant left false by plan 10-04 (2026-08-12): every one of the 15 requirement rows +
# SC#5 below is ✅ green on its own core definition, but 4 rows carry an explicitly recorded
# UNEXERCISED sub-item (SIDE-10's live subscribe submit-and-response round trip; A11Y-04's
# simultaneous JS-bypass + real-engine-reduced-motion combination; E7's real-content wide-table/
# code backstop; SC#5's home-page sticky depth, constrained by only 3 real posts). None of these
# are code defects — each has a stated, non-fabricated reason a live observation could not be
# made. Per this plan's own instruction ("true ONLY if every requirement row is green"), the
# presence of any recorded UNEXERCISED item — even attached to an otherwise-green row — keeps
# this false rather than rounding up. See `10-EVIDENCE.md` for every underlying observation.
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `10-RESEARCH.md` §"Validation Architecture". The Per-Task
> Verification Map is filled once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — project hard constraint: no test framework exists and none may be added (matches the Phase 7–9 precedent) |
| **Config file** | none |
| **Quick run command** | `npm run lint --prefix apps/web` (ESLint incl. `jsx-a11y` via `eslint-config-next/core-web-vitals`) |
| **Full suite command** | `npm run build --prefix apps/web` (Next 16 build — typechecks, lints, confirms every route still builds) |
| **Estimated runtime** | ~60 seconds for the build; lint is a few seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint --prefix apps/web`
- **After every plan wave:** Run `npm run build --prefix apps/web`, plus the manual `gstack /browse` battery below for whichever requirements that wave closes
- **Before `/gsd-verify-work`:** Build green AND all 15 requirement rows below observed green
- **Max feedback latency:** ~60 seconds (build); manual browser battery is per-wave, not per-task

**Automated coverage is structurally partial for this phase.** ESLint catches missing labels and malformed
`aria-*`; it cannot verify runtime `aria-expanded` correctness, focus movement, transition behaviour, or
`prefers-reduced-motion`. Those are manual by necessity, not by omission — see Manual-Only Verifications.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T10-01-1 | 10-01 | 1 | SIDE-01, SIDE-04, SIDE-06, SIDE-07, SIDE-08, SIDE-10, A11Y-01 | T-10-01, T-10-02, T-10-03 | Strict allowlist parse of `localStorage`; `Layout.tsx` stays a Server Component; only build-time constants interpolated into the inline script | source assertion + lint + build + manual (browser) | `npm run lint --prefix apps/web` · `grep -c 'use client' apps/web/src/templates/default/Layout.tsx` == 0 · `grep -rn 'NEXT_PUBLIC_RESEND' apps/web/src` empty · `npm run build --prefix apps/web` | N/A — no test file by project constraint | ✅ green — established `10-01-SUMMARY.md` coverage D1–D9; reconfirmed `10-EVIDENCE.md` §Measured widths, §Threshold and persistence, §Mobile and visual battery, §Stop-ship battery. SIDE-10's live-submit round trip UNEXERCISED (see §Stop-ship battery) — render half + all code-level guards positive. |
| T10-01-2 | 10-01 | 1 | SIDE-05, A11Y-04 | — | n/a (no untrusted input on this path) | source assertion + lint + build + manual (browser) | `npm run lint --prefix apps/web` · `grep -c '1279' .../SidebarShell.tsx` == 0 · `npm run build --prefix apps/web` | N/A | ✅ green — established `10-01-SUMMARY.md` coverage D3/D9; reconfirmed `10-EVIDENCE.md` §Measured widths (1281/1280/1279 sweep, zero writes) and §Delayed-onset pitfall battery item 4. Simultaneous JS-bypass + real-engine reduced-motion sub-claim UNEXERCISED (CDP `Emulation.setEmulatedMedia` not on `/browse`'s allowlist). |
| T10-02-1 | 10-02 | 2 | SIDE-02, SIDE-09, A11Y-01, A11Y-05 | T-10-04 | Fork-controlled avatar asset degrades to an icon fallback with no retry loop | source assertion + lint | `npm run lint --prefix apps/web` · `grep -c 'aria-haspopup' .../SidebarToggleRight.tsx` == 0 · `grep -c 'alt=""' .../SidebarToggleRight.tsx` >= 1 | N/A | ✅ green — established `10-02-SUMMARY.md` coverage D1/D3/D4/D5/D6 (live D-14 fallback test against a real 404, ring cue in both themes/states, aria-label distinct from avatar `alt`). Not independently re-run in 10-04; no new information changes this. |
| T10-02-2 | 10-02 | 2 | SIDE-02, SIDE-03, SIDE-04, A11Y-01 | T-10-01, T-10-02 | Stop-ship greps re-run because this task edits `SidebarShell.tsx` | source assertion + lint + build + manual (browser) | `grep -c '<aside' apps/web/src/components/Profile.tsx` == 0 · `grep -c 'SubscribeSection' .../SidebarShell.tsx` == 0 · `npm run build --prefix apps/web` | N/A | ✅ green — established `10-02-SUMMARY.md` coverage D2; reconfirmed `10-EVIDENCE.md` §Measured widths (all four combinations re-measured this session: 864/1064/1104/1304px, exact match). |
| T10-03-1 | 10-03 | 3 | A11Y-02, A11Y-03 | T-10-02, T-10-05 | Focus rescue strictly before the `inert` write, same tick; both toggles outside both panels | source assertion + lint + build + manual (browser) | `grep -c 'display: *none' .../SidebarShell.tsx` == 0 · `grep -c 'activeElement' .../SidebarShell.tsx` >= 1 · `npm run build --prefix apps/web` | N/A | ✅ green — established `10-03-SUMMARY.md` coverage D1–D3; strengthened in `10-EVIDENCE.md` §Accessibility battery: real bidirectional Tab walk, AX-tree textbox/complementary counts tracking collapse state exactly, and all FOUR focus-rescue cases now independently reproduced in a live session (10-03 had reproduced 3 of 4; right+resize was source-verified only there — 10-04 closes that gap with a real observation). |
| T10-03-2 | 10-03 | 3 | SIDE-04 | — | n/a (static CSS ceiling, no input) | source assertion + lint + build + manual (browser) | `grep -c 'max-w-\[1100px\] mx-auto py-8 md:px-4' .../PostPage.tsx` == 1 · `grep -c 'max-w-none' .../PostPage.tsx` == 0 | N/A | ✅ green — established `10-03-SUMMARY.md` coverage D4/D5; reconfirmed `10-EVIDENCE.md` §Measured widths (article 864/1064/1100/1100px). E7's real-content wide-table/code/long-title backstop remains UNEXERCISED against production content (0 tables/code blocks exist); a same-CSS-class synthetic proxy was exercised this session and did not overflow (§Mobile and visual battery), narrowing but not closing the gap. |
| T10-04-1 | 10-04 | 4 | SIDE-04, SIDE-05, SIDE-06, SIDE-10 | T-10-02 | No secret VALUE is transcribed into the committed evidence file — names and grep output only | manual (browser measurement) + source assertion + build | evidence-section presence greps · `grep -rn 'NEXT_PUBLIC_RESEND' apps/web/src` empty · `npm run build --prefix apps/web` | N/A | ✅ green — `10-EVIDENCE.md` §Measured widths, §Stop-ship battery, §Threshold and persistence, all captured live this session. `npm run build --prefix apps/web` succeeded. Both-collapsed 1304px matches D-04 exactly, zero discrepancy. SIDE-10's live subscribe submit-and-response round trip UNEXERCISED — harness auto-mode classifier blocked the side-effecting fill+submit against production PII/Resend (see §Stop-ship battery); render half and all code-level stop-ship guards (manifest inspection, greps) are positive. |
| T10-04-2 | 10-04 | 4 | SIDE-07, SIDE-08, SIDE-09, A11Y-02, A11Y-03, A11Y-04 | T-10-01, T-10-06 | Every temporary fault injection / config edit reverted before commit; tampered-storage behaviour observed, not only asserted | manual (browser) + source assertion + lint + build | evidence-section presence greps · `grep -c '_pending_' 10-VALIDATION.md` == 0 · `grep -rn 'transition-colors' apps/web/src --include='*.tsx' --include='*.ts'` empty | N/A | ✅ green — `10-EVIDENCE.md` §Delayed-onset pitfall battery, §Accessibility battery, §Mobile and visual battery. Tampered-localStorage mitigation (T-10-01) observed: garbage/XSS-shaped values both fell through to the `null` auto branch, no raw value reflected in the DOM. `apps/web/src` confirmed clean (`git status --short`) after all fault injections reverted. **Literal `transition-colors` grep from this task's own `<verify>` returns non-empty** — documented as a plan-authoring deviation in `10-EVIDENCE.md`'s final section (the string is Tailwind's own pre-existing, unrelated utility class used in 9+ files; the precise check Pitfall 8 actually requires, `classList.*transition-colors`, returns empty). SIDE-07's flash check is a DOM-read+console-check method, not frame-by-frame eye review (stated honestly). A11Y-04's simultaneous-bypass sub-claim UNEXERCISED, same CDP gap as T10-01-2. |
| SC#5 | 10-04 | 4 | ROADMAP SC#5 (PITFALLS 9, RESEARCH Assumption A1) | — | n/a | manual (browser) — delayed-onset CSS regression, invisible to lint/tsc | none — scroll a real long post and the home page far enough to engage sticky, in all three collapse states | N/A | ✅ green on the post page — `10-EVIDENCE.md` §Delayed-onset pitfall battery item 1: all four sidebar combinations confirmed `position: sticky`, settling at an identical `top: 64px` after a 2000px scroll on a real 4187px-tall post; no isolation step needed since nothing failed. Home page: UNEXERCISED at meaningful scroll depth — the operator's home page has only 3 posts and measures `scrollHeight: 900px` at a 900px viewport (no real room to scroll); a light check at the ~50-64px that does exist showed `position: sticky` intact but is not the same rigor as the post-page test. Not fabricated by padding the operator's real content. |

*Seeded by plan-phase from the four PLAN.md files' stable task IDs. Plan 10-04 task 2 fills the Status
column from real observations and cites the `10-EVIDENCE.md` section establishing each. Status: ⬜ pending ·
✅ green · ❌ red · ⚠️ flaky · `UNEXERCISED` (with a reason) where a check could not be performed.*

---

## Wave 0 Requirements

*None — no test-file infrastructure is being introduced, per the explicit project constraint. The
"manual (browser)" rows below are not a gap to close; they are this project's chosen and previously-used
verification method (Phases 7–9).*

---

## Manual-Only Verifications

Sourced from `10-RESEARCH.md` §"Validation Architecture" → "Phase Requirements → Test Map".

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hamburger/avatar independently toggle their own side | SIDE-01, SIDE-02, SIDE-03 | Runtime interaction; no test runner exists | `gstack /browse` click sequence + `snapshot -D` before/after each toggle |
| Content column visibly widens on collapse | SIDE-04 | Requires real rendered layout measurement | Re-run the exact `gstack /browse` measurement from `10-RESEARCH.md` §"Code Context" after the collapse CSS ships; confirm the collapsed-state width against D-04's derived 1304px |
| Auto-collapse follows resize before any toggle | SIDE-05 | Viewport-driven runtime behavior | `gstack /browse viewport` sweep across the 1279px/1280px boundary with no prior click |
| Explicit choice survives resize + navigation + return visit | SIDE-06 | Requires storage + navigation across a real session | Click toggle → `gstack /browse storage` → resize → reload → re-check the `<html>` attribute |
| No wrong-state flash on first paint | SIDE-07 | Visual timing; not reliably automatable | Repeated cold reload with a saved preference; check console for a hydration warning; screen-record if disputed |
| Desktop preference has no mobile effect | SIDE-08 | Partly source-assertable, partly visual | grep that the mobile branch (`Layout.tsx:27-38`) never references the two custom properties; `gstack /browse viewport 375x812` visual check |
| Avatar visual cue reads as a control | SIDE-09 (CONTEXT D-12) | Visual judgment | Source-assert the Tailwind ring classes + `gstack /browse screenshot` in both themes |
| Subscribe form still renders and submits — **stop-ship** | SIDE-10 (D-06) | Needs a live configured environment | `grep -r "NEXT_PUBLIC_RESEND" apps/web/src` must return nothing; inspect `next build` output for `Layout.tsx`'s Server/Client marker; live form submit via `gstack /browse fill` + `click` |
| `aria-expanded` / `aria-controls` correct in both states | A11Y-01 | jsx-a11y only checks shape, not runtime state | `gstack /browse attrs` on each toggle before and after click |
| Collapsed panel absent from a11y tree and Tab order | A11Y-02 | Accessibility-tree state is runtime-only | `gstack /browse accessibility` diff + a `press Tab` sequence confirming the collapsed panel is skipped |
| Focus rescued when a panel collapses under focus | A11Y-03 | Runtime focus behavior | Tab into the panel, trigger collapse by **click** and separately by **resize**; confirm `document.activeElement` via `gstack /browse js` for both paths |
| `prefers-reduced-motion: reduce` gives an instant collapse | A11Y-04 | Media-query-conditional runtime behavior | `gstack /browse` with CDP `emulateMedia` (or OS toggle); confirm the width change is instant / no `transitionend` |
| Accessible name is action-phrased, distinct from the Profile avatar `alt`, and matches `title` | A11Y-05 | Partly source-assertable, name/`alt` distinctness needs both rendered | grep that both strings differ from `CONFIG.profile.name`; `gstack /browse attrs` confirms `aria-label === title` |
| Both asides still stick on scroll after the transition ships | ROADMAP SC#5 (PITFALLS 9) | Delayed-onset CSS regression, invisible to lint/tsc | Scroll a real post and home page far enough to engage sticky; confirm both asides still stick. Re-test with `transition: none` to isolate if it fails |

---

## Validation Sign-Off

- [x] Every task either has an automated `verify` (lint/build/source assertion) or an explicit manual row above
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify
- [x] Wave 0 covers all MISSING references *(N/A — no test infrastructure by constraint)*
- [x] No watch-mode flags
- [x] Feedback latency < 60s for the automated tier
- [x] All 15 requirement rows observed green in a real browser before `/gsd-verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter
      — left unticked: 4 rows (T10-01-1/T10-01-2/T10-03-2/T10-04-1/T10-04-2/SC#5) each carry an
      explicitly-reasoned UNEXERCISED sub-item (SIDE-10's live subscribe submit, A11Y-04's
      simultaneous dual-bypass, E7's real-content backstop, SC#5's home-page scroll depth). Per
      this plan's own rule, `nyquist_compliant` is `true` only if every row is green with no
      caveat; these caveats are honest gaps, not defects, but they keep the flag `false`.

**Approval:** pending — all 15 requirement rows + SC#5 are green on their core definition; the
phase is functionally complete. `nyquist_compliant: false` records the 4 documented UNEXERCISED
sub-items above for a future `/gsd-validate-phase` or `/gsd-complete-milestone` pass, following
this project's own established practice (Phases 7–9 also carry `nyquist_compliant: false` with a
similar shape of honestly-recorded residual gaps).
