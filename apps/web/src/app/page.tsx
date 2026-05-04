import { getPosts, getCategories } from "@/lib/notion";
import type { Post } from "@/types";
import { CONFIG } from "@/site.config";
import DefaultHomePage from "@/templates/default/HomePage";
import TerminalHomePage from "@/templates/terminal/HomePage";

/**
 * Home page — renders the main post feed.
 * Uses ISR to stay fresh without rebuilding.
 */
export default async function HomePage() {
  let posts: Post[];
  let categories: string[];
  try {
    posts = await getPosts();
    categories = await getCategories();
  } catch {
    // Gracefully handle missing Notion config
    posts = [];
    categories = [];
  }

  if (CONFIG.template === "default") {
    return <DefaultHomePage posts={posts} />;
  } else if (CONFIG.template === "terminal") {
    return <TerminalHomePage posts={posts} categories={categories} />;
  }

  // Default fallback
  return <DefaultHomePage posts={posts} />;
}
