---
status: testing
phase: 02-backfill-script
source: [02-VERIFICATION.md]
started: 2026-07-26T00:00:00Z
updated: 2026-07-26T00:00:00Z
---

## Current Test

number: 7
name: D-04 abort path via mid-run schema change (the scenario 02-02 closed)
expected: |
  Aborts on the first affected post with exactly one ABORT line plus the partial count
  reached, and a non-zero exit — NOT one FAILED line per remaining post.
setup_required: |
  Requires removing the `emailed` property WHILE a run is in flight. With only 3 posts the
  run lasts ~3.3s, which is too short to hit by hand — see the staging options in the entry.
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
result: pass
observed: |
  Found 1 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
    marked  36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
  1 marked / 0 failed
method_deviation: |
  The literal procedure (Ctrl+C a run partway, then re-run) is not executable on this
  database: 3 posts x 400ms means the whole run finishes in ~1.2s, so a hand-timed SIGINT
  cannot reliably land mid-loop. The partial state was instead produced directly by
  unchecking one of the three `emailed` boxes in the Notion UI, then re-running.

  This tests the same invariant more deterministically. What SC#2 actually asserts is a
  property of the partially-marked STATE ("processes only posts still unmarked, without
  re-marking or erroring on already-emailed posts"); the interruption is merely one way to
  produce that state. What the deviation does NOT exercise is a real SIGINT mid-loop — but
  the script installs no interrupt handler, holds no local state across iterations, and each
  markEmailed() is an independent idempotent PATCH, so a kill between writes has no state to
  corrupt. Residual risk judged negligible.
note: |
  Found exactly 1 (not 3), marked exactly that one, `1 marked / 0 failed`, exit 0. The two
  already-checked posts were never listed, never re-marked, and produced no error —
  check-before-write confirmed against a live database. SC#2 satisfied.

### 5. DATA-03 SC#3 — rate compliance
setup: 10+ unemailed posts, with per-post log timestamps visible
expected: Consecutive per-post lines are >=400ms apart (~2.5 req/s); no rate-limit failures in a healthy run.
note: DELAY_MS=400 and its unconditional single placement after every loop iteration (success, retry-success, retry-failure, per-post-failure) are statically confirmed; only the wall-clock invariant is unexercised.
result: pass
observed: |
  01:13:51.440 Found 3 unemailed public post(s) in database 3532c61e4a248000aac4f0bee1bbfb68.
  01:13:51.866   marked  6b42c61e-4a24-82b0-ae11-01fdb5e7110f  NoLog를 만들며
  01:13:52.963   marked  36e2c61e-4a24-8048-b7be-c6765c807e23  Antigravity 2.0 사용기
  01:13:54.070   marked  3702c61e-4a24-8001-a9a6-c4ff3aadadb5  만년필을 선물 하는 것
  01:13:54.470 3 marked / 0 failed
measured: |
  Gap 1 (marked #1 -> #2): 51.866 -> 52.963 = 1097ms  >= 400ms PASS
  Gap 2 (marked #2 -> #3): 52.963 -> 54.070 = 1107ms  >= 400ms PASS
  Observed sustained rate ~0.9 req/s, far under Notion's ~3 req/s limit.
  Each gap decomposes as the fixed 400ms throttle plus ~700ms of real Notion PATCH latency.

  BONUS CONFIRMATION not asked for by the test: the summary line lands at 54.470, exactly
  ~400ms after the final `marked` line at 54.070. That proves sleep(DELAY_MS) also runs after
  the LAST iteration — i.e. the throttle is unconditionally placed once per iteration rather
  than only between posts. That is the D-09/D-10 "runs once per iteration on every path"
  property, observed rather than merely read from source.
method_deviation: |
  The literal procedure asked for "10+ unemailed posts with visible per-post log timestamps".
  Two problems with it as written: (1) this database holds only 3 posts, and (2) the script
  does not emit timestamps at all, so the stated observation was impossible as specified.
  Substituted: piped stdout through a per-line `date +%H:%M:%S.%3N` prefixer, which measures
  the inter-request delay directly.

  What this does NOT cover: sustained behaviour at scale (drift over 100+ posts). Judged low
  residual risk — DELAY_MS is a fixed integer constant, not an adaptive/computed value, and
  its single unconditional placement per iteration is statically confirmed on all four paths
  (success, per-post failure, retry-success, retry-failure). Scale adds no new mechanism.
incidental_finding: |
  The first attempt at this test ran in a shell that did not carry NOTION_TOKEN (shell state
  does not persist between separate invocations), producing a live 401. Not a test failure —
  but it did incidentally exercise D-15 for free, against a real Notion 401:

    01:12:45.452 ABORT: initial fetch of unemailed public posts failed: Notion query failed:
      401 {"object":"error","status":401,"code":"unauthorized","message":"API token is invalid.",
      "request_id":"31b1877e-8b0e-4db3-a67f-d10034eb6c28"}
    npm error code 1

  This confirms 02-01's D-15 truth live: "Any other failure of the initial
  getUnemailedPublicPosts() call also aborts before the per-post loop with one ABORT message
  and a non-zero exit." Exactly one ABORT line, no per-post lines emitted, exit 1. That truth
  had only ever been checked statically and via a deliberately-bogus-token probe; this is an
  organic confirmation with a genuine Notion 401 body.

  Also note the timing: 01:12:37.746 (tsx start) -> 01:12:45.452 (abort) is ~7.7s spent on a
  single failing query round-trip. Unrelated to the throttle, but worth knowing that Notion
  API latency here is seconds, not milliseconds — the 400ms throttle is not the dominant cost.

### 6. D-04 abort path — revoked "Update content" capability (primary, non-retry path)
setup: revoke "Update content" from the Notion integration; run a live backfill against 2+ unemailed posts
expected: Exactly one ABORT line, a partial-count line, non-zero exit.
result: pass
evidence: self-reported
note: |
  User replied `pass`. Unlike tests 1-5, no console output was captured for this one, so the
  record rests on the tester's confirmation rather than an observed transcript. Recorded as
  passing per the tester's verdict; flagged here only so the evidentiary weight is not
  overstated later. This is the live confirmation of D-04's primary (non-retry) abort path —
  the same contract whose retry-window and schema-change siblings were the CR-01 gap that
  this whole 02-02 cycle closed — so if the run output is still in scrollback it is worth
  pasting into this entry.

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
passed: 7
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
