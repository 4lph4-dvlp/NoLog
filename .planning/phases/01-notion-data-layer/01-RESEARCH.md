# Phase 1: Notion Data Layer - Research

**Researched:** 2026-07-24
**Domain:** Extending `NologClient` (Notion REST API client) with a write path — mark-as-emailed checkbox mutation, unemailed-post query filter, and typed error handling for missing schema/missing capability
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** If the Notion database schema doesn't have the `Emailed` checkbox property yet (e.g. an existing fork upgrading to this feature), `getUnemailedPublicPosts()`/`markEmailed()` must fail loud and clear — throw a specific, clearly-worded error (e.g. "Emailed property not found on this database — add it in Notion first, see README") rather than letting Notion's raw API error propagate unexplained or silently no-op. — **Reversibility:** reversible.
- **D-02:** Once a post's `Emailed` checkbox is set to true, it stays true permanently — unpublishing (`Status` away from `public`) and later republishing the same post does NOT reset `Emailed` and does NOT trigger a second notification. A post notifies subscribers at most once, ever. — **Reversibility:** costly.
- **D-03:** `markEmailed()` must throw a typed/distinguishable error (not a generic `Error`, and not just a tagged `console.error`) when the Notion API returns 403 for the write. The specific shape (custom error class vs. a `code` field on a plain object) is left to the planner/executor, but it MUST be a shape a caller can `catch` and branch on programmatically. — **Reversibility:** reversible.
- **D-04:** Do NOT add a second Notion property for "when a post was emailed." Only the `Emailed` checkbox is written. No timestamp property, no extra field on the `patchPage()` call. — **Reversibility:** reversible.

### Claude's Discretion
None — all four areas got explicit decisions, no "you decide" answers.

### Deferred Ideas (OUT OF SCOPE)
None raised during this discussion — all four areas stayed within Phase 1's data-layer boundary. No scope creep occurred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | `NologClient` can query all public posts not yet marked `Emailed` | Pattern 1 below (compound `and` filter, verified checkbox filter shape); Code Examples §`getUnemailedPublicPosts()`; codebase-specific gotcha on `status` property casing |
| DATA-02 | `NologClient` can mark a post as `Emailed` after a successful send | Pattern 1 below (`patchPage()` helper); Code Examples §`markEmailed()`; verified checkbox PATCH body shape (live doc lookup, see Sources) |
| DATA-04 | `markEmailed` distinguishes a 403 (missing Notion "Update content" capability) from other failures in its logs | Pitfall 1 below; Code Examples §typed error classes; verified 403 `restricted_resource` error shape (live doc lookup) |

</phase_requirements>

## Summary

This phase is a pure extension of an already-well-understood client class — no new package, no new external dependency, no new architectural layer. `NologClient` (`packages/core/src/client.ts`) already has every piece of plumbing this phase needs: `getNotionHeaders()`, a private `queryDatabase()` pagination helper, and an established property-extractor convention. The work is: (1) add a private `patchPage()` write helper mirroring `queryDatabase()`'s shape, (2) add `markEmailed(pageId)` and `getUnemailedPublicPosts()` as public methods, (3) add a `getCheckbox()` extractor and an `emailed: boolean` field to `Post`/`mapPageToPost()`, and (4) add typed, `instanceof`-checkable error classes for the two "fail loud" cases the user locked in (D-01 missing-property, D-03 missing-capability/403).

The Notion `checkbox` property PATCH body shape and 403 `restricted_resource` error shape were verified directly against Notion's current public API reference during this research session (not assumed) — see Sources. Both match what `.planning/research/ARCHITECTURE.md` and `.planning/research/PITFALLS.md` already predicted, with one nuance worth flagging: Notion's docs show two slightly different write-body conventions (with and without a redundant `"type": "checkbox"` key) — this research recommends omitting the `type` key, matching the project's existing `ARCHITECTURE.md` example and the more commonly attested minimal form. Genuinely unresolved: Notion's docs do **not** specify the exact error shape for a query filter that references a property name absent from the database's schema entirely (the D-01 case) — this must be manually verified against the real Notion workspace during execution, exactly as the phase's own success criteria already require for the 403 case.

