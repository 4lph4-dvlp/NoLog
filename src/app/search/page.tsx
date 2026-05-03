import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import { CONFIG } from "@/site.config";
import DefaultSearchPage from "@/templates/default/SearchPage";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  let allPosts: Post[] = [];
  try {
    allPosts = await getPosts();
  } catch {
    allPosts = [];
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
  }

  // Default fallback
  return <DefaultSearchPage posts={posts} query={query} />;
}
