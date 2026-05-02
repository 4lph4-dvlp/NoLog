import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Post } from "@/types";

// ─── Notion client singleton ────────────────────────────────────────────────

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID!;

// ─── Property extractors ────────────────────────────────────────────────────

/**
 * Safely extract a plain-text value from a Notion title property.
 */
function getTitle(page: PageObjectResponse): string {
  const prop = page.properties["Name"] || page.properties["title"] || page.properties["Title"];
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("") || "Untitled";
  }
  return "Untitled";
}

/**
 * Safely extract rich_text as a plain string.
 */
function getRichText(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

/**
 * Safely extract a select value.
 */
function getSelect(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "select" && prop.select) {
    return prop.select.name;
  }
  return "";
}

/**
 * Safely extract multi_select values as a string array.
 */
function getMultiSelect(page: PageObjectResponse, key: string, fallbackKey?: string): string[] {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "multi_select") {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

/**
 * Safely extract the first file URL from a files property.
 */
function getFileUrl(page: PageObjectResponse, key: string, fallbackKey?: string): string | null {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "files" && prop.files.length > 0) {
    const file = prop.files[0];
    if (file.type === "file") return file.file.url;
    if (file.type === "external") return file.external.url;
  }
  return null;
}

/**
 * Safely extract a people property as a comma-separated string of names.
 */
function getPeople(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "people") {
    return prop.people
      .map((p) => ("name" in p && p.name ? p.name : "Unknown"))
      .join(", ");
  }
  return "";
}

// ─── Mapper ─────────────────────────────────────────────────────────────────

/**
 * Map a raw Notion page to our internal Post type.
 */
function mapPageToPost(page: PageObjectResponse): Post {
  return {
    id: page.id,
    title: getTitle(page),
    summary: getRichText(page, "Summary", "summery"),
    thumbnail: getFileUrl(page, "Thumbnail", "thumbnail"),
    category: getSelect(page, "Category", "category"),
    tags: getMultiSelect(page, "Tag", "tag"),
    author: getPeople(page, "Author", "author") || getRichText(page, "Author", "author"),
    createDate: page.created_time,
    editDate: page.last_edited_time,
    status: getSelect(page, "Status"),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Query a Notion database via the REST API directly.
 *
 * We bypass the SDK's `dataSources.query` because in v5.20 it fails on
 * inline (child) databases. The REST endpoint works correctly.
 */
async function queryDatabase(body: Record<string, unknown>) {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Fetch posts from the configured Notion database.
 *
 * @param includeDrafts - When true, returns ALL posts regardless of status.
 *                        When false (default), returns only `status == "public"` posts.
 */
export async function getPosts(includeDrafts = false): Promise<Post[]> {
  const body: Record<string, unknown> = {
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  };

  if (!includeDrafts) {
    body.filter = {
      property: "status",
      select: { equals: "public" },
    };
  }

  const response = await queryDatabase(body);

  // Only process full page objects (filter out partial responses)
  const pages = (response.results as unknown[]).filter(
    (r): r is PageObjectResponse =>
      typeof r === "object" && r !== null && "properties" in r
  );

  return pages.map(mapPageToPost);
}

/**
 * Fetch a single post by its Notion page ID.
 */
export async function getPost(pageId: string): Promise<Post | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    if (!("properties" in page)) return null;
    return mapPageToPost(page as PageObjectResponse);
  } catch {
    return null;
  }
}

/**
 * Fetch all unique categories from the database.
 */
export async function getCategories(): Promise<string[]> {
  const posts = await getPosts();
  const categories = new Set(posts.map((p) => p.category).filter(Boolean));
  return Array.from(categories).sort();
}

/**
 * Fetch block children for a given page (for rendering post content).
 */
export async function getBlocks(blockId: string) {
  const blocks = [];
  let cursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });
    blocks.push(...response.results);
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return blocks;
}

export { notion, DATABASE_ID };
