# Phase 10: Collapsible Sidebars & Reading Width - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 8 (4 new, 5 modified — 1 file appears implicitly touched twice: `PostPage.tsx` region 2 vs Phase 9's region)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/web/src/components/layout/SidebarShell.tsx` | provider/component (client wrapper) | event-driven (matchMedia + localStorage + DOM attr writes) | `apps/web/src/components/ThemeProvider.tsx` (client wrapper around a 3rd-party state mechanism) + `apps/web/src/app/post/[id]/page.tsx` (slot-passing) | role-match (composite — two analogs, no single exact one exists) |
| `apps/web/src/components/layout/SidebarToggleLeft.tsx` | component (icon button) | request-response (click → state write) | `apps/web/src/components/ThemeToggle.tsx` | exact |
| `apps/web/src/components/layout/SidebarToggleRight.tsx` | component (icon button + media) | request-response (click → state write) + file-I/O (image `onError`) | `apps/web/src/components/ThemeToggle.tsx` (button chrome/mounted-guard) + `apps/web/src/components/PostThumbnailImage.tsx` (onError fallback) | role-match (composite) |
| `apps/web/src/lib/sidebar.ts` | utility (shared constants/parse) | transform (strict allowlist parse) | none in-repo (no prior shared-constant-module pattern) — closest shape is `apps/web/src/site.config.ts` (plain literal exports, no `process.env`) | role-match (weak — see "No Analog Found") |
| `apps/web/src/templates/default/Layout.tsx` (MODIFIED) | component (Server Component layout) | request-response (build slots, render grid) | itself (pre-image) — this is an edit-in-place, not a from-scratch file | exact (self) |
| `apps/web/src/app/layout.tsx` (MODIFIED) | component (root layout) | request-response + pre-hydration script injection | `node_modules/next-themes/dist/index.js`'s `Y` component (the installed script-injection technique) + this file's own existing `ThemeProvider` wiring | exact (mechanism), self (integration site) |
| `apps/web/src/app/globals.css` (MODIFIED) | config (CSS tokens) | transform (attribute-scoped custom-property override) | itself — `:root` layout-token block (lines 41-44) and `html.transition-colors` (lines 141-147) | exact (self, shape to replicate) |
| `apps/web/src/components/Profile.tsx` (MODIFIED) | component (Server Component) | request-response | itself — one-line root-element change | exact (self) |
| `apps/web/src/templates/default/PostPage.tsx` (MODIFIED) | component (Server Component) | request-response | itself — one className token change | exact (self) |

## Pattern Assignments

### `apps/web/src/components/layout/SidebarShell.tsx` (client wrapper, event-driven)

**Analog 1 — server-passes-rendered-child-to-client-boundary:** `apps/web/src/app/post/[id]/page.tsx` (construction site) and `apps/web/src/templates/terminal/PostPage.tsx` (consumption site).

Construction site (`post/[id]/page.tsx:154-160`):
```tsx
<TerminalPostPage
  post={post}
  recordMap={recordMap}
  categories={categories}
  relatedPosts={relatedPosts}
  subscribeSlot={<SubscribeSection variant="terminal" />}
/>
```

Consumption site, with the load-bearing comment explaining *why* (`templates/terminal/PostPage.tsx:18-21, 95-101`):
```tsx
interface TerminalPostPageProps {
  post: Post;
  recordMap: ExtendedRecordMap | null;
  categories: string[];
  relatedPosts: Post[];
  subscribeSlot?: React.ReactNode;
}

export default function TerminalPostPage({ post, recordMap, categories, relatedPosts, subscribeSlot }: TerminalPostPageProps) {
  ...
  {/* constructed by the post route and handed down as a prop. This file
      must never import the subscribe component directory or read any
      environment variable itself — see the "Architectural constraint"
      section of 03-03-PLAN.md for why a direct import here would evaluate
      the gate in client code, where the secret resolves to undefined. */}
  <div className="w-full">{subscribeSlot}</div>
```

**Apply to `SidebarShell`:** `Layout.tsx` builds `leftSlot = <><SearchBar/><CategoryList categories={categories}/></>` and `rightSlot = <><Profile/><SubscribeSection variant="default"/></>` itself, then passes the already-rendered elements as `leftSlot: ReactNode` / `rightSlot: ReactNode` props into `<SidebarShell>`. `SidebarShell` must carry the identical style of comment explaining why it never imports `SubscribeSection` directly — copy the comment's wording pattern, not just the code shape.

