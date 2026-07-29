---
phase: 06-documentation
reviewed: 2026-07-29T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - README.md
  - README_KR.md
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 6 is documentation-only: it adds an "Email Notifications (Optional)" section, a `Notifications` Mermaid subgraph, a `Resend` row in the Core Services table, and a feature bullet, to both `README.md` and `README_KR.md`. Structural parity between the English and Korean files is excellent — headers, numbered steps, code fences, and bolded caveats all line up 1:1 across both languages, and every cited env var, error class, function name, and file path was cross-checked against `apps/web/src/app/api/notify-subscribers/route.ts`, `packages/core/src/client.ts`, `apps/web/src/site.config.ts`, `apps/web/vercel.json`, and `apps/web/src/components/subscribe/SubscribeSection.tsx`.

One claim in both README files misdescribes the actual fail-closed gate implemented in code — the docs assert a safety net exists that the code does not implement, which is exactly the kind of factually-wrong, security-adjacent claim this review was scoped to catch. There's also an undocumented second gate (the public subscribe form) that uses a different, narrower set of env vars than the "all four" framing implies, which could surprise a forker who partially configures the feature. Two minor completeness gaps round out the findings. No Markdown/Mermaid syntax errors, no placeholder secrets, no broken internal doc links (`packages/core/README.md`, `packages/core/README_KR.md`, `apps/web/docs/TEMPLATE_GUIDE.md`, `apps/web/docs/TEMPLATE_GUIDE_KR.md` all exist).

## Critical Issues

### CR-01: "Leaving the default sender identity" claim is false — the code does not check for it

**Status: RESOLVED (docs-only fix, 2026-07-29).** The false fail-closed claim was corrected in both `README.md` and `README_KR.md` (commit `6a6a1fa`) to accurately state that the gate only rejects a blank value, not the shipped default — so an unchanged `fromAddress` still results in a live send under an identity/domain the forker doesn't control. The code-side option (making `route.ts` reject the shipped default value) was declined as out of scope for this documentation-only phase; it would require its own GSD code phase.

**File:** `README.md:96-97`, `README_KR.md:96-97`

**Issue:** Both READMEs assert:

> **Leaving the template author's default sender identity here, or blanking it, makes the notify route no-op — the fail-closed gate treats an unset sender as unconfigured, and nothing sends.**

This is only half true. The actual gate in `apps/web/src/app/api/notify-subscribers/route.ts:216-217` is:

```ts
const fromAddress = CONFIG.notify.fromAddress.trim();
if (!apiKey || !audienceId || !physicalAddress || !fromAddress) {
  // ... no-op, code: "unconfigured"
```

This only checks whether `fromAddress` is an **empty string** after `.trim()`. It has no logic that compares `fromAddress` against the shipped default value (`"4lph4 <no-reply@4lph4-bl0g.kro.kr>"` in `apps/web/src/site.config.ts:53`). A forker who does everything else in this section (sets all 4 env vars, adds the `emailed` property, grants Update content) but simply forgets step 5 will **not** get a silent no-op as documented. Instead the route proceeds past the config gate, builds the digest, and calls `resend.broadcasts.create({ from: fromAddress, ... })` using the template author's identity/domain (`route.ts:318-327`), which the forker's Resend account almost certainly cannot send from (unverified domain) — producing a live send attempt and an error-path failure (`send_failed`, logged every cron run) rather than the single, silent, pre-flight "unconfigured" no-op the docs promise.

This matters because the doc frames it as a safety guarantee ("fail-closed gate ... nothing sends"). A forker relying on that sentence could reasonably believe skipping step 5 is harmless, when in fact it produces a different, noisier failure mode than described — and in an edge case where the forker's Resend account happens to have a matching/verified domain, it could actually send email under the template author's identity.

**Fix:** Either (a) fix the code so the gate actually treats the shipped default as unconfigured, e.g.:

