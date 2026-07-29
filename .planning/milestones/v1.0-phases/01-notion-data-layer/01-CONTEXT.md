# Phase 1: Notion Data Layer - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

> ⚠ **CORRECTION (2026-07-25):** Everywhere below this line writes `Emailed` (capital E), read it as `emailed` (lowercase) — standardized to match the live database's confirmed lowercase-camelCase property convention (`title`, `summary`, `status`, `category`, `tag`, `author`). This doc's body is left as originally gathered; see `packages/core/src/client.ts` for the corrected code and `01-VERIFICATION.md`'s `## CORRECTION` section for the full account.

<domain>
## Phase Boundary

`NologClient` (in `packages/core/src/client.ts`) can identify which public posts haven't been emailed yet and durably mark a post as emailed once a send succeeds, with a missing "Update content" capability (403) distinguishable in code from other failures. This phase adds the data layer only — no route handlers, no email sending, no subscribe form. It also covers the lifecycle rules for the new `Emailed` Notion property (what happens when it's missing from the schema, and what happens across unpublish/republish cycles).

Requirements covered: DATA-01, DATA-02, DATA-04 (see `.planning/REQUIREMENTS.md`).

</domain>

<decisions>
## Implementation Decisions

### Missing `Emailed` property on the Notion database

- **D-01:** If the Notion database schema doesn't have the `Emailed` checkbox property yet (e.g. an existing fork upgrading to this feature), `getUnemailedPublicPosts()`/`markEmailed()` must fail loud and clear — throw a specific, clearly-worded error (e.g. "Emailed property not found on this database — add it in Notion first, see README") rather than letting Notion's raw API error propagate unexplained or silently no-op. — **Reversibility:** reversible — this is error-message wording/detection logic, not a data shape; changing it later touches only this one check.

### Unpublish/republish lifecycle

- **D-02:** Once a post's `Emailed` checkbox is set to true, it stays true permanently — unpublishing (`Status` away from `public`) and later republishing the same post does NOT reset `Emailed` and does NOT trigger a second notification. A post notifies subscribers at most once, ever, regardless of how many times it's unpublished/republished. — **Reversibility:** costly — reversing this later (making republish reset `Emailed`) requires new logic to detect the public→private→public transition, since nothing tracks that transition today; retrofitting it onto already-emailed posts would need a decision about what to do with the existing back catalog's `Emailed` state.

### 403 (missing "Update content" capability) diagnostics

- **D-03:** `markEmailed()` must throw a typed/distinguishable error (not a generic `Error`, and not just a tagged `console.error`) when the Notion API returns 403 for the write. The specific shape (custom error class vs. a `code` field on a plain object) is left to the planner/executor, but it MUST be a shape a caller can `catch` and branch on programmatically — this is what lets Phase 4's notify route log this failure distinctly and avoid silently repeating the duplicate-email-storm failure mode described in `.planning/research/PITFALLS.md` Pitfall 5. — **Reversibility:** reversible — an error shape is a local implementation detail; Phase 4 hasn't been built yet, so there's no external contract to break by adjusting it later.

### Emailed Date property

- **D-04:** Do NOT add a second Notion property for "when a post was emailed." Only the `Emailed` checkbox (already scoped in REQUIREMENTS.md DATA-02) is written. No timestamp property, no extra field on the `patchPage()` call. — **Reversibility:** reversible — purely additive if wanted later; skipping it now doesn't foreclose adding it in a future phase.

### Claude's Discretion
None — all four areas got explicit decisions, no "you decide" answers.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design & Requirements
- `.planning/REQUIREMENTS.md` §Data Layer (DATA) — DATA-01, DATA-02, DATA-04, the exact requirement wording this phase must satisfy
- `.planning/PROJECT.md` — Constraints (fail-closed theme), Key Decisions table
- `.planning/ROADMAP.md` §Phase 1 — Goal and Success Criteria this phase's plan must satisfy