**Analog 2 — client wrapper owning 3rd-party/global state and writing to `document.documentElement`:** `apps/web/src/components/ThemeProvider.tsx` (full file, 23 lines):
```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```
This is the weakest part of the analog set — `ThemeProvider` delegates all logic to the `next-themes` library, whereas `SidebarShell` must hand-roll the `matchMedia` listener, `localStorage` read/write, and `document.documentElement.dataset` writes itself (no library exists to delegate to, per D-07 no-new-deps). Use this analog only for the "`'use client'`, thin wrapper receiving children, no business logic beyond wiring" shape — the actual state-machine logic has no in-repo precedent and must be built from RESEARCH.md's Code Example 2/3, not copied from this file.

**Import pattern to copy** (from `ThemeToggle.tsx:1-5`, since `SidebarShell` sits in the same directory tier):
```tsx
"use client";

import { useEffect, useState } from "react";
```

---

### `apps/web/src/components/layout/SidebarToggleLeft.tsx` (client icon button)

**Analog:** `apps/web/src/components/ThemeToggle.tsx` — excerpt in full (this is the canonical analog per the mapping context; copy nearly verbatim, adapting the icon and label logic):
```tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Dark / Light mode toggle button.
 * Renders a Sun (light) or Moon (dark) icon from lucide-react.
 * Uses useEffect + mounted guard to avoid hydration mismatches.
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted) {
    // Prevent hydration mismatch — render a placeholder with matching dimensions
    return (
      <button
        className="p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors"
        aria-label="Toggle theme"
      >
        <div className="w-[18px] h-[18px]" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px] text-text-secondary" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-text-secondary" />
      )}
    </button>
  );
}
```
**What to copy exactly:** the `mounted` guard shape (fixed-size placeholder `<div>` inside identical button chrome, `setTimeout(..., 0)` in `useEffect`), the `aria-label === title` string-pairing convention, and the button chrome class string `p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer` (per UI-SPEC Component Contract 1, verbatim).

**What NOT to copy:** the icon-swap (`isDark ? Sun : Moon`) — UI-SPEC D-07 explicitly forbids glyph-swapping for the hamburger; render a single `Menu` icon unconditionally and vary only `aria-expanded`, `aria-label`/`title`, and (per UI-SPEC) a `focus-visible` ring this file's analog does not have.

**Error handling:** N/A — no async work, no try/catch in the analog; the new toggle has none either (confirmed by UI-SPEC E1 `error` row: "No fetch, no await, therefore no error state exists").

---

### `apps/web/src/components/layout/SidebarToggleRight.tsx` (client icon button + media + onError fallback)

**Analog 1 (button chrome, mounted guard):** same `ThemeToggle.tsx` excerpt as above — reuse the mounted-guard idiom with a 36px circular placeholder instead of the 18px square one.

