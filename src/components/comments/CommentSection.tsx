"use client";

import { useEffect, useRef } from "react";
import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

/**
 * Optimized Cusdis integration.
 * Ensures the script is loaded only once and re-renders correctly on navigation.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const appId = "592138c2-445c-4b38-bd54-abfa2bb16f65";
  const currentTheme = theme === "dark" ? "dark" : "light";

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Clear container and create a fresh thread element
    container.innerHTML = "";
    const thread = document.createElement("div");
    thread.id = "cusdis_thread";
    thread.setAttribute("data-host", "https://cusdis.com");
    thread.setAttribute("data-app-id", appId);
    thread.setAttribute("data-page-id", postId);
    thread.setAttribute("data-page-url", `${CONFIG.site.url}/post/${postId}`);
    thread.setAttribute("data-page-title", postTitle);
    thread.setAttribute("data-theme", currentTheme);
    thread.style.minHeight = "200px";
    container.appendChild(thread);

    // 2. Load script only once
    const scriptId = "cusdis-sdk";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cusdis.com/js/cusdis.es.js";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        // @ts-ignore
        if (window.renderCusdis) {
          // @ts-ignore
          window.renderCusdis(thread);
        }
      };
      document.body.appendChild(script);
    } else {
      // 3. If script already exists, just trigger render
      // @ts-ignore
      if (window.renderCusdis) {
        // @ts-ignore
        window.renderCusdis(thread);
      }
    }
  }, [postId, theme, postTitle, currentTheme]);

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      {/* Target container for manual injection */}
      <div ref={containerRef} className="w-full min-h-[200px]" />
    </section>
  );
}
