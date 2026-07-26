---
phase: 03-subscribe-path
plan: 03
subsystem: ui
tags: [next.js-server-components, terminal-template, subscribe-form, cli-prompt-ui]

# Dependency graph
requires:
  - phase: 03-subscribe-path (plan 03-01)
    provides: "SubscribeSection/SubscribeForm gate pair, gated on RESEND_API_KEY + RESEND_AUDIENCE_ID"
  - phase: 03-subscribe-path (plan 03-02)
    provides: "Complete D-23 pipeline in /api/subscribe (unrelated to this plan's files; confirmed no overlap)"
provides:
  - "Terminal presentation branch inside SubscribeForm — CLI-prompt aesthetic sharing one fetch call, one honeypot block, and one error-code-mapping function with the default branch"
  - "subscribeSlot prop on TerminalPostPage, rendered between the post article and the terminal console"
  - "Server-side construction of <SubscribeSection variant=\"terminal\" /> in the post route, passed down as an already-rendered element"
affects: [phase-4-notify-subscribers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-Component-as-slot: a client-directive template receives a pre-rendered gate element as a prop rather than importing the gate itself, keeping a secret-gated Server Component out of the client module graph"
    - "Single error-code-to-message function parameterized by variant, so the code->bucket branching logic stays written once while wording differs per presentation register"

key-files:
  created: []
  modified:
    - apps/web/src/components/subscribe/SubscribeForm.tsx
    - apps/web/src/templates/terminal/PostPage.tsx
    - apps/web/src/app/post/[id]/page.tsx

key-decisions:
  - "Restructured SubscribeForm into two full render branches (default card, terminal CLI-prompt) rather than one shared markup tree with className ternaries, so data-testid=\"subscribe-form\" appears twice in source (once per variant) as the plan's verification requires — state, handleSubmit, and the honeypot JSX stayed defined exactly once above the branch point and are reused by reference in both"
  - "errorMessage(code, variant) kept as one function with the code->bucket branching (invalid_email / rate_limited / generic) written once, taking a variant parameter so the terminal branch gets its own ERR:-prefixed wording without duplicating which codes map to which bucket — reconciles the plan's 'mapping written exactly once' instruction with its separate 'terminal branch may use its own wording, must not fall through to default's strings' instruction"
  - "Preserved the plan's Architectural constraint exactly: apps/web/src/app/post/[id]/page.tsx (Server Component, no client directive) constructs <SubscribeSection variant=\"terminal\" /> and passes it as subscribeSlot; apps/web/src/templates/terminal/PostPage.tsx (client directive, useRouter/useEffect) renders {subscribeSlot} directly with no emptiness check and no import from the subscribe component directory. Do not simplify this back to a direct import in that file — the gate would evaluate in client code where RESEND_API_KEY/RESEND_AUDIENCE_ID resolve to undefined, and every other automated check in this phase would still read green while SUB-01 silently broke across the terminal template"

patterns-established:
  - "Pattern: when a secret-gated Server Component must render inside a client-directive template, the client-side ancestor accepts the gate as a ReactNode prop constructed by its nearest Server Component caller — never as a direct import — this is now the second precedent (after 03-01's default-Layout direct-import case) a third template author should read as \"it depends on whether your template file itself carries a client directive\""

requirements-completed: [SUB-01, SUB-02, SEC-03]

coverage:
  - id: D1
    description: "SubscribeForm renders a genuinely distinct terminal CLI-prompt treatment (prompt-line invitation, argument-style input with a prompt glyph, bracketed terminal-register submit control, OK:/ERR: outcome markers) sharing one submit path, one honeypot block, and one error-mapping function with the default card variant"
    requirement: "SUB-01"
    verification:
      - kind: unit
        ref: "node -e static-analysis script (03-03-PLAN.md T1 <verify> block 1): exactly one fetch( call, data-testid=\"subscribe-form\" present >=2 times across both branches — pass"
        status: pass
      - kind: unit
        ref: "node -e static-analysis script (T1 <verify> block 2): terminal branch composes terminal-prompt/terminal-dim/terminal-border tokens, zero raw hex values, all three D-21 codes mapped, locale ternary count >=8 (measured: 18) — pass"
        status: pass
      - kind: unit
        ref: "node -e static-analysis script (T1 <verify> block 3): honeypot name=\"company\" written exactly once, no computed-style-detectable hiding technique — pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The terminal placement travels below the post via a Server-rendered slot rather than a direct client-side import: TerminalPostPage never imports the subscribe component directory or reads process.env, and post/[id]/page.tsx (still a Server Component) constructs the gate and passes it down only in the terminal branch"
    requirement: "SEC-03"
    verification:
      - kind: unit
        ref: "node -e static-analysis script (03-03-PLAN.md T2 <verify> block 1): terminal PostPage.tsx retains its client directive, contains no /components\\/subscribe/ reference, no process.env, and renders subscribeSlot strictly between </article> and the h-[50vh] console block — pass"
        status: pass
      - kind: unit
        ref: "node -e static-analysis script (T2 <verify> block 2): post/[id]/page.tsx has no client directive, imports SubscribeSection, passes subscribeSlot={<SubscribeSection variant=\"terminal\" />} only in the terminal branch, and DefaultPostPage receives no slot — pass"
        status: pass
      - kind: unit
        ref: "node -e repo-wide scan (T2 <verify> block 3): no file under apps/web/src beginning with a client directive imports subscribe/SubscribeSection; site.config.ts still reads template: \"default\" — pass"
        status: pass
      - kind: other
        ref: "env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run build --workspace=apps/web && grep -rl RESEND_API_KEY apps/web/.next/static/ — build succeeded, zero matches (SC#5 held with both template paths present)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A live terminal-template post page shows the subscribe form (marker present) when both Resend vars are configured and shows it zero times when either is unset, visually seated between the article and the console"
    requirement: "SUB-02"
    verification: []
    human_judgment: true
    rationale: "Requires a resolvable post id from a live Notion database; NOTION_TOKEN/NOTION_DATABASE_ID are absent in this execution environment (STATE.md Blockers/Concerns, carried from Phases 1-2). A synthetic id 404s before reaching the template and proves nothing, per the plan's own guidance. Carried to the operator checklist alongside D-26's existing items rather than reported as passed; the two credential-free static boundary gates above (D2) are what actually protect SEC-03/SUB-02 here."

duration: ~20min
completed: 2026-07-26
status: complete
---

# Phase 3 Plan 03: Terminal Template Subscribe Variant Summary

**Added a CLI-prompt presentation branch to SubscribeForm and wired it into the terminal template's post page via a Server-rendered `subscribeSlot` prop, keeping `SubscribeSection` as the feature's single environment gate even though the terminal template is a client-directive file.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-26
- **Tasks:** 2 (03-03-T1 terminal presentation variant, 03-03-T2 Server-rendered slot placement)
- **Files modified:** 3

## Accomplishments
- `SubscribeForm` now renders two structurally distinct trees behind its existing `variant` prop: the 03-01 default card, and a new terminal CLI-prompt register (prompt-line invitation, argument-style input with a `>` glyph, bracketed `[run]`/`[전송 중…]` submit control, `OK:`/`ERR:` outcome markers matching the terminal template's existing failure register at `PostPage.tsx:85`) — both branches share one `fetch(` call, one honeypot block (written once, referenced by both), and one error-code-to-message function.
- Resolved the plan's flagged architectural constraint: `apps/web/src/templates/terminal/PostPage.tsx` carries a client directive (`useRouter`/`useEffect`), so it cannot import `SubscribeSection` directly without pulling the env-var gate into client code, where `process.env.RESEND_API_KEY`/`RESEND_AUDIENCE_ID` would resolve to `undefined` and silently break the form on every deployment while every other automated gate stayed green. Fixed by having `apps/web/src/app/post/[id]/page.tsx` (a Server Component) construct `<SubscribeSection variant="terminal" />` and pass it down as an optional `subscribeSlot` prop, rendered directly with no additional emptiness check.
- D-04's single-gate contract holds after adding a second template: the repo-wide scan confirms no client-directive module anywhere under `apps/web/src` imports `SubscribeSection`, and the SC#5 bundle grep is clean after a build with both `default` and `terminal` template code paths present.
- D-03's intentional asymmetry preserved: only the terminal branch of the post route receives a `subscribeSlot`; `DefaultPostPage` is untouched, since its form already renders from the layout on every page.

## Task Commits

Each task was committed atomically:

1. **Task 03-03-T1: Terminal presentation variant** - `8345901` (feat)
2. **Task 03-03-T2: Terminal placement via Server-rendered slot** - `3372ae9` (feat)

## Files Created/Modified
- `apps/web/src/components/subscribe/SubscribeForm.tsx` - Split into `default`/`terminal` render branches sharing state, `handleSubmit`, the honeypot JSX, and a variant-parameterized `errorMessage()` mapping function
- `apps/web/src/templates/terminal/PostPage.tsx` - Added optional `subscribeSlot?: React.ReactNode` prop, rendered between `</article>` and the terminal console block; no import from the subscribe component directory, no env read
- `apps/web/src/app/post/[id]/page.tsx` - Imports `SubscribeSection`; terminal branch of template routing now passes `subscribeSlot={<SubscribeSection variant="terminal" />}` to `TerminalPostPage`; default branch unchanged

## Decisions Made
- See `key-decisions` in frontmatter for the three decisions made during this plan (form restructuring into two branches, the shared-mapping-with-variant-parameter design for error copy, and the exact Architectural-constraint reconciliation). No decision required a checkpoint or user input — all three are direct, literal implementations of what the plan's Architectural constraint section and D-01/D-02/D-04/D-06 already specified.

## Deviations from Plan

None - plan executed exactly as written, including the Architectural constraint's prescribed resolution (Server-rendered slot rather than direct import).

## Issues Encountered
- Same pre-existing, out-of-scope lint failures documented in `03-01-SUMMARY.md`/`03-02-SUMMARY.md` and `deferred-items.md`: `npm run lint --workspace=apps/web` fails on 15 pre-existing errors in `apps/web/src/templates/terminal/components/TerminalConsole.tsx` (a file this plan does not touch), plus two pre-existing issues in `apps/web/src/templates/terminal/PostPage.tsx` itself — an unused `CONFIG` import and a `recordMap: any` type — both present in that file before this plan's edits (confirmed against the file as read at plan start) and outside this plan's `<files>` scope for T1's lint gate. Verified this plan's own new/changed logic lints clean in isolation: `npx eslint apps/web/src/components/subscribe/SubscribeForm.tsx` and `npx eslint "apps/web/src/app/post/[id]/page.tsx"` both report zero errors and zero warnings. `npx tsc --noEmit -p apps/web/tsconfig.json` passes with no errors across the whole project.
- The terminal SSR configured/unconfigured differential (this plan's `<human-check>`) could not be run: no `NOTION_TOKEN`/`NOTION_DATABASE_ID` are present in this execution environment (confirmed via `env | grep -i NOTION`), matching the blocker STATE.md has carried since Phase 1/2. Recorded as an operator-checklist item (coverage entry D3 above) rather than reported as passed, per the plan's own instruction. The two credential-free static boundary gates (D2 above) are what actually close SEC-03/SUB-02 in this environment.

## User Setup Required
None to close this plan's own locally-provable gates. Before the terminal template can be verified end-to-end for real, an operator needs:
- `NOTION_TOKEN`/`NOTION_DATABASE_ID` (to resolve a real post id and set `CONFIG.template` to `"terminal"` for the SSR probe — carried from 03-01/03-02's already-open operator checklist)
- `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` (already documented in `03-01-PLAN.md`'s `user_setup` block)

This item joins the existing operator checklist (SC#1 live Audience confirmation, SC#3 live duplicate-submission diff from 03-01) rather than opening a new one.

## Next Phase Readiness
- Phase 3's subscribe path is now complete across both templates: tracer (03-01), abuse resistance (03-02), and the terminal variant + placement (03-03). No blockers for Phase 4 (notify-subscribers) — this plan touched no file in `packages/core`, `apps/web/src/app/api/subscribe/route.ts`, or `apps/web/src/site.config.ts` (all confirmed no-diff).
- If a third template is ever added to this repo, the two now-established precedents are: (1) if the template's root layout/page is a Server Component (no client directive), import `SubscribeSection` directly as `default`'s `Layout.tsx` does; (2) if it is a client-directive file, construct the gate one level up in the nearest Server Component and pass it down as a slot prop, as this plan did. Both keep the single env-read gate intact.
- No blockers.

## Self-Check: PASSED

Confirmed on disk: `apps/web/src/components/subscribe/SubscribeForm.tsx` contains both `"terminal"` render branch content and `data-testid="subscribe-form"` twice; `apps/web/src/templates/terminal/PostPage.tsx` contains `subscribeSlot`; `apps/web/src/app/post/[id]/page.tsx` contains `SubscribeSection` and `variant="terminal"`. Both task commits (`8345901`, `3372ae9`) confirmed present via `git log --oneline -5`. `git diff --name-only` across both commits touches only the three files listed above; `apps/web/src/site.config.ts` and `packages/core` confirmed byte-identical to before this plan (`git diff` empty for both).

---
*Phase: 03-subscribe-path*
*Completed: 2026-07-26*

## Self-Check: PASSED (verified)

All three created/modified files confirmed present on disk; both task commits (`8345901`, `3372ae9`) confirmed present in `git log --oneline --all`.