**Analog 2 (`next/image` with `fill` + sized wrapper):** `apps/web/src/components/Profile.tsx:65-74`:
```tsx
<div className="relative w-20 h-20 rounded-full overflow-hidden bg-surface-active border-2 border-border">
  <Image
    src={profile.avatarUrl}
    alt={profile.name}
    fill
    className="object-cover"
    sizes="80px"
    priority
  />
</div>
```
**Apply to avatar toggle:** same `relative w-<N> h-<N> rounded-full overflow-hidden` wrapper shape (UI-SPEC specifies `w-9 h-9` / 36px instead of `w-20 h-20`), same `fill` + `object-cover` + `sizes` props on `Image`. Change `alt={profile.name}` → `alt=""` (decorative, per A11Y-05) and drop `priority` (this is a below-the-fold-irrelevant chrome control, not the profile card's own avatar).

**Analog 3 (client component owning an `onError` fallback, receiving only primitives):** `apps/web/src/components/PostThumbnailImage.tsx` (full file, 57 lines) — this is the nearest precedent for the D-14 avatar-fallback requirement AND a second example of the server/client boundary discipline from Analog 1 above (it exists specifically so a Server Component parent never has to manage `useState`):
```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

const WRAPPER = {
  card: "relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface",
  hero: "relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10",
} as const;

const ICON_SIZE = { card: "w-8 h-8", hero: "w-12 h-12" } as const;

interface PostThumbnailImageProps {
  src: string;
  alt: string;
  variant: "card" | "hero";
}

/**
 * Client-side rendering half of the thumbnail pair. Receives the resolved
 * thumbnail URL already decided — three primitives only, nothing that could
 * serialise a Notion presigned URL into the RSC hydration payload. On any
 * load failure (proxy non-200, optimizer failure, dropped connection) —
 * detected via `onError` (D-10) — swaps to a centred `ImageOff` icon inside
 * the same unchanged wrapper (D-09: icon only, no caption).
 */
export function PostThumbnailImage({ src, alt, variant }: PostThumbnailImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={WRAPPER[variant]}>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff
            className={`${ICON_SIZE[variant]} text-text-tertiary`}
            strokeWidth={1.5}
          />
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          {...(variant === "card" ? { sizes: "96px" } : { priority: true })}
        />
      )}
    </div>
  );
}
```
**Apply directly:** the `useState(false)` + ternary-render (fallback icon vs `<Image onError={() => setFailed(true)}>`) pattern is the exact shape for `SidebarToggleRight`'s D-14 requirement. Swap `ImageOff` for `User` (UI-SPEC's chosen fallback glyph), swap the wrapper class for the 36px circular button chrome (`relative w-9 h-9 rounded-full overflow-hidden cursor-pointer` + the accent ring, per UI-SPEC Component Contract 2), and note this component is itself the whole button (`onClick` handler for the toggle), not just an image slot — unlike `PostThumbnailImage`, which has no click behavior.

**Error handling:** identical to the shape above — `onError` flips local boolean state, no retry, no thrown error, no boundary.

---

### `apps/web/src/lib/sidebar.ts` (shared constants/parse module)

**No strong in-repo analog exists** — this project has no prior "shared constant module consumed by both a server-rendered inline script and a client component" pattern. See "No Analog Found" below. Closest shape reference: `apps/web/src/site.config.ts`'s convention of exporting plain literals with no `process.env` reads (so it's safe to import into client code) — but `site.config.ts` is a config object, not a parse-function module, so this is a weak structural match only (naming/export-style, not logic shape).

