---
status: testing
phase: 09-thumbnail-freshness
source: [09-VERIFICATION.md]
started: 2026-08-11T16:48:00Z
updated: 2026-08-11T16:48:00Z
---

## Current Test

number: 1
name: RSC flight-payload exposure — accept residual risk or schedule a fix
expected: |
  An explicit operator decision, recorded either as an accepted override on the affected 09-01
  must_haves truth, or as a scheduled follow-up (new backlog item or follow-up phase).
awaiting: user response

## Tests

### 1. RSC flight-payload exposure — accept residual risk or schedule a fix
expected: Decide whether presigned Notion S3 URLs remaining inside `self.__next_f.push([...])` hydration scripts (3 on the home feed, 1 on a post page — never in an `<img src>`) are acceptable for this milestone, or should trigger a follow-up plan narrowing `PostThumbnail`'s props so `post.thumbnail` never crosses the client boundary for file-type thumbnails. Record the decision as an accepted override on the affected 09-01 must_haves truth, or as a scheduled follow-up. Note: this does not affect the phase goal — a reader's image request never uses an expiring URL — but a live read grant does sit in public, CDN-cached markup.
result: [pending]

### 2. Host-allowlist guard — accept source-only assurance or extend the harness
expected: Decide whether the host-allowlist guard's source-level correctness is sufficient assurance. `ALLOWED_HOSTS` in `route.ts` exactly mirrors the two hostnames declared in `next.config.ts`, confirmed independently twice (09-VERIFICATION's own read, and 09-REVIEW's separate code-review pass). It structurally cannot be live-exercised because Notion chooses the presign host, not the operator. Accept as sufficient, or direct that 09-02's proven fault-injection harness pattern be extended to override the resolved hostname before the allowlist check.
result: [pending]

### 3. IMG-05 live half — accept source-only assurance or seed test data
expected: Decide whether IMG-05's external-thumbnail bypass claim is sufficient as source-verified-only. No external-thumbnail post currently exists in the operator's Notion database, so the live half was never exercised. Accept as sufficient (source-verified plus independent code-review corroboration), or add a throwaway external-thumbnail post to the database to close the live-observation gap.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
