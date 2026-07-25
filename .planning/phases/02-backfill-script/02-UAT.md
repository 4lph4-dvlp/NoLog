---
status: testing
phase: 02-backfill-script
source: [02-VERIFICATION.md]
started: 2026-07-26T00:00:00Z
updated: 2026-07-26T00:00:00Z
---

## Current Test

number: 1
name: D-01/D-03 dry-run listing against a live Notion database
expected: |
  One line per post showing its id and title, a count line naming the database id,
  a closing "no writes performed" line, exit code 0, and a re-run shows the count unchanged.
awaiting: user response

## Tests

### 1. D-01/D-03 dry-run listing
command: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`
setup: export NOTION_TOKEN and NOTION_DATABASE_ID for a real test database holding 2+ unemailed public posts
expected: One line per post showing its id and title, a count line naming the database id, a closing "no writes performed" line, exit code 0, and a re-run shows the count unchanged.
result: [pending]

### 2. D-05 abort path — missing `emailed` property
setup: remove the `emailed` Checkbox property from a test database
command: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`
expected: Exactly one ABORT line naming the missing-property fix, non-zero exit.
result: [pending]

### 3. DATA-03 SC#1 — live marking run
setup: test database with N (N >= 2) unemailed public posts
command: `npm run backfill --workspace=@4lph4/nolog-core`
expected: Final line reads `N marked / 0 failed`, exit 0, and a follow-up `--dry-run` reports 0 posts remaining.
result: [pending]

### 4. DATA-03 SC#2 — resumability across interruption
setup: several unemailed posts; start a live run, Ctrl+C partway, then re-run
expected: Second run's "found N" count reflects only the remainder; no re-marking or errors on already-emailed posts; completes cleanly.
result: [pending]

### 5. DATA-03 SC#3 — rate compliance
setup: 10+ unemailed posts, with per-post log timestamps visible
expected: Consecutive per-post lines are >=400ms apart (~2.5 req/s); no rate-limit failures in a healthy run.
note: DELAY_MS=400 and its unconditional single placement after every loop iteration (success, retry-success, retry-failure, per-post-failure) are statically confirmed; only the wall-clock invariant is unexercised.
result: [pending]

### 6. D-04 abort path — revoked "Update content" capability (primary, non-retry path)
setup: revoke "Update content" from the Notion integration; run a live backfill against 2+ unemailed posts
expected: Exactly one ABORT line, a partial-count line, non-zero exit.
result: [pending]

### 7. NEW — D-04 abort path via the mid-run schema change (closed by 02-02)
setup: start a live backfill against several unemailed posts, then remove the `emailed` Checkbox property from the database while the run is in flight
expected: The run aborts on the first affected post with exactly one ABORT line plus the partial count reached, and a non-zero exit — NOT one FAILED line per remaining post. This is the scenario gap 02-02 closed; it is the only genuinely new item this cycle.
result: [pending]

### 8. Backstop — >100-post pagination
setup: a database holding more than 100 unemailed public posts
expected: `getUnemailedPublicPosts()` paginates past Notion's page_size 100 boundary and the script iterates the complete returned array with no truncation.
result: [pending]

### 9. Backstop — mid-run idempotency race
setup: a post becomes emailed (by another process or a prior partial run) between the initial fetch and the loop reaching it
expected: The run completes without error and the post is counted in N marked, not M failed, because `markEmailed()` is idempotent.
result: [pending]

### 10. Backstop — 429/529 retry contract
setup: a real Notion rate-limit or service-overload response occurs mid-run
expected: Exactly one retry of that same post after the fixed 1000ms backoff, accounted for exactly once (marked once on success, failed once on permanent failure, never both).
result: [pending]

### 11. Prohibition — zero-work run must not read as a completed backfill
expected: Output makes the queried database identity and the zero-result fact explicit.
note: Static reading confirms `Nothing to do — 0 unemailed public posts found in database ${databaseId}.` satisfies the statement, but this is a non-authoritative LLM-judge verdict; human review recommended.
result: [pending]

### 12. Prohibition — script must not be reachable from any automatic npm lifecycle hook or CI path
expected: No preinstall/install/postinstall/prepare/prepublish/prepack/build/test/start script references backfill; no CI workflow triggers it automatically.
note: Re-confirmed this cycle — `packages/core/package.json` scripts are only `build`, `dev`, `backfill`; no `.github/workflows` or `vercel.json` exist. Non-authoritative per protocol; human review recommended.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps
