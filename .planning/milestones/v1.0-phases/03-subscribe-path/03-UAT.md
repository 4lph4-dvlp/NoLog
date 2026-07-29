---
status: complete
phase: 03-subscribe-path
source: [03-VERIFICATION.md]
started: 2026-07-27T00:00:00Z
updated: 2026-07-27T03:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)
expected: Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {"ok":true} body with no dashboard-visible duplicate error
result: PASSED — tested live against the operator's real Resend account (2026-07-27). A test address (`nolog-uat-verification@example.com`) was submitted twice via `POST /api/subscribe` against a locally built/served production server. First submission: `200 {"ok":true}`. Second (duplicate) submission: `200 {"ok":true}`, byte-for-byte identical to the first — confirmed via `diff`. Direct Resend API query (`GET /audiences/{id}/contacts`) confirmed the address was present with `unsubscribed: false`. No server log line referenced the address on either request (D-24 held). Test contact was deleted after confirmation to leave the operator's Audience clean.

Setup issues encountered and resolved along the way (not code defects): (1) the first API key issued was `sending_access`-only and could not reach the Contacts/Audiences endpoints (Resend's two permission tiers are `full_access` and `sending_access` — confirmed via Resend's live API-key-creation docs) — resolved by reissuing a `full_access` key; (2) the `RESEND_AUDIENCE_ID` value initially configured did not match any audience under the account — resolved by querying `GET /audiences` directly and using the real audience id returned.

### 2. Terminal-template SSR probe: with CONFIG.template set to "terminal" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times
expected: The marker data-testid="subscribe-form" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console
result: PASSED — tested live (2026-07-27) with `CONFIG.template` temporarily set to `"terminal"` and a real Notion post id (`3702c61e-4a24-8001-a9a6-c4ff3aadadb5`, resolved from the operator's real Notion database via the RSC payload of the homepage, not fabricated). Rebuilt once, then served twice with different Resend env states:
- **Configured** (real `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` set): `curl /post/{id}` showed `data-testid="subscribe-form"` exactly once, positioned after `</article>` and before the terminal console block (`h-[50vh]`) — confirmed programmatically via byte-offset comparison, not just visual inspection.
- **Unconfigured** (`RESEND_API_KEY=""`, `RESEND_AUDIENCE_ID=""` via env override, Notion vars untouched): same URL, same post — `data-testid="subscribe-form"` appeared 0 times.

`site.config.ts`'s temporary `"terminal"` edit was reverted to `"default"` after the test; `git diff` on that file is empty.

### 3. Post-partial-failure convergence: after a state where contacts.create succeeds but contacts.update fails, does a visitor's retry of the same address converge to unsubscribed:false in a live Audience?
expected: The retried submission results in the contact present with unsubscribed:false, with no in-route retry loop involved
result: skipped
reason: "Operator decision (2026-07-27): forcing a live partial-failure state (create succeeds, update fails) against a real Resend account is impractical to trigger deliberately without an unsupported/unreliable technique (e.g. racing a network interruption between the two calls). Remains a backstop truth per 03-01-PLAN.md's `verification: backstop` marker — the code path (unconditional create→update pair, D-17/D-18) was already verified structurally, and the executor's static-analysis gates confirmed no branch exists that could skip the recovery-by-retry behavior. Left open for whenever the operator has a concrete way to reproduce a live partial failure; operator has explicitly chosen to close the phase without it."

## Summary

total: 3
passed: 2
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
