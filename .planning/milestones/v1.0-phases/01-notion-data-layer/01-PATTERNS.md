# Phase 1: Notion Data Layer - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 2 (both modified, no new files)
**Analogs found:** 2 / 2 (self-referential — extending same file)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/core/src/client.ts` (add `patchPage`, `markEmailed`, `getUnemailedPublicPosts`, `getCheckbox`, error classes) | service/model (Notion REST client) | CRUD (read: query; write: patch) | same file — `queryDatabase()` (read helper) + `getPosts()` (read method) + `getPost()` (single-page fetch/error handling) | exact — this phase extends the exact same class with the exact same conventions |
| `packages/core/src/types.ts` (add `emailed: boolean` field) | model (type definition) | transform (Notion property → typed field) | same file — existing `Post` interface fields (e.g. `status: string`) | exact |
| `packages/core/src/index.ts` (verify only, likely no change) | config (barrel export) | n/a | same file | exact — confirmed `export * from "./client"` already covers new named exports (error classes), no edit needed |
| `apps/web/src/types/index.ts` (possible — flagged as pre-existing tech debt, not required scope) | model (duplicate type) | transform | `packages/core/src/types.ts` `Post` interface | role-match — only touch if planner decides to add `emailed` there too or collapse duplication |

## Pattern Assignments

### `packages/core/src/client.ts` — add write path (patchPage / markEmailed / getUnemailedPublicPosts / getCheckbox / error classes)

**Analog:** same file, existing methods `queryDatabase()` (lines 148-169), `getPosts()` (lines 171-195), `getPost()` (lines 197-224), and the property-extractor family (lines 28-88).

**Imports pattern** (lines 1-3) — no new imports needed, everything reused:
```typescript
import { Client } from "@notionhq/client";
import type { PageObjectResponse, BlockObjectResponse, PartialBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Post } from "./types";
```

**Auth/headers pattern** (lines 135-141) — reuse unchanged, do not duplicate or introduce a new header shape:
```typescript
private getNotionHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${this.token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}
```

**Core read/pagination pattern to mirror for `getUnemailedPublicPosts()`** (lines 171-195, `getPosts()`):
```typescript
public async getPosts(): Promise<Post[]> {
  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    filter: {
      property: "status",          // NOTE: lowercase "status" — codebase-specific, mirror exactly
      select: { equals: "public" },
    },
  };

  const pages: PageObjectResponse[] = [];
  let cursor: string | null = null;

  do {
    const response = await this.queryDatabase({
      ...body,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    pages.push(...response.results.filter(isPageObjectResponse));
    cursor = response.next_cursor;
  } while (cursor);

  return pages.map(mapPageToPost);
}
```
`getUnemailedPublicPosts()` follows this identically, just adds a compound `and` filter clause with `{ property: "Emailed", checkbox: { equals: false } }` alongside the existing `status` clause, and sorts ascending instead of descending (oldest-first, per RESEARCH.md Pattern 1).

**Write/fetch pattern to mirror for `patchPage()`** (lines 148-169, `queryDatabase()` — same fetch/header/error shape, different verb/URL):
```typescript
private async queryDatabase(body: Record<string, unknown>): Promise<NotionQueryResponse> {
  const res = await fetch(
    `https://api.notion.com/v1/databases/${this.databaseId}/query`,
    {
      method: "POST",
      headers: this.getNotionHeaders(),
      body: JSON.stringify(body),
      ...this.fetchOptions,
    }
  );

  if (!res.ok) {
    throw new Error(`Notion query failed: ${res.status} ${await res.text()}`);
  }
  ...
}
```
`patchPage(pageId, properties)` mirrors this exactly: `method: "PATCH"`, URL `https://api.notion.com/v1/pages/${pageId}`, body `{ properties }`, same `this.getNotionHeaders()` + `...this.fetchOptions` spread. This is the file's single established fetch-call shape — do not deviate.

**Error handling pattern — existing convention** (lines 197-224, `getPost()` — try/catch, swallow, return null):
```typescript
public async getPost(pageId: string): Promise<Post | null> {
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      headers: this.getNotionHeaders(),
      ...this.fetchOptions,
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Notion page failed: ${res.status} ${await res.text()}`);
    }
    ...
  } catch {
    return null;
  }
}
```
**Deliberate departure for this phase (per D-01/D-03):** `patchPage()`/`getUnemailedPublicPosts()` must NOT swallow errors like `getPost()` does. Instead, throw typed, `instanceof`-checkable error subclasses. This is an intentional, scoped exception to the codebase's swallow-everything convention — confirmed correct by CONTEXT.md and `.claude/CLAUDE.md`'s own `instanceof Error` idiom (already used elsewhere: `error instanceof Error ? error.message : String(error)`).

**New error classes** (no existing analog in this file — first custom `Error` subclasses in the package; pattern matches `.claude/CLAUDE.md`'s documented `instanceof Error` convention):
```typescript
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
```
Place these under a new `// ─── Errors ───` banner, before the new `// ─── Mutations ───` banner section, continuing the file's existing banner convention (see `// ─── Property extractors ───` line 26, `// ─── Mapper ───` line 90).

**Detection logic — status-code-first, not string-matching** (per RESEARCH.md Pitfall 1, this is new logic with no direct analog but must follow the "check `res.status` first" idiom already used at `getPost()` line 204 `if (res.status === 404)`):
```typescript
if (res.status === 403) {
  throw new NotionCapabilityError(pageId, bodyText);
}
```
The D-01 missing-schema-property detection is unverified against live Notion behavior (see RESEARCH.md Open Question 1 / Pitfall 3) — implement the best-guess pattern-match from RESEARCH.md's Code Examples section, then manually verify and adjust during execution.

