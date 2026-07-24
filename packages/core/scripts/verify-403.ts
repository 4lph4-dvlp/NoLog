// Manual verification script (not a unit test — see verify-phase-1.ts's header
// comment for the "why no test framework" rationale). Run via
// `npx tsx packages/core/scripts/verify-403.ts` from the repo root, AFTER
// rebuilding packages/core (`npm run build --workspace=@4lph4/nolog-core`,
// Pitfall 4 — this script imports from dist/, not src/) AND after temporarily
// removing the "Update content" capability from the Notion integration in the
// Developer Portal (Settings → Capabilities → Content Capabilities).
//
// Requires NOTION_TOKEN and NOTION_DATABASE_ID env vars pointing at a test
// database with at least one Status=public post.
//
// Proves DATA-04 / D-03: markEmailed() throws an instanceof-distinguishable
// NotionCapabilityError (not a generic Error) when Notion returns 403 for the
// write, per RESEARCH.md's 403 capability Code Example.

import { NologClient, NotionCapabilityError } from "../dist/index.js";

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});

async function main() {
  const posts = await client.getUnemailedPublicPosts(); // read still works (capability unaffected)
  if (posts.length === 0) {
    console.log("No unemailed posts to test against — publish a test post first.");
    return;
  }

  try {
    await client.markEmailed(posts[0].id);
    console.log("FAIL: expected a NotionCapabilityError, write succeeded instead");
  } catch (err) {
    if (err instanceof NotionCapabilityError) {
      console.log("PASS:", err.message);
    } else {
      console.log("FAIL: wrong error type thrown:", err);
    }
  }
}

main();
