"use client";

import { useEffect } from "react";
import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";
import Script from "next/script";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

/**
 * Cusdis comment widget.
 * Hardcoded App ID and standard integration for maximum reliability.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";

  // Re-initialize Cusdis whenever postId or theme changes
  useEffect(() => {
    // @ts-ignore
    if (window.renderCusdis) {
      // @ts-ignore
      window.renderCusdis(document.getElementById("cusdis_thread"));
    }
  }, [postId, theme]);

  return (
    <section className="mt-16 pt-8 border-t border-border min-h-[200px]">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      <div
        id="cusdis_thread"
        data-host="https://cusdis.com"
        data-app-id={appId}
        data-page-id={postId}
        data-page-url={`${CONFIG.site.url}/post/${postId}`}
        data-page-title={postTitle}
        data-theme={theme === "dark" ? "dark" : "light"}
      />

      <Script
        src="https://cusdis.com/js/cusdis.es.js"
        strategy="lazyOnload"
        onLoad={() => {
          // @ts-ignore
          if (window.renderCusdis) {
            // @ts-ignore
            window.renderCusdis(document.getElementById("cusdis_thread"));
          }
        }}
      />
    </section>
  );
}
