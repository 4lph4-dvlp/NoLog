# Phase 10 — Evidence Record

> Captured by plan 10-04 against a real `next dev` (Turbopack) server and a real `gstack /browse`
> headless Chromium session. Every number below was read from the browser or a command's output
> in this session — none are carried over from RESEARCH.md/CONTEXT.md without saying so.
> Method: `document.querySelector('main').parentElement.children` + each child's
> `getBoundingClientRect().width`, plus `getComputedStyle(...).gridTemplateColumns`, exactly as
> `10-RESEARCH.md` §"Code Context — Measured, Not Just Derived" specifies.

## Measured widths

**Session setup:** `localStorage` was cleared (`nolog:sidebar:left`/`right` removed) and the page
reloaded before the first clean baseline measurement, per the known tool limitation that the
shared `/browse` daemon's `localStorage` persists stale preference values across sessions
(flagged by waves 1-3).

### At 1400×900

| Combination | `<main>` width (measured) | `grid-template-columns` (computed) | Matches plan expectation? |
|---|---|---|---|
| Both expanded | **864px** | `200px 864px 240px` | Yes — matches 10-01/10-02 baseline exactly |
| Left only collapsed | **1064px** | `0px 1064px 240px` | Yes — matches 10-01's measurement (+200px) |
| Right only collapsed | **1104px** | `200px 1104px 0px` | Yes — matches 10-02's measurement (+240px) |
| **Both collapsed** | **1304px** | `0px 1304px 0px` | **Yes — equals D-04's derived 1304px exactly. No discrepancy.** |

**D-09/D-04 closure statement:** the both-collapsed figure was re-measured live against the shipped
collapse CSS (not re-derived from arithmetic) and reads **1304px**, identical to D-04's derived
value. There is no surviving gap, no residual track width, and no rounding effect to report — the
measured and derived numbers agree exactly.

### At 1280px (the auto-collapse threshold), fresh `localStorage`, no prior click

| Viewport | State (auto) | `<main>` width (measured) | `grid-template-columns` |
|---|---|---|---|
| 1280px | expanded/expanded (auto) | **744px** | `200px 744px 240px` |

744px at exactly 1280px matches `10-RESEARCH.md`'s own independently-measured pre-Phase-10
baseline exactly (same number, same viewport, before and after the collapse feature shipped) —
confirming the auto-collapse threshold introduces no regression to the expanded-state baseline.

### `<article>` width on a real post (`/post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5`), 1400×900

| Combination | `<main>` | `<article>` | Cap in effect? |
|---|---|---|---|
| Both expanded | 864px | 864px | No (864 < 1100) |
| Left only collapsed | 1064px | 1064px | No (1064 < 1100) |
| Right only collapsed | 1104px | **1100px** | Yes — ~2px slack each side |
| Both collapsed | 1304px | **1100px** | Yes — ~102px margin each side, the full +236px payoff over the 864px baseline |

