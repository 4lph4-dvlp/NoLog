---
phase: 04-notify-route
verified: 2026-07-27T12:00:00Z
status: overrides_accepted
score: 13/16 truths verified
behavior_unverified: 2
overrides_applied: 2
override_notes: >
  (1) NOTIFY-04 per-post isolation: user explicitly accepted structural-only
  coverage (try/catch present and correctly placed, code-reviewed, but no
  live-Notion-editable input can currently trigger it) rather than adding an
  artificial throwable precondition. (2) NOTIFY-05 capability short-circuit:
  code independently re-confirmed correct (patchPage() checks res.status===403
  precisely), but live reproduction failed twice (including with a freshly
  reissued NOTION_TOKEN) — Notion's dashboard showed "Update content"
  unchecked both times yet the PATCH still returned 200. Root cause is
  Notion-platform-side, not a code defect; tracked in STATE.md Blockers for
  re-verification before Phase 5 ships. (3) SC#1 external-thumbnail live
  rendering: verified at code level only (three-case repro of
  getEmbeddableThumbnailUrl()/imgHtml against valid-external/file-type/
  invalid-external inputs, all correct) — user accepted this in lieu of a
  fourth live broadcast, given external-URL thumbnails are rarely used in
  their actual content.
gaps:
  - truth: "A post whose section builder throws is excluded from the digest and logged distinguishably, while every other eligible post's section is still assembled, sent and marked emailed (NOTIFY-04, ROADMAP SC#4)"
    status: failed
    reason: >
      04-03-SUMMARY.md itself records this as NOT DEMONSTRATED, and independent
      re-verification confirms the root cause is deeper than "test wasn't run
      yet": buildSectionHtml() in the current route cannot throw for ANY
      Notion-editable content. getTitle() (packages/core/src/client.ts:28-34)
      falls back to the literal string "Untitled" and never throws; getRichText()
      (used for summary) falls back to "" and never throws; getEmbeddableThumbnailUrl()
      wraps its own `new URL()` parse in an internal try/catch and returns null
      on failure instead of propagating. Given Post's extractors are total
      functions over the current schema, the per-post try/catch at route.ts
      lines 261-274 is defensive code with no currently reachable trigger —
      it cannot be exercised by any live Notion data an operator could stage,
      which is exactly what the operator's attempt (clearing a post's title)
      confirmed empirically. 04-03-PLAN.md's own prohibition states "MUST NOT
      mark any ROADMAP success criterion closed on the strength of source
      inspection alone" for SC#4 specifically — that prohibition was honored
      (the SUMMARY did not claim a false pass), but the criterion itself
      remains open. This is also independently tracked in STATE.md Blockers/Concerns
      as still-open.
    artifacts:
      - path: "apps/web/src/app/api/notify-subscribers/route.ts"
        issue: "Per-post try/catch at the section-assembly loop (lines 261-274) is structurally correct and wired, but has no known live trigger given current property-extraction fallbacks (getTitle/getRichText never throw); NOTIFY-04's isolation behavior is therefore unproven by any observed outcome."
    missing:
      - "A decision, recorded as an explicit override (with reasoning + acceptance) OR a follow-up plan that gives buildSectionHtml() (or an earlier validation point) a real throwable precondition — e.g. reject a post whose title resolved to the getTitle() fallback sentinel, or throw when a required field is empty — followed by a live re-test that actually exercises the catch branch and confirms the other posts still send and mark."
