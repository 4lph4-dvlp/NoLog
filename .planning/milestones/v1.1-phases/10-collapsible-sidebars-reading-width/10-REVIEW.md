---
phase: 10-collapsible-sidebars-reading-width
reviewed: 2026-08-12T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - apps/web/src/lib/sidebar.ts
  - apps/web/src/components/layout/SidebarShell.tsx
  - apps/web/src/components/layout/SidebarToggleLeft.tsx
  - apps/web/src/components/layout/SidebarToggleRight.tsx
  - apps/web/src/app/globals.css
  - apps/web/src/app/layout.tsx
  - apps/web/src/templates/default/Layout.tsx
  - apps/web/src/templates/default/PostPage.tsx
  - apps/web/src/components/Profile.tsx
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-08-12
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Reviewed all nine files against `10-CONTEXT.md`'s fourteen locked decisions and `10-UI-SPEC.md`'s
interaction/CSS contract. `npm run lint --prefix apps/web` and `npm run build --prefix apps/web` both
pass cleanly at time of review. The implementation is unusually faithful to the spec: `sidebar.ts`'s
`localStorage` parse is a genuine strict allowlist (`"true"`/`"false"`/else-`null`, never a coercion,
never a raw value reaching a DOM attribute); the pre-hydration `<script>` in `app/layout.tsx`
interpolates only build-time constants (`SIDEBAR_BREAKPOINT_PX`, `SIDEBAR_STORAGE_KEY_PREFIX`,
`SIDEBAR_ATTR_PREFIX`, all `JSON.stringify`'d where they're strings) and shares the single threshold
with the client `matchMedia` listener, so there is no drift between the two; the `@property` blocks in
`globals.css` correctly use single quotes (avoiding the documented Turbopack/Lightning CSS trap); no
`transform`/non-`visible` `overflow` was introduced on any ancestor of either `<aside>`; `Layout.tsx`
stays a Server Component and `SidebarShell.tsx` never imports `SubscribeSection` — a repo-wide grep for
`NEXT_PUBLIC_RESEND` returns nothing; and the four toggle strings, ring treatment, and focus-visible
styles match `10-UI-SPEC.md`'s Copywriting/Component contracts character-for-character.

One genuine functional defect was found in `SidebarShell.tsx`'s transition-cleanup bookkeeping (see
CR-01) — it is a **single shared ref** guarding what is logically **two independent per-side
transitions**, and the "cancel the previous pending cleanup" step unconditionally removes the
just-set `data-sidebar-transition` attribute before the newly-triggered width change ever paints.
This does not produce the "stuck forever" failure mode CONTEXT D-11 explicitly warns about (the
attribute ends up removed too early, not stuck on), but it does silently defeat the Transition
Contract's "toggle click → yes, animates" guarantee under a very ordinary interaction (clicking the
second toggle, or re-clicking the same one, within ~250ms of the first click).

## Critical Issues

### CR-01: Shared transition-cleanup ref cancels the sidebar animation on rapid toggles

**File:** `apps/web/src/components/layout/SidebarShell.tsx:64, 123-149, 197-205`

**Issue:** `pendingTransitionCleanupRef` (line 64) is a single ref shared by **both** sides, even
though left and right collapse independently and can each be mid-transition at the same time.

`scheduleTransitionCleanup()` (lines 123-149) starts by unconditionally invoking whatever cleanup is
already pending:

```ts
function scheduleTransitionCleanup() {
  if (pendingTransitionCleanupRef.current) {
    pendingTransitionCleanupRef.current();   // <-- calls the PREVIOUS finish(), which
  }                                            //     unconditionally removes the attribute
  ...
}
```

and `applyCollapse()` calls it right after setting the attribute for the *current* toggle:

```ts
if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.documentElement.setAttribute(SIDEBAR_TRANSITION_ATTR, "active");
  scheduleTransitionCleanup();   // <-- line 202: may synchronously remove the attribute
}                                 //     that was just set one line above

setSidebarAttr(side, collapsed);  // <-- line 205: the actual width flip happens AFTER that
```

Trace a plausible sequence — click the hamburger, then click the avatar toggle before the first
250ms cleanup window elapses (or simply double-click the same toggle quickly):

1. Click 1 (left): attribute set to `"active"`; `scheduleTransitionCleanup()` has nothing pending, so
   it registers `finish_1` (transitionend listener + 250ms timeout) and stores it in the shared ref.
2. Click 2 (right, or left again) fires before `finish_1` runs: `applyCollapse` sets the attribute to
   `"active"` again (line 201), then calls `scheduleTransitionCleanup()` (line 202), whose **first**
   action is to invoke the *stored* `finish_1` — which unconditionally does
   `document.documentElement.removeAttribute(SIDEBAR_TRANSITION_ATTR)`.
