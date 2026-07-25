# Phase 2: Backfill Script - Pattern Map

**Mapped:** 2026-07-25
**Files analyzed:** 2 (1 new, 1 modified)
**Analogs found:** 2 / 2

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/scripts/backfill.ts` | utility (operator CLI script) | batch (fetch-then-loop write) | `packages/core/scripts/verify-403.ts` (primary), `packages/core/scripts/verify-phase-1.ts` (secondary) | exact — same directory, same convention, same client construction/import style |
| `packages/core/package.json` | config | — | itself (existing `scripts` block) | exact — verbatim structural extension |

## Pattern Assignments

### `packages/core/scripts/backfill.ts` (utility, batch)

**Analogs:** `packages/core/scripts/verify-403.ts` (primary — has the `instanceof NotionCapabilityError` branch this script needs) and `packages/core/scripts/verify-phase-1.ts` (secondary — has the plain fetch → mark → verify serial flow).

**Header comment pattern** (`verify-phase-1.ts` lines 1-14, `verify-403.ts` lines 1-14):
```typescript
// Manual verification script (not a unit test — no test framework exists in
// this repo, per REQUIREMENTS.md's explicit "Adding a test framework" out-of-scope
// item). Run via `npx tsx packages/core/scripts/verify-phase-1.ts` from the repo
// root, against a real Notion workspace, after rebuilding packages/core
// (`npm run build --workspace=@4lph4/nolog-core` — this script imports from
// dist/, not src/, so a stale build makes new methods look nonexistent).
//
// Requires NOTION_TOKEN and NOTION_DATABASE_ID env vars pointing at a test
// database that has a Checkbox property named exactly "emailed" and at least
// one status=public, emailed-unchecked post.
//
// Proves DATA-01 (...) and DATA-02 (...) together, per RESEARCH.md's ... Code Example.
```
Adapt this exact shape for `backfill.ts`: usage command (including the npm-script form with `--` pass-through, e.g. `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`), prerequisites (env vars, fresh build), what it proves (DATA-03), and the resumability/idempotency guarantee as a comment (mirrors the "Proves DATA-..." closing line convention).

**Imports + client construction pattern** (`verify-403.ts` lines 16-21, identical in `verify-phase-1.ts` lines 16-21):
```typescript
import { NologClient, NotionCapabilityError } from "../dist/index.js";

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});
```
`backfill.ts` extends this import line to add `MissingEmailedPropertyError`:
```typescript
import {
  NologClient,
  NotionCapabilityError,
  MissingEmailedPropertyError,
} from "../dist/index.js";
```
Always import from `../dist/index.js`, never `../src` — both analogs enforce this via header comment AND import path; `dist/` is built by `tsup` per `packages/core/package.json`'s `build` script and re-exported via `packages/core/src/index.ts` (`export * from "./client"`).

**Core CRUD/batch pattern — fetch, then serial loop** (`verify-phase-1.ts` lines 23-41):
```typescript
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
  // ...
}

main();
```
`backfill.ts` follows the same `async function main() { ... } main();` shape (both analogs use a bare `main()` call, no `.catch()` wrapper, no top-level try/catch around `main()` itself — errors are handled inside `main()`'s own try/catch blocks per D-04/D-05/D-06/D-15). Loop over the *full* array instead of just `before[0]`, adding the fixed 400ms `sleep()` between calls (D-09/D-10) and the retry-on-429 branch (D-07) — neither analog has a delay/retry since they only touch one post each, this is the one genuinely new piece of control flow this script introduces.

**Auth/error-branch pattern — `instanceof` on typed errors** (`verify-403.ts` lines 30-39):
```typescript
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
```
`backfill.ts` reuses this exact `instanceof NotionCapabilityError` branching idiom inside its per-post loop (D-04, must `return`/abort rather than continue — see Pitfall 3 in RESEARCH.md), and applies the identical idiom to `instanceof MissingEmailedPropertyError` around the initial `getUnemailedPublicPosts()` call (D-05), plus a catch-all `else` branch for any other error at that same call site (D-15, new — abort here too, no post list exists yet to iterate).

**Output/logging style** (both analogs, throughout):
- Plain `console.log` for progress/success lines, no timestamps, no log levels beyond `log`/`error`.
- PASS/FAIL-prefixed lines for outcomes: `"PASS: ..."`, `"FAIL: ..."`.
- Errors logged with `console.error` when non-recoverable / abort-worthy (per CLAUDE.md's project-wide error-handling convention: `console.error(\`[Context] Description: message\`)`); this phase's abort messages should follow the "ABORT: <message>" style consistent with PASS/FAIL, e.g. `console.error("ABORT:", err.message)`.
- `backfill.ts` extends this to a final summary line (`"${marked} marked / ${failed} failed"`) and sets `process.exitCode` per D-08 — neither analog needs an exit code since they never partially fail across N items, this is new but stylistically consistent (terse, no extra punctuation/decoration).

