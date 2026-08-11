# Phase 10: Collapsible Sidebars & Reading Width - Context

**Gathered:** 2026-08-12
**Status:** Ready for planning

<domain>
## Phase Boundary

On every `default`-template page, a reader can collapse and expand each sidebar independently — the left
(search + categories) via a hamburger button, the right (profile + subscribe) via a circular profile-image
button — and the article column reclaims the freed width. Before the reader has ever touched a toggle, both
sides follow the viewport threshold live; after the first click on a side, that side keeps the reader's
choice across navigation and return visits. The subscribe form still works for every configured forker, and
both toggles are fully operable by keyboard and screen reader.

Covers SIDE-01 … SIDE-10 and A11Y-01 … A11Y-05.

**Not in this phase:** the `terminal` template (out of scope for this milestone, TMPL-F01); the `< 768px`
mobile stacked layout, which has no sidebars and gains no toggle logic; an icon-rail third collapse state
(SIDE-F02, v2); drag-to-resize (SIDE-F03, v2); a reset-to-auto affordance (SIDE-F01, v2); and anything about
thumbnails or post-content rendering (Phases 7-9, complete).

</domain>

<decisions>
## Implementation Decisions

### Inherited locks — restated, not re-litigated

These were settled before this discussion. Listed so the planner does not have to chase them across
documents. Their canonical text lives in `.planning/REQUIREMENTS.md` "Locked Decisions" and
`.planning/ROADMAP.md` §"Phase 10".

- **REQUIREMENTS.md D-02 — the state model.** Per-side state is `null | true | false`. While `null` (the
  reader has never toggled that side) the panel follows the viewport threshold on every resize. The first
  toggle click on a side writes an explicit preference that viewport changes no longer override. **Only the
  explicit preference is persisted to `localStorage`** — never the transient auto-state.
- **REQUIREMENTS.md D-04 — push, not overlay.** Collapsing a side returns its width to the centre column.
- **REQUIREMENTS.md D-06 — `templates/default/Layout.tsx` stays a Server Component.** Client state arrives
  via a client wrapper receiving server-rendered content as children/slot props. This is ROADMAP SC#3's
  stop-ship criterion: no `NEXT_PUBLIC_RESEND_*` variable may appear anywhere in the diff.
- **REQUIREMENTS.md D-07 — no new npm dependencies, no new infrastructure.**
- **ROADMAP §Phase 10 — architecture is A+B+C+D composed, not a pick-one menu**
  (`research/ARCHITECTURE.md` §3): client wrapper receiving server-rendered slots, `data-*` attributes on
  `<html>`, CSS custom-property overrides, and a blocking pre-hydration script alongside the existing
  `next-themes` setup.
- **SIDE-01 / SIDE-02 — the two affordances are fixed:** hamburger (three-line) on the left, circular
  profile-image button on the right.

### Reclaimed reading width

- **D-01:** **The grid pages reclaim everything; only the post-detail prose is capped.** Home, category and
  search render card rows, which read fine at any width, so `<main>` there simply grows into the freed space.
  Post detail is prose, and an unbounded 1300px line length is a readability regression disguised as a
  feature. The cap is therefore a post-page concern, not a site-wide one. — **Reversibility:** reversible.
- **D-02:** **The prose cap is 1100px, and it is deliberately a reachable target, not a brake.** The
  arithmetic matters here and was checked before choosing: the post content column is **864px** today at a
  1400px viewport (see the width table in `<code_context>`). A 900px cap would have let both-sides-collapsed
  widen the prose by 36px, which fails SIDE-04's "visibly widens" in substance while passing it on paper. At
  1100px the reader gains a plainly visible +236px and the line length still stays inside a comfortable
  range. — **Reversibility:** reversible — one value in one place.
- **D-03:** **The capped prose is centred inside `<main>` (`mx-auto`), not left-anchored.** Leftover width
  splits into equal side margins. Collapsing only one side therefore shifts the prose block slightly toward
  the collapsed side, which was accepted in exchange for matching the alignment habit the grid pages already
  use. Rejected alternatives: pinning the column axis and dumping all slack on the right (reads as unbalanced
  dead space), and centring against the viewport rather than `<main>` (needs to escape the grid track, the
  most fragile CSS of the three, with sticky-aside interaction risk).
