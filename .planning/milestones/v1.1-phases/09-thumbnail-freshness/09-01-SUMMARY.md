---
phase: 09-thumbnail-freshness
plan: 01
subsystem: ui
tags: [nextjs, image-proxy, notion, ssrf-guard, react]

requires: []
provides:
  - "GET /api/thumbnail/[id] streaming proxy route with four SSRF guards (id-only input, host allowlist, redirect refusal, content-type assertion)"
  - "Second, no-store NologClient instance that bypasses Next's Data Cache for the thumbnail lookup"
  - "Shared PostThumbnail client component (card/hero variants) with onError -> ImageOff placeholder"
  - "Post.thumbnailType on the local apps/web Post type, mirroring packages/core"
affects: [thumbnail-freshness-plan-02, thumbnail-freshness-plan-03]

actuals:
  tokens: 5342
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Second, separately-constructed NologClient with fetchOptions:{cache:'no-store'} for any lookup that must bypass Next's Data Cache — never an un-cache()-wrapped export off the shared singleton (that singleton's constructor-baked next:{revalidate} option survives removal of React's cache() wrapper)"
    - "Streaming proxy route: fetch(url,{redirect:'error'}) then new Response(upstream.body,{...}) passthrough, never .arrayBuffer()/.text() first"
    - "Client-island component receiving already-fetched Server Component data as a plain prop, onError swapping local state to a placeholder icon"

key-files:
  created:
    - "apps/web/src/app/api/thumbnail/[id]/route.ts"
    - "apps/web/src/components/PostThumbnail.tsx"
  modified:
    - "apps/web/src/types/index.ts"
    - "apps/web/src/templates/default/HomePage.tsx"
    - "apps/web/src/templates/default/SearchPage.tsx"
    - "apps/web/src/templates/default/CategoryPage.tsx"
    - "apps/web/src/templates/default/PostPage.tsx"
    - ".planning/phases/09-thumbnail-freshness/09-EVIDENCE.md"

key-decisions:
  - "Post.thumbnailType added to the local apps/web/src/types/index.ts Post interface as its own first commit, strictly before any commit whose diff reads the field, closing landmine 2 in git history order (not just at HEAD)"
  - "The route's fresh lookup is a second, separately-constructed NologClient with fetchOptions:{cache:'no-store'} — never an unwrapped export off the shared apps/web/src/lib/notion.ts singleton, closing landmine 1 (D-14)"
  - "Hostname allowlist duplicated as two literals inside the route rather than importing next.config.ts — no precedent in this repo for importing next.config.ts from application code (09-RESEARCH.md Assumption A1)"
  - "getPost() reused on the fresh client rather than a hand-rolled fetch, inheriting the status!=='public' filter and mapPageToPost()'s file-URL extraction for free"

patterns-established:
  - "Shared client-island thumbnail component consolidates three previously byte-identical card blocks plus one hero block into a single variant-parameterized component"

requirements-completed: [IMG-01, IMG-02, IMG-03, IMG-04, IMG-05]

coverage:
  - id: D1
    description: "GET /api/thumbnail/[id] streams a fresh-resolved Notion thumbnail with all four IMG-03 guards (id-only input, host allowlist, redirect refusal, image/ content-type assertion) and a 4h immutable cache header"
    requirement: "IMG-03"
    verification:
      - kind: other
        ref: "local end-to-end smoke against real Notion credentials — garbage-id=400, absent-uuid=404, resolved-id=200 with locked cache-control/content-type/x-content-type-options headers"
        status: pass
      - kind: other
        ref: "09-EVIDENCE.md Tier 1 rows 6b-8f — source assertions for no-store, single client construction, no shared-module import, zero searchParams, exactly 2 allowlisted hosts, redirect:'error', content-type guard, streaming body, cache header"
        status: pass
    human_judgment: false
  - id: D2
    description: "The uncached lookup runs through a second NologClient with fetchOptions:{cache:'no-store'}, never the shared cached client module — closes the D-14/landmine-1 Data Cache bypass gap"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 1 rows 6a-6d"
        status: pass
    human_judgment: false
  - id: D3
    description: "Local Post type carries thumbnailType, added as its own commit before any file reads it; production build is green"
    requirement: "IMG-05"
    verification:
      - kind: other
        ref: "09-EVIDENCE.md Tier 1 row 7 / 7b; npm run build --workspace=apps/web exits 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "All four default-template surfaces (Home, Search, Category, Post hero) render through the shared PostThumbnail component; no template imports next/image; net line reduction across the four files"
    requirement: "IMG-01"
    verification:
      - kind: other
        ref: "grep -rn next/image apps/web/src/templates/default/ = 0; git diff --stat origin/main..HEAD -- apps/web/src/templates/default/ = +8/-48"
        status: pass
    human_judgment: false
  - id: D5
    description: "PostThumbnail's onError swap to a centred ImageOff icon at the locked token/size, and the external-thumbnail branch that never constructs the proxy path"
    requirement: "IMG-04"
    verification: []
    human_judgment: true
    rationale: "onError firing in a real browser and the visual placement/color of ImageOff in both light and dark themes were not observed in a running browser this plan — source-verified only (component structure, token, size). Plan 09-02 is the live/browser observation tier for this."

duration: ~20min
completed: 2026-08-11
status: complete
---

# Phase 9 Plan 01: Thumbnail Freshness — Proxy Route, Shared Component, Four-Surface Rollout Summary

