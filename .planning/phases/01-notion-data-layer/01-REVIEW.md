---
phase: 01-notion-data-layer
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/web/src/types/index.ts
  - packages/core/scripts/verify-403.ts
  - packages/core/scripts/verify-phase-1.ts
  - packages/core/src/client.ts
  - packages/core/src/types.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-07-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the Notion data-layer core client (`packages/core/src/client.ts`, `types.ts`), the app-side `Post` type re-declaration, and the two manual verification scripts. The core mapper (`mapPageToPost`) and error classes (`NotionCapabilityError`, `MissingEmailedPropertyError`) are well documented and internally consistent. However, `client.ts` contains one internal contradiction between the property-name convention used everywhere else in the file and the property name actually sent in the two Notion database query filters — this breaks the primary read path (`getPosts()`) and the notify-pipeline read path (`getUnemailedPublicPosts()`) for any workspace that follows the documented/canonical schema. There are also several robustness and maintainability gaps: inconsistent error-handling style across the three public read methods, fragile string-matching used to detect a specific Notion error condition, and a byte-for-byte duplicated `Post` interface across two packages with no re-export.

## Critical Issues

### CR-01: Query filters use the wrong property-name casing ("status" vs "Status"), breaking `getPosts()` and `getUnemailedPublicPosts()`

**File:** `packages/core/src/client.ts:226` and `packages/core/src/client.ts:259`

**Issue:** Everywhere the codebase extracts the publication-status property, the *primary* (canonical) key checked is capitalized `"Status"`, with lowercase `"status"` used only as a legacy/typo fallback:

```ts
// client.ts:114 — mapPageToPost
status: getSelect(page, "Status", "status"),
```

This mirrors the same primary/fallback pattern used for every other property (`"Summary"`/`"summery"`, `"Thumbnail"`/`"thumbnail"`, `"Category"`/`"category"`, `"Tag"`/`"tag"`, `"Author"`/`"author"`), and the doc comment on `Post.status` in `types.ts:34` explicitly calls it the `` `Status` `` property.

However, the two Notion database **query filters** — which cannot fall back the way the client-side extractors can — hardcode only the lowercase variant:

```ts
// client.ts:225-228 — getPosts()
filter: {
  property: "status",
  select: { equals: "public" },
},
```

```ts
// client.ts:258-261 — getUnemailedPublicPosts()
and: [
  { property: "status", select: { equals: "public" } },
  { property: "Emailed", checkbox: { equals: false } },
],
```

