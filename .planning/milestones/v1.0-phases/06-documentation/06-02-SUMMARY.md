---
phase: 06-documentation
plan: 02
subsystem: docs
tags: [readme, markdown, mermaid, resend, notification-diagram]

# Dependency graph
requires:
  - phase: 06-documentation
    plan: 01
    provides: "## Email Notifications (Optional) / ## 이메일 알림 (선택) sections in both READMEs — the new diagram subgraph and table/list rows point at this content"
provides:
  - "README.md Notifications mermaid subgraph, **Resend** Core Services row, Optional email digest Features bullet"
  - "README_KR.md 알림 mermaid subgraph, **Resend** 주요 서비스 row, 선택 이메일 다이제스트 주요 기능 bullet"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["cross-subgraph mermaid edge reusing an existing node (N) rather than duplicating it"]

key-files:
  created: []
  modified: [README.md, README_KR.md]

key-decisions:
  - "One edge inside the new Notifications/알림 subgraph (NR -->|Optional digest| RS) carries the 'Optional' framing at the diagram level, mirroring the Cusdis edge's -->|Optional comments| label, per the plan's prohibition against representing the feature as a required hop"
  - "Korean node label for the notify route translated (알림 라우트); Vercel Cron and Resend product nouns left untranslated, matching the file's existing convention (Next.js, react-notion-x, Vercel, Cusdis stay English)"

patterns-established:
  - "Optional-feature diagram edges carry an explicit 'Optional'/'선택' word in the label, not just implied by section prose"

requirements-completed: [DOCS-01]

coverage:
  - id: D1
    description: "Both mermaid diagrams gain a Notifications/알림 subgraph reusing the shared Notion node, positioned between Application Layer and Visitors, syntactically balanced (4 subgraph/4 end)"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "Task 1 <automated> grep/sed/awk verification block (run inline during execution)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Resend appears as a Core Services row and a Features bullet in both files with optional framing matching the Cusdis precedent"
    requirement: "DOCS-01"
    verification:
      - kind: other
        ref: "Task 2 <automated> grep/awk verification block (run inline during execution)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Both diagrams render cleanly in GitHub's Markdown preview (no Mermaid syntax error), and the cross-subgraph edge into the Notion node draws without a duplicate Notion box"
    human_judgment: true
    rationale: "Plan's <human-check> — no grep can substitute for an actual Mermaid render; not exercised in this non-interactive execution session"

# Metrics
duration: ~7min
completed: 2026-07-29
status: complete
---

# Phase 6 Plan 2: README Diagram/Table Discoverability Summary

**Added the email feature to the top-of-document surfaces of both READMEs — a `Notifications`/`알림` mermaid subgraph, a `**Resend**` Core Services row, and an `Optional email digest` Features bullet — extending the exact three-touchpoint pattern Cusdis already uses, with no source files touched.**

## Performance

- **Duration:** ~7 min
- **Completed:** 2026-07-29T07:36:29Z
- **Tasks:** 2
- **Files modified:** 2 (README.md, README_KR.md)

## Accomplishments

- `subgraph "Notifications"` / `subgraph "알림"` added to both mermaid diagrams, positioned between the Application Layer and Visitors subgraphs (D-11): `Vercel Cron -> Notify Route -> Resend -> Subscriber`, with the notify-route-to-Notion edge reusing the existing `N[Notion Database]` node via a cross-subgraph edge rather than duplicating it
- Both diagrams stay syntactically balanced: 4 `subgraph` openers / 4 `end` closers in each file (baseline 3/3)
- `**Resend**` row appended to both Core Services tables (Email / 이메일 role), purpose text carrying the same optional framing the `**Cusdis**` row carries
- `Optional email digest` / `선택 이메일 다이제스트` bullet appended to both Features lists, matching the `Optional comments`/`선택 댓글` bullet's lead-with-optional phrasing
- All prohibition gates passed: the Resend row and the digest bullet both carry explicit optional/선택 framing in both languages, so the feature reads as one more opt-in capability alongside Cusdis, never as a deploy prerequisite

