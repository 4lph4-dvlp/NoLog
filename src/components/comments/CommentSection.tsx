"use client";

import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

/**
 * Cusdis comment widget using Iframe for maximum reliability.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";
  
  const pageUrl = `${CONFIG.site.url}/post/${postId}`;
  const currentTheme = theme === "dark" ? "dark" : "light";

  // Construct Cusdis iframe URL
  const iframeSrc = `https://cusdis.com/api/widget?appId=${appId}&pageId=${postId}&pageUrl=${encodeURIComponent(
    pageUrl
  )}&pageTitle=${encodeURIComponent(postTitle)}&theme=${currentTheme}`;

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      <div className="w-full min-h-[500px]">
        <iframe
          src={iframeSrc}
          style={{ width: "100%", border: "none", height: "100%", minHeight: "500px" }}
          title="Cusdis Comments"
        />
      </div>
    </section>
  );
}
