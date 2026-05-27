"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

type ViewMode = "preview" | "code" | "split";

interface MermaidBlockProps {
  /** Raw Mermaid source code */
  code: string;
  /** Optional caption (react-notion-x Text node) */
  caption?: React.ReactNode;
}

/**
 * Renders a Mermaid code block with three view modes,
 * matching Notion's native Mermaid UI:
 * - preview: rendered diagram only (default)
 * - code:    raw source code only
 * - split:   side-by-side code + diagram
 */
export function MermaidBlock({ code, caption }: MermaidBlockProps) {
  const [mode, setMode] = useState<ViewMode>("preview");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [mermaidReady, setMermaidReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  // Detect dark mode by watching <html> class
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const check = () => setIsDark(html.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Dynamically import mermaid (code-split)
  useEffect(() => {
    let cancelled = false;
    import("mermaid").then((mod) => {
      if (cancelled) return;
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
      });
      setMermaidReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [isDark]);

  // Re-initialize theme when dark mode changes
  useEffect(() => {
    if (!mermaidReady) return;
    import("mermaid").then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
      });
    });
  }, [isDark, mermaidReady]);

  // Render mermaid diagram
  const renderDiagram = useCallback(async () => {
    if (!mermaidReady || !code.trim()) return;
    try {
      const mermaid = (await import("mermaid")).default;
      // Each render needs a unique ID
      const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const { svg: renderedSvg } = await mermaid.render(uniqueId, code.trim());
      setSvg(renderedSvg);
      setError(null);
    } catch (err) {
      console.warn("[MermaidBlock] Render error:", err);
      setError(err instanceof Error ? err.message : "Failed to render Mermaid diagram");
      setSvg("");
    }
  }, [code, mermaidReady]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram, isDark]);

  // Mode selector labels matching Notion's dropdown style
  const modeOptions: { value: ViewMode; label: string }[] = useMemo(
    () => [
      { value: "preview", label: "Preview" },
      { value: "code", label: "Code" },
      { value: "split", label: "Split" },
    ],
    []
  );

  return (
    <figure className="mermaid-block">
      {/* ─── Toolbar (Notion-style: language label + view mode dropdown) ─── */}
      <div className="mermaid-block__toolbar">
        <span className="mermaid-block__language-label">Mermaid</span>

        <div className="mermaid-block__mode-switcher">
          {modeOptions.map((opt) => (
            <button
              key={opt.value}
              className={`mermaid-block__mode-btn${mode === opt.value ? " active" : ""}`}
              onClick={() => setMode(opt.value)}
              type="button"
              aria-pressed={mode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className={`mermaid-block__content mermaid-block__content--${mode}`}>
        {/* Code pane */}
        {(mode === "code" || mode === "split") && (
          <div className="mermaid-block__code-pane">
            <pre className="mermaid-block__pre">
              <code>{code}</code>
            </pre>
          </div>
        )}

        {/* Preview pane */}
        {(mode === "preview" || mode === "split") && (
          <div className="mermaid-block__preview-pane" ref={containerRef}>
            {error ? (
              <div className="mermaid-block__error">
                <span className="mermaid-block__error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            ) : svg ? (
              <div
                className="mermaid-block__svg-wrapper"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <div className="mermaid-block__loading">
                <div className="mermaid-block__loading-spinner" />
                <span>Rendering diagram…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Caption ─── */}
      {caption && (
        <figcaption className="notion-asset-caption">{caption}</figcaption>
      )}
    </figure>
  );
}
