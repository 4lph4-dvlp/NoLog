# API Coverage — Phase 7 (Content Failure Isolation & Live Diagnosis)

No external API integration: this phase added diagnostics and one uncached call to a Notion REST endpoint the project already consumes, and introduced no new service, no new capability surface, and no new dependency.

---

## Why a declaration rather than a matrix

The `api-coverage.verify-pre` gate fired on this phase with a single signal — the noun `rest`, matched
without a paired verb. Checked rather than dismissed: the matches are real references to Notion's REST API
("one extra Notion REST call", "the Notion REST API returns in dashed-UUID form"), not the English word.
So the detector was not wrong about the text.

It is wrong about the **conclusion**, and the capability's own guidance covers this case: *"If `detected` is
true but the phase genuinely integrates no external API (the detector is deterministic, not infallible —
confirm by re-reading the phase scope, not by preference): do NOT fabricate a matrix row for a capability
that does not exist. Write a reasoned declaration instead."*

**What this phase actually did with Notion's REST API:**

- `apps/web/src/lib/post-availability.ts` calls `GET https://api.notion.com/v1/pages/{id}` with
  `cache: "no-store"`. This is the **same endpoint** `NologClient.getPost()` (`packages/core`, shipped v1.0)
  already calls. It exists as a separate call only because `getPost` is wrapped in React `cache()`, so
  re-invoking it returns a memoised `null` and cannot discriminate a genuine 404 from a transient failure.
- The now-removed `/api/diagnose-page` route called `notion-client`'s unofficial `loadPageChunk` — again, the
  endpoint the site's renderer already used, and that route was deleted in Phase 8 (D-19).

No capability was added, so there is no capability set to decide `INTEGRATE` / `OPT-OUT` over. Enumerating
Notion's full REST surface here — pages, databases, blocks, users, comments, search, file uploads — would
manufacture a matrix for an integration this phase did not perform, which is the exact failure the guidance
names.

## What this declaration does NOT claim

It does not claim NoLog has a decided coverage matrix for Notion's API. It does not. That enumeration, if it
is ever wanted, belongs to the phase that **integrated** Notion — v1.0 Phase 1 (Notion Data Layer) — not to a
diagnostic phase that read one more page. Recording that plainly here so a later reader does not mistake this
declaration for "coverage was reviewed and found complete."

## Constraints this phase held to

- No new npm dependency (REQUIREMENTS.md D-07) — verified in `07-REVIEW.md`.
- `packages/core` unmodified (D-05) — verified by `git diff` over the phase's commit range.
- The diagnostic surfaces this declaration describes were removed in Phase 8 under D-19; the only survivor
  touching Notion directly is `classifyMissingPost`, which serves ROADMAP SC#4.

---

*Declared 2026-08-10, during `/gsd-verify-work 7`, resolving the `api-coverage.verify-pre` blocking gate.*
