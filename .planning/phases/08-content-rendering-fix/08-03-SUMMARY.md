---
phase: 08-content-rendering-fix
plan: 03
subsystem: content-rendering
tags: [uat, operator-verified, cont-04, sc3, sc4, fault-injection]

# Dependency graph
requires:
  - phase: 08-content-rendering-fix (plan 01)
    provides: "The User-Agent fix that restores the post body, which is what makes Test 1 unambiguous"
provides:
  - "07-UAT.md filled in: both Phase 7 tests observed, with results and timestamps"
  - "ROADMAP Phase 7 SC#3 and SC#4 live halves closed by direct observation"
affects: [phase-7-verification, 08-04-plan]

# Actuals
actuals:
  tokens: 0
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Env-gated fault injection instead of an unconditional throw: an unconditional `throw` at the top of a try block made the remainder unreachable and TypeScript dropped an earlier null-narrowing, failing the build. Gating on an env var keeps the code reachable, compiles cleanly, and lets one build serve both the faulted and unfaulted runs."
    - "Override a secret at process start rather than editing the dotenv file: Next.js does not overwrite an already-set process.env value from .env.local, so a wrong-token run needs no edit to the developer's credentials file and leaves nothing to restore."

key-files:
  - .planning/phases/07-content-failure-isolation-live-diagnosis/07-UAT.md
---

# Plan 08-03 Summary — Phase 7's Outstanding UAT (D-15)

Both tests **passed**. Phase 7's `07-UAT.md` now carries an observed outcome and a timestamp for each, and
one deliberately-unticked item with its reason stated.

## Baseline first — and it was itself a finding

Before injecting anything: a local production build served a real post with **neither** CONT-05 sentence in
the HTML and the renderer entered. By the template's own three-way branch that means `getPageRecordMap`
succeeded — **the User-Agent fix works locally.** The same page showed `Content could not be loaded.` during
Phase 7. This is not production proof (that is plan 08-04's job, and the local request originates from a
different IP than Vercel's), but it is the first working evidence the fix does what the evidence said it
would.

## Test 1 — SC#3, chrome failure must not blank the body: passed

Fault injected as an **env-gated** throw at the top of the chrome `try`, so the content leg was provably
untouched. All five expected items observed:

| # | Expected | Observed |
|---|---|---|
| 1 | Body still renders | Renderer entered; neither sentence present |
| 2 | HTTP 200, not 404/error | **200**, real post `<title>` |
| 3 | Exactly one `[PostPage:chrome]` line | **1** — `Error: UAT: forced chrome failure` |
| 4 | No `[PostPage:recordMap]` line | **0** |
| 5 | Nothing reader-visible changes under `default` | Confirmed — that template never renders those lists |

**Why the ordering mattered.** Until 08-01's fix landed, the content leg was failing for an unrelated reason,
so "the body did not render" was ambiguous between two causes. The baseline established the body rendering
*before* the fault went in, which is what makes item 1 an observation rather than a coincidence. `07-UAT.md`
called for exactly this ordering when it was written.

## Test 2 — SC#4, transient failure must render `PostUnavailable`: passed

Both directions exercised, which is what makes it a test of *discrimination* rather than of one branch:

- **`notFound()` direction** — a well-formed UUID absent from the database → **HTTP 404**, site title, no card.
- **`PostUnavailable` direction** — `NOTION_TOKEN` overridden inline at server start (never written to
  `.env.local`; `git status` confirms it untouched; the value is recorded nowhere) → **HTTP 200**, the
  "temporarily unavailable" heading, its sentence, a working "Back to feed" link, inside the normal page
  chrome (`<aside>` present — the card replaced the article column, not the page). One
  `[PostPage:post] {"verdict":"unavailable","reason":"notion-error"}` line.
- **Visibly different** — 404 + site title versus 200 + a bordered card. Not confusable.

## The one thing not claimed

`PostUnavailable`'s light/dark rendering was verified **structurally, not visually**: the HTML uses the
`text-warning` token rather than a raw colour, and Phase 7's approved UI-SPEC already established that token
resolves in both themes. Nobody loaded it in a browser and toggled the theme. That checkbox is left unticked
and labelled `unexercised` with the reason, rather than ticked on an inference. It does not hold SC#4 open —
SC#4 is about the 404-vs-card discrimination, which was observed.

## Clean-up verified

`git status --porcelain apps/web/src` empty; `git diff --exit-code apps/web/src` clean. The fault injection is
gone, the real token is in place, and `07-VERIFICATION.md` / `07-EVIDENCE.md` were not touched — re-running
Phase 7's verification is a command, not a hand edit.

## Operator's next step

Phase 7's verification is expected to move from `human_needed` to `passed` now that both UAT items are closed.
That is `/gsd-verify-work 7`, run **after** plan 08-04's deploy — not now, because SC#1's remaining
deployed-site half belongs to 08-04 and re-verifying twice wastes a cycle.

**Nothing pushed.** All commits remain local for 08-04's single deploy (D-14).