## Task Commits

Each task was committed atomically:

1. **Task 1: Notifications subgraph in both architecture diagrams** - `3d8615c` (feat)
2. **Task 2: Resend service row and optional email-digest feature bullet, both languages** - `1840b0f` (feat)

## Files Created/Modified

- `README.md` - `Notifications` mermaid subgraph, `**Resend**` Core Services row, `Optional email digest` Features bullet
- `README_KR.md` - Korean counterparts (`알림` subgraph, `**Resend**` row, `선택 이메일 다이제스트` bullet) at the same relative positions

## Decisions Made

- The `NR -->|Optional digest| RS` edge label was chosen (over a plain `-->|Send digest|`) specifically to carry the word "Optional" into the diagram itself, per the plan's action text requiring the diagram-level framing to match how the Cusdis edge (`-->|Optional comments|`) already establishes that a node in this diagram can be an opt-in capability
- Korean node label for the notify route was translated (`알림 라우트`); `Vercel Cron` and `Resend` were left as English product nouns — this resolves an internal ambiguity in the plan's own action text (one sentence said translate "the two describable node labels (`Vercel Cron` and the notify route)", the very next sentence said leave `Resend` and `Vercel Cron`'s product noun untranslated); the second, more specific sentence was followed since it matches the file's existing established convention (`Next.js`, `react-notion-x`, `Vercel`, `Cusdis` all stay English)

## Deviations from Plan

### Auto-fixed Issues

None - both tasks executed exactly as specified; all automated `<verify>` gates passed on first attempt.

### Scope-guard gate note (not a defect in this plan's work)

The plan's Task 2 `<verify>` includes a whole-repo scope guard: `git diff --name-only HEAD | wc -l` expected to equal `2`. At execution time this returned `4` because the working tree already had pre-existing, unrelated uncommitted changes from before this session began (`.planning/config.json`, `.planning/phases/04-notify-route/04-VERIFICATION.md`, plus untracked `.planning/phases/04-notify-route/04-PATTERNS.md`, `.planning/phases/05-production-cutover/05-PATTERNS.md`, `.planning/research/.cache/`, `ss.png` — all visible in the session's initial `git status` snapshot). These files are outside this plan's `files_modified` scope and were not touched by either task. The narrower, scoped check the plan also specifies — `git diff --name-only HEAD -- README.md README_KR.md | wc -l` = `2` — passed, and the phase-wide commit-history check (`git diff --name-only <phase-start> HEAD -- README.md README_KR.md`) confirms both plans in Phase 6 touched only the two target README files. No code changes were made in response to this; it is a pre-existing environment condition unrelated to and not caused by this plan's execution.

## Issues Encountered

None.

## User Setup Required

None - this plan is documentation-only; it describes an already-shipped, already-configured feature (Phases 1-5).

## Next Phase Readiness

- Phase 6 is now complete: both plans (06-01: setup section content, 06-02: discoverability) have landed, satisfying D-01 through D-11 and DOCS-01/02/03
- One human-check item remains open, carried forward exactly as 06-01 recorded its own: a live Mermaid render pass (GitHub Markdown preview or a Mermaid live-renderer) to visually confirm both diagrams parse without a syntax error and the cross-subgraph Notion edge draws correctly — not exercised in this non-interactive execution session, recorded as coverage item D3 (`human_judgment: true`)
- No further plans are queued in Phase 6 per the phase's plan count (2 of 2)

---
*Phase: 06-documentation*
*Completed: 2026-07-29*

## Self-Check: PASSED

- FOUND: README.md
- FOUND: README_KR.md
- FOUND: .planning/phases/06-documentation/06-02-SUMMARY.md
- FOUND: commit 3d8615c
- FOUND: commit 1840b0f