**Primary recommendation:** Extend `NologClient` in place (no new class), add a `// ─── Mutations ───` banner section with `patchPage()` (private) + `markEmailed()`/`getUnemailedPublicPosts()` (public), reuse the existing `NOTION_VERSION` constant and `getNotionHeaders()` unchanged, and represent both "fail loud" cases (D-01, D-03) as `instanceof`-distinguishable custom `Error` subclasses rather than plain objects with a `code` field, since the codebase's own documented convention (`.claude/CLAUDE.md` Error Handling section) is already `instanceof Error` checks, not duck-typed `code` inspection.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Query unemailed public posts (`getUnemailedPublicPosts`) | API / Backend (`packages/core` — `NologClient`) | Database / Storage (Notion query engine evaluates the compound filter) | `NologClient` owns all Notion I/O; the filter logic (what counts as "unemailed") is business logic that belongs in the class, not duplicated by callers |
| Mark post emailed (`markEmailed`) | API / Backend (`packages/core` — `NologClient`) | Database / Storage (Notion page property is the durable state) | Same reasoning — the write plus its error interpretation (403 vs. other) is backend logic; Notion itself is just the datastore, no business logic lives there |
| Missing-schema / missing-capability error typing (D-01, D-03) | API / Backend (`packages/core`) | — | Error classification must happen at the point closest to the raw HTTP response (inside `NologClient`), so downstream callers (Phase 4's notify route, not built yet) receive an already-typed error rather than re-parsing raw Notion responses themselves |
| `Post.emailed` field exposure | API / Backend (`packages/core/src/types.ts`) → re-exported to Frontend Server (`apps/web/src/types/index.ts`) | — | Existing duplicate-type pattern (flagged as pre-existing tech debt in `.planning/codebase/ARCHITECTURE.md`); this phase only adds a field, doesn't need to resolve the duplication, but the planner should decide whether to fix it opportunistically since it touches the same file |

## Standard Stack

### Core

No new dependencies. This phase uses only what's already installed and already in use by `NologClient`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `@notionhq/client` | `^5.20.0` (installed; `5.23.2` is current on npm registry `[VERIFIED: npm registry]`) | Type imports only (`PageObjectResponse`) — actual HTTP calls in this class use raw `fetch()`, not the SDK, per the existing documented workaround for inline-database bugs | Already the project's sole Notion dependency; this phase adds zero new write-specific SDK usage — `patchPage()` continues the existing raw-`fetch()` convention rather than switching to `notion.pages.update()` |

No installation step needed for this phase — do not add packages.

### Supporting
None. This phase is pure TypeScript logic inside an existing file.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `fetch()` PATCH via `patchPage()` (recommended) | `this.notion.pages.update({ page_id, properties })` (SDK method, already available since `Client` is instantiated in the constructor) | The SDK method is simpler code, but breaks the file's established "bypass SDK for query/page endpoints, raw fetch only" convention (documented reason: SDK v5.20 bugs on inline databases — the constructor comment and `.planning/codebase/ARCHITECTURE.md`'s Anti-Patterns section calls this out explicitly). Mixing SDK calls and raw-fetch calls for what's conceptually the same "page I/O" surface would be an inconsistency future maintainers would have to puzzle over. Stick with raw `fetch()` for `patchPage()` too. |
| Custom `Error` subclasses for D-01/D-03 (recommended) | Plain object with a `code`/`type` discriminant field, thrown or returned | The codebase's own documented error-handling convention (`.claude/CLAUDE.md`) is `instanceof Error` checks (`error instanceof Error ? error.message : String(error)`), used consistently across the existing codebase. A custom `Error` subclass composes naturally with that pattern (`instanceof NotionCapabilityError`) and still carries a `.message`; a plain object would require callers to abandon the `instanceof Error` idiom just for this one case. |

**Installation:**
```bash
# No installation required — this phase adds zero new dependencies.
```

**Version verification:** `@notionhq/client` — installed at `^5.20.0` per `packages/core/package.json`; registry current is `5.23.2` (checked via `npm view @notionhq/client version`, 2026-07-24) `[VERIFIED: npm registry]`. No version bump is required or recommended for this phase — the class doesn't use any new SDK surface, only raw REST calls that are Notion-API-version-driven (see `NOTION_VERSION` constant), not SDK-version-driven.

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** No `npm install` occurs; all work is additions to existing files in `packages/core/src/`. Skip the Package Legitimacy Gate protocol; there is nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                packages/core/src/client.ts — NologClient            │
│                                                                        │
│  (existing, unchanged)                                                │
│  getPosts() ──────┐                                                   │
│  getPost()  ──────┼──▶ queryDatabase() ──▶ fetch(POST /databases/     │
│  getCategories()  │                          {id}/query)              │
│  getBlocks()      │                                                   │
│                    │                                                   │
│  (NEW this phase)  │                                                   │
│  getUnemailedPublicPosts() ─▶ queryDatabase()  (reused, same helper,  │
│                                 new compound `and` filter clause)      │
│                                     │                                  │
│                                     ▼                                  │
│                              mapPageToPost() (extended: + emailed)     │
│                                                                        │
│  markEmailed(pageId) ──▶ patchPage(pageId, {Emailed:{checkbox:true}}) │
│                              │                                         │
│                              ▼                                        │
│                     fetch(PATCH /pages/{id})                          │
│                              │                                         │
│                    ┌─────────┴──────────┐                             │
│                    ▼                    ▼                             │
│              res.ok (200)         res.status === 403                  │
│                    │                    │                              │
│                    ▼                    ▼                             │
│              return (success)   throw NotionCapabilityError           │
│                                  (distinguishable, instanceof-checkable)│
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                  Notion REST API (api.notion.com/v1)
        /databases/{id}/query (POST)     /pages/{id} (PATCH)
