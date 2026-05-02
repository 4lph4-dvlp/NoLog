/**
 * Site configuration — the single source of truth for profile,
 * SNS links, and blog metadata. Edit this file to personalise your blog.
 */

export const CONFIG = {
  /** Blog metadata */
  site: {
    title: "4lph4-bl0g",
    description: "4lph4's NoLog base blog",
    url: "https://4lph4-bl0g.vercel.app",
    locale: "ko",
  },

  /** Profile sidebar */
  profile: {
    name: "4lph4",
    bio: "Life's plus 4lph4",
    avatarUrl: "/avatar.png",
  },

  /** Social / contact links — set to "" to hide */
  sns: {
    github: "https://github.com/4lph4-dvlp",
    linkedin: "https://www.linkedin.com/in/hyunwoo-kim-4a2106303",
    email: "alpha030520@gmail.com",
    instagram: "https://www.instagram.com/4lph4_alpha",
    twitter: "",
  },

  /** ISR revalidation interval in seconds (30 mins to prevent image expiration) */
  revalidate: 1800,

  /**
   * Search engine indexing control.
   * Set `allowIndexing` to false to add noindex/nofollow to all pages
   * and block crawlers via robots.txt.
   * Use `verification` to add Google/Naver search console meta tags.
   */
  seo: {
    /** Master switch: allow search engines to index this site? */
    allowIndexing: true,
    /** Google Search Console verification code (content of meta tag) */
    googleVerification: "3B2OJZoVb39ZY-cwVeaiqPTPppzoow5Yd_V9beGzeQU",
    /** Naver Search Advisor verification code (content of meta tag) */
    naverVerification: "391440411ed12faa001dd4bf089c2f2bb90d5915",
  },
} as const;

export type SiteConfig = typeof CONFIG;
