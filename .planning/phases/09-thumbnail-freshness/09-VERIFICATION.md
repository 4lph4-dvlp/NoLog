---
phase: 09-thumbnail-freshness
verified: 2026-08-12T00:00:00Z
status: passed
score: 6/6 must-haves verified (5 ROADMAP success criteria + 1 additive plan-level truth)
behavior_unverified: 0
overrides_applied: 2
overrides:
  - must_have: "The host-allowlist guard (IMG-03, ROADMAP SC3 clause 2) refuses a resolved thumbnail URL whose host is not one of the two next.config.ts hosts — firing directly observed, not just source-asserted."
    reason: "Notion chooses the presign host at signing time, not the operator, so an off-allowlist case cannot be constructed from real Notion data without fabricating one. The guard's shape is confirmed by source (route.ts:78-89 mirrors next.config.ts's two hostnames exactly, independently re-confirmed by 09-REVIEW.md's code review) and the sibling redirect/content-type guards were proven firing via the same fault-injection harness pattern this guard structurally cannot use. Operator explicitly reviewed this trade-off and accepted source-level assurance as sufficient rather than requesting harness extension."
    accepted_by: "operator (via 09-UAT.md test 2, 2026-08-11)"
    accepted_at: "2026-08-11T17:56:41Z"
  - must_have: "IMG-05's live half — an actual external-thumbnail post renders unchanged and never travels through the proxy path, observed against a real post, not only against source and the structural absence of any external thumbnail on the live site."
    reason: "The operator's live Notion database contains no post with an external thumbnail, so this cannot be exercised without mutating production content — which the phase correctly declined to do (it would also have disturbed the idle-window measurement in Tier 3). The component branch (thumbnailType === \"external\" returns the URL unchanged) and the route's own non-\"file\" 404 are both source-verified and independently re-confirmed by 09-REVIEW.md's code review. Operator explicitly reviewed this trade-off and accepted source-level assurance as sufficient rather than requesting a throwaway test post."
    accepted_by: "operator (via 09-UAT.md test 3, 2026-08-11)"
    accepted_at: "2026-08-11T17:56:41Z"
re_verification:
  previous_status: human_needed
  previous_score: "4/5 roadmap success criteria fully verified (1 partially — 3 of 4 guards verified, 1 source-asserted)"
  gaps_closed:
    - "The 09-01 additive must-have ('no HTML the site serves embeds a Notion presigned S3 URL for a Notion-hosted thumbnail') was FALSE AS WRITTEN in the previous pass — 3 presigned URLs remained in the home page's RSC flight payload and 1 in the post page's, never in an <img src> but present in public, CDN-cached markup. Plan 09-04 fixed this by narrowing PostThumbnail's client boundary (new PostThumbnailImage.tsx receives only src/alt/variant, never the whole Post object) and this re-verification independently reproduced the closure live: 0 amazonaws.com and 0 X-Amz-Signature/Credential occurrences on both the deployed home page and post page, against a non-zero proxy-path count on each (vacuity guard held)."
    - "The three human_verification items from the previous pass are all now resolved. Item 1 (RSC flight-payload exposure — accept or fix) was resolved by the operator choosing to fix it (09-UAT.md test 1, result: issue, '지금 고치기'), which became gap G-09-1 and plan 09-04, now closed and independently confirmed above. Items 2 and 3 (host-allowlist source-only assurance, IMG-05 live-half source-only assurance) were resolved by the operator explicitly accepting source-level assurance as sufficient (09-UAT.md tests 2 and 3, both result: pass) — recorded above as accepted overrides rather than re-raised as open questions the operator has already answered."
  gaps_remaining: []
  regressions: []
---

# Phase 9: Thumbnail Freshness Verification Report

