---
phase: 02-backfill-script
verified: 2026-07-26T00:00:00Z
status: human_needed
score: 13/21 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/21
  gaps_closed:
    - "A NotionCapabilityError aborts the whole run on first occurrence with exactly one ABORT message plus the partial count reached, and a non-zero exit — never one failure line per remaining post (D-04)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "D-01/D-03 dry-run listing: with NOTION_TOKEN/NOTION_DATABASE_ID exported for a real test database holding 2+ unemailed public posts, run `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`."
    expected: "One line per post showing its id and title, a count line naming the database id, a closing 'no writes performed' line, exit code 0, and a re-run shows the count unchanged."
    why_human: "Requires a live Notion workspace with real post data; no NOTION_TOKEN/NOTION_DATABASE_ID in this execution environment."
  - test: "D-05 abort path: remove the `emailed` Checkbox property from a test database, run the dry-run command."
    expected: "Exactly one ABORT line naming the missing-property fix, non-zero exit."
    why_human: "Requires live schema mutation on a real Notion database; the code path is statically sound (MissingEmailedPropertyError instanceof check precedes the generic branch in the initial-fetch catch, unchanged by this closure) but the live trigger cannot be produced here."
  - test: "DATA-03 SC#1: against a test database with N (N ≥ 2) unemailed public posts, run `npm run backfill --workspace=@4lph4/nolog-core`."
    expected: "Final line reads `N marked / 0 failed`, exit 0, and a follow-up `--dry-run` reports 0 posts remaining."
    why_human: "Requires live writes against a real Notion database; no credentials in this execution environment."
  - test: "DATA-03 SC#2 (resumability): start a live run against several unemailed posts, Ctrl+C partway, re-run."
    expected: "Second run's 'found N' count reflects only the remainder; no re-marking or errors on already-emailed posts; completes cleanly."
    why_human: "Requires a live, interruptible run against a real Notion database."
  - test: "DATA-03 SC#3 (rate compliance): run against 10+ unemailed posts with visible per-post log timestamps."
    expected: "Consecutive per-post lines are ≥400ms apart (~2.5 req/s); no rate-limit failures in a healthy run."
    why_human: "This is a runtime timing invariant (behavior-dependent truth) — no test framework exists in this repo to exercise it, and it requires live wall-clock measurement against a real Notion database. The DELAY_MS=400 constant and its unconditional single placement after every loop iteration (success, retry-success, retry-failure, and per-post-failure paths) are statically confirmed; the invariant itself remains unexercised by any test."
  - test: "D-04 abort path (full live confirmation of the primary, non-retry path): revoke 'Update content' from the Notion integration, run a live backfill against 2+ unemailed posts."
    expected: "Exactly one ABORT line, a partial-count line, non-zero exit."
    why_human: "Requires live capability revocation on a real Notion integration; the classification is now statically sound end-to-end (see Goal Achievement below) but full live confirmation was not possible here."
  - test: "Backstop truth — >100-post pagination: drain a database holding more than 100 unemailed public posts in a single run."
    expected: "getUnemailedPublicPosts() paginates past Notion's page_size 100 boundary and the script iterates the complete returned array with no truncation."
    why_human: "verification: backstop — non-inferable from static analysis or a small test database; requires contrived live scale."
  - test: "Backstop truth — mid-run idempotency race: a post becomes emailed (by another process or a prior partial run) between the initial fetch and the loop reaching it."
    expected: "The run completes without error and the post is counted in N marked, not M failed, because markEmailed() is idempotent."
    why_human: "verification: backstop — requires a contrived live race condition against a real Notion database."
  - test: "Backstop truth — 429/529 retry contract: a real Notion rate-limit or service-overload response occurs mid-run."
    expected: "Exactly one retry of that same post after the fixed 1000ms backoff, accounted for exactly once (marked once on success, failed once on permanent failure, never both)."
    why_human: "verification: backstop — cannot be reliably provoked without live production-scale traffic against Notion's real rate limiter."
  - test: "Prohibition — zero-work run must not read as a completed backfill."
    expected: "Output makes the queried database identity and the zero-result fact explicit."
    why_human: "Judgment-tier prohibition (no `verification: test|judgment` field declared in the plan; treated as judgment-tier per fail-closed default). This verifier's static reading confirms `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` satisfies the statement, but per protocol this is a NON-AUTHORITATIVE LLM-judge verdict — human review recommended before treating it as definitively closed."
  - test: "Prohibition — script MUST NOT be reachable from any automatic npm lifecycle hook or default CI path."
    expected: "No preinstall/install/postinstall/prepare/prepublish/prepack/build/test/start script references backfill; no CI workflow triggers it automatically."
    why_human: "Judgment-tier prohibition (same fail-closed default as above). Re-confirmed this cycle: `packages/core/package.json` scripts are only `build`, `dev`, `backfill` — no lifecycle hook references it; no `.github/workflows` or `vercel.json` exist in this repo. Satisfied by direct inspection, but flagged non-authoritative per protocol; human review recommended."
