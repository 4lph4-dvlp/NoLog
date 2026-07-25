---
status: testing
phase: 02-backfill-script
source: [02-VERIFICATION.md]
started: 2026-07-26T00:00:00Z
updated: 2026-07-26T00:00:00Z
---

## Current Test

number: 4
name: DATA-03 SC#2 — resumability / check-before-write
expected: |
  A re-run against a partially-marked database processes only the still-unmarked
  posts, re-marks nothing, and errors on nothing.
setup_required: uncheck ONE of the three `emailed` boxes in Notion, leaving two checked
awaiting: user response

## Tests

### 1. D-01/D-03 dry-run listing
command: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`
setup: export NOTION_TOKEN and NOTION_DATABASE_ID for a real test database holding 2+ unemailed public posts
expected: One line per post showing its id and title, a count line naming the database id, a closing "no writes performed" line, exit code 0, and a re-run shows the count unchanged.
result: pass
observed: |
  Found 3 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
    6b42c61e-4a24-82b0-ae11-01fdb5e7110f  NoLog를 만들며
    36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
    3702c61e-4a24-8001-a9a6-c4ff3aadadb5  만년필을 선물 하는 것
  Dry run: 3 post(s) would be marked as emailed. No writes were performed.
note: |
  Per-post id+title lines, the count line naming the database id, and the explicit
  "No writes were performed." tail all confirmed against a live Notion database.
  The "re-run shows the count unchanged" sub-clause was not separately exercised;
  it is entailed by the zero-write property already confirmed on this same run.
  Database 3532c61e... holds the author's real blog posts (production).

### 2. D-05 abort path — missing `emailed` property
setup: remove the `emailed` Checkbox property from a test database
command: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`
expected: Exactly one ABORT line naming the missing-property fix, non-zero exit.
result: pass
observed: |
  ABORT: emailed property not found on this database — add it in Notion first
  (Settings → add a Checkbox property named "emailed"). See README.
  (Notion said: Notion query failed: 400 {"object":"error","status":400,
  "code":"validation_error","message":"Could not find property with name or id: emailed",
  "request_id":"80eaad5e-2330-49ff-965c-739f1a03a60f"})
  npm error code 1
note: |
  Exactly one ABORT line, actionable remediation text, non-zero exit — all confirmed.

  SIGNIFICANT SIDE FINDING — partially discharges a long-standing UNVERIFIED note.
  STATE.md and the inline comment at packages/core/src/client.ts:~360 both record that
  the missing-`emailed`-property detection was a best-guess pattern-match never validated
  against live Notion. This run produced the real Notion error body for the QUERY path:
    status 400, code "validation_error",
    message "Could not find property with name or id: emailed"
  That body satisfies patchPage()'s heuristic `status === 400 && /emailed/i && /propert/i`
  (it contains both "emailed" and "property"), which is strong evidence the guess is right.
  STILL NOT DIRECTLY OBSERVED: the PATCH endpoint's own error body. This run exercised
  getUnemailedPublicPosts() (the query path), not patchPage(). The patch-path heuristic
  remains inferred-by-analogy, not measured. Test 7 (mid-run schema removal) is the one
  that would exercise it directly.

### 3. DATA-03 SC#1 — live marking run
setup: test database with N (N >= 2) unemailed public posts
command: `npm run backfill --workspace=@4lph4/nolog-core`
expected: Final line reads `N marked / 0 failed`, exit 0, and a follow-up `--dry-run` reports 0 posts remaining.
result: pass
observed: |
  Found 3 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
    marked  6b42c61e-4a24-82b0-ae11-01fdb5e7110f  NoLog를 만들며
    marked  36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
    marked  3702c61e-4a24-8001-a9a6-c4ff3aadadb5  만년필을 선물 하는 것
  3 marked / 0 failed
  User confirmed in the Notion UI that all three `emailed` checkboxes are now checked.
note: |
  Write half CONFIRMED: per-post `marked` lines, the `3 marked / 0 failed` summary, exit 0,
  and — crucially — the user visually confirmed the durable checkbox state in Notion, which
  is the real proof that markEmailed() persists rather than merely returning success.

  Second half NOT YET EXERCISED: the follow-up `--dry-run` reporting 0 posts remaining.
  Unlike test 1's re-run clause (trivially entailed by performing zero writes), this one is
  a genuinely distinct assertion — it proves the query filter's unchecked-`emailed` condition
  actually excludes already-marked posts. That filter is the entire mechanism behind SC#2
  resumability (check-before-write), so it is not safe to infer.

  RESOLVED — follow-up dry-run observed:
    Nothing to do — 0 unemailed public posts found in database 3532c61e4a248000aac4f0bee1bbfb68.
  The query filter does exclude already-marked posts. SC#1 fully confirmed end-to-end.
  This same output also discharges test 11 by direct observation (see that entry).

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
result: pass
observed: |
  Nothing to do — 0 unemailed public posts found in database 3532c61e4a248000aac4f0bee1bbfb68.
note: |
  UPGRADED FROM STATIC JUDGMENT TO DIRECT OBSERVATION. The prior verdict was a
  non-authoritative LLM-judge reading of the source string. The follow-up dry-run in test 3
  produced the real zero-work output against a live database, and it does exactly what the
  prohibition requires: it names the queried database id (3532c61e...) AND states the
  zero-result fact explicitly, so a misconfigured run (wrong workspace / wrong database id)
  cannot be mistaken for a genuinely empty back catalogue. No longer judgment-tier.

### 12. Prohibition — script must not be reachable from any automatic npm lifecycle hook or CI path
expected: No preinstall/install/postinstall/prepare/prepublish/prepack/build/test/start script references backfill; no CI workflow triggers it automatically.
note: Re-confirmed this cycle — `packages/core/package.json` scripts are only `build`, `dev`, `backfill`; no `.github/workflows` or `vercel.json` exist. Non-authoritative per protocol; human review recommended.
result: [pending]

## Summary

total: 12
passed: 4
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
