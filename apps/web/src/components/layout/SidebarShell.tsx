"use client";

import { useEffect, useRef, useState } from "react";
import {
  SIDEBAR_PANEL_IDS,
  readSidebarPref,
  setSidebarAttr,
  sidebarAttrName,
  writeSidebarPref,
  type SidebarPref,
  type SidebarSide,
} from "@/lib/sidebar";
import { SidebarToggleLeft } from "@/components/layout/SidebarToggleLeft";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SidebarShellProps {
  leftSlot: React.ReactNode;
  rightSlot: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Client wrapper owning both sides' tri-state (null | true | false) and
 * rendering the pinned toggle row, the 3-column grid, both <aside> panels,
 * and <main>.
 *
 * This file must never import the subscribe component directory or the
 * Profile card directly (D-06, stop-ship) — it receives them already
 * rendered inside leftSlot/rightSlot, the same subscribeSlot pattern
 * apps/web/src/templates/terminal/PostPage.tsx already uses. A direct
 * import here would evaluate the subscribe component's server-only
 * RESEND_API_KEY gate inside client code, where the secret always resolves
 * to undefined, silently disabling the subscribe form for every configured
 * forker.
 *
 * The per-side collapse machinery (handleToggle below) is written once,
 * parameterized by `side`, so plan 10-02's right-side avatar toggle reuses
 * it unmodified. This task wires only the left side's mount-read and click
 * path; the right side's Record entries already exist (matching the
 * pre-hydration script, which writes both sides' attributes deliberately)
 * but nothing yet reads or writes them for "right" — that lands with plan
 * 10-02's avatar toggle.
 */
export function SidebarShell({ leftSlot, rightSlot, children }: SidebarShellProps) {
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<SidebarSide, boolean>>({
    left: false,
    right: false,
  });
  const [, setPrefs] = useState<Record<SidebarSide, SidebarPref>>({
    left: null,
    right: null,
  });
  const prefRef = useRef<Record<SidebarSide, SidebarPref>>({ left: null, right: null });

  useEffect(() => {
    // Deferred via setTimeout(0), matching ThemeToggle.tsx's exact mounted-
    // guard idiom (also keeps the setState calls out of the effect body's
    // synchronous top level).
    const timer = window.setTimeout(() => {
      setMounted(true);
      // Read the SAME <html> attribute the pre-hydration script already
      // corrected before paint into the rendered collapsed state — never a
      // second, independent localStorage read here for the collapsed value
      // (Pitfall 1). The explicit preference is read separately via
      // readSidebarPref, which is the one place localStorage is read on
      // the client.
      const leftCollapsed = document.documentElement.getAttribute(sidebarAttrName("left")) === "collapsed";
      const leftPref = readSidebarPref("left");
      setCollapsed((prev) => ({ ...prev, left: leftCollapsed }));
      setPrefs((prev) => ({ ...prev, left: leftPref }));
      prefRef.current = { ...prefRef.current, left: leftPref };
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function handleToggle(side: SidebarSide) {
    const next = !collapsed[side];
    setSidebarAttr(side, next);
    setCollapsed((prev) => ({ ...prev, [side]: next }));
    writeSidebarPref(side, next);
    setPrefs((prev) => ({ ...prev, [side]: next }));
    prefRef.current = { ...prefRef.current, [side]: next };
  }

  return (
    <>
      <div className="hidden md:flex sticky top-6 z-50 justify-between items-center mb-4">
        <SidebarToggleLeft
          collapsed={collapsed.left}
          mounted={mounted}
          onToggle={() => handleToggle("left")}
        />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
      <div className="sidebar-grid flex flex-col gap-4 md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8">
        <aside
          id={SIDEBAR_PANEL_IDS.left}
          className="hidden md:block sticky top-16 self-start min-w-0 overflow-hidden"
        >
          <div className="w-[200px]">{leftSlot}</div>
        </aside>

        <main className="min-w-0">{children}</main>

        <aside
          id={SIDEBAR_PANEL_IDS.right}
          className="hidden md:block sticky top-16 self-start min-w-0 overflow-hidden"
        >
          <div className="w-[240px]">{rightSlot}</div>
        </aside>
      </div>
    </>
  );
}