behavior_unverified_items:
  - truth: "A live run's per-post log timestamps show at least 400ms between consecutive Notion write attempts, holding the sustained rate at ~2.5 req/s under Notion's ~3 req/s limit (DATA-03 SC#3, D-09/D-10)"
    test: "Run against 10+ unemailed posts and inspect per-post log timestamps for consistent ≥400ms gaps."
    expected: "No two consecutive per-post write log lines are less than 400ms apart, across the full run including after any rate-limit retry and up to and including any new abort path."
    why_human: "This is a runtime timing invariant; presence of the DELAY_MS=400 constant and its unconditional single placement in the loop are statically confirmed, but no test in this repo (there is no test framework) exercises actual elapsed wall-clock time between requests."
---

# Phase 2: Backfill Script Verification Report

**Phase Goal:** Every pre-existing public post can be marked `emailed` in one throttled, resumable run, so enabling the notify path never blasts a fork's entire back catalog on its first cron tick.

**Verified:** 2026-07-26
**Status:** human_needed
**Re-verification:** Yes — after gap closure (02-02-PLAN.md)

## Re-Verification Summary

The prior VERIFICATION.md (2026-07-25) scored 12/21 with exactly one failed gap: CR-01, an
incomplete systemic-abort classification in the write loop (the retry's inner catch had no
`instanceof` check at all, and the outer catch never checked `MissingEmailedPropertyError`). A
second blocker — `COVERAGE.md` failing its own `api-coverage.verify-pre` validator on two
over-length cells — was also blocking the phase seal.

Both are now independently re-confirmed closed by this verifier reading current source, not by
trusting `02-02-SUMMARY.md` or `02-REVIEW.md`'s claims:

1. **CR-01 (D-04 gap) — CLOSED.** `packages/core/scripts/backfill.ts` now defines a single shared
   classifier, `isSystemicAbort(err): err is NotionCapabilityError | MissingEmailedPropertyError`
   (lines 83-87), using `instanceof` only, never message text. It is called at **both** catch
   sites: the outer per-post catch (line 156, confirmed strictly ahead of `isRateLimited(err)` at
   line 167 — verified line 97 < line 100 on the comment-stripped file) and the retry's inner catch
   (line 180, confirmed strictly ahead of the `retryErr instanceof Error` message extraction —
   verified line 107 < line 111 on the comment-stripped file). Both sites call the single reporter
   `reportSystemicAbort(err|retryErr, marked, failed)` (lines 165, 186), each immediately followed
   by `return`, and neither increments `marked` or `failed` before that call. `instanceof
   NotionCapabilityError` appears exactly once in the comment-stripped file (inside the classifier),
   confirming the outer catch no longer carries an independent single-class check. `git show 8d4a1f3`
   shows this was a surgical, additive diff — the initial-fetch catch (D-05/D-15), `isRateLimited`,
   `DELAY_MS`, `sleep`, and the retry's existing FAILED fallback are untouched.

