# Phase 8: Content Rendering Fix - Research

**Researched:** 2026-08-10
**Domain:** Vercel ISR cache-freshness verification; a two-state error/empty discrimination for `react-notion-x`/`notion-client` rendering; scoped deletion of diagnostic-only code from a Next.js 16 App Router repo
**Confidence:** HIGH on all five assigned questions — everything below is either read directly from this repo's source this session, or from Vercel's official docs fetched this session. No new library research was needed; D-01/D-02/D-03 (the fix itself) are closed facts from Phase 7, cited but not re-derived.

## Summary

This research answers the five open questions the phase brief scoped in — it does **not** revisit the root cause or the fix mechanism, both closed in `07-EVIDENCE.md`. Five findings, in order of how load-bearing they are for planning:

1. **The repo has no on-demand revalidation route today.** The phase brief's premise — "the repo already has an on-demand revalidation path wired to `notion-posts`" — does not hold. `grep` across `apps/web/src` found the cache tag string (`apps/web/src/lib/notion.ts:6,14`) but zero calls to `revalidateTag()`/`revalidatePath()` anywhere in application code. SC#1's verification procedure must therefore rely on waiting out the natural 180s `revalidate` window plus reading Vercel's `x-vercel-cache` response header — not on-demand invalidation, because that path does not exist to use.

2. **`x-vercel-cache` has six values, precisely defined by Vercel's own docs (fetched live this session)**, and the two that prove a genuine, non-deploy-triggered regeneration occurred are `MISS` (cold — first hit, response is freshly generated) and `HIT` immediately following a `STALE` response (the `STALE` response itself serves *old* content while a background regen runs; the *next* hit after it is what proves the regen completed and is now being served). A concrete 3-request verification procedure using this is below.

3. **CONT-05's discrimination is a two-variable problem, and the phase brief's own D-10 only settles the first variable.** Failed-vs-not is free (the existing catch boundary). But distinguishing "arrived, nothing to render" from "arrived, has content" needs an actual emptiness check, and no such check exists in the repo today. I traced `notion-client`'s `getPage()` (verified by reading `node_modules`) and found it throws before ever returning if `recordMap.block` is entirely absent — so an "empty" `recordMap` that reaches our code always has at least one block (the page container itself). The distinguishing signal is whether that block has any children. `notion-utils`'s exported `getPageContentBlockIds()` (already a direct dependency) is the right tool for this, but I could not test it against a genuinely content-empty live Notion page this session — flagged as an assumption.

4. **The D-19 teardown has one coupling the phase brief didn't ask about but the plan needs: `describeFetchFailure` has two live call sites inside `post/[id]/page.tsx` itself** (not just the deleted route), and deleting the function without replacing those two call sites is a compile error. Full enumeration below.

5. **Validation Architecture, given zero test infrastructure**, leans on `next build` (route-list diffing to prove the diagnose-page route is gone), source-inspection checklists, and deployed-site observation — same shape the repo has used for every prior phase in this milestone.

**Primary recommendation:** Ship the fix as a single `ofetchOptions.headers["User-Agent"]` addition to the existing `NotionAPI` constructor call in `notion-x.ts`; carry a second, independent `contentFetchFailed`-shaped signal (not a recordMap-truthiness reuse) from the route to `DefaultPostPage` so CONT-05's two states are structurally distinct; verify SC#1 with the 3-request `x-vercel-cache` procedure below, not on-demand revalidation (it doesn't exist) and not a single post-deploy load (Pitfall 15).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Outbound `User-Agent` on the `notion-client` request | API / Backend | — | `notion-x.ts` runs only during server-side ISR regeneration; never reaches the browser |
| CONT-05 fetch-failed vs. no-content discrimination | Frontend Server (SSR) | API / Backend | The boolean/enum is computed in the Server Component (`post/[id]/page.tsx`) from data the Backend-tier call already returned; rendering the two sentences happens in the SSR template (`DefaultPostPage.tsx`), never client-side |
| ISR regeneration proof (`x-vercel-cache`) | CDN / Static | — | The header is attached by Vercel's edge/CDN layer, not by application code; the app has no way to read or influence it at runtime |
| D-19 diagnostic teardown | API / Backend | Frontend Server (SSR) | The route (`api/diagnose-page`) is Backend tier; the two `describeFetchFailure` call sites being replaced live in the SSR page component |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**The Fix — User-Agent**
- **D-01:** The fix is to send a `User-Agent` header on `notion-client`'s requests. Cloudflare answers Node's default `user-agent: node` with 403 + an HTML challenge page. Satisfies ROADMAP SC#2 — the fix targets the evidence, not the hypothesis.
- **D-02:** `ofetchOptions` on the `NotionAPI` constructor is the mechanism — established by direct inspection of the installed package: `node_modules/notion-client/build/index.js:26-37` accepts `ofetchOptions`, and lines 538-545 merge `...this._ofetchOptions?.headers` into every request's headers (only `Content-Type`, `cookie` and `x-notion-active-user-header` are applied after it, so a `User-Agent` set this way reaches the wire). No patch, no fetch wrapper, no new dependency.
- **D-03:** The UA is an honest, self-identifying string, the shape `NoLog (+https://github.com/4lph4-dvlp/NoLog)`. Measured, not assumed: `node` → 403; `NoLog/1.1 (+…)` → 200; `Mozilla/5.0 (compatible; NoLog/1.1; +…)` → 200; bare `NoLog` → 200; a real Chrome UA → 200.
- **D-04:** No version number in the UA. Identification and contact are the whole purpose; a fork's "version" diverges from upstream immediately.
- **D-05:** The UA is a hardcoded constant, not forker-configurable — no env var, no `site.config.ts` field. D-19's whole premise is that a forker ends up with zero net new env vars.
- **D-06:** Define the UA once as a shared exported constant, apply it only to the `notion-client` construction in this phase. Phase 9's thumbnail-proxy work will reuse the constant. Deliberately not applied to `@notionhq/client`, Resend, or any other currently-working call path.