```ts
const DEFAULT_FROM_ADDRESS = "4lph4 <no-reply@4lph4-bl0g.kro.kr>";
const fromAddress = CONFIG.notify.fromAddress.trim();
const fromAddressConfigured = fromAddress !== "" && fromAddress !== DEFAULT_FROM_ADDRESS;
if (!apiKey || !audienceId || !physicalAddress || !fromAddressConfigured) { ... }
```

or (b), if changing code is out of scope for a docs-only phase, correct the claim in both READMEs to match actual behavior, e.g.:

> **Blanking `fromAddress` makes the notify route no-op (the fail-closed gate treats an empty sender as unconfigured). Leaving the template author's default value in place does *not* no-op — the route will still attempt to send using an identity/domain you don't control, which will fail at Resend (or, in a false-positive edge case, actually send under someone else's brand). Always replace the default before enabling this feature.**

Apply the equivalent correction to `README_KR.md:96-97`.

## Warnings

### WR-01: Undocumented second gate — the public subscribe form uses only 2 of the "four" env vars

**File:** `README.md:87,109`, `README_KR.md:87,109`

**Issue:** The Email Notifications section frames configuration as all-or-nothing around four env vars: "leave `RESEND_API_KEY` unset and nothing in this section applies" (line 87) and "Leave these four unset and the notify route no-ops ... set all four to enable the daily digest" (line 109). In reality there are two independent, differently-scoped gates:

- The digest cron gate (`route.ts:217`) requires all 4: `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`, `NOTIFY_PHYSICAL_ADDRESS`.
- The public-facing subscribe form (`apps/web/src/components/subscribe/SubscribeSection.tsx:14-16`) is gated on only **2**: `RESEND_API_KEY && RESEND_AUDIENCE_ID`.

A forker who sets just those two vars (e.g., while still working through the setup checklist, before adding `CRON_SECRET`/`NOTIFY_PHYSICAL_ADDRESS`) will get a live, publicly-visible email-capture form on their site collecting subscriber PII into their Resend Audience — while the docs' framing ("nothing in this section applies" / "no-ops" until all four are set) implies the feature stays fully inert until fully configured. The subscribe form itself is never mentioned anywhere in either README.

**Fix:** Add a short note distinguishing the two gates, e.g.:

> Note: the public subscribe form (rendered on post pages) appears as soon as `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` are both set, independent of the other two vars — it starts collecting subscriber emails into your Resend Audience even before the digest cron is fully configured. Set all four together to avoid a form that's live before you're ready to send.

Apply to both `README.md` and `README_KR.md`.

## Info

### IN-01: `## Environment Variables` section doesn't cross-reference the notify vars

**File:** `README.md:113-121`, `README_KR.md:113-121`

**Issue:** The pre-existing "Environment Variables" section only lists `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NEXT_PUBLIC_CUSDIS_APP_ID`. The four notify-related vars are documented ~15 lines earlier in "Email Notifications (Optional)" with no cross-link between the two var-listing sections. A forker skimming straight to "Environment Variables" (a natural landing spot when following a setup checklist) could miss the notify vars entirely.

**Fix:** Add a one-line pointer, e.g. "See Email Notifications above for the optional Resend/cron variables." to both files.

### IN-02: `NOTIFY_BATCH_SIZE` override is undocumented

**File:** `README.md:102-107`, `README_KR.md:102-107`

**Issue:** `apps/web/src/app/api/notify-subscribers/route.ts:23,251-253` supports an optional `NOTIFY_BATCH_SIZE` env var (defaults to 50) that caps how many posts are included per digest run. Neither README's four-variable code block or surrounding prose mentions it. This is a minor omission — it has a safe default and doesn't affect whether the feature works — but a forker with a large backlog of unemailed posts (e.g., after a migration or an extended `NOTION_TOKEN` outage) has no documented way to discover this knob.

**Fix:** Add an optional fifth line/note under the env var block, e.g. "Optionally set `NOTIFY_BATCH_SIZE` (default 50) to change how many posts are included per digest run."

---

_Reviewed: 2026-07-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
