---
phase: 05-production-cutover
plan: 01
subsystem: ops
tags: [backfill, notion, vercel, operator-verification, production-cutover]
requirements-verified: [OPS-01]

coverage:
  - id: P1
    description: "Post-backfill unemailed count is zero against the production Notion database (getUnemailedPublicPosts() returns zero, ROADMAP SC#1)"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: |
          Dry run (before), against production database 3532c61e4a248000aac4f0bee1bbfb68:
            Found 3 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
              6b42c61e-4a24-82b0-ae11-01fdb5e7110f  NoLog를 만들며
              36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
              3702c61e-4a24-8001-a9a6-c4ff3aadadb5  만년필을 선물 하는 것
            Dry run: 3 post(s) would be marked as emailed. No writes were performed.

          Live pass:
            Found 3 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
              marked  6b42c61e-4a24-82b0-ae11-01fdb5e7110f  NoLog를 만들며
              marked  36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
              marked  3702c61e-4a24-8001-a9a6-c4ff3aadadb5  만년필을 선물 하는 것
            3 marked / 0 failed
          Exit code not separately captured — the operator did not paste an explicit `echo $?` line; not recorded as an observed value.

          Confirmation dry run (after):
            Nothing to do — 0 unemailed public posts found in database 3532c61e4a248000aac4f0bee1bbfb68.
        status: pass
    human_judgment: true

  - id: P2
    description: "Deployed project's actual Function Max Duration, read from the operator's own dashboard (ROADMAP SC#3, D-01)"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: "Vercel Dashboard -> Settings -> Functions: Function Max Duration = 300 seconds, Fluid Compute = enabled. This matches (does not contradict) the 300s figure 04-RESEARCH.md derived from documentation."
        status: pass
    human_judgment: true

  - id: P3
    description: "Vercel project's Root Directory setting, which decides where Plan 05-02 must write vercel.json for Vercel to actually resolve it"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: "Vercel Dashboard -> Settings -> Build and Deployment: Root Directory = apps/web. Vercel resolves vercel.json relative to this Root Directory, so Plan 05-02 must write the cron config to apps/web/vercel.json, not a repo-root vercel.json — a repo-root file would be read by nothing and register no cron at all."
        status: pass
    human_judgment: true

  - id: P4
    description: "Production environment variable presence for the notify path's required secrets, CRON_SECRET called out separately"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: |
          Vercel Dashboard -> Settings -> Environment Variables (Production scope), presence only, no values reported:
            NOTION_TOKEN            present (Production + Preview)
            NOTION_DATABASE_ID      present (Production + Preview)
            CRON_SECRET             present (Production scope only — operator just added it)
            RESEND_API_KEY          present (Production scope only — operator just added it)
            RESEND_AUDIENCE_ID      present (Production scope only — operator just added it)
            NOTIFY_PHYSICAL_ADDRESS present (Production scope only — operator just added it)
          All six required Production variables are present. CRON_SECRET is called out separately per T-05-04: Vercel Cron only ever invokes routes in the Production environment, so Production-only scope is sufficient for CRON_SECRET; its confirmed presence closes T-05-04 (the first scheduled tick will not permanently 401).
        status: pass
    human_judgment: true

  - id: P5
    description: "Production deployment branch and latest deployment status"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: |
          Vercel Dashboard -> Deployments tab: operator confirmed the latest Production entry as "READY".
          Branch identity: the operator's confirmation in this turn did not separately re-state "on main branch." This project's config.json records git.branching_strategy: none, and every prior phase through commit 5e54a5a deployed from a single main branch with no alternate branch ever in play. Branch identity is therefore supported by project-wide single-branch convention, not by a verbatim operator re-statement captured this turn.
        status: gap
    human_judgment: true
---

# Phase 5 Plan 1: Production Backfill Confirmation — Verification

## Accomplishments