**Resilience Scope**
- **D-07:** Ship the header fix alone. Build no escalation defence. Writing a fallback path for an unobserved future failure mode is `PITFALLS.md` Pitfall 6's "unverified safety net."
- **D-08:** No new detection logging for a future re-block.
- **D-09:** If the block ever returns, the reader sees exactly what they see today — title/metadata render, body shows "could not be loaded" (sharpened by CONT-05). No retry button (CONT-F01, v2).

**CONT-05 — Two Distinct States**
- **D-10:** The two states are discriminated by whether the fetch succeeded, not by inspecting content volume. A caught failure ⇒ "could not be loaded"; a `recordMap` that arrived but has nothing to render ⇒ "no content yet." Counting blocks was rejected as needing an arbitrary threshold (an "empty" page still carries structural blocks); a cross-check against the official API was rejected under Pitfall 4.
- **D-11:** Copy is factual and short, matching existing tone (`text-text-secondary italic`): no-content ≈ "This post has no content yet."; fetch-failed ≈ "This post's content could not be loaded right now." Exact wording is the planner's to finalize within that shape. Unlocalized English, matching existing precedent.
- **D-12:** No recovery hint on the fetch-failed state. `PostUnavailable` keeps its own "check back in a few minutes" copy because it describes a genuinely transient `getPost` failure — a different condition.

**D-19 Teardown and Deploy Ordering**
- **D-13:** Resolution (a) of D-19: keep `isDiagnosticsEnabled()`. `apps/web/src/lib/post-availability.ts` — a permanent file — imports it. Removed in this phase: `apps/web/src/app/api/diagnose-page/route.ts` in full; `describeFetchFailure()` in `apps/web/src/lib/notion-x.ts` including its D-04 raw-fetch probe and every call site; any documentation mention of `NOTION_DEBUG_DIAGNOSTICS` / `NOTION_DEBUG_ROUTE_SECRET`. Kept: the ungated leg-naming logs, the per-concern catch decomposition, `classifyMissingPost`, `PostUnavailable`, and `isDiagnosticsEnabled()`.
- **D-14:** The fix, CONT-05, and the teardown ship in ONE deploy. Every deploy invalidates the entire ISR cache, and Phase 9 needs an uninterrupted idle window longer than Notion's ~1h presign lifetime.
- **D-15:** Phase 8 also closes Phase 7's two outstanding UAT items (`07-UAT.md`: SC#3 chrome-failure isolation, SC#4 transient-failure discrimination).

### Claude's Discretion
- The exact final UA string within D-03's shape, and which module the shared constant lives in.
- The exact final wording of the two CONT-05 sentences within D-11's shape.
- Whether the `terminal` template's post view gets the same CONT-05 split (default: leave it alone — out of scope this milestone).
- Ordering of tasks within the single deploy, and whether teardown lands in the same commit or a sibling commit inside the same push.

### Deferred Ideas (OUT OF SCOPE)
- Reader-facing retry control on a content-fetch failure — CONT-F01, v2.
- Caching / revalidation wrapper for `getPageRecordMap()` — CONT-F02, v2.
- Escalation defence if Cloudflare moves beyond UA filtering — deliberately unbuilt (D-07).
- Applying the shared UA constant to other outbound paths (official API, Resend, S3) — constant created here for Phase 9 reuse, no other path changed (D-06).
- `terminal` template parity for the CONT-05 split — TMPL-F01, out of scope this milestone.
- Localizing reader-facing fallback copy — not this phase (D-11).
- Validating the dynamic route segment before it reaches the Notion API URL — long-standing open security item, explicitly out of scope for v1.1.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-03 | Reader sees the post's Notion content rendered on first visit, for every post published to the web | Fix mechanism verified by direct `node_modules` read (§ Code Examples); SC#1 verification procedure using `x-vercel-cache` (§ Finding 1/2) closes the "genuine regeneration" evidence gap |
| CONT-05 | Reader sees distinct wording for "no content yet" vs "content could not be fetched" | Two-variable discrimination analysis (§ Finding 3); minimal prop-shape change for `DefaultPostPageProps`; emptiness-detection heuristic with its limitation flagged |