```

No consumer for `getUnemailedPublicPosts()`/`markEmailed()` exists yet in `apps/web` — this phase delivers the contract only, per `.planning/research/ARCHITECTURE.md`'s Suggested Build Order (Phase 4's notify route and Phase 2's backfill script are the future callers).

### Recommended Project Structure

No new files. Only `packages/core/src/client.ts` and `packages/core/src/types.ts` change.

```
packages/core/src/
├── client.ts     # EXTEND: + patchPage() (private), + markEmailed(), + getUnemailedPublicPosts()
│                 #         + getCheckbox() extractor, + error classes (NotionCapabilityError, MissingPropertyError or similar)
├── types.ts      # EXTEND: + emailed: boolean field on Post interface
└── index.ts      # verify barrel export still covers everything (likely already `export *` from client.ts/types.ts — confirm, no change expected)
```

### Pattern 1: Extend `NologClient` with a `patchPage()` write helper mirroring `queryDatabase()`

**What:** Add a private `patchPage(pageId, properties)` helper that issues `PATCH https://api.notion.com/v1/pages/{pageId}` using the same `getNotionHeaders()` and `fetchOptions` spread as `queryDatabase()`. Add `markEmailed(pageId)` (public) that calls it with `{ Emailed: { checkbox: true } }`, and `getUnemailedPublicPosts()` (public) that calls the existing `queryDatabase()` with an added compound filter.

**When to use:** Any time a new Notion operation targets the same resource/auth as existing methods on this class — which is the case for 100% of this phase's scope.

**Verified checkbox PATCH body shape** (confirmed 2026-07-24 against Notion's current API reference, not assumed — see Sources):
```typescript
// PATCH https://api.notion.com/v1/pages/{pageId}
// Verified body shape — the "type" key is NOT required for writes
// (Notion's write-path convention differs slightly from its read/response shape,
// which does include "type" and "id" — those are server-managed, read-only fields).
{
  "properties": {
    "Emailed": {
      "checkbox": true
    }
  }
}
```

**Verified compound filter shape** for `getUnemailedPublicPosts()` (confirmed 2026-07-24):
```typescript
// POST https://api.notion.com/v1/databases/{databaseId}/query
{
  "page_size": 100,
  "sorts": [{ "timestamp": "created_time", "direction": "ascending" }],
  "filter": {
    "and": [
      { "property": "status", "select": { "equals": "public" } },
      { "property": "Emailed", "checkbox": { "equals": false } }
    ]
  }
}
```

**Codebase-specific gotcha (not a generic Notion fact):** the *existing* `getPosts()` filter uses the property key `"status"` (lowercase) — `{ property: "status", select: { equals: "public" } }` — while `mapPageToPost()`'s extractor reads `getSelect(page, "Status", "status")` (capital-S primary, lowercase fallback). This means the actual production Notion database's status property is very likely named lowercase `status`, and any new filter must match that exact, case-sensitive key — Notion's query API does not fuzzy-match or fall back on property name casing the way the extractor helper functions do internally. **Do not assume `"Status"` (capital) is correct for the filter clause — mirror the exact string `getPosts()` already uses (`"status"`).** The new `Emailed` property has no such ambiguity since it's a brand-new property with a name the user/README will instruct forkers to create exactly as `Emailed` (capital E, per D-01's example error message and the canonical architecture doc).

**Trade-offs:**
- *For:* Zero new auth/header/fetch code; matches the file's own `// ─── Mutations ───` banner convention already scoped in `.planning/research/ARCHITECTURE.md`.
- *Against:* None significant — this is the file's own established internal pattern, not a new one being introduced.

**Example — full implementation with typed errors:**
```typescript
// packages/core/src/client.ts

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Thrown when the Notion integration lacks "Update content" capability (403). */
export class NotionCapabilityError extends Error {
  constructor(pageId: string, notionMessage: string) {
    super(
      `Notion write failed for page ${pageId}: integration lacks "Update content" ` +
      `capability. Grant it in your Notion integration's Developer Portal settings. ` +
      `(Notion said: ${notionMessage})`
    );
    this.name = "NotionCapabilityError";
  }
}

/** Thrown when the `Emailed` checkbox property is missing from the database schema. */
export class MissingEmailedPropertyError extends Error {
  constructor(notionMessage: string) {
    super(
      `Emailed property not found on this database — add it in Notion first ` +
      `(Settings → add a Checkbox property named "Emailed"). See README. ` +
      `(Notion said: ${notionMessage})`
    );
    this.name = "MissingEmailedPropertyError";
  }
}

// ─── Mutations ──────────────────────────────────────────────────────────────

