# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Email Subscription for New Posts

**Shipped:** 2026-07-29
**Phases:** 6 | **Plans:** 17 | **Tasks:** 33

### What Was Built
- `NologClient.getUnemailedPublicPosts()`/`markEmailed()` with typed `NotionCapabilityError`/`MissingEmailedPropertyError` for distinguishable 403 handling
- A throttled, resumable backfill CLI that marks every pre-existing public post `emailed` before cron ever runs
- A fully gated `/api/subscribe` route + form (default and terminal template variants), hardened through 5 gap-closure rounds against rate-limit-key spoofing, cross-site origin abuse, and log-volume DoS
- `/api/notify-subscribers`: a single Resend Broadcast digest per cron run, per-post-section isolation, capability-aware mark-after-send, timing-safe `CRON_SECRET` auth
- A deliberately separate production cutover (backfill-confirmed-empty, then the cron entry as its own commit) that enforces the fail-safe deploy order
- Complete bilingual (README.md/README_KR.md) setup documentation covering every known silent-failure trap

### What Worked
- Splitting Production Cutover into its own phase (rather than folding OPS-01 into Phase 4) made the backfill-before-cron ordering a structural guarantee instead of relying on developer discipline — validated as the right call by the retrospective review.
- The tracer-then-gap-closure pattern in Phase 3 (6 plans: 1 tracer + 5 targeted gap closures) caught real, escalating security findings (rate-limit spoofing → CSRF-style origin abuse → log-volume DoS) each from a fresh code review pass, rather than trying to anticipate all of them upfront.
- Live-credential operator verification (Phases 1, 2, 3, 4, 5) caught things static/code-level verification couldn't: a wrong assumption about Notion's property casing (CR-01, Phase 1), the real Vercel Hobby `maxDuration` (300s, not assumed from docs), and confirmed Resend's unsubscribe headers actually fire.

