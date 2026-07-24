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

function getCheckbox(page: PageObjectResponse, key: string): boolean {
  // Never throws — a per-page missing/unset value defaults to false. This is
  // NOT the D-01 schema-missing case (the Emailed property absent from the
  // database entirely); that is detected at the query/patch call site, not here.
  const prop = page.properties[key];
  if (prop?.type === "checkbox") {
    return prop.checkbox;
  }
  return false;
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
    status: getSelect(page, "status", "Status"),
    emailed: getCheckbox(page, "Emailed"),
  };
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/**
 * Thrown when the Notion integration lacks the "Update content" capability
 * (Notion returns 403 for a write). Distinguishable via `instanceof` so a
 * caller (e.g. Phase 4's notify route) can log this distinctly and avoid a
 * duplicate-email storm on retry, rather than treating it like any other
 * failure (D-03).
 */
export class NotionCapabilityError extends Error {
  constructor(pageId: string, notionMessage: string) {
    super(
      `Notion write failed for page ${pageId}: integration lacks "Update content" ` +
      `capability. Grant it in your Notion integration's Developer Portal settings. ` +
      `(Notion said: ${notionMessage})`
    );
    this.name = "NotionCapabilityError";
  }
}

/**
 * Thrown when the `Emailed` checkbox property does not exist on the
 * database's schema at all (as opposed to existing but unset on a given
 * page — that per-page case is handled by `getCheckbox()`, never throws).
 * Fails loud and clear instead of letting Notion's raw API error propagate
 * unexplained (D-01).
 */
export class MissingEmailedPropertyError extends Error {
  constructor(notionMessage: string) {
    super(
      `Emailed property not found on this database — add it in Notion first ` +
      `(Settings → add a Checkbox property named "Emailed"). See README. ` +
      `(Notion said: ${notionMessage})`
    );
    this.name = "MissingEmailedPropertyError";
  }
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

  /**
   * Query all public posts that have not yet been marked `Emailed`
   * (oldest-first). Reuses `queryDatabase()` — never duplicates the fetch
   * logic. Returns an empty array (never null, never throws) when nothing
   * matches.
   */
  public async getUnemailedPublicPosts(): Promise<Post[]> {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
      filter: {
        and: [
          { property: "status", select: { equals: "public" } },
          { property: "Emailed", checkbox: { equals: false } },
        ],
      },
    };

    const pages: PageObjectResponse[] = [];
    let cursor: string | null = null;

    try {
      do {
        const response = await this.queryDatabase({
          ...body,
          ...(cursor ? { start_cursor: cursor } : {}),
        });

        pages.push(...response.results.filter(isPageObjectResponse));
        cursor = response.next_cursor;
      } while (cursor);
    } catch (err) {
      // Same unverified-detection caveat as patchPage() (RESEARCH.md Open
      // Question 1 / Pitfall 3) — adjust to match real Notion behaviour.
      if (err instanceof Error && /Emailed/i.test(err.message) && /propert/i.test(err.message)) {
        throw new MissingEmailedPropertyError(err.message);
      }
      throw err;
    }

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

  // ─── Mutations ──────────────────────────────────────────────────────────────

  private async patchPage(pageId: string, properties: Record<string, unknown>): Promise<void> {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: this.getNotionHeaders(),
      body: JSON.stringify({ properties }),
      ...this.fetchOptions,
    });

    if (!res.ok) {
      const bodyText = await res.text();

      // Status-code-first (Pitfall 1): 403 is the reliable, documented signal
      // for a missing "Update content" capability — never gate on message
      // substring-matching alone.
      if (res.status === 403) {
        throw new NotionCapabilityError(pageId, bodyText);
      }

      // NOTE: this condition is a best-guess pattern-match, UNVERIFIED against
      // live Notion behaviour (RESEARCH.md Open Question 1 / Assumption A1 /
      // Pitfall 3). Notion's public docs do not specify the exact error shape
      // for a PATCH properties body referencing a property absent from the
      // schema entirely. Before D-01 is considered done, this must be
      // validated against a real workspace (temporarily remove the Emailed
      // property, observe the actual error, adjust this condition to match).
      if (res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)) {
        throw new MissingEmailedPropertyError(bodyText);
      }

      throw new Error(`Notion patch failed: ${res.status} ${bodyText}`);
    }
  }

  /**
   * Durably mark a post as emailed (checkbox write). Per D-04, this writes
   * ONLY the `Emailed` checkbox — no timestamp/"emailed date" property.
   * Idempotent — safe to call more than once on the same page.
   */
  public async markEmailed(pageId: string): Promise<void> {
    await this.patchPage(pageId, { Emailed: { checkbox: true } });
  }
}
