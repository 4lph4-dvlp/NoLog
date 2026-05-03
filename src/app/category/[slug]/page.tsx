import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import DefaultCategoryPage from "@/templates/default/CategoryPage";

/**
 * Dynamic metadata for each category page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${displayName} — ${CONFIG.site.title}`,
    description: `Posts in the "${displayName}" category on ${CONFIG.site.title}`,
  };
}

/**
 * Category page — shows all posts matching a given category slug.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let allPosts: Post[] = [];
  try {
    allPosts = await getPosts();
  } catch {
    allPosts = [];
  }

  // Match posts whose category slug matches the URL slug
  const posts = allPosts.filter((post) => {
    const postSlug = post.category?.toLowerCase().replace(/\s+/g, "-");
    return postSlug === slug.toLowerCase();
  });

  // Derive a human-readable name from the first matching post, or from the slug
  const displayName =
    posts[0]?.category ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (CONFIG.template === "default") {
    return <DefaultCategoryPage posts={posts} displayName={displayName} />;
  }

  // Default fallback
  return <DefaultCategoryPage posts={posts} displayName={displayName} />;
}
