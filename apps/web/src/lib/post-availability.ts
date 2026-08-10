import { parsePageId } from "notion-utils";
import { isDiagnosticsEnabled } from "@/lib/notion-x";

/**
 * Discriminates a `null` `getPost()` result into a genuine "missing" page
 * versus a transient "unavailable" (failed) fetch.
 *
 * Contract:
 * - Called ONLY after `getPost()` (apps/web/src/lib/notion.ts) has already
 *   returned `null` for the same page id, on the already-failed path.
 * - Makes at most one outbound request to Notion.
 * - NEVER throws to its caller — every branch, including a thrown `fetch`,
 *   resolves to a verdict rather than propagating.
 *
 * Deliberately avoided mechanisms — do not "simplify" this back into
 * either of them:
 * - Retrying `getPost(id)`. `apps/web/src/lib/notion.ts:23-25` wraps
 *   `getPost` in React `cache()`, so a second call within the same render
 *   returns the memoised `null` — a no-op by construction, not a fresh
 *   attempt.
 * - Re-deriving the page's `status` property in this file. STATE.md's
 *   2026-07-25 CORRECTION (CR-01) recorded the real cost of duplicating
 *   `packages/core`'s property extraction in a second place — this file
 *   never inspects Notion page properties itself; it only asks Notion
 *   whether the page exists and is fetchable.
 */

export type MissingPostVerdict = "missing" | "unavailable";

// Copied from `packages/core/src/client.ts`'s `NOTION_VERSION` constant —
// `packages/core` is a published npm package and must not be modified or
// imported from directly (REQUIREMENTS.md D-05).
const NOTION_VERSION = "2022-06-28";

/** Maximum length of a captured response-body excerpt.
 *
 * 200 was chosen in Phase 7 (D-03) over 1000: it is enough to classify a
 * response — a `<!DOCTYPE html>` Cloudflare page versus a Notion JSON error
 * is decided in the first ~90 characters — while bounding how much of an
 * upstream body ever reaches a log line. The sibling constant this once
 * mirrored in `lib/notion-x.ts` was removed by Phase 8's D-19 teardown; the
 * rationale is restated here rather than pointing at a symbol that no longer
 * exists. */
const BODY_EXCERPT_MAX_LENGTH = 200;

// Module-scope one-shot log latch (pattern copied from
// `apps/web/src/app/api/subscribe/route.ts`'s `unconfiguredLogged`) — bounds
// the unconfigured-deployment log line to one per serverless instance.
let unconfiguredLogged = false;

export async function classifyMissingPost(
  pageId: string,
): Promise<{ verdict: MissingPostVerdict; detail: string }> {
  const token = process.env.NOTION_TOKEN;

  // 1. Unconfigured deployment — no posts exist at all, so a 404 is the
  // truthful answer and today's behaviour is preserved exactly. No network
  // call.
  if (!token) {
    if (!unconfiguredLogged) {
      unconfiguredLogged = true;
      console.error(
        "[PostPage:post] classifyMissingPost called while NOTION_TOKEN is unset — classifying as missing. Further occurrences in this instance are not logged.",
      );
    }
    return { verdict: "missing", detail: buildBasicDetail("missing", "unconfigured") };
  }

  // 2. A string that is not a real Notion page identifier cannot name a
  // real page. This also keeps caller-controlled input out of the outbound
  // URL below (T-07-07) — the URL is built from `parsedId`, never from the
  // raw `pageId` parameter.
  const parsedId = parsePageId(pageId);
  if (!parsedId) {
    return { verdict: "missing", detail: buildBasicDetail("missing", "invalid-id") };
  }

  // 3/4. Ask Notion directly. `cache: "no-store"` — this call must never be
  // served from Next's Data Cache, or it would echo the very failure it is
  // trying to discriminate.
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${parsedId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      // Notion authoritatively answered: no such page.
      return { verdict: "missing", detail: await buildResponseDetail("missing", "notion-404", res, pageId) };
    }

    if (res.ok) {
      // The page is fetchable, so getPost()'s null came from a non-public
      // status or an unparseable page object — both are legitimately
      // not-found for a reader.
      return { verdict: "missing", detail: await buildResponseDetail("missing", "notion-ok", res, pageId) };
    }

    // Any other status (401/403/429/5xx) — Notion did not authoritatively
    // say "no such page"; treat as a transient failure.
    return { verdict: "unavailable", detail: await buildResponseDetail("unavailable", "notion-error", res, pageId) };
  } catch {
    // DNS, TLS, timeout, abort — caught here so it never escapes this
    // function.
    return { verdict: "unavailable", detail: buildBasicDetail("unavailable", "request-failed") };
  }
}

function buildBasicDetail(verdict: MissingPostVerdict, reason: string): string {
  return JSON.stringify({ verdict, reason });
}

async function buildResponseDetail(
  verdict: MissingPostVerdict,
  reason: string,
  res: Response,
  pageId: string,
): Promise<string> {
  if (!isDiagnosticsEnabled()) {
    return buildBasicDetail(verdict, reason);
  }

  const bodyText = await res.text();
  return JSON.stringify({
    verdict,
    reason,
    status: res.status,
    contentType: res.headers.get("content-type"),
    bodyExcerpt: bodyText.slice(0, BODY_EXCERPT_MAX_LENGTH),
    pageIdShape: describePageIdShape(pageId),
    pageIdLength: pageId.length,
  });
}

/** Derived, coarse shape of a page id for diagnostic purposes — never the
 * raw id itself, so a log line can report that an id was malformed without
 * echoing caller-supplied input. The near-identical helper this once mirrored
 * in `lib/notion-x.ts` was removed by Phase 8's D-19 teardown, which leaves
 * this the sole copy — no longer a duplicate to keep in sync. */
function describePageIdShape(pageId: string): "compact-32-hex" | "dashed-uuid" | "unrecognized" {
  if (/^[0-9a-f]{32}$/i.test(pageId)) {
    return "compact-32-hex";
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    return "dashed-uuid";
  }
  return "unrecognized";
}
