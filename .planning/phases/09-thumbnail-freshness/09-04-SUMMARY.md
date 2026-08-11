---
phase: 09-thumbnail-freshness
plan: 04
subsystem: ui
tags: [nextjs, react-server-components, rsc, image, next-image, thumbnail, security]

# Dependency graph
requires:
  - phase: 09-thumbnail-freshness
    provides: "09-01/09-02/09-03's thumbnail proxy route, PostThumbnail component, and the phase's tiered evidence record; specifically the G-09-1 finding from 09-02 (presigned URL still serialised into the RSC flight payload)"
provides:
  - "PostThumbnailImage.tsx — the only Client Component in the thumbnail path, with a three-primitive prop interface (src, alt, variant)"
  - "PostThumbnail.tsx converted to a Server Component holding the guard and file-vs-external resolution; call-site signature unchanged for all four default-template surfaces"
  - "09-EVIDENCE.md Tier 4 (partial — local proof + deployed before-control; after-measurement and 09-VERIFICATION.md CORRECTION deferred to Task 3, which is blocked)"
affects: [10-sidebar-collapse]

actuals:
  tokens: 2600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Server/Client boundary narrowing: a Server Component resolves data and passes only the primitives a Client Component needs, never the full domain object — the same pattern CommentSection.tsx already used ({postId, postTitle}, not {post})"

key-files:
  created:
    - apps/web/src/components/PostThumbnailImage.tsx
  modified:
    - apps/web/src/components/PostThumbnail.tsx
    - .planning/phases/09-thumbnail-freshness/09-EVIDENCE.md

key-decisions:
  - "Task 1 executed exactly as designed: PostThumbnail split into a Server Component (guard + resolution) and a new Client Component PostThumbnailImage (three primitives: src, alt, variant). No architectural deviation from the plan's <design> section."
  - "Task 2 executed exactly as designed: local production proof passed (zero amazonaws.com/X-Amz-* on both bodies, non-zero proxy-path refs — vacuity guard held), and the deployed before-control reproduced Tier 2's 3-and-1 amazonaws.com figures exactly."
  - "Task 3 (push to origin/main, confirm live deploy, run the closure measurement, correct 09-VERIFICATION.md) is NOT executed. This plan is running inside a wave-based worktree-isolated parallel executor, a context this plan's <precondition> and <action> text did not anticipate (it assumes a single linear executor that pushes directly, per 09-02's precedent). Pushing origin/main from an unmerged worktree branch would ship only this plan's changes while bypassing the orchestrator's wave-merge step — exactly the 'route around the refusal' the plan's own task text forbids. Per the plan's own instruction ('if the environment refuses the push, stop and return a checkpoint asking the orchestrator or operator to perform it'), Task 3 is deferred to the orchestrator after this wave merges."

patterns-established:
  - "Server Component resolves + narrows; Client Component receives only primitives — apply this pattern to any future post-render surface that needs client-side interactivity (onError, useState, etc.) but touches Notion-hosted secret-bearing fields."

requirements-completed: [IMG-01, IMG-02, IMG-04, IMG-05]

coverage:
  - id: D1
    description: "PostThumbnail split across the server/client boundary — PostThumbnailImage.tsx (Client, 3 primitive props) + PostThumbnail.tsx (Server, holds Post and the resolution)"
    requirement: "IMG-01"
    verification:
      - kind: other
        ref: "Task 1 <verify> block — client-directive placement, prop-member count (3), types-barrel/thumbnailType absence in the client file, all-four-call-sites-unchanged assertions; npm run build/lint both exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Local production proof: zero amazonaws.com/X-Amz-* occurrences on home and post bodies served by a real next start build against live Notion data, with non-zero proxy-path references confirming the pages actually rendered posts"
    requirement: "IMG-02"
    verification:
      - kind: manual_procedural
        ref: "09-EVIDENCE.md Tier 4, 'Local production proof' table"
        status: pass
    human_judgment: false
  - id: D3
    description: "Deployed before-control reproduces Tier 2's 3-and-1 amazonaws.com figures, establishing the before/after pair inside one document"
    verification:
      - kind: manual_procedural
        ref: "09-EVIDENCE.md Tier 4, 'Deployed before-control' table"
        status: pass
    human_judgment: false
  - id: D4
    description: "Task 3 — push to origin/main, deploy-liveness confirmation, deployed closure measurement (must show 0 amazonaws.com/X-Amz-* on the live site), and the 09-VERIFICATION.md CORRECTION"
    verification: []
    human_judgment: true
    rationale: "Requires pushing to origin/main and triggering/observing a live Vercel deploy, an operation this worktree-isolated parallel executor structurally cannot perform without bypassing the orchestrator's wave-merge step. Deferred per the plan's own instruction to stop and hand off rather than route around a push refusal."

duration: ~35min
completed: 2026-08-12
status: halted
---

# Phase 09 Plan 04: Thumbnail RSC Boundary Split (Tasks 1-2 of 3) Summary