## Finding 1 — No on-demand revalidation path exists in this repo

**This corrects an assumption stated in the phase brief.** I searched for it directly:

```
grep -rn "notion-posts\|revalidateTag\|revalidatePath" apps/web/src --include="*.ts" --include="*.tsx"
→ apps/web/src/lib/notion.ts:6:const NOTION_CACHE_TAG = "notion-posts";
```

`[VERIFIED: apps/web/src/lib/notion.ts:6,14]` — the constant `NOTION_CACHE_TAG = "notion-posts"` exists and is attached to every `nologClient` fetch via `fetchOptions: { next: { revalidate: CONFIG.revalidate, tags: [NOTION_CACHE_TAG] } }`. But `revalidateTag`/`revalidatePath` do not appear anywhere in `apps/web/src` — a repo-wide grep for those two identifiers returns zero application-code hits (the only matches are inside `apps/web/.next/types/*.d.ts`, which is Next's own generated ambient type file, not a call site). There is no API route, webhook, or Server Action that calls `revalidateTag("notion-posts")`.

**Consequence for planning:** SC#1's verification cannot use "trigger on-demand revalidation, then check" as its mechanism — that mechanism doesn't exist to invoke. The verification must instead be built entirely on (a) waiting out the natural `CONFIG.revalidate = 180` window (`apps/web/src/site.config.ts:57`, `[VERIFIED: apps/web/src/site.config.ts:57]`, quote: `revalidate: 180,`), and (b) reading the `x-vercel-cache` response header to confirm which requests actually triggered a fresh regeneration versus served a cached copy. This is not a gap the plan needs to fill with new code — building an on-demand revalidation webhook here would be new scope beyond CONT-03/CONT-05 and is not mentioned in any locked decision. **Recommendation: do not build one this phase.** The wait-and-observe procedure below is sufficient for SC#1 and requires no new code.

## Finding 2 — `x-vercel-cache` semantics and the SC#1 verification procedure

Fetched directly from Vercel's own docs this session (`https://vercel.com/docs/caching/cache-status`, `last_updated: 2026-07-08`) — `[CITED: vercel.com/docs/caching/cache-status]`.

| Value | What it means | Proves a fresh regeneration happened *and is what this response shows*? |
|---|---|---|
| `HIT` | Served directly from cache, no function invocation. | No — proves nothing new happened on this request; the content could be from any earlier regeneration. |
| `MISS` (reason: Cold) | Nothing cacheable was found; Vercel generated the response now and stored it. Happens on first request after a deploy (Vercel scopes cached responses to the deployment that produced them) or a rarely-requested path's cache eviction. | **Yes.** This exact response is freshly generated. |
| `STALE` | The cache served an *existing, expired* response immediately, then re-invoked the function/origin in the background. | **No for this response** — the reader is seeing OLD content. The regeneration is happening but not shown yet. |
| `REVALIDATED` | The cached entry had been *deleted* (only via `revalidateTag()`/`revalidatePath()` without a lifetime, or a dashboard purge — neither of which this repo does, per Finding 1), so Vercel regenerated in the foreground and this response blocks on it. | **Yes**, but unreachable here since nothing in this repo ever deletes the cache entry this way. |
| `BYPASS` | Cache skipped on purpose (Draft Mode, crawler handling, etc.) | Not applicable to this route. |
| `PRERENDER` | Served from static storage built at build time. | Not applicable — this route has dynamic path params (`[id]`), not a build-time-enumerated static path. |

**The 3-request procedure this repo can actually run**, combining `x-vercel-cache` with the corroborating dashboard signal Phase 7 already used successfully (`SET Updating Data Cache` in the request's External APIs section, `07-EVIDENCE.md` lines 169-171):

1. **Request A**, immediately after the fix deploys. Every deploy invalidates the entire cache (confirmed live in `07-EVIDENCE.md`'s "Phase 9 dependency" note), so this request is a cold `MISS` by construction — this is already one genuine regeneration under the fixed code. Confirm the body renders and note `x-vercel-cache: MISS` (or read the Vercel dashboard's Cache section for the same request, which shows status+reason together per the docs above).
2. **Wait past `CONFIG.revalidate` (180s)** without visiting the same post URL. This is the step Pitfall 15 and the phase brief's SC#1 wording ("not one lucky load shortly after a deploy") specifically require — it proves the fix survives a *second*, deploy-independent regeneration cycle, not just the one the deploy itself forced.
3. **Request B**, after the wait. Expect `x-vercel-cache: STALE` — this response still shows Request A's cached (already-correct) output while a background regeneration fires. The body should still render correctly (it is Request A's content, already fixed) — this on its own is *not* new evidence of the ongoing fix, only that the earlier fix's output is still being served.
4. **Request C**, immediately after Request B (a few seconds later, giving the background regen time to complete). Expect `x-vercel-cache: HIT`, now serving the background regeneration that Request B triggered. **This is the second, independently-triggered genuine regeneration** — the concrete artifact that satisfies "spanning at least one genuine ISR regeneration, not one lucky load."
5. Repeat across at least 2-3 different posts (per SC#1's "verified across multiple posts").

**How to read the header:** `curl -sD - -o /dev/null https://4lph4-bl0g.vercel.app/post/<id>` and read the `x-vercel-cache:` line from the dumped headers — a GET request, not `-I`/HEAD, since HEAD handling can differ from GET for some cache paths (not confirmed either way for this specific route, so GET is the safer choice for this verification). The Vercel Dashboard → Logs → the specific request → **Cache** section shows the same status plus a **reason** (e.g., "Time-based revalidation" for the `STALE` case), which is a second, independently-readable confirmation of the same fact — this is the dashboard-only signal Phase 7 already demonstrated finding (`External APIs: … SET Updating Data Cache`, `07-EVIDENCE.md:169-171`).

**Write this procedure as a literal task step in the plan** — the phase brief asks for exactly this ("Produce a step-by-step verification procedure the plan can lift into a task").

## Finding 3 — CONT-05's implementation surface

### Current state, read directly this session

`apps/web/src/app/post/[id]/page.tsx:115-121` `[VERIFIED: apps/web/src/app/post/[id]/page.tsx:115-121]`:
```
let recordMap: Awaited<ReturnType<typeof getPageRecordMap>> | null = null;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap] ${await describeFetchFailure(error, id, true)}`);
  recordMap = null;
}
```
`recordMap` is `null` in exactly one case today: the catch fired. It is passed unchanged to `DefaultPostPage` at line 148: `<DefaultPostPage post={post} recordMap={recordMap} />`.

`apps/web/src/templates/default/PostPage.tsx:9-12,96-101` `[VERIFIED: apps/web/src/templates/default/PostPage.tsx:9-12,96-101]`:
```
interface DefaultPostPageProps {
  post: Post;
  recordMap: any; // Allow any type since it's from notion-x which has complex types
}
...
{recordMap ? (
  <NotionPageRenderer recordMap={recordMap} />
) : (
  <p className="text-text-secondary italic">Content could not be loaded.</p>
)}
```
This is the single sentence D-11 replaces with two. `recordMap`'s truthiness is currently the *only* signal the template has — it cannot distinguish "the fetch failed" from "the fetch succeeded but returned nothing to render," because both collapse to `null`/falsy today, and neither state is even reachable today because a successful `getPageRecordMap()` never returns something falsy (see Finding 4 — it either has content-bearing blocks, or notion-client throws before returning at all).

### Recommended minimal change

Two independent booleans (or a three-state enum) travel from the route to the template — not a repurposing of `recordMap`'s truthiness, because that field is also needed by `NotionPageRenderer` itself when content *does* exist.

```ts
// post/[id]/page.tsx
let recordMap: Awaited<ReturnType<typeof getPageRecordMap>> | null = null;
let contentFetchFailed = false;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap]`, error); // describeFetchFailure is gone — see Finding 4
  recordMap = null;
  contentFetchFailed = true;
}
```

