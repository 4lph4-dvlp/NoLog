# Phase 7: Content Failure Isolation & Live Diagnosis - Research

**Researched:** 2026-08-09
**Domain:** Node.js server-side error handling for an unofficial Notion API client (`notion-client`/`ofetch`) inside a Next.js 16 App Router page, plus Vercel dashboard-based production log capture (no CLI)
**Confidence:** MEDIUM-HIGH overall — the code-level findings below are HIGH (read directly from `node_modules` and this repo this session); the Vercel-dashboard and Next.js-runtime-behavior claims are MEDIUM (official docs, fetched live this session, not confirmed against this exact deployed project)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Diagnostic Logging**
- **D-01:** The leg-naming log is permanent and ungated. Every failure path records which of the fetches failed, using the repo's existing bracket-prefix convention (e.g. `[PostPage:recordMap]`, `[PostPage:chrome]`) so the three legs are never reported by one identical line. This is CONT-01 itself, not a debug aid.
- **D-02:** The *deep* diagnostics (HTTP status, `content-type`, response-body excerpt) are permanently shipped in the code but gated behind an explicit debug env var that is unset by default. Reversible — local deletion, no dependent callers.
- **D-03:** When the gate is on, the log records: HTTP status, `content-type`, the first 200 characters of the response body, the thrown error's `name`/`message`, and the shape of the page id that was passed in.
- **D-04:** If the error thrown by `notion-client` does not carry the raw HTTP response, the code falls back to **one** raw `fetch` probe against the same endpoint — but only when the debug gate is on, and only on the failing request.
- **D-05:** Log format is bracket prefix + single-line JSON payload (`[PostPage:recordMap] {"status":…,"contentType":…,"bodyExcerpt":…}`).

**Evidence Capture**
- **D-06:** Add a secret-gated debug route that takes a post id and performs the same `getPageRecordMap` call directly. Precedent: `/api/notify-subscribers`'s `CRON_SECRET` check. Expected to be removed in a later phase. Reversible.
- **D-07:** The debug route is locked by a dedicated new secret env var, distinct from `CRON_SECRET`, AND requires the D-02 debug gate. Both conditions must hold or the route responds 404.
- **D-08:** Evidence lands in a dedicated `07-EVIDENCE.md` in the phase directory: PITFALLS.md's six-candidate table copied in with each row filled from what was observed, raw log lines pasted verbatim, and a named verdict (or "matches none of the six") at the end.
- **D-09:** Evidence is captured against Production, not Preview. Accepted cost — record it in the plan: each deploy invalidates the whole ISR cache, resetting Phase 9's required >1h idle verification window.
- **D-10:** The non-code operator checks — `NOTION_TOKEN_V2` set in Production?, does the failing page load logged-out incognito?, when did the failure start relative to deploys? — are carried as an explicit operator checklist, walked through step by step at execution time, answers recorded into `07-EVIDENCE.md`. No `vercel` CLI install — dashboard only.

**Failure Isolation**
- **D-11:** `getCategories()` and related-posts `getPosts()` stay in `post/[id]/page.tsx`, wrapped in their own catch, separate from `getPageRecordMap`. Split by *concern*, not by call. Making the calls conditional per template was considered and rejected.
- **D-12:** `getPost()` must also be caught. `notFound()` stays scoped to a genuine Notion 404; any other failure is caught and surfaced as a distinct transient "temporarily unavailable" state, with the leg named in the log. Collapsing all failures into `notFound()` was rejected.
- **D-13:** A chrome failure degrades silently — empty list, body renders, failure recorded in the log only.
- **D-14:** The reader-facing "Content could not be loaded." wording is left untouched this phase (CONT-05 / Phase 8).

**ISR / Throw Behavior**
- **D-15:** The open question — does a Server Component throw during ISR regeneration fall back to stale HTML or surface as a 500 on this Next 16 / Vercel Fluid Compute setup — is **not measured** in this phase. Because D-11/D-12 already require that no leg throws, the answer does not change any code here.
- **D-16:** No `error.tsx` is added.
- **D-17:** The "no leg throws uncaught" guarantee is enforced as an explicit phase-verification checklist item — confirm every `await` in `post/[id]/page.tsx` sits inside a catch, with a comment recording why.
- **D-18:** If the catch decomposition resolves the symptom outright, the six-candidate verdict is still recorded in full in `07-EVIDENCE.md` before the phase closes.

### Claude's Discretion
- Exact env var names for the debug gate (D-02) and the debug-route secret (D-07), and the route path itself.
- Exact JSON field names inside the log payload (D-05).
- Exact copy and HTTP status of the transient-failure state introduced by D-12 (only its distinctness from `notFound()` is locked).
- Whether the deep-diagnostic instrumentation lives in `lib/notion-x.ts`, in `post/[id]/page.tsx`, or a shared helper.

