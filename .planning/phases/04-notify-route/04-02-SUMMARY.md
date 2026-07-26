---
phase: 04-notify-route
plan: 02
subsystem: api
tags: [nextjs, notion, email, typescript]

# Dependency graph
requires:
  - phase: 04-notify-route (plan 01)
    provides: "GET /api/notify-subscribers route, buildSectionHtml() text-only section builder, [Notify]-prefixed logging convention"
provides:
  - "Post.thumbnailType (\"file\" | \"external\" | null) on the published core package's Post model"
  - "getFileType() extractor mirroring getFileUrl()'s key-fallback logic, wired into mapPageToPost()"
  - "getEmbeddableThumbnailUrl() gate in the digest route: emits an <img> only for an external, absolute-https thumbnail URL"
  - "Single per-run [Notify] downgrade-count log line when one or more sections lost their thumbnail"
affects: [04-03-live-verification, 05-production-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-extractor duplication over shared-helper refactor: getFileType() reads files[0] independently of getFileUrl() rather than factoring out a shared lookup, so a change scoped to the digest cannot regress the live site's existing thumbnail path"
    - "Section-builder return-shape widening (string -> { html, downgraded }) as the mechanism for surfacing a per-section signal to a run-level accumulator, avoiding module-scope mutable state that would leak across concurrent invocations"

key-files:
  created: []
  modified:
    - packages/core/src/types.ts
    - packages/core/src/client.ts
    - apps/web/src/app/api/notify-subscribers/route.ts

key-decisions:
  - "Adopted 04-RESEARCH.md option (a) — expose the file-vs-external distinction on the Post model — over option (b) (send-time re-fetch), per the plan's locked prohibition; Post is a published type on @4lph4/nolog-core, so this is treated as a public-surface addition, not a private one"
  - "CONTEXT.md's `<code_context>` note (\"Nothing in packages/core changes in this phase\") is superseded for this plan by 04-RESEARCH.md Pitfall 1, which was found by direct codebase inspection after that note was written; the two-line core change is the only way to recover the file/external distinction inside apps/web without a URL-shape heuristic"

patterns-established:
  - "Digest thumbnail embedding requires BOTH thumbnailType === \"external\" AND URL constructor confirms an absolute https URL — a malformed or Notion-hosted value silently downgrades to the existing D-05 text-only rendering rather than emitting a broken or unsafe src"

requirements-completed: [NOTIFY-01]

coverage:
  - id: D1
    description: "Post.thumbnailType reports \"file\" for a Notion-uploaded image, \"external\" for a pasted URL, and null when the thumbnail property is absent or empty, asserted against the built package with no live Notion credentials"
    requirement: "NOTIFY-01"
    verification:
      - kind: unit
        ref: "node assertion against packages/core/dist/index.js (see Task 1 <verify> in 04-02-PLAN.md) — asserts mapPageToPost() thumbnailType for file/external/empty files arrays and confirms thumbnail (getFileUrl) is unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "A pasted external thumbnail is embedded as an <img> in the digest; a Notion-uploaded thumbnail and a missing thumbnail both render text-only with no img element, no placeholder, and no site-wide fallback"
    requirement: "NOTIFY-01"
    verification:
      - kind: unit
        ref: "static grep assertions on route.ts: exactly one non-comment <img occurrence, guarded by thumbnailType === \"external\", URL()/protocol check present, no /api/og reference, no fallback/placeholder src"
        status: pass
      - kind: integration
        ref: "npx tsc --noEmit and npx eslint route.ts against packages/core rebuilt with thumbnailType"
        status: pass
    human_judgment: true
    rationale: "Structural/type checks confirm the gating logic is wired correctly, but visually confirming an embedded image renders in a real mail client and a downgraded section renders cleanly text-only requires a live Resend send against real Notion data — carried to 04-03's operator verification checkpoint, same posture as 04-01's D4/D5"
  - id: D3
    description: "Route-level non-regression: header-less GET 401, wrong-Bearer GET 401, correct-Bearer GET 200 unconfigured, POST /api/subscribe 404 all still hold after the thumbnail branch is added; broadcasts.create remains the sole non-comment occurrence and still precedes markEmailed"
    requirement: "SEC-01"
    verification:
      - kind: manual_procedural
        ref: "curl probes against a local `next dev -p 3999` instance with CRON_SECRET set and RESEND_API_KEY/RESEND_AUDIENCE_ID unset: no-header GET -> 401, wrong-Bearer GET -> 401, correct-Bearer GET -> 200 {\"code\":\"unconfigured\"}, POST /api/subscribe -> 404"
        status: pass
      - kind: other
        ref: "grep -c 'broadcasts.create' route.ts == 1; broadcasts.create line number < first await markEmailed( line number"
        status: pass
    human_judgment: false

# Metrics
duration: ~10min
completed: 2026-07-27
status: complete
---

# Phase 4 Plan 2: Digest Thumbnail Expiry Fix Summary

**`Post.thumbnailType` discriminator plus a digest thumbnail gate that embeds only permanent external URLs and silently downgrades Notion-hosted presigned URLs (which expire one hour after fetch) to text-only, with a single per-run operator log line reporting the downgrade count.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-26T23:54:35Z
- **Completed:** 2026-07-26T23:57:51Z
- **Tasks:** 2 completed
- **Files modified:** 3 (0 created, 3 edited)

## Accomplishments

- Added `Post.thumbnailType: "file" | "external" | null` to the published `@4lph4/nolog-core` `Post` interface, JSDoc'd with the one-hour presigned-URL expiry and a citation to `developers.notion.com/docs/retrieving-files`
- Added a module-private `getFileType()` extractor in `packages/core/src/client.ts` that mirrors `getFileUrl()`'s key/fallback/`files[0]` lookup exactly, deliberately not refactored into a shared helper, and wired it into `mapPageToPost()` alongside the existing `thumbnail` field
- Added `getEmbeddableThumbnailUrl()` to the notify route: emits an `<img>` only when `thumbnailType === "external"` AND the stored URL parses via `new URL()` with `protocol === "https:"`; every other case (Notion-hosted, missing, malformed) renders identically to D-05's existing no-thumbnail text-only path
- Widened `buildSectionHtml()`'s return shape from a bare string to `{ html, downgraded }` so the section-assembly loop can accumulate a downgrade count without introducing module-scope mutable state
- Added exactly one `[Notify]`-prefixed `console.log` line, emitted once per run after the assembly loop, reporting how many posts lost their thumbnail and the remedy (paste a public image URL)

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose the Notion file-vs-external distinction on the Post model** - `f483ec5` (feat)
2. **Task 2: Render an image only when it will still resolve when the mail is opened** - `ba8b133` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified

- `packages/core/src/types.ts` — `Post.thumbnailType` field, JSDoc'd with the expiry mechanism and the "treat file as no-thumbnail" consumer contract
- `packages/core/src/client.ts` — new `getFileType()` extractor mirroring `getFileUrl()`; `mapPageToPost()` gains one property assignment
- `apps/web/src/app/api/notify-subscribers/route.ts` — new `getEmbeddableThumbnailUrl()` gate, `buildSectionHtml()` return-shape change, downgrade-count accumulation and single summary log line

## Decisions Made

- Adopted `04-RESEARCH.md` option (a) exactly as the plan specified: the type distinction lives on the `Post` model rather than being re-derived at send time via a second Notion fetch (rejected as adding per-post API calls and reintroducing the same expiry window at smaller scale).
- Diverged from `04-CONTEXT.md`'s `<code_context>` observation that "nothing in `packages/core` changes in this phase" — that note predates `04-RESEARCH.md` Pitfall 1, which was found by direct codebase inspection during the later research pass. The plan flags this explicitly rather than making the change quietly; recorded here per the plan's `<output>` instruction. `@4lph4/nolog-core` version 1.0.1 now carries `thumbnailType` in source that its published `dist` did not — a future publish of that package should treat `thumbnailType` as part of its public surface (it is additive and backward-compatible: existing consumers reading only `thumbnail` are unaffected).
- `getFileType()` deliberately duplicates `getFileUrl()`'s `files[0]` selection logic rather than sharing a helper, per the plan's explicit instruction — keeps the live site's image path (every page using `thumbnail`) untouched by a change that only the digest needs.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria, the node assertion against the built `packages/core` package, `tsc`/`eslint` checks in `apps/web`, the structural grep assertions on `route.ts`, and all four dev-server probes (no-header 401, wrong-Bearer 401, correct-Bearer 200 unconfigured, POST /api/subscribe 404) passed without requiring any auto-fix.

## Issues Encountered

- The harness's plain `&` backgrounding for `next dev` was killed immediately with no log output on the first attempt (same documented pattern as `03-VALIDATION.md` and `04-01-SUMMARY.md`). Switched to `setsid ... & disown` launched via the `run_in_background` Bash parameter, which started and stayed up cleanly for both verification runs (thumbnail-branch probes, then a follow-up run to independently confirm the wrong-Bearer 401 case that the plan's acceptance criteria reference but its automated `<verify>` block did not curl directly).