behavior_unverified_items:
  - truth: "The digest email includes an OG-image thumbnail per post, embedded for a pasted-external Notion thumbnail (ROADMAP SC#1's thumbnail clause, NOTIFY-01)"
    test: "Stage a Notion post with an external (pasted-URL) thumbnail and one with a Notion-uploaded (file-type) thumbnail, run the live digest send, and open the delivered email."
    expected: "The external-thumbnail post's section shows a loaded <img>; the file-type post's section shows no image and no broken-image icon."
    why_human: "Requires opening a real delivered email in a mail client. Structural/type-level checks (node assertion against packages/core/dist, static grep on route.ts) pass and are independently confirmed in this verification pass, but 04-03-SUMMARY.md's live-send report (the only place this could have been confirmed) contains zero mentions of \"image\"/\"thumbnail\"/\"<img>\" anywhere in its scenario results — the 04-02-SUMMARY.md's own coverage table (D2) explicitly deferred this exact confirmation to 04-03's operator checkpoint, and that deferred confirmation was never delivered with evidence."
  - truth: "A mark-emailed failure for one post does not stop the remaining posts from being marked, and a NotionCapabilityError is logged through its own once-per-run branch distinct from a generic mark failure (NOTIFY-05, capability short-circuit)"
    test: "Revoke the Notion integration's Update content capability, stage an unemailed public post, invoke the route, and observe the console output."
    expected: "Exactly one \"[Notify] markEmailed blocked...\" line (not one per post) plus the unmarked-count summary line."
    why_human: "Code path (route.ts lines 340-359) is present and structurally correct — instanceof NotionCapabilityError branch, capabilityBlocked short-circuit flag, capabilityErrorLogged latch. 04-03-SUMMARY.md's coverage item D9 records this scenario as \"operator-confirmed, not orchestrator-observed\" — no console output or artifact was pasted back for this specific scenario, only a self-report that it worked, which is weaker evidence than every other coverage row in the same document."
---

# Phase 4: Notify Route Verification Report

