---
phase: 6
slug: documentation
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no test framework (standing, tracked limitation; see TODOS.md/STATE.md) |
| **Config file** | N/A |
| **Quick run command** | N/A — see manual checks below |
| **Full suite command** | N/A |
| **Estimated runtime** | N/A |

This is a documentation-only phase (README.md/README_KR.md edits, no application code). There is no automated test suite to extend, and adding one would be disproportionate scope creep beyond DOCS-01/02/03 (per 06-RESEARCH.md Wave 0 Gaps).

---

## Sampling Rate

- **After every task commit:** Re-read the edited section of both README files; confirm English/Korean parity (same heading position, same facts present in both)
- **After every plan wave:** Full read-through of both complete README files, plus a Mermaid diagram render check (GitHub's native Markdown preview or a Mermaid live-renderer) to confirm the new `Notifications` subgraph renders without syntax errors
- **Before `/gsd-verify-work`:** Full read-through of both README files against all three DOCS-01/02/03 success criteria
- **Max feedback latency:** N/A (manual inspection, not command-driven)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DOCS-01 | — | Env var block uses placeholder values only, never a real secret | manual | `grep -c "RESEND_API_KEY\|RESEND_AUDIENCE_ID\|CRON_SECRET\|NOTIFY_PHYSICAL_ADDRESS" README.md README_KR.md` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | DOCS-01 | — | `emailed` Notion property documented with exact name/type, capability grant documented as its own step | manual | Read both README files; confirm both are separately-labeled steps, not folded into "set env vars" | ✅ | ⬜ pending |
| 06-01-03 | 01 | 1 | DOCS-02 | — | Domain/SPF/DKIM verification framed as mandatory; correct quota (1,000 contacts/month) stated with explicit disambiguation from the 100/day transactional cap | manual | Read both README files; confirm mandatory framing and both quota figures with disambiguation | ✅ | ⬜ pending |
| 06-01-04 | 01 | 1 | DOCS-03 | — | Cron Production-only + UTC-only behavior stated adjacent to the schedule description | manual | Read both README files; confirm both facts appear near the cron schedule mention | ✅ | ⬜ pending |
| 06-01-05 | 01 | 1 | — | — | Mermaid diagram and Core Services/Features tables updated in both files, consistent with existing Cusdis representation | manual | Render diagram via GitHub Markdown preview; confirm no syntax errors and a new `Notifications` subgraph exists | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework install is being proposed for this documentation-only phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| README.md/README_KR.md list the 4 env vars, `emailed` property, and Notion capability grant as separate explicit steps | DOCS-01 | No test framework exists; this is prose content, not executable behavior | Read both files after edit; confirm 4 env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`, `NOTIFY_PHYSICAL_ADDRESS`) appear only in the new section's own fenced block (not merged into "Environment Variables"); confirm the capability grant is its own numbered line, not folded into the existing step 4 |
| README.md/README_KR.md mandate domain/SPF/DKIM verification and state the correct quota | DOCS-02 | Prose content; no automatable assertion | Read both files; confirm the domain-verification step is phrased as mandatory (not "optional"/"recommended"); confirm quota text states 1,000 contacts/month AND explicitly rules out the 100/day transactional figure as inapplicable to this feature |
| README.md/README_KR.md state Production-only, UTC cron behavior | DOCS-03 | Prose content; no automatable assertion | Read both files; confirm both facts appear adjacent to the cron schedule mention |
| Mermaid diagram renders without syntax errors and matches existing label/node conventions | — (D-10/D-11) | No local Mermaid renderer/CI check in this repo | Paste the diagram into a Mermaid live-renderer or view via GitHub's native Markdown preview; confirm the new `Notifications` subgraph renders and matches the existing `-->|Label|` edge convention |
| English/Korean parity — every new section, warning, and table row has a 1:1 counterpart at the same heading position | DOCS-01/02/03 | Prose/translation quality; no automated i18n check exists in this repo | Diff the heading structure of both files; confirm the new section, diagram subgraph, table rows, and bullet appear at the same relative position in both |

---

## Validation Sign-Off

- [ ] All tasks have manual verify steps (no automated command applies — documentation-only phase)
- [x] Sampling continuity: N/A — no automated tests exist project-wide (standing limitation, not introduced by this phase)
- [x] Wave 0 covers all MISSING references — none required
- [x] No watch-mode flags — N/A
- [ ] Feedback latency < N/A (manual inspection only)
- [ ] `nyquist_compliant: true` set in frontmatter — pending manual verification during/after execution

**Approval:** pending
