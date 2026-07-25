---
phase: 02-backfill-script
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - packages/core/scripts/backfill.ts
  - packages/core/package.json
findings:
  critical: 1
  warning: 0
  info: 2
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`packages/core/scripts/backfill.ts` and the `backfill` entry in `packages/core/package.json` were
reviewed against the phase's must-haves (D-01 through D-15) and the project's coding conventions.
The mainline logic is solid: throttle is a fixed integer 400ms with no floating-point creep, the
`marked`/`failed` counters are incremented exactly once per attempted post with no double-counting
across the retry path, exit codes are correct on every path (dry-run 0, nothing-to-do 0, abort 1,
partial-failure 1, clean completion 0), the `NotionCapabilityError` abort is checked before the
generic per-post catch, `parseArgs` is left in strict mode so a mistyped flag cannot degrade into a
live write, and `package.json` adds exactly the required entry with no lifecycle-hook exposure and
byte-identical dependency blocks.

One correctness gap was found by tracing the error classes back into `packages/core/src/client.ts`
(read-only context this phase): the write loop's systemic-vs-per-post error classification only
special-cases `NotionCapabilityError`, but `patchPage()` — the single method backing `markEmailed()`
— can also throw `MissingEmailedPropertyError` for the exact same reason `getUnemailedPublicPosts()`
can (a 400 response matching the emailed-property regex). That throw path is invisible to the write
loop's catch chain, so a schema change mid-run (the `emailed` property removed while a long backfill
is in flight) would be misclassified as an ordinary per-post failure and burn through every remaining
post's request budget instead of aborting immediately — the exact outcome D-04 was written to avoid.
See CR-01 below.

Two minor code-quality observations are also recorded as Info; neither risks incorrect behavior.

## Critical Issues

### CR-01: `MissingEmailedPropertyError` is not classified as a systemic write-loop failure

**File:** `packages/core/scripts/backfill.ts:130-169` (catch chain), cross-referenced against
`packages/core/src/client.ts:343-374` (`patchPage()`, read-only this phase)

**Issue:**
The per-post catch chain only treats `NotionCapabilityError` as a systemic, abort-the-run condition:

```ts
} catch (err) {
  if (err instanceof NotionCapabilityError) {
    // ABORT + return
  } else if (isRateLimited(err)) {
    // single retry
  } else {
    // per-post FAILED, continue
  }
}
```

But `client.ts`'s `patchPage()` — the only method backing `markEmailed()` — throws
`MissingEmailedPropertyError` under the same condition `getUnemailedPublicPosts()` already special-
cases at the top of `main()` (client.ts:368-369, mirroring client.ts:281-282's regex-matched 400):

```ts
if (res.status === 400 && /emailed/i.test(bodyText) && /propert/i.test(bodyText)) {
  throw new MissingEmailedPropertyError(bodyText);
}
```

If the `emailed` checkbox property is removed from the Notion schema *after* the initial fetch
succeeds but *while the write loop is still running* (a realistic scenario: at 400ms/post, a
backlog of a few thousand posts runs for tens of minutes to hours), every subsequent
`client.markEmailed(post.id)` call throws `MissingEmailedPropertyError`. That error is not an
`instanceof NotionCapabilityError`, is not rate-limited, so it falls into the generic `else`
branch: logged as an ordinary `FAILED` line, `failed += 1`, and the loop **continues** — for every
remaining post, one at a time, at 400ms each, all guaranteed to fail identically. This is precisely
the failure mode D-04's comment (`backfill.ts:132-136`) says the `NotionCapabilityError` branch
exists to prevent: "Abort immediately rather than burning the request budget printing one identical
failure line per remaining post." The classification is simply incomplete — it covers one of the two
systemic error classes `patchPage()` can produce, not both.

A second, narrower manifestation of the same gap: the nested retry attempt
(`backfill.ts:149-159`) has its own `try/catch` that does not re-check `instanceof
NotionCapabilityError` (or `MissingEmailedPropertyError`) at all — if capability is revoked in the
~1 second between a 429/529 response and the retry, that systemic condition is swallowed into an
ordinary `FAILED` line instead of aborting the run.

**Fix:** Extract a shared classifier and check it in both the outer and the retry catch, ahead of
the rate-limit check:

```ts
function isSystemicAbort(err: unknown): err is NotionCapabilityError | MissingEmailedPropertyError {
  return err instanceof NotionCapabilityError || err instanceof MissingEmailedPropertyError;
}

// ... in the per-post catch:
} catch (err) {
  if (isSystemicAbort(err)) {
    console.error("ABORT:", err.message);
    console.error(`${marked} marked / ${failed} failed (partial — aborted)`);
    process.exitCode = 1;
    return;
  } else if (isRateLimited(err)) {
    await sleep(RETRY_BACKOFF_MS);
    try {
      await client.markEmailed(post.id);
      marked += 1;
      console.log(`  marked  ${post.id}  ${post.title} (after rate-limit retry)`);
    } catch (retryErr) {
      if (isSystemicAbort(retryErr)) {
        console.error("ABORT:", retryErr.message);
        console.error(`${marked} marked / ${failed} failed (partial — aborted)`);
        process.exitCode = 1;
        return;
      }
      const retryMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
      console.error(
        `  FAILED  ${post.id}  ${post.title}: rate-limit retry also failed: ${retryMessage}`
      );
      failed += 1;
    }
  } else {
    ...
  }
}
```

## Info

### IN-01: `posts` declared without an explicit type annotation

**File:** `packages/core/scripts/backfill.ts:79`
**Issue:** `let posts;` relies on TypeScript's control-flow narrowing (the value is only assigned
once, inside the `try`, and the `catch` unconditionally returns) to arrive at `Post[]` by the time
`posts.length` is read. It compiles clean under `--strict` today, but it's one refactor away from a
silent `any` if the catch's `return` is ever removed or the assignment moved.
**Fix:** `let posts: Post[];` (import `Post` from `../dist/index.js`) makes the intended type
explicit rather than relying on flow analysis.

### IN-02: No explicit presence check for `NOTION_TOKEN` / `NOTION_DATABASE_ID`

**File:** `packages/core/scripts/backfill.ts:40-44`
**Issue:** `process.env.NOTION_TOKEN!` and `process.env.NOTION_DATABASE_ID!` use non-null assertions
with no runtime check. This exactly mirrors `verify-403.ts` and `verify-phase-1.ts` (an intentional,
documented match per D-13), and an unset value still surfaces as a loud `ABORT:` from the initial
fetch's catch-all branch rather than a silent success, so there's no safety gap — but the resulting
message is a raw Notion/network error rather than an actionable "env var not set" message, which is
a slightly worse operator experience than the project's own convention of gating on env-var presence
with a purpose-built message (see CLAUDE.md "Error Handling" — "Gate features by environment variable
presence"). Given this matches two existing analog scripts byte-for-byte, this is a pre-existing
convention question rather than a defect introduced by this phase.
**Fix (optional):** `if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) { console.error("ABORT: NOTION_TOKEN and NOTION_DATABASE_ID must be exported in the shell."); process.exitCode = 1; return; }` before constructing the client — but only worth doing if the analog scripts are updated in lockstep, to keep the three scripts consistent.

---

_Reviewed: 2026-07-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