**New `/api/thumbnail/[id]` streaming proxy resolves Notion's expiring presigned thumbnail URLs
server-side via a second, no-store `NologClient`, replacing four hand-rolled `<Image>` blocks across
`HomePage`, `SearchPage`, `CategoryPage`, and `PostPage` with one shared `PostThumbnail` client
component that falls back to a centred `ImageOff` icon on load failure.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-11T08:30:22Z
- **Tasks:** 3 (Task 1: tracer; Task 2: expand to remaining surfaces; Task 3: evidence sweep)
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- New `GET /api/thumbnail/[id]` route: validates the id via `parsePageId` before any outbound call,
  resolves the post through a second `NologClient` built with `fetchOptions: { cache: "no-store" }`
  (closing the D-14/landmine-1 Data Cache bypass gap), rejects non-`"file"` thumbnailType (IMG-05's
  server-side half), enforces a two-host allowlist mirroring `next.config.ts`, rejects upstream
  redirects via `redirect: "error"`, asserts `content-type` starts with `image/`, and streams
  `upstream.body` directly with a `public, s-maxage=14400, immutable` cache header
- New `PostThumbnail` client component: external thumbnails render `post.thumbnail` unchanged
  (IMG-05), file thumbnails route through the proxy, `onError` swaps to a centred `ImageOff` icon at
  32px (card) / 48px (hero) in `text-text-tertiary`, no caption (D-09)
- Local `apps/web/src/types/index.ts` `Post` interface gained `thumbnailType`, added as its own commit
  strictly before any commit that reads it (closing landmine 2 in git history order, not just at HEAD)
- All four `default`-template surfaces (`HomePage`, `SearchPage`, `CategoryPage`, `PostPage`) now render
  through the one shared component; every `next/image` import in that directory removed; the
  consolidation is a net line reduction (+8/-48)
- `09-EVIDENCE.md` created with a 19-row Tier 1 source-assertion table covering both landmine gates and
  all five hard constraints (`packages/core`, `terminal`, digest route, dependencies, `next.config.ts`)

## Task Commits

Each task was committed atomically:

1. **Task 1, step 1 (landmine 2 fix, own commit per plan's explicit ordering requirement)** - `483536c` (feat)
2. **Task 1, steps 2-4 (route, component, HomePage wiring, tracer)** - `ae3554a` (feat)
3. **Task 2 (expand to Search/Category/Post hero)** - `22de486` (feat)
4. **Task 3 (Tier 1 evidence sweep)** - `692779a` (docs)

_Note: Task 1 (`type="tracer"`) produced two commits instead of one — the plan's own acceptance
criteria required the `thumbnailType` type addition to be "ordered before any commit whose diff reads
that field," which a single combined commit could not literally satisfy in git history order._

## Files Created/Modified
- `apps/web/src/app/api/thumbnail/[id]/route.ts` - New streaming proxy route with all four IMG-03 guards
- `apps/web/src/components/PostThumbnail.tsx` - New shared client component, card/hero variants
- `apps/web/src/types/index.ts` - Added `thumbnailType: "file" | "external" | null` to local `Post`
- `apps/web/src/templates/default/HomePage.tsx` - Thumbnail block replaced with `<PostThumbnail variant="card">`
- `apps/web/src/templates/default/SearchPage.tsx` - Same replacement
- `apps/web/src/templates/default/CategoryPage.tsx` - Same replacement
- `apps/web/src/templates/default/PostPage.tsx` - Hero block replaced with `<PostThumbnail variant="hero">`
- `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` - New; Tier 1 source-assertion table

## Decisions Made
- Split Task 1 into two commits (type widening, then route/component/wiring) to literally satisfy the
  plan's acceptance criterion that the `thumbnailType` addition be "ordered before any commit whose diff
  reads that field" — a stricter reading than "same commit is fine."
- Removed a redundant `try/catch` around `freshNologClient.getPost()` in the route: `getPost()`'s own
  body in `packages/core/src/client.ts` already wraps everything in `try { ... } catch { return null }`
  and never throws to its caller, so an outer catch would be dead code. Kept the code closer to what the
  plan's own skeleton showed.
- No other deviations — the route, component, and four call sites match the plan's action text,
  `09-PATTERNS.md`'s illustrative markup, and `09-UI-SPEC.md`'s locked token/size contract.

## Deviations from Plan

None - plan executed exactly as written, aside from the Task 1 commit split noted above (which is a
stricter application of the plan's own acceptance criterion, not a deviation from it).

## Issues Encountered

None. The end-to-end local smoke test (real `NOTION_TOKEN`/`NOTION_DATABASE_ID` in
`apps/web/.env.local`, confirmed present via a read-only existence/set check, no value read or echoed)
resolved a real Notion page's thumbnail through the full route on the first attempt.

## Next Phase Readiness

- Task 1's tracer feedback gate passed (build, lint-no-new-errors, all grep-based source assertions,
  and the end-to-end smoke all green) before Task 2 expanded to the remaining three surfaces.
- `09-EVIDENCE.md`'s Tier 1 section is in place for plans 09-02 (live curl battery, IMG-03/IMG-04 browser
  observation) and 09-03 (the idle-gap IMG-01/IMG-02 proof) to append their own tiers to.
- Nothing pushed this plan — `git log origin/main..HEAD` lists 4 new commits, all local, ready for
  09-02's deploy task.
- Known coverage gap, not a blocker: the `ImageOff` placeholder's real-browser rendering (both themes,
  both sizes) is source-verified only in this plan — flagged as `human_judgment: true` in the coverage
  block above (D5) for plan 09-02's live observation.

---
*Phase: 09-thumbnail-freshness*
*Completed: 2026-08-11*
