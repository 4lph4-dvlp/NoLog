---
status: testing
phase: 03-subscribe-path
source: [03-VERIFICATION.md]
started: 2026-07-27T00:00:00Z
updated: 2026-07-27T02:15:00Z
---

## Current Test

number: 2
name: Terminal-template SSR probe: with CONFIG.template set to "terminal" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times
expected: |
  The marker data-testid="subscribe-form" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console
awaiting: user response

## Tests

### 1. Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)
expected: Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {"ok":true} body with no dashboard-visible duplicate error
result: PASSED — tested live against the operator's real Resend account (2026-07-27). A test address (`nolog-uat-verification@example.com`) was submitted twice via `POST /api/subscribe` against a locally built/served production server. First submission: `200 {"ok":true}`. Second (duplicate) submission: `200 {"ok":true}`, byte-for-byte identical to the first — confirmed via `diff`. Direct Resend API query (`GET /audiences/{id}/contacts`) confirmed the address was present with `unsubscribed: false`. No server log line referenced the address on either request (D-24 held). Test contact was deleted after confirmation to leave the operator's Audience clean.

Setup issues encountered and resolved along the way (not code defects): (1) the first API key issued was `sending_access`-only and could not reach the Contacts/Audiences endpoints (Resend's two permission tiers are `full_access` and `sending_access` — confirmed via Resend's live API-key-creation docs) — resolved by reissuing a `full_access` key; (2) the `RESEND_AUDIENCE_ID` value initially configured did not match any audience under the account — resolved by querying `GET /audiences` directly and using the real audience id returned.

### 2. Terminal-template SSR probe: with CONFIG.template set to "terminal" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times
expected: The marker data-testid="subscribe-form" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console
result: [pending]

### 3. Post-partial-failure convergence: after a state where contacts.create succeeds but contacts.update fails, does a visitor's retry of the same address converge to unsubscribed:false in a live Audience?
expected: The retried submission results in the contact present with unsubscribed:false, with no in-route retry loop involved
result: [pending]

## Summary

total: 3
passed: 1
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
