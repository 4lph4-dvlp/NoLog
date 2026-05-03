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
 * Robust Cusdis integration for Next.js.
 * Uses UMD script and manual re-rendering to handle client-side navigation.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";
  const currentTheme = theme === "dark" ? "dark" : "light";

  const renderWidget = () => {
    // @ts-ignore
    if (window.renderCusdis) {
      const dom = document.getElementById("cusdis_thread");
      if (dom) {
        // @ts-ignore
        window.renderCusdis(dom);
      }
    }
  };

  // Re-render when postId or theme changes
  useEffect(() => {
    renderWidget();
  }, [postId, theme]);

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      <div
        id="cusdis_thread"
        key={`${postId}-${theme}`} // Force fresh DOM element on change
        data-host="https://cusdis.com"
        data-app-id={appId}
        data-page-id={postId}
        data-page-url={`${CONFIG.site.url}/post/${postId}`}
        data-page-title={postTitle}
        data-theme={currentTheme}
        className="min-h-[200px]"
      />

      <Script
        src="https://cusdis.com/js/cusdis.umd.js"
        strategy="afterInteractive"
        onLoad={renderWidget}
      />
    </section>
  );
}