**Phase Goal:** When one or more posts go public, the daily cron sends current subscribers a single digest email listing every newly-public post from that run via Resend's Broadcast API, isolated per-post-section on failure, CAN-SPAM/RFC 8058 compliant, and reachable only by an authenticated cron request.
**Verified:** 2026-07-27
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#3 — 401 rejection (missing/wrong `CRON_SECRET`) before any Notion/Resend call, timing-safe comparison | ✓ VERIFIED | `route.ts:185-197`: `safeCompare()` via `node:crypto.timingSafeEqual` is the literal first statement; line 190 (auth check) precedes line 228 (`getUnemailedPublicPosts`) and line 298 (`getResend()`). Live-confirmed in 04-03-SUMMARY.md scenario A/D6: no-header → 401, wrong-Bearer → 401, exactly one fixed `[Notify] Unauthorized cron request rejected.` log line, no Notion/Resend activity. Re-confirmed by this verification: `npx tsc --noEmit` and `npx eslint` pass clean on the route. |
| 2 | SC#6 — `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset → notify no-ops at 200, no Notion query, no send; `/api/subscribe` independently still 404 | ✓ VERIFIED | `route.ts:199-223` — config gate reads env/CONFIG and returns `{ok:true, code:"unconfigured"}` before any Notion/Resend call. Live-confirmed in 04-03-SUMMARY.md scenario B (4 sub-checks, including `NOTIFY_PHYSICAL_ADDRESS` unset independently producing the same result — D-09). `apps/web/src/app/api/subscribe/route.ts` was not modified this phase (confirmed via `git log`), and its 404 branch (`route.ts:327`) is unchanged. |
| 3 | SC#1 (broadcast mechanics) — 3 eligible posts → exactly ONE digest email via exactly ONE `resend.broadcasts.create()` call (not a loop, not 3 sends) | ✓ VERIFIED | Structural: exactly one actual call site (`route.ts:310`, inside a single non-looped `try`); the other `broadcasts.create` grep hit (`route.ts:308`) is a `typeof` type reference, not a call. Live-confirmed in 04-03-SUMMARY.md D1: response `{"ok":true,"code":"sent","count":3,"marked":3}`, Resend dashboard showed exactly 1 broadcast entry, 1 email received. |
| 4 | SC#1 (content) — Digest lists post title, summary, and link per post, oldest-first, no greeting/intro above the first section | ✓ VERIFIED | `route.ts:254-275` applies no sort/reverse (D-01 comment); `buildSectionHtml()` renders escaped title/summary/link. Live-confirmed in 04-03-SUMMARY.md D2: 3 sections in `created_time` order, no intro text, raw HTML cross-checked byte-for-byte against the template. |
| 5 | SC#1 (thumbnail) — OG-image thumbnail renders per post when the source is a permanent external URL, and text-only (no broken image) when it is Notion-hosted or absent | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present and structurally sound (`getEmbeddableThumbnailUrl()`, gated on `thumbnailType === "external"` + `https:` parse). Verified independently in this pass: node assertion against the rebuilt `packages/core/dist/index.js` confirms `thumbnailType` is `"file"`/`"external"`/`null` correctly and `thumbnail` (getFileUrl) is unregressed. **However**, live-inbox confirmation of the actual rendered image is missing — see `behavior_unverified_items`. |
| 6 | SC#2 — Working one-click unsubscribe link, configured physical mailing address, and a "why you're receiving this" line all present in the delivered footer | ✓ VERIFIED | `route.ts:148-168` (`buildFooterHtml`) renders all three, byte-identical regardless of section count. Live-confirmed in 04-03-SUMMARY.md D3: operator clicked the link, it resolved with no login, the Resend contact flipped to unsubscribed; raw email source additionally confirmed RFC 8058 `List-Unsubscribe`/`List-Unsubscribe-Post` headers are present (fully resolving 04-RESEARCH.md Open Question 1). |
| 7 | SC#4 — A post whose section fails to build is excluded from the digest and logged distinguishably; every other eligible post's section is still assembled, sent, and marked `emailed` | ✗ FAILED | See `gaps` in frontmatter. Try/catch structure is present (`route.ts:261-274`) but 04-03-SUMMARY.md explicitly records this as NOT DEMONSTRATED, and this verification pass independently confirmed the root cause: `getTitle()`/`getRichText()` (`packages/core/src/client.ts:28-44`) never throw for any input, so `buildSectionHtml()` cannot currently be made to throw by any Notion-editable content. Tracked as an open blocker in `STATE.md`. |
| 8 | SC#5 — A whole-digest send failure (e.g. invalid API key) marks zero posts from that run | ✓ VERIFIED | `route.ts:296-330`: mark loop (`route.ts:337+`) is unreachable from the send-failure return paths (both the caught-throw branch at line 320-324 and the `sendError` branch at line 326-330 `return` before the mark loop). Live-confirmed in 04-03-SUMMARY.md D5: `RESEND_API_KEY=re_invalid` → `{"ok":false,"code":"send_failed"}` at 500, all 3 posts confirmed still `emailed` unchecked in Notion afterward. |
| 9 | NOTIFY-03 (structural) — exactly one `broadcasts.create` call site exists in the module and it sits outside every loop construct | ✓ VERIFIED | Confirmed by direct inspection: the sole actual invocation (`route.ts:310`) is inside a single top-level `try`, not nested in any `for`/`while`/`.map`/`.forEach`. `! grep 'emails.send'` — the forbidden per-recipient transactional API is absent from the file. |
| 10 | NOTIFY-05 (structural) — a `markEmailed` failure for one post doesn't stop the rest, and a `NotionCapabilityError` short-circuits remaining marks with a distinct once-per-run log | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code present and correct (`route.ts:340-359`: `instanceof NotionCapabilityError` branch, `capabilityBlocked` flag, `capabilityErrorLogged` latch). 04-03-SUMMARY.md coverage item D9 records this scenario as operator-confirmed but **not independently observed** by the orchestrator (no log/output pasted back) — weaker evidence than every other coverage row in that document. |
| 11 | D-10..D-13 — at most `NOTIFY_BATCH_SIZE` posts (default 50) processed per run, measured by count not elapsed time; deferral logged once | ✓ VERIFIED | `route.ts:239-252`: `Number.parseInt` guard rejects non-positive/non-finite overrides and falls back to the default; `candidates.slice(0, batchSize)` applied before any section assembly; single `console.log` deferral line outside any loop. Deterministic, pure logic — verifiable by code inspection alone, no live trial needed. |
| 12 | `Post.thumbnailType` correctly reports `"file"`/`"external"`/`null`, with no regression to `getFileUrl()`/`thumbnail` | ✓ VERIFIED | Independently re-ran the node assertion against the rebuilt `packages/core/dist/index.js` in this verification pass: `thumbnailType` correct for all three cases, `thumbnail` values unchanged. `npx tsc --noEmit` and `npm run build` in `packages/core` both clean. |
| 13 | Non-regression of `getFileUrl()`, `getPosts()`, `getPost()`, `getCategories()` after adding `thumbnailType`/`getFileType()` | ✓ VERIFIED | `getFileUrl()` byte-identical to pre-task state (confirmed by reading `client.ts:66-76`, unchanged); `getFileType()` (`client.ts:86-96`) is a separate, non-shared function per the plan's explicit no-refactor instruction. |
| 14 | CR-01 fix — thumbnail `<img src>` cannot be used for HTML/attribute injection into the outbound digest | ✓ VERIFIED | Independently reproduced the exploit payload (`https://evil.example/x.jpg" onerror="alert(1)`) against the current `getEmbeddableThumbnailUrl()`/`escapeHtml()` logic in this verification pass: `new URL().href` percent-encodes the embedded quote before `escapeHtml()` even runs, and the resulting `<img>` tag contains no unescaped `" onerror="` breakout. Route code confirms both fixes are present: `parsed.href` (not raw input) at `route.ts:80`, and `escapeHtml(embeddableThumbnail)` at `route.ts:115`. |
| 15 | Auth gate holds no exploitable module-scope mutable state; no query-param or second auth path exists | ✓ VERIFIED | `cronSecret`/`authHeader` are per-request locals read fresh from `process.env`/`request.headers` each call; the only module-scope mutable value (`unconfiguredLogged`) affects logging only, never the auth verdict. Only one `GET` export exists in the file; no alternate route. |
| 16 | Backstop — a live authenticated invocation delivers exactly one email and the unsubscribe mechanism (visible link + `List-Unsubscribe` header) works end-to-end | ✓ VERIFIED | 04-03-SUMMARY.md provides specific, itemized evidence (response body, Resend dashboard broadcast count, received-email count, raw header inspection) rather than a vague claim — meets the bar these `verification: backstop` truths require. |