`DefaultPostPageProps` widens by exactly one required prop:

```ts
interface DefaultPostPageProps {
  post: Post;
  recordMap: ExtendedRecordMap | null; // typed via notion-types, already a direct dependency — narrower than `any`
  contentFetchFailed: boolean;
}
```

Template branch becomes a 3-way, still driven by data the route already computed (no new Notion call, matching D-10):

```tsx
{recordMap && !isRecordMapEmpty(recordMap) ? (
  <NotionPageRenderer recordMap={recordMap} />
) : contentFetchFailed ? (
  <p className="text-text-secondary italic">This post's content could not be loaded right now.</p>
) : (
  <p className="text-text-secondary italic">This post has no content yet.</p>
)}
```

(`isRecordMapEmpty` is Finding 4's emptiness check — could equally be computed once in the route and passed down as a third boolean, keeping the template a pure renderer with no notion-utils import of its own; either placement is Claude's Discretion under D-06's "which module" framing, not locked.)

### `templates/terminal/PostPage.tsx` — confirmed it needs zero changes to keep compiling

`[VERIFIED: apps/web/src/templates/terminal/PostPage.tsx:13-19]`, quote:
```
interface TerminalPostPageProps {
  post: Post;
  recordMap: any;
  categories: string[];
  relatedPosts: Post[];
  subscribeSlot?: React.ReactNode;
}
```
This is a **separate, independent interface** from `DefaultPostPageProps` — TypeScript does not unify them. The route's terminal branch (`post/[id]/page.tsx:153-161`) constructs `<TerminalPostPage post={post} recordMap={recordMap} categories={categories} relatedPosts={relatedPosts} subscribeSlot={...} />` and passes no `contentFetchFailed` — this compiles unchanged regardless of what `DefaultPostPageProps` gains, because `recordMap` stays typed `any` there and the terminal component never reads a `contentFetchFailed` prop it wasn't given. **Confirms the phase brief's framing is correct**: leaving the terminal template alone (Claude's Discretion, out of scope this milestone per TMPL-F01) requires no defensive code — it is naturally unaffected.

## Finding 4 — What "arrived, nothing to render" looks like

### What `notion-client`'s `getPage()` actually does on an empty/missing recordMap

