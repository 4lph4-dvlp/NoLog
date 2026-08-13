# Phase 10: Collapsible Sidebars & Reading Width - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-12
**Phase:** 10-collapsible-sidebars-reading-width
**Areas discussed:** Reclaimed reading width, Toggle button placement, Auto-collapse threshold criterion, Avatar toggle cue and wording

**Gray areas offered but excluded from selection** (already locked upstream, not re-asked): the tri-state
state model (REQUIREMENTS.md D-02), push-vs-overlay (D-04), the Server-Component boundary for `Layout.tsx`
(D-06), no-new-dependencies (D-07), the A+B+C+D composed architecture (ROADMAP), the hamburger/avatar
affordance pairing (SIDE-01/02), mobile-layout untouched (SIDE-08), and the `terminal` template exclusion.

---

## Reclaimed reading width

### Q1 — How does the content column absorb the freed space?

| Option | Description | Selected |
|--------|-------------|----------|
| Reclaim everything unconditionally | Content takes the whole freed width (1304px at a 1400px viewport). Simplest, most literal reading of SIDE-04, but post prose lines get very long | |
| Cap post prose only | Grid pages (home/category/search) reclaim everything; post detail gets a readability cap and the rest becomes margin | ✓ |
| One cap site-wide | Same cap everywhere, slack becomes side margin. Consistent, but a short cap risks making SIDE-04 invisible | |

**User's choice:** Cap post prose only
**Notes:** `Layout.tsx` is shared by grid pages and the post page, so the cap has to be a per-surface decision rather than a layout-level one.

### Q2 — What is the prose cap? (current post content width is 864px at 1400px)

| Option | Description | Selected |
|--------|-------------|----------|
| 1100px — cap and target | 864 → 1100 is a visible +236px, so SIDE-04 stays true in substance; still inside a comfortable line length | ✓ |
| 1000px — conservative | 864 → 1000, +136px. Visible, but one-side-collapsed already hits the cap, so the both-collapsed step disappears | |
| No cap after all | Reverts Q1 | |

**User's choice:** 1100px
**Notes:** The arithmetic was surfaced explicitly before the choice — a 900px-class cap would have satisfied SIDE-04's wording while delivering only 36px of widening.

### Q3 — Where does the capped prose sit inside the widened `<main>`?

| Option | Description | Selected |
|--------|-------------|----------|
| Centred in main (`mx-auto`) | Leftover width splits into equal side margins; matches the grid pages' alignment habit | ✓ |
| Column axis fixed, slack all to the right | Prose left edge never moves, but produces a lopsided right-hand void | |
| Centred against the viewport | Most visually natural, but needs to escape the grid track — most fragile CSS, with sticky-aside interaction risk | |

**User's choice:** Centred in main
**Notes:** Accepted consequence — collapsing one side shifts the prose block slightly toward the collapsed side.

### Q4 — Is the 32px grid gap on the collapsed side reclaimed?

| Option | Description | Selected |
|--------|-------------|----------|
| Reclaim — gap to 0 | Grid-page content reaches the full 1368px container width; more dramatic toggle, one more animated property | |
| Keep — leave the 32px margin | Content never butts the container edge; fewer animated properties (less PITFALLS-10 exposure); prose is capped anyway so it changes nothing there | ✓ |

**User's choice:** Keep
**Notes:** Sets the both-collapsed grid-page content width at 1304px, not 1368px.

---

## Toggle button placement

### Q1 — Where do the two toggles live?

| Option | Description | Selected |
|--------|-------------|----------|
| Top corners, ThemeToggle shifts inward | Hamburger top-left, avatar top-right, ThemeToggle moves left of the avatar. Each toggle on the same edge as its sidebar | ✓ |
| Group all three at top-right | Single control bar, easy to manage, but puts the left sidebar's control on the right edge | |
| Inline at the top of each sidebar | Natural placement, but a collapsed 0px `<aside>` takes its own button with it — no way back. Not viable | |

**User's choice:** Top corners, ThemeToggle shifts inward
**Notes:** A real collision, not hypothetical — `Layout.tsx:22` already pins ThemeToggle at `top-4 right-4`.

### Q2 — Do the toggles stay visible while scrolling?

| Option | Description | Selected |
|--------|-------------|----------|
| Pin both toggles | Matches the `sticky top-8` asides; a reader deep in a long post can still collapse a visible sidebar | ✓ |
| Pin all three as a top bar | Most consistent, but rewrites existing ThemeToggle markup and adds a permanent top-edge fixture | |
| Leave non-pinned | Smallest diff, no z-index/sticky interaction, but the collapse control scrolls away while the sidebar stays | |

**User's choice:** Pin both toggles
**Notes:** Whether ThemeToggle joins the pinned container was left to planning.

### Q3 — Does the hamburger icon change with state?

| Option | Description | Selected |
|--------|-------------|----------|
| Always the hamburger glyph | State via `aria-expanded`, button background and tooltip. Keeps SIDE-01 literally true; avoids X reading as "close a modal" in a push layout | ✓ |
| Swap ≡ ↔ X | Follows ThemeToggle's Sun/Moon icon-swap precedent, instantly legible, but X implies overlay dismissal | |
| Swap ≡ ↔ chevron («/») | Most accurate to push semantics and matches IDE conventions, but spends budget on a second glyph and pairs oddly with the avatar toggle | |

**User's choice:** Always the hamburger glyph
**Notes:** Deliberately declines the ThemeToggle icon-swap precedent; the precedent was raised and considered.