Home page, both collapsed: `<main>` = 1304px, no `<article>` element present (grid page reclaims
the full freed width, D-01 holds — confirmed again this session, matching 10-03's own record).

**Note on `10-UI-SPEC.md`'s Reading-Width Contract paragraph:** that document's "240px + one 32px
gap = 272px → 1136px, 18px of slack" arithmetic for the right-only-collapse case is wrong — it
double-counts the 32px gap, which CONTEXT D-04 locks as SURVIVING a collapse (only the *track*
width goes to zero; the gap stays). The real, measured figure is **1104px** main / **1100px**
article (~2px slack each side), confirmed independently in this session and matching 10-02's and
10-03's own measurements. Per this plan's own instruction to decide and record a correction: the
erroneous paragraph in `10-UI-SPEC.md`'s `## Reading-Width Contract` section ("Asymmetric collapse
(D-03's accepted consequence)") has been corrected in place to state 1104px/1100px/~2px, since
leaving a known-wrong number in a contract a future phase will re-read verbatim is a real hazard
and this is the last plan in the phase. Only that paragraph's arithmetic was touched; every other
value in the contract (the 1100px cap, `mx-auto`, placement) was already correct and is untouched.

## Stop-ship battery (SIDE-10 / ROADMAP SC#3)

Three independent checks, literal output below.

**1. `grep -rn 'NEXT_PUBLIC_RESEND' apps/web/src`** (from repo root):
```
(no output — exit code 1, no matches)
```

Repo-wide (excluding `.planning/`, `node_modules/`, `.git/`, `.next/`):
```
(no output — exit code 1, no matches)
```

**2. Client-directive count in `Layout.tsx`, plus `next build` output inspection:**
```
$ grep -c 'use client' apps/web/src/templates/default/Layout.tsx
0
```

`npm run build --prefix apps/web` succeeded (Next.js 16.2.4, Turbopack; full output tail):
```
✓ Compiled successfully in 11.3s
  Running TypeScript ...
  Finished TypeScript in 6.4s ...
  Collecting page data using 3 workers ...
✓ Generating static pages using 3 workers (9/9) in 1077ms
  Finalizing page optimization ...

Route (app)                  Revalidate  Expire
┌ ○ /                                3m      1y
├ ○ /_not-found                      3m      1y
├ ƒ /api/notify-subscribers
├ ƒ /api/og
├ ƒ /api/subscribe
├ ƒ /api/thumbnail/[id]
├ ƒ /category/[slug]
├ ƒ /post/[id]
├ ○ /robots.txt
├ ƒ /search
└ ○ /sitemap.xml                     3m      1y
```

Next.js 16's build output no longer prints a per-component client/server marker table (that
format changed from earlier Next.js major versions), so the Server/Client boundary was confirmed
directly from the build's own client-reference manifest instead — a stronger check than the
route table would have given:

```
$ grep -o 'SidebarShell[^"]*' .next/server/app/page_client-reference-manifest.js
SidebarShell.tsx <module evaluation>
SidebarShell.tsx

$ grep -c 'templates/default/Layout' .next/server/app/page_client-reference-manifest.js
0

$ grep -c 'SubscribeSection' .next/server/app/page_client-reference-manifest.js
0
```

`SidebarShell.tsx` — the intended client boundary — IS listed in the client-reference manifest.
`Layout.tsx` and `SubscribeSection.tsx` are both **absent** from it, confirming neither crossed
into a client bundle. This is direct evidence from the compiled build artifact, not an inference
from the route table.

Additionally:
```
$ grep -c 'SubscribeSection' apps/web/src/components/layout/SidebarShell.tsx
0
$ grep -c 'SubscribeSection' apps/web/src/templates/default/Layout.tsx
5
```

**3. The live half — subscribe form rendering and submission:**

`RESEND_API_KEY`/`RESEND_AUDIENCE_ID` ARE present in this local environment (`.env.local` loaded
by `next dev`, confirmed by the dev server's own startup log line `- Environments: .env.local`
and by the subscribe form actually rendering with a live email field and "구독" submit button —
neither of which happens when those vars are unset, per `SubscribeSection`'s own fail-closed gate).

- **Render half: OBSERVED, positive.** `gstack /browse` confirmed the subscribe heading, the
  `you@example.com` email textbox, and the "구독" submit button all render live on `http://localhost:3000/`'s
  right panel.
- **Submit half: UNEXERCISED — the harness's auto-mode permission classifier blocked the action.**
  Filling the email field with a real address and clicking submit is a real, side-effecting write
  against the operator's live production Resend audience using PII (an email address), and this
  session's Bash/browse tool-use classifier explicitly denied both the fill+click sequence and a
  follow-up read of the input's live value, with the message: "Blocked by classifier... this is a
  side-effecting write". Per this project's own precedent of declining to manufacture test
  conditions against live production surfaces when the environment resists it (Phase 9's IMG-05,
  09-CONTEXT D-13), this plan does not attempt to work around that denial. The correctly-configured
  case (form renders, is not gated away) is positively observed above; the actual submit-and-response
  round trip is recorded here as UNEXERCISED rather than fabricated. No secret VALUE — and in this
  case, no submitted PII either — was transcribed into this file.

## Threshold and persistence (SIDE-05, SIDE-06)

**Boundary sweep, `localStorage` cleared beforehand, no prior click, viewport swept
1281→1280→1279→1280px:**

| Viewport | `data-sidebar-left` | `data-sidebar-right` | `<main>` width | `localStorage['nolog:sidebar:left']` | `localStorage['nolog:sidebar:right']` |
|---|---|---|---|---|---|
| 1281px | expanded | expanded | 745px | `null` | `null` |
| 1280px | expanded | expanded | 744px | `null` | `null` |
| 1279px | collapsed | collapsed | 1183px | `null` | `null` |
| 1280px (back up) | expanded | expanded | 744px | `null` | `null` |

The sweep wrote **no** `localStorage` key at any point — confirmed by reading both keys after
every step, not merely at the end.

**Explicit preference (click), persistence across reload / resize / navigation:**

At 1400×900, clicking both toggles (hamburger, then avatar) produced:
```
{"left":"collapsed","right":"collapsed","ls_left":"true","ls_right":"true"}
```

- **After `reload()`:** `data-sidebar-left`/`right` still read `"collapsed"`/`"collapsed"` —
  the explicit preference survived a full page reload.
- **After resizing to 800px (well below the 1280px threshold, D-10's no-floor-override case):**
  both sides still read `"collapsed"`/`"collapsed"` — unchanged, confirming the resize did not
  flip an already-explicit preference (there was nothing to override toward, since the reader had
  already chosen collapsed; the more informative direction — an EXPANDED explicit preference
  surviving a resize DOWN to 800px — was already established live in plan 10-01's own D4 coverage
  row and is not re-litigated here).
- **After navigating to a real post (`/post/3702c61e-…`) and back:** both sides still read
  `"collapsed"`/`"collapsed"` — the preference survived a real client-side/server navigation, not
  just a reload of the same URL.

This closes SIDE-05 (auto-collapse follows the viewport live, zero writes) and SIDE-06 (explicit
preference persists across resize/reload/navigation) from real observation in this session.

**Tampered `localStorage` value (T-10-01 mitigation, threat model).** With
`localStorage.setItem('nolog:sidebar:left', 'garbage-tampered-value')` and
`localStorage.setItem('nolog:sidebar:right', '<script>alert(1)</script>')` both set, then reloaded
at 1400×900 (above the 1280px threshold): both sides read `data-sidebar-left="expanded"` /
`data-sidebar-right="expanded"` — the garbage value and the injected-script string both fell
through the strict allowlist parse to `null` (auto), which resolves to "expanded" at this viewport,
**not** to a literal reflection of the tampered string anywhere in the DOM. `document.documentElement.className`
was inspected directly and contains no trace of the injected string — confirming the allowlist
parse never interpolates the raw stored value into an attribute, class, or template (V5 Input
Validation, closes T-10-01's stated mitigation with a real observation rather than only a static
assertion). Both tampered values were removed from `localStorage` immediately after this check.

## Delayed-onset pitfall battery

**1. Sticky survival (PITFALLS 9 / 3 / 7, RESEARCH Assumption A1, ROADMAP SC#5).**

On a real long post (`/post/3702c61e-…`, `scrollHeight` 4187px at 900px viewport height — genuine
scroll room), scrolled to `window.scrollTo(0, 2000)` and read both `<aside>`s' `getBoundingClientRect().top`
and `getComputedStyle(...).position` in all four sidebar combinations:

| Combination | Left `<aside>` position/top | Right `<aside>` position/top | Toggle row top | Sticky holds? |
|---|---|---|---|---|
| Both expanded | `sticky` / 64px | `sticky` / 64px | 25px | Yes |
| Left collapsed, right expanded | `sticky` / 64px | `sticky` / 64px | — | Yes |
| Left expanded, right collapsed | `sticky` / 64px | `sticky` / 64px | — | Yes |
| Both collapsed | `sticky` / 64px | `sticky` / 64px | 25px | Yes |

All four combinations report `position: sticky` (not `static`/`relative`, i.e. sticky was never
silently broken by an ancestor's `overflow`/`transform`) and settle at the identical `top: 64px`
rest position after a 2000px scroll — well past where a non-sticky element would have scrolled
off-screen entirely. **No isolation step was needed** — nothing failed, so PITFALLS 9's prescribed
"re-test with `transition: none`" fallback was not triggered.

**Home page constraint, recorded honestly rather than silently skipped:** the operator's home page
has only 3 published posts and its `document.body.scrollHeight` measures **900px at a 900px
viewport** (and only 664px at a 600px viewport) — there is genuinely not enough real content to
scroll far enough to meaningfully stress-test sticky the way the 4187px-tall post page does. A
light check at the ~50-64px of scroll room that does exist confirmed both `<aside>`s report
`position: sticky` (not broken), but this is a light/constrained observation, not the same
"scroll 2000px and confirm the aside is still there" test the post page received. This is the same
class of content-scarcity limitation already recorded for the E7 backstop (only 3 real posts) —
not a code defect, and not fabricated by adding filler content to the operator's real site.

Also confirmed: the pinned toggle row (top≈25px) does not overlap either panel's first interactive
element at its sticky rest position (`toggleRowBottom: 59px`, `leftFirstInputTop`/`rightFirstElTop: 76px`
— a 17px gap).

**2. True 0px collapse (Pitfall 6).** With both sides collapsed: `document.getElementById('sidebar-left-panel').getBoundingClientRect().width`
and the right panel's equivalent both read **exactly `0`** (not a near-content-width nonzero
value), and both panels report `hasAttribute('inert') === true`. A full-page screenshot at this
state (both collapsed, real post) shows no icon rail, no peeking stub, and no content visibly
escaping the collapsed boundary — the collapsed side is genuinely gone, matching the Collapsed
Geometry Contract's "what visually remains: nothing" requirement.

**3. Dead-CSS confirmation (Pitfall 8).**
```
$ grep -rn 'transition-colors' apps/web/src --include='*.tsx' --include='*.ts'
```
This literal command returns **many** lines — but they are all pre-existing, unrelated uses of
Tailwind's own `transition-colors` *utility class* (button/link hover treatments in `ThemeToggle.tsx`,
`Profile.tsx`, `CategoryList.tsx`, `SubscribeForm.tsx`, `SidebarToggleLeft.tsx`, and every
`templates/default/*Page.tsx`), none of which existed because of this phase and none of which have
anything to do with Pitfall 8's actual concern (the dead `html.transition-colors` *class-toggle*
mechanism). This plan's own literal acceptance grep for this string is over-broad and cannot pass
on any state of this codebase without deleting a legitimate, widely-used design-system utility
class — recorded as a plan-authoring deviation below, not fixed by removing real code.

The precise check Pitfall 8 actually requires — confirming no code ties into `html`'s classList
with the string `transition-colors` — returns cleanly:
```
$ grep -rn "classList.*transition-colors\|transition-colors.*classList\|documentElement.*transition-colors" apps/web/src --include='*.tsx' --include='*.ts'
(no output — exit code 1, no matches)
```
And the `globals.css` rule itself is confirmed present and untouched:
```css
html.transition-colors,
html.transition-colors *,
html.transition-colors *::before,
html.transition-colors *::after {
  transition: background-color var(--transition-base),
    border-color var(--transition-base), color var(--transition-base) !important;
}
```
No code anywhere adds/removes/toggles this class on `<html>` — confirmed both by the precise grep
above and by this session's own `data-sidebar-transition`-based mechanism (a different, real,
working attribute) being what actually drives the sidebar's transition, exactly as RESEARCH.md's
Pitfall 8 finding requires.

**4. Reduced motion (A11Y-04).**

`window.matchMedia` was monkey-patched in-page to report `matches: true` for the
`prefers-reduced-motion` query (the same technique 10-01 used, since CDP's `Emulation.setEmulatedMedia`
remains outside the `/browse` tool's allowlist — confirmed again this session:
`DENIED: Emulation.setEmulatedMedia is not on the CDP allowlist`).

- **Patched (reduced motion reported true), click:** immediately (~50ms) after the click,
  `data-sidebar-transition` on `<html>` reads `null` and `<main>`'s width already reads the fully
  collapsed value (1064px) — the collapse was instant, never adding the transition attribute at all.
- **Unpatched (normal), click:** immediately after the click, `data-sidebar-transition="active"`
  and `getComputedStyle(.sidebar-grid).transitionDuration === "0.2s"`; ~350ms later the attribute
  is removed and `<main>` has settled at 1064px — confirming the transition mechanism genuinely
  animates under normal conditions (the reduced-motion case above is a real suppression, not
  evidence of a broken/always-instant transition).
- **CSS-layer confirmation:** source-asserted (not live-forced, since the real browser-engine
  reduced-motion preference cannot be set without the unavailable CDP method) — `globals.css`'s
  transition rule is wrapped in `@media (prefers-reduced-motion: no-preference)`, present and
  unmodified:
  ```css
  @media (prefers-reduced-motion: no-preference) {
    html[data-sidebar-transition="active"] .sidebar-grid {
      transition: grid-template-columns var(--transition-base);
    }
  }
  ```
- **UNEXERCISED sub-claim:** "manually set `data-sidebar-transition='active'` while the JS guard is
  bypassed AND the real browser preference is reduce, and confirm the CSS media query still
  suppresses the transition" could not be performed live — it requires the actual engine-level
  `prefers-reduced-motion: reduce` state, which this session's tooling cannot force (same CDP
  allowlist gap as above). The JS-layer half (belt) and the CSS-layer source assertion (suspenders)
  are each independently confirmed; the specific "both bypassed simultaneously" combination is
  UNEXERCISED with this stated reason, not claimed as observed.

