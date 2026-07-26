import { cache } from "react";
import { CONFIG } from "@/site.config";
import { NologClient, type Post } from "@4lph4/nolog-core";

const DATABASE_ID = process.env.NOTION_DATABASE_ID ?? "";
const NOTION_CACHE_TAG = "notion-posts";

const nologClient = new NologClient({
  token: process.env.NOTION_TOKEN ?? "",
  databaseId: DATABASE_ID,
  fetchOptions: {
    next: {
      revalidate: CONFIG.revalidate,
      tags: [NOTION_CACHE_TAG],
    },
  },
});

export const getPosts = cache(async (): Promise<Post[]> => {
  return nologClient.getPosts();
});

export const getPost = cache(async (pageId: string): Promise<Post | null> => {
  return nologClient.getPost(pageId);
});

export const getCategories = cache(async (): Promise<string[]> => {
  return nologClient.getCategories();
});

export async function getBlocks(blockId: string) {
  return nologClient.getBlocks(blockId);
}

// Deliberately not memoised (no `cache` wrapper) — the notify cron must
// observe fresh state on every invocation, never a memoised read from an
// earlier request in the same render pass (04-RESEARCH.md, Architectural
// Responsibility Map).
export async function getUnemailedPublicPosts(): Promise<Post[]> {
  return nologClient.getUnemailedPublicPosts();
}

// Deliberately not memoised (no `cache` wrapper) — a write path must never
// be memoised, or a second call in the same request/render cycle would
// silently no-op.
export async function markEmailed(pageId: string): Promise<void> {
  return nologClient.markEmailed(pageId);
}

// Re-export notion client instance if any other parts of the app use it directly
export const notion = nologClient.notion;
export { DATABASE_ID };
