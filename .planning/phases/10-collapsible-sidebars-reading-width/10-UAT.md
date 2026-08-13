---
status: complete
phase: 10-collapsible-sidebars-reading-width
source: [10-VERIFICATION.md]
started: 2026-08-13T00:00:00Z
updated: 2026-08-14T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SIDE-10 — live subscribe submit-and-response round trip

Fill the email field on the right panel's subscribe form with a real address and click submit,
using the operator's actual `RESEND_API_KEY` / `RESEND_AUDIENCE_ID`.

expected: The form submits successfully and the operator's Resend audience receives the new contact (or the API returns the expected success response).
why_human: A real, side-effecting PII write against a live production Resend account. The verifying agent's own tool-use classifier blocks side-effecting fill+submit actions against production services — it blocked this same check during plan 10-04's evidence pass too. Already independently confirmed: the form renders with a live email field and submit button, and all three code-level stop-ship guards pass (`NEXT_PUBLIC_RESEND` absent repo-wide, `templates/default/Layout.tsx` still a Server Component, no `SubscribeSection` import in `SidebarShell.tsx`, plus a direct read of the compiled `.next` client-reference-manifest). Only the submit-and-response round trip is unproven.
result: pass
reported: "잘 작동해" (operator confirmed the live submit round trip works)
verified_by: operator
verified_at: 2026-08-14
verified_against: "https://4lph4-bl0g.vercel.app @ origin/main 25daa8b — the first deploy containing Phase 10"
note: |
  RETRACTED-THEN-RE-TESTED, recorded rather than silently overwritten.
  A first `pass` on 2026-08-13 was retracted: the operator had tested against the deployed
  site while it was still serving `origin/main` at `34fceee` (2026-08-12), a build with no
  Phase 10 code at all — `SidebarShell.tsx` and `lib/sidebar.ts` did not exist on that ref.
  That exercised the PRE-refactor subscribe form in the old `Layout.tsx` markup, not the
  form as re-parented into `SidebarShell`'s `rightSlot`, so it did not bear on SIDE-10 —
  which exists precisely to prove that re-parenting did not silently disable the form.
  The 42 unpushed commits were pushed (34fceee..25daa8b), Vercel redeployed (~45s), and
  the deploy was confirmed to carry Phase 10 (`sidebar-left-panel` / `sidebar-right-panel`
  ids, the pre-hydration script, `sticky top-16`) before this re-test. Also machine-checked
  on the served HTML at that point: `type="email"` + submit button present, and zero
  occurrences of `NEXT_PUBLIC_RESEND` or a `re_…` Resend key pattern.

### 2. A11Y-04 — CSS reduced-motion guard holds with the JS guard bypassed

With the browser engine's own `prefers-reduced-motion: reduce` active (a real OS-level "reduce motion"
toggle, not a monkey-patched `matchMedia`), manually run
`document.documentElement.setAttribute('data-sidebar-transition', 'active')` and then collapse a
sidebar.

expected: The CSS layer — the `@media (prefers-reduced-motion: no-preference)` wrapper around the transition rule — suppresses the animation even with the JS guard bypassed by hand, proving the CSS guard holds independently rather than only in combination with the JS one.
why_human: The headless `/browse` session's CDP allowlist does not include `Emulation.setEmulatedMedia`, so a real engine-level reduced-motion preference cannot be forced from that environment. Both layers are independently confirmed already (JS guard observed live; CSS guard source-asserted); only the both-bypassed-simultaneously combination needs a human with a real OS toggle.
result: pass
reported: "통과" (operator confirmed no animation played with the JS guard bypassed under a real OS-level reduce-motion setting)
verified_by: operator
verified_at: 2026-08-14
verified_against: "https://4lph4-bl0g.vercel.app @ origin/main 25daa8b"
note: |
  Closes A11Y-04's last open sub-claim. The CSS layer's
  `@media (prefers-reduced-motion: no-preference)` wrapper was previously only
  source-asserted; it is now observed holding INDEPENDENTLY, with the JS layer
  deliberately bypassed by hand. The two guards are therefore confirmed as genuinely
  redundant rather than co-dependent.

### 3. E7 — wide table / wide code block / longest title at the 1100px prose cap

