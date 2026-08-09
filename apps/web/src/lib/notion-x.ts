import { NotionAPI } from "notion-client";

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
 * Rethrows on failure — the leg-naming diagnostic line is owned by its one
 * remaining call site, post/[id]/page.tsx, per D-01. This function does not
 * log and does not swallow.
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
