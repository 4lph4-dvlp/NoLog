---
phase: 07-content-failure-isolation-live-diagnosis
reviewed: 2026-08-10T00:00:00Z
depth: deep
files_reviewed: 5
files_reviewed_list:
  - apps/web/src/lib/notion-x.ts
  - apps/web/src/app/api/diagnose-page/route.ts
  - apps/web/src/app/post/[id]/page.tsx
  - apps/web/src/lib/post-availability.ts
  - apps/web/src/components/PostUnavailable.tsx
findings:
  critical: 0
  high: 1
  medium: 1
  low: 3
  total: 5
status: resolved
---

# Phase 7: Code Review Report

**Reviewed:** 2026-08-10
**Depth:** deep (cross-file, plan-aware, adversarial)
**Files Reviewed:** 5
**Status:** issues

## Summary

Reviewed the five files changed in Phase 7 against the locked decisions in `07-CONTEXT.md`, the threat
models in `07-01-PLAN.md`/`07-02-PLAN.md`, and the priorities given for this review. `npm run lint` and
`npx tsc --noEmit` both pass clean on the changed files. The secret gate in `diagnose-page/route.ts` is
sound: `safeCompare`'s length-mismatch branch self-compares (`timingSafeEqual(bufA, bufA)`) so it never
throws, the double gate (`NOTION_DEBUG_DIAGNOSTICS` AND bearer secret) cannot be satisfied by either alone,
and every rejection path returns a byte-identical bare 404. `notFound()` sits outside every `try`, and the
`D-17 audit` comment's claim about every `await` in `post/[id]/page.tsx` checks out against the actual code.
`classifyMissingPost` runs only inside the `!post` branch, bypasses the `cache()`-wrapped `getPost`, never
throws, and its two-value union terminates cleanly in either `notFound()` or `PostUnavailable`. No
locked-decision violations were found: `packages/core/`, `package.json`, and `package-lock.json` are
untouched, no `error.tsx` was added, and the `"Content could not be loaded."` string is unchanged.

One finding rises above cosmetic: the D-04 raw-fetch probe in `notion-x.ts` falls back to the **raw,
unvalidated** page id when `parsePageId` rejects it, directly repeating — inside brand-new code — the
"unvalidated input reaches an outbound request" pattern this file's own containment logic (and the sibling
`diagnose-page/route.ts`) is designed to prevent. The remaining findings are a forward-looking
teardown/coupling risk for Phase 8 and minor duplication/noise items.

## High

### F-01: D-04 probe falls back to the unvalidated raw page id when `parsePageId` rejects it

**File:** `apps/web/src/lib/notion-x.ts:135` (reached via `apps/web/src/app/post/[id]/page.tsx:119`)

**Issue:** `describeFetchFailure`'s probe branch builds its outbound POST body as:

```ts
body: JSON.stringify({
  pageId: parsePageId(pageId) ?? pageId,   // <-- falls back to the raw, unvalidated value
  ...
})
```

