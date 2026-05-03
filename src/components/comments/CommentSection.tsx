"use client";

import { useEffect, useRef } from "react";
import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

/**
 * Manual DOM injection for Cusdis.
 * This approach bypasses React's DOM management to prevent hydration conflicts.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";
  const currentTheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    // 1. Clear previous content to avoid duplicates
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
      
      // 2. Create the Cusdis thread element
      const thread = document.createElement("div");
      thread.id = "cusdis_thread";
      thread.setAttribute("data-host", "https://cusdis.com");
      thread.setAttribute("data-app-id", appId);
      thread.setAttribute("data-page-id", postId);
      thread.setAttribute("data-page-url", `${CONFIG.site.url}/post/${postId}`);
      thread.setAttribute("data-page-title", postTitle);
      thread.setAttribute("data-theme", currentTheme);
      thread.style.minHeight = "200px";
      
      containerRef.current.appendChild(thread);

      // 3. Manually load the script
      const script = document.createElement("script");
      script.src = "https://cusdis.com/js/cusdis.es.js";
      script.async = true;
      script.defer = true;
      
      // 4. Trigger render after script loads
      script.onload = () => {
        // @ts-ignore
        if (window.renderCusdis) {
          // @ts-ignore
          window.renderCusdis(thread);
        }
      };

      containerRef.current.appendChild(script);
    }
  }, [postId, theme, postTitle, currentTheme]);

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      {/* React doesn't manage this div's children */}
      <div ref={containerRef} className="w-full" />
    </section>
  );
}
