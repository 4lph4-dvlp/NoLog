---
phase: 09-thumbnail-freshness
verified: 2026-08-12T00:00:00Z
status: human_needed
score: 4/5 roadmap success criteria fully verified (1 partially — 3 of 4 guards verified, 1 source-asserted)
behavior_unverified: 3
overrides_applied: 0
gaps: []
behavior_unverified_items:
  - truth: "The host-allowlist guard (IMG-03, ROADMAP SC3 clause 2) refuses a resolved thumbnail URL whose host is not one of the two next.config.ts hosts."
    test: "Construct or obtain a Notion page whose thumbnail resolves to a presigned URL on a host outside {s3.us-west-2.amazonaws.com, prod-files-secure.s3.us-west-2.amazonaws.com}, request /api/thumbnail/{id} against it, and confirm a non-200 with an empty body."
    expected: "Non-200, empty body, no bytes streamed."
    why_human: "Notion chooses the presign host at signing time, not the operator, so this project cannot construct an off-allowlist case from real data. The guard's *shape* is confirmed by source (grep counts exactly 2 hostnames matching next.config.ts, ALLOWED_HOSTS.has() check present, independently re-confirmed by 09-REVIEW.md's code review) but its *firing* has never been observed, unlike the redirect and content-type guards which were exercised via a fault-injection harness."
  - truth: "A post whose thumbnail is an external (non-Notion-hosted) URL renders exactly as it does today and its image request never travels through the proxy path (IMG-05, ROADMAP SC5)."
    test: "Load a post whose Notion thumbnail property holds a pasted external URL and confirm the served HTML carries that URL unchanged, with no /api/thumbnail/ path for it."
    expected: "External URL unchanged in HTML; no proxy path constructed for that post."
    why_human: "The operator's live Notion database currently contains no post with an external thumbnail, so the live half of this claim cannot be exercised. The component branch (thumbnailType === \"external\" returns post.thumbnail unchanged) and the route's own non-\"file\" 404 are both source-verified and independently re-confirmed by 09-REVIEW.md's code review, but neither was exercised against a live external-thumbnail post. The phase deliberately did not mutate production content to manufacture the case."
  - truth: "No HTML the site serves embeds a Notion presigned S3 URL for a Notion-hosted thumbnail — the expiring value is no longer embedded anywhere in cached markup (09-01 must_haves truth, additive to the 5 ROADMAP criteria)."
    test: "Inspect the full served HTML (not just <img> src attributes) of the home feed and a post page for any amazonaws.com occurrence, including inside RSC flight-payload scripts."
    expected: "Zero amazonaws.com occurrences anywhere in the served HTML."
    why_human: "This is FALSE AS WRITTEN, and the phase's own evidence says so plainly: 3 presigned URLs remain on the home page and 1 on the post page, all inside self.__next_f.push([...]) RSC flight-payload scripts (none in an <img> src). Cause: PostThumbnail is a Client Component receiving the whole Post object, so React serializes post.thumbnail for hydration even though the file-type render branch never reads it. This does not affect the phase GOAL (no <img> ever requests an expiring URL, so the idle-window proof for IMG-01/IMG-02 stands), and exposure is strictly reduced versus before the fix (the URL used to be in the <img> src too). But a live, unexpired read grant does sit in public, CDN-cached markup for its full lifetime, and fixing it is an architectural change (narrowing PostThumbnail's props) explicitly out of this phase's file scope. This needs an operator decision: accept the residual exposure (recorded, tracked) or open a follow-up plan to narrow the component's props."
