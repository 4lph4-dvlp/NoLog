"use client";

import { useState } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { CONFIG } from "@/site.config";
import { SIDEBAR_PANEL_IDS } from "@/lib/sidebar";

interface SidebarToggleRightProps {
  collapsed: boolean;
  mounted: boolean;
  onToggle: () => void;
}

const CHROME =
  "relative w-9 h-9 rounded-full overflow-hidden cursor-pointer ring-2 ring-accent ring-offset-2 ring-offset-background hover:ring-accent-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Circular profile-image disclosure button for the right panel. Follows
 * ThemeToggle.tsx's mounted-guard and aria-label===title conventions, and
 * PostThumbnailImage.tsx's useState(false) + onError fallback shape (D-14).
 * The accent ring is declared in the static CHROME string — identical in
 * both the expanded and collapsed states — so it always reads as "this is
 * a control", never decoration (SIDE-09, D-12). No dropdown/menu semantics,
 * no caret, no status dot: this is a sidebar disclosure button, not an
 * account menu — NoLog has no user accounts.
 */
export function SidebarToggleRight({ collapsed, mounted, onToggle }: SidebarToggleRightProps) {
  const [failed, setFailed] = useState(false);

  if (!mounted) {
    // Prevent hydration mismatch — render a placeholder with matching
    // dimensions (ThemeToggle.tsx's mounted-guard idiom).
    return (
      <button type="button" className={CHROME} aria-label="Toggle profile sidebar">
        <div className="w-9 h-9" />
      </button>
    );
  }

  const label = collapsed ? "Show profile sidebar" : "Hide profile sidebar";

  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={SIDEBAR_PANEL_IDS.right}
      aria-label={label}
      title={label}
      className={CHROME}
      onClick={onToggle}
    >
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-active">
          <User className="w-5 h-5 text-text-secondary" strokeWidth={1.5} />
        </div>
      ) : (
        <Image
          src={CONFIG.profile.avatarUrl}
          alt=""
          fill
          sizes="36px"
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </button>
  );
}
