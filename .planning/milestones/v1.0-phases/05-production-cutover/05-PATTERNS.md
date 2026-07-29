# Phase 5: Production Cutover - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 2 (1 new, 1 conditionally modified) + 1 documentation artifact
**Analogs found:** 2 / 2 code files (no direct `vercel.json` analog exists in-repo; nearest analogs are the project's other root-adjacent config files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `vercel.json` (repo root, new) | config | batch (scheduled trigger) | `apps/web/next.config.ts`, `apps/web/postcss.config.mjs` | role-match (no cron-config analog exists; these are the project's only precedent for "small root-adjacent static config object") |
| `apps/web/src/app/api/notify-subscribers/route.ts` (conditional edit, D-05 contingency only) | config (constant tuning) | request-response | itself (prior version, lines 1–16) | exact (self-analog — same file, same convention, just retuning a number + comment) |
| Commit-1 record of backfill confirmation (new `.md`, exact filename is planner's/Claude's discretion) | test/verification doc | event-driven (one-time operator-reported outcome) | `.planning/phases/04-notify-route/04-03-SUMMARY.md` | exact |

## Pattern Assignments

### `vercel.json` (config, batch/scheduled-trigger)

**No in-repo `vercel.json` analog** — this is the first one. Nearest structural analogs are the project's other minimal root-level-ish config files, which establish the project's conventions for config file shape (small, flat, no unnecessary options, TypeScript-first where possible but plain JSON is correct here since Vercel requires `vercel.json` specifically as JSON):

**`apps/web/next.config.ts`** (full file, 16 lines) — shows the project's "small, flat object literal, only the fields actually needed" convention:
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.us-west-2.amazonaws.com" },
      { protocol: "https", hostname: "prod-files-secure.s3.us-west-2.amazonaws.com" },
    ],
  },
};

export default nextConfig;
```

**`apps/web/postcss.config.mjs`** (full file, 6 lines) — even more minimal, confirms the "no boilerplate beyond what's needed" pattern:
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

**Pattern to apply to `vercel.json`:** flat JSON object, only the `crons` array (and optionally `functions` if SC#3's contingency requires an explicit `maxDuration`), per D-02/D-03/Claude's Discretion in 05-CONTEXT.md:

```json
{
  "crons": [
    {
      "path": "/api/notify-subscribers",
      "schedule": "0 11 * * *"
    }
  ]
}
```

If the operator's live dashboard check (SC#3) surfaces a `maxDuration` that needs to be pinned explicitly (rather than left to Vercel's project-level default), extend with a `functions` block scoped to the exact route path, matching Vercel's documented schema:

```json
{
  "functions": {
    "apps/web/src/app/api/notify-subscribers/route.ts": {
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/notify-subscribers",
      "schedule": "0 11 * * *"
    }
  ]
}
```

Note: whether the `functions` key is needed at all is Claude's Discretion per 05-CONTEXT.md — only add it if the operator's dashboard check reveals the project-level default doesn't already match the confirmed figure.

---

### `apps/web/src/app/api/notify-subscribers/route.ts` (config constant, conditional edit — D-05 only)

**Analog:** itself, current state (lines 1–16), read directly:

```typescript
import { timingSafeEqual } from "node:crypto";
import { getResend } from "@/lib/email";
import { getUnemailedPublicPosts, markEmailed } from "@/lib/notion";
import { CONFIG } from "@/site.config";
import { NotionCapabilityError, type Post } from "@4lph4/nolog-core";

export const runtime = "nodejs";

// D-10/D-11/D-12: a reasoned default, not an authoritative one, against
// Vercel Hobby's confirmed 300s maxDuration (04-RESEARCH.md Pitfall 3) — the
// realistic bottleneck is Notion's own per-request latency, not the 300s
// ceiling, and 50 new posts in one digest is already a generous upper bound
// for a personal blog. NOTIFY_BATCH_SIZE exists precisely so Phase 5's live
// duration check can retune this without a code change.
const NOTIFY_BATCH_SIZE_DEFAULT = 50;
```

**Pattern to apply if D-05's contingency triggers:** only the constant value and its explanatory comment change — no other line in the file. Keep the existing comment-block convention (multi-line `//` comment directly above the constant, referencing the specific decision IDs it resolves, per this project's "Explain why something was done, not what" comment convention from CLAUDE.md). Update the comment to state the actual confirmed `maxDuration` figure and the new batch size rationale, e.g.:

