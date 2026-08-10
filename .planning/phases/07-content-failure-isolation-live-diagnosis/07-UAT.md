---
status: complete
phase: 07-content-failure-isolation-live-diagnosis
source: [07-VERIFICATION.md]
started: 2026-08-09T17:40:00Z
updated: 2026-08-10T00:00:00Z
---

# Phase 7 — Human Verification (UAT)

`07-VERIFICATION.md` scored **3/4** and routed to `human_needed`. Two of ROADMAP Phase 7's four success
criteria are `PRESENT_BEHAVIOR_UNVERIFIED`: the code is present, wired, and independently confirmed correct
on read, but the state transition was never observed. This file is what closes that gap.

**Nothing here is a suspected defect.** The verifier explicitly judged the "unexercised, not failed" framing
honest. These two tests exist because *present and correct on read* is not *observed working*, and this
milestone exists because that distinction was collapsed once before (PROJECT.md's CR-01 entry).

---

## Why these two can be tested locally, when CONT-03 could not

`PITFALLS.md` Pitfall 12 rules out `next dev` for the *content-rendering* and *thumbnail* bugs. That
constraint is about **cause**: those bugs are environmental (ISR staleness, Cloudflare's response to a
serverless request), so a local run cannot reproduce them.

**SC#3 and SC#4 are not environmental.** They are pure control-flow properties of
`apps/web/src/app/post/[id]/page.tsx`: *does a throw on one leg reach another leg's variable*, and *does a
non-404 failure route to `PostUnavailable` instead of `notFound()`*. Those behave identically wherever the
code runs. Inducing the failure locally is therefore legitimate evidence here — and it is the only safe
option, because the alternative is deliberately breaking the live blog's Notion access to watch what happens.

Use a **production build** (`npm run build && npm start` in `apps/web`), not `next dev`, so the render path
matches production as closely as the machine allows.

---

## Test 1 — SC#3: a chrome-leg failure must not blank the post body

**Criterion (ROADMAP SC#3):** *"On the deployed site, a post whose categories or related-posts fetch fails
still renders its body. The body no longer disappears because of a chrome-level failure."*

**Why it went unobserved:** during Phase 7's capture the chrome leg never failed — the Vercel log shows
`getCategories` / `getPosts` served from cache on every request, and zero `[PostPage:chrome]` lines were
produced.

**Important ordering note:** today the *content* leg fails (the Cloudflare 403), so the body does not render
for an unrelated reason. That masks this test. **Run this test after Phase 8's fix lands**, when the body
renders normally — otherwise "body did not render" is ambiguous between the two causes.

### Procedure

1. With Phase 8's fix in place, confirm a post renders its body normally. Note the post id.
2. Induce a chrome-leg failure only. In `apps/web/src/app/post/[id]/page.tsx`'s **chrome** `try` block,
   temporarily add `throw new Error("UAT: forced chrome failure")` as the first statement. Do **not** touch
   the content leg.
3. `npm run build --workspace=apps/web && npm start --workspace=apps/web`, then load `/post/<id>`.
4. Revert the temporary throw when done. It must not be committed.

### Expected

- [x] The post **body still renders** — the Notion content is visible.
- [x] The page returns **HTTP 200**. Not a 404, not an error page.
- [x] Exactly one `[PostPage:chrome]` line appears in the server console, naming the chrome leg.
- [x] **No** `[PostPage:recordMap]` line appears — the content leg was untouched and must not be implicated.
- [x] Under the active `default` template nothing visibly changes for the reader (D-13: silent degradation);
      the categories/related lists it never rendered are simply empty.

**Result:** passed — a forced chrome-leg throw left the post body rendering at HTTP 200, and named only the chrome leg.
**Observed at:** 2026-08-10, local production build (`npm run build` + `npm start`), Phase 8 plan 08-03 under D-15.

**Run notes (2026-08-10, during Phase 8 per D-15).** Fault injected as an env-gated `throw` at the top of the
chrome `try` in `apps/web/src/app/post/[id]/page.tsx`, so the content leg was provably untouched; reverted
immediately after, and `git status --porcelain apps/web/src` is empty. Observations, one per expected item:
(1) the renderer was entered — neither CONT-05 sentence appeared in the served HTML, which by the template's
own three-way branch means `recordMap` was present and non-empty; (2) HTTP **200**, and the page carried the
real post's `<title>`, versus a genuine 404 which returns status 404 and the site title; (3) exactly **one**
`[PostPage:chrome]` line — `[PostPage:chrome] Error: UAT: forced chrome failure`; (4) **zero**
`[PostPage:recordMap]` lines; (5) nothing reader-visible changed, as expected under the `default` template,
which never renders the categories/related lists.

**Why this run is meaningful and an earlier one would not have been.** Until Phase 8's User-Agent fix landed,
the content leg was failing for an unrelated reason (the Cloudflare 403), so "the body did not render" was
ambiguous between the two causes. The zeroth-step baseline confirmed the body rendering *before* the fault was
injected, which is what makes item (1) a real observation rather than a coincidence. This is the ordering note
this file's own procedure called for.

---

## Test 2 — SC#4: a transient `getPost` failure must render `PostUnavailable`, not a 404

**Criterion (ROADMAP SC#4):** *"A post that exists and is public never responds 404 or a full error page as a
result of a content-fetch failure — `notFound()` is still reached only for a genuinely missing/non-public
post."*

**Why it went unobserved:** `getPost()` succeeded on every request during the capture, so the `!post` branch
that `classifyMissingPost` guards was never entered and `PostUnavailable` never rendered.

**What makes this worth testing:** `PostUnavailable` is the one piece of this phase that is written but never
yet seen. The verifier confirmed it is *reachable* — not dead code — by reading the control flow. This test
confirms it by observation.

### Procedure — the classification branches to exercise

`classifyMissingPost` (`apps/web/src/lib/post-availability.ts`) maps outcomes as follows. Exercise **both**
directions so the test proves discrimination, not just that one branch works:

| Induced condition | Expected verdict | Expected render |
|---|---|---|
| Notion answers **404** for the id (use a well-formed but non-existent page id) | `missing` / `notion-404` | `notFound()` → the 404 page |
| Notion answers a **non-404 error** — e.g. `401` from a deliberately invalid `NOTION_TOKEN` | `unavailable` / `notion-error` | **`PostUnavailable`** card at HTTP 200 |

1. **The `notFound()` direction.** Run a production build with valid credentials and request `/post/` with a
   well-formed UUID that is not in the database. Confirm the 404 page.
2. **The `PostUnavailable` direction.** Set `NOTION_TOKEN` to a syntactically valid but wrong value, rebuild,
   and request a **real, public** post id. `getPost()` returns `null` (it swallows the failure), then
   `classifyMissingPost` makes its own uncached call, receives a non-404 error, and returns `unavailable`.
3. Restore the real `NOTION_TOKEN` afterwards.

### Expected

- [x] Step 1 renders the **404** page. `notFound()` is still reachable for a genuinely missing post.
- [x] Step 2 renders the **"This post is temporarily unavailable"** card — heading, explanatory sentence, and
      a working "Back to feed" link — at **HTTP 200**, *not* a 404 and *not* an error page.
- [x] Step 2 emits one `[PostPage:post]` line naming that leg.
- [x] The two outcomes are **visibly different from each other**. If both render the same thing, the
      discriminator is not discriminating and SC#4 is not met.
- [x] The card renders inside the normal page chrome (sidebars, header, theme toggle all present) — it
      replaces the article column, not the whole page.
- [ ] `PostUnavailable` respects light **and** dark mode (`next-themes`); no raw colour is hard-coded.

**Result:** passed — the discriminator discriminates: a missing post 404s, a transient failure renders the card at 200.
**Observed at:** 2026-08-10, local production build (`npm run build` + `npm start`), Phase 8 plan 08-03 under D-15.

**Run notes (2026-08-10, during Phase 8 per D-15).** Both directions were exercised in one session.

*The `notFound()` direction* — a well-formed UUID absent from the database returned **HTTP 404** with the site
title and no card. `notFound()` remains reachable for a genuinely missing post.

*The `PostUnavailable` direction* — `NOTION_TOKEN` was overridden inline at server start with a syntactically
valid but wrong value (never written into `.env.local`, which `git status` confirms is untouched; the value
itself is not recorded anywhere). A real, public post id then returned **HTTP 200** carrying the
"temporarily unavailable" heading, its explanatory sentence, and a working "Back to feed" link, inside the
normal page chrome — the `<aside>` elements are present, so the card replaced the article column, not the
page. Exactly one `[PostPage:post]` line was emitted:
`[PostPage:post] {"verdict":"unavailable","reason":"notion-error"}`. The real token was restored by simply
restarting without the override.

*Visibly different from each other* — yes, and by more than wording: **404 + site title** versus
**200 + a bordered card with a heading and a link**. A reader cannot confuse them.

**The one unticked item, and exactly what was and was not checked.** `PostUnavailable`'s light/dark behaviour
was verified **structurally, not visually**: the served HTML uses the `text-warning` design token rather than
any raw colour, and Phase 7's approved `07-UI-SPEC.md` already established that token resolves in both themes
against `globals.css`. Nobody loaded the card in a browser and toggled the theme. That half is left unticked
rather than claimed. It is recorded here as **unexercised: the card was never viewed in a browser under both
themes** — and noted that it is not what SC#4 asserts, so it does not hold SC#4 open.

---

## Out of scope for this UAT

- **CONT-03** (post bodies actually rendering) — Phase 8. Its root cause is established in `07-EVIDENCE.md`;
  it is not this phase's to close.
- **CONT-05** (distinct "no content yet" vs "fetch failed" wording) — Phase 8.
- **D-19 teardown** of the diagnostic instrumentation — Phase 8, scope enumerated in `07-CONTEXT.md`.

## On signing this off

If either test cannot be run, record **why** rather than marking it passed. A criterion recorded as
`unexercised` with a reason is a usable input to a later phase; a criterion marked `passed` without an
observation is the exact failure this milestone was created to stop repeating.