### Research (this session, 2026-07-24)
- `.planning/research/ARCHITECTURE.md` §"Pattern 1: Extend `NologClient`" — the exact `patchPage()`/`markEmailed()`/`getUnemailedPublicPosts()` shape already researched, including the sample Notion `checkbox` PATCH body
- `.planning/research/PITFALLS.md` §Pitfall 5 ("Missing Notion 'Update content' capability... causes a duplicate-email storm, not a no-op") — the direct motivation for D-03
- `.planning/research/PITFALLS.md` §Pitfall 6 ("query-after-write... property-shape bug mistaken for consistency lag") — verify the exact Notion `checkbox` PATCH body shape against Notion's current API reference before writing `markEmailed()`; don't assume
- `.planning/research/SUMMARY.md` §Phase 1 — the phase's own research-flagged verification step (mark a post, immediately re-query, confirm exclusion)

### Existing Codebase
- `packages/core/src/client.ts` — `NologClient` class to extend; existing private `queryDatabase()` helper (mirror its pattern for a new `patchPage()`); existing `getPosts()` shows the exact do/while pagination + filter shape to extend with an `Emailed` clause
- `packages/core/src/types.ts` — `Post` interface; needs an `emailed: boolean` field added, mapped in `mapPageToPost()`
- `.planning/codebase/ARCHITECTURE.md` §"Error Handling" — existing convention is "graceful degradation + try/catch at page level," `getPost()` catches and returns `null` on any error today — this phase's typed-error requirement (D-03) is a deliberate departure from that existing swallow-everything convention, not an extension of it

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NologClient.queryDatabase(body)` (private, `packages/core/src/client.ts`) — existing REST query helper with auth headers and error handling; `getUnemailedPublicPosts()` should call this with an added `Emailed: {checkbox: {equals: false}}` filter clause, not duplicate the fetch logic
- `NologClient.getPosts()`'s do/while cursor-pagination loop — exact pattern to mirror for `getUnemailedPublicPosts()`
- `mapPageToPost()` — existing property-extraction mapper; needs a new `getCheckbox()`-style extractor added for the `Emailed` property, following the existing `getSelect`/`getMultiSelect`/`getFileUrl` extractor pattern (each already has a fallback-key parameter for typo tolerance, e.g. `getRichText(page, "Summary", "summery")` — not needed for `Emailed` since it's a new property with no legacy typo to handle)

### Established Patterns
- Every existing property extractor function takes `(page, key, fallbackKey?)` and returns a typed default on absence (empty string, empty array, null) — never throws. **This phase's `Emailed`-missing-property handling (D-01) is an intentional exception to that pattern** — the property being entirely absent from the schema (not just absent on one page) is a setup error, not a per-page data variance, so it should throw rather than default.
- `getNotionHeaders()` (private) — reused by any new fetch call, including the new `patchPage()`.
- File already has a `// ─── Property extractors ───` and `// ─── Mapper ───` banner convention; research recommends adding a new `// ─── Mutations ───` banner for the new write methods — continues the existing convention rather than introducing a new one.

### Integration Points
- `Post` type (`packages/core/src/types.ts`) is consumed by `apps/web/src/lib/notion.ts` and re-exported (currently duplicated, not re-exported — see `.planning/codebase/ARCHITECTURE.md`'s "Duplicate Post Type Definition" anti-pattern) at `apps/web/src/types/index.ts`. Adding `emailed: boolean` to the core `Post` type means both copies need the field, or the duplication should finally be collapsed to a re-export — flagged for the planner to decide, not re-litigated with the user here (it's a pre-existing tech-debt item, not part of this phase's scope, but touches the same file).
- No page component currently needs `getUnemailedPublicPosts()` — per research, it must NOT be wrapped in `apps/web/src/lib/notion.ts`'s `cache()` the way `getPosts` is, since the cron route needs the true current state, not a request-deduped snapshot. If exposed through `lib/notion.ts` at all, export as a plain `async function`.

</code_context>

<specifics>
## Specific Ideas

No specific UI/vision references — this is a backend-only phase. The user's stated priorities across this whole session (fail-closed over fail-open, minimal surface area, one email/notification behavior per post ever) directly shaped D-01 and D-02 above.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — all four areas stayed within Phase 1's data-layer boundary. No scope creep occurred.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 1.

</deferred>

---

*Phase: 1-Notion Data Layer*
*Context gathered: 2026-07-24*