The operator ran the Phase 2 backfill CLI against the production Notion database (`3532c61e4a248000aac4f0bee1bbfb68`) from their own terminal — dry run, live pass, confirmation dry run — and read four settings off the deployed Vercel project's own dashboard. All results were pasted back verbatim in this session and are transcribed here without paraphrase or inference, per this plan's transparency prohibition.

**Headline result:** the production database now has zero unemailed public posts (confirmed by a fresh, independent dry-run read after the live pass, not inferred from the write's own output), and the deployed project's Function Max Duration (300s, Fluid Compute enabled) matches the figure 04-RESEARCH.md derived from documentation rather than contradicting it. All six Production environment variables the notify path needs are present, including `CRON_SECRET`, which the operator had just added.

## Reported Results

| ID | Item | Result |
|----|------|--------|
| P1 | Post-backfill unemailed count | ✅ PASS — zero, confirmed by a third, independent dry run |
| P2 | Function Max Duration | ✅ PASS — 300s, Fluid Compute enabled; matches documentation-derived figure |
| P3 | Root Directory | ✅ PASS — `apps/web`; Plan 05-02 must target `apps/web/vercel.json` |
| P4 | Production env var presence (all 6) | ✅ PASS — all present, `CRON_SECRET` called out separately |
| P5 | Production deployment branch + status | ⚠️ GAP (partial) — deployment status "READY" confirmed verbatim; branch identity (`main`) inferred from project convention, not separately re-quoted this turn |

## Decisions Made

- **ROADMAP SC#1 closed in full.** The confirmation dry run's `Nothing to do — 0 unemailed public posts found` line is the direct `getUnemailedPublicPosts()`-returns-zero evidence SC#1 asks for; it is a fresh read after the live pass, not an inference from the live pass's own "3 marked / 0 failed" line.
- **ROADMAP SC#3's measurement half closed.** 300s is the real, dashboard-read Function Max Duration for this deployed project — not assumed from 04-RESEARCH.md. Its batch-size half (confirming `NOTIFY_BATCH_SIZE_DEFAULT` against this figure) closes in Task 3.
- **Root Directory (`apps/web`) recorded as the authoritative path input for Plan 05-02.** Plan 05-02's cron-entry commit must write `apps/web/vercel.json`, not a repo-root `vercel.json` — the latter would be silently ignored by Vercel for this project.
- **P5's branch-identity sub-fact recorded as `status: gap` rather than upgraded to a full pass.** The operator confirmed deployment status ("READY") verbatim, but did not separately re-state "on main branch" in this turn. Per this project's established precedent (04-03-SUMMARY.md coverage row D4: an unproven item is recorded as an open gap, never a false pass), the branch-identity claim is supported only by project-wide convention (`git.branching_strategy: none`, no alternate branch ever used through commit `5e54a5a`) rather than by a verbatim operator statement captured this session. This is a transparency choice, not a blocking finding — the project has no other branch in play, so there is no practical ambiguity about which branch is deployed.
- **Exit code for the live backfill pass not separately captured.** The operator pasted "3 marked / 0 failed" but no explicit `echo $?` line. Recorded as not separately captured rather than assumed to be `0`.

## Next Phase Readiness

- **Plan 05-02 is cleared to proceed.** ROADMAP SC#1 is closed by observed operator output; SC#3's measurement half is closed; the Root Directory and environment-variable preconditions Plan 05-02 needs are both recorded and satisfied (P3, P4). The P5 branch-identity gap is a transparency note, not a blocker — this project deploys from a single `main` branch by convention and has no alternate branch to disambiguate against.
- ROADMAP SC#3's remaining half — confirming `NOTIFY_BATCH_SIZE_DEFAULT` against the 300s figure recorded in P2 — closes in this plan's Task 3.
- This file is commit 1 of D-04's two-commit sequence; Plan 05-02's ordering gate asserts its ancestry precedes any Plan 05-02 commit.

---
*Phase: 05-production-cutover*
*Verified: 2026-07-29*