human_verification:
  - test: "Decide whether the residual RSC flight-payload exposure (presigned URLs inside self.__next_f.push([...]) scripts, never in an <img> src) is an acceptable residual risk for this milestone, or whether a follow-up plan should narrow PostThumbnail's props before shipping this phase as fully closed."
    expected: "An explicit operator decision, recorded (e.g. as an accepted override on the 09-01 must_haves truth, or as a new backlog item / follow-up phase)."
    why_human: "Security/privacy risk-acceptance is a judgment call outside what static analysis or automated checks can resolve. The phase's own evidence (09-02) already surfaced this honestly and recommends the same escalation."
  - test: "Confirm the host-allowlist guard's source-level correctness (ALLOWED_HOSTS exactly mirrors next.config.ts's two hostnames) is sufficient assurance, given it cannot be live-exercised."
    expected: "Accept as sufficient, given corroboration by an independent code review pass, or request additional test scaffolding to exercise it (e.g. extend the existing fault-injection harness pattern used for the redirect/content-type guards to also override the resolved hostname before the allowlist check)."
    why_human: "This is a residual test-coverage gap on a security-relevant guard, disclosed honestly by the phase rather than hidden. It is technically closeable with more harness work (the pattern already exists for the other two guards) but was deliberately left as source-only by 09-02's plan."
  - test: "Confirm IMG-05's live half is acceptable as source-verified-only, given no external-thumbnail post currently exists in the operator's Notion database."
    expected: "Accept as sufficient (source-verified + independently corroborated by code review), or add a throwaway external-thumbnail test post to the operator's own database to close the live-observation gap."
    why_human: "Whether to accept a coverage gap that requires either a database mutation the phase's own honesty rule ruled out, or is inherently unexercisable until a real forker adds an external thumbnail, is an operator call."
---

# Phase 9: Thumbnail Freshness Verification Report

