---
status: testing
phase: 10-collapsible-sidebars-reading-width
source: [10-VERIFICATION.md]
started: 2026-08-13T00:00:00Z
updated: 2026-08-13T01:00:00Z
---

## Current Test

number: 1
name: SIDE-10 — live subscribe submit-and-response round trip
expected: |
  The subscribe form in the right sidebar accepts a real email address and submits
  successfully against the operator's own Resend account — the audience receives the new
  contact, or the API returns its expected success response.
  MUST be tested against a build that actually contains Phase 10 (the deployed site was
  serving a pre-Phase-10 ref when this was first attempted).
awaiting: user response

## Tests

### 1. SIDE-10 — live subscribe submit-and-response round trip

Fill the email field on the right panel's subscribe form with a real address and click submit,
using the operator's actual `RESEND_API_KEY` / `RESEND_AUDIENCE_ID`.

expected: The form submits successfully and the operator's Resend audience receives the new contact (or the API returns the expected success response).
why_human: A real, side-effecting PII write against a live production Resend account. The verifying agent's own tool-use classifier blocks side-effecting fill+submit actions against production services — it blocked this same check during plan 10-04's evidence pass too. Already independently confirmed: the form renders with a live email field and submit button, and all three code-level stop-ship guards pass (`NEXT_PUBLIC_RESEND` absent repo-wide, `templates/default/Layout.tsx` still a Server Component, no `SubscribeSection` import in `SidebarShell.tsx`, plus a direct read of the compiled `.next` client-reference-manifest). Only the submit-and-response round trip is unproven.
result: [pending]
note: |
  2026-08-13 — an earlier `pass` for this test was RETRACTED, not overwritten silently.
  The operator confirmed the subscribe form worked, but tested it against the DEPLOYED
  Vercel site, which was still serving `origin/main` at `34fceee` (2026-08-12) — a build
  with no Phase 10 code at all: `SidebarShell.tsx` and `lib/sidebar.ts` did not exist on
  that ref. What was exercised was therefore the PRE-refactor subscribe form in the old
  `Layout.tsx` markup, not the form as re-parented into `SidebarShell`'s `rightSlot`.
  Since SIDE-10 exists precisely to prove that re-parenting did not silently disable the
  form, the observation does not bear on the criterion. Re-test after the deploy carrying
  Phase 10 is live.

### 2. A11Y-04 — CSS reduced-motion guard holds with the JS guard bypassed

With the browser engine's own `prefers-reduced-motion: reduce` active (a real OS-level "reduce motion"
toggle, not a monkey-patched `matchMedia`), manually run
`document.documentElement.setAttribute('data-sidebar-transition', 'active')` and then collapse a
sidebar.

expected: The CSS layer — the `@media (prefers-reduced-motion: no-preference)` wrapper around the transition rule — suppresses the animation even with the JS guard bypassed by hand, proving the CSS guard holds independently rather than only in combination with the JS one.
why_human: The headless `/browse` session's CDP allowlist does not include `Emulation.setEmulatedMedia`, so a real engine-level reduced-motion preference cannot be forced from that environment. Both layers are independently confirmed already (JS guard observed live; CSS guard source-asserted); only the both-bypassed-simultaneously combination needs a human with a real OS toggle.
result: [pending]

### 3. E7 — wide table / wide code block / longest title at the 1100px prose cap

Open a post containing an actual wide Notion table and an actual wide Notion code block, with both
sidebars collapsed so the prose column sits at its 1100px cap, in both light and dark theme.

expected: The table and code block render cleanly inside the 1100px column with no horizontal overflow, matching the synthetic proxy's result. The longest real post title does not break layout.
why_human: The operator's 3 published posts contain zero tables and zero code blocks and all titles are short, so there is no real content to test against without mutating production Notion content — which this phase and Phase 9 (IMG-05) both deliberately declined to do. A synthetic proxy built from `react-notion-x`'s own real CSS classes was exercised and did not overflow, which narrows the gap rather than closing it. Widening the column from 864px to 1100px only *relaxes* the existing constraint, so nothing that fits today can newly overflow — but that is an argument, not an observation.
result: [pending]

### 4. SC#5 — home-page sticky survival at real scroll depth

Once the home page has more content than the current 3 posts, scroll it ~2000px (matching the
post-page test's rigor) and confirm both `<aside>`s still stick.

expected: Both `<aside>`s remain `position: sticky` at their `top-16` (64px) rest position throughout a deep scroll, matching the post-page result exactly.
why_human: The home page currently measures `scrollHeight: 900px` at a 900px viewport — there is genuinely not enough real content to scroll far enough to stress sticky the way the 4187px-tall post page was stressed. A light check at the ~50-64px of scroll room that does exist showed sticky intact in all four collapse combinations. This resolves itself once more posts are published; alternatively, explicitly accept the lighter-rigor result now.

**Note:** the post page's own SC#5 test DID pass at full rigor — `position: sticky` held at `top: 64px` in all four collapse combinations after a 2000px scroll, with no ancestor `overflow`/`transform` breaking it. This item is about the home page only.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
