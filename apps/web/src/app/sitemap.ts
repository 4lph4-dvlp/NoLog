import { CONFIG } from "@/site.config";
import { getPosts, getCategories } from "@/lib/notion";
import type { MetadataRoute } from "next";
import type { Post } from "@4lph4/nolog-core";

/**
 * Dynamic sitemap.xml — lists all public posts for search engine discovery.
 * Only generated when CONFIG.seo.allowIndexing is true.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = CONFIG.site.url;

  // If indexing is disabled, return empty sitemap
  if (!CONFIG.seo.allowIndexing) {
    return [];
  }

  let posts: Post[] = [];
  let categories: string[] = [];
  try {
    const results = await Promise.all([getPosts(), getCategories()]);
    posts = results[0];
    categories = results[1];
  } catch {
    posts = [];
    categories = [];
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/post/${post.id}`,
    lastModified: new Date(post.editDate),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${siteUrl}/category/${category.toLowerCase().replace(/\s+/g, "-")}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...categoryEntries,
    ...postEntries,
  ];
}