**Phase Goal:** Readers see post thumbnails on their first load of the deployed site, however long it
sat idle beforehand
**Verified:** 2026-08-12
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 09-04, gap G-09-1)

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cold first load of the home page after an idle gap longer than Notion's ~1h presign lifetime shows every thumbnail; no blank-then-refresh sequence | ✓ VERIFIED | `09-EVIDENCE.md` Tier 3 steps 1-3, 5: a real 224-minute idle gap, corroborated by `date`/`age` header arithmetic against the recorded window-start timestamp. Three distinct home-feed thumbnail paths extracted from that stale, 224-minute-old captured HTML each resolved `200`, `image/png`, non-zero bytes. Fresh cookie-less headless-browser pass corroborates (0 broken images). Regression-checked live in this verification session (`curl` against `/api/thumbnail/3702c61e-4a24-8001-a9a6-c4ff3aadadb5` returns `200 image/png 1561628` bytes — byte-identical to every prior recorded measurement of that id). |
| 2 | Same idle-gap-then-cold-load check passes for a post detail page's hero thumbnail | ✓ VERIFIED | `09-EVIDENCE.md` Tier 3 step 4: hero path extracted from a post-page render inside the same 224-minute gap resolved `200`, `image/png`, `1,561,628` bytes on direct request. Browser corroboration matches (`1280×630`, `complete:true`). Underlying Data Cache staleness *mechanism* remains honestly recorded as MEDIUM confidence (inferred from documented Next.js caching semantics, not directly measured) — unchanged from the previous pass; this does not weaken the observable result, which is what ROADMAP SC2 asks for. |
| 3 | A request to the thumbnail path is refused non-200 for: (a) a non-Notion-identifier id, (b) an off-allowlist resolved host, (c) a redirecting origin, (d) a non-`image/*` content type | ✓ VERIFIED (3 sub-guards directly observed, 1 PASSED (override)) | (a) id-parse: VERIFIED — deployed battery T2-4/T2-5/T2-6 (garbage=400, absent-UUID=404, URL-as-id=400); re-confirmed live this session (`garbage-id` → `400`, empty body). (c) redirect: VERIFIED — controlled-origin fault-injection T2-1 (502, 0 bytes). (d) content-type: VERIFIED — T2-2 (502, 0 bytes). (b) host allowlist: **PASSED (override)** — see frontmatter `overrides`. Source re-confirmed this session: `route.ts:28-31,86-89` — `ALLOWED_HOSTS` holds exactly the two `next.config.ts` hostnames, re-read directly from both files. |
| 4 | A thumbnail that genuinely fails to resolve shows a visible placeholder, never an empty box | ✓ VERIFIED | `09-EVIDENCE.md` Tier 2, IMG-04 rows T3-1..T3-8: real headless-browser session, genuine failed image request, DOM-measured icon size/color/wrapper matches `09-UI-SPEC.md` at both 32px (card) and 48px (hero), both themes, zero `<img>` left to render a broken-image glyph. Source re-confirmed this session: `PostThumbnailImage.tsx:35-42` (unchanged from the pre-09-04 version, moved verbatim by the boundary split). **Caveat carried forward from `09-REVIEW.md` WR-01** (see Anti-Patterns): an external thumbnail on a non-allowlisted host throws synchronously in `next dev`/SSR rather than triggering `onError`, because Next's `defaultLoader` host-check is dev-only. In production this same code path degrades gracefully (the image optimizer's own server-side check fails the request as a normal HTTP error, which `onError` does catch) — so this does not affect the deployed-site truth ROADMAP SC4 asks about, but it is a real dev-environment robustness gap, non-blocking. |
| 5 | A post with an external (non-Notion-hosted) thumbnail renders unchanged, never through the proxy path | ✓ VERIFIED (structural half directly observed, live half PASSED (override)) | Structural half: 3 distinct post ids on the deployed site all route through the proxy, zero absolute-URL `<img src>` values on either page. Live half: **PASSED (override)** — see frontmatter `overrides`. Source re-confirmed this session: `PostThumbnail.tsx:30-33` (`thumbnailType === "external"` returns `post.thumbnail` unchanged, never constructs the proxy path — this logic moved from the old client component into the new Server Component verbatim) and `route.ts:74-76` (non-`"file"` thumbnails 404). |

**Score:** 5/5 roadmap criteria verified (2 of the 5 carry one PASSED-(override) sub-clause each, both explicit operator-accepted trade-offs recorded in `09-UAT.md`).

### Additional Plan-Level Must-Have (09-01, additive to the 5 ROADMAP criteria)

