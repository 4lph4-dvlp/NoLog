---
phase: 8
slug: content-rendering-fix
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — repo has zero test infrastructure (no jest/vitest/playwright config, no `*.test.*`), and adding a test framework is explicitly Out of Scope in REQUIREMENTS.md |
| **Config file** | none |
| **Quick run command** | `npm run lint --workspace=apps/web` |
| **Full suite command** | `npm run build --workspace=apps/web` |
| **Estimated runtime** | ~{N} seconds (to be measured during execution) |

---

## Sampling Rate

- **After every task commit:** `npm run lint --workspace=apps/web`
- **After every plan wave:** `npm run build --workspace=apps/web`
- **Before `/gsd-verify-work`:** build succeeds, lint clean, and the deployed-site checks below have run
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | source-assertion | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Filled by the planner / validate-phase. With no test framework, expect `source-assertion` (grep / build / lint) and `manual-deployed` rows rather than `unit`.*

---

## Wave 0 Requirements

- [ ] None — no test framework may be installed (REQUIREMENTS.md Out of Scope; D-07 no new dependencies).

*Automated verification is limited to source assertions, `next build`, and ESLint. Behavioural criteria are deployed-site or operator-verified — see below.*

---

## Manual-Only Verifications

The heart of this phase. SC#1 in particular cannot be satisfied by any local check.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Every public post renders its Notion body on a cold first visit | CONT-03 / SC#1 | `next dev` has no ISR and cannot reproduce the deployed cache behaviour (PITFALLS 12). A single post-deploy load proves nothing — the cache is freshly warm (PITFALLS 15) | Deployed-site, 3-request procedure below. Repeat across **all** public post ids, not one |
| The response was **genuinely regenerated**, not served from a pre-fix cache | CONT-03 / SC#1 | Cache state is only observable from outside via response headers | Read `x-vercel-cache` on each request — see procedure |
| "no content yet" vs "could not be loaded" are visibly distinct to a reader | CONT-05 / SC#3 | A copy/visual judgement | Load a post with content, a post with none, and a forced-failure state; compare what renders |
| The empty-page heuristic matches a real empty Notion page | CONT-05 | `08-RESEARCH.md` flags this `[ASSUMED]` — never tested against a live empty page | Create a throwaway empty Notion page, set it public, load it. **Do this before shipping**, not after |
| Chrome-leg failure does not blank the body (Phase 7 SC#3) | CONT-04 | Carried in from `07-UAT.md` per 08-CONTEXT D-15; only unambiguous once the body renders again | `07-UAT.md` Test 1 |
| Transient `getPost` failure renders `PostUnavailable`, not a 404 (Phase 7 SC#4) | CONT-04 | Carried in from `07-UAT.md` per D-15 | `07-UAT.md` Test 2 |
| The diagnostic surfaces are actually gone | D-19 | Absence is checkable in source, but the route's disappearance is confirmed in the build output | `/api/diagnose-page` absent from `next build`'s route list; `curl` returns 404 on the deployed site |

### SC#1 regeneration procedure (from `08-RESEARCH.md` Finding 2)

`CONFIG.revalidate` is 180s and **no on-demand revalidation path exists in this repo** — `notion-posts` is set
as a tag but `revalidateTag` is never called (verified by grep). So the natural window is the only lever.

1. **Request A**, immediately after the deploy → expect `x-vercel-cache: MISS`. This is the deploy's own
   cold fill; it proves nothing about the fix surviving a regeneration.
2. **Wait > 180s without touching the page.**
3. **Request B** → expect `STALE`. This request is what *triggers* background regeneration; its body may
   still be the old one.
4. **Request C**, shortly after B → expect `HIT`. **This body is the regenerated one.** Assert the post body
   renders here.

A pass requires the body to render on **C**, across multiple posts. Passing only on A is the PITFALLS 15
false positive this procedure exists to catch.

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify (source assertion / build / lint) or appear in the manual table above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — no framework may be added)
- [ ] No watch-mode flags
- [ ] Feedback latency < {N}s
- [ ] The empty-page heuristic was tested against a real empty Notion page, or its `[ASSUMED]` status is carried forward explicitly
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
