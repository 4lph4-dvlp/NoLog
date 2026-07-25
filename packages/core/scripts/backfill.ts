// One-time, throttled, resumable operator CLI. Marks every pre-existing public
// post as `emailed` so enabling the notify cron (Phase 4/5) never blasts a
// fork's entire back catalog on its first tick.
//
// Usage (from the repo root, after a fresh build — see prerequisites below):
//   npm run backfill --workspace=@4lph4/nolog-core -- --dry-run   (preview only, zero writes)
//   npm run backfill --workspace=@4lph4/nolog-core                (live run — marks posts)
//
// Prerequisites:
//   - NOTION_TOKEN and NOTION_DATABASE_ID exported in the shell (no dotenv
//     loading — matches verify-phase-1.ts/verify-403.ts exactly).
//   - A fresh `npm run build --workspace=@4lph4/nolog-core` — this script
//     imports from dist/, not src/, so a stale build makes Phase 1's methods
//     look nonexistent with a confusing "not a function" error.
//
// Proves DATA-03: every unemailed public post gets marked `emailed`, the
// summary line reports `N marked / M failed`, and the run is safe to
// interrupt and repeat — getUnemailedPublicPosts() filters server-side and
// markEmailed() is idempotent, so no local checkpoint/resume state is kept
// between runs. Re-running simply re-fetches from scratch.

import { parseArgs } from "node:util";
import {
  NologClient,
  NotionCapabilityError,
  MissingEmailedPropertyError,
} from "../dist/index.js";

// `parseArgs` is left in its default STRICT mode deliberately: `--dry-run` is
// the only gate in front of an irreversible bulk write, so a mistyped flag
// (e.g. `--dryrun`) must throw and exit non-zero before any Notion call is
// issued, rather than silently falling through into a live run.
const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
  },
});
const dryRun = values["dry-run"] as boolean;

const databaseId = process.env.NOTION_DATABASE_ID!;
const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId,
});

// Fixed inter-request delay — ~2.5 req/s, roughly 17% under Notion's
// documented ~3 req/s limit (D-09/D-10). Integer milliseconds only, no
// floating-point arithmetic anywhere in the throttle or the counters.
const DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let posts;
  try {
    posts = await client.getUnemailedPublicPosts();
  } catch (err) {
    if (err instanceof MissingEmailedPropertyError) {
      // Schema problem — the `emailed` checkbox doesn't exist yet. There is
      // no post list to iterate, so this aborts before the per-post loop.
      console.error("ABORT:", err.message);
    } else {
      // Any other failure of the initial fetch is fatal for the same reason:
      // there is nothing to continue to without a post list.
      console.error(
        "ABORT: initial fetch of unemailed public posts failed:",
        err instanceof Error ? err.message : String(err)
      );
    }
    process.exitCode = 1;
    return;
  }

  if (posts.length === 0) {
    // Legitimate outcome, not an error — but name the queried database
    // explicitly so a misconfigured run (wrong workspace/database id) can
    // never be mistaken for a genuinely empty back catalog.
    console.log(`Nothing to do — 0 unemailed public posts found in database ${databaseId}.`);
    return;
  }

  console.log(`Found ${posts.length} unemailed public post(s) in database ${databaseId}.`);

  if (dryRun) {
    // Iterate exactly as returned (created_time ascending) — never reorder.
    for (const post of posts) {
      console.log(`  ${post.id}  ${post.title}`);
    }
    console.log(
      `Dry run: ${posts.length} post(s) would be marked as emailed. No writes were performed.`
    );
    return;
  }

  // Live write path: mark every post, one at a time, throttled. No
  // confirmation prompt beyond omitting --dry-run (D-02).
  let marked = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      await client.markEmailed(post.id);
      marked += 1;
      console.log(`  marked  ${post.id}  ${post.title}`);
    } catch (err) {
      if (err instanceof NotionCapabilityError) {
        // Systemic setup failure — every remaining post would fail
        // identically. Abort immediately rather than burning the request
        // budget printing one identical failure line per remaining post
        // (D-04). This branch MUST be checked before the generic catch
        // below.
        console.error("ABORT:", err.message);
        console.error(`${marked} marked / ${failed} failed (partial — aborted)`);
        process.exitCode = 1;
        return;
      }

      // Any other per-post failure is logged and the loop continues — a
      // second run automatically picks these up, since
      // getUnemailedPublicPosts() already excludes everything that
      // succeeded (D-06).
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED  ${post.id}  ${post.title}: ${message}`);
      failed += 1;
    }

    // Hold the request spacing on both the success and the failure paths —
    // sleeping only on success would let a run of failures burst past the
    // rate limit.
    await sleep(DELAY_MS);
  }

  console.log(`${marked} marked / ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main();
