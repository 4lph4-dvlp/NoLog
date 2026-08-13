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
  - "09-EVIDENCE.md Tier 4 — complete: local proof + deployed before-control (Task 2) and the deployed after-measurement closing G-09-1 (Task 3)"
  - "09-VERIFICATION.md CORRECTION section — the RSC flight-payload truth now holds as literally written; behavior_unverified 3->2"
affects: [10-sidebar-collapse]

actuals:
  tokens: 3400
  tasks: 3
  commits: 3

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
  - "Task 3 was initially halted at its <precondition> gate (push to origin/main is not something a worktree-isolated parallel executor should do directly — see the Deviations section below for the original reasoning, preserved for the record). The orchestrator merged the wave and performed the push itself (6d61daa..34fceee), then re-dispatched this plan as a continuation. This second executor run verified the push landed (origin/main == HEAD == 34fceee), confirmed the deploy went live via three signals independent of the presigned-URL count itself (a new client chunk appeared, x-vercel-cache showed a fresh PRERENDER/MISS origin render rather than a stale HIT, and all three thumbnail ids returned byte-identical content-lengths to Tier 2's baseline), then ran the deployed closure measurement: 0 amazonaws.com and 0 X-Amz-Signature/Credential occurrences on both the home page and the post detail page, against Tier 2's recorded 3 and 1, with the vacuity guard held (non-zero distinct proxy-path counts on both bodies). G-09-1 is closed."
  - "Corrected the plan's own anticipated fact about what this deploy carries: the plan's <design>/<output> text expected five unrelated unpushed source files (Profile.tsx, MermaidBlock.tsx, three templates/terminal/ files) to ride along in this deploy. Verified directly with git show --stat 6d61daa..34fceee -- . ':(exclude).planning' that those five files had already shipped in an earlier push before this wave — this deploy carries only the two thumbnail files. Recorded as a corrected fact in 09-EVIDENCE.md Tier 4 rather than silently dropping the plan's instruction to name co-shipped files."

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
    description: "Task 3 — push to origin/main (performed by the orchestrator), deploy-liveness confirmation, deployed closure measurement (0 amazonaws.com/X-Amz-* on the live site alongside non-zero proxy-path counts), and the 09-VERIFICATION.md CORRECTION"
    requirement: "IMG-01, IMG-02"
    verification:
      - kind: other
        ref: "Task 3 <verify> block — deploy-liveness via chunk-set/cache-header signals independent of the measurement, closure measurement (0/0 gate held on both bodies), non-regression (3 ids, byte-identical to Tier 2), 09-EVIDENCE.md Tier 4 after-table, 09-VERIFICATION.md CORRECTION section"
        status: pass
    human_judgment: false

duration: ~50min (Tasks 1-2: ~35min; Task 3 continuation: ~15min)
completed: 2026-08-12
status: complete
---

# Phase 09 Plan 04: Thumbnail RSC Boundary Split Summary

**Split `PostThumbnail` into a Server Component (holds `Post`, resolves the src) and a new `PostThumbnailImage` Client Component (three primitives only), closing the RSC flight-payload leak at the source. Deployed and measured live: G-09-1 is closed.**

## Performance

