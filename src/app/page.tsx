import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import { CONFIG } from "@/site.config";
import DefaultHomePage from "@/templates/default/HomePage";

/**
 * Home page — renders the main post feed.
 * Uses ISR to stay fresh without rebuilding.
 */
export default async function HomePage() {
  let posts: Post[];
  try {
    posts = await getPosts();
  } catch {
    // Gracefully handle missing Notion config
    posts = [];
  }

  if (CONFIG.template === "default") {
    return <DefaultHomePage posts={posts} />;
  }

  // Default fallback
  return <DefaultHomePage posts={posts} />;
}
