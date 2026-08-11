"use client";

import { useEffect, useRef, useState } from "react";
import {
  SIDEBAR_BREAKPOINT_PX,
  SIDEBAR_PANEL_IDS,
  SIDEBAR_TRANSITION_ATTR,
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

const SIDES: SidebarSide[] = ["left", "right"];

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
 * it unmodified. Task 1 wired only the left side's mount-read and click
 * path; the right side's Record entries exist (matching the pre-hydration
 * script, which writes both sides' attributes deliberately) and are now
 * also read by the auto-collapse listener below — a no-op today since
 * there is no right-side button or CSS consumer yet, but that lands with
 * plan 10-02's avatar toggle without needing to touch this listener again.
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
  // Ref mirrors, read by the matchMedia listener and handleToggle so both
  // always see the current value without resubscribing or going stale
  // inside a closure captured at mount.
  const prefRef = useRef<Record<SidebarSide, SidebarPref>>({ left: null, right: null });
  const collapsedRef = useRef<Record<SidebarSide, boolean>>({ left: false, right: false });
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingTransitionCleanupRef = useRef<(() => void) | null>(null);

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
      collapsedRef.current = { ...collapsedRef.current, left: leftCollapsed };
      prefRef.current = { ...prefRef.current, left: leftPref };
      setCollapsed((prev) => ({ ...prev, left: leftCollapsed }));
      setPrefs((prev) => ({ ...prev, left: leftPref }));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Auto-collapse listener (SIDE-05, D-10). Derived from the SAME imported
  // SIDEBAR_BREAKPOINT_PX the pre-hydration script consumes — never a
  // second hardcoded breakpoint literal (CONTEXT.md landmine 2). Never adds
  // SIDEBAR_TRANSITION_ATTR and never calls writeSidebarPref — only the
  // explicit preference is ever persisted (D-02); a resize-driven change is
  // always instant and always transient.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: " + (SIDEBAR_BREAKPOINT_PX - 1) + "px)");

    function handleAutoCollapseChange(event: MediaQueryListEvent) {
      SIDES.forEach((side) => {
        // An explicit preference wins absolutely — no floor override at any
        // viewport (D-10, no exception branch).
        if (prefRef.current[side] !== null) return;

        const nextCollapsed = event.matches;
        // Idempotency: a change event whose resolved value already matches
        // the rendered state performs no attribute write at all.
        if (collapsedRef.current[side] === nextCollapsed) return;

        setSidebarAttr(side, nextCollapsed);
        collapsedRef.current = { ...collapsedRef.current, [side]: nextCollapsed };
        setCollapsed((prev) => ({ ...prev, [side]: nextCollapsed }));
      });
    }

    mediaQuery.addEventListener("change", handleAutoCollapseChange);
    return () => mediaQuery.removeEventListener("change", handleAutoCollapseChange);
  }, []);

  // Unmount-only cleanup so a lingering transition attribute can never
  // outlive this component (defensive — SidebarShell normally persists
  // across route navigation, matching SIDE-06's persistence requirement).
  useEffect(() => {
    return () => {
      if (pendingTransitionCleanupRef.current) {
        pendingTransitionCleanupRef.current();
      }
    };
  }, []);

  /**
   * Schedules removal of SIDEBAR_TRANSITION_ATTR two ways, whichever fires
   * first: a transitionend listener on the grid container filtered to
   * grid-template-columns, and a 250ms timeout fallback (the 200ms
   * --transition-base duration plus a ~50ms buffer, per 10-RESEARCH.md
   * Assumption A2). Cancels any cleanup already pending from a rapid prior
   * click before scheduling a new one.
   */
  function scheduleTransitionCleanup() {
    if (pendingTransitionCleanupRef.current) {
      pendingTransitionCleanupRef.current();
    }

    const grid = gridRef.current;
    let done = false;

    function onTransitionEnd(event: TransitionEvent) {
      if (event.propertyName !== "grid-template-columns") return;
      finish();
    }

    function finish() {
      if (done) return;
      done = true;
      document.documentElement.removeAttribute(SIDEBAR_TRANSITION_ATTR);
      if (grid) grid.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timeoutId);
      pendingTransitionCleanupRef.current = null;
    }

    if (grid) grid.addEventListener("transitionend", onTransitionEnd);
    const timeoutId = window.setTimeout(finish, 250);

    pendingTransitionCleanupRef.current = finish;
  }

  function handleToggle(side: SidebarSide) {
    const next = !collapsedRef.current[side];

    // Click-only transition gate (D-11, A11Y-04). The independent CSS-layer
    // guard is globals.css's @media (prefers-reduced-motion: no-preference)
    // wrapper around the transition rule — neither layer alone is trusted.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.setAttribute(SIDEBAR_TRANSITION_ATTR, "active");
      scheduleTransitionCleanup();
    }

    setSidebarAttr(side, next);
    collapsedRef.current = { ...collapsedRef.current, [side]: next };
    setCollapsed((prev) => ({ ...prev, [side]: next }));

    writeSidebarPref(side, next);
    prefRef.current = { ...prefRef.current, [side]: next };
    setPrefs((prev) => ({ ...prev, [side]: next }));
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
      <div
        ref={gridRef}
        className="sidebar-grid flex flex-col gap-4 md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8"
      >
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