**Pattern to follow instead (from RESEARCH.md's resolved Code Example 2, verified against the actual installed `next-themes` bundle — see below):** export `SIDEBAR_BREAKPOINT_PX`, the two `localStorage` key string constants, and a strict-allowlist parse function (`"true"` → `true`, `"false"` → `false`, anything else → `null`) — this module is imported by BOTH `app/layout.tsx`'s inline script (via `.toString()` stringification, so the function body must be self-contained with no closure over anything outside its own parameters) and `SidebarShell.tsx`'s `matchMedia` listener.

---

### `apps/web/src/app/layout.tsx` (MODIFIED — add pre-hydration script)

**Analog — the actual installed technique, read directly from `node_modules/next-themes/dist/index.js`** (minified; the load-bearing fragment, de-obfuscated inline below):
```js
// next-themes' own script-injection component (de-minified excerpt):
Y = t.memo(({ attribute: n, storageKey: s, defaultTheme: d, ... }) => {
  let p = JSON.stringify([n, s, d, ...]).slice(1, -1);
  return t.createElement("script", {
    suppressHydrationWarning: true,
    nonce: typeof window === "undefined" ? m : "",
    dangerouslySetInnerHTML: {
      __html: `(${I.toString()})(${p})`,
    },
  });
});
```
Confirms RESEARCH.md's claim exactly: this is a **plain `<script>` element with `dangerouslySetInnerHTML`**, built by stringifying a plain JS function (`I.toString()`) and immediately invoking it with JSON-serialized params — NOT `next/script strategy="beforeInteractive"`. `next-themes` renders this script itself as part of its React tree (inside `ThemeProvider`), not inside `app/layout.tsx` directly — but the technique is identical to what RESEARCH.md's Code Example 2 already specifies for this phase.

**Integration site — current `app/layout.tsx` `<html>`/`<body>` wiring** (full relevant excerpt, lines 63-78):
```tsx
return (
  <html
    lang={CONFIG.site.locale}
    className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    suppressHydrationWarning
  >
    <body className="min-h-full bg-background text-foreground relative">
      <Analytics />
      <ThemeProvider>
        <TemplateLayout categories={categories}>
          {children}
        </TemplateLayout>
      </ThemeProvider>
    </body>
  </html>
);
```
**Apply:** add the new `<script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `(${initSidebarState.toString()})(${SIDEBAR_BREAKPOINT_PX})` }} />` as a sibling inside `<body>`, alongside/before `<ThemeProvider>` (RESEARCH.md: "at least as early as the already-proven next-themes script"). `suppressHydrationWarning` is already present on `<html>` and is element-scoped (per RESEARCH.md), so no additional prop is needed there — only the new `<script>` tag itself needs its own `suppressHydrationWarning`, matching `next-themes`' own usage.

---

### `apps/web/src/app/globals.css` (MODIFIED)

**Analog 1 — existing `:root` layout-token block to extend** (lines 40-44):
```css
/* Layout */
--sidebar-width: 200px;
--profile-width: 240px;
--max-content-width: 1400px;
--header-height: 44px;
```
**Apply:** add `@property --sidebar-width { syntax: '<length>'; inherits: true; initial-value: 200px; }` and the `--profile-width` equivalent as a new block (per UI-SPEC's CSS shape), then add `html[data-sidebar-left="collapsed"] { --sidebar-width: 0px; }` / `html[data-sidebar-right="collapsed"] { --profile-width: 0px; }` overrides. These layout vars are declared **only** under `:root`, not `.dark` (confirmed: `.dark` block below has no `--sidebar-width`/`--profile-width` entries), which is exactly why the attribute-scoped override works identically in both themes with no duplication.

**Analog 2 — the `.dark` block's boundary** (lines 62-97): confirms scope — the new `@property` block and `html[data-sidebar-*]` overrides must sit **outside** (not nested inside) the `.dark { ... }` block, at the same nesting level as `:root`/`.dark` themselves.

**Analog 3 — `@theme inline` bridge** (lines 99-128): shows the existing pattern of exposing CSS custom properties to Tailwind's utility layer via `--color-*` bridges. `--sidebar-width`/`--profile-width` are **not** bridged through `@theme inline` today (they're consumed directly as `var(--sidebar-width)` in the Tailwind arbitrary-value class at `Layout.tsx:41`, not via a `--color-*`-style token) — do not add a new `@theme inline` entry for them; follow the existing direct-`var()`-consumption pattern instead.

**Analog 4 — `html.transition-colors` dead-CSS shape** (lines 140-147), **flagged explicitly per the mapping-context instruction:**
```css
/* Smooth theme transitions (applied after initial load) */
html.transition-colors,
html.transition-colors *,
html.transition-colors *::before,
html.transition-colors *::after {
  transition: background-color var(--transition-base),
    border-color var(--transition-base), color var(--transition-base) !important;
}
```
**WARNING — this CSS rule is never toggled by any code in this repo.** RESEARCH.md verified this by `grep` for `classList`/`"transition-colors"` across every `.tsx`/`.ts` file and by `git log -S"transition-colors"` across the file's whole history — zero hits. `next-themes`' actual flash-prevention mechanism (`disableTransitionOnChange`, confirmed in the installed bundle: `K=e=>{let s=document.createElement("style");...transition:none!important...}`) is a completely different, self-contained technique that temporarily *disables* transitions via an injected `<style>` tag — it does not add this class. **Treat this rule as a shape to replicate (an "opt-in transition, gated by a class/attribute added only for deliberate changes" idiom), not wiring to hook into.** The new sidebar transition rule (`html[data-sidebar-transition="active"] .sidebar-grid { transition: grid-template-columns var(--transition-base); }`, per UI-SPEC) must be built with its own fresh add/remove logic in `SidebarShell.tsx` — do not write a plan step that says "wire into the existing `html.transition-colors` toggle," because there is no existing toggle to wire into.

---

### `apps/web/src/templates/default/Layout.tsx` (MODIFIED — full current file, 63 lines, both branches must be understood)

```tsx
import { Profile } from "@/components/Profile";
import { SearchBar } from "@/components/SearchBar";
import { CategoryList } from "@/components/CategoryList";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";

interface DefaultLayoutProps {
  children: React.ReactNode;
  categories: string[];
}

export default function DefaultLayout({ children, categories }: DefaultLayoutProps) {
  return (
    <div className="relative max-w-[var(--max-content-width)] mx-auto px-4 pt-16 pb-6 md:pt-16 md:pb-8">
      {/* Global Theme Toggle (Top Right) */}
      <div className="absolute top-4 right-4 md:top-6 md:right-4 z-50">
        <ThemeToggle />
      </div>

      {/* ─── Mobile Layout ──────────────────────────────── */}
        <div className="md:hidden flex flex-col gap-4 relative">
          {/* 1. Profile */}
          <Profile />
          <SubscribeSection variant="default" />
          {/* 2. Search */}
          <SearchBar />
          {/* 3. Categories (horizontal scroll) */}
          <CategoryList categories={categories} />
        </div>

        {/* ─── Desktop Layout (3-column grid) ────────────── */}
        <div className="flex flex-col gap-4 md:grid md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8">
          {/* Left: Category Sidebar */}
          <aside className="hidden md:block sticky top-8 self-start">
            <SearchBar />
            <div className="mt-4">
              <CategoryList categories={categories} />
            </div>
          </aside>

          {/* Center: Main Feed */}
          <main className="min-w-0">{children}</main>

          {/* Right: Profile Sidebar */}
          <aside className="hidden md:block sticky top-8 self-start">
            <Profile />
            <div className="mt-4">
              <SubscribeSection variant="default" />
            </div>
          </aside>
        </div>
      </div>
  );
}
```
**Mobile branch (`md:hidden ...`, lines 27-38): must stay untouched** — no `SidebarShell`, no toggle, no `data-*` attribute reference. D-08/SIDE-08 depend on this branch never referencing `--sidebar-width`/`--profile-width`.

**Desktop grid line to modify (line 41):** `md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8` stays as the Tailwind arbitrary-value class consumed by the CSS from `globals.css`'s new `@property` block — **zero change needed to this line itself** (per RESEARCH.md: "This requires zero changes to the Tailwind arbitrary-value class already in `Layout.tsx:41`"). The change is: this grid `<div>` needs a class hook (e.g. `sidebar-grid`, referenced by the new CSS transition rule) added to it, and the two `<aside>` elements (lines 43, 54) each need `min-w-0 overflow-hidden` appended to their existing `className`.

**Server Component constraint (must be preserved verbatim):** this file has no `"use client"` directive today and must keep none. The refactor replaces the two `<aside>...</aside>` blocks + the `<main>` with a call to `<SidebarShell leftSlot={...} rightSlot={...}>{children}</SidebarShell>`, where `leftSlot`/`rightSlot` are built by this same Server Component exactly as the JSX above already does (`<SearchBar/><CategoryList .../>` and `<Profile/><SubscribeSection .../>`), then handed down as already-rendered `ReactNode` — this is the `subscribeSlot` pattern (see `SidebarShell` section above) applied to the whole panel, not just the subscribe form.

**`pt-16` removal (line 20):** per UI-SPEC's Positioning Contract, this exists solely to reserve room for the currently-`absolute` `ThemeToggle` (line 22) and must be removed once the toggle row becomes `sticky`/in-flow.

---

### Client components already inside the panels — contrast set (no change needed, confirm boundary)

`apps/web/src/components/SearchBar.tsx` (first 5 lines) — already `"use client"`:
```tsx
"use client";

import { Search as SearchIcon } from "lucide-react";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
```

`apps/web/src/components/CategoryList.tsx` (first 5 lines) — already `"use client"`:
```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONFIG } from "@/site.config";
```

**Contrast:** `Profile.tsx` and `apps/web/src/components/subscribe/SubscribeSection.tsx` are Server Components today and **must stay Server Components** — do not add `"use client"` to either. `SearchBar`/`CategoryList` need zero boundary change; they already live correctly inside `leftSlot`/`rightSlot`'s server-constructed tree and will continue rendering fine as children of a client `SidebarShell` (a Server Component's client-descendant CAN itself be `"use client"` — the constraint is only that `SidebarShell` never *imports* `SubscribeSection`, not that everything under it must be server-only).

