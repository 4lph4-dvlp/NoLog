---
phase: 03-subscribe-path
plan: 01
subsystem: api
tags: [resend, next.js-route-handler, server-components, email-subscription, honeypot]

# Dependency graph
requires: []
provides:
  - "SubscribeSection/SubscribeForm component pair, gated server-side on RESEND_API_KEY + RESEND_AUDIENCE_ID"
  - "/api/subscribe Node-runtime route: validate -> normalize -> Resend contacts.create+update (unconditional pair)"
  - "apps/web/src/lib/email.ts — single Resend client construction seam (lazy getResend())"
  - "Two default-template insertion points in Layout.tsx (mobile block + desktop aside), both after Profile"
affects: [03-02-abuse-resistance, 03-03-terminal-template, phase-4-notify-subscribers]

# Tech tracking
tech-stack:
  added: ["resend@^6.18.0 (apps/web dependency only)"]
  patterns:
    - "Server-Component env gate + Client-Component island split for any secret-gated feature (SubscribeSection/SubscribeForm)"
    - "Lazy external-API-client accessor (getResend()) instead of eager module-load construction, to avoid a third-party SDK constructor throwing when unconfigured"
    - "Unconditional create-then-update pair as a structural (not tested) enumeration-safety guarantee"

key-files:
  created:
    - apps/web/src/lib/email.ts
    - apps/web/src/components/subscribe/SubscribeSection.tsx
    - apps/web/src/components/subscribe/SubscribeForm.tsx
    - apps/web/src/app/api/subscribe/route.ts
  modified:
    - apps/web/package.json
    - apps/web/src/templates/default/Layout.tsx
    - .planning/phases/03-subscribe-path/03-VALIDATION.md

key-decisions:
  - "resend package legitimacy SUS/too-new verdict approved by user as a confirmed false positive (seam read latest-version publish date, not package creation date; package is 9+ years old)"
  - "lib/email.ts switched from eager `export const resend = new Resend(...)` to a lazy `getResend()` accessor after discovering the installed SDK's constructor throws synchronously when RESEND_API_KEY is unresolvable — eager construction crashed `next build` for every unconfigured fork, defeating SUB-02's off-by-default contract before the route's own gate could run"

patterns-established:
  - "Pattern: any feature gated on a secret env var reads that var in exactly one Server Component and nowhere else (D-04 applied structurally)"
  - "Pattern: an external API client whose constructor may throw on missing config must be constructed lazily behind an accessor, never at module top-level, so an unconfigured deployment still builds"

requirements-completed: [SUB-01, SUB-02, SUB-03, SEC-03]

coverage:
  - id: D1
    description: "Visitor can submit an email via the default-template subscribe form; request traverses SubscribeSection gate -> SubscribeForm -> /api/subscribe -> validation -> Resend contacts.create+update"
    requirement: "SUB-01"
    verification:
      - kind: e2e
        ref: "curl POST /api/subscribe against a configured build with placeholder Resend credentials; response {ok:false,code:server_error} plus [Subscribe] log line proves the request reached the Resend SDK"
        status: pass
    human_judgment: true
    rationale: "SC#1 (address actually lands in a live Resend Audience) requires real credentials not available in this environment — carried to the operator checklist per D-26"
  - id: D2
    description: "Subscribe form is completely absent from server-rendered HTML when either Resend env var is unset, and a direct POST to /api/subscribe returns 404 with an operator-facing log line naming the missing var(s)"
    requirement: "SUB-02"
    verification:
      - kind: e2e
        ref: "build+serve with both RESEND_API_KEY/RESEND_AUDIENCE_ID unset; grep -c 'data-testid=\"subscribe-form\"' on / returns 0; curl -X POST /api/subscribe returns 404; server log contains '[Subscribe] Route called while unconfigured — missing: RESEND_API_KEY, RESEND_AUDIENCE_ID'"
        status: pass
    human_judgment: false
  - id: D3
    description: "Duplicate-email submission is structurally indistinguishable from a first-time submission: the create+update pair runs unconditionally with no branch on prior contact state between the two calls"
    requirement: "SUB-03"
    verification:
      - kind: unit
        ref: "node -e static-analysis script asserting no `return` and no exist/already/duplicate identifier between the `contacts.create` and `contacts.update` call sites in route.ts (03-01-PLAN.md T1 <verify> block)"
        status: pass
    human_judgment: true
    rationale: "Live half of SC#3 (two real submissions diffed byte-for-byte against a live Audience) requires real credentials — carried to the operator checklist per D-26"
  - id: D4
    description: "RESEND_API_KEY is read in exactly one Server Component (SubscribeSection), never enters any client module, and appears in zero files under the built client bundle"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "static-analysis scripts: no client directive on SubscribeSection.tsx, both env vars checked, no process.env in SubscribeForm.tsx, no client-directive module imports SubscribeSection"
        status: pass
      - kind: other
        ref: "grep -rl RESEND_API_KEY apps/web/.next/static/ after a configured production build — zero matches"
        status: pass
    human_judgment: false