**Score:** 13/16 truths verified (2 present-but-behavior-unverified, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/app/api/notify-subscribers/route.ts` | GET handler, safeCompare auth gate, SEC-02 gate, capped query, isolated section assembly, one broadcast, mark-after-send loop | ✓ VERIFIED | 369 lines; contains `timingSafeEqual`, exactly one `export async function GET`, `export const runtime = "nodejs"`, no `POST` export. `npx tsc --noEmit` and `npx eslint` both pass clean. |
| `apps/web/src/site.config.ts` | `CONFIG.notify` block with `fromAddress` | ✓ VERIFIED | Present (`site.config.ts:51-54`). `physicalAddress` was deliberately moved out to `NOTIFY_PHYSICAL_ADDRESS` env var post-execution (D-06 revision, documented in 04-01-SUMMARY.md and reflected consistently in the route code) — this is a documented, reasoned deviation, not an omission. |
| `apps/web/src/lib/notion.ts` | `getUnemailedPublicPosts`/`markEmailed` pass-throughs, not `cache()`-wrapped | ✓ VERIFIED | Present (`notion.ts:39-48`), explicit comments explain why `cache()` is deliberately absent. `grep -c 'cache('` in the file = 3 (only the three pre-existing read paths). |
| `packages/core/src/types.ts` | `Post.thumbnailType` | ✓ VERIFIED | `dist/index.d.ts` (rebuilt in this verification pass) contains `thumbnailType`. |
| `packages/core/src/client.ts` | `getFileType()` extractor wired into `mapPageToPost()` | ✓ VERIFIED | `client.ts:86-96`, wired at `client.ts:129`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `route.ts` | `lib/notion.ts` | `await getUnemailedPublicPosts()` / `await markEmailed(post.id)` | ✓ WIRED | Both call sites present (`route.ts:228`, `route.ts:345`), imported at top of file. |
| `route.ts` | `lib/email.ts` | `getResend()` | ✓ WIRED | `route.ts:298`, single seam, no second Resend client constructed anywhere in the repo. |
| `route.ts` | `site.config.ts` | `CONFIG.notify.fromAddress` | ✓ WIRED | Read at `route.ts:208`, used in the broadcast `from` field. |
| `route.ts` | Resend Broadcast API | `resend.broadcasts.create({..., send: true})` | ✓ WIRED | `route.ts:310-319`, single call, `send: true` present. |
| `client.ts` (`mapPageToPost`) | `types.ts` (`Post.thumbnailType`) | `thumbnailType: getFileType(page, "thumbnail", "Thumbnail")` | ✓ WIRED | `client.ts:129`. |
| `route.ts` (`buildSectionHtml`) | `types.ts` (`Post.thumbnailType`) | Branches on `thumbnailType` before emitting `<img>` | ✓ WIRED | `route.ts:111-116`. |

### Data-Flow Trace (Level 4)

Not applicable in the standard "render dynamic UI" sense — this is a server-side batch route, not a page component. The relevant data-flow question (does `getUnemailedPublicPosts()` return real Notion data, not a static stub) was already closed by Phase 1's verification (10/10 must-haves, `status: passed`) and re-confirmed live in this phase's own 04-03 operator checkpoint (3 real Notion posts queried and processed).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Route typechecks | `npx tsc --noEmit` (apps/web) | Clean, no output | ✓ PASS |
| Route lints | `npx eslint src/app/api/notify-subscribers/route.ts` | Clean, no output | ✓ PASS |
| `packages/core` typechecks + builds | `npx tsc --noEmit && npm run build` (packages/core) | Clean, `dist/index.d.ts` regenerated with `thumbnailType` | ✓ PASS |
| `thumbnailType` discriminator correctness | Node assertion against rebuilt `dist/index.js` (file/external/null cases) | `thumbnailType OK` | ✓ PASS |
| CR-01 injection fix | Standalone Node repro of the reviewer's exact exploit payload against current `getEmbeddableThumbnailUrl()`/`escapeHtml()` | No unescaped `" onerror="` breakout in output | ✓ PASS |
| Exactly one `broadcasts.create` call site (not a type reference) | `grep -n 'broadcasts\.create'` | Line 308 is a `typeof` type reference; line 310 is the sole call, inside one non-looped `try` | ✓ PASS (with note — see below) |
| Live dev server 401/401/unconfigured/404 sequence | N/A — not re-run in this pass (would require spinning up a dev server); already independently confirmed twice in 04-01-SUMMARY.md and 04-02-SUMMARY.md, and a third time live in 04-03-SUMMARY.md against real credentials | Reported PASS in all three prior runs | ✓ PASS (evidence carried forward, not re-executed) |

**Note on `broadcasts.create` grep count:** the plan's own automated `<verify>` blocks assert `grep -c 'broadcasts\.create' == 1`. After the post-review WR-01 fix (wrapping the send in try/catch), the file now contains a `typeof resend.broadcasts.create` type annotation (`route.ts:308`) in addition to the actual call (`route.ts:310`), so a literal re-run of that exact grep assertion would now report `2` and fail. This does not violate NOTIFY-03's actual intent — there is still exactly one invocation, outside every loop — but it is a real drift between the plan's literal acceptance-criteria grep and the current file. Flagged for completeness, not treated as a gap.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| NOTIFY-01 | 04-01, 04-02 | Single digest per run, listing every newly-public post (title/summary/link/thumbnail) | ⚠️ PARTIAL | Text content (title/summary/link) fully verified live; the thumbnail element specifically lacks live-inbox confirmation (item 5 above) |
| NOTIFY-02 | 04-01 | Unsubscribe link, physical address, why-you're-receiving line | ✓ SATISFIED | Verified live (04-03-SUMMARY.md D3) |
| NOTIFY-03 | 04-01 | Single Resend Broadcast call, never a per-post/per-subscriber loop | ✓ SATISFIED | Verified structurally and live (04-03-SUMMARY.md D1) |
| NOTIFY-04 | 04-01, 04-03 | Per-post isolation — a bad post's section failure doesn't block the rest | ✗ BLOCKED | Explicitly NOT demonstrated by observed outcome; root cause confirmed independently in this pass (see gap) |
| NOTIFY-05 | 04-01, 04-03 | Mark-after-send-only; whole-send failure marks nothing; per-post mark isolation | ⚠️ PARTIAL | The primary invariant (failed send marks zero) is fully verified live. The secondary per-post mark-isolation/capability-short-circuit behavior is only self-reported, not independently observed |
| SEC-01 | 04-01 | Timing-safe `CRON_SECRET` gate, first statement, no bypass | ✓ SATISFIED | Verified structurally and live |
| SEC-02 | 04-01 | Both routes fail closed on unset env vars | ✓ SATISFIED | Verified structurally and live |

No orphaned requirements — all 7 phase requirement IDs from the prompt (NOTIFY-01..05, SEC-01, SEC-02) are declared in at least one plan's `requirements:` frontmatter and are accounted for above. REQUIREMENTS.md's traceability table marks all 7 "Complete," which is not fully accurate for NOTIFY-04 given the explicit gap — this verification report is the authoritative correction.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file this phase modified (`route.ts`, `notion.ts`, `site.config.ts`, `client.ts`, `types.ts`). The one grep hit ("no placeholder" inside `route.ts`'s own doc-comment describing the *absence* of a placeholder image) is not a debt marker.

### Human Verification Required

1. **Live-inbox thumbnail confirmation**

   **Test:** Stage one Notion post with a pasted-external-URL thumbnail and one with a Notion-uploaded (file-type) thumbnail; run a live digest send; open the delivered email.
   **Expected:** The external-thumbnail post's section shows a loaded image; the file-type post's section shows no image (not a broken-image icon).
   **Why human:** Requires visually inspecting a real delivered email. This exact confirmation was explicitly deferred from 04-02 to 04-03's operator checkpoint (per 04-02-SUMMARY.md's own coverage table) but 04-03-SUMMARY.md contains no evidence it was actually performed.

2. **Capability short-circuit — independent observation**

   **Test:** Revoke the Notion integration's "Update content" capability, stage one unemailed public post, invoke the route, and paste the actual console output.
   **Expected:** Exactly one `[Notify] markEmailed blocked — the Notion integration lacks "Update content".` line (not once per post) plus the unmarked-count summary.
   **Why human:** Code is structurally correct, but 04-03-SUMMARY.md records this scenario as operator-confirmed without pasting back the actual log output, unlike every other scenario in the same document.

### Gaps Summary

One blocking gap: **NOTIFY-04's per-post isolation was never demonstrated by observed outcome**, and this verification pass found the reason goes beyond "the operator picked the wrong test input" — the current implementation of `buildSectionHtml()` cannot throw for any Notion-editable post content, because every property extractor it depends on (`getTitle`, `getRichText`) is a total function with a non-throwing fallback, and the one call that could throw (`new URL()` inside `getEmbeddableThumbnailUrl`) is already internally wrapped. The try/catch at the section-assembly loop is real, correctly placed, and would work if triggered — but nothing in the current codebase can trigger it. This means NOTIFY-04 and ROADMAP SC#4 remain open, exactly as `STATE.md` already records. Resolution requires either (a) a recorded override accepting structural-only coverage with an explicit reason, or (b) a small follow-up change giving `buildSectionHtml()` a real throwable precondition, followed by an actual live re-test.

Two items need human follow-up but are not blocking gaps on their own: the live-inbox thumbnail rendering confirmation (part of SC#1, structurally solid but never actually observed in a delivered email per the available evidence), and the capability-short-circuit scenario's weaker (self-reported, not pasted-log) evidence.

Everything else — the auth gate (SEC-01), the fail-closed config gate (SEC-02), the single-broadcast structure and its live confirmation (NOTIFY-03), the CAN-SPAM/RFC 8058 footer and unsubscribe mechanism (NOTIFY-02), the send-failure-marks-nothing invariant (NOTIFY-05's primary clause), the CR-01 HTML-injection fix, and the thumbnail-type discriminator's correctness — is solidly verified, both structurally and against independently re-run evidence in this pass.

---

_Verified: 2026-07-27_
_Verifier: Claude (gsd-verifier)_
