---
phase: 07-content-failure-isolation-live-diagnosis
plan: 02
subsystem: content-rendering
tags: [nextjs, notion-api, error-handling, ssrf-mitigation, seo]

# Dependency graph
requires:
  - phase: 07-content-failure-isolation-live-diagnosis (plan 01)
    provides: "isDiagnosticsEnabled() gate in apps/web/src/lib/notion-x.ts; two-try leg decomposition in post/[id]/page.tsx ([PostPage:recordMap]/[PostPage:chrome])"
provides:
  - "classifyMissingPost() discriminator (apps/web/src/lib/post-availability.ts) — distinguishes a Notion-authoritative 404 from a transient fetch failure on a null getPost() result, without modifying packages/core"
  - "PostUnavailable reader-facing component (apps/web/src/components/PostUnavailable.tsx) — reachable, not written-but-dead"
  - "notFound() in post/[id]/page.tsx scoped to genuinely-missing posts only; PostUnavailable rendered for transient failures at HTTP 200; generateMetadata's not-found branch noindexed"
affects: [07-03-plan, phase-8-content-fix]

# Actuals (#2632)
actuals:
  tokens: 2900
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App-level discriminator pattern: when a published-package method swallows all failures to null, resolve the ambiguity with a second, purpose-built outbound request scoped strictly to the already-failed branch, rather than modifying the package or retrying the memoised call"
    - "Soft-200 unavailable state with robots noindex on the sibling not-found metadata branch, closing the SEO exposure a non-404 recoverable state introduces"

key-files:
  created:
    - apps/web/src/lib/post-availability.ts
    - apps/web/src/components/PostUnavailable.tsx
  modified:
    - apps/web/src/app/post/[id]/page.tsx

key-decisions:
  - "classifyMissingPost() never retries getPost() (React cache()-memoised, would be a no-op) and never re-derives the status property (CR-01 duplication risk) — it asks Notion's /v1/pages/{id} endpoint directly with cache: 'no-store', exactly once, only inside the already-null branch"
  - "URL built from parsePageId(pageId)'s return value only, never the raw route-segment parameter, closing the SSRF/injection threat (T-07-07) on this new outbound call"
  - "Unconfigured-token and invalid-page-id cases short-circuit to verdict 'missing' with zero network calls — an unconfigured fork's 404 behavior is byte-identical to pre-plan behavior"

patterns-established:
  - "Pattern: null-result discriminator — a second outbound request, gated to run only after a first call has already returned an ambiguous null, resolving 'doesn't exist' vs 'couldn't be fetched' without touching the first call's own (unmodifiable) implementation"

requirements-completed: [CONT-04]

coverage:
  - id: D1
    description: "classifyMissingPost() discriminates a null getPost() result into 'missing' (Notion 404, invalid id, or non-public/unparseable page) vs 'unavailable' (401/403/429/5xx or a thrown fetch), never throws to its caller, and issues at most one outbound request only on the already-failed path"
    requirement: CONT-04
    verification:
      - kind: other
        ref: "npm run build --workspace=apps/web (TypeScript compiles); grep-verified literal presence of the endpoint prefix, 2022-06-28 version, no-store, parsePageId, isDiagnosticsEnabled, and unconfigured in the file; source read confirms the fetch is inside try/catch with catch returning 'unavailable' rather than rethrowing, and the token-unset branch returns before any fetch"
        status: pass
    human_judgment: false
  - id: D2
    description: "PostUnavailable renders the approved 07-UI-SPEC.md contract: CloudOff icon in text-warning, exact heading and body copy with max-w-md (no overflow), 'Back to feed' link, no use client, no locale branching, no fixed-height class"
    requirement: CONT-04
    verification:
      - kind: other
        ref: "npm run lint (new files clean) + npm run build --workspace=apps/web; grep-verified all required literal strings/classes present and all three prohibited patterns (use client, site.config, h-[) absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "post/[id]/page.tsx: !post branch calls classifyMissingPost() before notFound(); 'unavailable' verdict logs [PostPage:post] and returns PostUnavailable at plain HTTP 200; 'missing' verdict calls notFound() (still the file's only call, still outside every try) with no log line; generateMetadata's not-found branch adds robots noindex; D-17 audit comment updated to cover the new await"
    requirement: CONT-04
    verification:
      - kind: other
        ref: "npm run build --workspace=apps/web; grep-verified all required literals present, notFound() occurs exactly once, packages/core and package manifests show zero diff; source read confirms notFound() is lexically outside every try block and unstable_rethrow appears only in the explanatory comment, never called"
        status: pass
    human_judgment: true
    rationale: "Live confirmation that a real transient Notion failure on the deployed site actually renders PostUnavailable instead of a 404 cannot be produced locally (next dev has no ISR, and a local production build cannot reproduce a live Notion outage — PITFALLS 12) — this half of ROADMAP SC#4 is explicitly deferred to plan 07-03's operator walkthrough, matching this plan's own <success_criteria>."

duration: 25min
completed: 2026-08-09
status: complete
---

# Phase 7 Plan 02: Content Failure Isolation & Live Diagnosis Summary

**App-level `classifyMissingPost()` discriminator plus a reachable `PostUnavailable` state, so a post that exists and is public no longer 404s when its metadata fetch merely fails transiently.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-09T14:24:00Z
- **Completed:** 2026-08-09T14:49:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 new)