```typescript
// D-10/D-11/D-12, retuned per Phase 5 SC#3: live Vercel dashboard check on
// [date] confirmed maxDuration=<actual value>s for this project (see
// 05-VERIFICATION.md). Batch size adjusted accordingly.
const NOTIFY_BATCH_SIZE_DEFAULT = <new value>;
```

Do not touch `NOTIFY_BATCH_SIZE` (the env-var override) — only `NOTIFY_BATCH_SIZE_DEFAULT`'s literal value and comment are in scope, per 05-CONTEXT.md's Integration Points.

---

### Commit-1 record (backfill confirmation document)

**Analog:** `.planning/phases/04-notify-route/04-03-SUMMARY.md` — the project's established operator-verification documentation convention (frontmatter + coverage table + manual_procedural verification kind + human_judgment flag).

**Frontmatter/coverage pattern** (04-03-SUMMARY.md lines 1–104): each verified scenario is recorded as a table row with `id`, `description`, `requirement`, `verification` (kind: `manual_procedural`, a `ref` string quoting the actual observed output/response), `status` (`pass`/`gap`), and `human_judgment` boolean. Example single entry to mirror for the backfill confirmation:

```yaml
  - id: D1
    description: "getUnemailedPublicPosts() returns zero posts against production Notion database after backfill completes"
    requirement: "OPS-01"
    verification:
      - kind: manual_procedural
        ref: "Operator ran `npm run backfill` (dry-run then live) per Phase 2 D-01/D-02 against production NOTION_TOKEN/NOTION_DATABASE_ID. [operator-reported output/count here]. Follow-up getUnemailedPublicPosts() check returned 0 posts."
        status: pass
    human_judgment: true
```

**Narrative section pattern** (04-03-SUMMARY.md lines 107–153): a short "Accomplishments" paragraph, a results table, "Decisions Made" bullets, "User Setup Completed" bullets (only if relevant — e.g. dashboard `maxDuration` figure confirmed), and a "Next Phase Readiness" section closing out ROADMAP success criteria by ID. Apply this exact section-header shape to Phase 5's commit-1 document, substituting SC#1/SC#3 for the criteria being closed here.

---

## Shared Patterns

### Config file minimalism
**Source:** `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`
**Apply to:** `vercel.json`
No fields beyond what the phase's decisions (D-02, D-03, and the SC#3 contingency) actually require. No commented-out alternatives, no speculative future options.

### Decision-ID-referencing comments
**Source:** `apps/web/src/app/api/notify-subscribers/route.ts` lines 9–14
**Apply to:** any comment added/edited in the route file for D-05's contingency
Comments cite the specific decision IDs (`D-10/D-11/D-12`) and the concrete number/fact they resolve — not vague justification. Follow the same shape when updating for Phase 5.

### Operator-verification documentation
**Source:** `.planning/phases/04-notify-route/04-03-SUMMARY.md`
**Apply to:** the commit-1 backfill-confirmation record
`manual_procedural` verification kind, `human_judgment: true` for anything requiring operator judgment (both SC#1 and SC#3 checks in this phase qualify), and quoted operator-reported output as the `ref` field — never fabricated/assumed output.

### Direct-to-main, no-PR commit workflow
**Source:** project-wide convention noted in 05-CONTEXT.md D-04, consistent with commit history (`a344c95`, `ac4e88c`, `36aba04`, etc. — all direct commits, no merge commits)
**Apply to:** both of this phase's commits (backfill-confirmation record, then separately the `vercel.json` cron entry)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `vercel.json` | config | batch (scheduled trigger) | First cron/scheduled-config file in this repo; no direct precedent exists. Use Vercel's own documented schema (`crons[].path`, `crons[].schedule`, optional `functions[path].maxDuration`) rather than a codebase analog for the JSON shape itself — only the "minimal, flat, no unused fields" convention is borrowed from `next.config.ts`/`postcss.config.mjs`. |

## Metadata

**Analog search scope:** repo root (config files), `apps/web/src/app/api/notify-subscribers/`, `.planning/phases/04-notify-route/`
**Files scanned:** `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/src/app/api/notify-subscribers/route.ts` (lines 1–40), `packages/core/package.json`, `.planning/phases/04-notify-route/04-03-SUMMARY.md`
**Pattern extraction date:** 2026-07-27