This is reached whenever `allowProbe` is `true` and the caught error is **not** `FetchErrorShape`
(no `.status`) — which, per this plan's own `07-01-PLAN.md` (Task 1's `read_first` note and 07-RESEARCH.md),
includes exactly the case of an invalid page id causing `notion-client` to throw its own
`"Notion page not found"` error *before making any HTTP request at all*. The one call site that passes
`allowProbe = true` is the content leg in `post/[id]/page.tsx:119`, where `id` is the **raw, unvalidated
dynamic route segment** — never run through `parsePageId` before this point (this is the pre-existing,
explicitly out-of-scope surface `07-CONTEXT.md` and `REQUIREMENTS.md` name, but that carve-out applies to
`getPageRecordMap(id)`'s *existing* call, not to new code added by this phase).

The net effect: for any `/post/<attacker-string>` request while `NOTION_DEBUG_DIAGNOSTICS=1` is set, if
`getPageRecordMap` throws a non-`FetchError`-shaped error (the invalid-id case is exactly this), this new
probe code fires an outbound `POST https://www.notion.so/api/v3/loadPageChunk` whose JSON body's `pageId`
field is the attacker's raw, unparsed input — not the empty/`400`-before-any-request posture that
`diagnose-page/route.ts:56-62` correctly implements for the identical situation just one file over. This
directly contradicts the stated invariant this review was asked to verify: *"`parsePageId` must run and
reject BEFORE any outbound request."* Here it runs but does **not** reject — it silently degrades to
unfiltered input and the request proceeds anyway.

**Why this is High and not Critical:** the destination URL is a hardcoded constant
(`LOAD_PAGE_CHUNK_URL`), not attacker-influenced, so this is not classic SSRF against an internal target —
it cannot be used to reach anything other than `www.notion.so`. It is also gated behind the temporary
`NOTION_DEBUG_DIAGNOSTICS` flag (unset by default, and scheduled for full removal in Phase 8 per D-19). But
while that flag is on in Production — which is exactly the state the operator used to capture
`07-EVIDENCE.md` — this turns the site into an unauthenticated relay that will echo arbitrary caller input
into a third-party request body on every malformed-id request, which is precisely the class of defect the
review's SSRF-containment priority exists to catch, and precisely the pattern this same file's containment
comment (line 66-67: *"never assembled from caller input (T-07-03)"*) claims does not happen.

**Fix:** do not fall back to the raw id. Either short-circuit the probe (matching
`diagnose-page/route.ts`'s pattern of returning before any outbound call) or omit the probe silently:

```ts
const parsedId = parsePageId(pageId);
if (!parsedId) {
  payload.probeSkipped = "invalid-page-id";
  return JSON.stringify(payload);
}
try {
  const res = await fetch(LOAD_PAGE_CHUNK_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ pageId: parsedId, limit: 30, chunkNumber: 0, cursor: { stack: [] }, verticalColumns: false }),
  });
  ...
```

## Medium

### F-02: `post-availability.ts` (permanent) depends on a symbol `D-19` commits to deleting from `notion-x.ts` (temporary)

**File:** `apps/web/src/lib/post-availability.ts:2` (imports `isDiagnosticsEnabled` from `@/lib/notion-x`),
used at `apps/web/src/lib/post-availability.ts:116`

**Issue:** `07-CONTEXT.md` D-19 explicitly commits Phase 8 to removing, exhaustively: *"`isDiagnosticsEnabled()`
and `describeFetchFailure()` in `apps/web/src/lib/notion-x.ts`, including the D-04 raw-fetch probe, **and
every call site of them**."* At the same time, D-19 explicitly lists `classifyMissingPost` +
`PostUnavailable` as **not** removed — they are permanent, requirement-bearing code (D-12/SC#4).

`classifyMissingPost`'s `buildResponseDetail` (`post-availability.ts:116`) is itself a call site of
`isDiagnosticsEnabled`. As written, D-19's teardown scope is internally inconsistent with what this phase
just shipped: Phase 8 cannot literally "remove `isDiagnosticsEnabled()`... and every call site of them"
without either (a) breaking `post-availability.ts`'s import and failing the build, or (b) leaving
`classifyMissingPost`'s diagnostic-gated fields (`status`, `contentType`, `bodyExcerpt`, `pageIdShape`,
`pageIdLength`) permanently unreachable once the gate function it depends on is deleted out from under it.
Neither outcome was made explicit by this phase — the coupling was introduced silently by choosing to reuse
`isDiagnosticsEnabled` from the temporary module inside the permanent one.

**Fix:** flag this now rather than let Phase 8 discover it mid-teardown. Either (a) have `post-availability.ts`
own its own minimal `isDiagnosticsEnabled` check (accepting the small duplication, matching the
"deliberately not extracted" precedent this same file already sets for `safeCompare`/`describePageIdShape`),
or (b) relocate `isDiagnosticsEnabled` to a location Phase 8's D-19 teardown explicitly excludes (e.g. treat
it as `classifyMissingPost`'s permanent dependency, not `notion-x.ts`'s temporary one, and update D-19's
enumerated removal scope in the next phase's context to say so explicitly). Either fix is cheap; the risk
is only that it goes unnoticed and Phase 8 either breaks the build or silently guts `classifyMissingPost`'s
diagnostic capability while believing it only touched diagnostic-only files.

## Low

### F-03: `describePageIdShape` and `BODY_EXCERPT_MAX_LENGTH` are duplicated verbatim across two files

**File:** `apps/web/src/lib/notion-x.ts:54-62,71` and `apps/web/src/lib/post-availability.ts:37,134-142`

**Issue:** Both files independently define an identical `describePageIdShape()` regex-matching function and
an identical `BODY_EXCERPT_MAX_LENGTH = 200` constant. The comments in `post-availability.ts` acknowledge
the duplication ("Mirrors `lib/notion-x.ts`'s `describePageIdShape()`") but do not extract it. Since one
copy lives in a module scheduled for deletion (D-19) and the other must survive, a shared, permanent home
(e.g. a small `lib/notion-diagnostics-shared.ts`, or simply folding it into `post-availability.ts` as the
canonical copy since that file survives) would remove the drift risk of one copy's regex changing without
the other's.

**Fix:** given F-02's finding, this is the natural moment to also settle where the shared diagnostic-field
logic (`describePageIdShape`, the 200-char cap, `isDiagnosticsEnabled`) permanently lives, rather than
duplicating it across a temporary and a permanent file.

### F-04: Gate-rejection log fires (once) even for a completely unconfigured default fork

**File:** `apps/web/src/app/api/diagnose-page/route.ts:44-50`

**Issue:** `gateRejectionLogged` latches to true and emits one `[DiagnosePage]` `console.error` line the
first time *anyone* — including a bot or scanner sweeping common `/api/*` paths, with no `Authorization`
header at all — hits this route, regardless of whether `NOTION_DEBUG_DIAGNOSTICS` was ever set. Every forker
ships this route file (it can't be conditionally excluded from the build), so a forker who set zero env vars
can still get one incidental `console.error` line in their Vercel dashboard from routine internet background
noise. This is consistent with the sibling `notify-subscribers`/`subscribe` routes' existing pattern (not a
new pattern this phase invented) and is bounded to one line per cold start, so it is low-impact — but it is
a small deviation from the "unset env var ⇒ zero behavior change" convention D-02 explicitly invokes as this
phase's own bar.

**Fix:** optional — could gate the log itself on `diagnosticsOn` being true (i.e., only log when the
operator has at least turned diagnostics on but supplied a bad/missing secret), so a fully-default fork never
emits a line from this route at all. Not blocking; note for Phase 8's teardown pass if it's judged worth the
one-line change before deletion.

### F-05: D-04 probe uses no explicit `User-Agent`, so it can reproduce rather than diagnose the confirmed root cause

**File:** `apps/web/src/lib/notion-x.ts:131-141`

**Issue:** `07-EVIDENCE.md`'s verdict confirms the root cause is Cloudflare rejecting `notion-client`'s
default `user-agent: node` (Node's own `fetch` default) in front of `loadPageChunk`. The D-04 fallback probe
in this file calls the same endpoint with the same unadorned global `fetch` and sets no `User-Agent` header
of its own — so in exactly the scenario the probe exists to help with (an error with no attached `Response`
to read status/content-type from), the probe is likely to receive the *same* 403 Cloudflare challenge rather
than new diagnostic information. In practice this turned out to be moot (`07-EVIDENCE.md` records
`"viaProbe": false` on every captured failure — the probe was implemented, deployed, and never actually
needed), so this had zero effect on this phase's outcome, but it is worth recording as a latent gap in case
a different notion-client failure shape reaches the probe path in the future.

**Fix:** none required given the instrumentation is temporary (D-19) and this had no observed impact. If the
probe is ever needed again, adding a browser-shaped `User-Agent` to the probe request would make it robust
to the very failure mode this phase discovered.

---

_Reviewed: 2026-08-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

---

## Resolution (recorded 2026-08-09, post-review)

| ID | Severity | Disposition | Where |
|----|----------|-------------|-------|
| F-01 | High | **fixed in code** | commit `2f4a349` — `apps/web/src/lib/notion-x.ts` |
| F-02 | Medium | **fixed in the decision, not the code** | commit `f32b3fe` — `07-CONTEXT.md` D-19 |
| F-03 | Low | accepted | duplication is confined to a surface D-19 deletes; de-duplicating code scheduled for removal adds a refactor with no payoff |
| F-04 | Low | accepted | one log line per instance, bounded by the `gateRejectionLogged` latch — verified live at 16:43 UTC, where two unauthorised requests produced exactly one line. Disappears entirely with the route |
| F-05 | Low | accepted, and **useful to Phase 8** | see note below |

**F-01 — what changed.** `describeFetchFailure`'s probe previously did `pageId: parsePageId(pageId) ?? pageId`,
falling back to the caller's raw string when parsing failed. Because `post/[id]/page.tsx`'s content leg passes
the unvalidated dynamic route segment with `allowProbe = true`, a request to `/post/<arbitrary string>` could
place caller-controlled data into the body of a POST to Notion whenever `NOTION_DEBUG_DIAGNOSTICS` was set.
The destination URL is a fixed constant, so this was never redirectable — but "validate first, reject on
failure" is the rule `api/diagnose-page/route.ts` already follows (it answers 400), and this path was the one
place opting out. The probe now refuses on an unparseable id and records `probeSkipped: "unparseable_page_id"`
with `viaProbe: false`, so the refusal is itself visible in the diagnostic rather than silent. Build and lint
clean after the change.

**Exposure assessment.** Nil at the time of the fix: both Production debug env vars were removed at
2026-08-09 17:05 UTC and the closeout redeploy landed at 17:13 UTC, so the gated path was already unreachable
in production. The fix matters for the next time diagnostics are enabled — which, by construction, is a moment
when someone is debugging under pressure and least likely to be auditing this path.

**F-02 — why the decision changed rather than the code.** The code is correct; `D-19`'s teardown scope was
wrong. As first written it listed `isDiagnosticsEnabled()` for deletion while also committing to keep
`post-availability.ts`, which imports it. D-19 now names the coupling explicitly and offers two deliberate
resolutions, recommending the smaller one (keep the three-line predicate; remove the route, the deep
diagnostics, and the documentation). This is the class of defect that surfaces as a broken build in a later
phase, which is exactly why it is recorded now rather than left to be rediscovered.

**F-05 — carry into Phase 8.** The D-04 probe sets no explicit `User-Agent`, so it would be answered by the
same Cloudflare block this phase confirmed as the root cause. It never mattered in practice — every captured
diagnostic reported `viaProbe: false`, meaning the thrown `FetchError` already carried the status and the
probe never fired. It is noted because it is the same defect class as the bug itself: **an outbound request in
this codebase that does not set a `User-Agent` is now known to be blocked.** Phase 8's fix should be applied
with that generality in mind rather than patched narrowly at one call site.
