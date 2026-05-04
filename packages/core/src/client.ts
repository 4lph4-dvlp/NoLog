import { Client } from "@notionhq/client";
import type { PageObjectResponse, BlockObjectResponse, PartialBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Post } from "./types";

const NOTION_VERSION = "2022-06-28";

interface NotionQueryResponse {
  results: unknown[];
  next_cursor: string | null;
  has_more: boolean;
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

function getTitle(page: PageObjectResponse): string {
  const prop = page.properties["Name"] || page.properties["title"] || page.properties["Title"];
  if (prop?.type === "title") {
    return prop.title.map((t) => t.plain_text).join("") || "Untitled";
  }
  return "Untitled";
}

function getRichText(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

function getSelect(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "select" && prop.select) {
    return prop.select.name;
  }
  return "";
}

function getMultiSelect(page: PageObjectResponse, key: string, fallbackKey?: string): string[] {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];
  
  if (prop?.type === "multi_select") {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

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

export function mapPageToPost(page: PageObjectResponse): Post {
  return {
    id: page.id,
    title: getTitle(page),
    summary: getRichText(page, "Summary", "summery"), // Handling typo fallback
    thumbnail: getFileUrl(page, "Thumbnail", "thumbnail"),
    category: getSelect(page, "Category", "category"),
    tags: getMultiSelect(page, "Tag", "tag"),
    author: getPeople(page, "Author", "author") || getRichText(page, "Author", "author"),
    createDate: page.created_time,
    editDate: page.last_edited_time,
    status: getSelect(page, "Status", "status"),
  };
}

export interface NologClientOptions {
  /** Notion integration token */
  token: string;
  /** Notion Database ID to fetch posts from */
  databaseId: string;
  /** Optional custom fetch options (e.g. for caching/revalidation in Next.js) */
  fetchOptions?: RequestInit;
}

export class NologClient {
  public notion: Client;
  private token: string;
  private databaseId: string;
  private fetchOptions?: RequestInit;

  constructor(options: NologClientOptions) {
    this.token = options.token;
    this.databaseId = options.databaseId;
    this.fetchOptions = options.fetchOptions;
    
    this.notion = new Client({
      auth: this.token,
      fetch: this.fetchOptions ? (url, init) => {
        return fetch(url, { ...init, ...this.fetchOptions });
      } : undefined
    });
  }

  private getNotionHeaders(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    };
  }

  /**
   * Query a Notion database via the REST API directly.
   * Bypasses the SDK's `dataSources.query` because in v5.20 it fails on
   * inline (child) databases.
   */
  private async queryDatabase(body: Record<string, unknown>): Promise<NotionQueryResponse> {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${this.databaseId}/query`,
      {
        method: "POST",
        headers: this.getNotionHeaders(),
        body: JSON.stringify(body),
        ...this.fetchOptions,
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

  public async getPosts(): Promise<Post[]> {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      filter: {
        property: "status",
        select: { equals: "public" },
      },
    };

    const pages: PageObjectResponse[] = [];
    let cursor: string | null = null;

    do {
      const response = await this.queryDatabase({
        ...body,
        ...(cursor ? { start_cursor: cursor } : {}),
      });

      pages.push(...response.results.filter(isPageObjectResponse));
      cursor = response.next_cursor;
    } while (cursor);

    return pages.map(mapPageToPost);
  }

  public async getPost(pageId: string): Promise<Post | null> {
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: this.getNotionHeaders(),
        ...this.fetchOptions,
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
      if (post.status !== "public") {
        return null;
      }

      return post;
    } catch {
      return null;
    }
  }

  public async getCategories(): Promise<string[]> {
    const posts = await this.getPosts();
    const categories = new Set(posts.map((p) => p.category).filter(Boolean));
    return Array.from(categories).sort();
  }

  public async getBlocks(blockId: string): Promise<Array<BlockObjectResponse | PartialBlockObjectResponse>> {
    const blocks: Array<BlockObjectResponse | PartialBlockObjectResponse> = [];
    let cursor: string | undefined;

    do {
      const response = await this.notion.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
      });
      blocks.push(...response.results);
      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    return blocks;
  }
}
