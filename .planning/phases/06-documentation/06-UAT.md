---
status: testing
phase: 06-documentation
source: [06-VERIFICATION.md]
started: 2026-07-29T08:40:00Z
updated: 2026-07-29T08:55:00Z
---

## Current Test

number: 1
name: Native Korean speaker read-through
expected: |
  Prose in README_KR.md's `## 이메일 알림 (선택)` section (all 7 steps, inline warnings, quota note) reads naturally, not machine-translated, and no Notion/Resend/Vercel UI label (e.g. Update content, Domains, Audience, Production) was translated away from what a forker actually sees on screen.
awaiting: user response

## Tests

### 1. Native Korean speaker read-through
expected: Prose reads naturally (not machine-translated), and no Notion/Resend/Vercel UI label was translated away from what a forker actually sees on screen (e.g. Update content, Domains, Audience, Production must stay in English).
result: [pending]

### 2. Decide disposition of WR-01 (undocumented subscribe-form gate)
expected: Either accept as out of scope for Phase 6 (it was not one of the four traps DOCS-01/02/03 or the plan's must_haves named, and 06-REVIEW.md classified it as a Warning, not the Critical finding this phase was required to fix), or direct a follow-up doc edit adding the two-gate distinction (subscribe form activates on 2 of 4 env vars, independent of the digest cron's 4-var gate) to both READMEs.
result: PASS — user chose the follow-up doc edit. Both README.md and README_KR.md now state, directly after the 4-var fenced block, that the public subscribe form activates independently on just `RESEND_API_KEY`+`RESEND_AUDIENCE_ID`, regardless of `CRON_SECRET`/`NOTIFY_PHYSICAL_ADDRESS` (commit `540ae0e`).

## Summary

total: 2
passed: 1
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
