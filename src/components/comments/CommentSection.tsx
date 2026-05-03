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
 * Using manual script loading and re-initialization for Next.js compatibility.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const appId = process.env.NEXT_PUBLIC_CUSDIS_APP_ID;

  // Re-initialize Cusdis whenever postId or theme changes
  useEffect(() => {
    // @ts-ignore
    if (window.renderCusdis) {
      // @ts-ignore
      window.renderCusdis(document.getElementById("cusdis_thread"));
    }
  }, [postId, theme]);

  if (!appId) {
    return (
      <div className="mt-16 py-8 border-t border-border text-center">
        <p className="text-sm text-text-tertiary">
          Comment system (Cusdis) is not configured yet.
        </p>
      </div>
    );
  }

  return (
    <section className="mt-16 pt-8 border-t border-border">
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
        strategy="afterInteractive"
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
