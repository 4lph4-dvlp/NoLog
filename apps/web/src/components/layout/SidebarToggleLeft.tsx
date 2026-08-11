"use client";

import { Menu } from "lucide-react";
import { SIDEBAR_PANEL_IDS } from "@/lib/sidebar";

interface SidebarToggleLeftProps {
  collapsed: boolean;
  mounted: boolean;
  onToggle: () => void;
}

const CHROME =
  "p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Hamburger disclosure button for the left panel (search + categories).
 * Follows ThemeToggle.tsx's mounted-guard and aria-label===title
 * conventions verbatim. The Menu glyph never swaps (D-07) — only
 * aria-expanded, the label/title strings, and the focus-visible ring react
 * to state.
 */
export function SidebarToggleLeft({ collapsed, mounted, onToggle }: SidebarToggleLeftProps) {
  if (!mounted) {
    // Prevent hydration mismatch — render a placeholder with matching
    // dimensions (ThemeToggle.tsx's mounted-guard idiom). Because the
    // pre-hydration script has already corrected <html>'s data-sidebar-left
    // attribute before paint, this window is only as long as it takes React
    // to hydrate, not until a client-side read resolves.
    return (
      <button type="button" className={CHROME} aria-label="Toggle search and categories panel">
        <div className="w-[18px] h-[18px]" />
      </button>
    );
  }

  const label = collapsed ? "Show search and categories" : "Hide search and categories";

  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={SIDEBAR_PANEL_IDS.left}
      aria-label={label}
      title={label}
      className={CHROME}
      onClick={onToggle}
    >
      <Menu className="w-[18px] h-[18px] text-text-secondary" />
    </button>
  );
}
