# Phase 2: Backfill Script - Research

**Researched:** 2026-07-25
**Domain:** A one-time, throttled, resumable Node/TypeScript CLI script (`packages/core/scripts/`) that drains `NologClient.getUnemailedPublicPosts()` and calls `markEmailed()` on each result, respecting Notion's rate limit and the project's existing manual-script conventions.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The script supports a `--dry-run` flag that previews every post that would be marked (count + per-post title/ID) without writing anything. — Reversibility: reversible.
- **D-02:** A live (writing) run requires no extra confirmation step beyond invoking the script without `--dry-run` — no interactive y/n prompt, no separate `--confirm` flag. — Reversibility: reversible.
- **D-03:** `--dry-run` output shows the count AND a per-post list (titles/IDs), not just a number.
- **D-04:** `NotionCapabilityError` (missing "Update content" capability, thrown by `markEmailed()`) aborts the entire run immediately on first occurrence, with one clear message pointing at the fix — not logged as a per-post failure and retried on every remaining post. — Reversibility: reversible.
- **D-05:** `MissingEmailedPropertyError` (thrown by `getUnemailedPublicPosts()` before the per-post loop even starts) gets the same abort-immediately treatment as D-04.
- **D-06:** Any other per-post error (network blip, unexpected Notion error) is logged as failed and the script continues to the next post. A second run safely and automatically picks up only the M that failed — no separate resume/retry bookkeeping needed. — Reversibility: reversible.
- **D-07:** On a 429 from Notion, the script retries that one post once with backoff (honoring `Retry-After` if present, else a short fixed backoff) before falling through to D-06's generic per-post failure handling if the retry also fails.
- **D-08:** The script exits with a non-zero exit code if any posts ended up in the failed bucket (M > 0) after a completed (non-aborted) run. Exit code is also non-zero on the D-04/D-05 abort paths.
- **D-09:** Throttling is a fixed delay between each `markEmailed()` call (not a token-bucket rate limiter) — matches the script's serial, one-post-at-a-time processing model.
- **D-10:** The fixed delay is 400ms per request (~2.5 req/s), giving ~17% headroom below Notion's documented ~3 req/s limit.
- **D-11:** The script lives in `packages/core/scripts/` next to `verify-phase-1.ts`/`verify-403.ts` (same convention: imports from `../dist/index.js`, requires a fresh `npm run build --workspace=@4lph4/nolog-core` first), but ALSO gets a `package.json` script entry (e.g. `backfill`) so forkers get a documented, memorable command.
- **D-12:** Flags pass through the npm script wrapper via standard `--` pass-through syntax: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run`. No separate `backfill:dry-run` script entry.
- **D-13:** The script requires `NOTION_TOKEN`/`NOTION_DATABASE_ID` as already-exported shell env vars, matching `verify-phase-1.ts`/`verify-403.ts` exactly — no dotenv auto-loading. No new dependency.

### Claude's Discretion

- Exact log line format/verbosity for per-post progress — follow the existing terse style in `verify-phase-1.ts`/`verify-403.ts` (plain `console.log`, PASS/FAIL-style summary lines).
- Exact wording of the abort messages for D-04/D-05 — should point at the concrete fix, mirroring the wording already in `NotionCapabilityError`/`MissingEmailedPropertyError`'s own constructor messages in `client.ts`.
- Whether the npm script name is exactly `backfill` or something more specific (e.g. `backfill-emailed`) — left to the planner.

### Deferred Ideas (OUT OF SCOPE)

None raised during this discussion — all four areas stayed within Phase 2's backfill-script boundary. No scope creep occurred.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| DATA-03 | A one-time backfill script marks all pre-existing public posts as `emailed` before the first production cron run — throttled to Notion's ~3 req/s rate limit and safely re-runnable if interrupted | Pattern 1 (script control flow), Pattern 2 (throttle/retry), Don't Hand-Roll (resumability already provided by `NologClient`), Common Pitfalls 1-4, Code Examples |
</phase_requirements>

## Summary

This phase adds exactly one new file (`packages/core/scripts/backfill.ts`) plus one `package.json` script entry — no changes to `NologClient`. Resumability (ROADMAP success criterion 2) is **already solved by the existing, verified data layer**: `getUnemailedPublicPosts()` naturally excludes already-marked posts and `markEmailed()` is documented-idempotent, so the script needs zero bespoke "have I already processed this?" bookkeeping — it just calls `getUnemailedPublicPosts()` fresh on every invocation (including re-runs after an interruption) and iterates whatever it returns. The entire script is a serial `for` loop: fetch the full unemailed list once, optionally print-and-exit for `--dry-run`, otherwise loop `markEmailed()` calls with a fixed 400ms delay between each (D-09/D-10), catching `NotionCapabilityError`/`MissingEmailedPropertyError` as fatal aborts (D-04/D-05) and everything else as a per-post failure that gets logged and skipped (D-06), with a single-retry-with-backoff carve-out for 429s (D-07). At the end it prints "N marked / M failed" and sets `process.exitCode` per D-08.

Three of the five open questions flagged in the phase brief are **fully resolved** by this research: (1) Notion's rate limit and 429/`Retry-After` behavior is confirmed directly from Notion's current official docs — ~3 req/s average per connection/token, 429 **does** include a `Retry-After` header as an integer count of seconds; (2) the `MissingEmailedPropertyError` detection regex was **already live-verified** in Phase 1 (not just for the PATCH path but explicitly for the `getUnemailedPublicPosts()` query path too — see `01-UAT.md` test 3), so this script can trust `instanceof MissingEmailedPropertyError` without re-verifying Notion's error shape; (4) `getUnemailedPublicPosts()`'s `do/while` cursor loop is structurally correct and terminates properly (verified by direct code read — `cursor = response.next_cursor` becomes `null` on the last page, ending the loop), and its own `try/catch` means a mid-pagination failure **throws** rather than silently returning a partial list, so the backfill script is guaranteed either the complete unemailed set or an exception, never a truncated one. One genuinely new finding requiring planner attention: **a generic (non-typed) error thrown by the initial `getUnemailedPublicPosts()` call itself — e.g., a network blip on page 2 of a large pagination — happens before the per-post loop exists, so it does not fit cleanly into D-06's "log per-post failure and continue" model.** This research recommends treating it the same as D-04/D-05 (abort-immediately, non-zero exit), since there is no post to attribute a "failure" to and no partial list to fall back on.

**Primary recommendation:** Write `packages/core/scripts/backfill.ts` using Node's built-in `node:util` `parseArgs` (zero new dependency, stable since Node 20, this repo runs Node 22.23.1) for the single `--dry-run` boolean flag; invoke it from the new `package.json` script entry via `npx tsx` (not a bare `tsx` binary call) so no `tsx` devDependency needs to be added — this preserves D-13's "no new dependency" instruction while keeping the npm-script-wrapper ergonomics D-11/D-12 ask for.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Fetch unemailed public posts | API / Backend (`packages/core` — `NologClient`, consumed as-is) | Database / Storage (Notion query engine) | Already implemented in Phase 1; this phase only calls it, never modifies it |
| Throttled write loop, retry-on-429, error classification, dry-run preview, exit-code signaling | API / Backend — but as a standalone **CLI script**, not a library method or HTTP route | — | This is operator tooling, not a runtime code path consumed by `apps/web`; it belongs alongside `verify-phase-1.ts`/`verify-403.ts` in `packages/core/scripts/`, never imported by the Next.js app |
| npm script discoverability (`npm run backfill`) | Build/Tooling config (`packages/core/package.json`) | — | Package-manager-level UX, not application code |

## Standard Stack

### Core

No new runtime dependencies. This phase uses only what's already installed plus Node's own built-in module.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `node:util` (`parseArgs`) | Built into Node.js ≥18.3 (stable since Node 20.0.0) `[CITED: nodejs.org/api/util.html]` | Parses the single `--dry-run` boolean CLI flag | Zero-dependency, built into the Node runtime this repo already requires (confirmed installed: Node v22.23.1 `[VERIFIED: node --version]`) — no need to hand-roll `process.argv` string matching or add a CLI-arg library for one boolean flag |
| `tsx` | `4.23.1` current on npm registry `[VERIFIED: npm registry]` `[CITED: npmjs.com/package/tsx]` | Runs the TypeScript script directly without a separate compile step, invoked via `npx tsx` exactly like the two existing manual scripts | Already the established convention in this repo (`verify-phase-1.ts`, `verify-403.ts` both documented as `npx tsx ...`); confirmed to work in this environment without any prior install (`npx tsx --version` succeeded, resolving/caching `tsx@4.23.1` on first invocation) `[VERIFIED: npx tsx --version ran successfully in this session]` |
| `@4lph4/nolog-core` (built `dist/`) | `1.0.1`, imported from `../dist/index.js` | Provides `NologClient`, `NotionCapabilityError`, `MissingEmailedPropertyError` | Already the sole data-layer dependency; the backfill script is a consumer, not a modifier |

No installation step needed for this phase — do not add packages to `package.json` dependencies or devDependencies.

### Supporting

None.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:util` `parseArgs` (recommended) | Raw `process.argv.includes("--dry-run")` | Both are zero-dependency and adequate for exactly one boolean flag. `parseArgs` is slightly more self-documenting (declares the flag's type/default in one place) and is what Node itself now recommends over ad-hoc `argv` parsing `[CITED: nodejs.org/api/util.html]`, but either is acceptable — this is a Claude's-discretion-level implementation detail, not a locked decision. Recommend `parseArgs` for clarity, but `process.argv.includes(...)` is not wrong. |
| `npx tsx` invocation in the npm script (recommended) | Bare `tsx scripts/backfill.ts` as the `package.json` script command | A bare `tsx` command requires `tsx` to be resolvable from `node_modules/.bin` or a global install — i.e., it would require adding `tsx` as a `devDependency` (a new dependency, contradicting D-13's explicit "no new dependency" instruction). `npx tsx` resolves/downloads on demand exactly like the two existing verify scripts already do, requiring no `package.json` dependency changes. |
| Fixed 400ms delay per request (D-09/D-10, locked) | Token-bucket / sliding-window rate limiter | Already decided by the user (D-09) — the serial, one-post-at-a-time model doesn't need bucket-based concurrency control. Noted here only for completeness; not open for reconsideration. |

**Installation:**
```bash
# No installation required — this phase adds zero new dependencies.
```

**Version verification:** `tsx` — not currently a declared dependency anywhere in the monorepo (confirmed: `npm ls tsx --workspaces` returns empty); registry current is `4.23.1`, requires Node `>=18.0.0` `[VERIFIED: npm view tsx version && npm view tsx engines, both run 2026-07-25]` — comfortably satisfied by this repo's Node v22.23.1. No devDependency addition needed if the npm script invokes it via `npx tsx` (see Pattern 3 below).

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** `tsx` is invoked via `npx` (ad-hoc, no `package.json` entry) exactly as the two pre-existing manual scripts already do; it is not being added as a project dependency. No `npm install` occurs. Skip the Package Legitimacy Gate protocol; there is nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│  packages/core/scripts/backfill.ts   (NEW — this phase)                │
│                                                                          │
│  parseArgs(process.argv) ──▶ { dryRun: boolean }                        │
│         │                                                               │
│         ▼                                                               │
│  client.getUnemailedPublicPosts() ───────────────────────────────────┐  │
│         │ (reused unmodified from Phase 1)                          │  │
│         ▼                                                            │  │
│  ┌──────────────────────┐        catch                              │  │
│  │ throws?               │──────▶ instanceof MissingEmailedPropertyError │
│  └──────────────────────┘         → D-05 ABORT (print fix, exit≠0)  │  │
│         │ no throw                → any OTHER error → treat as fatal │  │
│         ▼                            too (new finding, see Summary)  │  │
│  posts: Post[] (may be [])                                          │  │
│         │                                                            │  │
│  dryRun? ──yes──▶ print count + per-post title/ID (D-01/D-03) ──▶ exit 0│
│         │no                                                          │  │
│         ▼                                                            │  │
│  for (post of posts) {                                              │  │
│    try {                                                             │  │
│      await client.markEmailed(post.id)   ◀── reused, unmodified     │  │
│      marked++                                                       │  │
│    } catch (err) {                                                  │  │
│      if (err instanceof NotionCapabilityError)                      │  │
│         → D-04 ABORT (print fix, exit≠0, stop loop)                 │  │
│      else if (is 429) → retry once w/ backoff (D-07) → on 2nd fail: │  │
│         failed++ (D-06)                                             │  │
│      else → failed++, continue (D-06)                               │  │
│    }                                                                  │  │
│    await sleep(400ms)  ── D-09/D-10 fixed throttle, every request    │  │
│  }                                                                    │  │
│         │                                                            │  │
│         ▼                                                            │  │
│  print "N marked / M failed"; process.exitCode = failed>0 ? 1 : 0 (D-08)│
└────────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  NologClient (dist/) ──▶ Notion REST API (unchanged from Phase 1)
```

### Recommended Project Structure

```
packages/core/
├── src/                  # UNCHANGED — no edits this phase
├── scripts/
│   ├── verify-phase-1.ts   # existing, unchanged
│   ├── verify-403.ts       # existing, unchanged
│   └── backfill.ts         # NEW — this phase's only source file
└── package.json          # EDIT — add "backfill" script entry
```

### Pattern 1: Fetch-then-loop, no bespoke resume state

**What:** Call `getUnemailedPublicPosts()` exactly once at the top of `main()`. Do not persist any "last processed ID" or checkpoint file. On any re-run (including after `Ctrl+C` mid-run), calling it again returns only what's still unmarked, because Phase 1's filter (`emailed === false`) and `markEmailed()`'s durability already provide this for free.

**When to use:** Always, for this script — this is the whole reason ROADMAP success criterion 2 (resumability) requires zero new code beyond D-06's continue-on-failure loop.

**Why this is safe (verified, not assumed):** `getUnemailedPublicPosts()`'s `do/while` loop (`packages/core/src/client.ts:268-285`) is wrapped in its own `try/catch` — a failure on any page of pagination (page 2+) propagates as a thrown exception, it does **not** silently return the partial list collected so far. This means the backfill script can trust that a non-throwing call always returns the *complete* unemailed set, never a truncated first page. (A pre-existing, unrelated, and explicitly out-of-scope codebase concern — `.planning/codebase/CONCERNS.md`'s "Inefficient Pagination Error Handling" — documents a *different* method, `getPosts()`, which has no `try/catch` at all; that concern does not apply to `getUnemailedPublicPosts()`, which already has the catch block Phase 1 added for D-01 detection.)

**Trade-offs:**
- *For:* Zero new state to manage, zero new failure modes to test, matches D-06's design intent exactly.
- *Against:* None for this scope — the alternative (a checkpoint file, a `--resume-from` flag) would be pure premature complexity given the data layer already guarantees this property.

### Pattern 2: Fixed-delay throttle + single-retry-on-429 with `Retry-After`

**What:** Between every `markEmailed()` call (success or failure), `await sleep(400)`. Around each call, wrap in a `try/catch`; if the caught error signals a 429 (see Pitfall 2 for how `markEmailed()` currently surfaces this), retry exactly once — read `Retry-After` from the response if the error carries it, otherwise fall back to a short fixed wait (e.g. 500ms-1s), then attempt the same post one more time before falling through to D-06's generic per-post failure handling.

**Verified rate-limit facts** (confirmed directly against Notion's current official docs this session, not assumed):
- Notion's documented rate limit is **"an average of three requests per second, with some bursts beyond the average allowed" per connection/integration token** `[CITED: developers.notion.com/reference/request-limits]`.
- A 429 response **does** include a `Retry-After` header, formatted as **"an integer number of seconds (in decimal)"** — i.e., a plain number like `"1"`, not milliseconds and not an HTTP-date. `[CITED: developers.notion.com/reference/request-limits]`
- Notion's own guidance: "Requests made after waiting this minimum amount of time should no longer be rate limited," and separately recommends implementing queuing/backoff proactively rather than only reacting to failures. `[CITED: developers.notion.com/reference/request-limits]`
- 529 (service overload) should be handled the same way as 429 per the same doc — worth a passing mention in the script's retry condition, though D-07 only names 429 explicitly; treating 529 identically is a reasonable, low-risk planner discretion call, not a locked requirement.

**Why 400ms (D-10) is sound:** 400ms between requests is 2.5 req/s, comfortably under the documented ~3 req/s average, leaving headroom for the "~" imprecision and any latency Notion's own docs acknowledge (bursts above the average are tolerated, but a *sustained* rate under the average is the documented-safe zone).

**Important caveat for the retry:** `markEmailed()`'s current implementation (`patchPage()` in `client.ts:343-374`) does **not** special-case 429 today — a 429 response falls through to the generic `throw new Error(\`Notion patch failed: ${res.status} ${bodyText}\`)` branch, since only 403 and the 400-missing-property pattern are special-cased. This means the backfill script's 429-detection must parse the **generic Error's message string** for the status code (e.g., `err.message.startsWith("Notion patch failed: 429")`) rather than relying on an `instanceof`-checkable type — `NologClient` was not designed with a distinct 429 error class, and D-07 does not ask for one to be added (out of this phase's scope, since Phase 1 is closed and this phase's CONTEXT.md explicitly says "no changes to `NologClient` itself"). The script cannot read Notion's actual `Retry-After` response header directly either, since `patchPage()` only exposes the response body text in the thrown `Error`'s message, not the raw `Response` object or its headers. **Practical implication for the planner:** the script's 429 retry can only use a fixed backoff (e.g., 500ms-1s), not a true `Retry-After`-driven wait, unless `patchPage()`'s generic-error path is extended to include the `Retry-After` header value in the thrown message — which would be a (small, additive, backward-compatible) change to `client.ts`, arguably in tension with CONTEXT.md's "no changes to NologClient" framing. Flagging this explicitly as a decision the planner/discuss-phase should make consciously, not silently: either (a) accept fixed-backoff-only for 429 (simplest, stays fully within "don't touch NologClient"), or (b) make a minimal additive change to surface `Retry-After` through the thrown error. Given D-07's wording ("honoring `Retry-After` if present, else a short fixed backoff") anticipates the header may be read, option (b) most faithfully satisfies the decision as written — but this is a scope call for the plan, not something this research can resolve unilaterally.

**Trade-offs:**
- *For:* Directly satisfies D-07's honor-`Retry-After`-if-present language when combined with option (b) above; matches Notion's own documented best practice.
- *Against:* Parsing a 429 out of a generic `Error`'s string message (if staying with option (a)) is fragile to message wording changes — same category of risk Phase 1's Pitfall 1 already warned about for the 403 case, but 429 wasn't given a status-code-first typed class in Phase 1's scope.

### Pattern 3: npm script wrapper invokes `npx tsx`, not a bare `tsx` binary

**What:** In `packages/core/package.json`'s `scripts` block, add:
```json
"backfill": "npx tsx scripts/backfill.ts"
```
Note `npx tsx`, not bare `tsx` — this is the detail that lets D-13's "no new dependency" hold true while still giving forkers `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` (D-11/D-12).

**Why this resolves Open Question 3 (tsx devDependency):** A bare `"backfill": "tsx scripts/backfill.ts"` script would only work if `tsx`'s binary is resolvable from `node_modules/.bin` — which requires either a global install or a `devDependency` entry (`npm install -D tsx`) so npm hoists its bin into the workspace. Since `tsx` is not currently declared anywhere in this monorepo (confirmed: `npm ls tsx --workspaces` → empty), a bare `tsx` command in `package.json` would fail with a "command not found" on a clean clone with no prior `npx tsx` cache. Using `npx tsx ...` inside the script string sidesteps this entirely — `npx` is bundled with `npm` itself (always available), and `npx <pkg>` transparently downloads-and-runs (or uses a cached copy) without requiring the package to be a project dependency, **exactly matching how the two existing manual scripts are already documented to be invoked** (`npx tsx packages/core/scripts/verify-phase-1.ts`). Verified in this session: `npx tsx --version` succeeded from a cold state and returned `tsx v4.23.1` / `node v22.23.1`.

**Trade-off:** On a genuinely clean clone/CI runner with no npm cache and no network access, `npx tsx` still needs to fetch the package once — but this is an existing, already-accepted characteristic of this repo's manual-script convention (not a new limitation introduced by this phase), and forkers running this locally will have network access by definition (they're pulling from a Notion API over the network in the same command).

### Pattern 4: Error classification order inside the per-post loop

**What:** Inside the `try/catch` around each `markEmailed()` call, check error types in this order:
1. `instanceof NotionCapabilityError` → D-04 abort (print fix message, set `process.exitCode = 1`, stop the loop entirely — do not process remaining posts).
2. 429-signal (message-based, see Pattern 2 caveat) → single retry with backoff; if the retry also fails, fall through to (3).
3. Everything else → D-06 per-post failure: log it, increment `failed`, `continue` to the next post.

**Why order matters:** `NotionCapabilityError` must be checked before the generic 429/other-error fallback, since once "Update content" capability is missing, *every* subsequent `markEmailed()` call will also fail with the same 403 — continuing the loop would burn through the entire post list re-hitting the same systemic error (D-04's exact rationale for aborting immediately rather than logging N identical per-post failures).

**Pre-loop analog (new finding, not explicitly covered by D-04/D-05's wording):** The `getUnemailedPublicPosts()` call happens *before* this loop exists. `MissingEmailedPropertyError` from that call is explicitly covered by D-05 (abort). But a *different*, non-typed error from that same call (e.g., a transient network failure during pagination, or Notion returning an unexpected 500) is not explicitly named by any decision — there's no "post" for it to be a per-post failure about, and no partial list to process instead. **Recommendation:** treat any error from the initial `getUnemailedPublicPosts()` call — typed or not — as fatal: print the error, set a non-zero exit code, and do not attempt to run the per-post loop at all. This is the only structurally sound option (there's nothing to iterate), and it's consistent in spirit with D-04/D-05's "systemic problem, abort immediately" philosophy even though it wasn't named as a third named error type during discuss-phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Has this post already been marked?" tracking across runs | A checkpoint file, a `--resume-from <id>` flag, a local SQLite/JSON state store | Nothing — re-call `getUnemailedPublicPosts()` at the top of every run | Phase 1's `emailed` checkbox filter + `markEmailed()`'s idempotency already provide exactly this property; building separate state duplicates what the Notion database itself is already the source of truth for, and risks the local state drifting from Notion's actual state |
| CLI flag parsing for one boolean flag | A CLI-argument-parsing library (`yargs`, `commander`, `minimist`) | `node:util`'s built-in `parseArgs` | Adding a dependency for one boolean flag when Node ships a stable built-in equivalent is disproportionate; the repo also has zero existing CLI-arg dependencies to build on (per the phase brief's Open Question 5), so introducing one is a net-new dependency footprint with no other consumer |
| Rate limiting / backoff for a Notion write burst | A generic token-bucket rate-limiter package (`bottleneck`, `p-throttle`) | A fixed `await sleep(400)` between serial calls (D-09, locked) | The user already locked this decision — the script's serial, one-post-at-a-time model has no concurrency to coordinate, so a full rate-limiter library would be solving a concurrency problem this script doesn't have |
| Detecting the 403/missing-property cases | Re-implementing status-code/message detection from scratch | `instanceof NotionCapabilityError` / `instanceof MissingEmailedPropertyError`, both already implemented and live-verified in Phase 1 | Phase 1 already built and verified this exact detection against a live Notion workspace (`01-UAT.md`); re-deriving it in this phase would risk drifting from the already-tested implementation |

**Key insight:** Every piece of "hard" logic this phase might be tempted to build from scratch (resumability, capability/schema error detection) is already solved by Phase 1's data layer. This phase's actual net-new logic is deliberately small: a loop, a sleep, an exit code, and one CLI flag.

## Common Pitfalls

### Pitfall 1: Building resumability logic that duplicates what `getUnemailedPublicPosts()` already provides

**What goes wrong:** An implementation adds a JSON/text file tracking "already attempted" post IDs, intending to skip them on the next run — but this can drift from Notion's actual state (e.g., if a post was marked successfully but the local tracking file wasn't updated before a crash) and is pure unnecessary surface area.

**Why it happens:** "Resumable" sounds like it implies persistent local state, especially to anyone not aware `getUnemailedPublicPosts()` already filters server-side.

**How to avoid:** Do not create any file, checkpoint, or in-memory state that survives past a single script invocation. The *only* state that matters is Notion's own `emailed` checkbox, which `markEmailed()` already writes durably.

**Warning signs:** Any new file path, new npm dependency for local storage, or a `--resume` flag appearing in the plan.

### Pitfall 2: Assuming `markEmailed()` throws a typed/`instanceof`-checkable error for 429

**What goes wrong:** Code written as `catch (err) { if (err instanceof RateLimitError) ... }` will never match, because `NologClient` has no such class — a 429 currently falls through `patchPage()`'s generic `throw new Error(...)` branch (see Pattern 2 above for the exact code path).

**Why it happens:** It's a reasonable assumption given `NotionCapabilityError` and `MissingEmailedPropertyError` both exist as typed classes for other Notion error conditions — easy to assume 429 got the same treatment.

**How to avoid:** Detect 429 by parsing the generic `Error`'s message string (it embeds the raw status code and Notion's response body per `patchPage()`'s current implementation: `` `Notion patch failed: ${res.status} ${bodyText}` ``), OR make the minimal additive change to `client.ts` to surface this distinctly (see Pattern 2's explicit either/or framing — this is a planning decision, not something this research can resolve).

**Warning signs:** A 429 during manual testing falls through to the generic D-06 "log and continue, no retry attempted" path instead of triggering the D-07 retry-once behavior.

### Pitfall 3: Continuing the loop after a `NotionCapabilityError`

**What goes wrong:** If the loop's `catch` block logs the error and does a plain `continue` (matching D-06's per-post pattern) instead of breaking out entirely, a missing "Update content" capability will produce N identical failure log lines (one per remaining post) instead of one clear abort message — burning through the full Notion request budget on guaranteed-to-fail calls.

**Why it happens:** D-04 and D-06 look superficially similar (both are "catch this error type in the loop") but have opposite control-flow requirements (stop everything vs. log-and-continue) — easy to implement both with the same `continue` statement by accident.

**How to avoid:** Check `instanceof NotionCapabilityError` first and explicitly `break`/`return` out of the entire loop and function on that branch, before falling into the generic catch-and-continue logic for everything else.

**Warning signs:** Test the abort path manually (temporarily revoke "Update content" capability, per `verify-403.ts`'s own documented technique) against a database with 2+ unemailed posts — the log output should show exactly one abort message, not one per remaining post.

### Pitfall 4: Rebuilding `packages/core` after editing `client.ts` — not applicable this phase, but rebuilding is still required before first run

**What goes wrong:** Since this phase does not touch `client.ts`/`types.ts` at all, there's no new rebuild trigger from *this* phase's own changes — but the script still imports from `../dist/index.js` (per D-11/convention), so if `dist/` predates Phase 1's `markEmailed`/`getUnemailedPublicPosts`/error-class additions in a given execution environment, the script will fail with "not a function" or "not exported," which looks like a bug in the new script but is actually a stale-build issue inherited from Phase 1's own documented Pitfall 4.

**Why it happens:** Any fresh clone or CI environment that hasn't run `npm run build --workspace=@4lph4/nolog-core` since Phase 1 landed will have a stale/absent `dist/`.

**How to avoid:** The backfill script's own header comment (mirroring `verify-phase-1.ts`/`verify-403.ts`'s convention) must explicitly instruct: rebuild `packages/core` before running, exactly as the two existing scripts already do.

**Warning signs:** `TypeError: client.getUnemailedPublicPosts is not a function` or `MissingEmailedPropertyError is not exported` when the source clearly has these — check `dist/index.js`'s modification time vs. `src/client.ts`'s.

## Code Examples

### Backfill script skeleton (illustrative — planner/executor should adapt exact log wording per Claude's Discretion notes above)

```typescript
// packages/core/scripts/backfill.ts
// Manual/operational script (not a unit test — no test framework exists in this
// repo, per REQUIREMENTS.md's explicit out-of-scope item). Run via
// `npm run backfill --workspace=@4lph4/nolog-core -- [--dry-run]` from the repo
// root, after a fresh `npm run build --workspace=@4lph4/nolog-core` (this script
// imports from dist/, not src/ — a stale build makes new/updated methods look
// nonexistent).
//
// Requires NOTION_TOKEN and NOTION_DATABASE_ID as already-exported shell env vars.
//
// Marks every pre-existing public, not-yet-emailed post as emailed, throttled to
// stay under Notion's ~3 req/s limit. Safe to interrupt and re-run: on any run,
// only posts still unmarked are processed (getUnemailedPublicPosts() filters
// server-side; markEmailed() is idempotent) — no local resume state is kept.
//
// Proves DATA-03.

import { parseArgs } from "node:util";
import {
  NologClient,
  NotionCapabilityError,
  MissingEmailedPropertyError,
} from "../dist/index.js";

const { values } = parseArgs({
  options: { "dry-run": { type: "boolean", default: false } },
});
const dryRun = values["dry-run"] as boolean;

const DELAY_MS = 400; // D-09/D-10: ~2.5 req/s, ~17% headroom under Notion's ~3 req/s

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new NologClient({
  token: process.env.NOTION_TOKEN!,
  databaseId: process.env.NOTION_DATABASE_ID!,
});

function is429(err: unknown): boolean {
  // markEmailed()/patchPage() has no typed 429 error class today — detect via
  // the generic Error's message, which embeds the raw status code (see
  // client.ts patchPage()'s `Notion patch failed: ${res.status} ...` shape).
  return err instanceof Error && /Notion patch failed: 429/.test(err.message);
}

async function main() {
  let posts;
  try {
    posts = await client.getUnemailedPublicPosts();
  } catch (err) {
    if (err instanceof MissingEmailedPropertyError) {
      console.error("ABORT:", err.message);
    } else {
      // New finding (not explicitly named by D-04/D-05): any other error from
      // the initial fetch is also fatal — there is no post list to iterate.
      console.error("ABORT: failed to fetch unemailed posts:", err);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Found ${posts.length} unemailed public post(s).`);
  if (posts.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    for (const p of posts) console.log(`  [dry-run] ${p.id}  "${p.title}"`);
    console.log(`DRY RUN: ${posts.length} post(s) would be marked. No writes performed.`);
    return;
  }

  let marked = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      await client.markEmailed(post.id);
      marked++;
      console.log(`Marked ${post.id}  "${post.title}"`);
    } catch (err) {
      if (err instanceof NotionCapabilityError) {
        console.error("ABORT:", err.message);
        process.exitCode = 1;
        return; // D-04: stop immediately, do not touch remaining posts
      }

      if (is429(err)) {
        // D-07: single retry with backoff. Retry-After header is not currently
        // surfaced through patchPage()'s generic Error message — see
        // RESEARCH.md Pattern 2 for the fixed-backoff-vs-header-plumbing
        // tradeoff this plan must decide on.
        await sleep(1000);
        try {
          await client.markEmailed(post.id);
          marked++;
          console.log(`Marked ${post.id} (after 429 retry)  "${post.title}"`);
          await sleep(DELAY_MS);
          continue;
        } catch (retryErr) {
          console.error(`FAILED (after 429 retry) ${post.id} "${post.title}":`, retryErr);
          failed++;
          await sleep(DELAY_MS);
          continue;
        }
      }

      console.error(`FAILED ${post.id} "${post.title}":`, err);
      failed++; // D-06: log and continue
    }

    await sleep(DELAY_MS);
  }

  console.log(`${marked} marked / ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0; // D-08
}

main();
```

### `package.json` script entry

```json
{
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "dev": "tsup src/index.ts --format cjs,esm --dts --watch",
    "backfill": "npx tsx scripts/backfill.ts"
  }
}
```

Invoked by forkers as: `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` (D-12).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `process.argv` manual string matching for CLI flags | `node:util`'s `parseArgs` | Stable since Node 20.0.0 (added experimentally in 18.3) `[CITED: nodejs.org/api/util.html]` | No action needed beyond using the built-in — this repo's Node 22.23.1 fully supports it |
| `ts-node` for running TypeScript scripts directly | `tsx` (esbuild-powered) | `tsx` has been the de facto replacement for `ts-node` in most new tooling for some time | Already the established choice in this repo (both existing manual scripts use it) — no change needed, just continue the convention |

**Deprecated/outdated:** None relevant — this phase introduces no new architecture, only a script following existing conventions.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | A generic (non-`MissingEmailedPropertyError`) failure from the initial `getUnemailedPublicPosts()` call should be treated as a third abort-immediately case, analogous to D-04/D-05, even though this exact scenario wasn't named during discuss-phase | Pattern 4, Code Examples | Low-moderate — if the planner/user prefers a different treatment (e.g., retry the whole fetch once before aborting), the script's top-level error handling would need a small revision; does not affect the per-post loop's correctness either way |
| A2 | 429 detection via message-string-matching (`/Notion patch failed: 429/`) is an acceptable interim approach, rather than requiring a `client.ts` change to add a typed rate-limit error class | Pattern 2, Pitfall 2 | Moderate — fragile if `patchPage()`'s generic error message format ever changes wording (would silently stop triggering the D-07 retry path, falling through to D-06's log-and-continue instead); recommend the planner decide explicitly whether to accept this or make the minimal additive `client.ts` change to surface `Retry-After` |
| A3 | Treating 529 (service overload) identically to 429 in the retry logic, even though D-07 only names 429 | Pattern 2 | Low — a reasonable extension of Notion's own documented guidance ("handle the same way"), but not explicitly requested; omitting it is not a functional gap against DATA-03/D-07 as literally written |