3. All of this is synchronous, in the same JS task, with no paint in between. By the time
   `setSidebarAttr(side, collapsed)` runs and the browser next needs to compute style, the
   `data-sidebar-transition="active"` attribute is **absent** — so the CSS rule
   `html[data-sidebar-transition="active"] .sidebar-grid { transition: ... }` does not match, and
   click 2's `grid-template-columns` change snaps instead of animating. If click 1's own transition
   was still in flight, removing the `transition` property mid-flight also causes *its* box to jump to
   its final width immediately instead of finishing the animation.

This directly breaks the Transition Contract's first row (`10-UI-SPEC.md` "Transition Contract" —
"Toggle click → Yes — 200ms ease") under completely ordinary use: a reader trying both toggles in
quick succession, which is a natural way to discover the feature, gets one or both collapses snapping
instead of animating. It does not trigger CONTEXT D-11's specific "stuck forever" hazard (the
attribute ends up removed, not stuck present), but it is a real, reproducible violation of a **locked**
interaction contract, not a hypothetical.

**Fix:** Track pending cleanup per side, and only remove the shared `<html>` attribute once neither
side still has a transition in flight:

```ts
const pendingTransitionCleanupRef = useRef<Record<SidebarSide, (() => void) | null>>({
  left: null,
  right: null,
});

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

    // Only clear the shared attribute once the OTHER side has no
    // transition of its own still pending, or its in-flight animation
    // gets cancelled out from under it.
    const otherSide: SidebarSide = side === "left" ? "right" : "left";
    if (!pendingTransitionCleanupRef.current[otherSide]) {
      document.documentElement.removeAttribute(SIDEBAR_TRANSITION_ATTR);
    }
  }

  if (grid) grid.addEventListener("transitionend", onTransitionEnd);
  const timeoutId = window.setTimeout(finish, 250);

  pendingTransitionCleanupRef.current[side] = finish;
}
```

and call it as `scheduleTransitionCleanup(side)` from `applyCollapse`.

## Warnings

### WR-01: Both `<aside>`s' sticky offset changed from `top-8` to `top-16` with no derivation recorded

**File:** `apps/web/src/components/layout/SidebarShell.tsx:295, 307`

**Issue:** Pre-phase, both panels were `sticky top-8` (`git show <base>^:.../Layout.tsx`). This diff
changes both to `sticky top-16 self-start`:

```tsx
className="hidden md:block sticky top-16 self-start min-w-0 overflow-hidden"
```

Neither `10-CONTEXT.md` nor `10-UI-SPEC.md` documents this value or its derivation — the
Positioning & Sticky Contract only specifies the *toggle row's* own offset (`top-6`, matching
`ThemeToggle`'s pre-existing `md:top-6`). The panels' offset needing to grow to clear the newly
in-flow, sticky toggle row above them is a reasonable inference, but `top-16` (64px) is not obviously
derived from the row's actual box: `top-6` (24px) + the row's rendered height (~36px, the tallest
child, the 36px avatar toggle) lands close to but not exactly at 64px, and the row also carries its
own `mb-4` (16px) margin before the grid starts — margin on an earlier sticky sibling doesn't
automatically factor into a later sibling's own `top:` value. If the arithmetic is off, the practical
symptom is either a visible ~jump when the panel's sticky state engages, or the panel sticking a few
pixels above/below the toggle row's actual bottom edge — exactly what Pitfall 9's manual scroll test
exists to catch, and exactly the kind of change (an unexplained magic-number tweak paired with new
`sticky` usage) that test is meant to gate.

**Fix:** Either derive `top-16` explicitly (add a one-line comment showing the arithmetic: toggle row
sticky offset + row height, so a future edit to the row's chrome doesn't silently desync the offset),
or confirm empirically via the browser that the panel sticks flush against the toggle row's bottom
edge in both themes, at both `md` and larger breakpoints, and record the confirmed value's derivation
next to the className.

## Info

### IN-01: Ref-callback closures reallocated every render

**File:** `apps/web/src/components/layout/SidebarShell.tsx:267-269, 277-279, 291-293, 303-305`

**Issue:** The four DOM ref attachments use inline arrow functions —

```tsx
ref={(el) => {
  toggleRefs.current.left = el;
}}
```

— which React treats as a *new* ref callback on every render (referential inequality), so on each
re-render React first calls the previous callback with `null` then the new callback with the element.
Functionally harmless here (the refs are only read on-demand inside event handlers, never depended on
by an effect's dependency array), but it's unnecessary churn on every one of `SidebarShell`'s several
state updates per toggle (mount, `collapsed`, `prefs`).

**Fix:** Hoist these to stable callbacks with `useCallback`, or use a small helper that returns a
memoized setter per side, e.g. `const setToggleRef = useCallback((side: SidebarSide) => (el: HTMLButtonElement | null) => { toggleRefs.current[side] = el; }, [])`.

---

_Reviewed: 2026-08-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