## Accomplishments
- New `apps/web/src/lib/post-availability.ts` exports `classifyMissingPost(pageId)`, which resolves a `null` `getPost()` result into a `"missing"` or `"unavailable"` verdict by issuing exactly one fresh, uncached (`cache: "no-store"`) request to `https://api.notion.com/v1/pages/{parsePageId(pageId)}` — never the memoised `getPost()` call, never `packages/core` — and never throws to its caller.
- New `apps/web/src/components/PostUnavailable.tsx` implements `07-UI-SPEC.md`'s approved contract exactly: bordered `bg-surface` card, `CloudOff` icon in `text-warning`, the exact heading/body copy with `max-w-md` on the body paragraph, and a `Back to feed` link — reachable now, not written-but-dead.
- `apps/web/src/app/post/[id]/page.tsx`'s `!post` branch now calls `classifyMissingPost(id)` before `notFound()`: an `"unavailable"` verdict logs `[PostPage:post] {detail}` and returns `<PostUnavailable />` at a plain HTTP 200; a `"missing"` verdict falls through to the unchanged `notFound()` call (still the file's only call, still outside every `try`) with no log line. `generateMetadata`'s not-found branch now also emits `robots: { index: false, follow: false }`, closing the SEO exposure the soft-200 state introduces.
- Structurally closes ROADMAP SC#4: `notFound()` is reachable only on a Notion-authoritative answer, and no fetch leg in `post/[id]/page.tsx` is left able to throw uncaught.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the availability discriminator and the transient-unavailable component** - `16cf8ca` (feat)
2. **Task 2: Scope notFound() to genuinely-missing posts and render PostUnavailable otherwise** - `0a1a57b` (fix)

## Files Created/Modified
- `apps/web/src/lib/post-availability.ts` (new) - `classifyMissingPost()`: 4-way resolution order (unconfigured token → no call; invalid `parsePageId` → no call; Notion 404/2xx → `"missing"`; any other status or thrown fetch → `"unavailable"`); gated diagnostic payload reuses `isDiagnosticsEnabled()` from `lib/notion-x.ts`; module-scope `unconfiguredLogged` latch copied from `subscribe/route.ts`'s pattern
- `apps/web/src/components/PostUnavailable.tsx` (new) - props-less Server Component, no `"use client"`, no `CONFIG`/locale import, implements the UI-SPEC's markup shape verbatim
- `apps/web/src/app/post/[id]/page.tsx` - `!post` branch now discriminates before `notFound()`; `generateMetadata`'s not-found branch adds `robots: { index: false, follow: false }`; D-17 audit comment extended with the new `classifyMissingPost()` await and its never-throws justification

## Decisions Made
- Followed the plan's resolved engineering question (option (a): add an app-level discriminator) rather than accepting the residual SC#4 gap — the mechanism is one extra Notion REST call, on an already-failed path, with no new dependency and no change to `packages/core` (REQUIREMENTS.md D-05).
- Kept the interface signature as `Promise<{ verdict: MissingPostVerdict; detail: string }>` (inline object type, not a separate `interface`) to match the plan's literal spec exactly.
- Deliberately did not import or call `unstable_rethrow` — the current structure never puts `notFound()` inside a `try`, so the guard is unneeded; it appears only in an explanatory comment (confirmed by grep + source read that it is never invoked), keeping an unused-import lint error from being introduced.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` specifications; all listed `<verify>` automated checks and `<acceptance_criteria>` passed on first execution with no auto-fixes required.

## Issues Encountered
- `npm run lint --workspace=apps/web` (repo-wide) still fails on the same 15 pre-existing errors/4 warnings confined entirely to `apps/web/src/templates/terminal/components/TerminalConsole.tsx`, already documented as out-of-scope in `07-01-SUMMARY.md`/`deferred-items.md` (unrelated to this plan, terminal template excluded from v1.1 per `PROJECT.md`). Verified this plan's own three files (`post-availability.ts`, `PostUnavailable.tsx`, `post/[id]/page.tsx`) lint clean in isolation via `npx eslint <files>`.

## Known Stubs

None. No stub values, placeholder text, or unwired data sources were introduced by this plan.

## User Setup Required

None. `classifyMissingPost()` reuses the existing `NOTION_TOKEN` (already required for the app to function at all) and the existing `NOTION_DEBUG_DIAGNOSTICS` gate introduced by plan 07-01 — both already optional/inert-by-default for a forker who sets nothing extra.

## Next Phase Readiness
- Plan 07-03's operator walkthrough now has both structural halves of ROADMAP SC#4 to confirm live: this plan's `PostUnavailable` reachability (a real transient Notion failure on the deployed site renders the card instead of a 404) and plan 07-01's leg-isolation/diagnostic tooling.
- `07-UI-SPEC.md`'s `PostUnavailable` component is confirmed reachable in the render tree, not written-but-dead — the outcome the UI-SPEC's own Scope section flagged as the one to avoid.
- Phase 8 (content fix, CONT-03/CONT-05) can proceed once 07-03's live evidence is captured; this plan changed nothing about the root-cause investigation, only the failure-mode isolation around it.

---
*Phase: 07-content-failure-isolation-live-diagnosis*
*Completed: 2026-08-09*

## Self-Check: PASSED

All created/modified files confirmed present on disk (`apps/web/src/lib/post-availability.ts`, `apps/web/src/components/PostUnavailable.tsx`, `apps/web/src/app/post/[id]/page.tsx`); both task commits (`16cf8ca`, `0a1a57b`) confirmed in `git log`.