**Property extractor pattern to mirror for `getCheckbox()`** (lines 46-54, `getSelect()` — shows the `(page, key, fallbackKey?)` shape, though `Emailed` needs no fallback since it's a new property):
```typescript
function getSelect(page: PageObjectResponse, key: string, fallbackKey?: string): string {
  let prop = page.properties[key];
  if (!prop && fallbackKey) prop = page.properties[fallbackKey];

  if (prop?.type === "select" && prop.select) {
    return prop.select.name;
  }
  return "";
}
```
`getCheckbox(page, key)` mirrors this shape but returns `boolean` with default `false`:
```typescript
function getCheckbox(page: PageObjectResponse, key: string): boolean {
  const prop = page.properties[key];
  if (prop?.type === "checkbox") {
    return prop.checkbox;
  }
  return false;
}
```
**Critical distinction (Pitfall 2):** `getCheckbox()` must stay in the "never throws, typed default" extractor family exactly like `getSelect`/`getRichText`/`getMultiSelect`/`getFileUrl`/`getPeople` (lines 36-88) — the D-01 fail-loud behavior belongs only in `getUnemailedPublicPosts()`/`patchPage()`'s error handling, never in this per-page mapper function.

**Mapper integration** (line 92-105, `mapPageToPost()` — add one line, matching every other field's style):
```typescript
export function mapPageToPost(page: PageObjectResponse): Post {
  return {
    id: page.id,
    title: getTitle(page),
    summary: getRichText(page, "Summary", "summery"),
    thumbnail: getFileUrl(page, "Thumbnail", "thumbnail"),
    category: getSelect(page, "Category", "category"),
    tags: getMultiSelect(page, "Tag", "tag"),
    author: getPeople(page, "Author", "author") || getRichText(page, "Author", "author"),
    createDate: page.created_time,
    editDate: page.last_edited_time,
    status: getSelect(page, "Status", "status"),
    emailed: getCheckbox(page, "Emailed"),   // NEW
  };
}
```

---

### `packages/core/src/types.ts` — add `emailed: boolean` field

**Analog:** same file, existing `status: string` field (lines 33-34), including its JSDoc comment style.

**Field-definition pattern to mirror** (lines 33-34):
```typescript
/** Publication status from the `Status` (select) property — "public" etc. */
status: string;
```
New field:
```typescript
/** Whether a "public" post has already had its one-time subscriber notification sent — from the `Emailed` (checkbox) property. Once true, stays true permanently (see Phase 1 D-02). */
emailed: boolean;
```
Every field in this interface has a one-line JSDoc naming the source Notion property and its type — follow this exactly (see lines 9, 12, 15, 18, 21, 24, 27, 30, 33 for the pattern).

---

### `packages/core/src/index.ts` — barrel export (verification only)

**Analog:** same file (2 lines total).

**Current content** (lines 1-2):
```typescript
export * from "./types";
export * from "./client";
```
**Confirmed:** this is a wildcard barrel export, not an explicit named-export list (resolves RESEARCH.md Open Question 2). `NotionCapabilityError` and `MissingEmailedPropertyError`, once declared as named exports in `client.ts`, are automatically re-exported — **no edit needed to this file.**

---

## Shared Patterns

### Fetch + Header Construction
**Source:** `packages/core/src/client.ts` lines 135-141 (`getNotionHeaders()`), reused unchanged by both `queryDatabase()` (line 148) and `patchPage()` (new).
```typescript
headers: this.getNotionHeaders(),
...this.fetchOptions,
```
**Apply to:** `patchPage()` — no new header logic, no new `Notion-Version` value.

### Error Handling — Two Regimes Coexist Deliberately
**Source A (existing, unchanged):** `packages/core/src/client.ts` lines 221-223 — `getPost()`'s catch-and-return-null.
**Source B (new, scoped exception):** typed `Error` subclasses (`NotionCapabilityError`, `MissingEmailedPropertyError`), status-code-first detection (`res.status === 403`).
**Apply to:** Regime A stays as-is for all pre-existing read methods (`getPosts`, `getPost`, `getCategories`, `getBlocks`) — do not touch. Regime B applies only to the two new write/D-01 paths (`patchPage`, `getUnemailedPublicPosts`'s schema-check). Do not let Regime B leak into `getCheckbox()` or any other per-page extractor (Pitfall 2).

### Property Extractor Family
**Source:** `packages/core/src/client.ts` lines 46-54 (`getSelect`), representative of the whole family (lines 28-88).
**Apply to:** `getCheckbox()` — same `(page, key, fallbackKey?)` signature shape (fallback omitted here since unneeded), same "return typed default, never throw" contract.

### Banner Convention
**Source:** `packages/core/src/client.ts` line 26 `// ─── Property extractors ───`, line 90 `// ─── Mapper ───`.
**Apply to:** Add `// ─── Errors ───` before the new error classes and `// ─── Mutations ───` before `patchPage()`/`markEmailed()`/`getUnemailedPublicPosts()`, continuing the existing section-divider style exactly (em-dash padding, section name, trailing dashes).

## No Analog Found

None — this phase is a pure extension of an already fully-inspected file (`client.ts`) and its sibling `types.ts`/`index.ts`; every new piece has a directly analogous existing pattern in the same files.

## Metadata

**Analog search scope:** `packages/core/src/` (client.ts, types.ts, index.ts) — no broader codebase search needed since RESEARCH.md and CONTEXT.md already identified this as a single-file-family extension with zero new architectural surface.
**Files scanned:** 3 (`client.ts`, `types.ts`, `index.ts`)
**Pattern extraction date:** 2026-07-24
