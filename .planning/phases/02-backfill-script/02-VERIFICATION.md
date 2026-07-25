---
phase: 02-backfill-script
verified: 2026-07-25T00:00:00Z
status: gaps_found
score: 12/21 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "A NotionCapabilityError aborts the whole run on first occurrence with exactly one ABORT message plus the partial count reached, and a non-zero exit — never one failure line per remaining post (D-04)"
    status: failed
    reason: "Confirmed via direct source reading (matches 02-REVIEW.md CR-01, independently reproduced by this verifier, not merely trusted from the review doc). The rate-limit retry's inner catch (packages/core/scripts/backfill.ts:149-159) performs NO instanceof check for NotionCapabilityError or MissingEmailedPropertyError at all — any error thrown by the retry attempt is unconditionally treated as an ordinary per-post failure (FAILED line + failed+=1 + continue). If Notion capability ('Update content') is revoked in the ~1s window between a 429/529 response and its single retry, the run does NOT abort — it keeps looping, printing one failure line per remaining post, which is the exact anti-pattern D-04 was written to prevent. A second, broader manifestation of the same gap: patchPage() (client.ts:368-369) — the sole method backing markEmailed() — can also throw MissingEmailedPropertyError on a mid-run schema change (the emailed checkbox removed while a long backfill is in flight), and the main per-post catch chain (backfill.ts:130-169) only special-cases NotionCapabilityError as systemic, not MissingEmailedPropertyError. A schema change mid-run is therefore misclassified as an ordinary per-post failure and the loop burns through every remaining post at 400ms each instead of aborting immediately."
    artifacts:
      - path: "packages/core/scripts/backfill.ts"
        issue: "Outer per-post catch (lines 130-169) classifies only `err instanceof NotionCapabilityError` as systemic; the retry's inner catch (lines 149-159) has no error-class check whatsoever"
    missing:
      - "A shared classifier (e.g. isSystemicAbort(err): err is NotionCapabilityError | MissingEmailedPropertyError) checked in BOTH the outer per-post catch and the retry's inner catch, positioned ahead of the generic per-post failure branch in each, so a systemic condition surfacing at any point in the loop — including inside the retry window — aborts immediately with exactly one message instead of continuing"
human_verification:
  - test: "D-01/D-03 dry-run listing: with NOTION_TOKEN/NOTION_DATABASE_ID exported for a real test database holding 2+ unemailed public posts, run `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`."
    expected: "One line per post showing its id and title, a count line naming the database id, a closing 'no writes performed' line, exit code 0, and a re-run shows the count unchanged."
    why_human: "Requires a live Notion workspace with real post data; no NOTION_TOKEN/NOTION_DATABASE_ID in this execution environment."
  - test: "D-05 abort path: remove the `emailed` Checkbox property from a test database, run the dry-run command."
    expected: "Exactly one ABORT line naming the missing-property fix, non-zero exit."
    why_human: "Requires live schema mutation on a real Notion database; the code path is statically sound (MissingEmailedPropertyError instanceof check precedes the generic branch in the initial-fetch catch) but the live trigger cannot be produced here."
  - test: "DATA-03 SC#1: against a test database with N (N ≥ 2) unemailed public posts, run `npm run backfill --workspace=@4lph4/nolog-core`."
    expected: "Final line reads `N marked / 0 failed`, exit 0, and a follow-up `--dry-run` reports 0 posts remaining."
    why_human: "Requires live writes against a real Notion database; no credentials in this execution environment."
  - test: "DATA-03 SC#2 (resumability): start a live run against several unemailed posts, Ctrl+C partway, re-run."
    expected: "Second run's 'found N' count reflects only the remainder; no re-marking or errors on already-emailed posts; completes cleanly."
    why_human: "Requires a live, interruptible run against a real Notion database."
  - test: "DATA-03 SC#3 (rate compliance): run against 10+ unemailed posts with visible per-post log timestamps."
    expected: "Consecutive per-post lines are ≥400ms apart (~2.5 req/s); no rate-limit failures in a healthy run."
    why_human: "This is a runtime timing invariant (behavior-dependent truth) — no test framework exists in this repo to exercise it, and it requires live wall-clock measurement against a real Notion database. The DELAY_MS=400 constant and its unconditional placement after every loop iteration (success and failure paths, including the retry branch) are statically confirmed; the invariant itself is unexercised by any test."
  - test: "D-04 abort path (full live confirmation of the intact primary path): revoke 'Update content' from the Notion integration, run a live backfill against 2+ unemailed posts."
    expected: "Exactly one ABORT line, a partial-count line, non-zero exit — for the primary (non-retry) code path only. Note: the retry sub-path gap (see Gaps above / CR-01) is a separate, statically-confirmed defect this human-check will not exercise unless capability is revoked specifically during the ~1s retry window."
    why_human: "Requires live capability revocation on a real Notion integration; the primary-path classification is statically sound but full live confirmation was not possible here."
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
    why_human: "Judgment-tier prohibition (same fail-closed default as above). This verifier confirmed no lifecycle hook in packages/core/package.json or the repo root package.json references backfill, and no .github/workflows or vercel.json exist in this repo at all — satisfied by direct inspection, but flagged non-authoritative per protocol; human review recommended."