**Split `PostThumbnail` into a Server Component (holds `Post`, resolves the src) and a new `PostThumbnailImage` Client Component (three primitives only), closing the RSC flight-payload leak at the source — Task 3's deploy-and-measure step is deferred to the orchestrator.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 of 3 completed; Task 3 halted at its `<precondition>` gate
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `PostThumbnailImage.tsx` created as the repo's second narrowed-props Client Component (after `CommentSection.tsx`'s `{postId, postTitle}` precedent) — its prop interface is exactly `{ src: string; alt: string; variant: "card" | "hero" }`, never importing the local types barrel or naming `thumbnailType`.
- `PostThumbnail.tsx` converted to a Server Component: no client directive, same `{ post: Post; variant }` signature all four `templates/default/*` call sites already use unchanged, holds the `!post.thumbnail` guard and the `thumbnailType === "external"` resolution, then renders `PostThumbnailImage` with the resolved primitives.
- Local production proof (`next start`, real Notion credentials, real page): zero `amazonaws.com` and zero `X-Amz-Signature`/`X-Amz-Credential` occurrences on both the home feed and a post detail page, with non-zero distinct `/api/thumbnail/{uuid}` references on each — the vacuity guard held, so the zeros are real absences, not an empty page.
- Deployed before-control (the site as it stands before this plan's fix ships) reproduced Tier 2's recorded figures exactly: 3 `amazonaws.com` occurrences on `/`, 1 on `/post/{id}`.
- `09-EVIDENCE.md` Tier 4 section created, holding both captures as tables, with the redaction discipline intact (`grep -cE 'X-Amz-(Signature|Credential)'` over the document returns `0`).

## Task Commits

Each completed task was committed atomically:

1. **Task 1: Split the thumbnail client boundary — three primitives across, nothing else** - `d93e190` (feat)
2. **Task 2: Prove it against a real production build before spending a deploy, and capture the before-pair** - `b221191` (docs)

**Task 3: NOT executed** — halted at its `<precondition>` gate (see Deviations below). No commit.

_Note: this plan carries no `tdd="true"` tasks; both commits above are single, non-TDD task commits._

## Files Created/Modified

- `apps/web/src/components/PostThumbnailImage.tsx` - New Client Component; three-primitive props (`src`, `alt`, `variant`); holds the `failed` state, `onError` swap to `ImageOff`, and the unchanged wrapper/icon markup moved verbatim from the pre-split file
- `apps/web/src/components/PostThumbnail.tsx` - Now a Server Component; unchanged call-site signature (`{ post, variant }`); holds the no-thumbnail guard and the file-vs-external `src` resolution; JSDoc extended with the "must stay a Server Component" invariant this change exists to enforce
- `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` - Tier 4 section added: local production proof table + deployed before-control table + liveness-signal note (5 chunk filenames saved for Task 3)

## Decisions Made

- Task 1 and Task 2 executed with zero deviation from the plan's `<design>` and `<action>` text — the boundary split, prop interface, and evidence-capture method all match what was specified.
- Task 2's deployed-before-control raw (unescaped) proxy-path-reference count came back `0` on both bodies, which is expected rather than a vacuity-guard failure: before this plan's fix, the pre-split `PostThumbnail` computed its `src` internally from the whole serialized `post` object rather than receiving `src` as a passed Client Component prop, so the raw literal `/api/thumbnail/{uuid}` string never appears unescaped in that deploy's RSC payload — only the percent-encoded form inside the `<img>` optimizer URL does (confirmed present at 3 and 1 distinct occurrences). The `amazonaws.com` counter (unaffected by this distinction) is what actually reproduces Tier 2's figures, and it does so exactly. Documented in `09-EVIDENCE.md` Tier 4 rather than left as an unexplained zero.
- **Task 3 deferred to the orchestrator (see Deviations below) — the load-bearing decision of this summary.**

## Deviations from Plan

### Structural — Task 3 halted at its precondition gate

**[Plan structural mismatch] Task 3 requires `git push origin/main` and a live-deploy measurement; this execution runs inside a wave-based, worktree-isolated parallel executor that cannot perform that step.**

- **Found during:** Task 3's `<precondition>` check, before any action was taken.
- **Issue:** Task 3's precondition reads: "`origin/main` is reachable and the execution environment permits `git push`; 09-02 recorded that its push was refused by the environment's permission classifier and had to be performed by the orchestrator." This plan (and 09-02's precedent it cites) was authored assuming a single linear executor that commits directly toward `main` and can attempt (and potentially have refused) a push to `origin/main`. This execution instance is instead a parallel worktree agent on branch `worktree-agent-ac47b4f8d37d1ba90`, whose commits are local to that branch until the orchestrator merges this wave's worktrees. Pushing this branch to `origin/main` directly would (a) ship only this plan's two-task diff while bypassing whatever else the orchestrator's wave-merge is coordinating, and (b) constitute exactly the "route around the refusal" the plan's own task text explicitly forbids — the correct response to a push obstacle, per the plan's own words, is to "stop and return a checkpoint asking the orchestrator or operator to perform it," not to find a path around it.
- **Fix:** Did not attempt the push. Tasks 1 and 2 are complete and committed on this worktree branch. Task 3 (push, deploy-liveness confirmation via the chunk-set diff already captured in Task 2, the deployed closure measurement, and the `09-VERIFICATION.md` `## CORRECTION` section) is left for the orchestrator to run after this wave's worktree is merged into `main` — at that point `origin/main` will actually contain this plan's Task 1 fix, which is a precondition for Task 3's own measurement being meaningful.
- **Files modified:** None (no action taken for Task 3).
- **Verification:** N/A — nothing was executed for this task. The precondition check itself was read-only (git remote/branch inspection only; no push attempted).
- **Committed in:** N/A (no commit for Task 3).

---

**Total deviations:** 1 (structural halt, not an auto-fixable Rule 1-3 deviation — a Rule 4-adjacent architectural/environmental mismatch between the plan's assumed execution context and this wave's actual one).
**Impact on plan:** Tasks 1 and 2 fully satisfy their own `<done>` criteria and are committed. Task 3's push-and-measure step, and the resulting `09-VERIFICATION.md` correction and `STATE.md` blocker closure, remain open until the orchestrator completes the wave merge and either runs Task 3 itself or re-dispatches it to a non-worktree-isolated executor context.

## Issues Encountered

- The worktree lacked `node_modules` (workspace-hoisted `next`, `eslint`, etc.) and `packages/core/node_modules` (`tsup`), since these are gitignored and not carried into a fresh worktree checkout. Symlinked both from the main repo checkout (`/home/alpha-pi/dev/NoLog/node_modules` → worktree `node_modules`; same for `packages/core/node_modules`) so `npm run build`/`npm run lint --workspace=apps/web` could run. Confirmed both symlinks are themselves gitignored (`git status --ignored`) and were not staged in either commit.
- Same gap for `apps/web/.env.local` (gitignored, holds `NOTION_TOKEN`/`NOTION_DATABASE_ID`, required by Task 2's precondition): symlinked from the main repo checkout rather than copying or reading its contents. The precondition check itself never read, echoed, or logged any credential value — only `grep -qE '^VAR=.+' `'s exit status was used, per the precondition's own instruction.
- Local `next start` on port 3210 left one lingering listener after the first `pkill -f 'next start -p 3210'` (process group mismatch with `setsid`); found and killed the specific PID directly (`kill -9 301146`), then confirmed `ss -ltnp | grep -c ':3210'` returned `0` before proceeding to the deployed captures.

## User Setup Required

None - no external service configuration required. (Task 3, when it runs, requires a `git push` to `origin/main` with deploy access to `4lph4-bl0g.vercel.app` — an orchestrator/operator-level capability, not a forker-facing setup step.)

## Next Phase Readiness

**Not ready to close gap G-09-1 or Phase 9 yet.** Tasks 1-2 (the code fix and its local + before-control proof) are done and committed on this worktree branch. What remains, entirely inside Task 3, once this wave is merged to `main`:

1. `git push` to `origin/main` (triggers the Vercel deploy carrying this plan's fix, plus whatever else this wave/other waves contribute).
2. Confirm the new deploy is live via the chunk-filename-set diff (`09-EVIDENCE.md` Tier 4 already holds the 5-filename before-set from Task 2, ready for this comparison).
3. Run the deployed closure measurement on `/` and `/post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5`: gate is 0 `amazonaws.com` and 0 `X-Amz-Signature`/`X-Amz-Credential` occurrences on both bodies, alongside a non-zero distinct proxy-path count (3 and 1, matching Tier 2's ids) and each of those paths returning `200` with `image/*` content on a direct request.
4. Append the after-table to `09-EVIDENCE.md` Tier 4, naming the five unrelated source files this deploy also carries (`components/Profile.tsx`, `components/notion/MermaidBlock.tsx`, three `templates/terminal/` files).
5. Add the `## CORRECTION` section to `09-VERIFICATION.md`, move the RSC-flight-payload item out of `behavior_unverified_items` verbatim, decrement `behavior_unverified` 3→2, and update the FALSE-AS-WRITTEN truth-table row.
6. Close STATE.md's open blocker: "**OPEN — Phase 9, needs an operator decision:** presigned Notion S3 URLs remain embedded in the RSC flight payload…" — that decision was already made (fix it, not accept as residual risk) and this plan's Task 1 fix is the fix; STATE.md's blocker entry should be removed once Task 3's deployed measurement confirms it holds live, not merely locally.

**The gap's `missing` item 2** ("update all four default-template call sites to the narrowed interface") is satisfied by the call sites needing no change at all — all four remain Server Components passing `post` to another Server Component (`PostThumbnail`), which is not a serialisation boundary. Task 1's `<verify>` block asserts this durably (zero client directives across `templates/default/*.tsx`, all four call sites still pass `post={post}` unchanged), so the gap's item 2 is closed by a source assertion rather than a file edit — recorded here per the plan's `<design>` section reasoning and the plan's own `<output>` instruction.

**The D-06 wording correction** (09-02-SUMMARY Finding B — `s-maxage` unobservable on the deployed response) remains open and was deliberately not touched by this plan, consistent with its stated scope.

---
*Phase: 09-thumbnail-freshness*
*Completed: 2026-08-12 (Tasks 1-2 only; Task 3 halted)*
