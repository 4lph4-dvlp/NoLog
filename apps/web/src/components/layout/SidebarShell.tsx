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
import { SidebarToggleRight } from "@/components/layout/SidebarToggleRight";
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
 * The per-side collapse machinery (applyCollapse, handleToggle, the
 * matchMedia listener, and the mount-read effect) is written once,
 * parameterized by `side`, and invoked for both "left" and "right" — no
 * second, copy-pasted state machine. The right side's avatar toggle
 * (SidebarToggleRight) is wired into the pinned row below, reusing this
 * machinery unmodified.
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
  // Keyed per side (CR-01 fix): left and right collapse independently and
  // can each be mid-transition at the same time, so a single shared slot
  // let one side's cleanup unconditionally cancel the other's still-in-
  // flight animation.
  const pendingTransitionCleanupRef = useRef<Record<SidebarSide, (() => void) | null>>({
    left: null,
    right: null,
  });
  // Per-side handles used by applyCollapse's focus-rescue-then-inert
  // sequence: the panel ref for the document.activeElement containment
  // check and the inert read/write target, the toggle ref for the .focus()
  // rescue landing spot. Both are DOM handles attached via callback refs
  // below, not React props, so the inert write in applyCollapse is
  // synchronous and ordered relative to the focus check (A11Y-03).
  const panelRefs = useRef<Record<SidebarSide, HTMLElement | null>>({ left: null, right: null });
  const toggleRefs = useRef<Record<SidebarSide, HTMLButtonElement | null>>({ left: null, right: null });

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
      // the client. One per-side helper, invoked for both sides, so this
      // mount-read logic exists exactly once.
      SIDES.forEach((side) => {
        const sideCollapsed = document.documentElement.getAttribute(sidebarAttrName(side)) === "collapsed";
        const sidePref = readSidebarPref(side);
        collapsedRef.current = { ...collapsedRef.current, [side]: sideCollapsed };
        prefRef.current = { ...prefRef.current, [side]: sidePref };
        setCollapsed((prev) => ({ ...prev, [side]: sideCollapsed }));
        setPrefs((prev) => ({ ...prev, [side]: sidePref }));

        // Apply inert directly to any side that starts collapsed, so a
        // visitor arriving below the threshold (or with a saved collapsed
        // preference) never has a phantom tab stop before their first
        // interaction. No focus rescue here — nothing has focus inside a
        // panel yet at mount, and a .focus() call during hydration would
        // steal focus from the document.
        const panel = panelRefs.current[side];
        if (panel) {
          if (sideCollapsed) {
            panel.setAttribute("inert", "");
          } else {
            panel.removeAttribute("inert");
          }
        }
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  /**
   * Schedules removal of SIDEBAR_TRANSITION_ATTR two ways, whichever fires
   * first: a transitionend listener on the grid container filtered to
   * grid-template-columns, and a 250ms timeout fallback (the 200ms
   * --transition-base duration plus a ~50ms buffer, per 10-RESEARCH.md
   * Assumption A2). Cancels any cleanup already pending from a rapid prior
   * click on the SAME side before scheduling a new one — keyed per side
   * (CR-01) because left and right transition independently; the caller
   * (applyCollapse) also relies on this running BEFORE it (re)sets the
   * attribute, so a same-side rapid re-click never leaves the attribute
   * removed underneath the new width flip.
   */
  function scheduleTransitionCleanup(side: SidebarSide) {
    if (pendingTransitionCleanupRef.current[side]) {
      pendingTransitionCleanupRef.current[side]!();
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
      pendingTransitionCleanupRef.current[side] = null;
      if (grid) grid.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(timeoutId);

      // Only clear the shared <html> attribute once the OTHER side has no
      // transition of its own still pending — removing it out from under
      // an in-flight animation on the other side would snap that side's
      // box to its final width mid-transition.
      const otherSide: SidebarSide = side === "left" ? "right" : "left";
      if (!pendingTransitionCleanupRef.current[otherSide]) {
        document.documentElement.removeAttribute(SIDEBAR_TRANSITION_ATTR);
      }
    }

    if (grid) grid.addEventListener("transitionend", onTransitionEnd);
    const timeoutId = window.setTimeout(finish, 250);

    pendingTransitionCleanupRef.current[side] = finish;
  }

  /**
   * The single shared routine applying a side's collapse effects — called
   * from BOTH handleToggle (click path) and the matchMedia change handler
   * (resize path), so A11Y-03's focus rescue fires identically on both
   * without duplicating the sequence. Order is load-bearing:
   *
   * 1. Idempotency guard: a repeated request for the already-rendered
   *    value is a no-op — no inert write, no focus move — so a resize
   *    event (or a rapid double click) never steals focus from wherever
   *    the reader has since moved it.
   * 2. Only when collapsing: synchronously check whether
   *    document.activeElement sits inside the panel about to collapse; if
   *    so, move focus to that panel's own toggle button FIRST, in the same
   *    tick, before inert is applied. No setTimeout/rAF/effect — the
   *    rescue must complete before step 3 or focus lands inside an inert
   *    subtree (A11Y-03).
   * 3. Set or remove the native inert attribute directly on the panel DOM
   *    node via the ref — never a display or visibility change, either of
   *    which would remove the box from the render tree and make the
   *    in-flight grid-template-columns transition snap instead of
   *    animating (A11Y-02).
   * 4. Only when animate is true (click path, and only when reduced motion
   *    does not match) add the transition-gating attribute — the resize
   *    path always passes animate=false, so this step is skipped entirely
   *    and the width change is instant (D-11).
   * 5. Flip the <html> data-sidebar-* attribute and the rendered state.
   */
  function applyCollapse(side: SidebarSide, collapsed: boolean, animate: boolean) {
    if (collapsedRef.current[side] === collapsed) return;

    if (collapsed) {
      const panel = panelRefs.current[side];
      if (panel && document.activeElement && panel.contains(document.activeElement)) {
        toggleRefs.current[side]?.focus();
      }
    }

    const panel = panelRefs.current[side];
    if (panel) {
      if (collapsed) {
        panel.setAttribute("inert", "");
      } else {
        panel.removeAttribute("inert");
      }
    }

    // Click-only transition gate (D-11, A11Y-04). The independent CSS-layer
    // guard is globals.css's @media (prefers-reduced-motion: no-preference)
    // wrapper around the transition rule — neither layer alone is trusted.
    //
    // CR-01: cleanup is scheduled BEFORE the attribute is (re)set, not
    // after. A rapid second click on THIS side invokes the previous
    // click's still-pending finish() inside scheduleTransitionCleanup,
    // which may remove the attribute (if the other side is idle) — running
    // that first and only then (re)adding the attribute guarantees it is
    // present at the moment setSidebarAttr below flips the width, whether
    // the previous pending transition was on this same side or the other.
    if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      scheduleTransitionCleanup(side);
      document.documentElement.setAttribute(SIDEBAR_TRANSITION_ATTR, "active");
    }

    setSidebarAttr(side, collapsed);
    collapsedRef.current = { ...collapsedRef.current, [side]: collapsed };
    setCollapsed((prev) => ({ ...prev, [side]: collapsed }));
  }

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

        // animate=false: a matchMedia flip must never visibly "whip" the
        // sidebar along behind a dragged window edge (D-11). Idempotency
        // and the focus-rescue-then-inert sequence both live inside
        // applyCollapse, shared with the click path (A11Y-03).
        applyCollapse(side, event.matches, false);
      });
    }

    mediaQuery.addEventListener("change", handleAutoCollapseChange);
    return () => mediaQuery.removeEventListener("change", handleAutoCollapseChange);
    // applyCollapse is intentionally omitted from this dependency array: it
    // is a stable per-render function closing only over refs (never state),
    // so it never needs to retrigger this subscription; adding it would
    // force unsubscribe/resubscribe every render for no behavioral benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unmount-only cleanup so a lingering transition attribute can never
  // outlive this component (defensive — SidebarShell normally persists
  // across route navigation, matching SIDE-06's persistence requirement).
  // Both sides are flushed — each side's pending cleanup is independent
  // (CR-01), so either or both may still be in flight at unmount.
  useEffect(() => {
    const pending = pendingTransitionCleanupRef.current;
    return () => {
      SIDES.forEach((side) => {
        pending[side]?.();
      });
    };
  }, []);

  function handleToggle(side: SidebarSide) {
    const next = !collapsedRef.current[side];

    applyCollapse(side, next, true);

    writeSidebarPref(side, next);
    prefRef.current = { ...prefRef.current, [side]: next };
    setPrefs((prev) => ({ ...prev, [side]: next }));
  }

  return (
    <>
      <div className="hidden md:flex sticky top-6 z-50 justify-between items-center mb-4">
        <SidebarToggleLeft
          ref={(el) => {
            toggleRefs.current.left = el;
          }}
          collapsed={collapsed.left}
          mounted={mounted}
          onToggle={() => handleToggle("left")}
        />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SidebarToggleRight
            ref={(el) => {
              toggleRefs.current.right = el;
            }}
            collapsed={collapsed.right}
            mounted={mounted}
            onToggle={() => handleToggle("right")}
          />
        </div>
      </div>
      <div
        ref={gridRef}
        className="sidebar-grid flex flex-col gap-4 md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8"
      >
        <aside
          ref={(el) => {
            panelRefs.current.left = el;
          }}
          id={SIDEBAR_PANEL_IDS.left}
          className="hidden md:block sticky top-16 self-start min-w-0 overflow-hidden"
        >
          <div className="w-[200px]">{leftSlot}</div>
        </aside>

        <main className="min-w-0">{children}</main>

        <aside
          ref={(el) => {
            panelRefs.current.right = el;
          }}
          id={SIDEBAR_PANEL_IDS.right}
          className="hidden md:block sticky top-16 self-start min-w-0 overflow-hidden"
        >
          <div className="w-[240px]">{rightSlot}</div>
        </aside>
      </div>
    </>
  );
}