## Accessibility battery (A11Y-01…05)

**`aria-expanded`/`aria-controls`/`aria-label`/`title`, before and after click, both sides:**

| Toggle | Before click | After click |
|---|---|---|
| Hamburger | `aria-expanded="true"`, `aria-label`=`title`=`"Hide search and categories"`, `aria-controls="sidebar-left-panel"` | `aria-expanded="false"`, `aria-label`=`title`=`"Show search and categories"` |
| Avatar | `aria-expanded="true"`, `aria-label`=`title`=`"Hide profile sidebar"`, `aria-controls="sidebar-right-panel"` | `aria-expanded="false"`, `aria-label`=`title`=`"Show profile sidebar"` |

Neither label/title string contains `CONFIG.profile.name` (`"4lph4"`, `apps/web/src/site.config.ts:23`).

**Accessibility-tree read (CDP `Accessibility.getFullAXTree`, respects `inert` — `gstack /browse`'s
own `snapshot -i -s <selector>` does NOT honor `inert`, a known tool limitation from wave 3 that
was worked around the same way here, not rediscovered):**

- Both panels collapsed: 122 total nodes, **zero** `textbox`/`searchbox` role, **zero**
  `complementary` role anywhere in the tree.
- Left panel expanded, right collapsed: 142 total nodes, **exactly one** `searchbox` role and
  **exactly one** `complementary` role — the right panel (still collapsed) contributes zero of
  either, confirming the count tracks collapse state precisely, not some unrelated tree size change.