- **Duration:** ~50 min total (Tasks 1-2: ~35 min; Task 3 continuation, after orchestrator wave-merge and push: ~15 min)
- **Tasks:** 3 of 3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `PostThumbnailImage.tsx` created as the repo's second narrowed-props Client Component (after `CommentSection.tsx`'s `{postId, postTitle}` precedent) — its prop interface is exactly `{ src: string; alt: string; variant: "card" | "hero" }`, never importing the local types barrel or naming `thumbnailType`.
- `PostThumbnail.tsx` converted to a Server Component: no client directive, same `{ post: Post; variant }` signature all four `templates/default/*` call sites already use unchanged, holds the `!post.thumbnail` guard and the `thumbnailType === "external"` resolution, then renders `PostThumbnailImage` with the resolved primitives.
- Local production proof (`next start`, real Notion credentials, real page): zero `amazonaws.com` and zero `X-Amz-Signature`/`X-Amz-Credential` occurrences on both the home feed and a post detail page, with non-zero distinct `/api/thumbnail/{uuid}` references on each — the vacuity guard held, so the zeros are real absences, not an empty page.
- Deployed before-control (the site as it stands before this plan's fix ships) reproduced Tier 2's recorded figures exactly: 3 `amazonaws.com` occurrences on `/`, 1 on `/post/{id}`.
- **Deployed after-measurement (this continuation run): G-09-1 is closed.** With the orchestrator's push already landed at `34fceee`, the deploy was confirmed live by three signals independent of the presigned-URL count itself, and both the home page and the post detail page now return `0` `amazonaws.com` and `0` `X-Amz-Signature`/`X-Amz-Credential` occurrences — against Tier 2's recorded `3` and `1` — with the vacuity guard held (non-zero distinct proxy-path counts on both bodies).
- Non-regression confirmed byte-for-byte: all three thumbnail ids returned the exact content-lengths Tier 2 recorded (`53788`, `1561628`, `183062`) on a direct proxy request.
- `09-EVIDENCE.md` Tier 4 section completed: local proof + deployed before-control (Task 2) and the deployed after-measurement + liveness confirmation (Task 3), with the redaction discipline intact (no actual `X-Amz-Signature=`/`X-Amz-Credential=` value ever committed — verified by direct grep).
- `09-VERIFICATION.md` corrected: the "no presigned URL anywhere in cached markup" truth, previously FALSE AS WRITTEN, now holds and is marked VERIFIED with a dated `## CORRECTION` section; `behavior_unverified` decremented `3` → `2`.

## Task Commits

Each completed task was committed atomically:

1. **Task 1: Split the thumbnail client boundary — three primitives across, nothing else** - `d93e190` (feat)
2. **Task 2: Prove it against a real production build before spending a deploy, and capture the before-pair** - `b221191` (docs)
3. **Task 3: Deploy, confirm it is live, and run the closure measurement that defines the gap as shut** - `a4fdd88` (docs)

_Note: this plan carries no `tdd="true"` tasks; all three commits above are single, non-TDD task commits._

## Files Created/Modified

- `apps/web/src/components/PostThumbnailImage.tsx` - New Client Component; three-primitive props (`src`, `alt`, `variant`); holds the `failed` state, `onError` swap to `ImageOff`, and the unchanged wrapper/icon markup moved verbatim from the pre-split file
- `apps/web/src/components/PostThumbnail.tsx` - Now a Server Component; unchanged call-site signature (`{ post, variant }`); holds the no-thumbnail guard and the file-vs-external `src` resolution; JSDoc extended with the "must stay a Server Component" invariant this change exists to enforce
- `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` - Tier 4 section: local production proof table + deployed before-control table (Task 2), plus deployed after-measurement, liveness confirmation, and non-regression tables (Task 3)
- `.planning/phases/09-thumbnail-freshness/09-VERIFICATION.md` - Truth-table row for the RSC flight-payload claim updated from FALSE AS WRITTEN to VERIFIED; `## CORRECTION` section added; `behavior_unverified_items` and the frontmatter count updated

## Decisions Made

- Task 1 and Task 2 executed with zero deviation from the plan's `<design>` and `<action>` text — the boundary split, prop interface, and evidence-capture method all match what was specified.
- Task 2's deployed-before-control raw (unescaped) proxy-path-reference count came back `0` on both bodies, which is expected rather than a vacuity-guard failure: before this plan's fix, the pre-split `PostThumbnail` computed its `src` internally from the whole serialized `post` object rather than receiving `src` as a passed Client Component prop, so the raw literal `/api/thumbnail/{uuid}` string never appears unescaped in that deploy's RSC payload — only the percent-encoded form inside the `<img>` optimizer URL does (confirmed present at 3 and 1 distinct occurrences). The `amazonaws.com` counter (unaffected by this distinction) is what actually reproduces Tier 2's figures, and it does so exactly. Documented in `09-EVIDENCE.md` Tier 4 rather than left as an unexplained zero.
- **Task 3's original chunk-filename-diff liveness method could not be run literally.** Task 2's actual saved before-set (the specific 5 filenames) lived in a `/tmp` scratch file from the first executor process, which did not persist across the handoff to this continuation agent — only the *count* (`5`) survived, recorded in `09-EVIDENCE.md`. Rather than fabricate a before-set or skip the liveness check, this run used the documented count plus two additional independent signals (Vercel cache-state headers showing a fresh origin render rather than a stale edge hit, and byte-identical non-regression on all three thumbnail ids) to confirm liveness without relying on the presigned-URL count itself — consistent with the plan's explicit prohibition on using that count as its own liveness proof. Recorded in `09-EVIDENCE.md` Tier 4 rather than silently substituted.
- **Corrected the plan's anticipated "five co-shipped files" fact.** The plan's `<design>`/`<output>` text expected this deploy to also carry five unrelated, previously-unpushed source files. Verified directly (`git show --stat 6d61daa..34fceee -- . ':(exclude).planning'`) that this deploy carries only the two thumbnail files — the five had already shipped in an earlier push before this wave. Recorded as a corrected fact rather than silently dropping the plan's instruction to name co-shipped files.
- The Task 3 verify script's `grep -rcE 'X-Amz-(Signature|Credential)' 09-EVIDENCE.md 09-VERIFICATION.md` check, if run literally with its `grep -vc ':0$'` filter, flags `09-VERIFICATION.md` as non-zero — but this is a pre-existing false positive from legitimate prose (e.g. line 95, predating this plan: "`X-Amz-Signature`/`X-Amz-Credential` never committed | ..."), not an actual secret value. Confirmed directly: `grep -nE 'X-Amz-Signature=|X-Amz-Credential=' 09-EVIDENCE.md 09-VERIFICATION.md` returns zero matches in both files — no actual signature/credential value was ever committed. The redaction discipline (no query-string values) holds; the word-occurrence check the plan's script uses is coarser than the actual prohibition.

## Deviations from Plan

### Structural — Task 3 initially halted, then resumed as a continuation after orchestrator wave-merge (preserved for the record)

**[Plan structural mismatch, now resolved] Task 3 requires `git push origin/main` and a live-deploy measurement; the first executor run was inside a wave-based, worktree-isolated parallel executor that could not perform that step.**

- **Found during:** Task 3's `<precondition>` check, before any action was taken (first executor run).
- **Issue:** Task 3's precondition assumed a single linear executor that pushes directly, per 09-02's precedent. The first execution instance was a parallel worktree agent whose commits were local to its branch until the orchestrator merged the wave. Pushing directly would have shipped only this plan's diff while bypassing the wave-merge step.
- **Fix:** The first run did not attempt the push and returned a checkpoint. The orchestrator merged the wave, performed `git push origin main` itself (`6d61daa..34fceee`), and re-dispatched this plan as a continuation. **This continuation run** verified `origin/main == HEAD == 34fceee`, confirmed the deploy was live, and completed Task 3's remaining action: the closure measurement, the `09-EVIDENCE.md` Tier 4 after-table, and the `09-VERIFICATION.md` `## CORRECTION` section.
- **Files modified:** `09-EVIDENCE.md`, `09-VERIFICATION.md` (this continuation run).
- **Verification:** Task 3's `<verify>` block criteria satisfied — deploy liveness confirmed independently of the measurement, gate held (0/0 on both bodies with non-zero proxy-path counts), non-regression confirmed byte-identical.
- **Committed in:** `a4fdd88`.

---

**Total deviations:** 3 (1 structural halt-then-resume across two executor runs, documented above; 2 factual corrections to the plan's own anticipated evidence, documented in Decisions Made — none are Rule 1-3 auto-fixes of broken code, all are honest-disclosure corrections to planning-time assumptions that did not hold at execution time).
**Impact on plan:** All three tasks now fully satisfy their own `<done>` criteria and are committed. G-09-1 is closed.

## Issues Encountered

- The worktree lacked `node_modules` (workspace-hoisted `next`, `eslint`, etc.) and `packages/core/node_modules` (`tsup`), since these are gitignored and not carried into a fresh worktree checkout. Symlinked both from the main repo checkout (`/home/alpha-pi/dev/NoLog/node_modules` → worktree `node_modules`; same for `packages/core/node_modules`) so `npm run build`/`npm run lint --workspace=apps/web` could run. Confirmed both symlinks are themselves gitignored (`git status --ignored`) and were not staged in either commit.
- Same gap for `apps/web/.env.local` (gitignored, holds `NOTION_TOKEN`/`NOTION_DATABASE_ID`, required by Task 2's precondition): symlinked from the main repo checkout rather than copying or reading its contents. The precondition check itself never read, echoed, or logged any credential value — only `grep -qE '^VAR=.+' `'s exit status was used, per the precondition's own instruction.
- Local `next start` on port 3210 left one lingering listener after the first `pkill -f 'next start -p 3210'` (process group mismatch with `setsid`); found and killed the specific PID directly (`kill -9 301146`), then confirmed `ss -ltnp | grep -c ':3210'` returned `0` before proceeding to the deployed captures.
- Task 3's continuation run had no access to Task 2's original saved before-set of chunk filenames (a `/tmp` scratch file, not persisted across the executor handoff) — worked around with independent liveness signals as documented in Decisions Made above, rather than skipping the check or fabricating data.

## User Setup Required

None - no external service configuration required. The `git push` to `origin/main` (deploy access to `4lph4-bl0g.vercel.app`) was an orchestrator-level capability, performed by the orchestrator itself between the two executor runs — not a forker-facing setup step.

## Next Phase Readiness

**G-09-1 is closed. Phase 9's one disclosed false-as-written truth now holds.** All three tasks are complete and committed:

1. The code fix (`PostThumbnail`/`PostThumbnailImage` boundary split) — Task 1, `d93e190`.
2. Local production proof + deployed before-control — Task 2, `b221191`.
3. Push (performed by the orchestrator), deploy-liveness confirmation, and the deployed closure measurement — Task 3, `a4fdd88`. Both `/` and `/post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5` return `0` `amazonaws.com` and `0` `X-Amz-Signature`/`X-Amz-Credential` occurrences on the live deployed site, with the vacuity guard held and all three thumbnail ids confirmed byte-identical to Tier 2's baseline on direct proxy requests.

**`STATE.md`'s open blocker can now be closed.** "**OPEN — Phase 9, needs an operator decision:** presigned Notion S3 URLs remain embedded in the RSC flight payload…" — the operator already made the decision (fix it, not accept as residual risk) and this plan's fix now holds live, confirmed by the Task 3 measurement above, not merely locally. The orchestrator's own state update should clear this blocker rather than carry it into the milestone audit.

**The gap's `missing` item 2** ("update all four default-template call sites to the narrowed interface") is satisfied by the call sites needing no change at all — all four remain Server Components passing `post` to another Server Component (`PostThumbnail`), which is not a serialisation boundary. Task 1's `<verify>` block asserts this durably (zero client directives across `templates/default/*.tsx`, all four call sites still pass `post={post}` unchanged), so the gap's item 2 is closed by a source assertion rather than a file edit — recorded here per the plan's `<design>` section reasoning and the plan's own `<output>` instruction.

**The D-06 wording correction** (`09-02-SUMMARY.md` Finding B — `s-maxage` unobservable on the deployed response) remains open and was deliberately not touched by this plan, consistent with its stated scope.

---
*Phase: 09-thumbnail-freshness*
*Completed: 2026-08-12 (all 3 tasks; Task 3 resumed as a continuation after orchestrator wave-merge and push)*

## Self-Check: PASSED

- `apps/web/src/components/PostThumbnailImage.tsx` — FOUND
- `apps/web/src/components/PostThumbnail.tsx` — FOUND
- `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` — FOUND
- `.planning/phases/09-thumbnail-freshness/09-VERIFICATION.md` — FOUND
- Commit `d93e190` (Task 1) — FOUND in `git log --oneline --all`
- Commit `b221191` (Task 2) — FOUND in `git log --oneline --all`
- Commit `a4fdd88` (Task 3, this run) — FOUND in `git log --oneline --all`
