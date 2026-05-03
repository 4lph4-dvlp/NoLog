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
 * Highly compatible Cusdis integration for Next.js.
 * Uses delayed rendering to ensure hydration is complete.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";
  const currentTheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    const renderCusdis = () => {
      // @ts-ignore
      if (window.renderCusdis) {
        const dom = document.getElementById("cusdis_thread");
        if (dom) {
          // @ts-ignore
          window.renderCusdis(dom);
        }
      }
    };

    // Delay rendering slightly to ensure Next.js hydration is finished
    const timer = setTimeout(renderCusdis, 500);
    
    return () => clearTimeout(timer);
  }, [postId, theme]);

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      <div
        id="cusdis_thread"
        key={`${postId}-${theme}`} // Force clean DOM element
        data-host="https://cusdis.com"
        data-app-id={appId}
        data-page-id={postId}
        data-page-url={`${CONFIG.site.url}/post/${postId}`}
        data-page-title={postTitle}
        data-theme={currentTheme}
        className="min-h-[250px] w-full"
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
