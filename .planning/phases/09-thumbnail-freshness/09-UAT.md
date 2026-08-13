---
status: complete
phase: 09-thumbnail-freshness
source: [09-VERIFICATION.md]
started: 2026-08-11T16:48:00Z
updated: 2026-08-11T17:56:41Z
---

## Current Test

[testing complete]

## Tests

### 1. RSC flight-payload exposure — accept residual risk or schedule a fix
expected: Decide whether presigned Notion S3 URLs remaining inside `self.__next_f.push([...])` hydration scripts (3 on the home feed, 1 on a post page — never in an `<img src>`) are acceptable for this milestone, or should trigger a follow-up plan narrowing `PostThumbnail`'s props so `post.thumbnail` never crosses the client boundary for file-type thumbnails. Record the decision as an accepted override on the affected 09-01 must_haves truth, or as a scheduled follow-up. Note: this does not affect the phase goal — a reader's image request never uses an expiring URL — but a live read grant does sit in public, CDN-cached markup.
result: issue
reported: "지금 고치기 — fix the exposure before closing the phase rather than accepting it as residual risk"
severity: major

### 2. Host-allowlist guard — accept source-only assurance or extend the harness
expected: Decide whether the host-allowlist guard's source-level correctness is sufficient assurance. `ALLOWED_HOSTS` in `route.ts` exactly mirrors the two hostnames declared in `next.config.ts`, confirmed independently twice (09-VERIFICATION's own read, and 09-REVIEW's separate code-review pass). It structurally cannot be live-exercised because Notion chooses the presign host, not the operator. Accept as sufficient, or direct that 09-02's proven fault-injection harness pattern be extended to override the resolved hostname before the allowlist check.
result: pass
reason: "Operator accepted source verification as sufficient. The guard is present and correct; only a path to provoke it is missing, and Notion — not the operator — chooses the presign host."

### 3. IMG-05 live half — accept source-only assurance or seed test data
expected: Decide whether IMG-05's external-thumbnail bypass claim is sufficient as source-verified-only. No external-thumbnail post currently exists in the operator's Notion database, so the live half was never exercised. Accept as sufficient (source-verified plus independent code-review corroboration), or add a throwaway external-thumbnail post to the database to close the live-observation gap.
result: pass
reason: "Operator accepted source verification as sufficient. PostThumbnail's thumbnailType branch is confirmed by source and code review, and the claim is inherently unexercisable until a real forker adds an external thumbnail."

## Summary

total: 3
passed: 2
issues: 1
pending: 0
issues_resolved: 1
skipped: 0
blocked: 0

## Gaps

- gap_id: G-09-1
  truth: "The expiring presigned value is no longer embedded anywhere in cached markup — not in an `<img src>` and not in the RSC hydration payload."
  status: resolved
  resolved_by: 09-04-PLAN.md
  resolved_at: 2026-08-12
  resolution_note: |
    Reconciled at v1.1 milestone close (2026-08-14) per the verify-work `reconcile_gaps`
    rule (#1921): the gap stayed `failed` in this file only because verify-work was never
    re-run after `/gsd-execute-phase 9 --gaps-only`. Evidence it is genuinely closed —
    `09-04-PLAN.md` declares `gap_closure: true` with `gap_ids: [G-09-1]`, its
    `09-04-SUMMARY.md` exists (the plan executed), and `09-VERIFICATION.md` reads
    `status: passed` at 6/6 must-haves. Measured on the deployed site after the fix:
    0 `amazonaws.com` and 0 `X-Amz-*` occurrences on both `/` and the post page, where
    09-02 had measured 3 and 1, with non-zero proxy-path counts on the same bodies so the
    zeros are real absences rather than a vacuous match.
  reason: "User reported: 지금 고치기 — fix the exposure before closing the phase rather than accepting it as residual risk"
  severity: major
  test: 1
  root_cause: "`PostThumbnail` is a Client Component that receives the whole `post` object, so React serialises every field of it — including `post.thumbnail` — into the RSC flight payload for hydration, even though the file-type branch never reads that field. Diagnosed and recorded in 09-02-SUMMARY.md Finding A; no fresh debug session was needed."
  artifacts:
    - path: "apps/web/src/components/PostThumbnail.tsx"
      issue: "Accepts the whole Post object as a prop, forcing React to serialise post.thumbnail across the client boundary for file-type thumbnails that never read it."
    - path: "apps/web/src/templates/default/HomePage.tsx"
      issue: "Call site passes the whole post object."
    - path: "apps/web/src/templates/default/SearchPage.tsx"
      issue: "Call site passes the whole post object."
    - path: "apps/web/src/templates/default/CategoryPage.tsx"
      issue: "Call site passes the whole post object."
    - path: "apps/web/src/templates/default/PostPage.tsx"
      issue: "Call site passes the whole post object."
  missing:
    - "Narrow PostThumbnail's prop interface to only the values the client actually needs, so post.thumbnail never crosses the client boundary for file-type thumbnails."
    - "Update all four default-template call sites to the narrowed interface."
    - "Re-verify against the deployed site that no `X-Amz-Signature`/`X-Amz-Credential` bearing URL appears anywhere in the served HTML, payload included — the check 09-02 ran that returned 3 on the home feed and 1 on a post page must return 0."
    - "Correct the 09-01 must_haves truth's status once the claim holds as written."
  debug_session: ""
