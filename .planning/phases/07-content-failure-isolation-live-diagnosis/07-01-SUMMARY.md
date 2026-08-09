---
phase: 07-content-failure-isolation-live-diagnosis
plan: 01
subsystem: api
tags: [nextjs, notion-client, error-handling, diagnostics, ssrf-mitigation]

# Dependency graph
requires: []
provides:
  - "Env-gated deep-diagnostic helper (isDiagnosticsEnabled, describeFetchFailure) in apps/web/src/lib/notion-x.ts"
  - "Secret-gated /api/diagnose-page route for on-demand getPageRecordMap failure reproduction"
  - "Per-concern try/catch decomposition in apps/web/src/app/post/[id]/page.tsx: [PostPage:recordMap] and [PostPage:chrome] legs"
affects: [07-02-plan, 07-03-plan, phase-8-content-fix]

# Actuals (#2632)
actuals:
  tokens: 3400
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-concern try/catch decomposition (content leg before chrome leg) instead of one combined catch, so an unrelated failure cannot null already-fetched data"
    - "Bracket-prefixed single-line-JSON diagnostic logging ([PostPage:recordMap]/[PostPage:chrome]/[DiagnosePage]) gated by an env var that defaults to inert"
    - "Double-gated debug route (feature flag AND bearer secret via timingSafeEqual) returning a byte-identical bare 404 on any gate failure"

key-files:
  created:
    - apps/web/src/app/api/diagnose-page/route.ts
    - .planning/phases/07-content-failure-isolation-live-diagnosis/deferred-items.md
  modified:
    - apps/web/src/lib/notion-x.ts
    - apps/web/src/app/post/[id]/page.tsx

key-decisions:
  - "describeFetchFailure() is the single source of truth for both call sites (page.tsx and the debug route) — no duplicated error-shape discrimination logic"
  - "Lint verification interpreted as 'no new errors from this plan's files' rather than a literal repo-wide zero-error exit, since apps/web/src/templates/terminal/components/TerminalConsole.tsx already fails lint on main, unrelated to this plan and out of scope for v1.1 (terminal template excluded per PROJECT.md) — confirmed via git stash against the pre-plan commit"

patterns-established:
  - "Pattern: env-gated deep diagnostics — ungated callers get name/message only; NOTION_DEBUG_DIAGNOSTICS=1 unlocks status/contentType/bodyExcerpt/pageIdShape/pageIdLength; a raw-fetch probe fires only as a last resort and only when explicitly allowed by the caller"
  - "Pattern: leg-named structured logging — each independently-caught failure path gets its own bracket prefix, so an operator reading logs can always attribute a failure to one specific leg"

requirements-completed: [CONT-01, CONT-04]

coverage:
  - id: D1
    description: "Gated deep-diagnostic helper (isDiagnosticsEnabled, describeFetchFailure) added to lib/notion-x.ts; getPageRecordMap still rethrows unchanged"
    requirement: CONT-01
    verification:
      - kind: integration
        ref: "live local production build: curl against /api/diagnose-page with NOTION_DEBUG_DIAGNOSTICS=1 returned a structured diagnostic envelope (name/message/pageIdShape/pageIdLength/status/contentType/bodyExcerpt)"
        status: pass
    human_judgment: false
  - id: D2
    description: "New /api/diagnose-page route: double gate (flag + bearer secret), bare 404 on any gate failure, SSRF-safe id validation before any outbound request, block-count-only success response"
    requirement: CONT-01
    verification:
      - kind: integration
        ref: "live local production build: missing-Authorization request and wrong-bearer-token request both returned HTTP 404 (byte-identical)"
        status: pass
    human_judgment: false
  - id: D3
    description: "post/[id]/page.tsx split into a content leg ([PostPage:recordMap]) and a chrome leg ([PostPage:chrome]); a chrome-leg failure can no longer null an already-fetched recordMap"
    requirement: CONT-04
    verification:
      - kind: other
        ref: "npm run build --workspace=apps/web (TypeScript compiles, static assertions on file structure pass: two try blocks, notFound() appears exactly once, no error.tsx, old combined-catch message removed from non-comment lines)"
        status: pass
    human_judgment: true
    rationale: "Live confirmation that a chrome-leg failure leaves the post body rendering on the deployed site (a warm-cache single load is not evidence, per PITFALLS 12/15) is explicitly deferred to plan 07-03's operator walkthrough — this plan only closes the structural half."

duration: 45min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 01: Content Failure Isolation & Live Diagnosis Summary

**Gated deep-diagnostic helper + secret-gated `/api/diagnose-page` route in `notion-x.ts`, and a two-`try` content/chrome decomposition of `post/[id]/page.tsx` so a categories/related-posts failure can no longer blank an already-fetched post body.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-09T13:40:00Z
- **Completed:** 2026-08-09T14:20:53Z
- **Tasks:** 2
- **Files modified:** 3 (2 modified, 1 new)

