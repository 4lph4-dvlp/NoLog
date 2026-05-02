import { CONFIG } from "@/site.config";
import { getPosts } from "@/lib/notion";
import type { MetadataRoute } from "next";

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

  let posts: { id: string; editDate: string }[] = [];
  try {
    posts = await getPosts();
  } catch {
    posts = [];
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/post/${post.id}`,
    lastModified: new Date(post.editDate),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...postEntries,
  ];
}