### What Was Inefficient
- Phase 1's CR-01 gap-closure/re-fix/revert cycle cost a full extra round trip: the original defect diagnosis was based on internal code consistency (`mapPageToPost()`'s key ordering) rather than checking the live Notion database directly, and the "fix" turned out to be wrong. Confirming against the real external system first would have skipped it entirely.
- Two findings were left as documented-but-unverified at Phase 4 close (Notion capability-revocation 403 never reproduced live in two attempts; NOTIFY-04's per-post isolation exercised only at the code-review level, since no live-editable Notion field could trigger the fault path) — both got carried forward as open items all the way to milestone close rather than being resolved or explicitly descoped earlier.
- A file-naming collision in Phase 5 (`05-01-VERIFICATION.md`, a per-plan coverage doc, alphabetically shadowing the real `05-VERIFICATION.md` goal-verification report) caused the automated `init.manager` tooling to falsely report the phase as unverified at milestone close, requiring manual investigation and an explicit user override to proceed.

### Patterns Established
- Server-Component env-var gating (not `NEXT_PUBLIC_*`) is the standard for any secret-backed optional feature in this repo — established explicitly because `RESEND_API_KEY` is a secret, unlike Cusdis's public app ID.
- "Fail-closed, not fail-open" is enforced as the actual spec for every env-gated optional feature (not a nice-to-have), motivated directly by the real Cusdis privacy leak found and fixed this same session.
- Module-scope boolean latches (`originRejectionLogged`, `unconfiguredLogged`) are the established pattern for bounding per-instance log volume on hot, unauthenticated, off-by-default request paths without changing response contracts.

### Key Lessons
1. When a defect diagnosis rests on internal code consistency rather than the live external system, verify against the real system before "fixing" — a live-DB screenshot would have prevented Phase 1's CR-01 revert-then-refix cycle.
2. Per-plan artifacts that share a `*-VERIFICATION.md` suffix pattern with the phase-level goal-verification report can silently shadow it in naming-convention-dependent tooling — worth a distinct suffix (e.g. `*-COVERAGE.md`, already used elsewhere in this project) for any future per-plan verification/coverage doc.
3. Splitting a phase around a single requirement (Phase 5 / OPS-01) is worth it when the requirement's *ordering* relative to other phases (not just its own correctness) is the actual risk being managed.

### Cost Observations
- Sessions: this was executed as one continuous planning-to-ship arc across 6 phases.
- Notable: 5 of Phase 3's 6 plans were gap-closure rounds driven by fresh code-review passes rather than upfront design — cheap relative to shipping a CSRF-style vulnerability or an unbounded log-volume DoS to a public, off-by-default form.

---

## Milestone: v1.1 — Live Blog Bug Fixes & Reading Width

**Shipped:** 2026-08-14
**Phases:** 4 | **Plans:** 15 | **Tasks:** 23 | **Commits:** ~161

### What Was Built
- Per-leg failure isolation in `post/[id]/page.tsx` (two independent `try`/`catch` blocks, distinct log prefixes) plus an app-level `classifyMissingPost()` discriminator and a `PostUnavailable` state, so a chrome failure can no longer blank an already-fetched body and a transient metadata failure no longer 404s a live post
- The content-rendering fix itself: Cloudflare was answering `notion-client`'s default `user-agent: node` with a 403 challenge page. Fixed with an honest self-identifying User-Agent via `ofetchOptions` — established from captured production evidence *before* the fix was written
- A server-side thumbnail proxy (`/api/thumbnail/[id]`) that resolves Notion's ~1h presigned S3 URL per request instead of baking it into cached HTML, with a Server/Client boundary that keeps the presigned URL out of the RSC flight payload entirely
- Collapsible left/right sidebars with a per-side tri-state (`null | true | false`), a blocking pre-hydration script for flash-free first paint, `inert`-based a11y-tree removal with focus rescue on both the click and resize paths, and a 1100px cap on the post-detail prose column

### What Worked
- **Splitting the content defect across two phases (7 = evidence, 8 = fix) was the single highest-leverage structural decision.** The leading hypothesis going in was react-notion-x #710 at MEDIUM confidence. Phase 7's evidence gate forced a single-variable User-Agent experiment that named a *different* root cause. Planning both phases together would have baked the wrong hypothesis into a PLAN.md — exactly the v1.0 CR-01 failure mode D-08 exists to prevent.
- **Measurement beat derivation, repeatedly.** Four plausible, code-or-doc-derived premises were overturned by actually measuring: `getPost` throws (it doesn't), an empty Notion page returns 1 block key (3), `/post/[id]` is ISR-cached (it's dynamic), right-only collapse frees 272px (it frees 240px — the gap survives). The habit of measuring before building is now this project's strongest defense.
- **Adversarial review caught things the plan checker could not.** Phase 10's code review found a real concurrency defect (both sidebars shared one transition-cleanup ref, so a second toggle within 250ms cancelled the animation) that lint, tsc, and the build all passed cleanly.
- **The plan checker caught a genuine coverage hole in its own artifact set** — plan 10-03 edited the stop-ship file but omitted the stop-ship greps that the other three plans carried.

### What Was Inefficient
- **Not pushing.** Phase 10 was fully built, reviewed, and verified locally while the deployed site served a build from two days earlier. UAT test 1 was answered against the stale deploy and had to be retracted and re-run. The policy of not pushing without asking was right; the failure was not saying loudly, at the top of UAT, that the code under test was not the code deployed.
- **Verification artifacts drifted from reality.** Three of four phases ended with a body `**Status:**` header disagreeing with their own frontmatter, because the canonicalization step updates frontmatter only. The v1.1 audit had to reconstruct closures from `STATE.md` to establish that requirements were satisfied.
- **`requirements_completed` frontmatter is inconsistently written.** All four Phase 8 SUMMARYs and `07-03-SUMMARY.md` omit it, which silently degraded the milestone audit's 3-source cross-reference to 2 sources for CONT-02/03/05.
- **Tool false-positives cost real time.** The `api-coverage.verify-pre` gate blocked a phase with zero external API integration because the word "api" appeared in its own planning prose. The `audit-open` scan counted four evidence bullets as four unresolved items.

### Patterns Established
- **Evidence gate as a phase boundary.** When a fix rests on an unproven hypothesis, make the evidence its own phase. Structural, not discretionary.
- **Record `UNEXERCISED` with a reason rather than rounding up.** v1.1 carries six such items across two phases, each with a stated, non-fabricated reason. `nyquist_compliant: false` is held deliberately.
- **Never mutate production content to manufacture a test case.** Established in Phase 9 (IMG-05), held in Phase 10 (E7). A synthetic proxy that narrows the gap is acceptable; editing the operator's real posts is not.
- **`## CORRECTION` sections instead of silent edits.** A retracted verdict stays visible with its reason.
- **Fault-inject-then-revert, with `git status` proving the revert.** Used in Phases 8, 9 and 10.

### Key Lessons
1. **When code is built but unpushed, say so before asking anyone to verify it.** The whole UAT round for SIDE-10 was spent against a build that did not contain the feature.
2. **A verification artifact is only as good as its last update.** Closures recorded in `STATE.md` but not back-propagated into `VERIFICATION.md` look identical to open gaps six weeks later. Append a `## CORRECTION`; don't rely on a reader cross-referencing.
3. **Deterministic detectors need an escape hatch used honestly.** Both false-positive gates this milestone had documented override paths that required proving the negative by evidence rather than asserting it by preference. That is the right shape — but the proof has to actually be produced.
4. **Delayed-onset CSS bugs are invisible to the whole automated toolchain.** Turbopack silently drops an `@property` block whose `syntax` descriptor is double-quoted — no error, no warning. Only a browser measurement caught it.
5. **A "clean" grep is not a passing test when the check text contains the literal it greps for.** Plan 10-04 authored a self-referentially unsatisfiable criterion.

### Cost Observations
- Model mix: opus for planning and the CR-01 fix, sonnet for research/execution/verification, haiku for plan checking and integration checking
- Notable: the tracer-first shape (one end-to-end slice in Phase 10 wave 1, then three expansion waves) meant every later wave built on a proven skeleton — waves 2-4 introduced zero architectural rework

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | First milestone — established fail-closed env-gating, tracer+gap-closure phase pattern, and live-credential operator verification as this project's baseline process |
| v1.1 | 4 | Evidence-gate phase boundaries (7→8) for unproven hypotheses; measurement-over-derivation as a default; honest `UNEXERCISED` recording instead of rounding coverage up; never mutating production content to manufacture a test case |

### Cumulative Quality

| Milestone | Requirements Shipped | Known Overrides |
|-----------|----------------------|------------------|
| v1.0 | 20/20 | 1 (Phase 5 verification-tooling false-negative) |
| v1.1 | 25/25 | 1 (Phase 10 UAT override — 2 items accepted-but-unobserved for real content scarcity, not tooling) + 6 recorded UNEXERCISED sub-items across Phases 9-10 |

### Top Lessons (Verified Across Milestones)

1. Verify defect diagnoses against the live external system before fixing, not just internal code consistency (v1.0, Phase 1 CR-01). **Re-confirmed v1.1:** the leading root-cause hypothesis for the content defect was wrong, and only a live single-variable experiment found the real one.
2. Make a structural gate out of anything that depends on developer discipline (v1.0 Phase 5's standalone cutover; v1.1's Phase 7→8 evidence gate). Both were questioned as overhead and both paid off.
3. Measure before building. v1.1 overturned four separate plausible derived premises by measuring (v1.1, Phases 9-10).
4. Record what was not observed, with its reason, rather than rounding it up to a pass (v1.1, Phases 9-10 — 6 items).
5. When a build is not deployed, say so before asking anyone to verify it (v1.1, Phase 10 — an entire UAT round was spent against a stale deploy).