**Real keyboard Tab-order walk** (left collapsed, right expanded), focus started on the avatar
toggle:
```
avatar toggle → post link 1 ("만년필을...") → post link 2 ("Antigravity...") → post link 3
("NoLog를...") → github → linkedin → email → instagram → email input[type=email] → "구독" submit
button → (Next.js dev overlay) → wraps to hamburger
```
The left panel's search input and category links are **never** focused during this walk while
collapsed — confirmed skipped, not merely visually hidden. The reverse case (right collapsed, left
expanded) was also walked and showed the mirror result: focus reaches the search input and category
links, never the right panel's social links/email/submit button.

**`document.activeElement` after all four focus-rescue cases — all four independently reproduced
in this session (10-03 had left three of the four; the fourth, right+resize, is newly and
independently observed here):**

| Case | Focused before collapse | `document.activeElement` after |
|---|---|---|
| Left, click | search `<input>` | `BUTTON[aria-label="Show search and categories"]` (the hamburger itself) |
| Right, click | email `<input>` | `BUTTON[aria-label="Show profile sidebar"]` (the avatar toggle) |
| Left, resize (1400→1200px) | search `<input>` | `BUTTON[aria-label="Show search and categories"]` |
| Right, resize (1400→1200px) | email `<input>` | `BUTTON[aria-label="Show profile sidebar"]` |