duration: ~2h (across checkpoint pause and two continuation attempts)
completed: 2026-07-26
status: complete
---

# Phase 3 Plan 01: End-to-End Subscribe Tracer Summary

**Server-gated Resend subscribe form (SubscribeSection/SubscribeForm) wired through a Node-runtime `/api/subscribe` route to Resend's contacts API, with a fail-closed 404 boundary and a lazily-constructed client to keep unconfigured forks buildable.**

## Performance

- **Duration:** ~2h wall-clock across the original executor run, a blocking-human checkpoint pause (package legitimacy confirmation), and this continuation
- **Completed:** 2026-07-26T06:46:00Z
- **Tasks:** 2 (Task 03-01-T0 checkpoint resolved as satisfied; Task 03-01-T1 tracer; Task 03-01-T2 fail-closed boundary)
- **Files modified:** 8 (4 created, 4 modified, including the phase's VALIDATION.md and a new deferred-items.md)

## Accomplishments
- One production-quality path proven end to end: default-template SSR render -> `SubscribeSection` env gate -> `SubscribeForm` client island -> `POST /api/subscribe` -> validation -> `resend.contacts.create`+`.update` -> locale-mapped response
- Fail-closed contract closed on both sides: `SubscribeSection` returns `null` when either Resend env var is unset (SC#2), and the route independently returns 404 with an operator-only log line when called directly while unconfigured (D-22)
- Enumeration-safety (SUB-03) made structural, not tested: the unconditional `create`-then-`update({ unsubscribed: false })` pair runs identically for a first-time and a resubscribing address, verified by an automated absence-of-branch check
- Discovered and fixed a real correctness bug: the Resend SDK's constructor throws when unconfigured, which would have broken `next build` for every fork that never sets up Resend — the opposite of this project's core value

## Task Commits

Each task was committed atomically:

1. **Task 03-01-T1: End-to-end subscribe tracer** - `d53941d` (feat)
2. **Task 03-01-T2: Fail-closed configuration boundary** - `17cf095` (feat)

_Task 03-01-T0 (package legitimacy checkpoint) required no code commit — see Deviations below._

## Files Created/Modified
- `apps/web/src/lib/email.ts` - Single Resend client construction seam; lazy `getResend()` accessor (D-20)
- `apps/web/src/components/subscribe/SubscribeSection.tsx` - Sole Server-Component env gate for both Resend vars (D-04)
- `apps/web/src/components/subscribe/SubscribeForm.tsx` - Client form island: honeypot, locale copy, D-05/D-07/D-08 submit-state handling
- `apps/web/src/app/api/subscribe/route.ts` - Node-runtime POST handler: D-22 config gate, D-16 normalization, D-15 validation, D-17/D-18 Resend pair, D-24/D-25 PII-safe logging
- `apps/web/src/templates/default/Layout.tsx` - Two `<SubscribeSection variant="default" />` insertion points, both directly after `<Profile />`
- `apps/web/package.json` - Added `resend` dependency (apps/web only; `packages/core` untouched)
- `.planning/phases/03-subscribe-path/03-VALIDATION.md` - Per-task verification map populated for T0/T1/T2
- `.planning/phases/03-subscribe-path/deferred-items.md` - New file logging a pre-existing, out-of-scope lint failure

## Decisions Made
- Package legitimacy checkpoint (03-01-T0) resolved: the `resend` npm package's `SUS`/`too-new` verdict is a confirmed false positive (seam read the latest version's publish date, not the package's 2017 creation date; 166 versions, no install scripts, first-party `resend/resend-node` repo). User approved proceeding with `npm install resend --workspace=apps/web`.
- Used the SDK's deprecated `audienceId`-based `LegacyCreateContactOptions` overload for `contacts.create` (rather than the newer Segments-based `CreateContactOptions`), matching the plan's `RESEND_AUDIENCE_ID`-based design (D-19) exactly. Confirmed via the installed package's own `.d.ts` files — no divergence from the research's `{ data, error }` tuple assumption (A1).
- Switched `lib/email.ts` from eager to lazy Resend client construction (see Deviations) — reversible, single-file change, preserves D-20's "no default/fallback/hard-coded value" constraint in both letter and spirit since construction now happens strictly on first call, never with a placeholder value.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy-constructed the Resend client to prevent a build crash on unconfigured forks**
- **Found during:** Task 03-01-T2, running the unconfigured-env build gate (`env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run build --workspace=apps/web`)
- **Issue:** `lib/email.ts` originally exported `export const resend = new Resend(process.env.RESEND_API_KEY);` at module top level, per the plan's literal snippet. The installed `resend@6.18.0` SDK's constructor throws synchronously (`"Missing API key..."`) when no key is resolvable from either the constructor argument or `process.env.RESEND_API_KEY`. Because Next.js's build-time page-data-collection phase imports and evaluates every route module (including `/api/subscribe/route.ts`, which imports `lib/email.ts`), this crashed `next build` outright for any fork that never sets Resend env vars — directly contradicting SUB-02's off-by-default contract and the project's core value that every optional feature stays inert, not broken, until configured.
- **Fix:** Replaced the eager `export const resend = ...` with a lazy `export function getResend(): Resend` that constructs and memoizes the client only on first call. The route calls `getResend()` inside `POST()`, after the D-22 configuration gate has already returned 404 for an unconfigured request — so in practice the SDK constructor is never invoked without a real (or at least present) `RESEND_API_KEY`. No default, fallback, or hard-coded key value was introduced anywhere in the file; D-20 is preserved in full, just with deferred timing.
- **Files modified:** `apps/web/src/lib/email.ts`, `apps/web/src/app/api/subscribe/route.ts`
- **Verification:** `env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run build --workspace=apps/web` now succeeds; configured build/serve still shows the SC#2 form marker and reaches the Resend SDK (proven by the `[Subscribe] Resend contact create failed` log line against fake credentials); all of T1's static gates (D-17/D-18/D-24/D-25 create/update ordering and no-branch checks) still pass unchanged.
- **Committed in:** `17cf095` (Task 03-01-T2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix), plus 1 out-of-scope item logged to `deferred-items.md` (not fixed, per scope-boundary rule)
**Impact on plan:** The Rule 1 fix was necessary for the project's core off-by-default guarantee to hold at all; no scope creep, no security-boundary change, no new file beyond the one already planned (`lib/email.ts`).

## Issues Encountered
- `npm run lint --workspace=apps/web` fails on 15 pre-existing errors in `apps/web/src/templates/terminal/components/TerminalConsole.tsx` (2x `react-hooks/immutability`, 6x `react/no-unescaped-entities`, plus warnings), confirmed via `git stash -u` to predate every change in this plan. Not fixed, per the scope-boundary rule (out of scope: file not in this plan's `files_modified`). Logged to `.planning/phases/03-subscribe-path/deferred-items.md`. Verified this plan's own files lint clean in isolation via `npx eslint <plan's files>` (zero errors, zero warnings) as a workaround for the literal `<verify>` command, which cannot pass as written until that pre-existing file is fixed independently.

## User Setup Required
None required to close this plan's own success criteria — all four locally-closable checks (SC#2, SC#5, plus the structural half of SC#3, plus SUB-01's placeholder-credential tracer) are green without any real Resend account. Per D-26, two items remain on the operator checklist before shipping the feature for real:
- SC#1: confirm a real submitted address actually lands in the configured Resend Audience
- SC#3 live half: diff two real submissions of the same address byte-for-byte

`03-01-PLAN.md`'s `user_setup` block documents the exact env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`) and dashboard steps a forker needs for real use; none of it is required for this plan's own gates.

## Next Phase Readiness
- The tracer's architecture (Server/Client split, `lib/email.ts` seam, D-21 response codes, D-23 pipeline shape) is proven and ready for Plan 03-02 to insert the rate-limit and honeypot-check stages between validation and the env gate without touching what already works.
- Plan 03-03 can add the `terminal` variant's visual treatment to `SubscribeForm` and wire `SubscribeSection variant="terminal"` into `templates/terminal/PostPage.tsx` — the variant prop and submit logic are already structured to accept that without changes here.
- No blockers. The one open item (pre-existing `TerminalConsole.tsx` lint failures) does not block this phase; flagged in `deferred-items.md` for whoever next edits that file.

## Self-Check: PASSED

All created files confirmed present on disk (`apps/web/src/lib/email.ts`,
`apps/web/src/components/subscribe/SubscribeSection.tsx`,
`apps/web/src/components/subscribe/SubscribeForm.tsx`,
`apps/web/src/app/api/subscribe/route.ts`, this SUMMARY, `deferred-items.md`). Both task
commits (`d53941d`, `17cf095`) confirmed present in `git log --oneline --all`.

---
*Phase: 03-subscribe-path*
*Completed: 2026-07-26*
