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

// Re-export notion client instance if any other parts of the app use it directly
export const notion = nologClient.notion;
export { DATABASE_ID };