---

## Shared Patterns

### `aria-label === title` accessible-name convention
**Source:** `ThemeToggle.tsx:40-41`
**Apply to:** `SidebarToggleLeft.tsx`, `SidebarToggleRight.tsx` — both must pass the identical string to `aria-label` and `title`, per D-13/A11Y-05 and UI-SPEC's Copywriting Contract (final locked strings already specified there).

### Mounted-guard placeholder to avoid hydration-mismatch flash
**Source:** `ThemeToggle.tsx:16-32`
**Apply to:** both new toggles — but per UI-SPEC Component Contract 1's note, because the pre-hydration script has already corrected `<html>`'s `data-sidebar-*` attributes before paint, the placeholder window here is only as long as it takes React to hydrate, not until a client-side read resolves (unlike `ThemeToggle`, which has no pre-hydration script and must wait a full `setTimeout(0)` tick).

### Server-renders-slot, client-receives-ReactNode boundary (D-06 stop-ship mechanism)
**Source:** `apps/web/src/app/post/[id]/page.tsx` (`subscribeSlot` construction) + `apps/web/src/templates/terminal/PostPage.tsx` (consumption + explanatory comment)
**Apply to:** `Layout.tsx` → `SidebarShell` (`leftSlot`/`rightSlot`). This is the single most load-bearing pattern in this phase — copy both the code shape AND the explanatory-comment convention, since the comment is what makes the constraint legible to the next person editing the file.

