---
phase: 06-documentation
plan: 01
subsystem: docs
tags: [readme, markdown, resend, notion, vercel-cron]

# Dependency graph
requires:
  - phase: 01-notion-data-layer
    provides: "emailed Checkbox property contract, MissingEmailedPropertyError/NotionCapabilityError classes"
  - phase: 04-notify-route
    provides: "4 env vars read by /api/notify-subscribers's fail-closed gate"
  - phase: 05-production-cutover
    provides: "shipped vercel.json crons entry (0 11 * * *)"
provides:
  - "README.md ## Email Notifications (Optional) section — 7-step setup path, 4-var fenced block, inline failure warnings, quota note"
  - "README_KR.md ## 이메일 알림 (선택) section — 1:1 Korean counterpart"
affects: [06-02]

# Tech tracking
tech-stack:
  added: []
  patterns: ["inline bolded warning attached beneath the step it applies to, no troubleshooting subsection (D-04)"]

key-files:
  created: []
  modified: [README.md, README_KR.md]

key-decisions:
  - "Task 1 (tracer) wrote the complete 7-step path in both languages at once, deferring all warnings/quota to Task 2, to avoid shipping a half-hardened section at any commit boundary"
  - "CONFIG.notify.fromAddress documented as its own step (research Open Question 1) since a forker who sets all 4 env vars but leaves the default fromAddress still fails closed with no README explanation"
  - "Step-2 capability warning sourced to Notion's documented capability model and the shipped NotionCapabilityError class, explicitly not phrased as a failure this project reproduced live (STATE.md records two live revocation tests that did not reproduce the 403 — still open)"
  - "Free-tier quota note avoids the word 'unlimited'/'무제한' entirely per the plan's negative gate — states the 1,000-contacts/month figure as 'the actual ceiling' rather than any no-ceiling framing"

patterns-established:
  - "Inline warning = bolded sentence attached immediately beneath the numbered step it applies to, never a new numbered line, never a separate section"

requirements-completed: [DOCS-01, DOCS-02, DOCS-03]

coverage:
  - id: D1
    description: "README.md/README_KR.md document the 4 notify env vars, the emailed Notion property (name + type + case-sensitivity), and the Notion Update content capability grant as its own explicit step"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "plan 06-01 Task 1/Task 2 <automated> grep/awk verification block (run inline during execution)"
        status: pass
    human_judgment: false
  - id: D2
    description: "README.md/README_KR.md mandate Resend domain/SPF/DKIM verification (with async/72h caveat) and state the correct 1,000-contacts/month Broadcast/Audience quota, explicitly ruling out the 100/day transactional Send API figure"
    requirement: "DOCS-02"
    verification:
      - kind: other
        ref: "plan 06-01 Task 2 <automated> grep verification block (run inline during execution)"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md/README_KR.md state the cron fires only on Production deployments and is evaluated in UTC"
    requirement: "DOCS-03"
    verification:
      - kind: other
        ref: "plan 06-01 Task 2 <automated> grep verification block (run inline during execution)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Korean prose reads naturally to a native speaker and no Notion/Resend UI label was mistranslated away from what the forker sees on screen"
    human_judgment: true
    rationale: "06-RESEARCH.md Assumptions Log A1 flags Korean wording as un-reviewed by a native speaker; this is the plan's own <human-check> requirement and cannot be auto-verified by grep"

# Metrics
duration: ~20min
completed: 2026-07-29
status: complete
---

# Phase 6 Plan 1: Email Notifications README Setup Section Summary

**Added a complete, self-contained `## Email Notifications (Optional)` setup section (English + Korean) with a 7-step path, dedicated 4-var env block, and inline failure-mode warnings at the exact step each silent-failure trap would be hit — no other file touched.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-29T07:29:30Z
- **Tasks:** 2 (Task 1 tracer + Task 2 expansion)
- **Files modified:** 2 (README.md, README_KR.md)

## Accomplishments

- `## Email Notifications (Optional)` / `## 이메일 알림 (선택)` inserted between the deployment and environment-variables sections in both files (D-01, D-02), each with a 7-step numbered path structurally identical across languages
- New env-var fenced block scoped to the section (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`, `NOTIFY_PHYSICAL_ADDRESS`), byte-identical between README.md and README_KR.md, with the pre-existing 3-var block left untouched (D-03)
- The Notion "Update content" capability grant documented as its own numbered step, textually distinct from the existing Connections step (D-05)
- Inline bolded warnings attached beneath the exact step each of the four known silent-failure traps would be hit: `emailed` casing → `MissingEmailedPropertyError`; missing capability → 403/`NotionCapabilityError`; unverified domain → silent non-delivery; Production-only/UTC cron (D-04, D-06, D-07)
- Free-tier quota note names both Resend figures — the governing 1,000-contacts/month ceiling and the inapplicable 100/day + 3,000/month transactional cap — linked to Resend's pricing page (D-09)

## Task Commits

Each task was committed atomically:

1. **Task 1: The setup path — complete Email Notifications section in both READMEs (tracer)** - `1a58249` (feat)
2. **Task 2: Failure-mode hardening — inline warnings and the quota disambiguation, both languages** - `386425b` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `README.md` - new `## Email Notifications (Optional)` section: 7-step setup path, 4-var env block, inline warnings, free-tier quota note
- `README_KR.md` - Korean counterpart, same relative position and step order, UI proper nouns kept in English per existing convention

## Decisions Made

- Task 1 wrote the complete tracer slice (both languages, no warnings) first and verified it end-to-end before Task 2 hardened it with warnings — per the plan's tracer-first shape, avoiding a half-translated or half-warned document at any commit boundary
- `CONFIG.notify.fromAddress` documented as step 5 even though it's not an env var (planner judgment call resolving 06-RESEARCH.md Open Question 1) — omitting it would leave a forker who sets all 4 env vars still failing closed with no README explanation
- Step-2 warning text attributes the 403/duplicate-send failure to Notion's documented capability model and the shipped `NotionCapabilityError` class, explicitly avoiding any claim that this project reproduced the failure live (STATE.md's Phase 4 concern — two live revocation tests did not reproduce a 403 — remains open and unresolved by this phase)
- Free-tier quota note phrases the constraint as "the actual ceiling" rather than any "unlimited" framing, satisfying the plan's negative gate against that word in either language

## Deviations from Plan

None — plan executed exactly as written. Both tasks' full `<automated>` verification blocks (heading uniqueness/position, 7-step counts, byte-identical env-var lines, region-scoped D-03 negative gate, ground-truth identifier greps, quota figures, "unlimited"/무제한 negative gates, domain-verification softening negative gate) were run inline during execution and all passed before each commit.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This plan is documentation-only; it describes already-shipped, already-configured infrastructure from Phases 1-5.

## Next Phase Readiness

- Plan 06-02 (diagram + Core Services/Features table updates, per D-10/D-11) can proceed independently — it touches the same two files but different sections (mermaid diagram, tables, feature list), not the setup section this plan wrote, and executes strictly after this plan per the phase's wave ordering
- The plan-level `<verify>` step (`git diff --stat` across this plan's commit range showing exactly `README.md` and `README_KR.md`) confirmed no scope violation
- Human-check items remain: native-speaker read-through of the Korean prose (A1, un-reviewed) and a full side-by-side structural diff read — neither blocks 06-02, both are recorded as `human_judgment: true` coverage item D4 above

---
*Phase: 06-documentation*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: README.md
- FOUND: README_KR.md
- FOUND: .planning/phases/06-documentation/06-01-SUMMARY.md
- FOUND: commit 1a58249
- FOUND: commit 386425b
