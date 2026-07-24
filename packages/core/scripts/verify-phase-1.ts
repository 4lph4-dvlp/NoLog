// Manual verification script (not a unit test — no test framework exists in
// this repo, per REQUIREMENTS.md's explicit "Adding a test framework" out-of-scope
// item). Run via `npx tsx packages/core/scripts/verify-phase-1.ts` from the repo
// root, against a real Notion workspace, after rebuilding packages/core
// (`npm run build --workspace=@4lph4/nolog-core` — this script imports from
// dist/, not src/, so a stale build makes new methods look nonexistent).
//
// Requires NOTION_TOKEN and NOTION_DATABASE_ID env vars pointing at a test
// database that has a Checkbox property named exactly "Emailed" and at least
// one Status=public, Emailed-unchecked post.
//
// Proves DATA-01 (getUnemailedPublicPosts filters correctly) and DATA-02
// (markEmailed's write is durable and visible on a subsequent read) together,
// per RESEARCH.md's mark-then-requery Code Example.

import { NologClient } from "../dist/index.js";

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});

async function main() {
  const before = await client.getUnemailedPublicPosts();
  console.log(`Before: ${before.length} unemailed public posts`);
  if (before.length === 0) {
    console.log("No unemailed posts to test against — publish a test post first.");
    return;
  }

  const target = before[0];
  console.log(`Marking page ${target.id} ("${target.title}") as emailed...`);
  await client.markEmailed(target.id);

  const after = await client.getUnemailedPublicPosts();
  const stillPresent = after.some((p) => p.id === target.id);
  console.log(
    stillPresent
      ? "FAIL: post still appears in getUnemailedPublicPosts() after markEmailed()"
      : "PASS: post correctly excluded after markEmailed()"
  );
}

main();