| Truth | Status | Evidence |
|-------|--------|----------|
| "No HTML the site serves embeds a Notion presigned S3 URL for a Notion-hosted thumbnail — the expiring value is no longer embedded anywhere in cached markup" | ✓ VERIFIED | Was FALSE AS WRITTEN in the previous verification pass; closed by plan 09-04 and **independently reproduced live in this re-verification session**: `curl`-fetched the deployed `/` and `/post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5` bodies fresh (not re-citing `09-EVIDENCE.md` Tier 4's own capture) and confirmed `0` `amazonaws.com` occurrences and `0` `X-Amz-Signature`/`X-Amz-Credential` occurrences on both, alongside a non-zero distinct `/api/thumbnail/{uuid}` reference count on each (3 on home, 1 on post) — the vacuity guard holds, so the zeros are real absences on the live site, not an artifact of an empty page or a stale capture. Fixed by narrowing `PostThumbnail`'s client boundary: `PostThumbnailImage.tsx` (new, Client Component) receives three primitives (`src`, `alt`, `variant`) and never the whole `Post` object; `PostThumbnail.tsx` (Server Component) holds the guard and the file-vs-external resolution and never crosses the RSC serialization boundary — both files read in full this session and match the claimed shape exactly (client-file prop interface has exactly 3 members, imports neither the types barrel nor names `thumbnailType`; server file carries no client directive). Commits `d93e190` (fix), `b221191`/`a4fdd88` (evidence), deployed at `34fceee`. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/api/thumbnail/[id]/route.ts` | Exports `GET` and `runtime`, holds all four IMG-03 guards, streams the body | ✓ VERIFIED | Read in full this session, unchanged by 09-04 (not in its file scope). `runtime = "nodejs"`, `freshNologClient` second `NologClient` with `cache: "no-store"`, never imports `@/lib/notion`, `parsePageId` gate, `getPost` 404 gate, non-`"file"` 404 gate, URL-parse 400 gate, `ALLOWED_HOSTS.has()` 400 gate, `redirect:"error"` fetch with 502 catch, content-type 502 gate, streaming `new Response(upstream.body, ...)` with locked cache header. |
| `apps/web/src/components/PostThumbnail.tsx` | Server Component, holds guard + resolution, unchanged call-site signature | ✓ VERIFIED | Read in full this session. No client directive. `{ post: Post; variant }` signature. Holds `!post.thumbnail` guard and the `thumbnailType === "external"` resolution. Renders `PostThumbnailImage` with 3 resolved primitives. |
| `apps/web/src/components/PostThumbnailImage.tsx` | New Client Component, exactly 3 primitive props, `onError` → `ImageOff` | ✓ VERIFIED | Read in full this session. `"use client"` directive present. Named export. Prop interface `{ src: string; alt: string; variant: "card" \| "hero" }` — confirmed exactly 3 members by grep. No import of the local types barrel, no mention of `thumbnailType`. `WRAPPER`/`ICON_SIZE` maps and the `failed`-state `ImageOff` swap moved verbatim from the pre-split file, byte-identical class strings confirmed against `09-UI-SPEC.md`. |
| `apps/web/src/types/index.ts` | Local `Post` carries `thumbnailType` | ✓ VERIFIED | `thumbnailType: "file" \| "external" \| null;` present, untouched by 09-04 (not in its file scope). |
| `apps/web/src/templates/default/{HomePage,SearchPage,CategoryPage,PostPage}.tsx` | Each renders `PostThumbnail`, none imports `next/image`, none carries a client directive | ✓ VERIFIED | Re-confirmed this session: `grep -l "use client"` over all four returns 0; all four still call `PostThumbnail post={post}` unchanged. |
| `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` | Four tiers, in run order, closing per-requirement summary, Tier 4 closure measurement | ✓ VERIFIED | Read in full this session (894 lines). Tiers 1-3 unmodified from the previous pass; Tier 4 (09-04) holds the local proof, deployed before-control, deploy-liveness confirmation via chunk-set/cache-header signals independent of the measurement itself, and the after-measurement — all independently reproduced live in this session. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| All four `default`-template surfaces | `PostThumbnail` | direct import + JSX usage, `post={post}` unchanged | ✓ WIRED | Confirmed by grep this session: 1 import + 1 usage in each of the 4 files, all still Server Components. |
| `PostThumbnail` (Server) | `PostThumbnailImage` (Client) | JSX element, 3 resolved primitives passed | ✓ WIRED | Confirmed this session: `PostThumbnail.tsx` imports `PostThumbnailImage` from `@/components/PostThumbnailImage` and renders it with `src`, `alt={post.title}`, `variant`. |
| `PostThumbnail` "file" branch | `/api/thumbnail/{post.id}` | template-literal string interpolation | ✓ WIRED | `PostThumbnail.tsx` — confirmed the `external` branch never touches this path. |
| Route's fresh lookup | `freshNologClient` (second `NologClient`, `no-store`) | direct construction at module scope | ✓ WIRED, never routes through `@/lib/notion` | Confirmed: `grep -F -c 'from "@/lib/notion"'` = 0 in the route file (re-run this session). |
| Route's host check | `apps/web/next.config.ts`'s `images.remotePatterns` | duplicated literal Set, not imported | ✓ WIRED (source-level match confirmed) | Both files read this session: `s3.us-west-2.amazonaws.com` and `prod-files-secure.s3.us-west-2.amazonaws.com` appear identically in both. Guard's *firing* remains a PASSED (override) item — see frontmatter. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PostThumbnail` `src` (file branch) → `PostThumbnailImage` `src` prop | `/api/thumbnail/${post.id}` | `post.id` from server-fetched `Post`, resolved server-side by the route at request time via `freshNologClient.getPost()` against live Notion data | Yes — reconfirmed live this session: direct requests to all three home-feed proxy paths and the post hero's proxy path all returned `200`, `image/png`, non-zero bytes matching every prior recorded measurement exactly | ✓ FLOWING |
| `PostThumbnail` `src` (external branch) → `PostThumbnailImage` `src` prop | `post.thumbnail` unchanged | Server-fetched `Post` object | Not independently observed live (no external-thumbnail post exists in the operator's DB — operator-accepted override) but the flow itself (prop → unmodified render, now one level higher in the tree post-09-04) is trivially traceable in source and not a stub | ⚠️ Source-confirmed flow, live data unexercised — covered by frontmatter override |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production build succeeds after the 09-04 commits (re-run independently this session) | `npm run build --workspace=apps/web` | `✓ Compiled successfully`, all 9 routes generated including `ƒ /api/thumbnail/[id]` | ✓ PASS |
| No debt markers in phase-9-modified files (re-run this session, all 4 currently-modified files) | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across `PostThumbnail.tsx`, `PostThumbnailImage.tsx`, `route.ts`, `templates/default/*.tsx`, `types/index.ts` | zero matches | ✓ PASS |
| RSC flight-payload closure holds live (re-run independently this session, fresh `curl`, not re-citing `09-EVIDENCE.md`) | `curl -s $S/` and `curl -s $S/post/{id}`, grep `amazonaws.com` / `X-Amz-(Signature\|Credential)` / distinct `/api/thumbnail/{uuid}` refs | Home: `0` / `0` / `3` refs. Post: `0` / `0` / `1` ref. Vacuity guard held on both. | ✓ PASS |
| Non-regression: proxy paths still serve live image bytes on the deployed site (re-run this session) | `curl -o /dev/null -w '%{http_code} %{content_type} %{size_download}' $S/api/thumbnail/{id}` for the hero id | `200 image/png 1561628` — byte-identical to every prior Tier 2/3/4 measurement of this id | ✓ PASS |
| id-parse guard still refuses garbage input on the live deployed route (re-run this session) | `curl -o /dev/null -w '%{http_code} ... %{size_download}' $S/api/thumbnail/not-a-real-id` | `400`, `0` bytes | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe declarations exist in this phase's PLAN/SUMMARY files. Skipped for absence of a probe convention, same as the previous pass.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| IMG-01 | 09-01 (fix), 09-03 (proof), 09-04 (RSC boundary fix) | Home feed thumbnails survive idle gap | ✓ SATISFIED | Tier 3 steps 1-3, 5; re-confirmed live this session |
| IMG-02 | 09-01 (fix), 09-03 (proof), 09-04 (RSC boundary fix) | Post hero thumbnail survives idle gap | ✓ SATISFIED | Tier 3 step 4, 5; re-confirmed live this session |
| IMG-03 | 09-01 (build), 09-02 (probe) | Route refuses non-Notion input, off-allowlist host, redirect, non-image content | ✓ SATISFIED (host-allowlist sub-guard via accepted override) | Tier 1 + Tier 2; `09-UAT.md` test 2 |
| IMG-04 | 09-01 (build), 09-02 (browser observation), 09-04 (boundary move, markup byte-identical) | Genuinely failing thumbnail shows placeholder | ✓ SATISFIED | Tier 2, T3-1..T3-8; source re-confirmed unchanged post-09-04 |
| IMG-05 | 09-01 (build), 09-02 (page-source check), 09-04 (boundary move, branch preserved) | External thumbnails bypass the proxy | ✓ SATISFIED (live half via accepted override) | Tier 2; `09-UAT.md` test 3 |

`REQUIREMENTS.md` lines 35-39 and 109-113 mark all five `[x]` complete, now consistent with a fully `passed` verification (the prior pass had these marked complete while the phase carried an open, unaccepted false-as-written truth and two unaccepted coverage gaps — that inconsistency is resolved as of this pass).

**No orphaned requirements.** All five IMG-01..IMG-05 IDs appear in at least one plan's `requirements:` frontmatter field (09-01: all five; 09-02: IMG-03/04/05; 09-03: IMG-01/02; 09-04: IMG-01/02/04/05), and REQUIREMENTS.md's Phase 9 mapping lists exactly these five and no others.

### Anti-Patterns Found

None found in this verification's independent re-scan of the currently-modified phase-9 source files (debt markers, empty implementations, hardcoded stub data — all clean). `09-REVIEW.md` (code review, refreshed 2026-08-11T18:59:56Z against the post-09-04 file set) found **0 Critical findings**. 4 Warnings and 3 Info items are open and are carried forward as known, non-blocking issues (none newly discovered by this verification pass, and this table supersedes the pre-09-04 anti-patterns table since the reviewed file set changed):

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `PostThumbnail.tsx` / `PostThumbnailImage.tsx` (WR-01) | External thumbnails on non-allowlisted hosts throw synchronously in `next dev`/SSR (not caught by `onError`) because `next/image`'s `defaultLoader` host-check is gated to non-production; production degrades gracefully via the optimizer's own server-side check + `onError` | Warning | Open. Does not affect the deployed-site behavior ROADMAP SC4/SC5 describe (confirmed above), but is a real local-dev crash risk the first time a forker pastes a non-allowlisted external thumbnail URL. |
| `api/thumbnail/[id]/route.ts:91-98` (WR-02) | No timeout/`AbortSignal` on the outbound fetch | Warning | Open, unchanged from the previous pass (route.ts is outside 09-04's file scope). A hanging upstream ties up the Function invocation with no fast-fail path. |
| `api/thumbnail/[id]/route.ts:104-108` (WR-03) | Upstream response body left unconsumed on the 502 error branches | Warning | Open. Potential connection-pool resource leak under Node's undici fetch implementation on every non-2xx/non-image upstream response. |
| `api/thumbnail/[id]/route.ts:56-76` (WR-04) | No negative caching or rate limiting on the proxy route — well-formed but non-existent/non-public IDs can drive unbounded live Notion API calls | Warning | Open. Competes for the same Notion API rate limit the rest of the site depends on. |
| `api/thumbnail/[id]/route.ts:78-89` (IN-01) | Host allowlist checks hostname only, not scheme (`http://` would pass) | Info | Open, not currently exploitable — Notion's presigned URLs are always `https://`. |
| `PostThumbnailImage.tsx:51` (IN-02) | `hero` variant omits `sizes` while using `fill`, defaults to `100vw` | Info | Open, minor over-fetch + a Next.js console warning, not a correctness issue. |
| Three `templates/default/*.tsx` (IN-03) | Byte-identical card-list markup duplicated across 3 files | Info | Open, pre-existing, unrelated to the thumbnail fix's own scope; flagged again because 09-04 touched all three call sites without extracting the shared card component. |

Two items from the previous anti-patterns table (WR-02 no-timeout, WR-03 MermaidBlock `dangerouslySetInnerHTML`, IN-02 terminal PostPage, IN-03 duplicate markup) either persist under new numbering above or are out of this review's file scope this pass (MermaidBlock and terminal are unrelated files not touched by 09-04 and were not re-reviewed here; both were already recorded open in the previous pass and are unaffected by this re-verification).

## Human Verification Required

None. All three items from the previous pass's `human_verification` list are resolved:

1. **RSC flight-payload exposure** — resolved by the operator's explicit choice to fix rather than accept (`09-UAT.md` test 1), executed by plan 09-04, and independently reproduced live in this verification session (see the additive must-have table above).
2. **Host-allowlist guard assurance** — resolved by the operator's explicit acceptance of source-level assurance as sufficient (`09-UAT.md` test 2), recorded as an accepted override in this report's frontmatter.
3. **IMG-05 live-half assurance** — resolved by the operator's explicit acceptance of source-level assurance as sufficient (`09-UAT.md` test 3), recorded as an accepted override in this report's frontmatter.

No new items requiring human judgment were identified in this re-verification pass. The two remaining open coverage gaps (host-allowlist firing, IMG-05 live half) are structurally unexercisable from real data without either fabricating a Notion presign response or mutating production content — both correctly ruled out by the phase's own honesty discipline — and the operator has already made the accept/reject call on both.

## Gaps Summary

**No gaps.** Every artifact this phase claims to have created or modified exists, is substantive, is wired into its call sites, and produces real data — independently re-verified in this session against the live deployed site, not merely re-cited from `09-EVIDENCE.md`. The production build is green, no debt markers were left behind, and the RSC flight-payload leak that blocked the previous verification pass (G-09-1) is closed and independently confirmed live: `0` `amazonaws.com` and `0` `X-Amz-Signature`/`X-Amz-Credential` occurrences on both the deployed home page and post page, alongside non-zero proxy-path counts on each (vacuity guard held).

The two remaining coverage gaps from the previous pass — the host-allowlist guard's firing, and IMG-05's live half — were never technically closed by direct observation (Notion chooses the presign host, and no external-thumbnail post exists in the operator's database), but the operator explicitly reviewed and accepted source-level assurance as sufficient for both during UAT (`09-UAT.md` tests 2 and 3). Per this framework's override mechanism, an explicit, dated, reasoned operator acceptance of a disclosed trade-off is recorded as `PASSED (override)` rather than re-raised as an unanswered question — re-asking an already-answered escalation would contradict the Escalation Gate pattern this verification implements.

`09-REVIEW.md`'s refreshed code review (0 Critical, 4 Warning, 3 Info) surfaced one new item worth flagging precisely because it sits adjacent to a ROADMAP success criterion: WR-01, a `next dev`-only crash for external thumbnails on non-allowlisted hosts. Verified directly that production degrades gracefully via the same code path (the image optimizer's host check, not `next/image`'s client-side one, is what applies in production, and its failure is caught by `onError`) — so this does not block SC4 or SC5 as literally stated for the deployed site, but it is carried forward as an open, non-blocking Warning.

One piece of state hygiene noted but not gating: `STATE.md`'s "OPEN — Phase 9, needs an operator decision" blocker line (line 187) has not yet been cleared even though `09-04-SUMMARY.md` explicitly states it should be — this is an orchestrator bookkeeping step for `/gsd-progress` or the phase-close routine to perform, not a verification blocker, since the underlying issue it describes is independently confirmed closed above.

---

## ⚠ CORRECTION (2026-08-11, resolved prior to this re-verification pass)

**The "No HTML the site serves embeds a Notion presigned S3 URL…" truth, marked FALSE AS WRITTEN in
the initial verification pass, now holds as literally written.** At UAT test 1 the operator was
offered "accept as residual risk" and chose to fix it instead (see this file's original
`human_verification` item 1, and `STATE.md`'s recorded UAT outcome). Plan `09-04` implemented that
fix, and this re-verification pass independently reproduced the closure live rather than trusting
the plan's own SUMMARY (see the additive must-have row above and the Behavioral Spot-Checks table).

**The fix.** `PostThumbnail` was a Client Component receiving the entire `post` object, so React
serialized `post.thumbnail` — a live, unexpired presigned S3 read grant — into the RSC hydration
payload for every render, regardless of which branch the component actually took. `09-04` split it
across the server/client boundary: `apps/web/src/components/PostThumbnailImage.tsx` (new) is now
the only Client Component in the thumbnail path, and its prop interface is exactly three primitives
(`src: string`, `alt: string`, `variant: "card" | "hero"`) — never the `Post` type, never
`thumbnailType`. `apps/web/src/components/PostThumbnail.tsx` became a Server Component holding the
`!post.thumbnail` guard and the file-vs-external resolution; its Server Component props are never
serialized into the flight payload, so the presigned URL never crosses the boundary. All four
`templates/default/*` call sites are unchanged (Server Component → Server Component is not a
serialization boundary) — commit `d93e190`.

**The evidence, independently re-confirmed in this re-verification session.** `09-EVIDENCE.md`
Tier 4 records the deployed home page and post detail page for
`3702c61e-4a24-8001-a9a6-c4ff3aadadb5` both returning **0** `amazonaws.com` occurrences and **0**
`X-Amz-Signature`/`X-Amz-Credential` occurrences, against the **3** and **1** Tier 2 originally
recorded, with the vacuity guard held. This report's Behavioral Spot-Checks table above shows a
fresh, independent `curl` of the same two live URLs run during this verification session
producing the identical result — this is not a re-citation of Tier 4's own capture.

**What did not change.** The two other `behavior_unverified_items` from the initial verification
pass — the host-allowlist guard's unexercised firing, and IMG-05's unexercised live half — are
untouched by plan 09-04. This re-verification pass resolves their status not by newly closing
them technically, but by recording the operator's explicit acceptance (already given via UAT) as
accepted overrides in this report's frontmatter, per this framework's override mechanism.

---

_Verified: 2026-08-12_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure: plan 09-04, gap G-09-1_
