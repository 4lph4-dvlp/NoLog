---
phase: 10
slug: collapsible-sidebars-reading-width
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-12
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
| _pending_ | — | — | — | — | — | — | — | — | ⬜ pending |

*Filled after PLAN.md task IDs exist (plan-phase seeds this file before the planner runs). Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

- [ ] Every task either has an automated `verify` (lint/build/source assertion) or an explicit manual row above
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references *(N/A — no test infrastructure by constraint)*
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s for the automated tier
- [ ] All 15 requirement rows observed green in a real browser before `/gsd-verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