- **D-04:** **The 32px grid `gap` on a collapsed side stays.** Only the track width goes to zero. The
  collapsed side keeps a 32px margin so content never butts against the container edge, which also means one
  fewer property has to animate (less exposure to PITFALLS 10) — and the prose is capped at 1100px anyway, so
  the 32px would have bought the post page nothing. Consequence to state in the plan's own arithmetic: with
  both sides collapsed the grid pages' content column is **1304px**, not 1368px.

### Toggle button placement and behaviour

- **D-05:** **The two toggles sit at the top corners, one per side, and the existing `ThemeToggle` moves
  inward.** Hamburger top-left, avatar top-right, `ThemeToggle` immediately left of the avatar. Each toggle
  sits on the same edge as the sidebar it operates, so the spatial mapping is self-evident. This is a real
  collision, not a hypothetical: `templates/default/Layout.tsx:22` currently pins `ThemeToggle` at
  `absolute top-4 right-4 md:top-6 md:right-4 z-50`, exactly where the avatar toggle belongs. Rejected:
  grouping all three at top-right (puts the left sidebar's control on the right edge, defeating the mapping),
  and placing each toggle inline at the top of its own `<aside>` (a collapsed `<aside>` is 0px wide, so the
  button would vanish with the panel and leave no way back).
- **D-06:** **Both toggles stay visible while scrolling** (sticky/fixed), because the two `<aside>`s are
  `sticky top-8 self-start` and stay visible themselves. Leaving the toggles non-pinned would produce the
  specific irritation of a visible sidebar whose collapse control has already scrolled off the top of a long
  post. Whether `ThemeToggle` is folded into the same pinned container or left as-is is planning's call, but
  the two sidebar toggles must be pinned. — **Reversibility:** reversible.
- **D-07:** **The hamburger icon never changes shape.** It stays the three-line glyph in both states; state is
  carried by `aria-expanded`, the button's own background/hover treatment, and the tooltip wording. This keeps
  SIDE-01's literal "hamburger (three-line) button" true at all times, and avoids an X reading as "close a
  modal" in a layout that pushes rather than overlays. Note this **deliberately declines** the
  `ThemeToggle.tsx:43-47` Sun/Moon icon-swap precedent — the precedent exists and was considered.
- **D-08:** **Neither toggle renders below `md` (768px).** The mobile layout stacks Profile / Subscribe /
  Search / Categories and has nothing to collapse (SIDE-08), so a mobile toggle would control nothing. Follows
  the existing `hidden md:block` idiom already used on both `<aside>`s.

### Auto-collapse threshold

- **D-09:** **The acceptance criterion for REQUIREMENTS.md D-03's measurement is a 744px minimum content
  width, which confirms the provisional 1280px threshold as final.** D-03 left the threshold provisional
  pending a real measurement at 1024 / 1152 / 1280 / 1366; what it could not supply was the standard to judge
  the measurement against. That standard is now set: with both sidebars expanded, 744px is the narrowest
  content column this layout may present. 1280px is the viewport that produces it.

  **The planner still owes the measurement** — the number above is derived from the layout's own pixel budget
  (see `<code_context>`), and this milestone has overturned four plausible arithmetic-or-doc-derived premises
  by measurement already (see 09-CONTEXT.md D-08). Confirm the rendered content-column width at all four
  viewports; if the real value at 1280px lands materially below 744px, the threshold moves up rather than the
  criterion moving down. — **Reversibility:** reversible.

- **D-10:** **An explicit preference wins absolutely — no hard floor overrides it.** REQUIREMENTS.md D-02 is
  applied to the letter. A reader who explicitly expands a side and then shrinks the window to 800px keeps
  that side expanded and gets a ~264px content column. That is the reader's own choice, and adding a
  floor-override would reintroduce exactly the resize-fights-the-user failure mode D-02 exists to prevent
  (the GitLab issues D-02 cites). No exception branch in the state machine.
- **D-11:** **Resize-driven auto-collapse is instant; only a toggle click animates.** A `matchMedia` flip
  changes state with no transition, so dragging a window edge across the threshold does not produce a
  sidebar that visibly whips along behind the cursor. The transition then reads unambiguously as "the result
  of what I just clicked". This composes with A11Y-04 rather than replacing it: `prefers-reduced-motion:
  reduce` still removes the transition from the click path too.

  **Reusable asset for this:** `globals.css:141-147` already implements exactly this "enable transitions only
  for deliberate changes" idiom — an `html.transition-colors` class that gates theme transitions and is
  applied after initial load. The sidebar transition should be gated the same way rather than inventing a new
  mechanism.

### Avatar toggle cue and wording

- **D-12:** **The visual cue is an emphasised `accent` ring plus a hover state**, not a corner badge. It
  extends the `border-2 border-border` treatment the Profile card's own avatar already uses
  (`Profile.tsx:65`), reads as a control rather than decoration, and stays legible at a ~40px button where a
  badge would need to be shrunk to near-illegibility. SIDE-09 accepts "badge or ring"; this is the ring.
- **D-13:** **Accessible names and tooltips are in English, following `ThemeToggle.tsx:40-41`'s exact
  pattern** — the same string passed to both `aria-label` and `title`. Action-phrased and stateful, e.g.
  "Show profile sidebar" / "Hide profile sidebar" and the left side's equivalent naming search and categories.
  `CONFIG.site.locale` is `"ko"` for this deployment, but every reader-facing string this repo ships today is
  unlocalised English, and threading these two strings through a locale branch would open a template-wide
  default-language question this phase has no reason to open. Exact final wording is planning's call within
  the action-phrased constraint; A11Y-05 requires it to be distinct from the Profile card avatar's `alt`
  (currently `profile.name`, i.e. `"4lph4"`).
- **D-14:** **If the avatar image is missing or fails to load, the button falls back to a `lucide-react`
  icon** inside the same circular button, so the control stays operable. `CONFIG.profile.avatarUrl` is
  `/avatar.png` — a local file each fork replaces — so a fork that deletes or mis-points it would otherwise
  ship an invisible button and lose SIDE-02's entire affordance. This mirrors Phase 9's IMG-04 pattern
  (icon fallback on image failure) and costs nothing extra here: the toggle is already a Client Component, so
  `onError` needs no boundary change, unlike Phase 9's gap G-09-1.

### Claude's Discretion

- The component names and file layout under `apps/web/src/components/layout/`, and precisely where the client
  boundary is drawn inside the wrapper.
- The two `data-*` attribute names on `<html>` and their value vocabulary.
- Which `lucide-react` glyphs are used (hamburger, avatar fallback) and their pixel sizes.
- The transition duration and easing, and whether it reuses `--transition-base` (200ms ease) or a new token.
- The `localStorage` key names and the stored value shape.
- Exact final tooltip / `aria-label` strings, within D-13's action-phrased English constraint.
- Whether `ThemeToggle` joins the pinned container or stays independently positioned (D-06).
- Whether PITFALLS 10 is answered by `@property` registration or by literal per-state
  `grid-template-columns` values.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The specification for this feature
- `.planning/research/ARCHITECTURE.md` §3 "Sidebar State Architecture" — the hazard statement, the
  A/B/C/D-compose-into-one framing, the concrete design (state on `document.documentElement`, attribute-scoped
  custom-property overrides in `globals.css`, `matchMedia` listener in the client component), and the
  new-vs-modified file list. This is the closest thing to a spec this phase has.
- `.planning/research/FEATURES.md` — the Option A/B/C comparison behind REQUIREMENTS.md D-02's tri-state
  choice, including the resize-fights-the-user failure mode and why Option B was recommended against.

### Pitfalls that are load-bearing here — all five are sidebar-phase pitfalls
- `.planning/research/PITFALLS.md` **Pitfall 7** (localStorage-driven initial state → hydration mismatch /
  flash of wrong layout; the `mounted`-guard vs pre-hydration-script choice, and the specific
  `useState(() => localStorage.getItem(...))` pattern to avoid) — this is SIDE-07.
- `.planning/research/PITFALLS.md` **Pitfall 8** (a `"use client"` boundary drawn too high swallows
  `SubscribeSection`'s secret gate; the `subscribeSlot` precedent to follow; and the explicit instruction to
  treat any `NEXT_PUBLIC_RESEND_*` appearance as **stop-ship, not a review comment**) — this is SIDE-10 and
  ROADMAP SC#3.
- `.planning/research/PITFALLS.md` **Pitfall 9** (`transform` or non-`visible` `overflow` on an ancestor
  silently breaks the existing `sticky top-8` asides; animate the `<aside>`'s own width or the grid container's
  columns instead; and the manual scroll test that is the only thing that catches it).
- `.planning/research/PITFALLS.md` **Pitfall 10** (`grid-template-columns` routed through an *unregistered*
  custom property snaps instead of transitioning; fix via `@property` registration or literal per-state
  values). Directly relevant because `Layout.tsx:41` is
  `md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)]` — exactly the shape described.
- `.planning/research/PITFALLS.md` **Pitfall 11** (collapsing a panel while focus is inside it strands the
  user; check `document.activeElement` containment before collapsing and move focus to the triggering toggle)
  — this is A11Y-03, and it must fire for the **resize-driven** collapse too, not only the click.
- `.planning/research/PITFALLS.md` "UX Pitfalls" table and the "Looks Done But Isn't" checklist's
  **Sidebar collapse** row — the five things this feature is most often declared done without.

### Requirements and scope
- `.planning/REQUIREMENTS.md` — SIDE-01 … SIDE-10, A11Y-01 … A11Y-05; the Locked Decisions table
  (**D-02** tri-state, **D-03** provisional 1280px + measurement obligation, **D-04** push-not-overlay,
  **D-06** Layout stays a Server Component, **D-07** no new deps/infra); the v2 section
  (SIDE-F01/F02/F03 — reset-to-auto, icon rail, drag-to-resize are all **out**); and the Out of Scope table.
- `.planning/ROADMAP.md` §"Phase 10" — the five success criteria (SC#3 is the stop-ship one) and the
  "Notes for planning" block, which fixes D-03's measurement as a planning-step activity and states why
  SIDE-05/06/07 and the A11Y set are not separable follow-on phases.

### Precedents in this repo that the implementation must follow
- `apps/web/src/app/post/[id]/page.tsx` — the `subscribeSlot` children-as-prop pattern and its comment
  explaining why `SubscribeSection` is never imported by a client-directive file. **The pattern D-06 requires
  already exists here.**
- `apps/web/src/components/ThemeProvider.tsx` + `apps/web/src/app/layout.tsx:64-68` — the working
  pre-hydration precedent (`next-themes` with `attribute="class"`, `suppressHydrationWarning` on `<html>`).
- `apps/web/src/components/ThemeToggle.tsx` — the `mounted` guard, the fixed-size placeholder, and the
  `aria-label` === `title` convention A11Y-05 points at.

### Prior-phase context worth reading, not re-deriving
- `.planning/phases/09-thumbnail-freshness/09-CONTEXT.md` — its "Phase 10 overlap warning" (both phases live
  in `templates/default/`, and Phase 9's card-internal consolidation was sequenced first partly to reduce the
  collision), and its D-08 record of four measurement-overturned premises, which is why D-09 keeps the
  measurement obligation instead of trusting arithmetic.

</canonical_refs>

<code_context>
## Existing Code Insights

### The width budget — derived here, still to be confirmed by measurement (D-09)

`templates/default/Layout.tsx:20` sets `max-w-[var(--max-content-width)] mx-auto px-4`; line 41 sets
`md:grid-cols-[var(--sidebar-width)_1fr_var(--profile-width)] md:gap-8`. With `globals.css:41-43` giving
`--sidebar-width: 200px`, `--profile-width: 240px`, `--max-content-width: 1400px`:

```
content width = min(viewport, 1400) - 32 (px-4 both sides) - 200 - 240 - 64 (gap-8 x 2)
              = min(viewport, 1400) - 536
