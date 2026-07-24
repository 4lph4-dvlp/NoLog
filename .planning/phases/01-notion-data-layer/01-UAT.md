---
status: testing
phase: 01-notion-data-layer
source: [01-VERIFICATION.md]
started: 2026-07-25T00:00:00Z
updated: 2026-07-25T02:45:00Z
---

## Current Test

number: 3
name: Missing-property detection reconciliation (D-01)
expected: |
  Temporarily remove the `emailed` checkbox property from the live database, then call
  getUnemailedPublicPosts()/markEmailed() and observe Notion's actual error status/body.
  MissingEmailedPropertyError should fire (instanceof-checkable). Restore the property
  afterward.
awaiting: user response

## Tests

### 1. Mark-then-requery (DATA-01/DATA-02, ROADMAP SC#1-3)
expected: Run `npx tsx packages/core/scripts/verify-phase-1.ts` against the live Notion database (NOTION_TOKEN + NOTION_DATABASE_ID set, `emailed` checkbox property present, ≥1 status=public/emailed-unchecked post). stdout ends with "PASS: post correctly excluded after markEmailed()", proving the query succeeds and the PATCH write durably persists and is visible on the immediately-following query.
result: PASS — "Before: 3 unemailed public posts" → marked page 6b42c61e-4a24-82b0-ae11-01fdb5e7110f ("NoLog를 만들며") as emailed → "PASS: post correctly excluded after markEmailed()" (2026-07-25T02:38)

### 2. 403 capability detection (DATA-04, ROADMAP SC#4)
expected: Run `npx tsx packages/core/scripts/verify-403.ts` with the integration's "Update content" capability temporarily revoked in the Notion Developer Portal. stdout is "PASS: ..." and the caught error is `instanceof NotionCapabilityError`.
result: PASS — "PASS: Notion write failed for page 36e2c61e-4a24-8048-b7be-c6765c807e23: integration lacks \"Update content\" capability... (Notion said: {\"status\":403,\"code\":\"restricted_resource\",...})" (2026-07-25T02:45). No token/Authorization leak in the message. "Update content" capability restored afterward.

### 3. Missing-property detection reconciliation (D-01)
expected: Temporarily remove the `emailed` checkbox property from the test database, then call getUnemailedPublicPosts()/markEmailed() and observe Notion's actual error status/body. MissingEmailedPropertyError should fire (instanceof-checkable). If the real error text doesn't match the current best-guess regex (`/emailed/i` + `/propert/i` on a 400), the detection condition must be tightened (ideally to Notion's stable `code` field, per 01-REVIEW.md WR-02's fix suggestion) before D-01 is considered done. Restore the property afterward.
result: [pending]

## Summary

total: 3
passed: 2
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