**None of the locked decisions (D-01 through D-13) are themselves flagged as assumptions** — they are user-confirmed and copied verbatim above. Only this research's own supplementary judgment calls (filling gaps the discuss-phase session didn't explicitly cover) are logged here.

## Open Questions

1. **Should the backfill script's retry-on-429 (D-07) read Notion's actual `Retry-After` header, or accept a fixed backoff given `NologClient` doesn't currently expose it?**
   - What we know: Notion's docs confirm the header exists and is an integer-seconds value `[CITED: developers.notion.com/reference/request-limits]`. `patchPage()`'s current generic-error path only exposes the response body text, not the `Response` object or its headers.
   - What's unclear: Whether "no changes to NologClient" (stated in this phase's CONTEXT.md domain boundary) is meant to block even a minimal, additive change to thread the header value through, or whether it only means "don't change the two already-shipped Phase 1 public methods' contracts."
   - Recommendation: The planner should make an explicit call here (see Pattern 2's either/or framing) — likely resolved during `/gsd-discuss-phase` follow-up or left as a planner judgment call with a documented rationale in the plan itself, since it's a legitimate trade-off, not a research gap.

2. **Should a generic (non-typed) failure from the pre-loop `getUnemailedPublicPosts()` call abort the whole run (this research's recommendation, A1) or something else (e.g., one retry before aborting)?**
   - What we know: `getUnemailedPublicPosts()`'s own `try/catch` guarantees no partial/truncated list is ever silently returned — any failure there is a clean exception.
   - What's unclear: Whether a transient network blip deserves its own retry-once treatment (mirroring D-07's per-post retry philosophy) before declaring the whole run a failure, since a single flaky request shouldn't necessarily block an otherwise-healthy backfill.
   - Recommendation: A single retry-once-then-abort on the initial fetch (mirroring D-07's spirit) is a reasonable middle ground the planner may choose over an immediate hard-abort; either is defensible and this research does not consider one clearly correct over the other.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Running the script via `tsx`, `parseArgs` | ✓ | v22.23.1 | — |
| `npm` workspaces | `npm run backfill --workspace=@4lph4/nolog-core` invocation | ✓ | 12.0.1 | — |
| `npx` (bundled with npm) | Resolving `tsx` on demand without a devDependency | ✓ | confirmed via successful `npx tsx --version` this session | — |
| `tsx` (via npx, not installed) | Executing the TypeScript script directly | ✓ (resolves/caches on first invocation) | `4.23.1` current on registry `[VERIFIED: npm registry]` | — |
| Live Notion workspace + integration token with "Update content" capability | Actually running the backfill against real data; manually verifying D-04/D-07's abort/retry paths | Not verifiable from this research environment — requires the developer's real Notion workspace | — | None — this is a hard manual-verification requirement, consistent with Phase 1's own precedent (`01-UAT.md`) |

**Missing dependencies with no fallback:**
- A live Notion workspace/integration for manually verifying the abort paths (D-04, D-05) and the throttle-timing success criterion (ROADMAP criterion 3) — expected and by design, matching Phase 1's precedent; no test framework exists in this repo (explicitly out of scope).

**Missing dependencies with fallback:**
- None — `tsx` "missing" as a declared dependency is intentionally not a gap; it resolves via `npx` per Pattern 3.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | none — no test framework exists in this repo; explicitly out of scope per `REQUIREMENTS.md` |
| Config file | none |
| Quick run command | `npm run backfill --workspace=@4lph4/nolog-core -- --dry-run` (manual, ad-hoc, against a real/test Notion workspace) |
| Full suite command | n/a — no automated suite exists |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DATA-03 (SC#1: N marked/M failed summary) | Running the script against N pre-existing public posts marks all N as `emailed`, prints "N marked / M failed" | manual-only | `npm run backfill --workspace=@4lph4/nolog-core` against a live test database, observe final log line and re-query via `getUnemailedPublicPosts()` returning `[]` afterward | ❌ Wave 0 (script itself is this phase's own deliverable) |
| DATA-03 (SC#2: resumability) | Interrupting mid-run and re-running processes only still-unmarked posts, no re-marking/erroring on already-emailed posts | manual-only | Run the script, `Ctrl+C` partway through (against a database with several posts and the 400ms delay giving a comfortable interrupt window), re-run, confirm the second run's initial "Found N unemailed" count reflects only the remainder | ❌ Wave 0 |
| DATA-03 (SC#3: rate compliance) | Request rate during a run stays within Notion's ~3 req/s limit | manual-only | Run the script against a nontrivial post count (e.g. 10+), inspect per-post log line timestamps, confirm ≥~400ms gaps (2.5 req/s), and confirm no 429s appear in the log for a healthy run | ❌ Wave 0 |
| D-04 abort path | `NotionCapabilityError` aborts immediately with one message, non-zero exit | manual-only | Temporarily revoke "Update content" capability (same technique as `verify-403.ts`), run the script against 2+ unemailed posts, confirm exactly one abort message (not N) and `echo $?` shows non-zero | ❌ Wave 0 |
| D-05 abort path | `MissingEmailedPropertyError` aborts immediately | manual-only | Temporarily remove the `emailed` property (same technique as `01-UAT.md` test 3), run the script, confirm abort message and non-zero exit | ❌ Wave 0 |

**Justification for manual-only:** Identical rationale to Phase 1 — no test framework exists in this repo (explicit, tracked project decision), and this script's correctness depends on live Notion API timing/error behavior that would risk diverging from reality if mocked. The phase's own ROADMAP success criteria are already written as manual/observational ("logs a final count," "confirmed by inspecting timing/log output"), consistent with this approach.

### Sampling Rate
- **Per task commit:** Run `npm run backfill -- --dry-run` after implementing the fetch/dry-run path; run a real (small-scale, test-database) live run after implementing the write loop.
- **Per wave merge:** Run all four manual test scenarios above (N-marked/M-failed, resumability, rate compliance, both abort paths) end-to-end against a live test database before considering the phase done.
- **Phase gate:** Capture console output from each manual scenario as evidence (this repo has no CI to attach automated results to) — mirrors Phase 1's `01-UAT.md` precedent exactly.

### Wave 0 Gaps
- [ ] `packages/core/scripts/backfill.ts` — does not exist yet; this phase's entire deliverable.
- [ ] `packages/core/package.json`'s `backfill` script entry — does not exist yet.
- [ ] No framework install needed — explicitly out of scope.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No new auth surface — reuses `NOTION_TOKEN` exactly as `NologClient` already does |
| V3 Session Management | No | Not applicable — a one-shot CLI script, no session concept |
| V4 Access Control | No | Access control (Notion integration capability) is Notion-side configuration; this script only *detects and reports* a capability failure via already-shipped `NotionCapabilityError`, same as Phase 1 |
| V5 Input Validation | No new surface | The script takes no user-facing input beyond one boolean CLI flag (`--dry-run`, parsed via `parseArgs`, no injection surface) and post IDs that originate entirely from `NologClient`'s own query results — never from raw external/user input |
| V6 Cryptography | No | No crypto operations; token handling unchanged from Phase 1 |

### Known Threat Patterns for this phase's stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Console log output (per-post title/ID list in `--dry-run` and live-run modes) accidentally including sensitive data if a post title contains something private | Information Disclosure | Low risk in this project's threat model (post titles are already destined to be public blog content by definition — a post reaching this script's output is, by construction, `status === "public"`), but the planner should ensure only `post.title`/`post.id` are logged, never the raw Notion API response body or the integration token — consistent with Phase 1's already-established invariant (`NotionCapabilityError`/`MissingEmailedPropertyError` never leak the token) |
| A operator accidentally running the live (non-dry-run) mode against production before verifying dry-run output | Repudiation / accidental data loss (permanent `emailed=true` writes, per Phase 1 D-02's "once emailed, always emailed" lifecycle rule) | Already mitigated by this phase's own design (D-01/D-02/D-03: dry-run-first workflow, per-post preview list) — no additional control needed beyond what's already locked in |
| Exit code (D-08) being ignored by a calling script/human, masking partial failures | Repudiation | Not this phase's concern beyond emitting the correct exit code — downstream consumption (e.g., a wrapper CI job) is out of scope; D-08 already ensures the signal exists for any caller that does check it |

## Sources

### Primary (HIGH confidence)
- Direct inspection: `packages/core/src/client.ts` (full file), `packages/core/src/index.ts`, `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/scripts/verify-phase-1.ts`, `packages/core/scripts/verify-403.ts`, `.planning/phases/01-notion-data-layer/01-VERIFICATION.md`, `.planning/phases/01-notion-data-layer/01-UAT.md`, `.planning/phases/01-notion-data-layer/01-RESEARCH.md`, `.planning/codebase/CONCERNS.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` (all read 2026-07-25)
- `npm view tsx version` → `4.23.1`; `npm view tsx engines` → `{ node: '>=18.0.0' }`; `npm ls tsx --workspaces` → empty (confirms not currently declared) `[VERIFIED: npm registry / local repo, 2026-07-25]`
- `npx tsx --version` executed successfully in this session (cold, no prior local install) → `tsx v4.23.1`, `node v22.23.1` `[VERIFIED: command executed this session]`
- `node --version` → `v22.23.1`; `node -e "typeof require('node:util').parseArgs"` → `"function"` `[VERIFIED: command executed this session]`
- `.planning/phases/01-notion-data-layer/01-UAT.md` test 3 — live Notion confirmation that the `MissingEmailedPropertyError` regex matches real Notion 400 error text for the missing-property case (resolves this phase's Open Question 2 from the phase brief) `[VERIFIED: prior phase's live UAT evidence, cross-checked against current client.ts source]`

### Secondary (MEDIUM confidence — live doc fetch, this session, 2026-07-25)
- https://developers.notion.com/reference/request-limits — Notion's official rate-limit page: ~3 req/s average per connection, 429 response includes `Retry-After` header as integer-seconds, 529 handled the same way, proactive-queuing guidance `[CITED]`
- https://nodejs.org/api/util.html — `parseArgs` current documentation and stability marker `[CITED]`
- https://www.npmjs.com/package/tsx — current version confirmation, cross-checked against direct `npm view` `[CITED]`

### Tertiary (LOW confidence)
- None used for factual claims — all Notion-rate-limit and tooling claims were either verified via a tool run in this session or cited directly from official documentation fetched this session.

### Project-wide research already on disk (reconciled with, not re-derived)
- `.planning/phases/01-notion-data-layer/01-RESEARCH.md` — confirms this phase's data-layer dependency is already HIGH-confidence and fully shipped/verified; no re-derivation of Notion checkbox/filter shapes needed here
- `.planning/codebase/CONCERNS.md` — "Inefficient Pagination Error Handling in getPosts()" reconciled and clarified as **not applicable** to `getUnemailedPublicPosts()` (which already has its own `try/catch`, added in Phase 1 for D-01 detection) — see Pattern 1 above

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; `tsx`/`node:util` versions and behavior directly verified via tool execution and official docs this session
- Architecture: HIGH — this phase's entire scope reuses Phase 1's already-verified, live-tested data layer; the script itself is a straightforward serial loop with no novel architectural risk
- Pitfalls: MEDIUM — the resumability/error-classification pitfalls are HIGH confidence (directly verified against current source and Phase 1's live UAT evidence); the 429/`Retry-After` plumbing question (Pattern 2/Open Question 1) is a genuine, correctly-flagged planning decision rather than a fully resolved fact, since `NologClient`'s current implementation doesn't yet expose the header

**Research date:** 2026-07-25
**Valid until:** 30 days (stable domain — Notion's rate-limit documentation and Node's `parseArgs` API are both foundational/stable; re-verify sooner only if `NologClient`'s `patchPage()` is modified to add 429 handling, which would change Pattern 2's Pitfall 2 finding)