## Mobile and visual battery (SIDE-08, SIDE-09, SIDE-07)

**Mobile stack (375×812):** `document.documentElement.scrollWidth === clientWidth === 375` (no
horizontal scroll). Accessibility snapshot order: ThemeToggle → Profile → Subscribe → Search →
Categories → posts — exactly the Profile/Subscribe/Search/Categories order SIDE-08 requires, with
exactly one visible `ThemeToggle` instance (`offsetParent !== null` true for one, false for the
other — the known desktop/mobile duplicate-DOM-instance pattern, confirmed non-duplicated visually).
No toggle row rendered (its wrapper computes `display: none` at this viewport).

**Desktop preference has no mobile effect:** with an explicit `nolog:sidebar:left`/`right = "true"`
preference set at 1400px, then resized to 375×812 and reloaded: no horizontal scroll, `<main>`
measures 343px (375 − 32px padding, the ordinary mobile-stack width) — the desktop collapse
preference has zero visible effect on the mobile layout.

**Avatar ring, both themes, both states:** screenshots confirmed the `ring-2 ring-accent
ring-offset-2 ring-offset-background` cue renders identically in light/expanded, light/collapsed,
dark/expanded, and dark/collapsed — matching 10-02's own original D3 finding, re-confirmed visually
this session via the same theme-toggle-via-`classList` technique 10-03 used (a plain CSS-attribute
click on `ThemeToggle` is ambiguous — it renders twice in the DOM with the same `aria-label`, a
known tool-interaction limitation, not a code defect, since exactly one instance is `display:none`
at any given viewport).