### Plain inline `<script dangerouslySetInnerHTML>` for pre-hydration state correction
**Source:** `node_modules/next-themes/dist/index.js` (installed package, read directly — see excerpt above)
**Apply to:** `app/layout.tsx`'s new sidebar-state script. Do NOT use `next/script strategy="beforeInteractive"` (RESEARCH.md's explicit rejection, backed by this repo's own working precedent using the plain-script technique instead).

### CSS custom-property override scoped by `<html>` attribute, registered via `@property` for animatability
**Source:** `globals.css:41-44` (`:root` layout vars, un-duplicated across `.dark`) + RESEARCH.md's resolved `@property` mechanism
**Apply to:** the new `--sidebar-width`/`--profile-width` override rules — reuses this repo's existing "declare once under `:root`, consume via `var()` in a Tailwind arbitrary-value class" idiom, extended with `@property` registration (new to this repo, no prior usage — first `@property` block in `globals.css`).

### `min-w-0` to defeat CSS Grid's intrinsic auto-minimum-size
**Source:** `Layout.tsx:51` (`<main className="min-w-0">`)
**Apply to:** both `<aside>` elements (lines 43, 54) — add `min-w-0 overflow-hidden` alongside the existing `sticky top-8 self-start`, for the identical reason `<main>` already needed `min-w-0`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/web/src/lib/sidebar.ts` | utility | transform | No prior module in this repo is designed to be imported by both a server-rendered inline script (via `.toString()` stringification) and a client component's runtime logic. `site.config.ts` is the nearest structural sibling (plain-literal-exports, safe for client import) but has no parse-function precedent. Planner/executor should follow RESEARCH.md's Code Example 2/3 directly rather than a codebase analog for this file's internal logic. |
| The sidebar state machine itself (tri-state `null\|true\|false` + `matchMedia` listener + focus-rescue + `inert` sequencing, inside `SidebarShell.tsx`) | client logic | event-driven | No component in this repo owns a comparably shaped multi-source (localStorage + matchMedia + click) tri-state today. `ThemeProvider`/`next-themes` is the nearest sibling in spirit (also drives `<html>` attributes from persisted+system state) but delegates all of that logic to the library; here it must be hand-rolled per D-07. Follow RESEARCH.md's Architecture Patterns §"System Architecture Diagram" and §"Focus & Inert Sequencing" directly. |

## Metadata

**Analog search scope:** `apps/web/src/components/`, `apps/web/src/templates/default/`, `apps/web/src/templates/terminal/`, `apps/web/src/app/`, `apps/web/src/lib/`, `apps/web/src/site.config.ts`, `node_modules/next-themes/dist/index.js`
**Files scanned:** 12 (8 fully read/excerpted above, plus `SearchBar.tsx`/`CategoryList.tsx` head-excerpts, plus `ThemeProvider.tsx`, plus the installed `next-themes` bundle)
**Pattern extraction date:** 2026-08-12
