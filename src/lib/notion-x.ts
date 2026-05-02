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
const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
});

/**
 * Fetch the full page recordMap for rendering with react-notion-x.
 */
export async function getPageRecordMap(pageId: string) {
  return notionX.getPage(pageId);
}