private async patchPage(pageId: string, properties: Record<string, unknown>): Promise<void> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: this.getNotionHeaders(),
    body: JSON.stringify({ properties }),
    ...this.fetchOptions,
  });

  if (!res.ok) {
    const bodyText = await res.text();
    if (res.status === 403) {
      throw new NotionCapabilityError(pageId, bodyText);
    }
    if (res.status === 400 && /Emailed/i.test(bodyText) && /propert/i.test(bodyText)) {
      // NOTE: exact Notion error text for "property not found on this schema" is
      // NOT confirmed in official docs (see Open Questions) — this pattern-match
      // must be validated against a real Notion workspace during execution
      // (temporarily remove the Emailed property, attempt a write, inspect the
      // actual error body) before trusting this branch in production.
      throw new MissingEmailedPropertyError(bodyText);
    }
    throw new Error(`Notion patch failed: ${res.status} ${bodyText}`);
  }
}

public async markEmailed(pageId: string): Promise<void> {
  await this.patchPage(pageId, { Emailed: { checkbox: true } });
}

public async getUnemailedPublicPosts(): Promise<Post[]> {
  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: "created_time", direction: "ascending" }], // oldest-first
    filter: {
      and: [
        { property: "status", select: { equals: "public" } }, // match getPosts()'s exact casing
        { property: "Emailed", checkbox: { equals: false } },
      ],
    },
  };

  const pages: PageObjectResponse[] = [];
  let cursor: string | null = null;

  try {
    do {
      const response = await this.queryDatabase({
        ...body,
        ...(cursor ? { start_cursor: cursor } : {}),
      });
      pages.push(...response.results.filter(isPageObjectResponse));
      cursor = response.next_cursor;
    } while (cursor);
  } catch (err) {
    if (err instanceof Error && /Emailed/i.test(err.message) && /propert/i.test(err.message)) {
      // Same caveat as above — validate the actual Notion error text before trusting this.
      throw new MissingEmailedPropertyError(err.message);
    }
    throw err;
  }

  return pages.map(mapPageToPost);
}
```

**Checkbox extractor (for `mapPageToPost`):**
```typescript
// packages/core/src/client.ts — Property extractors section

function getCheckbox(page: PageObjectResponse, key: string): boolean {
  const prop = page.properties[key];
  if (prop?.type === "checkbox") {
    return prop.checkbox;
  }
  return false; // absent on a per-page basis (e.g. property exists but unset) defaults false — NOT the same as D-01's schema-missing case, which is caught earlier at the query/patch level
}

