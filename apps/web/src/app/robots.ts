import { CONFIG } from "@/site.config";
import type { MetadataRoute } from "next";

/**
 * Dynamic robots.txt — controlled by CONFIG.seo.allowIndexing.
 *
 * When allowIndexing is true:  allows all crawlers, points to sitemap.
 * When allowIndexing is false: disallows all crawlers from all paths.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = CONFIG.site.url;

  if (!CONFIG.seo.allowIndexing) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/search"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