Open a post containing an actual wide Notion table and an actual wide Notion code block, with both
sidebars collapsed so the prose column sits at its 1100px cap, in both light and dark theme.

expected: The table and code block render cleanly inside the 1100px column with no horizontal overflow, matching the synthetic proxy's result. The longest real post title does not break layout.
why_human: The operator's 3 published posts contain zero tables and zero code blocks and all titles are short, so there is no real content to test against without mutating production Notion content — which this phase and Phase 9 (IMG-05) both deliberately declined to do. A synthetic proxy built from `react-notion-x`'s own real CSS classes was exercised and did not overflow, which narrows the gap rather than closing it. Widening the column from 864px to 1100px only *relaxes* the existing constraint, so nothing that fits today can newly overflow — but that is an argument, not an observation.
result: accepted
reason: "Operator explicitly ACCEPTED the unobserved state on 2026-08-14 rather than leaving it open. Originally skipped — no qualifying content exists to test against. The operator's 3 published posts contain zero tables and zero code blocks, and production Notion content was deliberately not mutated to manufacture a case (same line Phase 9 declined to cross for IMG-05). Residual risk is low: the cap WIDENS the column from 864px to 1100px, so content that fits today cannot newly overflow, and a synthetic proxy using react-notion-x's own CSS classes did not overflow. This resolves itself the first time a post with a wide table or code block is published — re-check then."
skipped_at: 2026-08-14
carry_forward: "Re-verify when a post containing a wide table or code block is first published."
result_note: "Recorded as skipped-with-reason, not passed — the observation was never made.

### 4. SC#5 — home-page sticky survival at real scroll depth

Once the home page has more content than the current 3 posts, scroll it ~2000px (matching the
post-page test's rigor) and confirm both `<aside>`s still stick.

expected: Both `<aside>`s remain `position: sticky` at their `top-16` (64px) rest position throughout a deep scroll, matching the post-page result exactly.
why_human: The home page currently measures `scrollHeight: 900px` at a 900px viewport — there is genuinely not enough real content to scroll far enough to stress sticky the way the 4187px-tall post page was stressed. A light check at the ~50-64px of scroll room that does exist showed sticky intact in all four collapse combinations. This resolves itself once more posts are published; alternatively, explicitly accept the lighter-rigor result now.

**Note:** the post page's own SC#5 test DID pass at full rigor — `position: sticky` held at `top: 64px` in all four collapse combinations after a 2000px scroll, with no ancestor `overflow`/`transform` breaking it. This item is about the home page only.
result: accepted
reason: "Operator explicitly ACCEPTED the lighter-rigor result on 2026-08-14 rather than leaving it open. Originally skipped — the home page has only 3 posts and measures scrollHeight 900px at a 900px viewport, so there is genuinely no scroll room to run the post page's 2000px test. Residual risk is low: SC#5's actual hazard (PITFALLS 9 — an ancestor transform/overflow silently killing position:sticky) is a property of the shared CSS and the shared SidebarShell component, and it was disproven at full rigor on the 4187px-tall post page across all four collapse combinations. The home page uses the same CSS and the same component, with no structural reason to differ. A light check at the ~50-64px of scroll room that does exist showed sticky intact."
skipped_at: 2026-08-14
carry_forward: "Re-verify once the home page has enough posts to scroll ~2000px."
result_note: "Recorded as skipped-with-reason, not passed — the full-rigor home-page observation was never made.

## Summary

total: 4
passed: 2
issues: 0
pending: 0
skipped: 0
accepted: 2
blocked: 0

## Accepted Unobserved Items

Two verification items were never observed and were explicitly accepted by the operator on
2026-08-14 rather than left open. Recorded here so a later audit reads them as accepted risk,
not as passes:

- test 3 — E7 wide table / wide code block / longest title at the 1100px cap. No qualifying
  content exists; production Notion was deliberately not mutated to manufacture a case.
- test 4 — SC#5 home-page sticky at full scroll depth. Only 3 posts exist, so the home page
  cannot be scrolled far enough to match the post page's 2000px test.

Both resolve themselves as the blog gains content. `10-VALIDATION.md` keeps
`nyquist_compliant: false` for the same reason and should stay that way until they are
genuinely observed.

## Gaps
