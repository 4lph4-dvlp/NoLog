# Phase 10 — Deferred Items (out of scope for this plan)

Logged per the executor's Scope Boundary protocol: issues discovered during verification that are
NOT directly caused by this plan's own changes are recorded here, not fixed.

## 1. Console error on post-page hard navigation: "Can't perform a React state update on a component that hasn't mounted yet"

**Discovered during:** Task 2's console check while running the sticky/pitfall/a11y battery.

**Observation:** A hard `goto` (full page load, not a client-side transition) to any `/post/[id]`
route logs one `[error]`-level console line immediately after the thumbnail's "missing sizes prop"
warning:
```
Can't perform a React state update on a component that hasn't mounted yet. This indicates that
you have a side-effect in your render function that asynchronously tries to update the component.
Move this work to useEffect instead.
```
A hard `goto` to `/` (home) does **not** produce this error, under the same session, same reload
method, immediately before/after.

**Why this is out of scope for plan 10-04:** this plan writes only `.planning/` evidence files; it
does not modify `apps/web/src`. More importantly, isolating the reproduction to "post pages only,
not home" rules out `SidebarShell.tsx` as the cause — `SidebarShell` wraps both home and post pages
identically (it is `Layout.tsx`'s wrapper for every default-template page), and its own mount
effect defers every `setState` call via `window.setTimeout(0)` inside `useEffect`, matching
`ThemeToggle.tsx`'s already-shipped, already-working pattern exactly. The error is specific to
content that only exists on the post-detail route (`PostThumbnailImage`, `NotionPageRenderer`,
`MermaidBlock`, or `react-notion-x`'s own internals) — none of which were touched by any Phase 10
plan (10-01 through 10-04 touch `SidebarShell.tsx`, the two toggle components, `lib/sidebar.ts`,
`globals.css`, `app/layout.tsx`, `templates/default/Layout.tsx`, and `templates/default/PostPage.tsx`'s
single `max-w` class — none of which are the thumbnail/renderer/Mermaid code paths).

**Recommendation:** carry into `/gsd-complete-milestone`'s audit or a targeted `/gsd-debug` pass.
Likely candidates given the observed scope (post-only, not home-only): `PostThumbnailImage.tsx`'s
`onError` state update if it fires unusually early, or `MermaidBlock.tsx`'s async `mermaid.render()`
resolving after a fast route change tears down the component. Not investigated further here since
it requires modifying files outside this plan's `files_modified` list and outside Phase 10's scope
entirely.