## Accomplishments
- `lib/notion-x.ts` gained `isDiagnosticsEnabled()` and `describeFetchFailure()`, both env-gated: unconfigured forks get only `name`/`message` and zero outbound probe requests; `NOTION_DEBUG_DIAGNOSTICS=1` unlocks `status`/`contentType`/`bodyExcerpt`/`pageIdShape`/`pageIdLength`, with a last-resort raw `loadPageChunk` probe when the caught error carries no HTTP status.
- New `/api/diagnose-page` route reproduces a `getPageRecordMap` failure on demand, gated by both the diagnostics flag and a dedicated bearer secret (`NOTION_DEBUG_ROUTE_SECRET`), returning a byte-identical bare 404 for any gate failure — never a 401 that would confirm the route exists to a prober.
- `post/[id]/page.tsx`'s single combined `try`/`catch` is now two independent legs — content (`getPageRecordMap`) attempted first, chrome (`getCategories`/related-posts `getPosts`) attempted second — so a chrome-leg throw can never null a `recordMap` that already succeeded. This directly resolves CONT-04's reported symptom mechanism.
- Live tracer run (`npm run start` against a local production build) exercised the full path end-to-end: a real failing content fetch produced a structured diagnostic envelope, both unauthorized request shapes returned identical 404s, and the `[DiagnosePage]` log line was written.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "reproduce and describe one getPageRecordMap failure on demand"** - `9fa605a` (feat)
2. **Task 2: Decompose the post route's combined catch into a content leg and a chrome leg** - `cfa7767` (fix)

## Files Created/Modified
- `apps/web/src/lib/notion-x.ts` - `getPageRecordMap` unchanged (still rethrows); adds `isDiagnosticsEnabled()`, `isFetchErrorShape()` type guard, `describePageIdShape()`, and `describeFetchFailure()` (never throws; single-line JSON; gated deep capture + D-04 raw probe)
- `apps/web/src/app/api/diagnose-page/route.ts` (new) - secret-gated GET route: double gate → bare 404, `parsePageId` validation before any outbound call (SSRF mitigation), success returns `{ok, code, blockCount}` only, failure returns the diagnostic envelope with HTTP 200
- `apps/web/src/app/post/[id]/page.tsx` - two-`try` decomposition (content leg, then chrome leg), `[PostPage:recordMap]`/`[PostPage:chrome]` bracket-prefixed logging, D-17 audit comment enumerating every `await` in the file
- `.planning/phases/07-content-failure-isolation-live-diagnosis/deferred-items.md` (new) - logs the pre-existing, unrelated `TerminalConsole.tsx` lint failures found while running this plan's verify step

## Decisions Made
- `describeFetchFailure`'s `allowProbe` parameter is `true` only for the content leg (real `notion-client`/`loadPageChunk` failures the D-04 probe targets) and `false` for the chrome leg (different endpoint, `@notionhq/client` against `api.notion.com` — the probe would describe the wrong request), documented inline at the chrome catch site.
- The debug route's success response returns only a block count, never the recordMap or any page content (T-07-06), and its failure response is HTTP 200 with `ok:false` — a successfully-produced report of a downstream failure is not itself a route failure, and this keeps Vercel's own error classification from adding noise to the diagnostic logs being read.
- Fixed a TypeScript overload error in the D-04 probe's `fetch()` call (a conditionally-spread `cookieHeader` object didn't satisfy `HeadersInit`) by building the headers as an explicit `Record<string, string>` instead — mechanical fix, no behavior change (Rule 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a TypeScript build error in the D-04 probe's fetch headers**
- **Found during:** Task 1 (`npm run build --workspace=apps/web`)
- **Issue:** The conditionally-spread `{ cookie: ... } | {}` header object didn't satisfy `fetch()`'s `HeadersInit` overloads, failing the TypeScript build.
- **Fix:** Replaced the conditional spread with an explicit `Record<string, string>` built via a mutation (`headers.cookie = ...`) only when `NOTION_TOKEN_V2` is set.
- **Files modified:** `apps/web/src/lib/notion-x.ts`
- **Verification:** `npm run build --workspace=apps/web` now exits 0.
- **Committed in:** `9fa605a` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** No scope change — mechanical type-narrowing fix required to reach a passing build, matching the plan's stated field/logic.

## Issues Encountered
- `npm run lint --workspace=apps/web` fails on 15 pre-existing errors/4 warnings, all inside `apps/web/src/templates/terminal/components/TerminalConsole.tsx` (`react-hooks/immutability`, `react/no-unescaped-entities`). Confirmed via `git stash` against the pre-plan commit (`e485605`) that this failure predates this plan and is unrelated to any file this plan touches. The `terminal` template is explicitly out of scope for milestone v1.1 (PROJECT.md). Logged to `deferred-items.md`; this plan's own files (`notion-x.ts`, `diagnose-page/route.ts`, `post/[id]/page.tsx`) lint clean with zero errors/warnings.

## Known Stubs

None. No stub values, placeholder text, or unwired data sources were introduced by this plan.

## User Setup Required

None for this plan's structural changes to take effect (both `NOTION_DEBUG_DIAGNOSTICS` and `NOTION_DEBUG_ROUTE_SECRET` are optional and default to inert). An operator who wants to use the diagnostic route in production must set both env vars in the Vercel dashboard — that live-evidence-capture step belongs to plan 07-03, not this plan.

## Next Phase Readiness
- Plan 07-02 (owning the `getPost` leg) can proceed independently — this plan explicitly left `generateMetadata` and the `getPost(id)` call untouched.
- Plan 07-03's operator walkthrough now has the tooling it depends on: the `/api/diagnose-page` route is live and can reproduce a failing content fetch on demand, without waiting for organic production traffic or Vercel's ~1-hour log retention window.
- The live-evidence half of ROADMAP SC#1 (three fetches reported by three distinct bracket prefixes on the deployed site) and SC#3 (a chrome-leg throw cannot reassign `recordMap`, confirmed against real production traffic) remain open until plan 07-03 runs its operator walkthrough — this plan closes only the structural half of both, per the plan's own `<success_criteria>`.

---
*Phase: 07-content-failure-isolation-live-diagnosis*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all three commits (`9fa605a`, `cfa7767`, `5a5307b`) confirmed in `git log`.
