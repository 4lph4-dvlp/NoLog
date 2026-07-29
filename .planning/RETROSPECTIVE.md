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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | First milestone — established fail-closed env-gating, tracer+gap-closure phase pattern, and live-credential operator verification as this project's baseline process |

### Cumulative Quality

| Milestone | Requirements Shipped | Known Overrides |
|-----------|----------------------|------------------|
| v1.0 | 20/20 | 1 (Phase 5 verification-tooling false-negative) |

### Top Lessons (Verified Across Milestones)

1. Verify defect diagnoses against the live external system before fixing, not just internal code consistency (v1.0, Phase 1 CR-01).
