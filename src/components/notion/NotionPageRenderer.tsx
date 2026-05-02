"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { ExtendedRecordMap } from "notion-types";

// Core styles from react-notion-x
import "react-notion-x/src/styles.css";

// Dynamically import heavy third-party components (code, collection, equation, modal)
const Code = dynamic(
  () => import("react-notion-x/third-party/code").then((m) => m.Code),
  { ssr: false }
);

const Collection = dynamic(
  () =>
    import("react-notion-x/third-party/collection").then(
      (m) => m.Collection
    ),
  { ssr: false }
);

const Equation = dynamic(
  () =>
    import("react-notion-x/third-party/equation").then((m) => m.Equation),
  { ssr: false }
);

const Modal = dynamic(
  () => import("react-notion-x/third-party/modal").then((m) => m.Modal),
  { ssr: false }
);

// Lazily import the NotionRenderer itself to avoid SSR issues with window/document
const NotionRendererX = dynamic(
  () => import("react-notion-x").then((m) => m.NotionRenderer),
  { ssr: false }
);

interface NotionPageRendererProps {
  recordMap: ExtendedRecordMap;
}

/**
 * Client Component wrapper for react-notion-x.
 *
 * Renders a full Notion page with all block types supported:
 * quotes, callouts, toggles, tables, bookmarks, embeds, videos,
 * code with syntax highlighting, equations, etc.
 *
 * Automatically detects dark mode from next-themes.
 */
export function NotionPageRenderer({ recordMap }: NotionPageRendererProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-4 bg-surface rounded w-3/4" />
        <div className="h-4 bg-surface rounded w-full" />
        <div className="h-4 bg-surface rounded w-5/6" />
        <div className="h-4 bg-surface rounded w-2/3" />
        <div className="h-32 bg-surface rounded w-full" />
      </div>
    );
  }

  return (
    <div className="notion-page-wrapper">
      <NotionRendererX
        recordMap={recordMap}
        fullPage={false}
        darkMode={resolvedTheme === "dark"}
        disableHeader
        components={{
          Code,
          Collection,
          Equation,
          Modal,
        }}
      />
    </div>
  );
}