behavior_unverified_items:
  - truth: "A live run's per-post log timestamps show at least 400ms between consecutive Notion write attempts, holding the sustained rate at ~2.5 req/s under Notion's ~3 req/s limit (DATA-03 SC#3, D-09/D-10)"
    test: "Run against 10+ unemailed posts and inspect per-post log timestamps for consistent ≥400ms gaps."
    expected: "No two consecutive per-post write log lines are less than 400ms apart, across the full run including after any rate-limit retry."
    why_human: "This is a runtime timing invariant; presence of the DELAY_MS=400 constant and its unconditional placement in the loop are statically confirmed, but no test in this repo (there is no test framework) exercises actual elapsed wall-clock time between requests."
---

# Phase 2: Backfill Script Verification Report

**Phase Goal:** Every pre-existing public post can be marked `emailed` in one throttled, resumable run, so enabling the notify path never blasts a fork's entire back catalog on its first cron tick.

**Verified:** 2026-07-25
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `--dry-run` lists every unemailed post (id+title) + count, zero writes (D-01/D-03) | ? human_needed | Zero-writes guaranteed statically (no `markEmailed()` call anywhere in the dry-run branch, `backfill.ts:109-118`); the per-post listing loop iterates and prints `post.id`/`post.title` correctly. Live listing against real data unconfirmed — no Notion credentials in this environment. |
| 2 | Live run starts marking with no prompt/confirm flag (D-02) | ✓ VERIFIED | Source-read confirms no `readline`, `prompt`, or confirm-flag logic anywhere in `backfill.ts`; the live path begins immediately after the `dryRun` early return. |
| 3 | Live run marks every unemailed post, prints `N marked / M failed` (SC#1, D-06) | ? human_needed | Summary line format confirmed in code (`backfill.ts:178`); counters/exit-code logic statically sound. Actual marking against real posts unconfirmed — no credentials. |
| 4 | Interrupt + re-run processes only unmarked posts, no re-marking/erroring (SC#2) | ? human_needed | No local checkpoint/state file exists (confirmed: no `fs` read/write API in the script); resumability depends entirely on Phase 1's `getUnemailedPublicPosts()` server-side filter, already live-verified per Phase 1. Live interrupt/re-run unconfirmed here. |
| 5 | Per-post log timestamps ≥400ms apart, ~2.5 req/s (SC#3, D-09/D-10) [edge: boundary] | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `DELAY_MS = 400` (integer) confirmed, and `await sleep(DELAY_MS)` runs unconditionally once per loop iteration (`backfill.ts:175`) regardless of branch taken. This is a runtime timing invariant; no test in this repo (none exists) exercises actual elapsed time. |
| 6 | Empty array → nothing-to-do line naming db, zero writes, exit 0 [edge: empty] | ✓ VERIFIED | `backfill.ts:99-105`: `if (posts.length === 0)` prints `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` and returns with default exit code 0; no per-post header printed in this branch. Deterministic code path, no live data required to confirm. |
| 7 | Exactly one post → `1 marked / 0 failed`, exit 0 [edge: empty/single] | ✓ VERIFIED | Deterministic: single-element `for...of` loop increments `marked` to 1 on success, `failed` stays 0, summary prints `1 marked / 0 failed`, `process.exitCode = 0` since `failed > 0` is false. |
| 8 | Posts processed/logged in returned order, never reordered [edge: ordering] | ✓ VERIFIED | `grep -Eq '\.sort\(|\.reverse\('` on non-comment lines returns no match; both dry-run and live loops use plain `for (const post of posts)`. |
| 9 | `marked + failed == attempted`, no double-counting [edge: precision] | ✓ VERIFIED | Traced all three per-post outcomes (success, retry-success, retry-failure, generic failure): exactly one of `marked`/`failed` is incremented per attempted post in every branch; abort branches (`NotionCapabilityError`) `return` before any counter touch for that post, consistent with "aborted, not attempted-and-counted." |
| 10 | Inter-request delay exact integer 400ms, no floating-point [edge: precision] | ✓ VERIFIED | `DELAY_MS = 400`, `RETRY_BACKOFF_MS = 1000` — both integer literals; `marked`/`failed` incremented by literal `1`; no floating-point arithmetic anywhere in `backfill.ts`. |
| 11 | `NotionCapabilityError` aborts on first occurrence, one ABORT message, never one failure line per remaining post (D-04) | ✗ FAILED | **See Gaps below (CR-01).** The primary per-post catch correctly checks `instanceof NotionCapabilityError` before the generic branch and aborts (`backfill.ts:131-140`). However the retry's inner catch (`backfill.ts:149-159`) has **no** `instanceof` check at all, and the outer catch never checks `MissingEmailedPropertyError` (also thrown by `patchPage()`, the sole backer of `markEmailed()`). Either systemic condition arising via those paths is misclassified as an ordinary per-post failure, and the loop continues instead of aborting — directly violating "never one failure line per remaining post." |
| 12 | `MissingEmailedPropertyError` from the **initial fetch** aborts before the per-post loop (D-05) | ? human_needed | Statically sound: `backfill.ts:83-86` checks `instanceof MissingEmailedPropertyError` first in the initial-fetch catch, prints one ABORT line, sets exit 1, returns before any loop exists. Live trigger (removing the schema property) unconfirmed here. |
| 13 | Any other initial-fetch failure aborts before the loop (D-15) | ✓ VERIFIED | Confirmed both statically (`backfill.ts:87-94`, generic `else` branch) and by live probe: invalid credentials produced `ABORT: initial fetch of unemailed public posts failed: Notion query failed: 401 ...`, exit code 1, no summary line printed. |
| 14 | Completed run: M>0 exits non-zero, M==0 exits 0 (D-08) | ✓ VERIFIED | `backfill.ts:179`: `process.exitCode = failed > 0 ? 1 : 0;` — deterministic. |
| 15 | Mistyped flag rejected, non-zero exit, before any Notion call | ✓ VERIFIED | Live-executed: `-- --dryrun` (typo) exits 1 with `ERR_PARSE_ARGS_UNKNOWN_OPTION`; `parseArgs` (line 33) runs before client construction (lines 41-44), so no Notion call is ever attempted on a parse failure. |
| 16 | Script lives at `packages/core/scripts/backfill.ts`, invocable via npm script (D-11) | ✓ VERIFIED | File exists (183 lines); `package.json` `scripts.backfill` = `"npx tsx scripts/backfill.ts"` confirmed by direct read and by structural check script. |
| 17 | Flags via npm `--` pass-through; no separate `backfill:dry-run` entry (D-12) | ✓ VERIFIED | `grep -n "backfill:dry" packages/core/package.json` returns no match; only one `backfill` entry exists. |
| 18 | Reads env vars from shell, no dotenv, no new dependency (D-13) | ✓ VERIFIED | `process.env.NOTION_TOKEN!` / `process.env.NOTION_DATABASE_ID!` read directly; no `dotenv` import; `dependencies`/`devDependencies` blocks byte-identical to pre-task state (confirmed via structural check script). |
| 19 | Backstop: >100-post pagination fully drained in one run [edge: boundary] | ? human_needed (backstop, insufficient_spec) | No live evidence available; abstains per backstop protocol. |
| 20 | Backstop: mid-run idempotency race counted as marked, not failed [edge: adjacency] | ? human_needed (backstop, insufficient_spec) | No live evidence available; abstains per backstop protocol. |
| 21 | Backstop: 429/529 triggers exactly one retry, no `Retry-After` header read [edge: adjacency] | ? human_needed (backstop, insufficient_spec) | `isRateLimited()` correctly anchors on the `Notion patch failed: 429 `/`529 ` message prefix (verified statically); the live rate-limit trigger itself abstains per backstop protocol. Also intersects with the CR-01 gap (item 11) for the systemic-error sub-case within the retry. |

**Score:** 12/21 truths verified (1 present-but-behavior-unverified, 7 human_needed/backstop-abstained, 1 failed)

### Prohibitions

| # | Prohibition | Status | Evidence |
|---|-------------|--------|----------|
| P1 | MUST NOT let a zero-work run read as a completed backfill | Resolved (non-authoritative — human review recommended) | `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` names both facts explicitly. No `verification: test\|judgment` tier declared in the plan; treated as judgment-tier per fail-closed default — flagged for human confirmation, not silently passed. |
| P2 | MUST NOT be reachable from any automatic npm lifecycle hook or default CI path | Resolved (non-authoritative — human review recommended) | No lifecycle-hook script (preinstall/install/postinstall/prepare/prepublish/prepack/build/test/start) references `backfill` in `packages/core/package.json` or the repo-root `package.json`; no `.github/workflows/` directory or `vercel.json` exists in this repo. Same fail-closed judgment-tier treatment as P1. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/core/scripts/backfill.ts` | Operator CLI, ≥90 lines, contains `getUnemailedPublicPosts` | ✓ VERIFIED | 183 lines; contains `getUnemailedPublicPosts` (line 81); type-checks clean under `--strict` against the freshly-built `dist`. |
| `packages/core/package.json` | `backfill` npm script entry | ✓ VERIFIED | `"backfill": "npx tsx scripts/backfill.ts"` present; dependency blocks byte-identical to pre-task state; no lifecycle hook references it. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/core/package.json` | `packages/core/scripts/backfill.ts` | `scripts.backfill` runs `npx tsx scripts/backfill.ts` | ✓ WIRED | Confirmed by direct read of `package.json`. |
| `packages/core/scripts/backfill.ts` | `packages/core/dist/index.js` | imports `NologClient`/error classes from built dist | ✓ WIRED | `import { NologClient, NotionCapabilityError, MissingEmailedPropertyError } from "../dist/index.js"` (line 22-27); type-checks clean against a freshly built `dist/index.d.ts`. |
| `packages/core/scripts/backfill.ts` | `packages/core/src/client.ts patchPage()` | rate-limit detection parses `patchPage()`'s generic Error message | ✓ WIRED (but see Gap #1) | `isRateLimited()` matches the exact `Notion patch failed: 429 `/`529 ` prefix produced by `client.ts:372`'s `throw new Error(\`Notion patch failed: ${res.status} ${bodyText}\`)`. The link itself is correctly wired; the gap is in what happens on the OTHER error class (`MissingEmailedPropertyError`) `patchPage()` can also throw, which this script's write-loop catch chain does not fully classify (Gap #1 / CR-01). |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds, script type-checks strict against fresh dist | `npm run build --workspace=@4lph4/nolog-core && npx tsc --noEmit --strict ...` | Build: 5 outputs generated cleanly. tsc: no errors, exit 0. | ✓ PASS |
| Invalid-credential dry-run aborts cleanly (D-15 path) | `NOTION_TOKEN=invalid... npm run --silent backfill -- --dry-run` | `ABORT: initial fetch ... Notion query failed: 401 ...`, exit 1, no Node internal trace | ✓ PASS |
| Mistyped flag rejected before any Notion call | `npm run --silent backfill -- --dryrun` | Exit 1, `ERR_PARSE_ARGS_UNKNOWN_OPTION` thrown at `parseArgs` (line 33), before client construction (lines 41-44) | ✓ PASS |
| Invalid-credential live run prints no summary line | `NOTION_TOKEN=invalid... npm run --silent backfill` | `ABORT: initial fetch ...`, exit 1, no `marked / ` summary line | ✓ PASS |
| `packages/core/src/` provably unmodified | `git diff --quiet -- packages/core/src/` | Exit 0, no diff | ✓ PASS |
| `package.json` structural integrity (script entry, no lifecycle hooks, byte-identical deps) | node structural-check script | `OK package.json` | ✓ PASS |
| No array reordering, no filesystem API in script | `grep` for `.sort(/.reverse(` and `writeFileSync/readFileSync/node:fs` | No matches for either | ✓ PASS |

_No test framework exists in this repo (documented, out-of-scope project constraint) — the above are single-shot deterministic commands, not a suite run._

### Probe Execution

No `scripts/*/tests/probe-*.sh` files or phase-declared probes found; this phase uses manual operator procedures per `02-VALIDATION.md`, not a probe-script convention. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DATA-03 | 02-01-PLAN.md | One-time backfill script marks all pre-existing public posts as `emailed`, throttled to ~3 req/s, safely re-runnable if interrupted | ⚠️ PARTIALLY SATISFIED | Core mechanics (throttle, exit codes, resumability design, dry-run safety, initial-fetch abort classification) are implemented and statically verified. Blocked from full SATISFIED status by the confirmed CR-01 gap (Truth #11): the write loop's systemic-error classification is incomplete, meaning "safely" is not fully held under a mid-run schema change or a capability revocation landing inside the retry window. |

No orphaned requirements — DATA-03 is the only requirement mapped to Phase 2, and it appears in the plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/core/scripts/backfill.ts` | 149-159 | Retry catch has no error-class check at all (CR-01) | 🛑 Blocker | See Gap #1 — systemic capability/schema failures during a retry are misclassified as ordinary per-post failures |
| `packages/core/scripts/backfill.ts` | 130-169 | Outer catch classifies only `NotionCapabilityError` as systemic, not `MissingEmailedPropertyError` (CR-01) | 🛑 Blocker | Same gap — a mid-run schema change burns through the remaining post budget instead of aborting |
| `packages/core/scripts/backfill.ts` | 79 | `let posts;` with no explicit type annotation (IN-01 in 02-REVIEW.md) | ℹ️ Info | Compiles clean under `--strict` via control-flow narrowing; cosmetic robustness note only, no behavioral risk today |
| `packages/core/scripts/backfill.ts` | 40-44 | Non-null assertions on `NOTION_TOKEN`/`NOTION_DATABASE_ID` with no explicit presence check (IN-02 in 02-REVIEW.md) | ℹ️ Info | Matches existing analog scripts byte-for-byte (documented, intentional per D-13); unset vars still surface as a loud ABORT via the initial-fetch catch-all, not a silent success — no safety gap, only a slightly less specific error message |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in `backfill.ts`. No placeholder/"coming soon" text. No empty-implementation patterns.

### Human Verification Required

See `human_verification` in frontmatter for the full list (11 items): the six live-database scenarios the plan explicitly deferred (dry-run listing, D-05 abort, SC#1, SC#2, SC#3, D-04 abort), three backstop truths (>100-post pagination, mid-run idempotency race, live 429/529 retry trigger), and two judgment-tier prohibitions (zero-work-run explicitness, lifecycle-hook/CI unreachability) whose static resolution is non-authoritative per protocol.

### Gaps Summary

One confirmed blocker (CR-01, carried forward from `02-REVIEW.md` and independently reproduced by this verifier through direct source reading, not review-doc trust): the write loop's three-way error classification (abort / retry / continue) is incomplete. It correctly recognizes `NotionCapabilityError` in the primary per-post catch, but:

1. The retry's inner catch block performs **no** `instanceof` check at all — any error surfacing during the single bounded retry (including a `NotionCapabilityError` or `MissingEmailedPropertyError`) is unconditionally treated as an ordinary per-post failure.
2. The outer catch never checks for `MissingEmailedPropertyError`, which `patchPage()` (the sole method backing `markEmailed()`) can also throw on a mid-run schema change — the same condition already special-cased for the *initial* fetch (D-05) but not for the *write loop*.

Both manifestations mean a systemic, run-wide failure condition can be silently downgraded to per-post noise, burning through the entire remaining request budget instead of aborting immediately — which is precisely the failure mode D-04 exists to prevent, just for a sibling error class and a narrow timing window the current code doesn't cover.

This is fixable with a small, well-scoped change (a shared `isSystemicAbort()` classifier checked in both catch sites, as the review's suggested fix already lays out) and does not require any live Notion credentials to fix or to re-verify — the fix and its regression check are both fully static.

The remaining 20 must-haves either verified cleanly through static analysis and executable probes, or are legitimately blocked only by the documented absence of live Notion credentials in this execution environment (matching the identical, already-accepted constraint from Phase 1) — those are routed to human verification, not treated as failures.

---

_Verified: 2026-07-25_
_Verifier: Claude (gsd-verifier)_