### Deferred Ideas (OUT OF SCOPE)
- Measuring ISR throw behavior on Next 16 / Fluid Compute (stale-HTML fallback vs 500) — deliberately not measured here (D-15).
- Adding an `error.tsx` — declined this phase (D-16).
- Removing the unused `getCategories`/`getPosts` calls under the `default` template — kept for now (D-11).
- Wording split for "no content yet" vs "fetch failed" — CONT-05, Phase 8 (D-14).
- Caching/revalidation wrapper for `getPageRecordMap()` — CONT-F02, v2.
- Validating the dynamic route segment before it reaches the Notion API URL — declined for this milestone, tracked in `PROJECT.md`.
- Removing the debug route added by D-06 — planned for a later phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Operator can tell, from production logs, which of the three data fetches in `post/[id]/page.tsx` actually failed | See "Existing Code — Exact State" and "Code Examples: Leg-Named Catch Decomposition" — exact current line numbers and the three distinct failure taxonomies (`getPageRecordMap` vs `getCategories`/`getPosts` vs `getPost`) that the log must name separately |
| CONT-02 | Operator has captured real failure evidence from the deployed site (HTTP status + response body), sufficient to discriminate the PITFALLS.md six candidates | See "notion-client Error Taxonomy" (what `error.status`/`error.data` actually contain and when they're `undefined`), "Environment Availability" (Vercel dashboard log access, 1-hour Hobby retention), and "Validation Architecture" |
| CONT-04 | A categories/related-posts failure no longer prevents the post body from rendering | See "Existing Code — Exact State" confirming `DefaultPostPage` never receives `categories`/`relatedPosts`, and "Architecture Patterns: Per-Concern Catch Decomposition" |
</phase_requirements>

## Summary

This phase's code changes are small and mechanical — the research value here is almost entirely in **what the installed code actually does**, because three of CONTEXT.md's canonical-reference claims needed direct verification against `node_modules` and this repo's actual line contents, and one of them turned out to be **factually wrong in a way that changes how D-12 must be implemented**.

**Critical correction to CONTEXT.md's canonical_refs:** `NologClient.getPost()` (`packages/core/src/client.ts:311-338`) does **not** throw on a non-404 failure. Its own `try { ... } catch { return null; }` (opening at line 312, closing at line 337) catches the `Error` it throws internally at line 323 for `!res.ok` and converts it to `null`, identically to a genuine 404. **`getPost()` already returns `null` for a transient Notion outage today**, indistinguishably from "post doesn't exist" — which means the *current* `notFound()` call at `post/[id]/page.tsx:60` (outside any try, confirmed) already 404s a real post on a transient failure, right now, in production. This is the exact symptom CONT-04/SC#4 names — but the mechanism is a swallow-to-null inside `packages/core`, not an uncaught throw escaping into `error.tsx` as the phase notes describe. Because `packages/core` cannot be touched this phase (hard constraint), "catch `getPost()`" cannot be implemented as literally wrapping the existing call in a `try` — there is nothing to catch. Closing SC#4 for this leg requires either accepting the residual gap explicitly, or adding an app-level discriminating check (mirroring the D-04 raw-fetch-probe technique already planned for `getPageRecordMap`) that determines genuine-404 vs. transient failure independently of `getPost()`'s already-collapsed return value. See "Existing Code — Exact State" for the full quoted evidence and "Open Questions" for the residual-risk framing.

Second finding, directly answering the phase's stated research focus: `notion-client` (v7.10.0) is built on `ofetch` (v1.5.1, a bundled transitive dependency), not raw `fetch`. `ofetch` throws a `FetchError` whose `.status`, `.data` (already-parsed body — JSON object or text string depending on response `content-type`), `.statusText` are exposed via getters **only when the underlying HTTP call actually returns a `Response` object** (`ctx.response` is set). Two of `notion-client`'s own failure paths do **not** go through this mechanism and produce a **plain `Error`** with no `.status`/`.data` at all: an invalid page ID (thrown before any network call) and — critically — a syntactically-successful (HTTP 200) but semantically-empty response, thrown as `Error('Notion page not found "<id>"')` at `notion-client`'s own `getPage()` (`node_modules/notion-client/src/notion-api.ts:106`). This second case is exactly what Pitfall 5's "sharing state overridden" and "Cloudflare challenge page returned as 200" candidates would look like, and it is precisely the case D-04's raw-fetch-probe fallback exists for — not an edge case, but the structurally-guaranteed-necessary path for that failure shape.

Third finding: `notion-client` sets no explicit `User-Agent` header (confirmed by reading the entire request-building code path in `notion-api.ts`). An empirical local test this session (Node v22.23.1, this repo's exact `node_modules/ofetch`) shows Node's built-in `fetch` defaults to `user-agent: node` when none is set. This is a concrete, checkable discriminator for the MEDIUM-confidence react-notion-x #710 hypothesis, reportable in `07-EVIDENCE.md` once the actual production response is captured — but it is not proof on its own, since Vercel's Node.js runtime may differ from a local Node install.

Fourth finding: the `runtime`, `route-handler shape`, and `notFound()`-vs-`try/catch` questions the phase raises all have crisp, citable answers now available: no `export const runtime` is declared anywhere in `post/[id]/page.tsx` or `layout.tsx` (Node.js runtime by default); the two existing API routes (`/api/subscribe`, `/api/notify-subscribers`) give two *different* fail-closed precedents (404-for-unconfigured vs. 401-for-unauthorized) that the new debug route should combine; and Next.js 16.2.4 ships `unstable_rethrow` (exported from `next/navigation`, confirmed present) as the sanctioned public API for letting a `notFound()`/`redirect()` control-flow error escape a `try/catch` while still handling every other error normally — `isHTTPAccessFallbackError`/`isNotFoundError` are internal, unexported symbols in this installed version and should not be imported directly.

**Primary recommendation:** Implement D-11/D-12/D-13 exactly as CONTEXT.md specifies, but scope D-12's `getPost()` catch honestly: wrap the call for defense-in-depth and use `unstable_rethrow` if `notFound()` and the fetch ever share a `try`, but record in `07-EVIDENCE.md`/the plan's verification section that the genuine-404-vs-transient-failure distinction for `getPost()` is unresolved by a bare `try/catch` given `packages/core`'s current swallow-to-null behavior, and decide explicitly (a locked-decision-level call for the planner, not this research) whether to accept that residual gap or add an app-level probe.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Leg-named failure logging (CONT-01) | API/Backend (Server Component, Node.js runtime) | — | `post/[id]/page.tsx` is an async Server Component executing server-side on every ISR regeneration; logs land in Vercel's Function/Runtime Logs, not the browser console |
| Deep diagnostic capture (status/body excerpt) | API/Backend | — | Same file; gated by a server-only env var (never `NEXT_PUBLIC_*`) so the debug payload never reaches the client bundle |
| Raw-fetch probe fallback (D-04) | API/Backend | — | Must run server-side to reach the unofficial `notion.so/api/v3` endpoint with the same auth cookie header `notion-x.ts` already constructs |
| Secret-gated debug route (D-06) | API/Backend (Route Handler) | — | New file under `apps/web/src/app/api/`; same tier as `/api/subscribe`, `/api/notify-subscribers` |
| Content/chrome failure isolation (CONT-04) | API/Backend (Server Component data-fetch stage, pre-render) | Browser (fallback markup shown) | The catch decomposition happens before JSX is returned; the *visible effect* (body renders, categories empty) is a Browser/Client rendering concern but the fix itself is entirely server-side |
| Evidence recording (CONT-02) | Operator/Process (not a code tier) | — | `07-EVIDENCE.md` is a human-authored artifact populated from Vercel dashboard observation, not generated by the app |

## Existing Code — Exact State

All line numbers below were read directly this session; ranges match CONTEXT.md's canonical_refs except where flagged.

### `apps/web/src/app/post/[id]/page.tsx` (confirmed, matches CONTEXT.md)

```typescript
// lines 55-61 — NOT inside any try
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }
```

```typescript
// lines 63-80 — the single combined catch CONT-01/CONT-04 must decompose
let recordMap;
let categories: string[] = [];
let relatedPosts: Post[] = [];
try {
  recordMap = await getPageRecordMap(id);
  categories = await getCategories();

  if (post.category) {
    const allPosts = await getPosts();
    relatedPosts = allPosts.filter(p => p.category === post.category);
  }
} catch (error) {
  console.error("[PostPage] Failed to fetch page recordMap or categories:", error);
  recordMap = null;
  categories = [];
  relatedPosts = [];
}
```

`[VERIFIED: apps/web/src/app/post/[id]/page.tsx:55-80]`

### `packages/core/src/client.ts:311-338` — `getPost()`, the corrected finding

```typescript
public async getPost(pageId: string): Promise<Post | null> {
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        headers: this.getNotionHeaders(),
        ...this.fetchOptions,
      });

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`Notion page failed: ${res.status} ${await res.text()}`);
      }

      const page: unknown = await res.json();
      if (!isPageObjectResponse(page)) return null;

      const post = mapPageToPost(page);
      if (post.status !== "public") {
        return null;
      }

      return post;
    } catch {
      return null;
    }
  }
```

`[VERIFIED: packages/core/src/client.ts:311-338]` — the `throw` at line 323 is lexically inside the `try` that opens at line 312 and is caught by the bare `catch { return null; }` at lines 335-337. **This function cannot throw to its caller under any input.** Every failure mode — literal 404, any other non-OK status (500, 403, network error, timeout), a malformed JSON body, a page whose `status` property isn't `"public"` — collapses to the same `null` return value `getPost()` already produces for "page genuinely doesn't exist." `post/[id]/page.tsx:59-61`'s `if (!post) notFound();` therefore already 404s a real, public post today whenever the underlying Notion `GET /v1/pages/{id}` call fails transiently — this is pre-existing behavior, not something this phase's catch-decomposition introduces or must guard against introducing. **Do not modify this file** (published package, D-05).

### `apps/web/src/lib/notion-x.ts` (confirmed, matches CONTEXT.md)

```typescript
const notionX = new NotionAPI({
  authToken: process.env.NOTION_TOKEN_V2 || undefined,
});

export async function getPageRecordMap(pageId: string) {
  return notionX.getPage(pageId);
}
```

`[VERIFIED: apps/web/src/lib/notion-x.ts:1-22]` — bare passthrough, no error handling, no `cache()` wrapper (confirmed absent, matching CONTEXT.md's Established Patterns note).

### `apps/web/src/templates/default/PostPage.tsx` — confirms CONTEXT.md's "non-obvious finding"

```typescript
interface DefaultPostPageProps {
  post: Post;
  recordMap: any; // Allow any type since it's from notion-x which has complex types
}

export default function DefaultPostPage({ post, recordMap }: DefaultPostPageProps) {
```

`[VERIFIED: apps/web/src/templates/default/PostPage.tsx:9-14]` — **confirmed correct**: `DefaultPostPageProps` has exactly two fields, `post` and `recordMap`. `categories` and `relatedPosts` are fetched on every `default`-template render (`CONFIG.template === "default"` per `site.config.ts:11`, `[VERIFIED: apps/web/src/site.config.ts:11]`) and then discarded — never passed to `DefaultPostPage` at `post/[id]/page.tsx:83` (`return <DefaultPostPage post={post} recordMap={recordMap} />;`). Under the *current* combined catch, a `categories`/`getPosts` failure nulls `recordMap` too (all three assignments happen in the same catch block), which is the exact mechanism producing "Content could not be loaded." for a chrome-only failure. Splitting the catch per D-11 directly fixes this for `default` (the live template) even though `categories`/`relatedPosts` remain functionally unused by it — matching D-11's accepted cost note.

### `apps/web/src/templates/terminal/PostPage.tsx` — the one consumer of `categories`/`relatedPosts`

`[VERIFIED: apps/web/src/templates/terminal/PostPage.tsx:13-21]` — `TerminalPostPageProps` does accept `categories: string[]` and `relatedPosts: Post[]`, passed to `<TerminalConsole posts={relatedPosts} categories={categories} .../>`. Out of scope this milestone (`site.config.ts` template is `"default"`), but confirms *why* D-11 keeps the calls rather than special-casing them away — they are load-bearing for the inactive template and for CONT-01's evidence surface either way.

### `apps/web/src/app/layout.tsx:46-53` — the existing per-concern catch precedent D-11/D-13 mirror

```typescript
let categories: string[] = [];
try {
  categories = await getCategories();
} catch {
  categories = [];
}
```

`[VERIFIED: apps/web/src/app/layout.tsx:46-53]` — confirms CONTEXT.md's cited precedent exactly: same silent-degrade-to-empty-array shape, no logging at all (this phase's version should add the `[Layout]`/`[PostPage:chrome]`-style log line D-01 requires, which this existing instance lacks).

## notion-client Error Taxonomy

This is the mechanical detail the phase brief's research focus item 1 asked for, read directly from `node_modules/notion-client@7.10.0/src/notion-api.ts` and `node_modules/ofetch@1.5.1`.

### Request shape (for the D-04 raw-fetch probe to replicate)

`[VERIFIED: node_modules/notion-client/src/notion-api.ts:441-472, 767-820]`

- Endpoint hit by `getPage()` → `getPageRaw()` → `this.fetch({ endpoint: 'loadPageChunk', ... })`.
- Full URL: `` `${apiBaseUrl}/${endpoint}` `` where `apiBaseUrl` defaults to `'https://www.notion.so/api/v3'` (`notion-api.ts:34`) — so the exact URL is `https://www.notion.so/api/v3/loadPageChunk`.
- Method: `POST` (`notion-api.ts:812`).
- Body (JSON): `{ pageId: parsedPageId, limit: chunkLimit, chunkNumber, cursor: { stack: [] }, verticalColumns: false }` (`notion-api.ts:459-465`), where `parsedPageId = parsePageId(pageId)` — throws a plain `Error('invalid notion pageId "<id>"')` before any network call if `parsePageId` returns falsy (`notion-api.ts:453-457`).
- Headers actually sent by `notion-client` itself (`notion-api.ts:778-791`):
  - `Content-Type: application/json` (always)
  - `cookie: token_v2=<authToken>` — **only if** `NOTION_TOKEN_V2` is set (`notion-x.ts:14` passes `|| undefined`)
  - `x-notion-active-user-header` — only if `activeUser` option passed (this repo never passes it)
  - No `User-Agent`, no `Accept`, no other headers set by `notion-client` itself.
- `mode: 'no-cors'` is passed to `ofetch` (`notion-api.ts:813`) — this is a browser `fetch()` option; empirically verified this session (see below) that Node's built-in `fetch` does **not** enforce CORS-mode opacity restrictions server-side — the response is fully readable. `ofetch` itself does add one observable header as a side effect: Node's fetch implementation surfaces `sec-fetch-mode: no-cors` on the outbound request (confirmed by local test, see next section) — this is not something `notion-client`'s code sets explicitly, it's the runtime's own `mode` handling.

### Empirical local test — Node's default `fetch()` headers `[VERIFIED: local test this session, Node v22.23.1, this repo's exact node_modules]`

A local Node HTTP server was started and hit with `fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify({a:1}), headers: {'Content-Type':'application/json'} })` — the same call shape `notion-client` makes. The server observed:

```json
{
  "host": "127.0.0.1:<port>",
  "connection": "keep-alive",
  "content-type": "application/json",
  "accept": "*/*",
  "accept-language": "*",
  "sec-fetch-mode": "no-cors",
  "user-agent": "node",
  "accept-encoding": "gzip, deflate",
  "content-length": "7"
}
```

Node's built-in `fetch` (undici) sends `user-agent: node` by default when the caller sets no explicit `User-Agent`, and the response was fully readable (status 200 returned, no opaque-response behavior) — `mode: 'no-cors'` had no CORS-enforcement effect server-side. This is directly checkable against the deployed evidence: if the captured production failure shows Notion returning a Cloudflare/challenge response keyed off a bot-looking `User-Agent`, `user-agent: node` (or whatever Vercel's Node.js runtime sends by default — not independently confirmed on Vercel infra, only locally) is the concrete mechanism, giving the react-notion-x #710 hypothesis a specific, testable shape rather than a vague "maybe headers." No runtime override was found anywhere in this repo's code that would change this default.

### `ofetch`'s `FetchError` — what's reachable and what isn't

`[VERIFIED: node_modules/ofetch/dist/shared/ofetch.CWycOUEr.mjs:4-45]`

```javascript
class FetchError extends Error {
  constructor(message, opts) {
    super(message, opts);
    this.name = "FetchError";
    if (opts?.cause && !this.cause) this.cause = opts.cause;
  }
}
function createFetchError(ctx) {
  // ...
  for (const key of ["request", "options", "response"]) {
    Object.defineProperty(fetchError, key, { get() { return ctx[key]; } });
  }
  for (const [key, refKey] of [
    ["data", "_data"], ["status", "status"], ["statusCode", "status"],
    ["statusText", "statusText"], ["statusMessage", "statusText"]
  ]) {
    Object.defineProperty(fetchError, key, { get() { return ctx.response && ctx.response[refKey]; } });
  }
  return fetchError;
}
```

`ofetch` throws this `FetchError` in exactly two situations (from the surrounding `$fetchRaw` function, same file): (1) the underlying native `fetch()` call itself throws (network/DNS/TLS failure, timeout) — here `ctx.response` is `undefined`, so **every** getter (`.status`, `.data`, `.statusText`) resolves to `undefined`; only `.message`/`.cause` carry any information. (2) the native `fetch()` call *returns* a `Response` with `status >= 400 && status < 600` — here `ctx.response` is the real `Response`, so `.status` and `.statusText` are populated, and `.data` is the already-parsed body (`ctx.response._data`, set by ofetch's own content-type-sniffing response parser earlier in the same file: JSON content-type → parsed object; `text/*` or a small allowlist of XML/SVG/HTML types → string; otherwise `blob`).

**Consequence for D-04:** `error.status`/`error.data` are directly usable, no probe needed, for any *ordinary* HTTP error response (403, 404, 401, 5xx with a body). The raw-fetch fallback probe is structurally required for two specific cases neither of which is "the library happens not to surface it" by accident:
1. A true connection-level failure (no `Response` object at all) — `error.status`/`.data` are `undefined` by construction; a probe re-attempt might behave identically (if it's a hard network block) or differently (if it's an intermittent egress-IP issue), and either outcome is itself diagnostic evidence for the six-candidate table.
2. `notion-client`'s own `getPage()` throwing `Error('Notion page not found "<id>"')` (`notion-api.ts:106`, quoted below) — this fires when the HTTP call *succeeded* (200, no `FetchError` at all) but `recordMap?.block` is falsy. This is a plain `Error`, `instanceof FetchError` is `false`, `.status`/`.data` don't exist on it. **This is the single most likely path for the "sharing restricted" and "Cloudflare returns 200 with a challenge/near-empty body" candidates in PITFALLS.md's table**, and the raw-fetch probe is the only way this phase's diagnostics can recover the actual response body Notion sent, since `notion-client` has already discarded it by the time it throws.

```typescript
// node_modules/notion-client/src/notion-api.ts:103-107
const recordMap = page?.recordMap as notion.ExtendedRecordMap

if (!recordMap?.block) {
  throw new Error(`Notion page not found "${uuidToId(pageId)}"`)
}
```
`[VERIFIED: node_modules/notion-client/src/notion-api.ts:103-107]`

**Discriminating on error shape for D-03's required fields:**

```typescript
function isFetchError(err: unknown): err is { status?: number; data?: unknown; statusText?: string; name: string; message: string } {
  return err instanceof Error && err.name === "FetchError";
}
```

If `isFetchError(err) && err.status !== undefined` → log `status`, `statusText`, and `data` (stringify if object, slice to 200 chars either way) directly, no probe needed. Otherwise (plain `Error`, or a `FetchError` with `status === undefined`) → this is exactly when D-04's fallback probe should fire.

### Page ID format — ruling out one PITFALLS.md candidate with evidence

`[VERIFIED: node_modules/notion-utils/src/parse-page-id.ts:1-35]`

```javascript
const pageIdRe = /\b([\da-f]{32})\b/
const pageId2Re = /\b([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\b/
export const parsePageId = (id, { uuid = true } = {}) => {
  // ... matches either compact 32-hex or dashed UUID, returns undefined if neither
}
```

`parsePageId` accepts both the compact 32-character hex form and the dashed UUID form. `mapPageToPost` (`packages/core/src/client.ts:125`, `id: page.id`) uses Notion's own page `id`, which the Notion REST API returns in dashed-UUID form — so `post.id` (used to build every `/post/{id}` link and passed straight through to `getPageRecordMap(id)`) is already in one of the two accepted shapes by construction. The "page ID format" candidate in PITFALLS.md's six-candidate table is a low-probability root cause given this — worth logging per D-03 ("shape of the page id passed in") as confirmation, but the code path that would produce a malformed ID doesn't exist in this repo's normal flow.

## `notFound()` vs `try/catch` — the Next 16.2.4 answer

Directly answers the phase's research focus item 6.

`[VERIFIED: node_modules/next/dist/client/components/not-found.js:25-34]`

```javascript
const DIGEST = `${HTTP_ERROR_FALLBACK_ERROR_CODE};404`; // "NEXT_HTTP_ERROR_FALLBACK;404"
function notFound() {
    const error = new Error(DIGEST);
    error.digest = DIGEST;
    throw error;
}
```

`notFound()` throws a plain `Error` whose `.digest` property is the sentinel string `"NEXT_HTTP_ERROR_FALLBACK;404"`. A generic `try/catch` wrapped around code that calls `notFound()` **will** catch this and, if the catch doesn't specifically re-throw it, silently swallow the navigation signal — this is the real mechanism behind Pitfall 6's warning.

`[VERIFIED: node_modules/next/dist/client/components/http-access-fallback/http-access-fallback.js]` — `isHTTPAccessFallbackError(error)` is the function that recognizes this digest shape, but it is **not** re-exported from the public `next/navigation` entry point in this installed version — confirmed programmatically this session (`require('next/dist/client/components/navigation.js')` exports `notFound`, `redirect`, `unstable_rethrow`, etc., but not `isHTTPAccessFallbackError`, and the older `isNotFoundError` symbol does not exist anywhere in this Next 16.2.4 install — `grep` across `node_modules/next/dist` found zero matches).

**The correct, currently-public API is `unstable_rethrow`:**

`[VERIFIED: node_modules/next/dist/client/components/unstable-rethrow.server.js]`

```javascript
function unstable_rethrow(error) {
    if (isNextRouterError(error) || isBailoutToCSRError(error) || isDynamicServerError(error) ||
        isDynamicPostpone(error) || isPostpone(error) || isHangingPromiseRejectionError(error) ||
        isPrerenderInterruptedError(error)) {
        throw error;
    }
    if (error instanceof Error && 'cause' in error) unstable_rethrow(error.cause);
}
```
where `isNextRouterError = (error) => isRedirectError(error) || isHTTPAccessFallbackError(error)` (`node_modules/next/dist/client/components/is-next-router-error.js`, `[VERIFIED]`).

**Pattern to use if `notFound()` and a caught fetch ever end up inside the same `try`:**

```typescript
import { unstable_rethrow } from "next/navigation";

try {
  const post = await getPost(id);
  if (!post) notFound(); // throws the special digest Error
  // ...
} catch (error) {
  unstable_rethrow(error); // rethrows notFound()/redirect()/other Next-internal signals unchanged
  // anything reaching this line is a REAL error — safe to log and handle
  console.error("[PostPage:post] ...", error);
}
```

**However**, given the corrected finding above — `getPost()` never actually throws — the current code's structure (`notFound()` called at line 60, entirely outside the try that starts at line 67) already avoids this hazard by construction. `unstable_rethrow` only becomes necessary if the plan chooses to move the `getPost()` call and its `notFound()` check inside a shared `try` (e.g., to wrap a new discriminating probe alongside it). Document this explicitly wherever D-12 is implemented so a future edit doesn't introduce the hazard blind.

## Route-Handler Shape — Debug Route Precedent

Directly answers the phase's research focus item 3.

`[VERIFIED: apps/web/src/app/api/notify-subscribers/route.ts:1-52, 193-205]` and `[VERIFIED: apps/web/src/app/api/subscribe/route.ts:1-8, 299-328]`

Two *different* fail-closed shapes already exist in this repo, and the new debug route needs to combine elements of both:

| Aspect | `/api/notify-subscribers` | `/api/subscribe` | What D-06/D-07 need |
|---|---|---|---|
| Runtime declaration | `export const runtime = "nodejs";` (line 7) | `export const runtime = "nodejs";` (line 3) | Same — `nodejs`, needed for `getPageRecordMap`'s cookie-bearing fetch and any Node-only APIs |
| Secret check | `Authorization: Bearer <CRON_SECRET>` header, `timingSafeEqual`-based constant-time compare (`safeCompare`, lines 43-52), checked as the literal first statement | No bearer/secret at all — gates purely on `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` presence | D-06/D-07 want a *dedicated new secret*, so the `notify-subscribers` bearer-token + `safeCompare` pattern is the one to copy, not `subscribe`'s (which has no secret to check) |
| Response on gate failure | `401` with a fixed, non-interpolated log line (`console.error("[Notify] Unauthorized cron request rejected.")`, deliberately not latched — every failed attempt is logged) | Bare `new Response(null, { status: 404 })`, indistinguishable from a route that doesn't exist, **latched** to one log line per instance (`unconfiguredLogged`) | D-07 explicitly requires **404** when unconfigured — this matches `/api/subscribe`'s posture, not `/api/notify-subscribers`'s 401. Consider: is a *wrong* secret on the debug route also a 404 (matching D-07's "both conditions must hold or the route responds 404" framing, and not revealing route existence to a prober), or a 401 (revealing existence to anyone who tries, matching notify's audit-trail intent)? CONTEXT.md's own wording — "the route responds 404" — reads as the `/api/subscribe` posture; recommend following that literally: **any** failure of either gate (missing debug env var, missing/wrong secret) → bare 404, no distinguishing response. |
| Logging on gate failure | Not latched — deliberately, "every failed attempt against this route is signal" | Latched (`unconfiguredLogged`) — the misconfigured-state log fires at most once per instance; the 404 itself is unconditional and outside the latch | For a debug route only reachable with a correct secret + the debug flag on, an operator-triggered route, latching is less critical than on a public-facing route — but copying `subscribe`'s "latch the log, never latch the response" shape is still the safer default (avoids attacker-drivable log volume if the route URL ever leaks) |
| Auth comparison | Constant-time (`timingSafeEqual`, handles length-mismatch without a timing side-channel — see `safeCompare`, lines 43-52) | N/A | Reuse `safeCompare`'s exact shape (or extract it) for the new secret comparison — this is exactly the kind of thing PROJECT.md's "don't hand-roll" security guidance would flag if reimplemented naively with `===` |

Route path and env var names are explicitly Claude's Discretion (CONTEXT.md). A path consistent with the existing `/api/notify-subscribers`, `/api/subscribe` naming (verb-first, kebab-case under `apps/web/src/app/api/`) is the established convention.

## Vercel Dashboard — Production Log Access (No CLI)

Directly answers the phase's research focus item 4. No `vercel` CLI is installed (`command -v vercel` → not found, this session) and no `.vercel/` directory exists in the repo — dashboard-only access is the only option, matching D-10's own reasoning.

`[CITED: https://vercel.com/docs/logs/runtime, fetched live this session, last_updated 2026-08-03]`

**Step-by-step, operator-facing:**
1. From the Vercel dashboard, select the project.
2. Open **Logs** in the project sidebar (this is a distinct tab from build logs, which live on the deployment tile instead).
3. Use the **Timeline** filter to pick a window — Hobby plan's maximum lookback is governed by retention (see below), not a separate timeline cap.
4. Use the main search bar to filter by message text — e.g. typing `[PostPage:recordMap]` filters to lines containing that bracket prefix. The search bar also supports structured filter pills like `status:500` or `level:error`.
5. Use the **Route** filter (pattern-based, e.g. `/post/[id]`) or **Request Path** filter (literal path, e.g. `/post/abc123...`) to narrow to the specific post being diagnosed.
6. Use the **Environment** filter, set to `production`, to exclude Preview-deployment noise (relevant since D-09 requires Production evidence specifically).
7. Click an individual log row to open the detail panel — shows Request Method, Status Code, Region, and (critically for this phase) the full **Log Messages** list in chronological order for that single request/invocation.

**Retention — directly relevant to why D-06's on-demand debug route exists:**

| Plan | Retention |
|---|---|
| Hobby (this project) | **1 hour** |
| Pro | 1 day |
| Pro + Observability Plus | 30 days |

`[CITED: https://vercel.com/docs/logs/runtime]` — On Hobby, a log line is gone after 1 hour regardless of ISR cache state. This *independently* reinforces D-06's rationale beyond "hostage to ISR cache timing" — even if the ISR cache happens to regenerate and a failure is captured, the operator has at most 1 hour to find and copy the log line into `07-EVIDENCE.md` before it's unrecoverable through the dashboard. The debug route makes both the *timing* and the *retention window* controllable by the operator instead of by traffic and the clock.

**Checking whether an env var is set in Production (no value visibility for sensitive vars):**

`[CITED: https://vercel.com/docs/environment-variables/managing-environment-variables, fetched live this session, last_updated 2026-04-27]`

1. From the dashboard, select the project → **Settings** → **Environment Variables**.
2. The list below the "Add New" form shows every variable's **name** and which **Environment(s)** it's scoped to (Production / Preview / Development).
3. Use the search input to filter by name (e.g. `NOTION_TOKEN_V2`) and/or filter by Environment = Production.
4. If the variable exists with Production checked, it is set for Production deployments — **but if marked sensitive (the default for Production per Vercel's docs), its value cannot be viewed** in the dashboard, only its name/scope. For D-10's check ("is `NOTION_TOKEN_V2` actually set"), presence/absence is exactly what's needed — the code (`notion-x.ts:14`, `process.env.NOTION_TOKEN_V2 || undefined`) only cares whether it's truthy, not its content.

## Architecture Patterns

### Recommended Structure (no new files beyond the debug route)

```
apps/web/src/
├── app/
│   ├── post/[id]/page.tsx        # per-concern catch decomposition (D-11/D-12/D-13) lands here
│   └── api/
│       └── <debug-route-name>/route.ts   # NEW — D-06/D-07, secret + debug-gate double check
└── lib/
    └── notion-x.ts                # deep-diagnostic capture + D-04 probe most naturally attach here,
                                    # since it's the one place that already owns the notion-client call
```

### Pattern: Per-Concern Catch Decomposition (D-11)

```typescript
// Source: this repo's own precedent at apps/web/src/app/layout.tsx:46-53, extended with
// leg-naming (D-01) and structured deep-diagnostic capture (D-02/D-03/D-05)
let recordMap: ExtendedRecordMap | null = null;
try {
  recordMap = await getPageRecordMap(id);
} catch (error) {
  console.error(`[PostPage:recordMap] ${describeFailure(error)}`);
  recordMap = null;
}

let categories: string[] = [];
let relatedPosts: Post[] = [];
try {
  categories = await getCategories();
  if (post.category) {
    const allPosts = await getPosts();
    relatedPosts = allPosts.filter((p) => p.category === post.category);
  }
} catch (error) {
  console.error(`[PostPage:chrome] ${describeFailure(error)}`);
  categories = [];
  relatedPosts = [];
}
```

Two independent `try/catch` blocks, matching D-11's "split by concern, not by call" instruction exactly — `categories` and `relatedPosts` stay together (both "chrome"), `recordMap` (content) is alone. Neither block leaves anything to throw uncaught (closes D-17's checklist item for these two legs).

### Pattern: Deep-Diagnostic Capture Helper (D-02/D-03/D-04/D-05)

```typescript
// Illustrative shape only — exact field names and file location are Claude's Discretion.
// Source: derived from ofetch's FetchError shape (node_modules/ofetch, verified above)
// and this repo's [Context] log-prefix convention.
const DEBUG_GATE = process.env.NOTION_DEBUG_DIAGNOSTICS === "1"; // name: discretion

async function describeFailure(error: unknown, probeUrl?: string): Promise<string> {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error);

  if (!DEBUG_GATE) {
    return JSON.stringify({ name, message }); // D-01's leg-naming log stays permanent/ungated;
                                                // this function only adds the DEEP fields when gated
  }

  const isFetchErrorShape =
    error instanceof Error &&
    error.name === "FetchError" &&
    "status" in error; // ofetch's FetchError — verified getter shape above

  if (isFetchErrorShape) {
    const fe = error as Error & { status?: number; data?: unknown; statusText?: string };
    const contentType = typeof fe.data === "string" ? "text-or-html" : "json"; // approximate; see note
    const bodyExcerpt =
      typeof fe.data === "string" ? fe.data.slice(0, 200) : JSON.stringify(fe.data ?? null).slice(0, 200);
    return JSON.stringify({ name, message, status: fe.status, contentType, bodyExcerpt });
  }

  // D-04: no usable status/data on the thrown error (plain Error — invalid ID, or
  // notion-client's own "Notion page not found" 200-but-empty case) — one raw probe.
  if (probeUrl) {
    try {
      const res = await fetch(probeUrl, { method: "POST", /* same body/headers as notion-x.ts */ });
      const contentType = res.headers.get("content-type") ?? "";
      const bodyExcerpt = (await res.text()).slice(0, 200);
      return JSON.stringify({ name, message, status: res.status, contentType, bodyExcerpt, viaProbe: true });
    } catch (probeErr) {
      return JSON.stringify({ name, message, probeFailed: String(probeErr) });
    }
  }

  return JSON.stringify({ name, message });
}
```

Note: `ofetch`'s `.data` getter returns the *already-parsed* body, not a raw string with a knowable content-type — for a precise `content-type` field per D-03, prefer reading `error.response?.headers?.get("content-type")` directly (the raw `Response` object is also exposed via `FetchError.response`, verified above) rather than inferring it from the shape of `.data`.

### Pattern: Secret-Gated Debug Route (D-06/D-07)

```typescript
// Source: structure copied from apps/web/src/app/api/notify-subscribers/route.ts's
// safeCompare + fail-closed-first shape; response posture (404) copied from
// apps/web/src/app/api/subscribe/route.ts's unconfigured-route behavior.
export const runtime = "nodejs";

export async function GET(request: Request) {
  const debugGateOn = process.env.NOTION_DEBUG_DIAGNOSTICS === "1"; // same flag as D-02
  const routeSecret = process.env.NOTION_DEBUG_ROUTE_SECRET; // name: discretion, distinct from CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? "";

  if (!debugGateOn || !routeSecret || !safeCompare(authHeader, `Bearer ${routeSecret}`)) {
    // Both conditions (D-07) collapse to the same 404 — matches /api/subscribe's
    // "indistinguishable from a route that doesn't exist" posture, not
    // /api/notify-subscribers's 401 (which would confirm route existence to a prober).
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const pageId = searchParams.get("id");
  if (!pageId) return Response.json({ ok: false, code: "missing_id" }, { status: 400 });

  // ... call getPageRecordMap(pageId) with the same deep-diagnostic capture as above
}
```

### Anti-Patterns to Avoid

- **Wrapping `getPost()` in a `try/catch` and assuming that closes CONT-04/SC#4 for that leg** — per the corrected finding above, `getPost()` never throws, so this achieves nothing on its own; the actual gap (transient failure indistinguishable from genuine 404) lives inside `packages/core`, which cannot be touched.
- **Reading `.status`/`.data` off any caught error without first checking `error.name === "FetchError"`** — a plain `Error` (invalid ID, or `notion-client`'s own "page not found" throw) has neither property; accessing them yields `undefined`, which is a valid-looking-but-wrong JSON field if not distinguished from "the FetchError genuinely had no response" (D-04's actual trigger condition).
- **Trusting `mode: 'no-cors'` to mean anything server-side** — it's a browser-only fetch semantic; Node's `fetch` accepts the option without enforcing CORS opacity (verified this session), so don't reason about the failure using CORS mental models.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time secret comparison for the new debug-route secret | A naive `===` string comparison | `safeCompare()`'s exact pattern already in `apps/web/src/app/api/notify-subscribers/route.ts:43-52` (`timingSafeEqual` + length-mismatch time-burn) | Already solved once in this repo with the timing-side-channel edge case handled; reimplementing risks reintroducing exactly the bug that pattern exists to close |
| Distinguishing `FetchError` vs. plain `Error` from `notion-client` | A `try { JSON.parse(err) }`-style heuristic, or matching on `err.message` substrings | `error instanceof Error && error.name === "FetchError"` plus `"status" in error` (verified getter shape above) | `ofetch`'s `FetchError` is a real, documented class with a stable `.name`; message-substring matching is exactly the anti-pattern `client.ts`'s own `patchPage()` comment already flags as unverified/fragile (`packages/core/src/client.ts:382-388`) |
| Recognizing a `notFound()`/`redirect()` control-flow error inside a catch | Checking `error.digest === "NEXT_HTTP_ERROR_FALLBACK;404"` by hand | `unstable_rethrow(error)` from `next/navigation` (verified exported, this session) | The digest string format is an internal implementation detail (unexported `isHTTPAccessFallbackError`); `unstable_rethrow` is the stable public surface for the same check and additionally covers `redirect()`, dynamic-postpone, and other Next-internal signals this repo doesn't need to enumerate itself |

**Key insight:** every "don't hand-roll" item above has an existing, already-battle-tested implementation either in this repo or in the framework/dependency itself — this phase's job is composition, not invention.

## Common Pitfalls

(PITFALLS.md's Pitfalls 5, 6, 12, 15 are the canonical references for this phase per CONTEXT.md and are not repeated verbatim here — only phase-7-specific additions/refinements found during this research pass.)

### Pitfall A: Treating "`getPost()` didn't throw" as "no failure occurred"

**What goes wrong:** Because `getPost()` swallows every failure to `null` (verified above), a plan that adds a `try/catch` around `getPost()` and declares CONT-04/SC#4 "done" once it compiles will not actually change behavior — the function already never throws, so the catch block is dead code.
**Why it happens:** CONTEXT.md's own canonical_refs states the opposite (that `getPost` throws on non-404), a reasonable inference from `packages/core`'s public method name and general shape that doesn't match the actual `try/catch` nesting.
**How to avoid:** Read `packages/core/src/client.ts:311-338` directly (quoted above) before implementing D-12; decide explicitly whether the plan accepts the residual "transient getPost failure still 404s a real post" gap, or adds an app-level discriminator.
**Warning signs:** A diff adds `try { await getPost(id) } catch {...}` with no accompanying change to how the `null` case is distinguished from a genuine 404.

### Pitfall B: Assuming every caught `notion-client` error has a `.status`

**What goes wrong:** Code that unconditionally does `error.status` / `error.data` on anything caught from `getPageRecordMap()` will silently log `undefined` for the two cases (network-level failure, or `notion-client`'s own "page not found" 200-but-empty throw) where D-04's probe is actually required — defeating the entire point of D-03's evidence requirement for exactly the candidates most likely to be the real cause.
**How to avoid:** Branch on `error.name === "FetchError" && "status" in error` (or equivalently, check `error.status !== undefined`) before deciding whether the probe fallback is needed, per the `describeFailure` pattern above.
**Warning signs:** `07-EVIDENCE.md` rows show `status: undefined` or `contentType: undefined` for a candidate the raw probe should have been able to fill in.

### Pitfall C: Debug-route response posture inconsistency

**What goes wrong:** Building the new debug route on the `/api/notify-subscribers` precedent (401 on bad auth) instead of `/api/subscribe`'s (404 when unconfigured) reveals the route's existence to anyone who probes it with a wrong secret, contradicting D-07's literal "the route responds 404" wording and this repo's `SEC-03`-style "indistinguishable from a deployment that never had this route" posture used elsewhere (`/api/subscribe:310` comment).
**How to avoid:** Collapse both gate failures (`debugGateOn` false, or secret wrong/missing) to the same bare 404, per the Route-Handler Shape table above.
**Warning signs:** The new route returns `401` anywhere in its gate logic.

### Pitfall D: Forgetting Hobby's 1-hour log retention when planning the evidence-capture sequence

**What goes wrong:** An operator triggers the debug route, gets distracted, and returns 90 minutes later to copy the log line into `07-EVIDENCE.md` — it's gone.
**How to avoid:** Sequence the plan's verification/evidence steps so the debug-route trigger and the dashboard log copy happen in the same sitting, not across a break.
**Warning signs:** `07-EVIDENCE.md`'s raw-log-line field is filled from memory/paraphrase instead of a pasted line, or is empty with a note like "log had already rolled off by the time I checked."

## Code Examples

### Reading a `notFound()`-safe pattern end to end

```typescript
// Source: next/navigation's unstable_rethrow (verified exported this session,
// node_modules/next/dist/client/components/unstable-rethrow.server.js)
import { unstable_rethrow } from "next/navigation";
import { notFound } from "next/navigation";

// Only needed if notFound() and a fallible call ever share one try — see
// "notFound() vs try/catch" section above for why the CURRENT code doesn't need this.
```

### Reading the raw `content-type` off a `FetchError`'s underlying `Response`

```typescript
// Source: node_modules/ofetch/dist/shared/ofetch.CWycOUEr.mjs — FetchError exposes
// `.response` (the raw Response object) as a getter, verified above.
if (error instanceof Error && error.name === "FetchError" && "response" in error) {
  const res = (error as any).response as Response | undefined;
  const contentType = res?.headers.get("content-type") ?? null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `isNotFoundError` (Next.js <15-era API for recognizing `notFound()` errors) | `unstable_rethrow()` / internal `isHTTPAccessFallbackError` (not publicly exported) | Confirmed absent in this installed Next 16.2.4 — `grep` across the full `node_modules/next/dist` found zero matches for `isNotFoundError` | Any research/training-data reference to `isNotFoundError` is stale for this project; use `unstable_rethrow` |
| Next.js <15 default: `fetch()` cached (`force-cache`) unless opted out | Next.js 15+/16 default: `fetch()` is `no-store` unless opted in via `next: {revalidate}` or `cache: 'force-cache'` | Next.js 15 (carried into 16, per official docs, MEDIUM confidence — web search cross-checked against 2 independent sources, not read from this repo's exact `next` build output) | Relevant only as background: `getPageRecordMap()`'s internal `ofetch` call (which defaults to `globalThis.fetch`) is not swept into Next's Data Cache by default even though it's unmemoized — rules out "stale Next fetch cache" as a confound when interpreting evidence for this specific leg |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vercel's Node.js Function runtime sends the same `user-agent: node` default this session's local Node v22.23.1 test observed | notion-client Error Taxonomy | If Vercel's runtime sends a different (or no) default User-Agent, the react-notion-x #710 discriminator loses its concrete anchor — must be confirmed against the actual captured production evidence, not assumed |
| A2 | The new debug route should collapse both gate failures to 404 (matching `/api/subscribe`'s posture) rather than 401 (matching `/api/notify-subscribers`'s posture) | Route-Handler Shape | Low risk either way functionally; a 401 would reveal route existence to a prober, a minor security-posture regression relative to this repo's stated SEC-03-style intent elsewhere |
| A3 | Next.js 15+'s `fetch()` default-to-`no-store` change (web-searched, not read from this repo's exact `next` dist source) applies identically in Next 16.2.4 as installed here | State of the Art | Low impact on this phase's actual deliverables (no code depends on this claim); relevant only as interpretive context for evidence review |

## Open Questions

1. **Does CONT-04/SC#4 get fully closed for the `getPost()` leg, or is a residual gap accepted?**
   - What we know: `getPost()` never throws (verified); its `null` return already collapses "genuinely 404" and "transient failure" into one signal, and this collapse happens inside `packages/core`, which this phase cannot touch.
   - What's unclear: whether the plan should (a) accept the residual gap and document it explicitly as not-closed-by-this-phase, or (b) add an app-level discriminating check in `post/[id]/page.tsx` (e.g., a lightweight raw-fetch HEAD/GET probe against `https://api.notion.com/v1/pages/{id}` mirroring D-04's technique) that independently determines genuine-404 vs. transient-failure without modifying `packages/core`.
   - Recommendation: surface this explicitly to the planner as a decision point before writing tasks — CONTEXT.md's D-12 states the *requirement* (notFound() scoped to genuine 404; other failures get a transient state) without specifying *how*, given the now-corrected understanding that there's nothing to catch.

2. **Does Vercel's Node.js Function runtime send a default `User-Agent`, and if so, what value?**
   - What we know: Node's built-in `fetch` (undici) does, locally (`user-agent: node`).
   - What's unclear: Vercel's exact Node.js version/runtime configuration for this specific project, and whether Vercel's platform itself rewrites/strips this header at its edge/proxy layer before the request leaves Vercel's network.
   - Recommendation: this is exactly the kind of fact D-04's raw-fetch probe, run from the actual deployed debug route, will settle empirically — don't resolve it via more research, resolve it via the live evidence capture this phase already plans to do.

3. **Whether `error.data`'s parsed shape (object vs. string) reliably round-trips to a useful "first 200 characters" for D-03** — `ofetch` JSON-parses any `application/json`-ish content-type automatically; for a Cloudflare HTML challenge page (the leading PITFALLS.md candidate), the content-type would be `text/html`, so `.data` would be the raw HTML string, directly sliceable. For a clean JSON error body, `.data` is already an object, needs `JSON.stringify` first. Both cases are handled by the `describeFailure` pattern above, but this hasn't been tested against a real captured response from this project's actual failure.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vercel` CLI | Reading production logs / env vars | ✗ | — | Vercel dashboard (Logs tab, Settings → Environment Variables) — fully sufficient per research above, no functionality gap for this phase's needs |
| `.vercel/` project link | N/A (CLI-dependent) | ✗ | — | Not needed — dashboard access requires only a browser + project access |
| Node.js (local, for any local reasoning/testing) | Verifying `notion-client`/`ofetch` behavior locally | ✓ | v22.23.1 | — |
| Production deployment access (Vercel dashboard) | D-09 (evidence must be captured against Production) | Not verified this session (no browser/dashboard access from this environment) | — | Operator must perform the live checklist steps (D-10) interactively — this is expected and already the plan's design, not a gap |

**Missing dependencies with no fallback:** None — the `vercel` CLI's absence is fully mitigated by dashboard access per the research above.

**Missing dependencies with fallback:** `vercel` CLI → Vercel dashboard (documented step-by-step above).

## Validation Architecture

This project has zero test infrastructure (no jest/vitest/playwright config, no `*.test.*`/`*.spec.*` files anywhere outside `node_modules`, confirmed by a repo-wide `find` this session) and adding a test framework is explicitly out of scope for this milestone (`REQUIREMENTS.md` Out of Scope). Nyquist validation for this phase must therefore be designed entirely around **source inspection** (static, in this session/at plan-review time) and **deployed-site operator verification** (dynamic, at execution time) — there is no automated test tier available.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — no test runner installed in this repo |
| Config file | none |
| Quick run command | none (no automated tier available) |
| Full suite command | none |

### Phase Requirements → Verification Map
| Req ID | Behavior | Verification Type | Method | Automatable? |
|--------|----------|-------|--------|-------------|
| CONT-01 | Log line names which leg failed | Source inspection + live production log read | Read the diff for three distinct bracket prefixes (`[PostPage:recordMap]`, `[PostPage:chrome]`, `[PostPage:post]`/similar); confirm live in Vercel dashboard Logs tab against a real failing request | No — requires a real failure and dashboard access |
| CONT-02 | Live evidence captured, six-candidate table filled, named verdict recorded | Operator-verified, artifact-checked | `07-EVIDENCE.md` exists, six-candidate table copied from PITFALLS.md Pitfall 5 with rows filled from observed data, ends in a named verdict or explicit "matches none of the six" | No — inherently a human-authored evidentiary record; source inspection can only confirm the *file exists and is structurally complete*, not that the evidence is genuine |
| CONT-04 | Chrome failure no longer blanks the body | Source inspection (structural) + operator-verified (behavioral) | Confirm the two-`try` decomposition in the diff (structural); trigger a genuine `categories`/`getPosts` failure against the deployed site (e.g., via the debug route or a temporarily-wrong `DATABASE_ID` in a throwaway check) and confirm the body still renders (behavioral) — `next dev` does not satisfy this (PITFALLS.md Pitfall 12) | Partially — structural check is code review; behavioral check needs a live deployment |
| D-17's "no leg throws uncaught" checklist | Every `await` in `post/[id]/page.tsx` sits inside a catch, with a comment | Source inspection | Manual code review at plan-checker/verification time — count every `await` in the file, confirm each is inside a `try` or is `getPost()` (documented exception, per the corrected finding, since it structurally cannot throw) | Yes, as a manual read-through — no tooling exists to automate it (no ESLint custom rule per D-17's own reasoning) |

### Sampling Rate
- **Per task commit:** source read-through against the specific line ranges touched (no automated command exists)
- **Per wave merge:** re-read the full `post/[id]/page.tsx` diff for the D-17 checklist
- **Phase gate:** `07-EVIDENCE.md` complete with a named verdict, plus a live deployed-site check for CONT-04's behavioral half, before `/gsd-verify-work`

### Wave 0 Gaps
None — no test framework exists and none is being added this phase (explicit project-level decision, not a gap introduced here).

## Security Domain

`security_enforcement` not found disabled in `.planning/config.json` context provided — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (narrow) | The new debug route's secret check — constant-time comparison via the existing `safeCompare()` pattern (`timingSafeEqual`), not a plain `===` |
| V5 Input Validation | Yes (narrow) | The debug route's `id` query param should be treated the same as the existing unvalidated dynamic route segment risk already tracked in `PROJECT.md` (explicitly out of scope to *fix* this milestone, but the new route should not introduce a *new* unvalidated-input surface beyond what already exists — it passes `id` straight to `getPageRecordMap`, the same shape as the existing page route) |
| V7 Error Handling / Logging | Yes (central to this phase) | D-03's deep-diagnostic payload is exactly an ASVS V7-style "log enough to diagnose, without leaking secrets" concern — confirm the response-body excerpt captured (first 200 chars) cannot itself contain `NOTION_TOKEN_V2`'s value or other secrets; Notion's own error responses are the only body source, so this is low risk, but worth a one-line confirmation in the plan's verification step |
| V6 Cryptography | Yes (narrow, reused not built) | `timingSafeEqual`-based secret comparison — already implemented in this repo (`notify-subscribers/route.ts:43-52`), reuse rather than reimplement (see Don't Hand-Roll) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Debug/diagnostic route left reachable with a guessable or absent secret | Elevation of Privilege / Information Disclosure | Double-gate (D-07): debug env flag AND dedicated secret, both required, uniform 404 on any failure (see Pitfall C above) |
| Timing side-channel on secret comparison | Information Disclosure | `timingSafeEqual`, length-mismatch handled without early-exit timing difference (existing `safeCompare()` pattern) |
| Response-body excerpt logging inadvertently capturing a secret | Information Disclosure | Source of the excerpt is Notion's own HTTP response body, not this app's request — verify this stays true; the 200-char cap (D-03, already decided over 1000 chars partly for this reason) bounds worst-case exposure |

## Sources

### Primary (HIGH confidence — read directly this session)
- `apps/web/src/app/post/[id]/page.tsx` — full file
- `packages/core/src/client.ts` — full file, `getPost()` line-by-line
- `apps/web/src/lib/notion-x.ts` — full file
- `apps/web/src/lib/notion.ts` — full file
- `apps/web/src/templates/default/PostPage.tsx`, `apps/web/src/templates/terminal/PostPage.tsx` — full files
- `apps/web/src/app/layout.tsx` — full file
- `apps/web/src/app/api/notify-subscribers/route.ts`, `apps/web/src/app/api/subscribe/route.ts` — full files
- `apps/web/src/site.config.ts` — full file
- `node_modules/notion-client/src/notion-api.ts` (v7.10.0) — full file
- `node_modules/notion-client/src/notion-api.test.ts` — full file
- `node_modules/notion-client/package.json` — dependency list
- `node_modules/notion-utils/src/parse-page-id.ts` — full file
- `node_modules/ofetch/dist/shared/ofetch.CWycOUEr.mjs` (v1.5.1) — `FetchError`/`createFetchError`/`$fetchRaw` full source
- `node_modules/next/dist/client/components/not-found.js`, `is-next-router-error.js`, `unstable-rethrow.server.js`, `http-access-fallback/http-access-fallback.js`, `navigation.js` (next v16.2.4) — full source
- Local empirical test this session: Node v22.23.1 `fetch()` default headers against a local HTTP server, replicating `notion-client`'s exact call shape
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/PITFALLS.md`, `.planning/PROJECT.md` — full files

### Secondary (MEDIUM confidence — official docs, fetched live this session)
- [Vercel — Runtime Logs](https://vercel.com/docs/logs/runtime) — retention table, filter/search UI, dashboard navigation, last_updated 2026-08-03
- [Vercel — Environment variables](https://vercel.com/docs/environment-variables) — sensitivity/visibility rules
- [Vercel — Managing environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables) — exact dashboard navigation steps, last_updated 2026-04-27
- [Next.js — `notFound` API reference](bundled in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`) — official digest format confirmation

### Tertiary (LOW/MEDIUM confidence — web search, not read from an authoritative single source)
- Next.js 15+ default `fetch()` caching change (`no-store` by default) — cross-checked across 2 independent web sources, not confirmed against this repo's exact `next` build output; used only as interpretive background, not load-bearing for any code change this phase makes

## Metadata

**Confidence breakdown:**
- notion-client error taxonomy (FetchError shape, header behavior, the two non-FetchError throw paths): HIGH — read directly from installed `node_modules` source, cross-checked with an empirical local test
- `getPost()` never-throws finding: HIGH — read directly, quoted verbatim, contradicts CONTEXT.md's own canonical_refs (which should be treated as corrected by this research)
- `notFound()`/`unstable_rethrow` API surface: HIGH — read directly, confirmed programmatically (`require()` + property check) which symbols are actually exported
- Vercel dashboard log/env-var access: MEDIUM — official docs fetched live this session, not confirmed against this specific deployed project's actual UI (no dashboard access from this environment)
- Vercel's Node.js runtime default `User-Agent`: LOW-MEDIUM — extrapolated from a local Node test, not confirmed on Vercel's infrastructure

**Research date:** 2026-08-09
**Valid until:** `notion-client`/`ofetch`/Next.js internals: 30 days (pinned versions in this repo, low churn risk before then) — Vercel dashboard UI specifics: 30 days but treat as lower-confidence the closer to that boundary, dashboard UIs change without a version bump the repo would surface
