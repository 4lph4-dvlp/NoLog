"use client";

import { useEffect, useState, useRef } from "react";
import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

/**
 * Optimized Cusdis integration.
 * Uses a polling mechanism to ensure the script is loaded and the widget is rendered properly.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTheme = theme === "dark" ? "dark" : "light";
  
  // Use environment variable for the App ID as requested
  const appId = process.env.NEXT_PUBLIC_CUSDIS_APP_ID || "592138c2-445c-4b38-bd54-abfa2bb16f65";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;
    
    const container = containerRef.current;
    const scriptId = "cusdis-sdk-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    // Poll for the render function to be available
    const renderWhenReady = () => {
      // @ts-ignore
      if (window.renderCusdis) {
        // @ts-ignore
        window.renderCusdis(container);
      } else {
        setTimeout(renderWhenReady, 100);
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://cusdis.com/js/cusdis.es.js";
      script.async = true;
      document.body.appendChild(script);
    }

    renderWhenReady();

  }, [postId, mounted]);

  // Handle dynamic theme changes after initialization
  useEffect(() => {
    if (!mounted) return;
    
    // @ts-ignore
    if (window.CUSDIS && window.CUSDIS.setTheme) {
      // @ts-ignore
      window.CUSDIS.setTheme(currentTheme);
    }
  }, [currentTheme, mounted]);

  // Avoid hydration mismatch by not rendering the theme-dependent DOM on the server
  if (!mounted) {
    return (
      <section className="mt-16 pt-8 border-t border-border">
        <h3 className="text-2xl font-bold text-text-primary mb-8">
          {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
        </h3>
        <div className="w-full min-h-[200px]" />
      </section>
    );
  }

  return (
    <section className="mt-16 pt-8 border-t border-border">
      <h3 className="text-2xl font-bold text-text-primary mb-8">
        {CONFIG.site.locale === "ko" ? "댓글" : "Comments"}
      </h3>
      
      <div
        ref={containerRef}
        id="cusdis_thread"
        data-host="https://cusdis.com"
        data-app-id={appId}
        data-page-id={postId}
        data-page-url={`${CONFIG.site.url}/post/${postId}`}
        data-page-title={postTitle}
        data-theme={currentTheme}
        className="w-full min-h-[200px]"
      />
    </section>
  );
}
