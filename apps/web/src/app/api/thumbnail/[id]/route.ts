import { parsePageId } from "notion-utils";
import { NologClient, type Post } from "@4lph4/nolog-core";
import { NOLOG_USER_AGENT } from "@/lib/notion-x";

export const runtime = "nodejs";

// Second, separate NologClient instance — D-14, the phase's primary
// landmine. `apps/web/src/lib/notion.ts:8-17`'s shared `nologClient`
// singleton bakes `fetchOptions: { next: { revalidate: CONFIG.revalidate,
// tags: [...] } }` into its constructor, and every method that instance
// exposes spreads that option into its own raw `fetch()` call
// (packages/core/src/client.ts). Removing a React `cache()` wrapper only
// strips per-render memoization — it does NOT remove the 180-second Next
// Data Cache entry that instance's constructor bakes in. Only a genuinely
// separate NologClient, constructed here with `cache: "no-store"`, actually
// bypasses that cache. Do not "simplify" this into an export off the shared
// singleton — that reproduces the exact bug this route exists to fix.
const freshNologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: process.env.NOTION_DATABASE_ID ?? "",
  fetchOptions: { cache: "no-store" },
});

// Mirrors apps/web/next.config.ts's images.remotePatterns exactly. Duplicated
// rather than imported — 09-RESEARCH.md flags importing next.config.ts from
// application code as unverified with no precedent in this repo. If a third
// Notion region host is ever added to next.config.ts, add it here too.
const ALLOWED_HOSTS = new Set([
  "s3.us-west-2.amazonaws.com",
  "prod-files-secure.s3.us-west-2.amazonaws.com",
]);

// D-06: 14400 seconds (4 hours) matches Next 16's own images.minimumCacheTTL
// default, so the CDN holds these bytes for exactly as long as the image
// optimizer would independently hold its derived variant anyway — the
// Function ends up running on the order of once per image per four hours
// instead of once per reader, which is what makes D-05's byte-proxying
// affordable, while adding no staleness beyond what the platform already
// imposes when an operator swaps a thumbnail in Notion. No browser-facing
// max-age is set: the browser never requests this path directly, Next's
// image component rewrites it to the optimizer path, and the optimizer sets
// its own reader-facing headers.
const THUMBNAIL_CACHE_CONTROL = "public, s-maxage=14400, immutable";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Only the parsed value may reach any downstream call — never the raw
  // route segment. Identical discipline to
  // apps/web/src/lib/post-availability.ts:69-76: both of parsePageId's
  // regexes are word-boundary matched and not anchored, so only the parsed
  // return value is safe to build a URL from (D-07).
  const parsedId = parsePageId(id);
  if (!parsedId) {
    return new Response(null, { status: 400 });
  }

  // getPost() answers null for a missing page, any Notion-side error, and a
  // page whose status is not "public" — reusing it inherits the
  // unpublished-post filter for free (packages/core/src/client.ts:328-334).
  // It never throws (its own body is wrapped in try/catch that returns
  // null on any failure), so no try/catch is needed at this call site.
  const post: Post | null = await freshNologClient.getPost(parsedId);

  if (!post) {
    return new Response(null, { status: 404 });
  }

  // IMG-05's server-side half: an external thumbnail is never served
  // through this route, even if a caller hand-constructs the path.
  if (post.thumbnailType !== "file" || !post.thumbnail) {
    return new Response(null, { status: 404 });
  }

  let hostname: string;
  try {
    hostname = new URL(post.thumbnail).hostname;
  } catch {
    console.warn("[Thumbnail] resolved thumbnail value is not a parseable URL");
    return new Response(null, { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(hostname)) {
    console.warn("[Thumbnail] resolved host is not on the allowlist");
    return new Response(null, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(post.thumbnail, {
      // Reject the promise instead of silently following a 3xx from an
      // otherwise-allowlisted host (Pitfall 1's redirect-bypass vector).
      redirect: "error",
      headers: { "User-Agent": NOLOG_USER_AGENT },
    });
  } catch {
    console.warn("[Thumbnail] outbound fetch to resolved URL failed or redirected");
    return new Response(null, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    console.warn("[Thumbnail] upstream response was not an ok image response");
    return new Response(null, { status: 502 });
  }

  // Pass the upstream body straight through — never buffer via
  // .arrayBuffer()/.blob()/.text() first, which would defeat D-05's entire
  // streaming point.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": THUMBNAIL_CACHE_CONTROL,
      // Second layer behind the content-type assertion above, since this
      // route is same-origin and a mis-typed body would otherwise be
      // sniffable.
      "x-content-type-options": "nosniff",
    },
  });
}