2. **api-coverage seal gate — CLOSED.** Running
   `node ~/.claude/gsd-core/bin/gsd-tools.cjs check api-coverage.verify-pre .planning/phases/02-backfill-script --raw`
   in this session returns `{"block": false, "passed": true, "counts": {"surface": 18, "integrate": 9, "optout": 9}}`
   (no `error_count` key on the passing path, as expected — judged on `passed`/`block` per
   instruction, not key presence). Independently re-measured every one of the table's 18 data rows
   (lines 13-30) by script: the largest capability cell is 73 chars (limit 80) and the largest
   reason cell is 197 chars (limit 200) — both well within bounds, and specifically row[0]
   (cap=62, reason=92) and row[9] (reason=174) match the plan's pre-measured figures exactly. No
   row was added, removed, merged, or re-decided (still 9 INTEGRATE / 9 OPT-OUT); the `Retry-After`
   OPT-OUT row still names `patchPage()`'s header limitation, the `client.ts` scope boundary, D-14's
   fixed-backoff lock, and Phase 4's additive reinstatement path.

No regressions found in what 02-01 delivered (see Observable Truths #2-#10, #13-#18 below, all
re-confirmed this cycle) and no new scope violations (`packages/core/src/client.ts` is provably
untouched via `git diff --name-only`; no dependency, npm script, or lifecycle hook added).

