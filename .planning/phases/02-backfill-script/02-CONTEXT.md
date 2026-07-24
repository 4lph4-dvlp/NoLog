# Phase 2: Backfill Script - Context

**Gathered:** 2026-07-25
**Status:** Ready for planning

<domain>
## Phase Boundary

A one-time, throttled, resumable script that marks every pre-existing public post as `emailed`, so enabling the notify path (Phase 4) never blasts a fork's entire back catalog on its first cron tick. It lives in `packages/core/scripts/` alongside the existing manual verification scripts and is a forker-facing tool — every fork owner enabling this feature runs it themselves before Phase 5's production cutover, not just the template author.

Requirements covered: DATA-03 (see `.planning/REQUIREMENTS.md`).

This phase adds the script only — no changes to `NologClient` itself (`getUnemailedPublicPosts()`/`markEmailed()` already exist and are complete per Phase 1), no cron wiring (Phase 5), no README documentation (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Safety gate before writing

- **D-01:** The script supports a `--dry-run` flag that previews every post that would be marked (count + per-post title/ID) without writing anything. — **Reversibility:** reversible — a preview mode is purely additive; the write path is unaffected by adding or removing it.
- **D-02:** A live (writing) run requires no extra confirmation step beyond invoking the script without `--dry-run` — no interactive y/n prompt, no separate `--confirm` flag. `--dry-run` is the safety check; requiring a second confirmation on top was judged redundant friction. — **Reversibility:** reversible — a confirmation gate can be added later without changing the script's core write logic.
- **D-03:** `--dry-run` output shows the count AND a per-post list (titles/IDs), not just a number — lets the operator actually verify which posts are included before committing to a live run.

### Systemic-failure handling

- **D-04:** `NotionCapabilityError` (missing "Update content" capability, thrown by `markEmailed()`) aborts the entire run immediately on first occurrence, with one clear message pointing at the fix (grant the capability in the Notion integration's Developer Portal) — not logged as a per-post failure and retried on every remaining post. This is a systemic setup problem, not a per-post issue. — **Reversibility:** reversible — purely a control-flow branch in the script; doesn't touch `NologClient` or persisted state.
- **D-05:** `MissingEmailedPropertyError` (thrown by `getUnemailedPublicPosts()` before the per-post loop even starts, when the `emailed` checkbox property doesn't exist on the schema) gets the same abort-immediately treatment as D-04 — same rationale, same fix-pointing message style.
- **D-06:** Any other per-post error (network blip, unexpected Notion error — i.e., anything that isn't `NotionCapabilityError` or `MissingEmailedPropertyError`) is logged as failed and the script continues to the next post. This directly implements ROADMAP Phase 2 success criterion 1's "N marked / M failed" summary. Since `getUnemailedPublicPosts()` naturally excludes already-marked posts, a second run safely and automatically picks up only the M that failed — no separate resume/retry bookkeeping needed. — **Reversibility:** reversible — a local control-flow decision.
- **D-07:** On a 429 (rate limited) from Notion, the script retries that one post once with backoff (honoring `Retry-After` if present, else a short fixed backoff) before falling through to D-06's generic per-post failure handling if the retry also fails.
- **D-08:** The script exits with a non-zero exit code if any posts ended up in the failed bucket (M > 0) after a completed (non-aborted) run — lets a caller distinguish full success from partial failure via exit status alone, without parsing log output. Exit code is also non-zero on the D-04/D-05 abort paths.

### Throttle strategy

- **D-09:** Throttling is a fixed delay between each `markEmailed()` call (not a token-bucket rate limiter) — matches the script's serial, one-post-at-a-time processing model and keeps timing simple to verify from log timestamps (ROADMAP criterion 3 requires this).
- **D-10:** The fixed delay is 400ms per request (~2.5 req/s), giving ~17% headroom below Notion's documented ~3 req/s limit to absorb the limit's "~" imprecision and real request latency.

### Invocation & location

- **D-11:** The script lives in `packages/core/scripts/` next to `verify-phase-1.ts`/`verify-403.ts` (same convention: imports from `../dist/index.js`, requires a fresh `npm run build --workspace=@4lph4/nolog-core` first), but ALSO gets a `package.json` script entry (e.g. `backfill`) so forkers get a documented, memorable command rather than needing to know the raw `npx tsx` invocation — this script is forker-facing production tooling, not author-only manual verification, unlike its two neighbors.
- **D-12:** Flags pass through the npm script wrapper via standard `--` pass-through syntax: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`. No separate `backfill:dry-run` script entry.
- **D-13:** The script requires `NOTION_TOKEN`/`NOTION_DATABASE_ID` as already-exported shell env vars, matching `verify-phase-1.ts`/`verify-403.ts` exactly — no dotenv auto-loading of `apps/web/.env.local`. No new dependency, consistent with the established pattern.

### Claude's Discretion
- Exact log line format/verbosity for per-post progress (e.g., whether every marked post gets its own log line, or only failures + a running count) — no explicit decision was requested; follow the existing terse style in `verify-phase-1.ts`/`verify-403.ts` (plain `console.log`, PASS/FAIL-style summary lines).
- Exact wording of the abort messages for D-04/D-05 — should point at the concrete fix (grant capability / add property in Notion), mirroring the wording already in `NotionCapabilityError`/`MissingEmailedPropertyError`'s own constructor messages in `client.ts`.
- Whether the npm script name is exactly `backfill` or something more specific (e.g. `backfill-emailed`) — left to the planner, no strong preference expressed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Data Layer (DATA) — DATA-03, the exact requirement this phase must satisfy
- `.planning/ROADMAP.md` §Phase 2: Backfill Script — Goal and the 3 success criteria this phase's plan must satisfy (N marked/M failed summary, resumability, ~3 req/s rate compliance)
- `.planning/PROJECT.md` — Constraints (fail-closed theme), Key Decisions table

### Existing Codebase
- `packages/core/src/client.ts` lines 128–155, 253–288, 343–384 — `NotionCapabilityError`, `MissingEmailedPropertyError`, `getUnemailedPublicPosts()`, `markEmailed()`/`patchPage()` — the exact methods and typed errors this script calls; no changes needed here, this phase only consumes them
- `packages/core/scripts/verify-phase-1.ts` — the established manual-script convention this backfill script extends: header comment format (usage, prerequisites, what it proves), `npx tsx ... from repo root`, imports from `../dist/index.js` (NOT `../src`), requires a fresh workspace build first
- `packages/core/scripts/verify-403.ts` — same convention, second reference example; also documents the exact steps to manually trigger a 403 for testing D-04's abort path
- `packages/core/package.json` — where the new npm `backfill` script entry (D-11) gets added; existing `build`/`dev` scripts show the `--workspace=@4lph4/nolog-core` invocation pattern

### Phase 1 Context (carried forward)
- `.planning/phases/01-notion-data-layer/01-CONTEXT.md` D-02 — "once emailed, always emailed" lifecycle rule: this is precisely why the safety gate (D-01/D-02 this phase) matters — a live backfill run's `emailed` writes are permanent, there's no unpublish/republish reset to fall back on if the wrong posts get marked
- `.planning/phases/01-notion-data-layer/01-VERIFICATION.md` §CORRECTION — Notion property names are lowercase-camelCase (`status`, `emailed`), confirmed against the live production DB; relevant if this script ever needs to reference property names directly (it shouldn't — it only calls `NologClient` methods, never raw Notion filters)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NologClient.getUnemailedPublicPosts()` (`packages/core/src/client.ts:253`) — already does exactly the check-before-write filtering the resumability success criterion needs; the script doesn't need its own "already processed?" tracking, just call this at the start of every run (including re-runs after an interruption)
- `NologClient.markEmailed()` (`packages/core/src/client.ts:381`) — already idempotent per its own doc comment ("safe to call more than once on the same page"); combined with `getUnemailedPublicPosts()`'s filtering, resumability (ROADMAP criterion 2) falls out of the existing data layer for free — the script itself doesn't need special resume logic beyond D-06's continue-on-per-post-failure behavior
- `NotionCapabilityError` / `MissingEmailedPropertyError` (`packages/core/src/client.ts:128,146`) — both are `instanceof`-distinguishable per Phase 1's D-03, exactly what D-04/D-05's abort-detection branches need (`catch (err) { if (err instanceof NotionCapabilityError) { ...abort... } }`)

### Established Patterns
- Manual script header comment convention (see `verify-phase-1.ts`/`verify-403.ts`): usage command, prerequisites (env vars, fresh build), and what the script proves/does, all in a top-of-file comment block — the backfill script should follow this same format
- Scripts import from `../dist/index.js`, never `../src` — a stale `dist/` build is a known pitfall already called out in both existing scripts ("this script imports from dist/, not src/")
- No test framework exists in the repo (confirmed, tracked in `TODOS.md`) — this script is inherently a manual/operational tool, not something wrapped in automated tests

### Integration Points
- `packages/core/package.json` `scripts` block — add the new `backfill` entry here (D-11), following the existing `build`/`dev` script style
- No integration with `apps/web` — this is a `packages/core`-only script, run standalone from the repo root, never imported by the Next.js app

</code_context>

<specifics>
## Specific Ideas

No specific UI/vision references — this is a backend-only, operator-facing CLI script. The user's priorities from this discussion: dry-run-first safety for an irreversible bulk write, fail-fast on systemic (setup) errors rather than noisy per-post spam, and staying consistent with the existing `packages/core/scripts/` conventions rather than inventing a new pattern — while still making the command genuinely discoverable for forkers via an npm script wrapper, since (unlike the two existing verify scripts) every forker who enables this feature has to run this one themselves.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — all four areas stayed within Phase 2's backfill-script boundary. No scope creep occurred.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 2.

</deferred>

---

*Phase: 2-Backfill Script*
*Context gathered: 2026-07-25*