```

| viewport | content, both expanded | both collapsed (gaps kept, D-04) |
|---|---|---|
| 768 (md floor) | 232px | 672px |
| 1024 | 488px | 928px |
| 1152 | 616px | 1056px |
| 1280 (threshold) | **744px** | 1184px |
| 1366 | 830px | 1270px |
| 1400+ | 864px | **1304px** |

The 232px figure at the `md` floor is the squeeze `PROJECT.md` flagged, and is what makes the threshold sit
far above `md` rather than at it.

### Reusable assets
- **`globals.css:141-147` `html.transition-colors`** — an existing "enable transitions only for deliberate
  changes, not on load" gate. D-11's click-only transition should reuse this idiom rather than invent one.
- **`globals.css:41-44` layout custom properties** — `--sidebar-width` / `--profile-width` /
  `--max-content-width` / `--header-height`. They are declared **only** under `:root`; the `.dark` block
  (lines 63-97) does not redefine them, so attribute-scoped overrides on `html[data-...]` work identically in
  both themes with no per-theme duplication.
- **`--transition-base: 200ms ease` (`globals.css:59`)** — an existing timing token.
- **`ThemeToggle.tsx`** — `mounted` guard + matching-dimension placeholder + `aria-label`/`title` pairing,
  and the button chrome (`p-2 rounded-md bg-surface hover:bg-surface-hover transition-colors cursor-pointer`)
  the two new toggles should visually match.
- **`lucide-react`** — already a dependency; supplies both the hamburger glyph and D-14's avatar fallback
  with no new package (REQUIREMENTS.md D-07).
- **`CONFIG.profile.avatarUrl` (`site.config.ts:26`)** — a plain literal in a file with **no `process.env`
  reads anywhere**, so it is safe to import directly into a client component; it does not need threading
  through `Profile.tsx`.
- **`post/[id]/page.tsx`'s `subscribeSlot`** — the already-shipped, already-reviewed shape of D-06's fix.

### Established patterns
- `next-themes` drives dark mode by putting a **`.dark` class** on `<html>` (`ThemeProvider.tsx:14`,
  `attribute="class"`), **not** a `data-theme` attribute. New sidebar `data-*` attributes on the same element
  are orthogonal and will not collide.
- `suppressHydrationWarning` on `<html>` (`app/layout.tsx:67`) is **element-scoped, not per-attribute**, so it
  already covers the two new attributes. No additional prop is needed there.
- Both `<aside>`s are `hidden md:block sticky top-8 self-start` (`Layout.tsx:43, 54`) — the sticky behaviour
  Pitfall 9 endangers, and the `hidden md:block` idiom D-08 follows.
- `SearchBar.tsx` and `CategoryList.tsx` are **already** `"use client"`; `Profile.tsx` and
  `SubscribeSection.tsx` are Server Components. The client/server split this feature needs is mostly already
  where it belongs.
- Reader-facing copy in this repo is unlocalised English (D-13's basis).

### Integration points
- MODIFIED `apps/web/src/templates/default/Layout.tsx` — **stays a Server Component**; builds the left slot
  (`SearchBar` + `CategoryList`) and right slot (`Profile` + `SubscribeSection`) and passes them into the new
  client wrapper instead of hand-writing the grid.
- MODIFIED `apps/web/src/app/layout.tsx` — add the blocking pre-hydration script alongside the existing
  `ThemeProvider`, not replacing it.
- MODIFIED `apps/web/src/app/globals.css` — attribute-scoped custom-property overrides, the transition and
  its gate, and the collapsed-content-hiding rule.
- NEW `apps/web/src/components/layout/*` — the client wrapper and the two toggle buttons.
- MODIFIED (post-detail prose cap, D-01/D-02/D-03) — whichever surface owns the post body column;
  `templates/default/PostPage.tsx` is the likely home. **Phase 9 also edited this file** (the `aspect-video`
  hero image region); this phase touches the content-column wrapper, a different region.
- UNCHANGED and must stay so: `apps/web/src/components/subscribe/SubscribeSection.tsx` — never touched, never
  re-parented into a client module.

### Landmines found while scouting
1. **`Profile.tsx:63` renders its own `<aside>`**, nested inside `Layout.tsx:54`'s `<aside>`. A11Y-01's
   `aria-controls` must point at the collapsible **panel** (the outer wrapper), and the nested-landmark
   duplication should be resolved rather than inherited — two nested `<aside>`s is already a mild landmark
   smell, and hiding only the outer one from the accessibility tree (A11Y-02) needs the boundary to be
   unambiguous.
2. **The threshold value has to exist in two places** — the inline pre-hydration script (so a `null`-preference
   visitor gets the correct auto-state at first paint, SIDE-07) and the client component's `matchMedia`
   listener (SIDE-05). If those two drift, SIDE-07 breaks in exactly the way that is hardest to notice. Plan
   for one source of truth, or an explicitly commented deliberate duplication.
3. **`Layout.tsx:20`'s `pt-16` exists to clear the absolutely-positioned `ThemeToggle`.** D-06's pinning and
   D-05's re-positioning both change what that padding is holding space for; do not assume it can stay
   untouched.
4. **No test infrastructure exists and none may be added.** Verification is source assertions, `next build`,
   ESLint, and direct browser observation — including the manual scroll test Pitfall 9 requires and the
   keyboard-only test Pitfall 11 requires. Neither is catchable by TypeScript or lint.

</code_context>

<specifics>
## Specific Ideas

- The reading-width payoff should be *felt* on the post page, not merely be technically true. 864px → 1100px
  was chosen against a 900px alternative specifically because the smaller cap would have satisfied SIDE-04's
  wording while delivering 36px.
- The transition should read as consequence, not as decoration: it plays because the reader clicked, and
  never because they dragged a window edge (D-11).
- The hamburger stays a hamburger. State lives in `aria-expanded`, the button's own treatment and the
  tooltip — not in a glyph swap (D-07).
- A collapsed side should be genuinely gone, not parked — no icon rail, no peeking stub. That third state is
  SIDE-F02 and belongs to v2.

### Accepted consequence, recorded so it is not mistaken for an oversight

Collapsing the left sidebar removes the **only** access point to search: `SearchBar` renders inside the left
`<aside>` (and, separately, in the mobile stack). While the left side is collapsed on desktop, the only route
back to search is re-expanding it with the hamburger. This is a direct consequence of SIDE-F02 (icon rail)
being deferred to v2, and it was reviewed and accepted rather than overlooked. It applies to the auto-collapse
path too: a first-time visitor below 1280px starts with search hidden behind the hamburger.

</specifics>

<deferred>
## Deferred Ideas

- **A search entry point that survives collapse** — e.g. a search icon in the collapsed state, or a keyboard
  shortcut opening search independently of the sidebar. Real, and the natural answer to the accepted
  consequence above, but any "something remains visible when collapsed" design is SIDE-F02's icon rail in
  disguise, which is v2.
- **Reset-to-auto affordance** (SIDE-F01, v2) — a control that clears an explicit override and returns a side
  to viewport-driven behaviour. Its absence is why D-10's "explicit preference wins absolutely" has no escape
  hatch this milestone: once a reader has toggled a side, that side never follows the viewport again.
- **A hard floor overriding an explicit expand preference on very narrow windows** — considered and declined
  as D-10. If real readers complain about a ~264px content column, revisit it together with SIDE-F01, since a
  reset affordance is the less intrusive answer to the same problem.
- **A site-wide reading-width cap covering the grid pages too** — considered and declined as D-01; the grid
  pages benefit from the full width.
- **Localising the toggle strings via `CONFIG.site.locale`**, following `CategoryList.tsx`'s `isKo` branch —
  declined as D-13 because it opens a template-wide default-language decision far larger than two buttons.
- **`terminal` template parity** for collapsible sidebars — TMPL-F01, out of scope this milestone.

</deferred>

---

*Phase: 10-Collapsible Sidebars & Reading Width*
*Context gathered: 2026-08-12*
