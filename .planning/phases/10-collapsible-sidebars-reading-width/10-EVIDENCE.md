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
