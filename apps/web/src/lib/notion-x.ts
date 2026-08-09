import { NotionAPI } from "notion-client";
import { parsePageId } from "notion-utils";

/**
 * Unofficial Notion API client for fetching full page content (recordMap).
 *
 * Used exclusively for page rendering via react-notion-x.
 * For database queries (post listing, categories), we still use the
 * official @notionhq/client in notion.ts.
 *
 * Auth: No token needed for publicly shared Notion pages.
 * If your pages are private, set NOTION_TOKEN_V2 in .env.local.
 */
// D-05: hardcoded, not forker-configurable — no env var, no site.config.ts
// field. D-19's whole premise is that a forker ends up with zero net new
// env vars; an honest self-identifying UA is the fix itself (D-01/D-03),
// not a per-deployment knob. Exported (unlike DIAGNOSTICS_GATE_VALUE below)
// because Phase 9's thumbnail-proxy work reuses it (D-06).
export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)";

const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
  ofetchOptions: {
    headers: {
      "User-Agent": NOLOG_USER_AGENT,
    },
  },
});

/**
 * Fetch the full page recordMap for rendering with react-notion-x.
 *
 * Rethrows on failure — the leg-naming diagnostic line is owned by each call
 * site (post/[id]/page.tsx, /api/diagnose-page), per D-01. This function does
 * not log and does not swallow.
 */
export async function getPageRecordMap(pageId: string) {
  return notionX.getPage(pageId);
}

// D-02 (Claude's Discretion): unset means inert, matching the Cusdis/Resend
// convention already used throughout this repo — a forker who sets no env
// vars gets zero diagnostic behavior change. Only the exact string "1" is
// active; any other value (including "true") is treated as unset.
const DIAGNOSTICS_GATE_VALUE = "1";

/** Whether deep-diagnostic capture (status/content-type/body-excerpt/probe) is active. Read at call time, not cached at module load, so tests and route handlers observe env changes without a process restart. */
export function isDiagnosticsEnabled(): boolean {
  return process.env.NOTION_DEBUG_DIAGNOSTICS === DIAGNOSTICS_GATE_VALUE;
}

/**
 * Module-private type guard narrowing to the `ofetch` `FetchError` shape
 * `notion-client` throws for its own HTTP failures (07-RESEARCH.md's
 * verified discriminator). Matches on `err.name === "FetchError"` plus
 * presence of a `status` key — never on message substrings, and `.status`
 * is never read off an unnarrowed error.
 */
function isFetchErrorShape(
  err: unknown,
): err is Error & { status?: number; data?: unknown; statusText?: string; response?: Response } {
  return err instanceof Error && err.name === "FetchError" && "status" in err;
}

/** Derived, coarse shape of a page id for diagnostic purposes — never the raw id itself. */
function describePageIdShape(pageId: string): "compact-32-hex" | "dashed-uuid" | "unrecognized" {
  if (/^[0-9a-f]{32}$/i.test(pageId)) {
    return "compact-32-hex";
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    return "dashed-uuid";
  }
  return "unrecognized";
}

// D-04: the exact unofficial endpoint notion-client's own getPage() call
// hits internally for the first content chunk. This is a module-level
// constant string, never assembled from caller input (T-07-03) — the page
// id travels only inside the JSON request body below.
const LOAD_PAGE_CHUNK_URL = "https://www.notion.so/api/v3/loadPageChunk";

/** Maximum length of a captured response-body excerpt (D-03) — enough to identify an HTML error page vs. a JSON error payload, never the full body. */
const BODY_EXCERPT_MAX_LENGTH = 200;

/**
 * Describes a `getPageRecordMap` failure as a single-line JSON string (no
 * bracket prefix — the caller supplies that, D-05). Must never throw: every
 * branch, including the D-04 probe, is wrapped so a diagnostic helper never
 * becomes a second point of failure. The return value is JSON-stringified
 * (not a formatted/multi-line object) so the whole payload stays grep-able
 * on one line in the Vercel dashboard.
 *
 * With diagnostics disabled (the default for an unconfigured fork), only
 * `name` and `message` are ever computed or returned — no probe request is
 * made, and no HTTP status, content-type, or body excerpt is possible to
 * leak (first `must_haves.prohibitions` entry in 07-01-PLAN.md).
 */
export async function describeFetchFailure(
  error: unknown,
  pageId: string,
  allowProbe = false,
): Promise<string> {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);

  if (!isDiagnosticsEnabled()) {
    return JSON.stringify({ name, message });
  }

  const payload: Record<string, unknown> = {
    name,
    message,
    pageIdShape: describePageIdShape(pageId),
    pageIdLength: pageId.length,
  };

  if (isFetchErrorShape(error) && error.status !== undefined) {
    payload.status = error.status;
    payload.contentType = error.response?.headers?.get("content-type") ?? null;
    const data = error.data;
    payload.bodyExcerpt =
      typeof data === "string" ? data.slice(0, BODY_EXCERPT_MAX_LENGTH) : JSON.stringify(data ?? null).slice(0, BODY_EXCERPT_MAX_LENGTH);
    payload.viaProbe = false;
    return JSON.stringify(payload);
  }

  if (!allowProbe) {
    return JSON.stringify(payload);
  }

  // 07-REVIEW F-01: validate BEFORE any outbound request, and refuse rather
  // than fall back to the raw value. `describeFetchFailure` is called from
  // `post/[id]/page.tsx`'s content leg with the unvalidated dynamic route
  // segment, so a request to `/post/<arbitrary string>` reaches here. A
  // previous `parsePageId(pageId) ?? pageId` fallback would have placed that
  // caller-controlled string into the body of a POST to Notion. The
  // destination URL is a fixed constant so this was never redirectable, but
  // "validate first, reject on failure" is the rule the sibling
  // `api/diagnose-page/route.ts` already follows (it answers 400) and this
  // path must not be the one place that opts out of it.
  const probePageId = parsePageId(pageId);
  if (!probePageId) {
    payload.probeSkipped = "unparseable_page_id";
    payload.viaProbe = false;
    return JSON.stringify(payload);
  }

  // D-04 raw-fetch probe: fires exactly once, only for a non-FetchError-shape
  // failure (notion-client's own "Notion page not found" throw, or a
  // FetchError with no attached Response), and only when the caller opts in
  // via allowProbe. Replicates notion-client's own loadPageChunk request
  // shape. Never places a request header, cookie, or env-var value into the
  // returned payload — the excerpt is sourced exclusively from Notion's own
  // HTTP response body.
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.NOTION_TOKEN_V2) {
      headers.cookie = `token_v2=${process.env.NOTION_TOKEN_V2}`;
    }
    const res = await fetch(LOAD_PAGE_CHUNK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        pageId: probePageId,
        limit: 30,
        chunkNumber: 0,
        cursor: { stack: [] },
        verticalColumns: false,
      }),
    });
    const bodyText = await res.text();
    payload.status = res.status;
    payload.contentType = res.headers.get("content-type");
    payload.bodyExcerpt = bodyText.slice(0, BODY_EXCERPT_MAX_LENGTH);
    payload.viaProbe = true;
  } catch (probeError) {
    // A probe that cannot connect is itself diagnostic evidence — never let
    // it throw out of this helper.
    payload.probeError = probeError instanceof Error ? probeError.message : String(probeError);
  }

  return JSON.stringify(payload);
}
