---
status: complete
phase: 08-content-rendering-fix
source: [08-VERIFICATION.md]
started: 2026-08-10T18:30:00Z
updated: 2026-08-10T20:10:00Z
---

# Phase 8 — Human Verification (UAT)

`08-VERIFICATION.md` scored **8/11** and returned `gaps_found`. One of its three gaps was routed to human
verification: the CONT-05 **fetch-failed** sentence had been proven reachable by static review but never
watched rendering. This file closes that by observation.

The other two gaps were evidence/paperwork rather than behaviour and are tracked in
`08-CACHE-EVIDENCE.md`.

## Tests

### 1. CONT-05 fetch-failed sentence renders when the content leg throws
expected: With getPageRecordMap forced to throw, the post page returns HTTP 200 and the content area shows "This post's content could not be loaded right now." — not the no-content sentence, not the pre-Phase-8 combined string, and not the renderer.
result: pass
observed_at: 2026-08-10
source: local production build (npm run build + npm start), fault injected via an env-gated throw in the content leg and reverted immediately after

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]

---

## Test 1 — the fetch-failed half of CONT-05

**Why it was outstanding.** Plan 08-02 observed the **no-content** sentence directly, against a real empty
Notion page. The **fetch-failed** sentence was only ever shown to be reachable by reading the template's
three-way branch. `08-VERIFICATION.md` declined to pass it on that basis — correctly, since "present and
correct on read" versus "observed working" is the exact distinction this milestone exists to keep apart. No
production post is currently empty or failing, so the live site could not supply the observation either.

**Why this is legitimately a local test.** Which of the two sentences renders is a pure control-flow property
of `apps/web/src/app/post/[id]/page.tsx` — it behaves identically wherever the code runs. `PITFALLS.md`
Pitfall 12 rules out `next dev` for the *content-rendering* and *thumbnail* bugs because those are
environmental; this is not. The alternative — breaking the live blog's Notion access to watch what happens —
is strictly worse.

### Procedure

Env-gated `throw` as the first statement of the **content** `try` (the same pattern used for Phase 7's UAT
Test 1: an unconditional throw makes the remainder unreachable and TypeScript drops an earlier
null-narrowing, so gating keeps it compiling and lets one build serve both runs). Production build, cache-
busted request, then reverted.

### Observed

| Expected | Observed |
|---|---|
| HTTP 200 — not a 404, not an error page | **200** |
| `This post's content could not be loaded right now.` present | **1** occurrence |
| `This post has no content yet.` absent | **0** — the correct branch was taken |
| The pre-Phase-8 combined string `Content could not be loaded.` absent | **0** — the split is real, not additive |
| Renderer not entered | **0** skeleton markers |
| Page metadata unaffected | `<title>만년필을 선물 하는 것</title>` rendered normally |
| Exactly one leg-named log line | `[PostPage:recordMap] Error: UAT: forced content-leg failure` |

Rendered markup, verbatim from the served HTML:

```
text-text-secondary italic">This post&#x27;s content could not be loaded right now.
```

**Both CONT-05 states are now directly observed** — no-content in plan 08-02 against a real empty page,
fetch-failed here against a forced failure. Neither rests on inference.

### Clean-up

`git status --porcelain apps/web/src` empty and `git diff --exit-code apps/web/src` clean after reverting;
`npm run build --workspace=apps/web` compiles. The injection was never committed.

---

## Still outstanding (not this file's to close)

**Production environment variable names** — `08-VERIFICATION.md`'s second gap. Plan 08-04 Task 2 asks for an
affirmative listing of Production env var *names* as positive proof of D-19's "zero net new forker-facing env
vars". That reading is only available from the Vercel dashboard and has not been taken. Negative evidence
exists and is recorded in `08-CACHE-EVIDENCE.md` § Still outstanding; the affirmative listing is **not**
claimed.