Notion's `/v1/databases/{id}/query` filter `property` field must match the schema's property name **exactly** (case-sensitive) — there is no client-side fallback possible for a server-side filter. For any workspace that uses the canonical, documented property name `"Status"` (capital S — the name implied by every other part of this same file and by `types.ts`'s doc comment), both `getPosts()` and `getUnemailedPublicPosts()` will receive a 400 from Notion (`"Could not find property with name or id: status"`), which propagates as an uncaught `Error` out of `getPosts()` (no try/catch there at all — see WR-01) and, in `getUnemailedPublicPosts()`, gets swallowed by the `MissingEmailedPropertyError` regex check (which only tests for `/Emailed/i`, so it will *not* match and will rethrow the raw error — but still surfaces as the wrong condition entirely).

This is the primary data-fetch path for the entire site (home page, category page, search page, notify pipeline). It is completely broken for any forker who names the property `Status` per the documented convention, while silently *appearing* to work for the mapper (since the mapper's fallback logic never gets exercised because the query itself throws before results ever reach `mapPageToPost`).

**Fix:** Use the same primary key as the rest of the file (and add a fallback query if you want to support both casings, since Notion filters can't fallback in one request — but at minimum fix the primary case to match documented schema):

```ts
filter: {
  property: "Status",
  select: { equals: "public" },
},
```

```ts
and: [
  { property: "Status", select: { equals: "public" } },
  { property: "Emailed", checkbox: { equals: false } },
],
```

If both `"Status"` and `"status"` need to be supported for legacy databases, this requires either a schema-detection step first (fetch the database schema and pick the actual key) or documenting that the property name must be exactly `"Status"` and removing the misleading fallback-implying pattern from `mapPageToPost`.

## Warnings

### WR-01: Inconsistent error-handling style across the three public read methods

**File:** `packages/core/src/client.ts:221-245` (`getPosts`), `packages/core/src/client.ts:253-288` (`getUnemailedPublicPosts`), `packages/core/src/client.ts:290-317` (`getPost`)

**Issue:** The three public read methods handle failures three different ways:
- `getPosts()` has no try/catch at all — any Notion/network error propagates as an unhandled exception to the caller.
- `getUnemailedPublicPosts()` wraps the loop in try/catch, but only to special-case one error shape (`MissingEmailedPropertyError`), rethrowing everything else.
- `getPost()` catches **all** errors (network failures, malformed JSON, 500s, timeouts) and uniformly returns `null`, which is indistinguishable from a genuine "page not found" — a caller cannot tell a transient Notion outage from a missing/unpublished page.

This makes the class's failure contract unpredictable for consumers (e.g. Next.js pages or the notify route) that need to decide whether to retry, log, or render an empty state.

**Fix:** Pick one consistent contract, e.g.: all read methods return `[]`/`null` on any failure and log via a shared internal helper, or all read methods throw and let the caller (`apps/web/src/lib/notion.ts`) own the catch/fallback logic uniformly. Document the contract on the class.

### WR-02: Fragile substring-matching used to detect `MissingEmailedPropertyError`

**File:** `packages/core/src/client.ts:281-283` and `packages/core/src/client.ts:368`

**Issue:** Both call sites detect "the `Emailed` property doesn't exist on this database" by regex-testing the raw Notion error body/message for `/Emailed/i` and `/propert/i`:

```ts
if (err instanceof Error && /Emailed/i.test(err.message) && /propert/i.test(err.message)) {
  throw new MissingEmailedPropertyError(err.message);
}
```
```ts
if (res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)) {
  throw new MissingEmailedPropertyError(bodyText);
}
```

The code's own comments acknowledge this is "UNVERIFIED against live Notion behaviour" and must be validated before D-01 is "done." Shipping this without validation means: (1) if Notion's actual error wording differs even slightly, the specific, actionable `MissingEmailedPropertyError` never fires and callers get a generic, less-helpful `Error` instead; (2) conversely, an unrelated 400 error whose body happens to mention "Emailed" and "propert(y)" for a different reason would be mis-classified. There is no unit test enforcing this contract — only a manual script (`verify-403.ts`) that requires temporarily breaking a live Notion integration's capabilities, which is unlikely to be run routinely or in CI.

**Fix:** Validate against a real Notion 400 response body for a missing-property PATCH, and either tighten the match to the exact documented error code/structure (Notion errors include a `code` field, e.g. `"validation_error"`, which is more stable than free-text matching) or add this as a permanent regression check that runs whenever `packages/core` changes.

### WR-03: `Post` interface is duplicated byte-for-byte across two files with no re-export

**File:** `apps/web/src/types/index.ts:1-38` and `packages/core/src/types.ts:1-38`

**Issue:** `apps/web/src/types/index.ts` is an exact copy of `packages/core/src/types.ts` (confirmed via diff — zero differences). Since `apps/web` already depends on `@4lph4/nolog-core` (which exports `Post` via `packages/core/src/index.ts`), maintaining two independently-editable copies of the same interface means any future field addition/rename to `Post` (e.g. adding a new Notion property) must be manually mirrored in both files. If a developer updates one and forgets the other, both files will still compile (they're structurally independent interfaces with the same name), but the two `Post` types will silently drift, and the app's compile-time guarantees against the core package's actual return type disappear.

**Fix:** Re-export instead of duplicating:
```ts
export type { Post } from "@4lph4/nolog-core";
```

### WR-04: `isPageObjectResponse` type guard doesn't check the Notion `object` discriminant

**File:** `packages/core/src/client.ts:13-15`

**Issue:**
```ts
function isPageObjectResponse(value: unknown): value is PageObjectResponse {
  return typeof value === "object" && value !== null && "properties" in value;
}
```
This only checks for a `properties` key, not Notion's actual page discriminant (`value.object === "page"`). Any object shape with a `properties` key (e.g. a database object, which also has a top-level `properties` field describing its schema) would pass this guard and be cast to `PageObjectResponse`, then flow into `mapPageToPost()`, which accesses `page.id`, `page.created_time`, `page.last_edited_time` — fields that wouldn't exist on a database object, producing `undefined` values silently rather than a clear type error.

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

## Info

### IN-01: Magic string `"public"` repeated across three call sites

**File:** `packages/core/src/client.ts:227`, `packages/core/src/client.ts:259`, `packages/core/src/client.ts:309`

**Issue:** The literal `"public"` status value is repeated in `getPosts()`'s filter, `getUnemailedPublicPosts()`'s filter, and `getPost()`'s post-fetch guard (`if (post.status !== "public")`). If this value ever needs to change, three sites must be updated in lockstep.

**Fix:** Extract a shared constant, e.g. `const PUBLIC_STATUS = "public";`, and reference it from all three sites.

### IN-02: Verification scripts use non-null assertions on required env vars instead of a guard

**File:** `packages/core/scripts/verify-403.ts:19-20`, `packages/core/scripts/verify-phase-1.ts:19-20`

**Issue:** Both scripts do:
```ts
const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});
```
If either env var is unset, the non-null assertion silences the type system, and the script proceeds with `token: undefined`, producing a confusing `Authorization: Bearer undefined` 401 deep inside the Notion client rather than a clear, immediate "missing env var" message for the developer running the script.

**Fix:**
```ts
const token = process.env.NOTION_TOKEN;
const databaseId = process.env.NOTION_DATABASE_ID;
if (!token || !databaseId) {
  console.error("NOTION_TOKEN and NOTION_DATABASE_ID must be set.");
  process.exit(1);
}
```

### IN-03: `getTitle()` uses a different fallback pattern (3 keys, inline `||`) than every other extractor (2 keys, `key`/`fallbackKey` param)

**File:** `packages/core/src/client.ts:28-34`

**Issue:** `getTitle()` checks three property-name variants inline (`page.properties["Name"] || page.properties["title"] || page.properties["Title"]`), while every other extractor (`getRichText`, `getSelect`, `getMultiSelect`, `getFileUrl`, `getPeople`) uses a consistent `(page, key, fallbackKey?)` two-key pattern. This inconsistency makes the file harder to scan and reason about — a reader has to remember `getTitle` is the one exception.

**Fix:** Either extend the shared helper pattern to accept a second fallback key, or add a short comment explaining why `getTitle` needs three variants when nothing else does.

### IN-04: Custom error classes don't preserve the original Notion error as `cause`

**File:** `packages/core/src/client.ts:128-155`

**Issue:** `NotionCapabilityError` and `MissingEmailedPropertyError` both construct a new message from the raw Notion response text but don't pass the original error/response text through as `cause` (e.g. `super(message, { cause: originalErr })`), which loses stack-trace/context linkage useful for debugging in production logs.

**Fix:**
```ts
export class NotionCapabilityError extends Error {
  constructor(pageId: string, notionMessage: string) {
    super(`...`, { cause: notionMessage });
    this.name = "NotionCapabilityError";
  }
}
```

---

_Reviewed: 2026-07-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
