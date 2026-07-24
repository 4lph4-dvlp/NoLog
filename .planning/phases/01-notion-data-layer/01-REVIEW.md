---
phase: 01-notion-data-layer
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - packages/core/src/client.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

This is a fresh review of `packages/core/src/client.ts` after the gap-closure commit `71f81a5` ("fix(01-02): correct Notion status filter property key casing (CR-01)"), which changed exactly two string literals (`"status"` → `"Status"` in the `getPosts()` and `getUnemailedPublicPosts()` filter bodies). This review supersedes the prior `01-REVIEW.md` and is scoped to `client.ts` only, per the file list provided for this pass.

**CR-01 (property-key casing defect) is CONFIRMED RESOLVED.** Verified via `git diff 6277535^..HEAD -- packages/core/src/client.ts`: both `getPosts()` (line 226) and `getUnemailedPublicPosts()` (line 259) now filter on `property: "Status"` (matching the actual Notion schema property name used everywhere else in the file, e.g. `getSelect(page, "Status", "status")`), rather than the previously-broken lowercase `"status"`, which would have caused the Notion API to 400 (property not found in schema) on the primary read path.

Because this pass only touched two string literals, the four previously-flagged warnings (WR-01 through WR-04) were out of scope for the fix and are **all still present** in the current state of the file — re-verified below rather than silently dropped. This pass also surfaced one new Critical finding (unvalidated user input flowing directly into a Notion API request URL) and two additional warnings not previously called out.

## Critical Issues

### CR-01: Unvalidated, unencoded `pageId` interpolated directly into Notion API URLs (path traversal / endpoint redirection)

**File:** `packages/core/src/client.ts:292`, `packages/core/src/client.ts:344`

**Issue:** `getPost()` and `patchPage()` (invoked by `markEmailed()`) build request URLs by direct string interpolation of a caller-supplied ID, with no validation (e.g. UUID-shape check) and no `encodeURIComponent`:

```ts
const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { ... });   // line 292, getPost
const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, { ... });   // line 344, patchPage
```

`pageId` is not a trusted, internally-generated value on at least one live call path: `apps/web/src/app/post/[id]/page.tsx` reads the raw dynamic route segment `id` directly from the request URL and passes it straight through `getPost(id)` (`apps/web/src/lib/notion.ts:23-25`) into `nologClient.getPost(pageId)` with zero sanitization anywhere in between. A crafted value (e.g. containing `..` segments or an encoded slash) can, depending on how the URL constructor / upstream router normalizes the string, cause the resulting `fetch()` call to hit a different path on `api.notion.com` than intended, or inject unexpected query parameters — all while still carrying the site's real `Authorization` bearer token in the headers. This is a request-forgery-adjacent vulnerability: attacker-controlled input directly shapes the path of a privileged, token-bearing outbound API call, with no defense-in-depth validation at the client-library boundary.

**Fix:** Validate the ID against Notion's expected shape before use, and/or encode every interpolated path segment:

```ts
function assertNotionId(id: string): void {
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) {
    throw new Error(`Invalid Notion ID: ${id}`);
  }
}

public async getPost(pageId: string): Promise<Post | null> {
  try {
    assertNotionId(pageId);
    const res = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, { ... });
    ...
```

Apply the same treatment in `patchPage()` (line 344), and consider it for `queryDatabase()`'s `databaseId` interpolation (line 200) too, even though that value currently originates from trusted server-side env config.

## Warnings

### WR-01: Inconsistent error handling across methods — still present (carried over)

**File:** `packages/core/src/client.ts:290-317` (`getPost`)

**Issue:** `getPost()` wraps its entire body in a bare `try { ... } catch { return null; }` (line 314-316), collapsing every failure mode — network error, non-2xx status other than 404, malformed JSON, auth failure (401/403 from a bad `NOTION_TOKEN`) — into the same `null` result as a legitimate "page not found." Nothing is logged, which contradicts this repo's own documented logging convention (`console.error("[Context] message:", error)`). Meanwhile `getPosts()`/`getCategories()` let `queryDatabase()` errors propagate uncaught, and `patchPage()` throws typed errors (`NotionCapabilityError`, `MissingEmailedPropertyError`). Three different error-handling strategies coexist in the same class with no documented rationale. In practice, a misconfigured `NOTION_TOKEN` silently renders every post page as a 404 instead of surfacing a debuggable error.

**Fix:** Distinguish "not found" from other failures, and log unexpected failures before returning `null`:
```ts
} catch (err) {
  console.error(`[NologClient] getPost(${pageId}) failed:`, err);
  return null;
}
```
Consider letting non-404 HTTP errors propagate (as `getPosts()` does) instead of collapsing them into `null`, so callers can distinguish "content missing" from "backend broken."

### WR-02: Fragile substring-regex detection of "missing property" Notion errors — still present (carried over)

**File:** `packages/core/src/client.ts:281-282`, `packages/core/src/client.ts:368`

**Issue:** Both `getUnemailedPublicPosts()` and `patchPage()` classify a Notion error as "the `Emailed` property doesn't exist on the schema" purely via free-text matching:
```ts
if (err instanceof Error && /Emailed/i.test(err.message) && /propert/i.test(err.message)) {   // line 281
```
```ts
if (res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)) {           // line 368
```
The code's own comments (lines 279-280, 361-367) still acknowledge this is an **unverified** heuristic against real Notion API error text. This risks both false positives (e.g. "Could not set Emailed property: invalid checkbox value" would be misclassified as a missing-schema-property error) and false negatives if Notion's actual wording differs from what's assumed.

**Fix:** As the code's own comments state, this needs verification against a live Notion workspace's actual 400 error shape (Notion errors typically carry a structured `code` field, e.g. `"validation_error"` — prefer matching that over free-text substrings).

