import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { cache } from "react";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";

// ─── Notion client singleton ────────────────────────────────────────────────

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID ?? "";
const NOTION_VERSION = "2022-06-28";
const NOTION_CACHE_TAG = "notion-posts";

interface NotionQueryResponse {
  results: unknown[];
  next_cursor: string | null;
  has_more: boolean;
}

function getNotionHeaders(): HeadersInit {
  if (!process.env.NOTION_TOKEN) {
    throw new Error("Missing NOTION_TOKEN environment variable.");
  }

  return {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function getDatabaseId(): string {
  if (!DATABASE_ID) {
    throw new Error("Missing NOTION_DATABASE_ID environment variable.");
  }

  return DATABASE_ID;
}

function getNotionFetchOptions(includeDrafts: boolean) {
  if (includeDrafts) {
    return { cache: "no-store" as const };
  }

  return {
    next: {
      revalidate: CONFIG.revalidate,
      tags: [NOTION_CACHE_TAG],
    },
  };
}

function isPageObjectResponse(value: unknown): value is PageObjectResponse {
  return typeof value === "object" && value !== null && "properties" in value;
}

function isNotionQueryResponse(value: unknown): value is NotionQueryResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "results" in value &&
    Array.isArray((value as NotionQueryResponse).results)
  );
}

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
    status: getSelect(page, "Status", "status"),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Query a Notion database via the REST API directly.
 *
 * We bypass the SDK's `dataSources.query` because in v5.20 it fails on
 * inline (child) databases. The REST endpoint works correctly.
 */
async function queryDatabase(
  body: Record<string, unknown>,
  includeDrafts = false
): Promise<NotionQueryResponse> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${getDatabaseId()}/query`,
    {
      method: "POST",
      headers: getNotionHeaders(),
      body: JSON.stringify(body),
      ...getNotionFetchOptions(includeDrafts),
    }
  );

  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  }

  const data: unknown = await res.json();
  if (!isNotionQueryResponse(data)) {
    throw new Error("Notion query returned an unexpected response shape.");
  }

  return data;
}

/**
 * Fetch posts from the configured Notion database.
 *
 * @param includeDrafts - When true, returns ALL posts regardless of status.
 *                        When false (default), returns only `status == "public"` posts.
 */
export const getPosts = cache(async (includeDrafts = false): Promise<Post[]> => {
  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
  };

  if (!includeDrafts) {
    body.filter = {
      property: "status",
      select: { equals: "public" },
    };
  }

  const pages: PageObjectResponse[] = [];
  let cursor: string | null = null;

  do {
    const response = await queryDatabase(
      {
        ...body,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
      includeDrafts
    );

    pages.push(...response.results.filter(isPageObjectResponse));
    cursor = response.next_cursor;
  } while (cursor);

  return pages.map(mapPageToPost);
});

/**
 * Fetch a single post by its Notion page ID.
 */
export const getPost = cache(
  async (pageId: string, includeDrafts = false): Promise<Post | null> => {
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: getNotionHeaders(),
        ...getNotionFetchOptions(includeDrafts),
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`Notion page failed: ${res.status} ${await res.text()}`);
      }

      const page: unknown = await res.json();
      if (!isPageObjectResponse(page)) return null;

      const post = mapPageToPost(page);
      if (!includeDrafts && post.status !== "public") {
        return null;
      }

      return post;
    } catch {
      return null;
    }
  }
);

/**
 * Fetch all unique categories from the database.
 */
export const getCategories = cache(async (includeDrafts = false): Promise<string[]> => {
  const posts = await getPosts(includeDrafts);
  const categories = new Set(posts.map((p) => p.category).filter(Boolean));
  return Array.from(categories).sort();
});

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