**Why status is `human_needed`, not `passed`:** the same nine live-database human-verification
items from the prior report remain genuinely open — this closure did not (and could not) touch
any of them, since none of them concern the CR-01/COVERAGE.md gaps and no live Notion credentials
exist in this environment. They are carried forward verbatim below, unchanged in substance. One
truth (SC#3, the ~400ms throttle timing invariant) remains ⚠️ PRESENT_BEHAVIOR_UNVERIFIED for the
same reason it was last cycle — presence and unconditional single-call placement are statically
confirmed, but no test exercises actual wall-clock timing.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `--dry-run` lists every unemailed post (id+title) + count, zero writes (D-01/D-03) | ? human_needed | Unchanged this cycle. Zero-writes guaranteed statically (no `markEmailed()` call anywhere in the dry-run branch, `backfill.ts:134-143`). Live listing against real data unconfirmed — no Notion credentials in this environment. |
| 2 | Live run starts marking with no prompt/confirm flag (D-02) | ✓ VERIFIED | Re-confirmed: no `readline`, `prompt`, or confirm-flag logic anywhere in `backfill.ts`; live path begins immediately after the `dryRun` early return. |
| 3 | Live run marks every unemailed post, prints `N marked / M failed` (SC#1, D-06) | ? human_needed | Summary line format confirmed in code (`backfill.ts:213`); counters/exit-code logic statically sound and unchanged. Actual marking against real posts unconfirmed — no credentials. |
| 4 | Interrupt + re-run processes only unmarked posts, no re-marking/erroring (SC#2) | ? human_needed | No local checkpoint/state file exists (re-confirmed: no `fs` read/write API in the script); resumability depends entirely on Phase 1's `getUnemailedPublicPosts()` server-side filter. Live interrupt/re-run unconfirmed here. |
| 5 | Per-post log timestamps ≥400ms apart, ~2.5 req/s (SC#3, D-09/D-10) [edge: boundary] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `DELAY_MS = 400` (integer) re-confirmed; `await sleep(DELAY_MS)` (line 210) runs unconditionally exactly once per loop iteration on every non-abort branch — re-verified via `grep -c 'sleep(DELAY_MS)'` = 1, positioned outside all catch/retry blocks. Runtime timing invariant; no test in this repo exercises actual elapsed time. |
| 6 | Empty array → nothing-to-do line naming db, zero writes, exit 0 [edge: empty] | ✓ VERIFIED | `backfill.ts:124-130`, unchanged: prints `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` and returns with default exit code 0. |
| 7 | Exactly one post → `1 marked / 0 failed`, exit 0 [edge: empty/single] | ✓ VERIFIED | Deterministic and unchanged: single-element loop increments `marked` to 1, `failed` stays 0, summary line prints correctly. |
| 8 | Posts processed/logged in returned order, never reordered [edge: ordering] | ✓ VERIFIED | `grep -Eq '\.sort\(|\.reverse\('` on non-comment lines returns no match; both loops use plain `for (const post of posts)`. |
| 9 | `marked + failed == attempted`, no double-counting [edge: precision] | ✓ VERIFIED | Re-traced all outcomes including the two new abort branches: success, retry-success, retry-failure, generic failure each increment exactly one counter (or neither, for the two abort branches, which `return` before any counter touch for that post) — consistent with "aborted, not attempted-and-counted." |
| 10 | Inter-request delay exact integer 400ms, no floating-point [edge: precision] | ✓ VERIFIED | `DELAY_MS = 400`, `RETRY_BACKOFF_MS = 1000` — both integer literals, unchanged; no floating-point arithmetic anywhere in the file. |
| 11 | `NotionCapabilityError` aborts on first occurrence, one ABORT message, never one failure line per remaining post (D-04) | ✓ VERIFIED (gap closed) | **Previously FAILED (CR-01), now closed.** `isSystemicAbort()` (lines 83-87) is checked in BOTH the outer per-post catch (line 156, ahead of `isRateLimited(err)` at line 167) and the retry's inner catch (line 180, ahead of the FAILED fallback at line 189). Both call the single `reportSystemicAbort()` emitter and `return` immediately, without incrementing either counter. Confirmed by direct source reading and by re-running the plan's own line-order and count assertions in this session — not by trusting `02-02-SUMMARY.md` or `02-REVIEW.md`. |
| 12 | `MissingEmailedPropertyError` from the **initial fetch** aborts before the per-post loop (D-05) | ? human_needed | Statically sound and unchanged: `backfill.ts:108-111` checks `instanceof MissingEmailedPropertyError` first in the initial-fetch catch. Live trigger (removing the schema property) unconfirmed here. |
| 13 | Any other initial-fetch failure aborts before the loop (D-15) | ✓ VERIFIED | Re-confirmed both statically (`backfill.ts:112-119`) and by live probe this session: invalid credentials produced `ABORT: initial fetch of unemailed public posts failed: Notion query failed: 401 ...`, exit code 1, exactly one `ABORT:` line, no summary line. |
| 14 | Completed run: M>0 exits non-zero, M==0 exits 0 (D-08) | ✓ VERIFIED | `backfill.ts:214`: `process.exitCode = failed > 0 ? 1 : 0;` — unchanged, deterministic. |
| 15 | Mistyped flag rejected, non-zero exit, before any Notion call | ✓ VERIFIED | `parseArgs` (unchanged, strict mode) runs before client construction; consistent with prior cycle's live-executed confirmation. |
| 16 | Script lives at `packages/core/scripts/backfill.ts`, invocable via npm script (D-11) | ✓ VERIFIED | File exists (217 lines, up from 183 — growth accounted for by the two new gap-closure functions); `package.json` `scripts.backfill` = `"npx tsx scripts/backfill.ts"` re-confirmed. |
| 17 | Flags via npm `--` pass-through; no separate `backfill:dry-run` entry (D-12) | ✓ VERIFIED | `packages/core/package.json` scripts are exactly `build`, `dev`, `backfill` — no separate dry-run entry. |
| 18 | Reads env vars from shell, no dotenv, no new dependency (D-13) | ✓ VERIFIED | Re-confirmed this session: `dependencies` = `{"@notionhq/client": "^5.20.0"}`, `devDependencies` = `{"typescript", "tsup"}` — no new entries added by this closure. `process.env.NOTION_TOKEN!` / `NOTION_DATABASE_ID!` read directly, no `dotenv`. |
| 19 | Backstop: >100-post pagination fully drained in one run [edge: boundary] | ? human_needed (backstop, insufficient_spec) | Unchanged — abstains per backstop protocol. |
| 20 | Backstop: mid-run idempotency race counted as marked, not failed [edge: adjacency] | ? human_needed (backstop, insufficient_spec) | Unchanged — abstains per backstop protocol. |
| 21 | Backstop: 429/529 triggers exactly one retry, no `Retry-After` header read [edge: adjacency] | ? human_needed (backstop, insufficient_spec) | `isRateLimited()` unchanged, still anchors on the exact message prefix; the live trigger abstains per backstop protocol. The systemic sub-case within the retry (previously intersecting the CR-01 gap) is now closed — see Truth #11. |

**Score:** 13/21 truths verified (1 present-but-behavior-unverified, 7 human_needed/backstop-abstained, 0 failed)

### Prohibitions

| # | Prohibition | Status | Evidence |
|---|-------------|--------|----------|
| P1 | MUST NOT let a zero-work run read as a completed backfill | Resolved (non-authoritative — human review recommended) | Unchanged: `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` names both facts explicitly. Judgment-tier per fail-closed default. |
| P2 | MUST NOT be reachable from any automatic npm lifecycle hook or default CI path | Resolved (non-authoritative — human review recommended) | Re-confirmed this session: `packages/core/package.json` scripts list is exactly `build`, `dev`, `backfill` — no lifecycle hook references it; no `.github/workflows/` or `vercel.json` exist in this repo. Same fail-closed judgment-tier treatment as P1. |
| P3 (02-02) | MUST NOT modify `packages/core/src/client.ts` | ✓ VERIFIED | `git diff --name-only -- packages/core/src/client.ts` returns zero lines this session. |
| P4 (02-02) | MUST NOT weaken any behavior 02-01 already delivered (D-06/D-07/D-08/D-09/D-10/D-13/D-14/D-15) | ✓ VERIFIED | See Observable Truths #6-#10, #13-#18 above — all re-confirmed unchanged. `git show 8d4a1f3` confirms the diff is purely additive (two new functions, two new branch insertions), touching no pre-existing line's logic. |
| P5 (02-02) | MUST NOT add a dependency, test framework, or new npm script entry | ✓ VERIFIED | `dependencies`/`devDependencies` unchanged; `scripts` list unchanged (`build`, `dev`, `backfill`); no test framework files found. |
| P6 (02-02) | MUST NOT delete/merge COVERAGE.md rows or flip any decision to satisfy the length validator | ✓ VERIFIED | 18 data rows re-confirmed (9 INTEGRATE, 9 OPT-OUT), same set of capabilities as the prior cycle; only the two flagged cells' wording changed, each re-verified to still carry every original claim (row 0: endpoint + `getUnemailedPublicPosts()` binding + server-side filter fact; row 9: body-text-only limitation, `client.ts` scope boundary, D-14 lock, Phase 4 reinstatement path). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/scripts/backfill.ts` | Operator CLI, ≥190 lines (02-02 min_lines), contains `isSystemicAbort` | ✓ VERIFIED | 217 lines; contains `isSystemicAbort` (line 83) and `reportSystemicAbort` (line 93); type-checks clean under `--strict` against a freshly-built `dist` (re-run this session, exit 0). |
| `packages/core/package.json` | `backfill` npm script entry | ✓ VERIFIED | `"backfill": "npx tsx scripts/backfill.ts"` present; dependency blocks unchanged; no lifecycle hook references it. |
| `.planning/phases/02-backfill-script/COVERAGE.md` | Validator-clean matrix, contains `Retry-After` | ✓ VERIFIED | `api-coverage.verify-pre` returns `passed: true`, `block: false` this session; `Retry-After` row present and content-preserving (see P6 above). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/core/package.json` | `packages/core/scripts/backfill.ts` | `scripts.backfill` runs `npx tsx scripts/backfill.ts` | ✓ WIRED | Confirmed by direct read. |
| `packages/core/scripts/backfill.ts` | `packages/core/dist/index.js` | imports `NologClient`/error classes from built dist | ✓ WIRED | Unchanged import block; type-checks clean against freshly built `dist/index.d.ts` this session. |
| `packages/core/scripts/backfill.ts` outer per-post catch | `isSystemicAbort()` | outer catch calls the classifier ahead of both the rate-limit branch and the generic per-post branch | ✓ WIRED | Line 156 call confirmed at file line 97 (comment-stripped) < `isRateLimited(err)` at line 100 (comment-stripped). |
| `packages/core/scripts/backfill.ts` rate-limit retry inner catch | `isSystemicAbort()` | retry's catch calls the same classifier ahead of its FAILED branch | ✓ WIRED | Line 180 call confirmed at file line 107 (comment-stripped) < `retryErr instanceof Error` at line 111 (comment-stripped). |
| `isSystemicAbort()` | `packages/core/src/client.ts patchPage()` throw sites | classifier's union covers exactly the two typed error classes `patchPage()` can throw | ✓ WIRED | Cross-referenced `client.ts:357-369`: 403 → `NotionCapabilityError`, 400+property regex → `MissingEmailedPropertyError`; both covered by the `instanceof` union with no gap. |

### Data-Flow Trace (Level 4)

Not applicable — this is a CLI operator script with no rendered UI/data-flow to trace; its outputs are console log lines and a process exit code, both directly verified via source reading and CLI probes above.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds, script type-checks strict against fresh dist | `npm run build --workspace=@4lph4/nolog-core && npx tsc --noEmit --strict ...` | Build: 5 outputs generated cleanly. tsc: no errors, exit 0. | ✓ PASS |
| Invalid-credential dry-run aborts cleanly (D-15 path, unaffected by closure) | `NOTION_TOKEN=invalid... npm run --silent backfill -- --dry-run` | `ABORT: initial fetch ... Notion query failed: 401 ...`, exit 1, exactly one `ABORT:` line | ✓ PASS |
| Invalid-credential live run prints no summary line, confirming write loop stays unreachable | `NOTION_TOKEN=invalid... npm run --silent backfill` | `ABORT: initial fetch ...`, exit 1, zero `marked` occurrences | ✓ PASS |
| `packages/core/src/` provably unmodified this closure | `git diff --name-only -- packages/core/src/client.ts` | Exit 0, no output (zero lines) | ✓ PASS |
| `isSystemicAbort`/`reportSystemicAbort` reached at both catch sites, correctly ordered | Line-number comparisons on comment-stripped file (see Goal Achievement #11) | Both orderings hold; `instanceof NotionCapabilityError` appears exactly once | ✓ PASS |
| api-coverage gate passes | `gsd-tools check api-coverage.verify-pre .planning/phases/02-backfill-script --raw` | `{"block": false, "passed": true, "counts": {"surface": 18, "integrate": 9, "optout": 9}}` | ✓ PASS |
| Every COVERAGE.md cell within validator limits (not just the two previously-flagged) | Independent per-row length scan (script) | Max capability cell 73/80 chars, max reason cell 197/200 chars, across all 18 rows | ✓ PASS |
| No new dependency/lifecycle hook introduced | `node -e 'require("./packages/core/package.json")...'` | `dependencies`/`devDependencies` unchanged; `scripts` = `build`,`dev`,`backfill` only | ✓ PASS |

_No test framework exists in this repo (documented, out-of-scope project constraint) — the above are single-shot deterministic commands, not a suite run._

### Probe Execution

No `scripts/*/tests/probe-*.sh` files or phase-declared probes found; this phase uses manual operator procedures per `02-VALIDATION.md`/plan `<verify>` blocks, not a probe-script convention. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DATA-03 | 02-01-PLAN.md, 02-02-PLAN.md | One-time backfill script marks all pre-existing public posts as `emailed`, throttled to ~3 req/s, safely re-runnable if interrupted | ✓ SATISFIED (static) | Core mechanics (throttle, exit codes, resumability design, dry-run safety, initial-fetch abort classification) are implemented and statically verified. The previously-blocking CR-01 gap (write-loop systemic classification) is now closed and independently re-confirmed. Remaining open items are all live-database confirmations that no credential-bearing environment can exercise here — routed to human verification, not treated as blocking DATA-03's static implementation. |

**Note:** `.planning/REQUIREMENTS.md` line 14's checkbox for DATA-03 currently reads `[x]` while the
traceability table at line 84 still reads `Gaps Found` — this inconsistency was flagged in the prior
verification cycle and is **still present** as of this re-verification. Per instruction this verifier
does not fix it; it is the orchestrator's `phase.complete` step that owns updating the traceability
table to match the resolved status.

No orphaned requirements — DATA-03 is the only requirement mapped to Phase 2, and it appears in both plans' `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/scripts/backfill.ts` | 104 | `let posts;` with no explicit type annotation (IN-01 in 02-REVIEW.md) | ℹ️ Info | Compiles clean under `--strict` via control-flow narrowing; unchanged from prior cycle, cosmetic robustness note only. |
| `packages/core/scripts/backfill.ts` | 40-44 | Non-null assertions on `NOTION_TOKEN`/`NOTION_DATABASE_ID` with no explicit presence check (IN-02 in 02-REVIEW.md) | ℹ️ Info | Matches existing analog scripts byte-for-byte (documented, intentional per D-13); unset vars still surface as a loud ABORT, not a silent success. |
| `packages/core/scripts/backfill.ts` | 108-121 vs 93-101 | Initial-fetch abort and write-loop abort now print structurally different tails (IN-03, new in 02-REVIEW.md) | ℹ️ Info | The initial-fetch abort (untouched, no loop started yet, no counts in scope) prints one `ABORT:` line with no count line; every write-loop abort now goes through `reportSystemicAbort()`, which always appends a partial-count line. Not a functional defect — a maintainability note about two "ABORT:"-prefixed tail shapes, not a safety or correctness gap. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in `backfill.ts` or `COVERAGE.md`. No placeholder/"coming soon" text. No empty-implementation patterns. All three Info items are carried-forward or newly-surfaced low-risk observations from `02-REVIEW.md`'s re-review pass, none rising to Warning or Blocker.

### Human Verification Required

See `human_verification` in frontmatter for the full list (10 items, unchanged in count and substance
from the prior cycle — this closure did not touch any of them): six live-database scenarios explicitly
deferred (dry-run listing, D-05 abort, SC#1, SC#2, SC#3, D-04 full live confirmation), three backstop
truths (>100-post pagination, mid-run idempotency race, live 429/529 retry trigger), and two
judgment-tier prohibitions (zero-work-run explicitness, lifecycle-hook/CI unreachability) whose static
resolution is non-authoritative per protocol. No new live-only scenario was introduced by the
gap-closure plan beyond what the prior report already tracked (the plan's `<human-check>` for a
mid-run schema-removal scenario overlaps substantively with the already-tracked D-05/D-04 live items
rather than adding a genuinely new tenth category — it exercises the same live schema-mutation trigger
already covered by the D-05 item, just at a different point in the run).

### Gaps Summary

No gaps remain. Both items that blocked the prior `gaps_found` verdict are closed and independently
re-confirmed from current source in this session:

1. **CR-01 (D-04 write-loop systemic classification)** — closed via a single `isSystemicAbort()`
   classifier reached from both the outer per-post catch and the retry's inner catch, each followed
   by the single `reportSystemicAbort()` emitter and an immediate `return`. Branch ordering (systemic
   check strictly before the rate-limit check, and strictly before the retry's FAILED fallback) is
   re-verified this session via direct line-number comparison on the comment-stripped file, not by
   trusting the plan's or summary's claims.
2. **api-coverage seal gate** — closed; `COVERAGE.md`'s two previously over-length cells were
   rebalanced (not truncated or content-reduced) and the validator now reports `passed: true,
   block: false`, independently re-measured across all 18 rows, not just the two previously-flagged
   ones.

The remaining 8 must-haves (7 human_needed/backstop plus 1 present-but-behavior-unverified) are all
scenarios that require a live Notion workspace this execution environment does not have credentials
for — an identical, already-accepted constraint carried from the prior cycle and from Phase 1. None
of them are new risks introduced by this closure; all are pre-existing, documented gaps in what a
credential-less environment can exercise. DATA-03's static implementation is now complete; its full
closure to "Complete" status depends on a human running the ten deferred live-database checks.

---

_Verified: 2026-07-26_
_Verifier: Claude (gsd-verifier)_