// in mapPageToPost():
emailed: getCheckbox(page, "Emailed"),
```

Note the distinction this extractor deliberately preserves: `getCheckbox()` returning `false` for a page where the property genuinely doesn't exist in `page.properties` is fine and expected (mirrors every other extractor's "never throws, return typed default" convention) — this is different from D-01's requirement, which is about the *database schema itself* lacking the property (detected at the query/patch call site, not the per-page mapper). Do not conflate the two: the mapper's job is per-page graceful degradation (existing convention, unchanged); D-01's fail-loud behavior belongs in `getUnemailedPublicPosts()`/`patchPage()`, not in `getCheckbox()`.

### Pattern 2: Notion API version — reuse the existing pinned constant unchanged

**What:** The file already defines `const NOTION_VERSION = "2022-06-28"` and applies it via `getNotionHeaders()` to every request. The new `patchPage()` call must use this same constant/header helper — do not introduce a different `Notion-Version` for the new endpoint.

**When to use:** Always, for this phase. Notion's current documented latest API version is newer (see State of the Art below), but there is no reason to bump it here: (a) it would create an inconsistency where some calls use one version and others use another within the same class, (b) checkbox property read/write shape has not changed between `2022-06-28` and Notion's current version — verified via the live doc lookup in this research session — and (c) bumping the pinned version is a cross-cutting change that affects every existing method (`getPosts`, `getPost`, `getBlocks`), not something this phase's scope should quietly do as a side effect.

**Why this matters:** Notion's own docs note that `@notionhq/client` v5.0.0+ dropped *SDK* support for `2022-06-28`, but the *REST API itself* continues to support older versions with no stated deprecation timeline `[CITED: developers.notion.com/reference/versioning]`. Since this class calls the REST API directly via `fetch()` (not through the SDK for query/page endpoints), the SDK's version-support statement doesn't apply to `patchPage()`/`queryDatabase()` at all — only to `getBlocks()`, which does go through `this.notion.blocks.children.list()` (pre-existing, out of scope for this phase).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting "is this a 403 due to missing capability" | Custom string-matching on arbitrary error text as the primary signal | `res.status === 403` as the primary, reliable signal; treat the response body's `code: "restricted_resource"` field as a secondary confirmation, not the trigger | HTTP status code is the layer Notion itself documents as authoritative for this distinction `[CITED: developers.notion.com/reference/errors]`; string-matching the message is fragile to wording changes |
| Retrying/backing off on 429 inside `markEmailed()`/`getUnemailedPublicPosts()` | Any retry-with-backoff logic in this phase | Nothing — explicitly out of scope. Rate-limit handling belongs to the backfill script (Phase 2, `DATA-03`), which is the actual high-volume write burst. This phase's methods are called once per post, well under Notion's ~3 req/s average limit for any realistic single-post-at-a-time cron/manual-test usage. | Building throttling logic here duplicates Phase 2's explicit, already-scoped responsibility and adds untested surface area this phase's success criteria don't require |
| A generic "Notion error" taxonomy/class hierarchy for all possible Notion error codes | A broad `NotionError` base class with subclasses for every documented error code (`validation_error`, `rate_limited`, `conflict_error`, etc.) | Exactly two new error classes, scoped to exactly the two cases this phase's locked decisions (D-01, D-03) require | Premature abstraction — this phase has exactly two "fail loud" cases specified by the user; a generic taxonomy is a bigger surface than the requirements ask for and nothing downstream (yet) needs to catch any other Notion error type distinctly |

**Key insight:** This phase's entire scope is "make two specific failure modes distinguishable, keep everything else exactly as graceful-degradation as before." Resist building anything more general than that — the existing codebase's error-handling convention (`.planning/codebase/ARCHITECTURE.md`: "graceful degradation + try/catch at page level") is intentionally *not* being replaced wholesale; only these two paths are a deliberate, scoped exception.

## Common Pitfalls

### Pitfall 1: Treating the 403 check as string-matching instead of status-code-first

**What goes wrong:** A `markEmailed()` implementation that inspects `res.statusText` or greps the response body text for "capability" or "restricted" as its primary detection mechanism will break silently if Notion ever rewords their error message, while still returning the same reliable `403` status code.

**Why it happens:** It's tempting to write descriptive detection logic that "reads well" in code review, but the stable contract Notion documents is the status code + `code` field, not message wording.

**How to avoid:** Check `res.status === 403` first (this alone is sufficient per Notion's docs — a 403 on this specific endpoint, for a request otherwise well-formed with a valid token, always means the capability/permission issue). Only use the response body's `code`/`message` fields to enrich the thrown error's message for human readability, never as the branching condition itself.

**Warning signs:** Code review shows `.includes("restricted")` or similar substring checks as the *only* gate before throwing the typed error.

### Pitfall 2: Conflating D-01 (schema-missing) with a per-page missing-property case

**What goes wrong:** Writing `getCheckbox()` to throw when a single page doesn't have the `Emailed` property populated (which is normal for pages created before the property existed, or is simply an unset default in Notion's UI) would incorrectly throw on every legitimately-not-yet-set post, defeating the entire feature — every unemailed post *should* just read as `emailed: false`.

**Why it happens:** It's easy to reach for "throw if missing" everywhere once D-01 establishes that pattern is wanted *somewhere* in this phase, without noticing D-01 is specifically about the *database schema* lacking the property entirely (a one-time setup error), not about any individual page's property value.

**How to avoid:** Keep `getCheckbox()` in the "never throws, return typed default" extractor family (matches every other extractor in the file). Put the fail-loud detection only in `getUnemailedPublicPosts()`/`markEmailed()`'s error-handling path, triggered by the query/patch call itself failing — not by any per-page mapper logic.

**Warning signs:** `getPosts()` (the existing, unrelated read path) starts throwing for pages that predate the `Emailed` property's creation — a clear sign the schema-missing check leaked into the wrong layer.

### Pitfall 3: Assuming the exact wording/shape of Notion's "property not found on schema" error without verifying

**What goes wrong:** Notion's public error-reference documentation does not specify the precise error shape returned when a database query filter (or a PATCH properties body) references a property key that was never created in that database's schema at all — this is genuinely unconfirmed (see Open Questions). Shipping `MissingEmailedPropertyError` detection logic based on an assumed message format risks either false negatives (the real Notion error doesn't match the assumed pattern, so it falls through to the generic `Error` instead of the friendly D-01 message) or false positives (some unrelated 400 error happens to mention "Emailed" and gets misclassified).

**Why it happens:** Official docs document the general 400 `validation_error` category but don't enumerate every specific message string Notion's API produces for every specific misconfiguration.

**How to avoid:** Before considering this phase done, manually verify against a real Notion workspace: temporarily rename or remove the `Emailed` property from the test database, call `getUnemailedPublicPosts()` and `markEmailed()`, and inspect the *actual* error status code and message text returned. Adjust the detection regex/condition in `patchPage()`/`getUnemailedPublicPosts()` to match what Notion genuinely returns, not what this research assumed. This mirrors exactly the same verification discipline the phase's own success criteria already require for the 403 case ("confirmed by temporarily revoking that capability and observing the log output") — apply the identical technique to the missing-property case.

**Warning signs:** `MissingEmailedPropertyError` never fires in manual testing even after removing the property (the pattern-match missed the real error text), or fires on unrelated errors (over-broad pattern match).

### Pitfall 4: Rebuilding `packages/core` after editing `src/` before testing from `apps/web` (or a standalone test script)

**What goes wrong:** `packages/core`'s `package.json` points `main`/`module`/`types` at `dist/`, built via `tsup`. Editing `client.ts`/`types.ts` and immediately trying to exercise the new methods from `apps/web` (or any consumer) without rebuilding will silently run against the *old* compiled `dist/` output — the new methods will appear to not exist, or throw "not a function," which looks like a code bug but is actually a stale-build issue.

**Why it happens:** This is a known, already-documented gotcha in `.planning/research/ARCHITECTURE.md`'s "Internal Boundaries" section — flagged there specifically because this phase (the one adding `markEmailed`/`getUnemailedPublicPosts`) is exactly the first phase this will bite.

**How to avoid:** Run `npm run build --workspace=@4lph4/nolog-core` (or `npm run dev` with `--watch` from `packages/core`) after any edit to `src/client.ts`/`src/types.ts`, before manually verifying behavior (e.g., before running the mark-then-requery test this phase's success criteria call for).

**Warning signs:** "Method does not exist" or "property does not exist on type" errors that persist even though the source code clearly has the method — check whether `dist/` was rebuilt.

## Code Examples

### Manual verification: mark-then-requery test (phase's own success criterion #1)

```typescript
// One-off manual verification script (not a unit test — no test framework exists in this repo,
// per REQUIREMENTS.md's explicit "Adding a test framework" out-of-scope item).
// Run via `npx tsx` or `node --loader tsx` from packages/core, against a real Notion workspace.