Read directly from the installed package this session, `[VERIFIED: node_modules/notion-client/build/index.js:69-77]`, quote:
```
const page = await this.getPageRaw(pageId, {
  chunkLimit,
  chunkNumber,
  ofetchOptions
});
const recordMap = page?.recordMap;
if (!recordMap?.block) {
  throw new Error(`Notion page not found "${uuidToId(pageId)}"`);
}
```
**This means a `recordMap` that reaches our `catch`-free branch always has `recordMap.block` populated with at least one entry** — the case where it's entirely absent already throws (and is therefore caught by the existing `catch`, landing on the fetch-failed path, not the empty-content path). So "arrived but nothing to render" cannot mean an empty `block` object; it can only mean a `block` object whose only entry is the page container itself, with no content children.

### The heuristic

`apps/web/src/app/api/diagnose-page/route.ts:69` (being deleted this phase, but its shape is instructive and safe to reuse), quote: `blockCount: Object.keys(recordMap?.block ?? {}).length`. A genuinely empty Notion page (title only, zero body blocks) produces exactly `1` here — the page's own block, with no descendants ever fetched. Any real content adds at least one more entry.

```ts
function isRecordMapEmpty(recordMap: ExtendedRecordMap): boolean {
  return Object.keys(recordMap.block ?? {}).length <= 1;
}
```

An alternative, more semantically precise version walks the content tree via `notion-utils`'s exported `getPageContentBlockIds()` (already a direct dependency — `[VERIFIED: apps/web/package.json` via `apps/web/next.config.ts` sibling read confirming `notion-utils": "^7.10.0"` is listed directly, not transitive]). Read directly this session, `[VERIFIED: node_modules/notion-utils/build/index.js:697-712]`: the function always seeds `contentBlockIds` with the root block id first, then recurses into `block.content` arrays. `getPageContentBlockIds(recordMap, rootId).length <= 1` means the root has zero content children — the same boundary, reached by walking the actual rendering-relevant structure instead of counting every key in `recordMap.block` (which could in principle include non-content blocks like collection metadata for some page shapes).

