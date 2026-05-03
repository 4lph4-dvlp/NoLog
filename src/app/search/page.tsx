import { getPosts, getCategories } from "@/lib/notion";
import type { Post } from "@/types";
import { CONFIG } from "@/site.config";
import DefaultSearchPage from "@/templates/default/SearchPage";
import TerminalSearchPage from "@/templates/terminal/SearchPage";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  let allPosts: Post[] = [];
  let categories: string[] = [];
  try {
    allPosts = await getPosts();
    categories = await getCategories();
  } catch {
    allPosts = [];
    categories = [];
  }

  const q = query ? query.toLowerCase() : "";
  const posts = allPosts.filter((post) => {
    if (!q) return false;
    if (post.title?.toLowerCase().includes(q)) return true;
    if (post.summary?.toLowerCase().includes(q)) return true;
    if (post.category?.toLowerCase().includes(q)) return true;
    if (post.tags?.some((tag) => tag.toLowerCase().includes(q))) return true;
    return false;
  });

  if (CONFIG.template === "default") {
    return <DefaultSearchPage posts={posts} query={query} />;
  } else if (CONFIG.template === "terminal") {
    return <TerminalSearchPage posts={posts} query={query} categories={categories} />;
  }

  // Default fallback
  return <DefaultSearchPage posts={posts} query={query} />;
}
