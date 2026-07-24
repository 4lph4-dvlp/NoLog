---
phase: 1
slug: notion-data-layer
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-24
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework exists in this repo; adding one is explicitly out of scope (REQUIREMENTS.md "Out of Scope") |
| **Config file** | none |
| **Quick run command** | `npx tsx <ad-hoc-script>.ts` (manual, ad-hoc — see RESEARCH.md Code Examples) |
| **Full suite command** | n/a — no automated suite exists |
| **Estimated runtime** | ~1-2 minutes per manual script (live Notion API round-trip) |

---

## Sampling Rate

- **After every task commit:** Run the relevant manual verification script (mark-then-requery for DATA-01/02, or the 403 capability test for DATA-04) against a real/test Notion workspace.
- **After every plan wave:** Re-run both manual scripts once DATA-01/DATA-02/DATA-04 are all implemented together, confirming the full flow end-to-end.
- **Before `/gsd-verify-work`:** Both manual verification scripts must show PASS output; capture console output as evidence (no CI exists to attach automated results to).
- **Max feedback latency:** ~2 minutes (bounded by live Notion API round-trip time, not test-runner overhead).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (set by planner) | TBD | TBD | DATA-01 | — | `getUnemailedPublicPosts()` returns only `status=public AND Emailed=false` posts | manual | none — mark-then-requery script (RESEARCH.md Code Examples) | ❌ W0 | ⬜ pending |
| TBD (set by planner) | TBD | TBD | DATA-02 | — | `markEmailed(pageId)` issues correct checkbox PATCH body; change visible on subsequent read | manual | same mark-then-requery script as DATA-01 | ❌ W0 | ⬜ pending |
| TBD (set by planner) | TBD | TBD | DATA-04 | T-1-01 | `markEmailed` throws `NotionCapabilityError` (instanceof-distinguishable) on 403 | manual | manual 403 test script (RESEARCH.md Code Examples) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*None: Existing infrastructure covers all phase requirements. No automated test framework install is needed — this phase's verification is manual-only by design (see Test Infrastructure above).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A post is excluded from `getUnemailedPublicPosts()` immediately after `markEmailed(pageId)` succeeds against it | DATA-01, DATA-02 | No test framework in repo; behavior depends on live Notion API/database state that shouldn't be mocked (risk of mock/reality divergence) | Query `getUnemailedPublicPosts()`, note count; call `markEmailed()` on the first result; re-query; confirm that post is no longer present (RESEARCH.md "mark-then-requery" script) |
| `markEmailed()` logs/throws a distinguishable error when the integration lacks "Update content" capability | DATA-04 | Requires temporarily revoking a real Notion integration's capability in the Developer Portal — cannot be simulated without risking divergence from Notion's actual 403 behavior | Temporarily revoke "Update content" capability on the test integration; call `markEmailed()`; confirm the thrown error is `instanceof NotionCapabilityError` (not a generic `Error`); restore the capability afterward (RESEARCH.md "403 capability test" script) |
| The `Emailed` property missing from the database schema entirely produces a distinguishable, friendly error rather than a raw/unexplained Notion error (D-01) | DATA-01, DATA-02 | Notion's public docs don't specify the exact error shape for a schema-absent property (RESEARCH.md Open Question #1) — must be confirmed against a real workspace, not assumed | Temporarily rename/remove the `Emailed` property on a test database; call `getUnemailedPublicPosts()`/`markEmailed()`; inspect the actual error status/message and adjust the detection condition in code to match reality before considering D-01 done |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies — N/A here; all tasks route to the manual verifications above instead
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify — N/A (phase is manual-only by design, justified above)
- [ ] Wave 0 covers all MISSING references — N/A, no Wave 0 needed
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