**`[ASSUMED]` — flagged explicitly, per the phase brief's own instruction.** I could not test either heuristic against a genuinely content-empty *public* Notion page this session (no test fixture, and the three production pages inspected in Phase 7 all have content — they were failing on fetch, not empty). Both formulas are defensible from reading the traversal code, but neither has been observed against a real empty-page `recordMap`. **This is the single largest open risk in this phase's CONT-05 half** — recommend the plan include a step where the operator temporarily creates one intentionally-empty public Notion page (or points the id-only debug check at one, before D-19's route is deleted, if sequencing allows) to confirm the chosen heuristic's actual block/content count, rather than shipping the formula purely on code-reading confidence. If that verification step is skipped, the plan should say so explicitly and accept the residual risk rather than silently asserting the heuristic is correct.

**Rejected alternative — re-deriving Post-level "has this post got a body" some other way:** none exists; the official `@notionhq/client` (used elsewhere in this repo) does not expose a page's block content at all (it's a database-properties client only, per `packages/core`'s existing usage) — so there is no cross-check available even if D-10/Pitfall 4 didn't already forbid adding one.

## Finding 5 — Teardown mechanics: every reference, and the one coupling the brief didn't ask about

### `describeFetchFailure` — 3 files, 5 references, only 2 of which are inside the deleted route

| File | Line(s) | What's there | Disposition |
|---|---|---|---|
| `apps/web/src/lib/notion-x.ts` | 86-171 | The function definition itself, plus its private helpers `isFetchErrorShape` (47-51), `describePageIdShape` (54-62), `LOAD_PAGE_CHUNK_URL` (68), `BODY_EXCERPT_MAX_LENGTH` (71) — all used only by this function | **Delete all of it** — `[VERIFIED: apps/web/src/lib/notion-x.ts:1-171]`, confirmed no other export in this file depends on these private helpers |
| `apps/web/src/app/post/[id]/page.tsx` | 2 (import), 119, 142 | `import { getPageRecordMap, describeFetchFailure } from "@/lib/notion-x";` and two call sites: `` console.error(`[PostPage:recordMap] ${await describeFetchFailure(error, id, true)}`); `` and `` console.error(`[PostPage:chrome] ${await describeFetchFailure(error, id, false)}`); `` | **Not inside the deleted route — must be edited, not merely have their import removed.** Replace each with a plain `console.error` matching CLAUDE.md's own logging convention ("Log error objects directly, not just strings, to preserve stack traces"), e.g. `` console.error(`[PostPage:recordMap]`, error); `` |
| `apps/web/src/app/api/diagnose-page/route.ts` | 3 (import), 73 (call) | Inside the route being deleted in full | No separate action — deleting the file removes these automatically |

**This is the exact shape of coupling `07-CONTEXT.md` flagged for `isDiagnosticsEnabled()` (found by 07-REVIEW F-02) — a naive "delete `describeFetchFailure` and its one obvious caller" pass would miss the two call sites inside `post/[id]/page.tsx` and break the build (`describeFetchFailure` undefined).** Recommend the plan enumerate both replacement call sites explicitly as their own action items, not fold them into "delete the route."

### `isDiagnosticsEnabled` — confirmed kept, confirmed its one remaining importer is untouched

`[VERIFIED: apps/web/src/lib/post-availability.ts:1-2,116]`, quotes: `import { isDiagnosticsEnabled } from "@/lib/notion-x";` (line 2) and `if (!isDiagnosticsEnabled()) { return buildBasicDetail(verdict, reason); }` (line 116, inside `buildResponseDetail`). This file is explicitly **not** modified per D-13/the canonical refs. Grep confirms no other file imports `isDiagnosticsEnabled`.

### `NOTION_DEBUG_DIAGNOSTICS` / `NOTION_DEBUG_ROUTE_SECRET` / `diagnose-page` — documentation surface

Checked explicitly this session, `[VERIFIED: README.md, README_KR.md]` (grep for `NOTION_DEBUG|diagnose-page|DiagnosePage|describeFetchFailure`, zero matches, exit code 1 confirming no match in either file). **Neither README file references any of the diagnostic surface — there is nothing to remove there.** No `.env.example` file exists in the repo (`find` for `.env*` outside `node_modules` returns only the gitignored `apps/web/.env.local`), so there's no example-env documentation to touch either.

The only remaining references outside the four code files above are in `.planning/` — `ROADMAP.md:56` (a historical description of what Phase 7's plan did: *"Gated deep diagnostics + secret-gated `/api/diagnose-page` route (tracer)..."*) and this phase's own `08-CONTEXT.md`/`08-STATE.md`/`08-DISCUSSION-LOG.md`. These are historical planning artifacts, not forker-facing documentation — the phase brief's instruction to check "`.planning/` docs that are user-facing rather than historical" is satisfied by confirming these are the historical kind, not the user-facing kind (nothing under `.planning/` is shipped to a forker's site or README). **Recommend leaving `.planning/` history untouched** — rewriting it would erase the record of what Phase 7 actually built, which the repo's own conventions treat as append-only.

### Full deletion scope, restated as a literal checklist for the plan

- [ ] Delete `apps/web/src/app/api/diagnose-page/route.ts` in full.
- [ ] Delete `describeFetchFailure`, `isFetchErrorShape`, `describePageIdShape`, `LOAD_PAGE_CHUNK_URL`, `BODY_EXCERPT_MAX_LENGTH` from `apps/web/src/lib/notion-x.ts` (lines 41-171 by current numbering; keep lines 1-38 — the `NotionAPI` construction and `isDiagnosticsEnabled`).
- [ ] Remove `describeFetchFailure` from the import line in `apps/web/src/app/post/[id]/page.tsx:2`; replace both call sites (lines 119, 142) with plain `console.error` calls that still carry the `[PostPage:recordMap]`/`[PostPage:chrome]` prefixes (CONT-01 requires the prefix survive; it does not require the JSON-shaped payload survive).
- [ ] Remove the Production env vars `NOTION_DEBUG_DIAGNOSTICS` and `NOTION_DEBUG_ROUTE_SECRET` from Vercel — operator action, not a code change (already partially done at Phase 7 closeout per `07-EVIDENCE.md`'s Closeout table; confirm they haven't been re-added).
- [ ] Leave `isDiagnosticsEnabled()` and `apps/web/src/lib/post-availability.ts` untouched.
- [ ] Confirm post-deletion: `npm run build --workspace=apps/web` route list no longer contains `/api/diagnose-page` (this is a visible, mechanically-checkable proxy for "the teardown actually happened," matching the phase brief's own framing).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Detecting whether an ISR response was freshly regenerated | A custom cache-freshness header or timestamp embedded in the page | Vercel's own `x-vercel-cache` response header (Finding 2) | It's already computed by the platform on every response; adding a parallel signal is unverifiable duplicate state |
| Confirming a `recordMap` has no renderable content | A live cross-check against the official `@notionhq/client` API on every render | The already-fetched `recordMap.block` object's own shape (Finding 4) | Pitfall 4 — an extra live call per render defeats ISR and silently pushes the page toward dynamic; D-10 explicitly forbids it |
| A reader-visible retry mechanism for a failed fetch | A client-side retry button/polling loop | Nothing — deferred to CONT-F01 (v2), D-09/D-12 | Against a systemic Cloudflare block, a retry fails identically; not in this phase's locked scope |

**Key insight:** every "don't hand-roll" temptation in this phase is really the same one — reaching for a new live call or a new piece of state to answer a question the platform (Vercel's cache header) or the data already fetched (recordMap's own shape) can answer for free.

## Common Pitfalls

Citing, not re-deriving, per the phase brief's scope instruction — full text lives in `.planning/research/PITFALLS.md`.

- **Pitfall 4 (no per-request live call):** binds Finding 4's emptiness check — it must read the already-fetched `recordMap`, never make a second Notion call to verify emptiness.
- **Pitfall 6 (unverified safety net):** binds D-07's "ship the header fix alone" — do not add a JS-challenge/TLS-fingerprint defence for a failure mode that hasn't recurred.
- **Pitfall 12 (`next dev` proves nothing):** `notion-client`'s Cloudflare-facing behavior and Vercel's `x-vercel-cache` header are both properties of the deployed environment; a local `npm run dev` or even `npm run build && npm start` session cannot exercise either. CONT-03's sign-off is deployed-site-only, full stop.
- **Pitfall 15 (warm cache / lucky load):** the entire reason Finding 2's 3-request procedure exists — a single load right after deploy proves nothing because the deploy itself force-refreshed the cache.

## Runtime State Inventory

Not applicable — this is a code-and-config phase (a header addition, a prop-shape change, and file deletions), not a rename/refactor/migration. No stored data, live-service config, OS-registered state, or build artifacts carry a name or identifier this phase changes. The one env-var removal (`NOTION_DEBUG_DIAGNOSTICS`/`NOTION_DEBUG_ROUTE_SECRET`) is already tracked as its own checklist item above, not a rename.

## Code Examples

### The fix — verified against the installed package this session

```ts
// apps/web/src/lib/notion-x.ts
// Source: node_modules/notion-client/build/index.js:26-38, 534-561 (read directly this session)
import { NotionAPI } from "notion-client";

export const NOLOG_USER_AGENT = "NoLog (+https://github.com/4lph4-dvlp/NoLog)"; // D-03 shape; exact string is Claude's Discretion within that shape

const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
  ofetchOptions: {
    headers: {
      "User-Agent": NOLOG_USER_AGENT,
    },
  },
});
```
`ofetchOptions.headers` merges ahead of `Content-Type`/`cookie`/`x-notion-active-user-header` in the library's own `fetch()` method (`node_modules/notion-client/build/index.js:540-545`), so nothing downstream overwrites it — confirmed by reading the merge order directly, not inferred from the constructor's JSDoc alone.

### The CONT-05 shape (illustrative — exact wording/placement is Claude's Discretion)

```tsx
// apps/web/src/templates/default/PostPage.tsx
{recordMap && !isRecordMapEmpty(recordMap) ? (
  <NotionPageRenderer recordMap={recordMap} />
) : contentFetchFailed ? (
  <p className="text-text-secondary italic">This post's content could not be loaded right now.</p>
) : (
  <p className="text-text-secondary italic">This post has no content yet.</p>
)}
```

### SC#1 verification — literal commands for the plan

```bash
# Request A — immediately after deploy (expect x-vercel-cache: MISS)
curl -sD - -o /dev/null https://4lph4-bl0g.vercel.app/post/<id> | grep -i x-vercel-cache

# ... wait > 180s without visiting this URL ...

# Request B — first hit after the window (expect x-vercel-cache: STALE)
curl -sD - -o /dev/null https://4lph4-bl0g.vercel.app/post/<id> | grep -i x-vercel-cache

# Request C — immediately after B (expect x-vercel-cache: HIT, now serving B's background regen)
curl -sD - -o /dev/null https://4lph4-bl0g.vercel.app/post/<id> | grep -i x-vercel-cache
```

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test framework exists in this repo, and adding one is explicitly Out of Scope for v1.1 (`REQUIREMENTS.md`) |
| Config file | none |
| Quick run command | `npm run build --workspace=apps/web && npm run lint --workspace=apps/web` |
| Full suite command | Same, plus the deployed-site procedures below (no automated equivalent exists) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|-------------|
| CONT-03 | Post body renders on a genuine ISR regeneration, deployed site | manual (deployed-site only, Pitfall 12) | `curl -sD - -o /dev/null <url> \| grep x-vercel-cache` (Finding 2 procedure) — not automatable further; no CI target exists | ❌ — no test infra; procedure is the plan's own verification task |
| CONT-05 (fetch-failed state) | Reader sees "could not be loaded" wording distinct from "no content yet" | source-inspection + manual | `npm run build --workspace=apps/web` (confirms no TS error from the new prop) + a deployed check against the known-failing state before the fix lands, or a local production build (`next start`) against a deliberately-wrong `NOTION_TOKEN_V2`/blocked UA to force the catch | ❌ |
| CONT-05 (empty-content state) | Reader sees "no content yet" wording for a genuinely empty page | manual, against a real empty Notion page (Finding 4's flagged assumption) | none automatable — requires a live empty page fixture | ❌ |
| D-19 teardown | `/api/diagnose-page` no longer exists; `describeFetchFailure` fully removed | source-inspection + build | `npm run build --workspace=apps/web` route list diff (route absent); `grep -rn "describeFetchFailure" apps/web/src` returns zero matches | ❌ — but the `grep` itself is the check, runnable in seconds |
| Phase 7 UAT SC#3 (chrome-leg isolation) | A forced chrome-leg throw doesn't blank the body | manual, per `07-UAT.md` Test 1 | `npm run build --workspace=apps/web && npm start --workspace=apps/web`, temporary throw, revert before commit | ❌ — procedure fully specified in `07-UAT.md`, re-run here per D-15 |
| Phase 7 UAT SC#4 (transient `getPost` discrimination) | 404 vs `PostUnavailable` correctly split | manual, per `07-UAT.md` Test 2 | Same production-build approach, two induced conditions | ❌ — procedure fully specified in `07-UAT.md`, re-run here per D-15 |

### Sampling Rate

- **Per task commit:** `npm run build --workspace=apps/web && npm run lint --workspace=apps/web` — the only automatable signal this repo has.
- **Per wave merge:** same, plus a `grep -rn "describeFetchFailure\|NOTION_DEBUG" apps/web/src` to confirm the teardown is complete.
- **Phase gate:** all of the above, plus every manual procedure in the table above run once against the deployed Production site, in the single deploy D-14 mandates.

### Wave 0 Gaps

- No test framework and none may be added (Out of Scope, `REQUIREMENTS.md`) — this row is a structural constraint, not a gap to close.
- No fixture exists for a genuinely content-empty public Notion page — Finding 4's flagged assumption. Recommend the plan add an explicit task to create one (or accept the residual risk explicitly) before relying on the emptiness heuristic in production.

*(No conventional "add these test files" gaps — this repo's validation architecture is source-inspection + build + deployed-site observation by design, consistent with every prior phase in this milestone.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Nothing in this phase touches auth |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | No new surface | The dynamic route segment's validation gap is a pre-existing, explicitly out-of-scope item (`REQUIREMENTS.md` Out of Scope table); this phase does not touch `post/[id]`'s id-handling path in a way that widens it |
| V6 Cryptography | No | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Deleting `api/diagnose-page` removes its own attack surface (a secret-gated route, previously guarded by `timingSafeEqual`) | — (risk reduction, not introduction) | No action needed beyond confirming the route is actually gone (Validation Architecture table) |
| A hardcoded, non-configurable `User-Agent` string is visible to any observer of outbound requests | Information Disclosure (minor) | Accepted by design — D-03/D-05: an honest, self-identifying UA with a contact URL is the intended posture, not a leak |

No new authentication, authorization, session, or cryptographic surface is introduced by this phase. The single outbound-request change (a `User-Agent` header) has no injection surface — it's a hardcoded constant, never derived from user input.

## Package Legitimacy Audit

Not applicable — D-07 (locked, both `08-CONTEXT.md` and `REQUIREMENTS.md`) forbids new npm dependencies this phase, and nothing in this research recommends one. `notion-utils`'s `getPageContentBlockIds` (Finding 4) and `notion-types`'s `ExtendedRecordMap` (Finding 3) are both already-installed direct dependencies (`apps/web/package.json`, confirmed this session) — no registry check is needed for packages already present and already imported elsewhere in this exact repo.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | `Object.keys(recordMap.block ?? {}).length <= 1` (or the `getPageContentBlockIds` equivalent) correctly identifies a genuinely content-empty Notion page | Finding 4 | If wrong, either a page with real content is misreported as "no content yet" (visible, embarrassing, easy to spot and fix), or a genuinely empty page is misreported as "could not be loaded" (less visible, but also low-severity — both are honest-enough fallback states, and CONT-05's bar is "distinct wording," not "perfectly accurate wording" for this rare case) |
| A2 | GET (not HEAD) is the safer choice for reading `x-vercel-cache` via `curl` for this specific route | Finding 2 | Low risk — if HEAD behaves identically (likely, per general Vercel behavior), the procedure still works either way; using GET is the conservative choice, not a claim that HEAD fails |

## Open Questions

1. **Has the emptiness heuristic (Finding 4) ever been validated against a real, content-empty public Notion page?**
   - What we know: the traversal/block-counting logic is read correctly from `notion-client`/`notion-utils` source.
   - What's unclear: whether a genuinely empty page's `recordMap` matches the predicted shape exactly (e.g., whether Notion's API ever attaches a trivial default child block, like an empty paragraph, to a "blank" page automatically).
   - Recommendation: add a plan task to create one throwaway empty public Notion page and confirm the heuristic's output against it before shipping, or explicitly accept the residual risk in the plan's verification notes.

2. **What does the replacement log line for the two `describeFetchFailure` call sites look like exactly?**
   - What we know: the leg-naming prefixes (`[PostPage:recordMap]`, `[PostPage:chrome]`) must survive (CONT-01 requirement); the JSON-shaped diagnostic payload does not need to.
   - What's unclear: whether the plan wants `console.error(prefix, error)` (object form, preserves stack trace per CLAUDE.md convention) or a string-interpolated `error.message` (closer to the current single-line-JSON shape, more grep-friendly in Vercel's dashboard).
   - Recommendation: `console.error(\`[PostPage:recordMap]\`, error)` — matches the repo's own stated logging convention ("Log error objects directly, not just strings, to preserve stack traces") and needs no new helper function.

---
*Phase: 8-Content Rendering Fix*
*Researched: 2026-08-10*
*Valid until: this research is tied to the exact installed versions of `notion-client`/`notion-utils` (7.10.0) and to Vercel's current cache-status documentation (fetched 2026-08-10, doc's own `last_updated: 2026-07-08`) — re-verify the `x-vercel-cache` semantics if Vercel materially changes its caching docs before this phase executes.*