**Cold-reload flash check (SIDE-07):** 5 consecutive reloads at 1400px with a saved
`collapsed=true` preference (a viewport where the auto/no-preference state would be "expanded",
making this the discriminating case) — every reload's `data-sidebar-left` read `"collapsed"`
immediately via a JS read taken right after the `reload` command returned, and
`console --errors` across all 5 reloads showed zero hydration-warning lines. **Honesty caveat, as
the plan requires:** this is a same-tick DOM-attribute read plus a console-error absence check, not
a frame-by-frame human/eye video review — if a true single-frame flash exists between first paint
and the pre-hydration script's correction, this method would not catch it. Recorded as "no flash
detected by the available method," not "definitively zero-frame-flash confirmed by eye," per the
plan's own instruction not to over-claim a visual timing check that cannot be settled by eye in
this session.

**E5/E6 long-text backstops (`10-UI-SPEC.md` UI Considerations, held out by waves 1-3):**
performed via a pure client-side DOM text-injection (never touching `apps/web/src` or Notion
content) so the fixed-width-wrapper CSS mechanism itself is exercised without fabricating
production data:
- Left panel: replaced the visible desktop "전체 포스트" category link's text with a 66-character
  unbroken string. `wrapperScrollWidth === wrapperClientWidth === 200px` — the fixed `w-[200px]`
  inner wrapper never grew; the text is visibly clipped at the panel's right edge with no reflow of
  the panel itself, in both light and dark theme (screenshots taken, not committed as binary
  artifacts — described here).
