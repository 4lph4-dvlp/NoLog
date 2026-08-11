# Phase 10: Collapsible Sidebars & Reading Width - Research

**Researched:** 2026-08-12
**Domain:** Next.js 16 App Router client/server boundary design, CSS Grid animation, ARIA disclosure pattern, pre-hydration script mechanics
**Confidence:** HIGH (every code claim below was read directly from this repo this session; the two mechanism questions with real ecosystem uncertainty — pre-hydration script placement, `@property`/grid animation — were cross-checked against 2+ independent web sources and, for the script mechanism, against this exact repo's own installed `next-themes` bundle)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inherited locks — restated, not re-litigated** (canonical text in `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` §"Phase 10"):
- **D-02 — state model.** Per-side state is `null | true | false`. While `null`, the panel follows the viewport threshold on every resize. The first toggle click writes an explicit preference that viewport changes no longer override. Only the explicit preference is persisted to `localStorage` — never the transient auto-state.
- **D-04 — push, not overlay.** Collapsing a side returns its width to the centre column.
- **D-06 — `templates/default/Layout.tsx` stays a Server Component.** Client state arrives via a client wrapper receiving server-rendered content as children/slot props. Stop-ship: no `NEXT_PUBLIC_RESEND_*` variable may appear anywhere in the diff.
- **D-07 — no new npm dependencies, no new infrastructure.**
- **Architecture is A+B+C+D composed** (`research/ARCHITECTURE.md` §3): client wrapper receiving server-rendered slots, `data-*` attributes on `<html>`, CSS custom-property overrides, and a blocking pre-hydration script alongside the existing `next-themes` setup.
- **SIDE-01/SIDE-02 — affordances are fixed:** hamburger (three-line) left, circular profile-image button right.

**Reclaimed reading width**
- **D-01:** Grid pages (home/category/search) reclaim everything; only post-detail prose is capped.
- **D-02 (width):** Prose cap is 1100px.
- **D-03 (centring):** Capped prose is centred inside `<main>` (`mx-auto`), not left-anchored.
- **D-04 (gap):** The 32px grid `gap` on a collapsed side stays; only the track width goes to zero. Both-sides-collapsed content column is **1304px**, not 1368px.

**Toggle placement and behaviour**
- **D-05:** Toggles sit at top corners, one per side; `ThemeToggle` moves inward, immediately left of the avatar toggle.
- **D-06 (toggles):** Both sidebar toggles stay visible while scrolling (sticky/fixed) — the two `<aside>`s are already `sticky top-8 self-start`.
- **D-07 (icon):** The hamburger icon never changes shape. State lives in `aria-expanded`, background/hover treatment, and tooltip wording — not a glyph swap.
- **D-08:** Neither toggle renders below `md` (768px).

**Auto-collapse threshold**
- **D-09:** Acceptance criterion for the D-03 measurement is a **744px minimum content width** with both sidebars expanded; 1280px is the viewport that produces it. The measurement is owed by planning (now supplied — see Code Context below).
- **D-10:** An explicit preference wins absolutely — no hard floor overrides it. No exception branch in the state machine.
- **D-11:** Resize-driven auto-collapse is instant; only a toggle click animates. Reusable shape (not reusable wiring — see Landmines): `globals.css:141-147`'s `html.transition-colors` idiom.

**Avatar toggle cue and wording**
- **D-12:** Visual cue is an emphasised `accent` ring plus hover state, extending `Profile.tsx:65`'s `border-2 border-border` treatment.
- **D-13:** Accessible names/tooltips in English, following `ThemeToggle.tsx:40-41`'s exact `aria-label`===`title` pattern. Action-phrased and stateful (e.g. "Show profile sidebar"). Distinct from the Profile card's own avatar `alt` (`profile.name`, i.e. `"4lph4"`).
- **D-14:** If the avatar image fails to load, fall back to a `lucide-react` icon inside the same circular button.

### Claude's Discretion
- Component names/file layout under `apps/web/src/components/layout/`, and where the client boundary is drawn inside the wrapper.
- The two `data-*` attribute names on `<html>` and their value vocabulary.
- Which `lucide-react` glyphs are used (hamburger, avatar fallback) and their pixel sizes.
- Transition duration/easing — reuse `--transition-base` (200ms ease) or a new token.
- `localStorage` key names and stored value shape.
- Exact final tooltip/`aria-label` strings, within D-13's constraint.
- Whether `ThemeToggle` joins the pinned container or stays independently positioned (D-06).
- Whether PITFALLS 10 is answered by `@property` registration or literal per-state `grid-template-columns` values.

### Deferred Ideas (OUT OF SCOPE)
- A search entry point that survives left-side collapse (SIDE-F02, v2) — accepted consequence, not a gap to fix here.
- Reset-to-auto affordance (SIDE-F01, v2).
- A hard floor overriding an explicit expand preference on narrow windows (declined as D-10).
- A site-wide reading-width cap covering the grid pages (declined as D-01).
- Localising the toggle strings via `CONFIG.site.locale` (declined as D-13).
- `terminal` template parity (TMPL-F01, out of scope this milestone).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIDE-01 | Hamburger toggle collapses/expands left sidebar | Architecture Patterns §Toggle Buttons; Code Examples §Toggle Button Skeleton |
| SIDE-02 | Circular avatar toggle collapses/expands right sidebar | Same, plus D-14 fallback icon (Pitfalls §New-1) |
| SIDE-03 | Independent per-side collapse | State model (Persistence Shape); one client wrapper owns two independent tri-states |
| SIDE-04 | Content column visibly widens | `@property` + grid-template-columns (Architecture Patterns §CSS Mechanism); measured widths in Code Context |
| SIDE-05 | Auto-collapse follows viewport live pre-toggle | `matchMedia` listener pattern (Code Examples §2) |
| SIDE-06 | Explicit choice persists, survives resize | Persistence Shape (tri-state, allowlisted parse) |
| SIDE-07 | No wrong-state flash on first paint | Pre-Hydration Script mechanism (Open Question 1, resolved) |
| SIDE-08 | No effect on `<768px` mobile | Structural: mobile branch never references `--sidebar-width`/`--profile-width` (verified `Layout.tsx:27-38`) |
| SIDE-09 | Avatar toggle visual cue | D-12 (locked) + Code Examples §Toggle Button Skeleton |
| SIDE-10 | Subscribe form regression guard | Pitfall 8 (existing) restated; `subscribeSlot` precedent (Architecture Patterns §Server/Client Boundary) |
| A11Y-01 | `aria-expanded`/`aria-controls` | Code Examples §Toggle Button Skeleton; aria-controls target resolved (Open Question 5) |
| A11Y-02 | Removed from a11y tree + tab order | `inert` attribute mechanism (Open Question 4, resolved) |
| A11Y-03 | Focus rescue on collapse (click or resize) | Focus-check-before-inert sequencing (Architecture Patterns §Focus & Inert Sequencing) |
| A11Y-04 | `prefers-reduced-motion` disables transition | Click-origin-only gating composes with reduced-motion check (Open Question 3, resolved) |
| A11Y-05 | Action-phrased accessible name, distinct from avatar `alt`, matching `title` | D-13 (locked); Code Examples §Toggle Button Skeleton |
</phase_requirements>

## Summary

This phase composes four already-precedented mechanisms in this codebase (a client-wrapper-around-server-slots boundary, `<html>` attribute-driven CSS, a pre-hydration script, and a `mounted`-guard-style toggle button) into one new feature. Nothing here requires a new library. The two genuinely open engineering questions — how to make a Tailwind-arbitrary-value `grid-template-columns` animate smoothly, and how to inject a script that reliably beats first paint in Next 16 App Router — both resolve cleanly: `@property` registration (Baseline since July 2024, safe by 2026) fixes the animation, and reading this repo's own installed `next-themes` bundle shows the working technique is a **plain inline `<script dangerouslySetInnerHTML>` rendered in JSX**, not `next/script strategy="beforeInteractive"` (which real-world reports say does not reliably block hydration/paint in App Router).

Three findings in this research are corrections to what the phase's own canonical references assert, each verified by reading files directly rather than trusting the prior doc: (1) `globals.css:141-147`'s `html.transition-colors` class is **never toggled by any code in this repo** — it is CSS shape only, not working wiring, so D-11's "reusable asset" claim needs re-scoping to "reusable idiom to replicate," not "hook into"; (2) the two `<aside>` elements lack `min-w-0`/`overflow-hidden` today, which — unlike `<main>`, which already has `min-w-0` at `Layout.tsx:51` for exactly this reason — means a CSS Grid item's intrinsic auto-minimum-size will resist collapsing to a true 0px track once real content (search input, category chips, avatar, subscribe form) sits inside it; (3) copying `ThemeToggle`'s existing `position: absolute` pattern for the two new toggles will **not** satisfy D-06's "stays visible while scrolling," because `absolute` scrolls away with the page — it needs `sticky` (matching the asides' own `sticky top-8`) or `fixed`.

The D-09 threshold measurement obligation is closed in this research, not merely derived: `next dev` was started and the real rendered content-column width was measured with `gstack /browse` at all four viewports. Measured values match the CONTEXT.md's arithmetic exactly (1024→488px, 1152→616px, 1280→744px, 1366→830px), confirming 1280px as final without qualification.

**Primary recommendation:** Compose the architecture exactly as ARCHITECTURE.md §3 specifies (client wrapper + `data-*` attributes + CSS custom properties + pre-hydration script), but implement the pre-hydration script as a plain inline `<script>` (next-themes' own technique, read directly from `node_modules/next-themes/dist/index.js`), register `--sidebar-width`/`--profile-width` via `@property` to fix the grid-animation pitfall, gate the CSS transition behind a short-lived opt-in class added only on click (never on resize, never under `prefers-reduced-motion`), and use `inert` — not `display:none` — as the accessibility-tree/tab-order removal mechanism so it can coexist with the width transition.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sidebar collapse state (tri-state, per side) | Browser/Client | — | Needs `useState`, `matchMedia`, `localStorage` — none exist server-side |
| First-paint-correct initial state | Browser/Client (pre-hydration script) | Frontend Server (SSR default) | SSR renders a deterministic default; a synchronous inline script corrects `<html>` attributes before paint, exactly as `next-themes` already does in this repo |
| Grid layout / column widths | Browser/Client (CSS, attribute-driven) | Frontend Server (renders the grid markup) | `Layout.tsx` (Server Component) emits the grid; the *values* driving column width are CSS custom properties read at paint time, controlled by `<html>` attributes set client-side |
| Subscribe form secret gate | Frontend Server (Server Component) | — | `SubscribeSection` must never enter client-bundled code (D-06, stop-ship) |
| Toggle button rendering + a11y wiring | Browser/Client | — | `aria-expanded`, `inert`, focus management are all runtime DOM operations |
| Threshold constant (1280px) | Browser/Client (both script and listener) | — | Must be a single shared value consumed by both the pre-hydration script and the `matchMedia` listener — no server involvement |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 [VERIFIED: apps/web/package.json] | App Router, Server/Client Component boundary | Already the project's framework; no alternative considered |
| React | 19.2.4 [VERIFIED: apps/web/package.json] | Component model, `useState`/`useEffect`/`useRef` for the client wrapper | Already installed |
| lucide-react | 1.14.0 [VERIFIED: node_modules/lucide-react/package.json] | Hamburger icon (`Menu`), avatar-fallback icon (`User`) | Already a dependency (D-07); both icon files confirmed present at `node_modules/lucide-react/dist/esm/icons/menu.mjs` and `.../user.mjs` |
| Tailwind CSS | 4.2.4 [VERIFIED: node_modules/tailwindcss/package.json] | Utility classes for the new toggle buttons and aside sizing fixes | Already installed; arbitrary-value syntax already used at `Layout.tsx:41` |
| next-themes | 0.4.6 [VERIFIED: node_modules/next-themes/package.json] | **Not consumed by new code** — its installed bundle is read directly in this research as the reference implementation for the pre-hydration script technique | Already installed for dark mode; this phase adds no new usage of it, only imitates its script-injection shape |

### Supporting
No new supporting libraries. Every mechanism this phase needs (pre-hydration script, `@property`, `inert`, `matchMedia`, `localStorage`) is a browser primitive with no framework dependency.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain inline `<script dangerouslySetInnerHTML>` for pre-hydration | `next/script strategy="beforeInteractive"` | Rejected — real-world reports (Next.js discussion #50772, issue #57660 context) say `beforeInteractive` scripts download before hydration but do **not** block hydration/paint the way a synchronous inline script does; this repo's own working `next-themes` precedent uses the plain-script technique, not `next/script` |
| `@property`-registered custom properties for animatable grid tracks | Literal per-state `grid-template-columns` values (PITFALLS.md option (b)) | `@property` is simpler to extend to two independently-collapsible sides (2 booleans = up to 4 live combinations); literal values would need 4 hand-written `grid-template-columns` strings instead of letting each custom property animate independently. `@property` is Baseline-available since July 2024 — safe for 2026 |
| `inert` for a11y-tree/tab-order removal | `display: none` / conditional unmount immediately on collapse | `display:none` kills the CSS transition outright (a transitioning property snaps if the box is removed from the render tree mid-transition); `inert` removes tab-order/a11y-tree membership without touching layout, so it can be applied the instant collapse starts and the visual shrink still plays |
| A single shared client wrapper owning both sides' state | React Context / two fully independent components | Two booleans-ish tri-states with no deep prop-drilling need (both toggle buttons and both `<aside>`s are siblings under one wrapper) — Context adds indirection with no payoff here; a single wrapper with two pieces of state is simpler and matches ARCHITECTURE.md §3's "SidebarShell" framing |

**Installation:** None. No new packages for this phase (D-07).

**Version verification:** All versions above were read directly from `package.json`/`node_modules` in this repo this session, not from training data or registry lookups — this phase adds no new dependency, so there is nothing to verify against the npm registry.

## Package Legitimacy Audit

**No new npm packages are introduced by this phase** (REQUIREMENTS.md D-07, hard constraint, restated in CONTEXT.md). The Package Legitimacy Gate protocol therefore has nothing to check. For completeness, the pre-existing packages this phase's new code will import are listed below, with their installed state confirmed by direct file read (not a registry query, since nothing is being installed):

| Package | Registry | Confirmed installed | Disposition |
|---------|----------|---------------------|-------------|
| lucide-react | npm | 1.14.0, `node_modules/lucide-react/package.json` [VERIFIED] | Already approved (v1.0) — reused, not newly added |
| next-themes | npm | 0.4.6, `node_modules/next-themes/package.json` [VERIFIED] | Already approved (v1.0) — reused only as a reference implementation, not imported by new code |
| next / react / tailwindcss | npm | see Standard Stack table | Already approved — project framework |

**Packages removed due to `[SLOP]` verdict:** none (nothing new to check).
**Packages flagged as suspicious `[SUS]`:** none.

## Architecture Patterns

### System Architecture Diagram

```
 Server render (Layout.tsx, unchanged Server Component)
   builds leftSlot = <SearchBar/> + <CategoryList/>
   builds rightSlot = <Profile/> + <SubscribeSection/>   ← secret gate stays server-side
        │
        ▼
 <SidebarShell leftSlot={...} rightSlot={...}>            (NEW client wrapper, "use client")
        │  renders the 3-col grid + two <aside> wrappers + two toggle <button>s
        │  owns: leftState, rightState  (each: null | true | false)
        ▼
 First paint ─────────────────────────────────────────────────────────────
   app/layout.tsx emits a plain inline <script dangerouslySetInnerHTML>   (NEW, next to ThemeProvider)
   BEFORE hydration reaches SidebarShell:
     reads localStorage["nolog:sidebar:left"/"right"] (strict allowlist parse)
     falls back to matchMedia(`(min-width: 1280px)`) if no explicit pref
     sets document.documentElement.dataset.sidebarLeft/Right = "expanded"|"collapsed"
        │
        ▼
 globals.css (MODIFIED): html[data-sidebar-left="collapsed"] { --sidebar-width: 0px }
   @property --sidebar-width { syntax: '<length>'; ... }   → makes the change animatable
   .sidebar-grid { grid-template-columns: var(--sidebar-width) 1fr var(--profile-width) }
        │
        ▼
 Hydration: SidebarShell's useState reads the SAME localStorage/matchMedia logic
   (no mismatch — both paths import one shared constant/parse function)
   attaches matchMedia listener for the null (auto) branch of each side
        │
        ▼
 User interaction ─────────────────────────────────────────────────────────
   Click toggle → (1) focus-rescue check → (2) inert set on collapsing <aside>
                → (3) add data-sidebar-transition="active" (skipped if reduced-motion)
                → (4) set leftState/rightState + localStorage.setItem
                → (5) on transitionend/timeout: remove data-sidebar-transition
   Resize crosses threshold (only while state is null) → set attribute directly,
                no transition class added → instant width change (D-11)
```

### Server/Client Boundary (D-06, restated with the concrete fix)

`Layout.tsx` stays a Server Component. It never imports the new client wrapper's *logic* into anything that also imports `SubscribeSection` as a raw import inside a `"use client"` file — it constructs `<SubscribeSection variant="default" />` itself (as it does today) and passes the **already-rendered element** into the new client wrapper as a prop/child, exactly matching `apps/web/src/app/post/[id]/page.tsx:150-161`'s `subscribeSlot` pattern (read directly this session). The new client wrapper (`SidebarShell` or similar) receives `leftSlot: ReactNode` / `rightSlot: ReactNode`, never a `Post`-shaped prop, and never an import path that resolves to `SubscribeSection.tsx`.

### CSS Mechanism for Pitfall 10 (grid-template-columns animation)

**Resolved: use `@property` registration**, not literal per-state values. `@property` reached Baseline (all three major engines) in July 2024 — by this project's 2026-08-12 research date that is over two years of universal support, and `grid-template-columns`/`grid-template-rows` animation itself is supported in all major browsers independent of `@property` [CITED: web.dev "@property: Next-gen CSS variables now with universal browser support", web.dev "CSS animated grid layouts"]. Concretely:

```css
/* globals.css — new block, alongside the existing :root layout vars at line 41-44 */
@property --sidebar-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 200px;
}
@property --profile-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 240px;
}
```

This requires zero changes to the Tailwind arbitrary-value class already in `Layout.tsx:41` (`md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)]`) — registering the custom property is what teaches the browser how to interpolate it; the utility class that consumes it is untouched.

### Focus & Inert Sequencing (A11Y-02, A11Y-03)

`inert` (not `display:none`, not `visibility:hidden`) is the correct primitive: an inert element and its descendants are removed from the tab order and the accessibility tree while remaining visually present and unaffected in terms of layout/paint [CITED: MDN "inert" global attribute, web.dev "The inert attribute"]. `display:none` also removes accessibility-tree membership but additionally removes the element from rendering entirely, which kills any in-flight CSS transition — the transitioning property snaps instead of animating [reasoning cross-checked against Cloud Four "Transitioning Hidden Elements" and MDN "Using CSS transitions"].

Required sequencing for a click-triggered collapse (order matters):
1. **Synchronously**, before anything else: check whether `document.activeElement` is a descendant of the collapsing `<aside>`. If so, call `.focus()` on the toggle button that triggered the collapse.
2. **Synchronously**, same tick: set the `inert` attribute on the collapsing `<aside>`. This immediately satisfies A11Y-02 (unreachable by Tab, absent from the a11y tree) regardless of how long the visual transition takes.
3. Add the transition-enabling class/attribute (skipped if `prefers-reduced-motion: reduce` matches), then flip the collapse state (drives the CSS custom property change → the grid track animates).
4. On `transitionend` (filtered to `grid-template-columns`) or a timeout fallback (transition duration + ~50ms buffer), remove the transition-enabling class/attribute. Optionally also apply `hidden`/conditional non-render at this point for paint-cost cleanup — **not required** for A11Y-02 compliance, since `inert` alone already satisfies it, but reasonable once the box is visually zero-width anyway.

For a **resize-driven** collapse (state is still `null`, matchMedia crosses the threshold): perform steps 1 and 2 identically (focus rescue and `inert` still apply — A11Y-03 explicitly requires this to fire for resize too), but skip step 3 entirely (no transition class), so the width change is instant, matching D-11.

### `aria-controls` Target and the Nested-`<aside>` Problem (Open Question 5, resolved)

`Profile.tsx:63` renders its own `<aside className="flex flex-col items-center text-center gap-4 p-6 bg-surface border border-border rounded-2xl shadow-sm transition-colors">` [VERIFIED: apps/web/src/components/Profile.tsx:63], nested inside `Layout.tsx:54`'s outer right `<aside>`. Two landmark-role elements nested inside each other for the same visual region is the smell — assistive tech would surface two "complementary" regions where there is conceptually one collapsible panel.

**Recommendation:** change `Profile.tsx:63`'s root element from `<aside>` to `<div>` (identical className, zero visual change — a `<div>` accepts the same Tailwind classes). The OUTER wrapper that `Layout.tsx`/the new client wrapper renders becomes the sole landmark for that side, and it is the element that receives the collapsible `id` (`aria-controls` target) and the `inert` attribute. This makes "the panel" unambiguous: one element, one id, one landmark, matching the left side's own shape (the left `<aside>` at `Layout.tsx:43` has no nested landmark today).

### Toggle Positioning — D-06 Cannot Reuse `ThemeToggle`'s Current CSS Verbatim

`ThemeToggle` is rendered today at `Layout.tsx:22` inside `<div className="absolute top-4 right-4 md:top-6 md:right-4 z-50">` [VERIFIED: apps/web/src/templates/default/Layout.tsx:20-24, quoted: `<div className="absolute top-4 right-4 md:top-6 md:right-4 z-50">`]. `position: absolute` positions relative to the nearest `position: relative` ancestor (the outer wrapper div at line 20) but does **not** track scroll — it sits near the top of the page and scrolls away with everything else once the reader scrolls past it. D-06 requires both new toggles (and, per Claude's Discretion, possibly `ThemeToggle`) to **stay visible while scrolling**, which `position: absolute` does not provide. The two `<aside>`s already demonstrate the correct primitive for this exact requirement: `sticky top-8 self-start` [VERIFIED: apps/web/src/templates/default/Layout.tsx:43,54]. Recommend the same primitive (`position: sticky` with a `top-*` offset, anchored horizontally via `left-4`/`right-4` exactly as `ThemeToggle`'s wrapper does today) for the new toggle row, rather than copying `absolute` forward.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting/removing wrong theme flash before hydration | A custom `useEffect`-based "apply on mount" trick | The same synchronous inline-`<script>` technique `next-themes` already ships in this repo | Reading `node_modules/next-themes/dist/index.js` directly shows the exact, working, already-shipped-in-production pattern; reinventing it risks reproducing Pitfall 7 (hydration mismatch) instead of avoiding it |
| Making a CSS custom property animatable | A JS-driven `requestAnimationFrame` width tween, or duplicated literal `grid-template-columns` per state | Native `@property` registration | Zero JS needed, zero duplication across the 4 live left/right combinations, and it is now a browser-native, Baseline-available feature — no library required |
| Accessibility-tree removal + focus management for a collapsing panel | A custom focus-trap/tabindex-walking implementation | The native `inert` attribute + a synchronous `document.activeElement` containment check | `inert` is a single HTML global attribute that correctly removes both tab order and a11y-tree membership in one step; a hand-rolled tabindex-cycling implementation would need to replicate that exactly and is far more likely to leave an edge case (nested focusable elements, dynamically added content) unhandled |

**Key insight:** every mechanism this phase needs already has either a native browser primitive (`inert`, `@property`, `matchMedia`, `prefers-reduced-motion`) or an existing in-repo precedent (`next-themes`'s script, `ThemeToggle`'s `mounted` guard, `post/[id]/page.tsx`'s `subscribeSlot`). The engineering work is composition and correct sequencing, not new mechanism design.

## Common Pitfalls

### Pitfall 1 (existing, PITFALLS.md #7): localStorage-driven initial state causes hydration mismatch
**What goes wrong:** Reading `localStorage` directly inside a `useState()` initializer produces a server/client render mismatch.
**How to avoid:** Do not do this. Use the pre-hydration inline script (this phase's D-07/SIDE-07 mechanism) to set `<html>` attributes before paint, and have the client component's `useState` initializer read the SAME already-corrected `<html>` attribute (via `document.documentElement.dataset`) rather than re-reading `localStorage` independently — this also closes CONTEXT.md's own landmine #2 (two sources of truth drifting).

### Pitfall 2 (existing, PITFALLS.md #8): a `"use client"` boundary drawn too high swallows `SubscribeSection`'s gate
**How to avoid:** See Architecture Patterns §Server/Client Boundary above — never let a client-directive file import `SubscribeSection`; always pass it down as a pre-rendered element.

### Pitfall 3 (existing, PITFALLS.md #9): `transform`/`overflow` on an ancestor breaks `position: sticky`
**How to avoid:** Animate the grid container's `grid-template-columns` (via the `@property`-registered custom properties), never wrap the sticky `<aside>`s in a `transform`-animated container. Setting `overflow: hidden`/`clip` directly ON the sticky `<aside>` itself (needed for the new min-width fix below) is safe — sticky positioning is governed by the element's ANCESTOR chain's overflow, not its own [CITED: MDN "position: sticky" reference, cross-checked against the CSSWG discussion PITFALLS.md already cites]. Re-verify with the manual scroll test PITFALLS.md #9 already prescribes, since this is new usage of `overflow` in this exact layout.

### Pitfall 4 (existing, PITFALLS.md #10): grid-template-columns via unregistered custom property doesn't animate
**Resolved above** — use `@property`.

### Pitfall 5 (existing, PITFALLS.md #11): collapsing a panel while focus is inside it strands the user
**Resolved above** — see Architecture Patterns §Focus & Inert Sequencing; must fire for resize too, not just click (A11Y-03's explicit requirement).

### Pitfall 6 (NEW — found this session): CSS Grid's intrinsic auto-minimum-size will resist a true 0px collapse
**What goes wrong:** A CSS Grid item's default `min-width` is `auto`, which for a grid item means the browser will not let its track shrink below the item's *content's* intrinsic minimum size — not below `0`. `<main>` already carries `min-w-0` at `Layout.tsx:51` [VERIFIED: apps/web/src/templates/default/Layout.tsx:51, quoted: `<main className="min-w-0">{children}</main>`] specifically to escape this behavior. Neither `<aside>` (lines 43, 54) has an equivalent class today. Once the sidebar tracks are asked to collapse to `0px`, the same failure mode that `min-w-0` was added to `<main>` to prevent will apply to the two `<aside>`s: their content (a search input, category chip pills, the avatar, the subscribe form) has nonzero intrinsic width, so the track may refuse to fully collapse, or the content may overflow its 0px cell instead of disappearing cleanly.
**How to avoid:** Add `min-w-0 overflow-hidden` to both `<aside>` elements' existing `className` (alongside `sticky top-8 self-start`). `overflow: hidden` also independently helps here per the CSS sizing spec (non-`visible` overflow implies an automatic minimum size of `0`), but `min-w-0` is the explicit, already-precedented (via `<main>`) fix and should be added regardless.
**Warning signs:** the collapsed track visually settles at some nonzero width close to the content's natural size, not `0px`; or content visibly overflows the collapsed aside's boundary during the transition.

### Pitfall 7 (NEW — found this session): copying `ThemeToggle`'s `position: absolute` pattern will not satisfy D-06
**Resolved above** — see Architecture Patterns §Toggle Positioning. Use `sticky`, not `absolute`.

### Pitfall 8 (NEW — found this session): `globals.css:141-147`'s `html.transition-colors` class is dead CSS, not working wiring
**What goes wrong:** CONTEXT.md's D-11 cites this class as a "reusable asset" implying existing JS wiring can be hooked into. Direct inspection of every `.tsx`/`.ts` file in `apps/web/src` (grep for `classList`, `"transition-colors"`, `'transition-colors'`) and a `git log -S` search across the CSS file's whole history found **zero code that ever adds this class to `<html>`**. The rule exists in `globals.css` [VERIFIED: apps/web/src/app/globals.css:140-147, quoted: `/* Smooth theme transitions (applied after initial load) */\nhtml.transition-colors,\nhtml.transition-colors *,\nhtml.transition-colors *::before,\nhtml.transition-colors *::after {\n  transition: background-color var(--transition-base),\n    border-color var(--transition-base), color var(--transition-base) !important;\n}`] but is never triggered — `next-themes`' actual flash-prevention mechanism (`disableTransitionOnChange`, confirmed by reading `node_modules/next-themes/dist/index.js`) is a completely different, self-contained technique (a temporary `<style>` tag that disables all transitions, not a class that enables one).
**How to avoid:** Treat this class as a **shape to replicate**, not wiring to hook into. Build the actual add/remove logic fresh for the sidebar transition (see Open Question 3 resolution below), and do not assume theme-toggle behavior is affected either way — it uses its own unrelated mechanism.
**Warning signs:** a plan step that says "wire the sidebar transition into the existing `html.transition-colors` toggle" without also creating the add/remove logic, because there is no existing toggle to wire into.

## Code Examples

### 1. `@property` registration + attribute-scoped override (globals.css)
```css
/* Source: web.dev "@property" + this repo's existing :root layout vars pattern (globals.css:41-44) */
@property --sidebar-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 200px;
}
@property --profile-width {
  syntax: '<length>';
  inherits: true;
  initial-value: 240px;
}

html[data-sidebar-left="collapsed"]  { --sidebar-width: 0px; }
html[data-sidebar-right="collapsed"] { --profile-width: 0px; }

/* Transition is opt-in — only present while the click-origin class is active (D-11, A11Y-04) */
html[data-sidebar-transition="active"] .sidebar-grid {
  transition: grid-template-columns var(--transition-base);
}
```

### 2. Pre-hydration script shape (app/layout.tsx), modeled directly on the installed `next-themes` technique
```tsx
// Source: pattern read directly from node_modules/next-themes/dist/index.js (this repo, v0.4.6) —
// a plain <script> element rendered via createElement/JSX with dangerouslySetInnerHTML,
// NOT next/script. The function is stringified so it runs as a standalone IIFE with no
// closure over React internals, matching next-themes' own `(${I.toString()})(${params})` shape.
function initSidebarState(breakpointPx: number) {
  var root = document.documentElement;
  function readPref(key: string): boolean | null {
    try {
      var v = localStorage.getItem(key);
      return v === "true" ? true : v === "false" ? false : null;
    } catch (e) {
      return null;
    }
  }
  var isNarrow = window.matchMedia("(max-width: " + (breakpointPx - 1) + "px)").matches;
  ["left", "right"].forEach(function (side) {
    var pref = readPref("nolog:sidebar:" + side);
    var collapsed = pref === null ? isNarrow : pref;
    root.setAttribute("data-sidebar-" + side, collapsed ? "collapsed" : "expanded");
  });
}

// In app/layout.tsx's <body>, BEFORE <ThemeProvider> (so it runs at least as early as the
// already-proven next-themes script):
<script
  suppressHydrationWarning
  dangerouslySetInnerHTML={{
    __html: `(${initSidebarState.toString()})(${SIDEBAR_BREAKPOINT_PX})`,
  }}
/>
```
`SIDEBAR_BREAKPOINT_PX` must be imported from one shared constants module and used identically by the client wrapper's own `matchMedia` listener — never redefined as a second literal `1280` — closing CONTEXT.md's landmine #2.

### 3. Toggle button skeleton (A11Y-01, A11Y-05, D-07, D-13)
```tsx
// Source: pattern combines ThemeToggle.tsx's mounted-guard + aria-label/title convention
// with the W3C APG disclosure pattern's aria-expanded/aria-controls requirement.
<button
  type="button"
  aria-expanded={!collapsed}
  aria-controls="sidebar-left-panel"
  aria-label={collapsed ? "Show search and categories" : "Hide search and categories"}
  title={collapsed ? "Show search and categories" : "Hide search and categories"}
  className="sticky top-4 left-4 z-50 p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer"
  onClick={handleToggleLeft}
>
  <Menu className="w-[18px] h-[18px] text-text-secondary" />
</button>
```
The hamburger glyph (`Menu` from lucide-react) never swaps (D-07) — only `aria-expanded`, the label/title strings, and the button's own hover/ring treatment change.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `@property`-less CSS custom properties (opaque string interpolation) | `@property`-registered typed custom properties, animatable | Baseline across Chrome/Firefox/Safari since July 2024 [CITED: web.dev "@property: Next-gen CSS variables now with universal browser support"] | `grid-template-columns` driven by `var(--sidebar-width)` can now animate smoothly with zero JS, resolving PITFALLS.md #10 cleanly |
| Assuming `next/script strategy="beforeInteractive"` blocks first paint in App Router | Plain inline `<script dangerouslySetInnerHTML>` for anything that must run before paint | Ongoing across Next.js 13-16 (multiple GitHub discussions/issues, not tied to one release) [CITED: github.com/vercel/next.js discussions #50772, issue #57660] | This repo's own working `next-themes` precedent already uses the plain-script technique; the sidebar phase should follow it, not `next/script` |

**Deprecated/outdated:** none directly relevant — no library in this stack is being deprecated by this phase's work.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Setting `overflow: hidden`/`clip` directly on a `position: sticky` element does not affect that element's OWN sticky behavior (only an ancestor's overflow matters) | Architecture Patterns §Focus & Inert Sequencing; Pitfall 3 | If wrong, the two `<aside>`s could stop sticking once `overflow-hidden` is added for the min-width fix — caught immediately by the manual scroll test PITFALLS.md #9 already requires, so the blast radius is one failed manual check, not a silent ship |
| A2 | A `transitionend` listener filtered to `propertyName === 'grid-template-columns'` fires reliably enough (with a timeout fallback) to drive the "settle" callback (remove transition class, optionally hide) | Architecture Patterns §Focus & Inert Sequencing | If the event is flaky in some browser, the timeout fallback (matching `--transition-base` + buffer) covers it; worst case the transition-enabling class lingers slightly longer than needed, not a functional break |
| A3 | Two independent `localStorage` keys (`nolog:sidebar:left`/`nolog:sidebar:right`) each storing the literal string `"true"`/`"false"` is an adequate persistence shape | Code Examples §2 | Low risk — this is Claude's Discretion per CONTEXT.md, not a locked decision; any shape satisfying "per-side, only explicit preference persisted" works |

**All other claims in this research are either `[VERIFIED]` (read directly from this repo's files this session, or measured live via `next dev` + `gstack /browse`) or `[CITED]` (official/near-official docs: MDN, web.dev, W3C APG) — see Sources.**

## Open Questions

All seven questions posed in the phase's own research brief are resolved above. Restated with pointers:

1. **Pre-hydration script mechanics** — resolved: plain inline `<script dangerouslySetInnerHTML>`, not `next/script`. See Code Examples §2.
2. **`@property` vs literal per-state values** — resolved: `@property`. See Architecture Patterns §CSS Mechanism.
3. **Click-origin-only transition gating** — resolved: a short-lived `data-sidebar-transition="active"` attribute added synchronously on click (skipped under `prefers-reduced-motion`), removed on `transitionend`/timeout; resize path never adds it. See Code Examples §1 and Architecture Patterns §System Architecture Diagram.
4. **A11Y-02/A11Y-03 concrete mechanism** — resolved: `inert`, applied synchronously before the width change starts, with focus-rescue checked first. See Architecture Patterns §Focus & Inert Sequencing.
5. **`aria-controls` target with nested `<aside>`** — resolved: demote `Profile.tsx`'s own `<aside>` to a `<div>`; the outer collapsible wrapper is the sole landmark and `aria-controls` target. See Architecture Patterns §aria-controls Target.
6. **Threshold measurement procedure** — resolved and **executed this session** (not left for planning): see Code Context below for the real measured numbers.
7. **`localStorage` + tri-state shape, avoiding drift** — resolved: one shared constants/parse module imported by both the pre-hydration script (stringified in) and the client `matchMedia` listener. See Code Examples §2 and Pitfall 1.

No open questions remain that require further research before planning.

## Code Context — Measured, Not Just Derived (closes D-09's obligation)

`next dev` was started against this repo (`npm run dev` in `apps/web`, Next.js 16.2.4 with Turbopack, ready in 456ms) and the real rendered layout was measured with `gstack /browse` at the four viewports CONTEXT.md specifies. Method: navigate to `http://localhost:3000/`, read `document.querySelector('main').parentElement.children` (the three direct grid children: left `<aside>`, `<main>`, right `<aside>`) and their `getBoundingClientRect().width`, plus the computed `grid-template-columns` of the grid container.

| viewport | `<main>` width (measured) | left `<aside>` width | right `<aside>` width | `grid-template-columns` (computed) |
|---|---|---|---|---|
| 1024 | **488px** | 200px | 240px | `200px 488px 240px` |
| 1152 | **616px** | 200px | 240px | `200px 616px 240px` |
| 1280 | **744px** | 200px | 240px | `200px 744px 240px` |
| 1366 | **830px** | 200px | 240px | `200px 830px 240px` |

These four numbers match CONTEXT.md's derived arithmetic table **exactly** (488/616/744/830), including the 744px figure D-09 names as the exact minimum-content-width acceptance criterion at the 1280px threshold. **D-09's threshold is confirmed final with no adjustment** — real measurement equals the derived value at all four checkpoints, so there is no discrepancy of the kind 09-CONTEXT.md's four prior overturned-arithmetic premises warned about.

This measurement was taken against the *current, pre-Phase-10* layout (no collapse feature exists yet), so it verifies the "both sidebars expanded" baseline only — the "both collapsed → 1304px" figure in CONTEXT.md's D-04 remains derived arithmetic (200+240+2×32 track/gap removed from 1400-32-32), not yet independently measured, since there is no shipped code to measure it against. Recommend the plan's own verification step re-run this identical `gstack /browse` measurement procedure once the collapse CSS ships, to confirm the collapsed-state number the same way.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `next dev` (Turbopack) | Threshold measurement, manual verification of every SIDE-*/A11Y-* requirement | ✓ | Next.js 16.2.4 | — |
| `gstack /browse` (headless Chromium) | Threshold measurement, keyboard/focus manual tests, screenshot evidence | ✓ | confirmed ready this session | — |
| ESLint (`eslint-config-next/core-web-vitals`, includes `jsx-a11y`) | Catches structural a11y mistakes (missing labels, invalid `aria-*`) at lint time | ✓ | `apps/web/eslint.config.mjs` [VERIFIED] | Does not verify runtime `aria-expanded` correctness or focus behavior — those remain manual |
| A dedicated test framework | N/A — none exists, none may be added (project hard constraint) | ✗ | — | Source assertions + `next build` + manual `gstack /browse` verification (see Validation Architecture) |

**Missing dependencies with no fallback:** none — everything this phase needs is already present.
**Missing dependencies with fallback:** test framework (fallback: manual/browser verification, as every prior v1.1 phase has already done).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | none — project hard constraint, no test framework exists and none may be added (matches Phase 7-9 precedent) |
| Config file | none |
| Quick run command | `npm run lint --prefix apps/web` (ESLint incl. `jsx-a11y`) |
| Full suite command | `npm run build --prefix apps/web` (Next 16 build — typechecks, lints, and confirms every route still statically/ISR-builds) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SIDE-01/02/03 | Hamburger/avatar independently toggle their side | manual (browser) | `gstack /browse` click sequence + `snapshot -D` before/after | N/A — no test file, browser observation |
| SIDE-04 | Content column visibly widens | manual (browser) + source assertion | `gstack /browse` measurement (same procedure as Code Context above), re-run post-collapse | N/A |
| SIDE-05 | Auto-collapse follows resize pre-toggle | manual (browser) | `gstack /browse viewport` sweep across 1279px/1280px boundary, no prior click | N/A |
| SIDE-06 | Explicit choice survives resize/navigation | manual (browser) | click toggle, `gstack /browse storage`, resize, reload, re-check attribute | N/A |
| SIDE-07 | No wrong-state flash | manual (browser) — visual only, not reliably automatable | screen recording / repeated cold reload with a saved preference; console check for hydration warning | N/A |
| SIDE-08 | No mobile effect | source assertion + manual | grep confirms mobile branch (`Layout.tsx:27-38`) never references the two custom properties; `gstack /browse viewport 375x812` visual check | N/A |
| SIDE-09/D-12 | Avatar visual cue present | source assertion (Tailwind classes) + manual screenshot | `gstack /browse screenshot` | N/A |
| SIDE-10 | Subscribe form regression guard (stop-ship) | source assertion (grep) + manual | `grep -r "NEXT_PUBLIC_RESEND" apps/web/src` must return nothing; `next build` output inspected for `Layout.tsx`'s Server/Client marker; live form submit via `gstack /browse fill`+`click` | N/A |
| A11Y-01 | `aria-expanded`/`aria-controls` | lint (jsx-a11y, partial) + manual | `gstack /browse attrs` on the toggle button pre/post click | N/A |
| A11Y-02 | Removed from a11y tree + tab order | manual (browser) | `gstack /browse accessibility` diff + `press Tab` sequence confirming the collapsed panel is skipped | N/A |
| A11Y-03 | Focus rescue on collapse | manual (browser) | tab into panel, trigger collapse (click AND resize), confirm `document.activeElement` via `gstack /browse js` | N/A |
| A11Y-04 | `prefers-reduced-motion` disables transition | manual (browser) | `gstack /browse` with `emulateMedia`-equivalent (CDP) or OS-level toggle; confirm no `transitionend` fires / instant width change | N/A |
| A11Y-05 | Accessible name distinct from avatar `alt`, matching `title` | source assertion + manual | grep confirms the two strings differ from `profile.name`; `gstack /browse attrs` confirms `aria-label === title` | N/A |

### Sampling Rate
- **Per task commit:** `npm run lint --prefix apps/web`
- **Per wave merge:** `npm run build --prefix apps/web` + the manual `gstack /browse` battery above for whichever requirements that wave closes
- **Phase gate:** Full manual battery green (all 15 requirement rows) before `/gsd-verify-work`, per this project's established no-test-framework precedent (Phases 7-9)

### Wave 0 Gaps
None — no test file infrastructure is being introduced, matching the explicit project constraint. The "test type: manual (browser)" rows above are not a gap to close; they are the project's chosen and previously-used verification method.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched by this phase |
| V3 Session Management | no | No session/cookie changes |
| V4 Access Control | no | No access-control logic |
| V5 Input Validation | yes | The pre-hydration script and the client `matchMedia` listener both read `localStorage`, which is client-writable by the visitor themselves (or any same-origin script). Both readers must use a strict allowlist parse (`"true"` → `true`, `"false"` → `false`, anything else → `null`) and never interpolate the raw stored string into a template, attribute value, or `eval`-adjacent construct |
| V6 Cryptography | no | No cryptographic operation |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `localStorage` value flowing unsanitized into a DOM attribute/class name | Tampering | Strict allowlist parse (see V5 above) before ever using the value; never string-concatenate the raw value into an attribute |
| `"use client"` boundary widened to cover `SubscribeSection`, exposing `RESEND_API_KEY` as `undefined` (silent feature disable) or leaking it if "fixed" via a `NEXT_PUBLIC_*` rename | Information Disclosure / silent feature failure | Keep `Layout.tsx` a Server Component; pass `SubscribeSection`'s rendered output down as `children`/props, never as a direct import inside client-directive code (D-06, restated Pitfall 2 above) — this is this phase's one stop-ship item (ROADMAP SC#3) |
| Pre-hydration inline script string built by naive template interpolation of a value that could ever contain user input | Tampering (script injection) | This phase's script only interpolates a numeric constant (`SIDEBAR_BREAKPOINT_PX`) via `.toString()`-serialized function calls, mirroring `next-themes`' own technique exactly — no string value that could originate from an attacker is ever interpolated into the script body. If a future change needs to interpolate a string, follow `next-themes`' own escaping of `</script>`, `U+2028`, `U+2029` (confirmed present in the installed package's design, per its documented security hardening) |

## Sources

### Primary (HIGH confidence)
- Direct file reads, this repo, this session: `apps/web/src/templates/default/Layout.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/globals.css`, `apps/web/src/components/ThemeToggle.tsx`, `apps/web/src/components/ThemeProvider.tsx`, `apps/web/src/components/Profile.tsx`, `apps/web/src/components/subscribe/SubscribeSection.tsx`, `apps/web/src/app/post/[id]/page.tsx`, `apps/web/src/site.config.ts`, `apps/web/src/templates/default/PostPage.tsx`, `apps/web/package.json`, `node_modules/next-themes/dist/index.js`, `node_modules/next-themes/package.json`, `node_modules/tailwindcss/package.json`, `node_modules/lucide-react/package.json` and its `dist/esm/icons/` listing.
- Live measurement, this session: `next dev` (Turbopack, ready in 456ms) + `gstack /browse` at four viewports against `http://localhost:3000/` — see Code Context.
- `git log -S"transition-colors"` against this repo's history — confirms `html.transition-colors` has never had corresponding JS wiring since its introduction.

### Secondary (MEDIUM confidence — official/near-official docs, cross-checked)
- [MDN — inert HTML global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert)
- [web.dev — The inert attribute](https://web.dev/articles/inert)
- [web.dev — @property: Next-gen CSS variables now with universal browser support](https://web.dev/blog/at-property-baseline)
- [web.dev — CSS animated grid layouts](https://web.dev/articles/css-animated-grid-layouts)
- [caniuse — grid-template-columns animation support table](https://caniuse.com/mdn-css_properties_grid-template-columns_animation)
- [W3C WAI-ARIA APG — Accordion (Disclosure) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/)
- [MDN — aria-expanded reference](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded)
- [Next.js docs — Script component / beforeInteractive constraints](https://nextjs.org/docs/app/api-reference/components/script)
- [vercel/next.js Discussion #50772 — Custom script in `<head>` with app router](https://github.com/vercel/next.js/discussions/50772)
- [vercel/next.js Issue #57660 — beforeInteractive dynamic-routing error](https://github.com/vercel/next.js/issues/57660)
- [Cloud Four — Transitioning Hidden Elements](https://cloudfour.com/thinks/transitioning-hidden-elements/)

### Tertiary (LOW confidence)
- None used without cross-checking — all web-sourced claims above had at least one corroborating source or a direct in-repo verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; every version read directly from installed files
- Architecture: HIGH — the four composed mechanisms (client wrapper, `data-*` attributes, CSS custom properties, pre-hydration script) are all either already precedented in this exact repo or resolved against 2+ cross-checked sources
- Pitfalls: HIGH for the 5 restated existing pitfalls (already researched and confirmed against this repo's code); HIGH for the 3 newly-found pitfalls (all three verified by direct code inspection this session, not inferred)
- Threshold measurement (D-09): HIGH — live-measured this session via `next dev` + `gstack /browse`, not derived arithmetic

**Research date:** 2026-08-12
**Valid until:** 30 days (stable stack; the two ecosystem facts with any time-sensitivity — `@property` Baseline status and `next/script` App Router hydration-blocking behavior — are unlikely to regress, but re-check if this phase's planning slips past September 2026)