import { NologClient } from "./src/client";

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});

async function main() {
  const before = await client.getUnemailedPublicPosts();
  console.log(`Before: ${before.length} unemailed public posts`);
  if (before.length === 0) {
    console.log("No unemailed posts to test against — publish a test post first.");
    return;
  }

  const target = before[0];
  console.log(`Marking page ${target.id} ("${target.title}") as emailed...`);
  await client.markEmailed(target.id);

  const after = await client.getUnemailedPublicPosts();
  const stillPresent = after.some((p) => p.id === target.id);
  console.log(
    stillPresent
      ? "FAIL: post still appears in getUnemailedPublicPosts() after markEmailed()"
      : "PASS: post correctly excluded after markEmailed()"
  );
}

main();
```

### Manual verification: 403 capability test (phase's own success criterion #4)

```typescript
// Run this AFTER temporarily removing "Update content" capability from the
// Notion integration in the Developer Portal (Settings → Capabilities).
import { NologClient, NotionCapabilityError } from "./src/client";

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});

async function main() {
  const posts = await client.getUnemailedPublicPosts(); // read still works (capability unaffected)
  try {
    await client.markEmailed(posts[0].id);
    console.log("FAIL: expected a NotionCapabilityError, write succeeded instead");
  } catch (err) {
    if (err instanceof NotionCapabilityError) {
      console.log("PASS:", err.message);
    } else {
      console.log("FAIL: wrong error type thrown:", err);
    }
  }
}

main();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Notion API version `2022-06-28` (this repo's current pin) | Notion's latest documented API version is `2026-03-11` `[CITED: developers.notion.com/reference/versioning]` | Ongoing — Notion ships dated API versions periodically | No action needed for this phase (see Pattern 2) — checkbox shape is unaffected across these versions, verified directly. Flag as a possible *future*, separate modernization task, not part of this phase's scope. |

**Deprecated/outdated:** None relevant to this phase's scope — the checkbox property type and compound `and` filter syntax used here are foundational, stable Notion API primitives, not a deprecated pattern.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The exact error status/message Notion returns when a filter or PATCH references a property name absent from the database schema (D-01's trigger case) is not confirmed by official docs and is pattern-matched on a best-guess basis in the Code Examples above | Pattern 1 (`patchPage`/`getUnemailedPublicPosts` error handling), Pitfall 3 | `MissingEmailedPropertyError` may never fire (falls through to a generic `Error` instead) or may misfire on an unrelated 400 error — must be manually verified against a real Notion workspace before considering D-01 done, exactly as the phase's own success criteria already mandate for the 403 case |
| A2 | The Notion checkbox PATCH write body should omit the `"type": "checkbox"` key (verified as optional/redundant per one live doc source, but a second live doc source showed an example including it) | Pattern 1 (verified checkbox PATCH body shape) | Low risk — Notion's API is very likely to accept the body with or without the `type` key (the field is documented as server-managed/read-only on the response side); if wrong, the fix is a one-line body-shape change caught immediately by the phase's own mark-then-requery manual test |

## Open Questions