### WR-03: `Post` type still duplicated across packages — still present (cross-file, carried over)

**File:** `packages/core/src/client.ts:3` (imports the canonical `Post` from `./types`)

**Issue:** `client.ts`'s `Post` import depends on `packages/core/src/types.ts`, which remains byte-for-byte duplicated (not re-exported) in `apps/web/src/types/index.ts`. `apps/web/src/lib/notion.ts:3` already imports `Post` directly from `@4lph4/nolog-core`, making the parallel local copy in `apps/web/src/types/index.ts` redundant and free to silently drift from the type `client.ts` actually produces. Not a defect in `client.ts` itself, but the type this file exports has no single source of truth downstream.

**Fix:** Replace the duplicate with a re-export: `export type { Post } from "@4lph4/nolog-core";` in `apps/web/src/types/index.ts`.

### WR-04: `isPageObjectResponse()` type guard lacks the `object` discriminant — still present (carried over)

**File:** `packages/core/src/client.ts:13-15`

**Issue:**
```ts
function isPageObjectResponse(value: unknown): value is PageObjectResponse {
  return typeof value === "object" && value !== null && "properties" in value;
}
```
This only checks for a `properties` key, not Notion's actual page discriminant `object === "page"`. Any response shape carrying a `properties` key (e.g. a malformed/partial API response, or a different Notion object type that happens to expose `properties`) would pass this guard and flow into `mapPageToPost()`, which assumes a full `PageObjectResponse` (`page.id`, `page.created_time`, `page.last_edited_time`, etc.), risking `undefined` fields or a crash rather than a clean type-level rejection.

**Fix:**
```ts
function isPageObjectResponse(value: unknown): value is PageObjectResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { object?: unknown }).object === "page" &&
    "properties" in value
  );
}
```

### WR-05: `fetchOptions` spread order can silently clobber auth headers

**File:** `packages/core/src/client.ts:179-182`, `packages/core/src/client.ts:205`, `packages/core/src/client.ts:294`, `packages/core/src/client.ts:348`

**Issue:** In all four places `fetchOptions` is applied to a `fetch()` call, it is spread *last*:
```ts
const res = await fetch(url, {
  method: "POST",
  headers: this.getNotionHeaders(),
  body: JSON.stringify(body),
  ...this.fetchOptions,     // line 205 — shallow spread, no deep merge
});
```
Object spread does a shallow, top-level merge — if `this.fetchOptions` (typed as `RequestInit`, so `headers` is a legal key) ever included a `headers` field, it would fully replace `getNotionHeaders()`'s `Authorization`/`Notion-Version` headers rather than merge with them, silently breaking authentication on every request. The `NologClientOptions.fetchOptions` JSDoc ("Optional custom fetch options") does not warn callers away from passing `headers`, so this is a latent foot-gun in the public API contract — not currently triggered only because `apps/web/src/lib/notion.ts` happens to pass just `{ next: {...} }`.

**Fix:** Merge headers explicitly instead of relying on spread order:
```ts
const res = await fetch(url, {
  method: "POST",
  ...this.fetchOptions,
  headers: { ...this.getNotionHeaders(), ...(this.fetchOptions?.headers ?? {}) },
  body: JSON.stringify(body),
});
```
Apply the same pattern to the SDK `fetch` override in the constructor (lines 179-182).

### WR-06: Duplicated pagination loop between `getPosts()` and `getUnemailedPublicPosts()`

**File:** `packages/core/src/client.ts:234-242`, `packages/core/src/client.ts:269-277`

**Issue:** Both methods implement the identical `do { queryDatabase(...); push(...results); cursor = next_cursor } while (cursor)` pagination pattern, differing only in the filter body and the presence of a try/catch in one. This duplication means any future pagination fix (e.g. a max-page safety cap, or a shared retry policy) must be applied twice, and the two copies have already begun to diverge (only one has the error-classification try/catch).

**Fix:** Extract a shared private helper, e.g. `private async paginateQuery(filterBody): Promise<PageObjectResponse[]>`, and have both public methods call it.

## Info

### IN-01: `getTitle()` breaks from the extractor pattern used by every other property reader

**File:** `packages/core/src/client.ts:28-34`

**Issue:** Every other extractor (`getRichText`, `getSelect`, `getMultiSelect`, `getFileUrl`, `getPeople`) takes a `(page, key, fallbackKey?)` signature, letting the caller decide the fallback key. `getTitle()` instead hardcodes three keys inline (`"Name" || "title" || "Title"`), inconsistent with the rest of the file and harder to reason about at a glance.

**Fix:** Conform to the shared signature, e.g. call a helper with `("Name", "title")`, or add a short comment explaining why title alone needs a 3-way fallback.

### IN-02: Duplicated magic number `page_size: 100`

**File:** `packages/core/src/client.ts:223`, `packages/core/src/client.ts:255`

**Issue:** The Notion max page size (100) is repeated as a bare literal in two query bodies.

**Fix:** `const NOTION_MAX_PAGE_SIZE = 100;` near the existing `NOTION_VERSION` constant, referenced from both call sites.

### IN-03: Trailing whitespace on blank lines

**File:** `packages/core/src/client.ts:39`, `packages/core/src/client.ts:49`, `packages/core/src/client.ts:59`, `packages/core/src/client.ts:69`, `packages/core/src/client.ts:176`

**Issue:** Blank lines after each fallback-key check (`getRichText`, `getSelect`, `getMultiSelect`, `getFileUrl`) and inside the constructor carry trailing spaces — cosmetic only, but may trip strict lint/formatter configs in CI.

**Fix:** Strip trailing whitespace; consider an ESLint/Prettier rule to catch this automatically going forward.

---

_Reviewed: 2026-07-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
