# Phase 2: Backfill Script - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-25
**Phase:** 2-Backfill Script
**Areas discussed:** Safety gate before writing, Systemic-failure handling, Throttle strategy, Invocation & location

---

## Safety gate before writing

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, --dry-run flag | Run with --dry-run first to see exactly what would change, no writes | ✓ |
| No, always live | Script only ever runs in write mode | |

**User's choice:** Yes, --dry-run flag

| Option | Description | Selected |
|--------|-------------|----------|
| No extra confirmation | --dry-run already gives a preview step; a second confirmation is redundant friction | ✓ |
| Interactive y/n prompt | Pause and wait for typed 'y' before writing | |
| Explicit --confirm flag required | Live writes only happen with --confirm explicitly passed | |

**User's choice:** No extra confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Count + per-post titles | Numbered list of titles/IDs, lets you spot-check | ✓ |
| Count only | Just a number | |

**User's choice:** Count + per-post titles

---

## Systemic-failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| Abort immediately | Detect NotionCapabilityError and stop with one clear message | ✓ |
| Keep going, log each as failed | Treat like any other per-post failure | |

**User's choice:** Abort immediately

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same treatment | MissingEmailedPropertyError gets the same abort-immediately treatment | ✓ |
| Different handling | Handle differently | |

**User's choice:** Yes, same treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Log and continue | Transient per-post failures logged, run continues | ✓ |
| Abort on any failure | Any error stops the run | |

**User's choice:** Log and continue

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, non-zero exit if M > 0 | Distinguish full success from partial failure via exit status | ✓ |
| Always exit 0 if it didn't abort | Exit code only reflects crash/abort | |

**User's choice:** Yes, non-zero exit if M > 0

---

## Throttle strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed delay per markEmailed call | Sleep a fixed ms amount between each PATCH call | ✓ |
| Token bucket / rate limiter | Proper rate-limiter abstraction | |

**User's choice:** Fixed delay per markEmailed call

| Option | Description | Selected |
|--------|-------------|----------|
| 400ms delay (~2.5 req/s) | ~17% headroom below the documented limit | ✓ |
| 350ms delay (~2.85 req/s) | Minimal headroom | |
| 500ms delay (2 req/s) | Wide safety margin | |

**User's choice:** 400ms delay (~2.5 req/s)

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once with backoff | Honor Retry-After or short fixed backoff, retry once before counting as failed | ✓ |
| Treat as a normal per-post failure | No special retry logic | |

**User's choice:** Retry once with backoff

---

## Invocation & location

| Option | Description | Selected |
|--------|-------------|----------|
| Same location + npm script wrapper | Keep in packages/core/scripts/, add a package.json script entry | ✓ |
| Same location, raw tsx only | No npm script entry, document raw command in README | |
| New top-level location | Own place outside packages/core/scripts/ | |

**User's choice:** Same location + npm script wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| npm run backfill -- --dry-run | Standard npm pass-through syntax | ✓ |
| Separate npm scripts per mode | Two distinct commands (backfill:dry-run, backfill) | |

**User's choice:** npm run backfill -- --dry-run

| Option | Description | Selected |
|--------|-------------|----------|
| Same as existing scripts — shell env vars only | Consistent with verify-*.ts, no new dependency | ✓ |
| Auto-load apps/web/.env.local | Convenience, but requires a dotenv dependency and path assumption | |

**User's choice:** Same as existing scripts — shell env vars only

---

## Claude's Discretion

- Exact log line format/verbosity for per-post progress — follow the existing terse `verify-phase-1.ts`/`verify-403.ts` style.
- Exact wording of the D-04/D-05 abort messages — mirror `NotionCapabilityError`/`MissingEmailedPropertyError`'s existing constructor messages.
- Exact npm script name (`backfill` vs. something more specific) — no strong preference expressed, left to the planner.

## Deferred Ideas

None — all four areas stayed within Phase 2's backfill-script boundary. No scope creep occurred.