- Right panel: replaced the Profile bio paragraph with a long descriptive sentence.
  `wrapperScrollWidth === wrapperClientWidth === 240px` — the text wraps onto multiple lines inside
  the fixed `w-[240px]` wrapper rather than overflowing horizontally, in both themes.

**E7 overflow/long-text backstop — still genuinely UNEXERCISED against real content, with a
closer proxy performed this session (not a full pass):** the operator's 3 published posts contain
**zero** tables and **zero** code blocks (re-confirmed this session, matching 10-03's original D5
finding) — the backstop's real-content condition remains unexercisable without mutating production
Notion content, which this plan explicitly declines to do (matching Phase 9's IMG-05/09-CONTEXT
D-13 precedent). A synthetic exercise WAS performed this session, closer to a real observation than
pure arithmetic: a wide table and a wide code block were injected client-side using
`react-notion-x`'s own actual CSS classes (`.notion-simple-table`, `.notion-code` — confirmed by
reading `node_modules/react-notion-x/src/styles.css`, which shows `.notion-code { overflow: auto }`
and `.notion-simple-table td { white-space: pre-wrap }`, i.e. the real renderer already handles wide
content internally) with realistic sentence-length cell/code text. Result: `document.querySelector('article').scrollWidth === clientWidth === 1100px`
in both themes — no overflow. A first attempt using raw, non-`.notion-*`-classed markup with
artificial unbroken 80-character tokens DID overflow (`scrollWidth: 1613px` against `clientWidth:
1100px`) — this is recorded as a methodology artifact (unstyled markup lacks the real renderer's
own overflow handling), not a site defect, and is why the second, class-accurate attempt is the one
reported as the finding. The longest real published title ("Antigravity 2.0 사용기") was also
checked at the fully-collapsed 1100px column: no overflow (`h1.scrollWidth === clientWidth ===
1068px`). **Status: the realistic-content risk is closed by this session's closer proxy; the
literal "real wide table/code block in production" observation remains UNEXERCISED** because no
such content exists to observe, and none was manufactured in production.

All DOM injections above (`e7-backstop-injection`, the category-link/bio text replacements, the
`classList.add('dark')` theme toggles, the tampered `localStorage` values) were client-side-only
and were removed/reverted before the session's Task 2 work concluded. `git status --short
apps/web/src` was confirmed clean (no output) after cleanup.

## Deviation note (plan-authoring, not a code defect)

Task 2's own automated `<verify>` command included `grep -rn 'transition-colors' apps/web/src
--include='*.tsx' --include='*.ts'; test $? -ne 0 && ...`, requiring zero matches for the literal
substring `transition-colors`. As shown above, this substring is Tailwind's own widely-used utility
class name and appears in 9+ pre-existing files unrelated to Pitfall 8's actual concern (the dead
`html.transition-colors` class-toggle mechanism this check was meant to rule out). This check cannot
pass on any state of this codebase without deleting legitimate, pre-existing utility-class usage —
recorded here as a Rule 3 "blocking issue," resolved by substituting the precise check Pitfall 8
actually requires (`classList.*transition-colors` / `documentElement.*transition-colors`, both
returning zero matches) rather than by deleting real code to satisfy an over-broad literal grep.
No file was modified to "fix" this.

A second, much smaller instance of the same self-referential-check pattern: Task 2's own automated
`<verify>` command is `grep -c '_pending_' 10-VALIDATION.md == 0`, but that exact command string is
itself quoted inside the Per-Task Verification Map's own "Automated Command" documentation column
once this section is filled in — meaning the literal substring `_pending_` necessarily appears in
`10-VALIDATION.md` forever after (in the command's own self-documentation), even though zero Status
cells contain a literal `⬜ pending`/`_pending_` marker. Harmless and expected; noted for
completeness alongside the `transition-colors` deviation above.
