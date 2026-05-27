"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { CodeBlock } from "notion-types";
import { getBlockTitle } from "notion-utils";
import { useNotionContext } from "react-notion-x";
import { MermaidBlock } from "./MermaidBlock";

// Lazy-load the original react-notion-x Code component for non-mermaid blocks
const OriginalCode = dynamic(
  () => import("react-notion-x/third-party/code").then((m) => m.Code),
  { ssr: false }
);

// Lazy-load react-notion-x Text for rendering captions
const NotionText = dynamic(
  () => import("react-notion-x").then((m) => m.Text),
  { ssr: false }
);

interface NotionCodeProps {
  block: CodeBlock;
  defaultLanguage?: string;
  className?: string;
}

/**
 * Custom Code component that wraps react-notion-x's Code.
 *
 * When the code block language is "mermaid", it renders via MermaidBlock
 * with diagram support and 3 view modes. For all other languages,
 * it falls back to the original react-notion-x Code component with
 * PrismJS syntax highlighting.
 */
export function NotionCode({ block, defaultLanguage, className }: NotionCodeProps) {
  const { recordMap } = useNotionContext();

  // Extract language from block properties
  const language = (
    block.properties?.language?.[0]?.[0] || defaultLanguage || ""
  ).toLowerCase();

  if (language === "mermaid") {
    // Extract code content
    const code = getBlockTitle(block, recordMap);
    // Extract caption
    const caption = block.properties?.caption;

    return (
      <MermaidBlock
        code={code}
        caption={
          caption ? <NotionText value={caption} block={block} /> : undefined
        }
      />
    );
  }

  // Fallback to original Code component
  return (
    <OriginalCode
      block={block}
      defaultLanguage={defaultLanguage}
      className={className}
    />
  );
}