---

## Auto-collapse threshold criterion

### Q1 — What is the narrowest acceptable content width with both sidebars expanded?

| Option | Description | Selected |
|--------|-------------|----------|
| 744px → confirms 1280px | Collapse below 1280px. 1280/1440 laptops start expanded; 1024/1152 start collapsed. Derived from this layout's own pixel budget (D-03) | ✓ |
| 830px → raises to 1366px | Wide content by default on common laptops, but most visitors first see a sidebar-less page, hiding search/categories | |
| 616px → lowers to 1152px | Maximally preserves the sidebars; auto-collapse only intervenes on genuinely narrow windows, but 1024-class laptops keep a 488px column | |

**User's choice:** 744px, confirming 1280px
**Notes:** The measurement obligation from REQUIREMENTS.md D-03 stays with the planner — this answer supplies the criterion the measurement is judged against, not a substitute for it.

### Q2 — What happens when an explicitly-expanded side meets a very narrow window?

| Option | Description | Selected |
|--------|-------------|----------|
| D-02 to the letter — preference wins absolutely | An 800px window keeps the expanded side and a ~264px content column. No resize-fights-the-user failure mode possible | ✓ |
| Hard floor forces collapse below some width | Prevents an absurdly narrow layout, but adds an exception to D-02 and a branch to the state machine | |

**User's choice:** D-02 to the letter
**Notes:** The narrow column is the reader's own choice. Revisit only alongside SIDE-F01 (reset-to-auto) if real complaints appear.

### Q3 — Does resize-driven auto-collapse animate?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-collapse instant, click-only transition | Dragging a window edge doesn't produce a whipping sidebar; the animation reads as a consequence of the click | ✓ |
| Both paths animate | Simpler, no branch, but the sidebar appears to lag behind the cursor during a drag-resize | |

**User's choice:** Auto-collapse instant, click-only transition
**Notes:** `globals.css:141-147`'s existing `html.transition-colors` gate is the idiom to reuse. Composes with, not replaces, A11Y-04's `prefers-reduced-motion` handling.

---

## Avatar toggle cue and wording

### Q1 — What marks the avatar as a toggle rather than an account button?

| Option | Description | Selected |
|--------|-------------|----------|
| Small eye/eye-off badge overlay | Says show/hide literally; clearest intent, but a badge on a ~40px button must shrink to near-illegibility | |
| Emphasised accent ring + hover state | Extends the Profile avatar's existing `border-2` treatment, legible at size; on its own conveys "control" more than "show/hide" | ✓ |
| Ring + badge together | Most certainly satisfies SIDE-09, but two ornaments on one small element | |

**User's choice:** Emphasised accent ring + hover state
**Notes:** SIDE-09 permits "badge or ring"; this settles it as the ring.

### Q2 — What language for the accessible names and tooltips?

| Option | Description | Selected |
|--------|-------------|----------|
| English, following ThemeToggle | Same string in `aria-label` and `title` (`ThemeToggle.tsx:40-41`); no template-wide default-language question opened | ✓ |
| Korean | Direct for this deployment's readers, but mixes languages against the existing English toggle and makes Korean the fork template's default | |
| Add strings to site.config | Follows `CategoryList`'s `isKo` branch; most forker-friendly but drags a wider i18n decision into this phase | |

**User's choice:** English, following ThemeToggle
**Notes:** Every reader-facing string this repo ships today is unlocalised English. A11Y-05 still requires the name be distinct from the Profile avatar's `alt` (`profile.name`, i.e. `"4lph4"`).

### Q3 — What if the avatar image is missing or fails to load?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to a lucide icon | Button stays operable; mirrors Phase 9's IMG-04 icon-fallback pattern; free here since the toggle is already a Client Component | ✓ |
| Out of scope for this phase | Smallest scope — the avatar is the forker's asset — but risks shipping an invisible button | |

**User's choice:** Fall back to a lucide icon
**Notes:** `CONFIG.profile.avatarUrl` is `/avatar.png`, a local file each fork replaces, so this is a realistic forker-facing failure rather than a hypothetical.

---

## Claude's Discretion

Nothing was answered with "you decide". The following were explicitly left to planning as part of otherwise
settled decisions:

- Component names and file layout under `components/layout/`, and where the client boundary sits inside the wrapper
- The two `data-*` attribute names on `<html>` and their value vocabulary
- Specific `lucide-react` glyphs and their sizes
- Transition duration/easing and whether it reuses `--transition-base`
- `localStorage` key names and stored value shape
- Exact tooltip/`aria-label` strings, within the action-phrased English constraint
- Whether ThemeToggle joins the pinned container
- Whether PITFALLS 10 is answered by `@property` registration or literal per-state `grid-template-columns`

## Deferred Ideas

- A search entry point that survives collapse (a collapsed-state search icon, or a keyboard shortcut) — the
  natural answer to the accepted consequence that collapsing the left side hides search, but any
  "something stays visible when collapsed" design is SIDE-F02's icon rail, deferred to v2
- Reset-to-auto affordance — SIDE-F01, v2; its absence is why D-10 has no escape hatch
- A hard floor overriding an explicit expand preference — considered and declined; revisit with SIDE-F01
- A site-wide reading-width cap covering the grid pages — considered and declined
- Localising the toggle strings via `CONFIG.site.locale` — declined; opens a template-wide i18n decision
- `terminal` template parity for collapsible sidebars — TMPL-F01, out of scope this milestone
