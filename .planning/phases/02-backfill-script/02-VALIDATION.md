---
phase: 2
slug: backfill-script
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — no test framework exists in this repo; explicitly out of scope per `REQUIREMENTS.md` |
| **Config file** | none |
| **Quick run command** | `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` (manual, against a real/test Notion workspace) |
| **Full suite command** | n/a — no automated suite exists |
| **Estimated runtime** | dry-run: seconds; live run: ~0.4s × N posts |

**Prerequisite for every command above:** `npm run build --workspace=@4lph4/nolog-core` first — the script imports from `dist/`, not `src/` (established pitfall, see `verify-phase-1.ts` header). `NOTION_TOKEN` and `NOTION_DATABASE_ID` must be exported in the shell (D-13).

---

## Sampling Rate

- **After every task commit:** Run `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` once the fetch/dry-run path exists; run a small-scale live run against a test database once the write loop exists.
- **After every plan wave:** Run all five manual scenarios in the verification map below end-to-end against a live test database.
- **Before `/gsd-verify-work`:** All five scenarios executed, console output captured as evidence (this repo has no CI to attach automated results to — mirrors Phase 1's `01-UAT.md` precedent).
- **Max feedback latency:** manual — bounded by operator time, not tooling.

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed on behavior and is bound to concrete task IDs at execution time.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | DATA-03 (SC#1) | — | Marks all N pre-existing public posts as `emailed`, prints "N marked / M failed" | manual-only | Live run against test DB, then confirm `getUnemailedPublicPosts()` returns `[]` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DATA-03 (SC#2) | — | Interrupt mid-run, re-run processes only still-unmarked posts, no re-marking or erroring | manual-only | Run, `Ctrl+C` partway (400ms delay gives a comfortable window), re-run, confirm the second run's "found N unemailed" reflects only the remainder | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | DATA-03 (SC#3) | — | Request rate stays within Notion's ~3 req/s | manual-only | Run against 10+ posts, inspect per-post log timestamps for ≥~400ms gaps (~2.5 req/s), confirm no 429s | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-04 (abort path) | T-02-01 | `NotionCapabilityError` aborts immediately with exactly one message, non-zero exit | manual-only | Revoke "Update content" (same technique as `verify-403.ts`), run against 2+ unemailed posts, confirm one abort message (not N) and `echo $?` non-zero | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-05 (abort path) | T-02-01 | `MissingEmailedPropertyError` aborts immediately | manual-only | Remove the `emailed` property (same technique as `01-UAT.md` test 3), run, confirm abort message and non-zero exit | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | D-01/D-03 (dry-run) | T-02-02 | `--dry-run` writes nothing and lists count + per-post titles | manual-only | Run with `--dry-run` against a DB with unemailed posts, then confirm `getUnemailedPublicPosts()` count is unchanged | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Justification for manual-only:** Identical rationale to Phase 1 — no test framework exists in this repo (explicit, tracked project decision in `REQUIREMENTS.md` Out of Scope), and this script's correctness depends on live Notion API timing and error behavior that would diverge from reality if mocked. The ROADMAP's own Phase 2 success criteria are written observationally ("logs a final count", "confirmed by inspecting timing/log output"), consistent with this approach.

---

## Wave 0 Requirements

- [ ] `packages/core/scripts/backfill.ts` — does not exist yet; this phase's entire deliverable
- [ ] `packages/core/package.json` `backfill` script entry — does not exist yet
- [ ] No framework install needed — explicitly out of scope

*Every ❌ W0 above resolves once this phase's own deliverable exists; there is no separate test-scaffolding wave.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All six rows in the verification map above | DATA-03, D-01/D-03/D-04/D-05 | No test framework in repo (out of scope); behavior depends on live Notion API timing and error responses | See the "Automated Command" column above — each is a manual operator procedure against a live test Notion database |

*All phase behaviors are manual-only. This is a deliberate, documented project constraint, not a coverage gap.*

---

## Validation Sign-Off

- [ ] All six verification-map rows executed against a live test database
- [ ] Console output captured as evidence for each scenario (Phase 1 `01-UAT.md` precedent)
- [ ] Both abort paths (D-04, D-05) confirmed to emit exactly one message and a non-zero exit
- [ ] Resumability confirmed by an actual interrupt-and-rerun, not by reasoning about the code
- [ ] Rate compliance confirmed from real log timestamps, not from the configured constant alone
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
