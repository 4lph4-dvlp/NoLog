import { NotionAPI } from "notion-client";
import type { ExtendedRecordMap } from "notion-types";

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

// CONT-05 (D-10): the boundary a "recordMap arrived but has nothing to
// render" is judged against. A named constant, not an inlined literal, so
// the boundary rule is explicit and there is exactly one scalar to
// recalibrate if the shape of a Notion response ever changes.
//
// EMPIRICAL, measured 2026-08-10 (plan 08-02, closing 08-RESEARCH.md
// Assumption A1). This value is NOT derived — the derivation was tried and
// was wrong. The original reasoning said a genuinely empty page returns a
// single entry (its own container block), giving a threshold of 2. Fetching
// a real empty public page in this database through the same getPage() path
// production uses, with the shipped User-Agent, returned **3**:
//
//     empty UAT fixture   blockKeys=3
//     real post           blockKeys=21
//     real post           blockKeys=45
//     real post           blockKeys=44
//
// A page inside a Notion database carries its ancestor chain in the record
// map — the page itself plus its parent collection and one further ancestor
// — so 3 is the floor for any post in this database, not 1. At the old
// threshold of 2 an empty page fell through to the renderer and the reader
// never saw the no-content sentence at all; that was observed directly (the
// content area held only react-notion-x's loading skeleton).
//
// Threshold is floor + 1: 3 or fewer keys is empty, and a page with even one
// real content block clears it. The margin to the smallest real post (21) is
// wide, but this figure was measured once, against one page, in one
// database. A fork whose database nests pages differently could see a
// different floor.
const RENDERABLE_BLOCK_MIN = 4;

/**
 * Whether a successfully-fetched recordMap has no renderable content
 * blocks. Reads only the already-fetched object — no second Notion call
 * (D-10, PITFALLS 4).
 */
export function isRecordMapEmpty(recordMap: ExtendedRecordMap): boolean {
  return Object.keys(recordMap.block ?? {}).length < RENDERABLE_BLOCK_MIN;
}
