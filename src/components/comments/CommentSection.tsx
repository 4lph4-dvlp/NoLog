"use client";

import { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/site.config";
import { useTheme } from "next-themes";

interface CommentSectionProps {
  postId: string;
  postTitle: string;
}

type CusdisTheme = "dark" | "light";

interface CusdisGlobal {
  renderTo?: (target: HTMLElement) => void;
  setTheme?: (theme: CusdisTheme) => void;
}

interface CusdisMessage {
  from?: string;
  event?: string;
  data?: unknown;
  offsetHeight?: unknown;
}

declare global {
  interface Window {
    CUSDIS?: CusdisGlobal;
    renderCusdis?: (target: HTMLElement) => void;
  }
}

const MIN_IFRAME_HEIGHT = 200;
const IFRAME_HEIGHT_BUFFER = 24;

function parseCusdisMessage(data: unknown): CusdisMessage | null {
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as CusdisMessage;
    } catch {
      return null;
    }
  }

  if (typeof data === "object" && data !== null) {
    return data as CusdisMessage;
  }

  return null;
}

function parseResizeHeight(data: unknown): number | null {
  const height = Number.parseFloat(String(data));

  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }

  return height;
}

function applyIframeBaseStyles(iframe: HTMLIFrameElement) {
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.display = "block";
  iframe.style.overflow = "hidden";
  iframe.style.transition = "height 180ms ease";
  iframe.setAttribute("scrolling", "no");
  iframe.scrolling = "no";

  if (!iframe.style.height) {
    iframe.style.height = `${MIN_IFRAME_HEIGHT}px`;
  }
}

function setIframeHeight(iframe: HTMLIFrameElement, height: number) {
  iframe.style.height = `${Math.max(
    MIN_IFRAME_HEIGHT,
    Math.ceil(height) + IFRAME_HEIGHT_BUFFER
  )}px`;
}

function measureIframeContent(iframe: HTMLIFrameElement): number | null {
  try {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    const root = doc?.documentElement;
    const body = doc?.body;

    const height = Math.max(
      root?.scrollHeight ?? 0,
      root?.offsetHeight ?? 0,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0
    );

    return height > 0 ? height : null;
  } catch {
    return null;
  }
}

/**
 * Optimized Cusdis integration.
 * Uses a polling mechanism to ensure the script is loaded and the widget is rendered properly.
 */
export function CommentSection({ postId, postTitle }: CommentSectionProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentTheme: CusdisTheme = resolvedTheme === "dark" ? "dark" : "light";

  // Use environment variable for the App ID as requested
  const appId =
    process.env.NEXT_PUBLIC_CUSDIS_APP_ID ||
    "592138c2-445c-4b38-bd54-abfa2bb16f65";

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const container = containerRef.current;
    const scriptId = "cusdis-sdk-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    let activeIframe: HTMLIFrameElement | null = null;
    let iframeLoadCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let retryTimer: number | null = null;
    const measureTimers = new Set<number>();

    const clearMeasureTimers = () => {
      measureTimers.forEach((timer) => window.clearTimeout(timer));
      measureTimers.clear();
    };

    const measureAndResize = (iframe = activeIframe) => {
      if (!iframe) return;

      const measuredHeight = measureIframeContent(iframe);
      const currentHeight = parseResizeHeight(iframe.style.height);

      if (measuredHeight && (!currentHeight || measuredHeight > currentHeight)) {
        setIframeHeight(iframe, measuredHeight);
      }
    };

    const queueMeasure = (delay = 0) => {
      if (!activeIframe) return;

      const iframe = activeIframe;
      const timer = window.setTimeout(() => {
        measureTimers.delete(timer);
        measureAndResize(iframe);
      }, delay);

      measureTimers.add(timer);
    };

    const attachIframe = (iframe: HTMLIFrameElement) => {
      if (activeIframe === iframe) {
        applyIframeBaseStyles(iframe);
        queueMeasure();
        return;
      }

      resizeObserver?.disconnect();
      iframeLoadCleanup?.();
      activeIframe = iframe;
      applyIframeBaseStyles(iframe);

      const onLoad = () => {
        applyIframeBaseStyles(iframe);
        queueMeasure();
        queueMeasure(200);
      };

      iframe.addEventListener("load", onLoad);
      iframeLoadCleanup = () => iframe.removeEventListener("load", onLoad);

      try {
        const doc = iframe.contentDocument ?? iframe.contentWindow?.document;

        if (doc && "ResizeObserver" in window) {
          resizeObserver = new ResizeObserver(() => measureAndResize(iframe));

          if (doc.documentElement) {
            resizeObserver.observe(doc.documentElement);
          }

          if (doc.body) {
            resizeObserver.observe(doc.body);
          }
        }
      } catch {
        resizeObserver = null;
      }

      queueMeasure();
      queueMeasure(100);
      queueMeasure(500);
      queueMeasure(1000);
    };

    const attachCurrentIframe = () => {
      const iframe = container.querySelector("iframe");

      if (iframe) {
        attachIframe(iframe);
      }
    };

    // Poll for the render function to be available
    const renderWhenReady = () => {
      if (window.renderCusdis) {
        window.renderCusdis(container);
        attachCurrentIframe();
      } else {
        retryTimer = window.setTimeout(renderWhenReady, 100);
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

    const containerObserver = new MutationObserver(() => attachCurrentIframe());
    containerObserver.observe(container, { childList: true, subtree: true });

    // Cusdis already emits resize messages; this keeps the iframe and page scroll in sync.
    const handleMessage = (e: MessageEvent) => {
      if (
        activeIframe?.contentWindow &&
        e.source !== activeIframe.contentWindow
      ) {
        return;
      }

      const msg = parseCusdisMessage(e.data);
      if (!msg || msg.event !== "resize") {
        return;
      }

      const rawHeight =
        msg.from === "cusdis" ? msg.data : msg.offsetHeight ?? msg.data;
      const height = parseResizeHeight(rawHeight);

      if (!height || !activeIframe) {
        return;
      }

      applyIframeBaseStyles(activeIframe);
      setIframeHeight(activeIframe, height);
      queueMeasure(250);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      clearMeasureTimers();
      containerObserver.disconnect();
      resizeObserver?.disconnect();
      iframeLoadCleanup?.();
      window.removeEventListener("message", handleMessage);
    };
  }, [postId, mounted]);

  // Handle dynamic theme changes after initialization
  useEffect(() => {
    if (!mounted) return;

    window.CUSDIS?.setTheme?.(currentTheme);
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