**Phase Goal:** Readers see post thumbnails on their first load of the deployed site, however long it
sat idle beforehand
**Verified:** 2026-08-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — ROADMAP Success Criteria (verbatim)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cold first load of the home page after an idle gap longer than Notion's ~1h presign lifetime shows every thumbnail; no blank-then-refresh sequence | ✓ VERIFIED | `09-EVIDENCE.md` Tier 3 steps 1-3, 5: a real 224-minute idle gap (well past the 60-70min margin and Notion's ~1h presign lifetime), corroborated independently by the `date`/`age` header arithmetic against the recorded window-start timestamp (not just an attestation). Three distinct home-feed thumbnail paths extracted from that stale, 224-minute-old captured HTML each resolved `200`, `image/png`, non-zero bytes on a direct, outside-the-optimizer request. A fresh cookie-less headless-browser pass corroborates (`naturalWidth>0 && complete`, 0 broken images). |
| 2 | Same idle-gap-then-cold-load check passes for a post detail page's hero thumbnail | ✓ VERIFIED | `09-EVIDENCE.md` Tier 3 step 4: hero path extracted from a post-page render that occurred inside the same 224-minute gap resolved `200`, `image/png`, `1,561,628` bytes on direct request. Browser corroboration matches (`1280×630`, `complete:true`). The *observable* is directly proven; the underlying Data Cache staleness *mechanism* is honestly recorded as MEDIUM confidence (inferred, not measured) — this does not weaken the observable result, which is what ROADMAP SC2 asks for. |
| 3 | A request to the thumbnail path is refused non-200 for: (a) a non-Notion-identifier id, (b) an off-allowlist resolved host, (c) a redirecting origin, (d) a non-`image/*` content type | ⚠️ PARTIAL — 3/4 sub-guards VERIFIED, 1/4 PRESENT_BEHAVIOR_UNVERIFIED | (a) id-parse: VERIFIED — local smoke + deployed battery T2-4/T2-5/T2-6 (garbage=400, absent-UUID=404, URL-as-id=400). (c) redirect: VERIFIED — controlled-origin fault-injection T2-1 (502, 0 bytes, harness HTML never leaked). (d) content-type: VERIFIED — T2-2 (502, 0 bytes). (b) host allowlist: **source-asserted only**, never observed firing — see `behavior_unverified_items`. Source code confirmed current: `apps/web/src/app/api/thumbnail/[id]/route.ts:28-31,86-89` — `ALLOWED_HOSTS` holds exactly the two `next.config.ts` hostnames (re-confirmed by direct read of both files in this verification pass, and independently corroborated by `09-REVIEW.md`'s code review). |
| 4 | A thumbnail that genuinely fails to resolve shows a visible placeholder, never an empty box | ✓ VERIFIED | `09-EVIDENCE.md` Tier 2, IMG-04 rows T3-1..T3-8: real headless-browser session, genuine failed image request (not just a devtools block), DOM-measured icon size/color/wrapper matches `09-UI-SPEC.md` exactly at both 32px (card) and 48px (hero), both light and dark themes, zero `<img>` left to render a broken-image glyph, survives a real theme toggle. Source confirmed: `apps/web/src/components/PostThumbnail.tsx:44-51`. |
| 5 | A post with an external (non-Notion-hosted) thumbnail renders unchanged, never through the proxy path | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Structural half verified: 3 distinct post ids on the deployed site all route through the proxy, zero absolute-URL `<img src>` values on either page checked. Live half **unexercised**: the operator's database contains no external-thumbnail post. Source-verified: `PostThumbnail.tsx:38-41` (`thumbnailType === "external"` returns `post.thumbnail` unchanged, never constructs the proxy path) and `route.ts:74-76` (non-`"file"` thumbnails 404). Independently re-confirmed by `09-REVIEW.md`'s code review ("PostThumbnail.tsx correctly special-cases thumbnailType !== \"file\" before ever constructing the proxy path"). |

**Score:** 4/5 roadmap criteria fully verified by behavioral evidence; 1/5 (SC3) verified for 3 of its 4 sub-guards, with the 4th (host allowlist) present + wired but behaviorally unexercised.

### Additional Plan-Level Must-Have (09-01, additive to the 5 ROADMAP criteria)

| Truth | Status | Evidence |
|-------|--------|----------|
| "No HTML the site serves embeds a Notion presigned S3 URL for a Notion-hosted thumbnail — the expiring value is no longer embedded anywhere in cached markup" | ✗ **FALSE AS WRITTEN** (per the phase's own disclosure) | `09-EVIDENCE.md` Tier 2, "Finding: a presigned URL is still embedded in the RSC flight payload": 3 presigned URLs on the home page, 1 on the post page, all inside `self.__next_f.push([...])` RSC hydration scripts, none in an `<img src>`. Confirmed source-level: `PostThumbnail.tsx` is a Client Component receiving the whole `post` object, so React serializes `post.thumbnail` for hydration regardless of which render branch actually uses it. See `behavior_unverified_items` — routed to human decision, not treated as a phase-blocking gap, because it does not affect the phase's actual GOAL (no `<img>` ever requests the expiring URL) and its fix is an out-of-scope architectural change (narrowing the component's props). |

This truth is stricter than anything the ROADMAP's 5 success criteria actually promise (they are about *readers seeing thumbnails*, not about markup-level secret hygiene), so its failure does not by itself mean the phase goal was missed — but it is a real, disclosed, unresolved finding and is carried into the verdict as an escalation item rather than silently dropped.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/api/thumbnail/[id]/route.ts` | Exports `GET` and `runtime`, holds all four IMG-03 guards, streams the body | ✓ VERIFIED | Read in full this session. `runtime = "nodejs"` (line 5), `freshNologClient` is a second `NologClient` with `fetchOptions:{cache:"no-store"}` (line 18-22), never imports `@/lib/notion`, `parsePageId` gate (line 56), `getPost` 404 gate (line 68), non-`"file"` 404 gate (line 74), URL-parse 400 gate (line 78-84), `ALLOWED_HOSTS.has()` 400 gate (line 86-89), `redirect:"error"` fetch with 502 catch (line 91-102), content-type 502 gate (line 104-108), `new Response(upstream.body, ...)` streaming passthrough with `cache-control: public, s-maxage=14400, immutable` and `x-content-type-options: nosniff` (line 113-123). |
| `apps/web/src/components/PostThumbnail.tsx` | `"use client"`, named export, card/hero variants, `onError` → `ImageOff` | ✓ VERIFIED | Read in full this session. Line 1 client directive, named export `PostThumbnail` (line 30), `WRAPPER`/`ICON_SIZE` variant maps match `09-UI-SPEC.md` token/size contract exactly, `failed` state + `onError` swap to centred `ImageOff` at the variant's icon size in `text-text-tertiary` (line 44-51), external-branch never constructs the proxy path (line 38-41). |
| `apps/web/src/types/index.ts` | Local `Post` carries `thumbnailType` | ✓ VERIFIED | `grep -n "thumbnailType"` confirms `thumbnailType: "file" \| "external" \| null;` at line 19. |
| `apps/web/src/templates/default/{HomePage,SearchPage,CategoryPage,PostPage}.tsx` | Each renders `PostThumbnail`, none imports `next/image` | ✓ VERIFIED | `grep` across all four files confirms `PostThumbnail` imported and used (card variant × 3, hero variant × 1), zero `next/image` imports remain in `templates/default/`. |
| `.planning/phases/09-thumbnail-freshness/09-EVIDENCE.md` | Three tiers, in run order, closing per-requirement summary | ✓ VERIFIED | Read in full this session (762 lines). Tier 1 (source assertions, 09-01), Tier 2 (deployed + controlled-origin, 09-02), Tier 3 (idle window, 09-03), closing summary naming every unexercised item with its reason — matches the phase's own stated discipline. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| All four `default`-template surfaces | `PostThumbnail` | direct import + JSX usage | ✓ WIRED | Confirmed by grep this session: 1 import + 1 usage in each of the 4 files. |
| `PostThumbnail` "file" branch | `/api/thumbnail/{post.id}` | template-literal string interpolation | ✓ WIRED | `PostThumbnail.tsx:38-41` — confirmed the `external` branch never touches this path. |
| Route's fresh lookup | `freshNologClient` (second `NologClient`, `no-store`) | direct construction at module scope | ✓ WIRED, never routes through `@/lib/notion` | Confirmed: `grep -F -c 'from "@/lib/notion"'` = 0 in the route file (re-run this session, matches evidence). |
| Route's host check | `apps/web/next.config.ts`'s `images.remotePatterns` | duplicated literal Set, not imported | ✓ WIRED (source-level match confirmed) | Both files read this session: `s3.us-west-2.amazonaws.com` and `prod-files-secure.s3.us-west-2.amazonaws.com` appear identically in both. Guard's *firing* unexercised — see truths table row 3(b). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PostThumbnail` `src` (file branch) | `/api/thumbnail/${post.id}` | `post.id` from server-fetched `Post`, resolved server-side by the route at request time via `freshNologClient.getPost()` against live Notion data | Yes — confirmed by Tier 3's direct proxy-path requests returning real, non-zero image bytes after a 224-minute idle gap | ✓ FLOWING |
| `PostThumbnail` `src` (external branch) | `post.thumbnail` unchanged | Server-fetched `Post` object | Not independently observed live (no external-thumbnail post exists in the operator's DB) but the flow itself (prop → unmodified render) is trivially traceable in source and not a stub | ⚠️ Source-confirmed flow, live data unexercised (see truths row 5) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Production build succeeds after all phase-9 commits (re-run independently this verification session, not re-citing the evidence doc) | `npm run build --workspace=apps/web` | `✓ Compiled successfully`, `Finished TypeScript`, all 9 routes generated including `ƒ /api/thumbnail/[id]` | ✓ PASS |
| No debt markers left in phase-9 files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 7 phase-9-modified files (re-run this session) | zero matches in any of the 7 files | ✓ PASS |
| WR-01 (terminal auto-typing lock) fix landed as claimed | `git log --oneline -5` | commit `4396723 fix(terminal): release the typing lock when a cancelled run is cleaned up` present | ✓ PASS |
| WR-02 (no fetch timeout) still open | `grep -n "AbortSignal\|signal:" route.ts` | zero matches | confirms 09-REVIEW.md's finding is still current — not a regression, a known open item |
| IN-01 (`encodeURIComponent` missing) still open | `grep -n "encodeURIComponent" PostThumbnail.tsx` | zero matches | confirms 09-REVIEW.md's finding is still current — not exploitable today (`post.id` is always a Notion UUID) per the review's own reasoning, independently plausible from `mapPageToPost()`'s `id: page.id` assignment |
| `X-Amz-Signature`/`X-Amz-Credential` never committed | `grep -cE 'X-Amz-(Signature\|Credential)' 09-EVIDENCE.md` (re-run this session) | `0` | ✓ PASS — prohibition held |
| No fault-injection residue in the shipped route | `grep -c 'THUMBNAIL_TEST_ORIGIN' route.ts` (re-run this session) | `0` | ✓ PASS — prohibition held |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe declarations exist in this phase's PLAN/SUMMARY files — the phase's own verification methodology (evidence-tiered manual/scripted checks against a real deployment) substitutes for a probe harness, and Step 7c's discovery found nothing to run. Skipped for absence of a probe convention.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| IMG-01 | 09-01 (fix), 09-03 (proof) | Home feed thumbnails survive idle gap | ✓ SATISFIED | Tier 3 steps 1-3, 5 |
| IMG-02 | 09-01 (fix), 09-03 (proof) | Post hero thumbnail survives idle gap | ✓ SATISFIED | Tier 3 step 4, 5 |
| IMG-03 | 09-01 (build), 09-02 (probe) | Route refuses non-Notion input, off-allowlist host, redirect, non-image content | ⚠️ PARTIAL — 3/4 sub-guards satisfied by observation, host-allowlist sub-guard source-verified only | Tier 1 + Tier 2 |
| IMG-04 | 09-01 (build), 09-02 (browser observation) | Genuinely failing thumbnail shows placeholder | ✓ SATISFIED | Tier 2, T3-1..T3-8 |
| IMG-05 | 09-01 (build), 09-02 (page-source check) | External thumbnails bypass the proxy | ⚠️ PARTIAL — structural half + source verified, live half unexercised | Tier 2 |

`REQUIREMENTS.md` lines 35-39 and 109-113 mark all five `[x]` complete — consistent with the plans' own `requirements mark-complete` state updates, which this verification neither disputes for the fully-satisfied items nor silently accepts for the partial ones (flagged above).

**No orphaned requirements.** All five IMG-01..IMG-05 IDs appear in at least one of the three plans' `requirements:` frontmatter fields (09-01: all five; 09-02: IMG-03/04/05; 09-03: IMG-01/02), and REQUIREMENTS.md's Phase 9 mapping (lines 109-113) lists exactly these five and no others.

### Anti-Patterns Found

None found in this verification's independent re-scan of the 7 phase-9-modified source files (debt markers, empty implementations, hardcoded stub data — all clean). `09-REVIEW.md` (code review, same session, files independently re-read here) found 0 Critical findings. 3 Warnings and 3 Info items remain open and are carried forward as known, non-blocking issues (none newly discovered by this verification):

| File | Finding | Severity | Impact |
|------|---------|----------|--------|
| `terminal/components/TerminalConsole.tsx` (WR-01) | Auto-typing cleanup didn't reset `isTyping` | Warning | **Fixed** — commit `4396723`, confirmed present in `git log` this session |
| `api/thumbnail/[id]/route.ts:91-102` (WR-02) | No timeout/`AbortSignal` on the outbound fetch | Warning | Open. A hanging upstream ties up the Function invocation with no fast-fail path. Confirmed still absent this session. |
| `components/notion/MermaidBlock.tsx` (WR-03) | `securityLevel:"loose"` + `dangerouslySetInnerHTML` | Warning | Open, pre-existing (not touched by phase 9's diff), narrow exploitation path in current single-author model |
| `PostThumbnail.tsx:41` (IN-01) | No `encodeURIComponent` on `post.id` in the proxy path | Info | Open, not currently exploitable (`post.id` is always a Notion UUID) |
| `terminal/PostPage.tsx:70-80` (IN-02) | Terminal template still renders `post.thumbnail` directly, bypassing the whole fix | Info | Open by design (D-03) — `terminal` is the inactive template (`site.config.ts` sets `default`), confirmed this session. The original staleness bug survives there but has no live reader. |
| Three `templates/default/*.tsx` (IN-03) | Byte-identical card-list markup duplicated across 3 files | Info | Open, pre-existing, unrelated to the thumbnail fix's own scope |

## Human Verification Required

See `human_verification` in the frontmatter above. Three items:

### 1. RSC flight-payload exposure — accept residual risk or schedule a fix

**Test:** Decide whether presigned URLs remaining inside `self.__next_f.push([...])` hydration scripts
(never in an `<img src>`) is acceptable for this milestone, or should trigger a follow-up plan to narrow
`PostThumbnail`'s props so `post.thumbnail` never crosses the client boundary for file-type thumbnails.
**Expected:** An explicit decision, recorded either as an accepted override on the affected 09-01
must_haves truth, or as a scheduled follow-up.
**Why human:** Security/privacy risk acceptance on a live-but-inert credential exposure is a judgment
call, not something a grep or a build check can resolve.

### 2. Host-allowlist guard — accept source-only assurance or extend the harness

**Test:** Decide whether the host-allowlist guard's source-level correctness (confirmed twice
independently — this verification's own read of `route.ts` and `next.config.ts`, plus `09-REVIEW.md`'s
separate code review pass) is sufficient, given it structurally cannot be exercised against real Notion
data (Notion chooses the presign host, not the operator).
**Expected:** Accept as sufficient, or direct that the existing fault-injection harness pattern (already
proven for the redirect and content-type guards in `09-02`) be extended to also override the resolved
hostname.
**Why human:** This is a disclosed test-coverage gap on a security-relevant guard; closing it is possible
but was a deliberate scope decision in `09-02`, not an oversight.

### 3. IMG-05 live half — accept source-only assurance or seed test data

**Test:** Decide whether IMG-05's external-thumbnail bypass claim, currently source-verified only
(no external-thumbnail post exists in the operator's live database), is sufficient.
**Expected:** Accept as sufficient (source + independent code-review corroboration), or add a throwaway
external-thumbnail post to the operator's own Notion database to close the live-observation gap.
**Why human:** The phase's own honesty rule correctly ruled out mutating production content to
manufacture the case; whether that gap is acceptable is an operator call.

## Gaps Summary

**No blocking implementation gaps were found.** Every artifact this phase claims to have created exists,
is substantive, is wired into its call sites, and (where a direct check was re-runnable) produces real
data. The production build is green, no debt markers were left behind, and the two security prohibitions
this phase carries (no committed presigned-URL credentials, no fault-injection residue reaching the
deploy) both held on independent re-check.

What keeps this from a clean `passed` is not missing work but **honestly disclosed incompleteness that
the phase's own evidence already surfaced and that requires a human decision, not more code**: one of
IMG-03's four guards (host allowlist) and IMG-05's live half were never behaviorally exercised because
the required conditions (an off-allowlist Notion presign, an external-thumbnail post) cannot be
constructed from real data without either fabricating a case or mutating production content — both of
which the phase correctly declined to do. Separately, a stricter-than-ROADMAP must_haves truth from 09-01
("no presigned URL anywhere in cached markup") is false as literally written: three presigned URLs remain
in the RSC hydration payload of the home page and one on the post page, never in an `<img src>`, and
therefore never reaching a reader's actual image request — but present in public, CDN-cached markup for
their lifetime. This is a genuine, disclosed finding that does not block the phase's stated goal (readers
do see thumbnails, proven by a real 224-minute idle-gap test) but does warrant an explicit operator
decision on whether the residual exposure is acceptable as-is.

All three items above were flagged by the phase's own execution (09-02-SUMMARY.md, 09-EVIDENCE.md's
closing section) before this verification ran — this report corroborates rather than newly discovers
them, confirms none was quietly promoted from inference to observation, and routes them to the
operator as the framework's Escalation Gate is designed to do.

---

_Verified: 2026-08-12_
_Verifier: Claude (gsd-verifier)_
