---
status: testing
phase: 03-subscribe-path
source: [03-VERIFICATION.md]
started: 2026-07-27T00:00:00Z
updated: 2026-07-27T00:00:00Z
---

## Current Test

number: 1
name: Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)
expected: |
  Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {"ok":true} body with no dashboard-visible duplicate error
awaiting: user response

## Tests

### 1. Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)
expected: Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {"ok":true} body with no dashboard-visible duplicate error
result: [pending]

### 2. Terminal-template SSR probe: with CONFIG.template set to "terminal" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times
expected: The marker data-testid="subscribe-form" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console
result: [pending]

### 3. Post-partial-failure convergence: after a state where contacts.create succeeds but contacts.update fails, does a visitor's retry of the same address converge to unsubscribed:false in a live Audience?
expected: The retried submission results in the contact present with unsubscribed:false, with no in-route retry loop involved
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