---

### `packages/core/package.json` (config)

**Analog:** itself — extract the existing `scripts` block verbatim as the pattern to extend.

**Existing block** (`packages/core/package.json` lines 11-14):
```json
"scripts": {
  "build": "tsup src/index.ts --format cjs,esm --dts",
  "dev": "tsup src/index.ts --format cjs,esm --dts --watch"
},
```

**Pattern to apply (add one entry, preserve formatting/quoting style, comma placement, 2-space indent):**
```json
"scripts": {
  "build": "tsup src/index.ts --format cjs,esm --dts",
  "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
  "backfill": "npx tsx scripts/backfill.ts"
},
```
Note: use `npx tsx`, not a bare `tsx` binary call — `tsx` is not a declared `devDependency` anywhere in the monorepo (confirmed by RESEARCH.md), so a bare `tsx scripts/backfill.ts` command would fail with "command not found" on a clean clone. `npx tsx` matches how the two existing verify scripts are documented to be invoked from the repo root, and requires zero `dependencies`/`devDependencies` edits — do not add `tsx` to either block.

No other part of `package.json` (name, version, main/module/types, `dependencies`, `devDependencies`, `files`) should be touched.

## Shared Patterns

### No-op error swallowing is NOT this script's style — fail loud on abort paths
**Source:** `packages/core/src/client.ts` lines 121-155 (error class doc comments) + `verify-403.ts` lines 33-39
**Apply to:** `backfill.ts`'s D-04/D-05/D-15 abort branches
Unlike the rest of the NoLog codebase (which per CLAUDE.md catches errors silently with fallback values in page components), this script's operator-facing abort paths must print a clear message and set a non-zero exit code — it is explicitly NOT following the "return null on error" convention used elsewhere in the app layer, because this is a CLI tool where silent failure would leave an operator unaware the backfill didn't complete. Follow `client.ts`'s own error-class constructor messages (`NotionCapabilityError`, `MissingEmailedPropertyError`) as the wording template for what to point at (grant capability in Developer Portal / add checkbox property in Notion) — the script's abort message can simply be `console.error("ABORT:", err.message)` since the thrown error's `.message` already contains the actionable fix text (see `client.ts` lines 129-136 and 147-154 for the exact wording baked into each class).

### Manual-script convention (directory-wide)
**Source:** `packages/core/scripts/verify-phase-1.ts`, `packages/core/scripts/verify-403.ts`
**Apply to:** `backfill.ts`
- Header comment block: usage command, prerequisites (env vars + fresh build), what it proves.
- Import client + typed errors from `../dist/index.js` only.
- Construct `NologClient` with `token: process.env.NOTION_TOKEN!, databaseId: process.env.NOTION_DATABASE_ID!` — no dotenv loading, no other config source (D-13).
- `async function main() { ... }` followed by a bare `main();` call at module scope — no `.catch()` wrapper, no IIFE.
- Terse `console.log`/`console.error` output, PASS/FAIL/ABORT-style prefixes, no external logging library.

### Idempotent/resumable data layer — no new state needed
**Source:** `packages/core/src/client.ts` lines 253-288 (`getUnemailedPublicPosts`), lines 376-383 (`markEmailed`)
**Apply to:** `backfill.ts`'s overall control flow
`getUnemailedPublicPosts()` already server-side-filters to `status=public AND emailed=false`, and `markEmailed()`'s doc comment confirms it is "safe to call more than once on the same page." The script must NOT introduce a checkpoint file, `--resume-from` flag, or any local state — just call `getUnemailedPublicPosts()` fresh at the top of `main()` on every invocation. This is the pattern the executor must respect from `client.ts` as read-only, unmodified context (this phase's boundary is "no changes to `NologClient`").

## No Analog Found

None — both files in this phase's scope have exact or verbatim analogs in the existing codebase.

## Metadata

**Analog search scope:** `packages/core/scripts/`, `packages/core/package.json`, `packages/core/src/client.ts`, `packages/core/src/index.ts`
**Files scanned:** 5 (`verify-phase-1.ts`, `verify-403.ts`, `package.json`, `client.ts`, `index.ts`)
**Pattern extraction date:** 2026-07-25