## User Setup Required

None — no external service configuration required by this plan. `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, and `CONFIG.notify.*` all remain unset in this repo by design; the thumbnail gate is exercised structurally and via the node/tsc/eslint/curl checks above, not against a live Notion database.

## Next Phase Readiness

- `NOTIFY-01`'s thumbnail-expiry closure is done at the type/structural level: `Post.thumbnailType` is populated, the digest route gates on it correctly, and `getFileUrl()`/every existing `Post` field is unchanged (verified by the node assertion in Task 1).
- Visually confirming an embedded external thumbnail renders in a real inbox, and a Notion-hosted thumbnail correctly renders text-only, both require live Resend/Notion credentials — carried to `04-03-PLAN.md`'s operator verification checkpoint, consistent with `04-01-SUMMARY.md`'s D4/D5 carry-forward and every prior phase's identical live-credential blocker.
- `04-03-PLAN.md` can proceed — it depends on nothing this plan left incomplete; the route file it will further verify now carries the thumbnail branch as its final structural shape for this phase.

---
*Phase: 04-notify-route*
*Completed: 2026-07-27*

## Self-Check: PASSED

- FOUND: packages/core/src/types.ts
- FOUND: packages/core/src/client.ts
- FOUND: apps/web/src/app/api/notify-subscribers/route.ts
- FOUND: .planning/phases/04-notify-route/04-02-SUMMARY.md
- FOUND commit: f483ec5
- FOUND commit: ba8b133