1. **What exact error shape does Notion return for a query/patch referencing a property name absent from the schema entirely?**
   - What we know: Notion's general error-reference docs describe a 400 `validation_error` category for malformed requests, with the specific message left to the `message` field per-error; no documented example covers "property key does not exist on this database" specifically.
   - What's unclear: Whether it's reliably a 400 `validation_error`, what the message text pattern looks like, and whether query-filter errors and PATCH-properties errors on a missing property produce the same shape.
   - Recommendation: Treat this as a required manual-verification task during execution (Pitfall 3) — temporarily remove the `Emailed` property from a real test database, observe the actual response, and adjust the detection condition to match reality rather than shipping the best-guess pattern-match in this research's Code Examples unverified.

2. **Should `packages/core/src/index.ts`'s barrel export need updating to export the new error classes?**
   - What we know: The file wasn't read in this research pass (not flagged as needing changes in `.planning/research/ARCHITECTURE.md`'s Recommended Project Structure, which states "barrel export — no change needed if methods are on `NologClient`").
   - What's unclear: Whether `NotionCapabilityError`/`MissingEmailedPropertyError` need to be exported from the package's public surface for a future consumer (Phase 4's notify route) to `instanceof`-check them, or whether they can stay as named exports from `client.ts` picked up transitively by a wildcard barrel export.
   - Recommendation: The planner should have the executing agent read `packages/core/src/index.ts` directly (one file, low cost) before finalizing the plan's file list — if it's `export * from "./client"` / `export * from "./types"`, no change is needed; if it's an explicit named-export list, both error classes must be added to it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Running manual verification scripts (`tsx`) and `npm run build` | ✓ | v22.23.1 | — |
| `npm` workspaces | Building `packages/core` after edits | ✓ | present (monorepo root `package.json`) | — |
| `@notionhq/client` | Type imports (`PageObjectResponse`) only | ✓ | `5.20.0` installed, `5.23.2` current on registry `[VERIFIED: npm registry]` | — |
| Live Notion workspace + integration token with "Update content" capability temporarily grantable | Manual verification of D-01/D-03 (mark-then-requery test, 403 test) | Not verifiable from this environment — requires the developer's real Notion workspace and Developer Portal access | — | None — this is a hard manual-verification requirement the phase's own success criteria already specify; cannot be automated or simulated without real Notion credentials |

**Missing dependencies with no fallback:**
- A live Notion workspace/integration for the two manual verification tests (mark-then-requery, 403 capability) — this is expected and by design; the phase's success criteria are explicitly manual, not automatable, since no test framework exists in this repo (out of scope per REQUIREMENTS.md) and Notion API behavior cannot be reliably mocked for these specific edge cases without risking divergence from real API behavior.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | none — no test framework exists in this repo; explicitly out of scope per `REQUIREMENTS.md` ("Adding a test framework to the repo... Tracked in TODOS.md") |
| Config file | none |
| Quick run command | `npx tsx packages/core/scripts/verify-phase-1.ts` (ad-hoc manual script, not a persisted test suite — see Code Examples above) |
| Full suite command | n/a — no automated suite exists |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DATA-01 | `getUnemailedPublicPosts()` returns only `status=public AND Emailed=false` posts | manual-only | none — manual mark-then-requery script (see Code Examples) run against a real Notion workspace | ❌ Wave 0 (script itself doesn't exist yet; not a persisted repo file, ad-hoc during execution) |
| DATA-02 | `markEmailed(pageId)` issues correct checkbox PATCH body, change visible on subsequent read | manual-only | same mark-then-requery script as DATA-01 | ❌ Wave 0 |
| DATA-04 | `markEmailed` logs a distinguishable 403-specific message when capability is missing | manual-only | manual 403 test script (temporarily revoke capability, observe error `instanceof NotionCapabilityError`) | ❌ Wave 0 |

**Justification for manual-only:** No test framework exists in this repo (explicit project-level decision, tracked in `TODOS.md`, out of scope for this feature). All three requirements' verification depends on live Notion API behavior (schema state, integration capability grants) that cannot be meaningfully mocked without risking the mock diverging from real API behavior — which is precisely the risk this phase's own success criteria are designed to catch (e.g., D-03 explicitly requires "confirmed by temporarily revoking that capability and observing the log output," not a unit test with a mocked 403).

### Sampling Rate
- **Per task commit:** Run the relevant manual verification script (mark-then-requery, or 403 test) against a real/test Notion workspace before considering the task done.
- **Per wave merge:** Re-run both manual scripts once all of DATA-01/02/04 are implemented together, confirming the full flow end-to-end.
- **Phase gate:** Both manual verification scripts must show PASS output before `/gsd-verify-work`; capture the console output as evidence (this repo has no CI to attach automated results to).

### Wave 0 Gaps
- [ ] Ad-hoc manual verification script for mark-then-requery (DATA-01/DATA-02) — does not need to be a committed repo file, but the plan should specify where it's written (e.g., a scratch script run via `tsx`, deleted after verification, or optionally committed under `packages/core/scripts/` if the team wants it retained for future regression checks)
- [ ] Ad-hoc manual verification script for 403 capability detection (DATA-04)
- [ ] No framework install needed — explicitly out of scope

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This phase has no user-facing auth surface — `NologClient` uses a pre-configured integration token, unchanged from existing behavior |
| V3 Session Management | No | Not applicable — no session concept in this phase |
| V4 Access Control | No | Not applicable at this layer — access control (Notion integration capability) is Notion-side configuration, not application code; this phase only *detects and reports* a capability failure, doesn't implement access control itself |
| V5 Input Validation | Yes | `pageId` passed to `markEmailed(pageId)` should remain a plain string handed off to Notion's API as-is (matches existing `getPost(pageId)` convention — no new validation library needed, template-literal URL construction is already the established pattern in this file) |
| V6 Cryptography | No | Not applicable — no crypto operations in this phase (token remains handled exactly as today, via existing `getNotionHeaders()`) |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Error messages leaking the Notion integration token or full raw response bodies into logs a forker might paste into a public GitHub issue | Information Disclosure | Ensure `NotionCapabilityError`/`MissingEmailedPropertyError` messages include Notion's response `message` text (useful for debugging) but never include `this.token` or the raw `Authorization` header — the existing `getNotionHeaders()`/`patchPage()` pattern already avoids ever logging headers, only response bodies; keep that invariant |
| Uncontrolled `pageId` string interpolated directly into a URL (`fetch(\`.../pages/${pageId}\`)`) | Tampering (if `pageId` ever originated from unsanitized external input) | Not a new risk introduced by this phase — `getPost(pageId)` already does this identically today, and `pageId` in this phase's new methods only ever originates from `NologClient`'s own prior query results (`getUnemailedPublicPosts()` → each `post.id` → passed to `markEmailed()`), never from raw user input. No change needed, but the planner should note this invariant so a future caller doesn't pass an unvalidated user-supplied `pageId` here without reconsidering this analysis. |

## Sources

### Primary (HIGH confidence)
- Direct inspection: `packages/core/src/client.ts`, `packages/core/src/types.ts`, `packages/core/package.json`, `apps/web/src/lib/notion.ts`, `apps/web/src/types/index.ts`, `.planning/config.json` (all read 2026-07-24)
- `.planning/phases/01-notion-data-layer/01-CONTEXT.md` — locked decisions D-01 through D-04
- `npm view @notionhq/client version` — confirmed `5.23.2` current on registry, `2026-07-24` `[VERIFIED: npm registry]`

### Secondary (MEDIUM confidence — live doc fetch, this session, 2026-07-24)
- https://developers.notion.com/reference/patch-page — checkbox PATCH body shape, 403 `restricted_resource`/`status_change_not_allowed` codes, current `Notion-Version` header value `[CITED]`
- https://developers.notion.com/reference/property-value-object — checkbox property value object shape (read vs. write distinction) `[CITED]`
- https://developers.notion.com/reference/errors — 403 `restricted_resource` general shape (status/code/message fields); does NOT document the missing-schema-property case (see Open Questions) `[CITED]`
- https://developers.notion.com/reference/post-database-query-filter — checkbox filter (`equals`/`does_not_equal`) and compound `and` filter shape, confirms `.planning/research/ARCHITECTURE.md`'s example is correct `[CITED]`
- https://developers.notion.com/reference/versioning — current latest API version `2026-03-11`; confirms `2022-06-28` still supported at the REST-API level even though the JS SDK v5.0+ dropped support for it `[CITED]`

### Tertiary (LOW confidence)
- None used for factual claims in this document — all Notion-specific claims were either verified via live doc fetch this session or explicitly flagged in the Assumptions Log/Open Questions as unconfirmed.

### Project-wide research already on disk (reconciled with, not re-derived)
- `.planning/research/ARCHITECTURE.md` §"Pattern 1: Extend NologClient" — confirmed and extended with verified PATCH/filter shapes and typed error classes
- `.planning/research/PITFALLS.md` §Pitfall 5 (403 capability) and §Pitfall 6 (query-after-write property-shape bug) — both directly informed this phase's error-handling design and the Open Questions/Pitfall 3 verification requirement
- `.planning/research/SUMMARY.md` §Phase 1 — confirmed this phase's manual verification step (mark, re-query, confirm exclusion) as the phase's acceptance bar

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, existing versions confirmed against npm registry directly
- Architecture: HIGH — extends an already-directly-inspected file with a pattern already validated by prior project-wide research and cross-checked against live Notion docs this session
- Pitfalls: MEDIUM-HIGH — 403/checkbox-shape pitfalls are HIGH confidence (verified live); the missing-schema-property error shape (D-01's core mechanism) is explicitly LOW confidence and flagged as a required manual-verification item, not shipped as unverified fact

**Research date:** 2026-07-24
**Valid until:** 30 days (stable domain — Notion checkbox/filter API shape is a foundational primitive unlikely to change; re-verify sooner only if Notion ships a new API version that this project adopts)
