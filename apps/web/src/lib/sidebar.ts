/**
 * Single source of truth for the collapsible-sidebar feature's shared
 * constants, storage/attribute vocabulary, and the strict allowlist parser
 * used by both the pre-hydration script (apps/web/src/app/layout.tsx) and
 * the client runtime (SidebarShell.tsx). SIDEBAR_BREAKPOINT_PX in particular
 * must never be redefined as a second literal anywhere else under
 * apps/web/src (CONTEXT.md landmine 2).
 */

export const SIDEBAR_BREAKPOINT_PX = 1280;
export const SIDEBAR_STORAGE_KEY_PREFIX = "nolog:sidebar:";
export const SIDEBAR_ATTR_PREFIX = "data-sidebar-";
export const SIDEBAR_TRANSITION_ATTR = "data-sidebar-transition";

export type SidebarSide = "left" | "right";

/** null = auto (follows the viewport threshold live, never toggled). */
export type SidebarPref = boolean | null;

export const SIDEBAR_PANEL_IDS: Record<SidebarSide, string> = {
  left: "sidebar-left-panel",
  right: "sidebar-right-panel",
};

export function sidebarStorageKey(side: SidebarSide): string {
  return `${SIDEBAR_STORAGE_KEY_PREFIX}${side}`;
}

export function sidebarAttrName(side: SidebarSide): string {
  return `${SIDEBAR_ATTR_PREFIX}${side}`;
}

/**
 * Strict allowlist parse: only the exact strings "true"/"false" map to a
 * boolean; every other value — including a tampered, garbage, or absent
 * value — maps to null (auto). The raw input is never returned, never
 * concatenated into an attribute value, and never used as a class name
 * (ASVS V5 Input Validation, threat T-10-01).
 */
export function parseSidebarPref(raw: string | null): SidebarPref {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

/** Wraps localStorage.getItem in try/catch — returns null on throw (private-mode/disabled storage). */
export function readSidebarPref(side: SidebarSide): SidebarPref {
  try {
    return parseSidebarPref(localStorage.getItem(sidebarStorageKey(side)));
  } catch {
    return null;
  }
}

/** Wraps localStorage.setItem in try/catch and swallows the throw. */
export function writeSidebarPref(side: SidebarSide, collapsed: boolean): void {
  try {
    localStorage.setItem(sidebarStorageKey(side), collapsed ? "true" : "false");
  } catch {
    // Private mode / disabled storage — the preference simply won't persist.
  }
}

/**
 * Writes the collapsed/expanded vocabulary onto <html>. The two value words
 * ("collapsed"/"expanded") live only in this file, alongside
 * initSidebarState below — this is the "explicitly commented deliberate
 * duplication" CONTEXT.md landmine 2 permits: initSidebarState's body is
 * serialized via .toString() into a pre-hydration <script> and cannot
 * import this function, so it must inline the same two words itself.
 */
export function setSidebarAttr(side: SidebarSide, collapsed: boolean): void {
  document.documentElement.setAttribute(sidebarAttrName(side), collapsed ? "collapsed" : "expanded");
}

/**
 * Serialized via `.toString()` into the pre-hydration inline <script> in
 * apps/web/src/app/layout.tsx (matches the technique read directly out of
 * the installed next-themes bundle — see 10-RESEARCH.md Code Example 2).
 * Because `.toString()` captures only the function's own body text, this
 * function must reference ONLY its own three parameters and browser
 * globals (document, window, localStorage) — no import, no module-scope
 * constant, no closure over anything outside its own parameters/locals.
 * Written in ES5-shaped JS (var, plain functions, ternary, no optional
 * chaining, no nullish coalescing, no async, no class fields) so the
 * emitted string cannot acquire a transpiler helper reference.
 *
 * Writes BOTH sides deliberately — the right attribute has no CSS consumer
 * until plan 10-02, so it is a no-op there, and writing both here means the
 * script and its parse logic are authored once.
 */
/* eslint-disable no-var, @typescript-eslint/no-unused-vars -- this function's
   body is serialized via .toString() below and must stay ES5-shaped; its
   catch binding is intentionally unused (allowlist parse degrades to null). */
export function initSidebarState(
  breakpointPx: number,
  storageKeyPrefix: string,
  attrPrefix: string
): void {
  var root = document.documentElement;
  var isNarrow = window.matchMedia("(max-width: " + (breakpointPx - 1) + "px)").matches;
  ["left", "right"].forEach(function (side) {
    var pref = null;
    try {
      var raw = localStorage.getItem(storageKeyPrefix + side);
      pref = raw === "true" ? true : raw === "false" ? false : null;
    } catch (e) {
      pref = null;
    }
    var collapsed = pref === null ? isNarrow : pref;
    root.setAttribute(attrPrefix + side, collapsed ? "collapsed" : "expanded");
  });
}
/* eslint-enable no-var, @typescript-eslint/no-unused-vars */
