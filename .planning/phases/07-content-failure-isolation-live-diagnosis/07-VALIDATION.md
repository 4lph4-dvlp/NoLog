---
phase: 7
slug: content-failure-isolation-live-diagnosis
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — repo has zero test infrastructure (no jest/vitest/playwright config, no `*.test.*`), and adding a test framework is explicitly Out of Scope in REQUIREMENTS.md |
| **Config file** | none |
| **Quick run command** | `npm run lint --workspace=apps/web` |
| **Full suite command** | `npm run build --workspace=apps/web` |
| **Estimated runtime** | ~{N} seconds (to be measured during execution) |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint --workspace=apps/web`
- **After every plan wave:** Run `npm run build --workspace=apps/web`
- **Before `/gsd-verify-work`:** Build must succeed and lint must be clean
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | source-assertion | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Filled by the planner / validate-phase. Given no test framework, expect `source-assertion` (grep/build/lint) and `manual-deployed` rows rather than `unit`.*

---

## Wave 0 Requirements

- [ ] None — no test framework may be installed this phase (REQUIREMENTS.md Out of Scope; D-07 no new dependencies).

*Automated verification for this phase is limited to source assertions, `tsc`/`next build`, and ESLint. Behavioral criteria are deployed-site or operator-verified — see below.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A production log line names exactly one failing leg for a real failing request | CONT-01 | Requires a live failing request against the deployed site; `next dev` has no ISR and does not reproduce the failure (PITFALLS 12) | Trigger via the secret-gated debug route on Production, then read the Vercel dashboard runtime logs (Hobby retention ~1h) |
| Live evidence captured (HTTP status + response-body excerpt) and recorded against the six-candidate table with a named verdict | CONT-02 | Evidence is an external observation, not a code property | Follow the phase's operator checklist; record into `07-EVIDENCE.md` |
| A post whose chrome fetch fails still renders its body on the deployed site | CONT-04 | Requires an induced chrome-leg failure on a real deployment | Induce via the debug path / observed live failure; confirm body renders |
| `NOTION_TOKEN_V2` presence in Production; failing page loads logged-out in incognito | CONT-02 (discriminators) | Dashboard/browser observations, no code surface | Operator checklist walked through at execution time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (source assertion / build / lint) or are explicitly listed as manual-only above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — no framework may be added)
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
