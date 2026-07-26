---
phase: 03-subscribe-path
verified: 2026-07-26T07:40:00Z
status: gaps_found
score: 3/5 roadmap success criteria verified (1 failed, 1 requires live credentials)
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "A submission past the per-IP rate limit is rejected/dropped (ROADMAP SC#4, rate-limit half; SUB-04)"
    status: failed
    reason: >
      The rate limiter's sole identity key is the first comma-separated entry of the
      client-suppliable `x-forwarded-for` header. Independently reproduced in this environment:
      8 consecutive POSTs, each with a distinct fabricated `x-forwarded-for` value, all reached the
      Resend stage (HTTP 500 against a fake key) with zero HTTP 429 responses — the exact bypass
      03-REVIEW.md's CR-01 (Critical) predicted. A real attacker needs no botnet or IP rotation,
      just a custom header per request from one machine. This was flagged Critical by the phase's
      own code review on 2026-07-26T07:21:17Z and has no fix, no follow-up commit, and no
      documented risk-acceptance override anywhere in `.planning/` as of this verification.
    artifacts:
      - path: "apps/web/src/app/api/subscribe/route.ts"
        issue: "getClientIp() (lines 34-38) trusts request.headers.get('x-forwarded-for') without validating it originates from a trusted hop; isRateLimited()'s Map is keyed entirely on that value"
    missing:
      - "Either: key the rate limiter on a platform-injected, non-client-overridable header (verify the exact Vercel header name against current platform docs before finalizing), or take the LAST x-forwarded-for entry with an explicitly documented trusted-proxy-count assumption, or cap total distinct keys the map can hold within a window independent of expiry"
      - "A recorded decision (override, ADR, or explicit risk-acceptance entry) if the team chooses to ship with this residual risk knowingly, rather than leaving it silently unresolved"
deferred: []
human_verification:
  - test: "Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)"
    expected: "Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {\"ok\":true} body with no dashboard-visible duplicate error"
    why_human: "Requires a real RESEND_API_KEY and RESEND_AUDIENCE_ID; none exist in this execution environment. Carried to the operator checklist per D-26 in 03-01-SUMMARY.md — not claimed as passed."
  - test: "Terminal-template SSR probe: with CONFIG.template set to \"terminal\" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times"
    expected: "The marker data-testid=\"subscribe-form\" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console"
    why_human: "Requires NOTION_TOKEN/NOTION_DATABASE_ID to resolve a real post id; both are absent in this execution environment (WINDOWS.md ledger id 1, status: open, unrun-verify). The two credential-free static boundary gates (no client-directive module imports SubscribeSection; SC#5 bundle grep with both template code paths present) were independently re-run in this verification and passed, which is what actually protects SEC-03/SUB-02 here — but the live differential itself has never been executed."
  - test: "Post-partial-failure convergence: after a state where contacts.create succeeds but contacts.update fails, does a visitor's retry of the same address converge to unsubscribed:false in a live Audience?"
    expected: "The retried submission results in the contact present with unsubscribed:false, with no in-route retry loop involved"
    why_human: "Authored as a `verification: backstop` truth in 03-01-PLAN.md; requires a live Audience and a way to force a partial failure, neither available here. Abstains per backstop protocol rather than being claimed as passed."
---

# Phase 3: Subscribe Path Verification Report

**Phase Goal:** A visitor can subscribe to new-post notifications through a form that's fully gated
server-side, resistant to bot/enumeration abuse, and absent entirely when unconfigured.

**Verified:** 2026-07-26T07:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Valid email submit -> added to Resend Audience | ? human_needed | No real Resend credentials in this environment. Structurally proven up to the Resend API boundary: independently rebuilt with placeholder credentials, POST reaches `resend.contacts.create`/`.update` (confirmed via `[Subscribe] Resend contact create failed: API key is invalid` log line). Live Audience confirmation is an operator-checklist item per D-26, not claimed as passed by the executor. |
| 2 | Unset env vars -> `SubscribeSection` renders no form in SSR HTML | ✓ VERIFIED | Independently rebuilt `apps/web` with both `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset; `grep -c 'data-testid="subscribe-form"' .next/server/app/index.html` = 0. Rebuilt again with placeholder credentials set; same grep = 1. Source: `SubscribeSection.tsx` returns `null` unless both env vars are truthy (read directly, matches). |
| 3 | Duplicate submission -> identical response (status + body) | ✓ VERIFIED | Structural: `route.ts` runs `contacts.create` then `contacts.update` unconditionally with no `return`, no `exist`/`already`/`duplicate` identifier between them. Empirical: two live POSTs of the identical address against a running server (placeholder credentials) returned byte-identical `{"ok":false,"code":"server_error"}` / HTTP 500 both times. |
| 4 | Honeypot populated OR past per-IP rate limit -> rejected/dropped | ✗ **FAILED** (rate-limit half) | Honeypot half VERIFIED: a populated `company` field returns `{"ok":true}`/200 (byte-identical to real success) with no corresponding `[Subscribe] Resend contact create failed` log line, while an otherwise-identical control request with an empty honeypot does reach Resend. **Rate-limit half FAILED**: independently reproduced CR-01 from `03-REVIEW.md` — 8 POSTs, each with a distinct fabricated `x-forwarded-for` header, all reached the Resend stage (HTTP 500) with zero HTTP 429 responses. The rate limiter's sole key is a client-suppliable header value, so it provides no protection against a scripted flood that rotates that header. See Gaps below. |
| 5 | `RESEND_API_KEY` absent from built client-side JS bundle | ✓ VERIFIED | Independently re-ran `grep -rl RESEND_API_KEY apps/web/.next/static/` on both an unconfigured build and a configured (placeholder-credential) build with both template code paths present — 0 matches in both. Also grepped for the literal fake key value and for a `re_`+20-char pattern (per orchestrator finding) — 0 matches. |

**Score:** 3/5 roadmap success criteria fully verified; 1 failed (SC#4 rate-limit half); 1 requires
live credentials not available in this environment (SC#1, and the live half of SC#3, already
structurally verified above).

### Supporting Must-Have Truths (from PLAN frontmatter, spot-checked)

| Must-have | Status | Evidence |
|---|---|---|
| Exactly one Server-Component render-gate (`SubscribeSection`); no template/page/client component reads either Resend var (D-04) | ✓ VERIFIED | Repo-wide grep for `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` across `apps/web/src` shows exactly 3 files: `SubscribeSection.tsx` (the gate), `route.ts` (the plan's explicitly separate D-22 request-time check, not a render gate), and `email.ts` (client construction only, no presence check). No template or client component reads either var. |
| No client-directive module imports `SubscribeSection` (SEC-03) | ✓ VERIFIED | Independent repo-wide scan: zero files beginning with `"use client"` reference `SubscribeSection`. `templates/terminal/PostPage.tsx` (client directive) receives the pre-rendered gate via the `subscribeSlot` prop from the Server-Component post route, per the plan's documented architectural constraint. |
| `packages/core` and `site.config.ts` show no diff across the phase | ✓ VERIFIED | `git diff --stat d53941d^..3372ae9 -- packages/core/` and `-- apps/web/src/site.config.ts` both empty. |
| `resend` dependency confined to `apps/web/package.json` (D-19) | ✓ VERIFIED | `apps/web/package.json` lists `resend@^6.18.0`; `packages/core/package.json` and root manifest have no reference. |
| Exactly three `console.` call sites in `route.ts`, none referencing the address or IP identifier (D-24/D-25) | ✓ VERIFIED | Read `route.ts` directly: 3 `console.error` call sites (create failure, update failure, unconfigured-call), none reference `normalizedEmail` or `clientIp`. |
| No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) in phase-modified files | ✓ VERIFIED | Grepped all 7 phase-modified files; zero matches. |
| Backstop: post-partial-failure convergence recovers via visitor retry (D-18) | ? human_needed | `verification: backstop` in 03-01-PLAN.md; requires a live Audience and a forced partial-failure condition. Abstains per backstop protocol — routed to human verification, not claimed passed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/email.ts` | Single Resend client construction seam | ✓ VERIFIED | Lazy `getResend()` accessor, no presence check, no fallback key. Deviation from the plan's literal eager-construction snippet is documented and justified (SDK constructor throws synchronously when unconfigured, which would break `next build` for every fork — fixing this was necessary for SUB-02's off-by-default contract). |
| `apps/web/src/components/subscribe/SubscribeSection.tsx` | Sole env gate, Server Component | ✓ VERIFIED | No client directive; checks both vars; returns `null` on absence. |
| `apps/web/src/components/subscribe/SubscribeForm.tsx` | Client form island, both variants | ✓ VERIFIED | No `process.env`, no `localStorage`/`sessionStorage`; `data-testid="subscribe-form"` present in both `default` and `terminal` branches; one shared `fetch(` call; honeypot written once. |
| `apps/web/src/app/api/subscribe/route.ts` | Full 5-stage D-23 pipeline | ⚠️ VERIFIED WITH A GAP | Configuration -> rate limit -> honeypot -> validation -> Resend, all present and correctly ordered. The rate-limit stage's key derivation is the unresolved CR-01 defect (see Gaps). |
| `apps/web/src/templates/default/Layout.tsx` | Two insertion points after Profile | ✓ VERIFIED | `<SubscribeSection variant="default" />` at both the mobile block and the desktop aside. |
| `apps/web/src/templates/terminal/PostPage.tsx` | `subscribeSlot` prop, rendered between article and console | ✓ VERIFIED | Optional prop, rendered directly, no import of the subscribe directory, no env read. |
| `apps/web/src/app/post/[id]/page.tsx` | Server-side slot construction | ✓ VERIFIED | Imports `SubscribeSection`, passes `subscribeSlot={<SubscribeSection variant="terminal" />}` only in the terminal branch; `DefaultPostPage` receives no slot. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `templates/default/Layout.tsx` | `SubscribeSection.tsx` | Direct import + render, 2 sites | ✓ WIRED | Confirmed by source read. |
| `SubscribeSection.tsx` | `SubscribeForm.tsx` | Renders after presence check | ✓ WIRED | Confirmed by source read. |
| `SubscribeForm.tsx` | `/api/subscribe` | `fetch POST` with JSON body | ✓ WIRED | Confirmed by source read and by live POST/response round-trip in this verification. |
| `route.ts` | `lib/email.ts` | `getResend()` import | ✓ WIRED | Confirmed by source read and by observing `[Subscribe] Resend contact create failed` log output during a live probe (proves the SDK layer was actually reached). |
| `app/post/[id]/page.tsx` | `SubscribeSection.tsx` | Constructs element, passes as `subscribeSlot` | ✓ WIRED | Confirmed by source read. |
| `templates/terminal/PostPage.tsx` | `app/post/[id]/page.tsx` | Renders received `subscribeSlot` | ✓ WIRED | Confirmed by source read; slot rendered strictly between `</article>` and the `h-[50vh]` console block. |

### Behavioral Spot-Checks (live, against this verification's own rebuild with placeholder credentials)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SSR marker absent when unconfigured | rebuild with both vars unset, grep prerendered `index.html` | 0 matches | ✓ PASS |
| SSR marker present when configured | rebuild with placeholder vars, grep prerendered `index.html` | 1 match | ✓ PASS |
| Bundle excludes secret name (both build states) | `grep -rl RESEND_API_KEY .next/static/` | 0 matches both times | ✓ PASS |
| Duplicate submission -> identical response | two live POSTs, same address | byte-identical `500`/`server_error` both times | ✓ PASS |
| Honeypot -> fake success, no Resend call | live POST with `company` populated vs. empty control | trap: `200 {"ok":true}`, no Resend log line; control: `500 server_error`, Resend log line present | ✓ PASS |
| Rate limit boundary (default "unknown" bucket) | 6-request loop, no header spoofing | 5th allowed through, 6th+ returned 429/`rate_limited` | ✓ PASS (as literally specified) |
| **Rate limit bypass via spoofed `x-forwarded-for`** | 8 POSTs, distinct fabricated header value each | **0/8 returned 429; all reached Resend (500)** | **✗ FAIL — CR-01 reproduced** |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SUB-01 | 03-01, 03-03 | Visitor can submit email via a form | ✓ SATISFIED | Default template: full E2E path proven live. Terminal template: form/markup/wiring statically proven; live SSR probe on a real post page is an unrun operator-checklist item (WINDOWS.md id 1), not a contradiction of the static evidence. |
| SUB-02 | 03-01, 03-03 | Form fully absent/inert when env unset | ✓ SATISFIED | Default template SSR absence independently reproduced. Terminal template's gate is provably the same singular `SubscribeSection` (repo-wide scan), so the same fail-closed guarantee structurally extends; the terminal-specific live differential is the same unrun operator item as SUB-01 above. |
| SUB-03 | 03-01, 03-02 | Duplicate submission -> identical response, no enumeration oracle | ✓ SATISFIED | Structural + empirical proof; 429 and honeypot responses also carry no subscription-status signal (independently confirmed by reading response bodies). |
| SUB-04 | 03-02 | Blocks bots via honeypot + per-IP rate limiting | ✗ **BLOCKED** | Honeypot half satisfied. Rate-limiting half is not effectively achieved: the sole rate-limit key is a client-forgeable header, independently confirmed bypassable with zero successful throttling across 8 spoofed requests (CR-01, Critical, unresolved). |
| SEC-03 | 03-01, 03-03 | Secret never reaches client bundle | ✓ SATISFIED | Independently re-verified via bundle grep across both build states and both template code paths, plus a repo-wide scan confirming no client-directive module imports the gate. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `apps/web/src/app/api/subscribe/route.ts` | 34-38 | `getClientIp()` trusts an unauthenticated, client-suppliable header as the sole rate-limit identity key | 🛑 Blocker | Defeats the per-IP rate limiter entirely against a trivial scripted attack (CR-01, independently reproduced) |
| `apps/web/src/app/post/[id]/page.tsx` | 71-74 | `relatedPosts` filter has no `p.id !== post.id` exclusion (review WR-01) | ℹ️ Info | Pre-existing, confirmed unmodified by this phase's diff; not a phase-3 regression |
| `apps/web/src/app/post/[id]/page.tsx` | 67-80 | One `try`/`catch` around three independent fetches wipes all three on any single failure (review WR-02) | ℹ️ Info | Pre-existing, confirmed unmodified by this phase's diff |
| `apps/web/src/templates/terminal/PostPage.tsx` | 51 | Unguarded `new Date(post.createDate).toISOString()` can throw `RangeError` (review WR-03) | ℹ️ Info | Pre-existing, confirmed unmodified by this phase's diff |
| `apps/web/src/app/api/subscribe/route.ts` | 124-136 | No explicit length cap on `normalizedEmail` before regex test (review IN-04) | ℹ️ Info | Low severity, defense-in-depth only; not required by any must-have |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 7 phase-modified files.

### Human Verification Required

See `human_verification` in the frontmatter. Three items, none of which are phase-3 implementation
gaps — all three are pre-acknowledged in the phase's own SUMMARYs as requiring credentials or a live
environment this execution context does not have (real Resend account, real Notion post id). None
were claimed as passed by the executor.

### Gaps Summary

Four of five ROADMAP success criteria hold up under independent, adversarial re-verification in this
environment — including two (SC#2 absence, SC#5 bundle exclusion) rebuilt from scratch rather than
trusted from prior build artifacts, and one (SC#3 duplicate-submission) exercised live against a
running server rather than only inspected in source.

The one genuine gap is **SC#4's rate-limiting half**. The phase's own code review (`03-REVIEW.md`,
committed 2026-07-26T07:21:17Z) identified this as a Critical finding (CR-01): `getClientIp()` derives
the sole rate-limit key from the first entry of the client-suppliable `x-forwarded-for` header, with
no validation that the value originates from a trusted hop. This verification independently
reproduced the exploit — 8 POSTs, each carrying a distinct fabricated `x-forwarded-for` value, all
reached the Resend stage with zero HTTP 429 responses, meaning the "5 requests per 10 minutes"
guarantee never engages against an attacker willing to vary one header per request. This directly
contradicts the phase goal's explicit "resistant to bot/enumeration abuse" clause for the
rate-limiting mechanism specifically (the honeypot mechanism is unaffected and independently verified
solid).

This is distinct from the already-accepted T-03-11 threat (distributed/rotating real source IPs
defeating a per-instance counter, which needs new infrastructure to fully close and is out of
`REQUIREMENTS.md`'s scope) — CR-01 requires no distributed infrastructure at all, just one attacker on
one machine varying a request header. No commit, override, or documented risk-acceptance addressing
CR-01 exists anywhere in `.planning/` as of this verification; it was raised by the review and then
silently left open. No later phase in `ROADMAP.md` (Phase 4 Notify Route, Phase 5 Production Cutover,
Phase 6 Documentation) addresses IP-derivation hardening for the subscribe route, so this is not a
deferred item — it needs a closure plan now.

**This looks like it needs a decision, not necessarily a full rewrite.** If the team judges the actual
Vercel deployment target injects a non-overridable client-IP header (which the review explicitly
recommends verifying rather than assuming), a small fix swapping the header source — or an explicit,
recorded risk acceptance if the residual is judged acceptable at this project's traffic scale — would
close this gap. Until either happens, SC#4's rate-limit guarantee does not hold against the threat
model the phase itself defines.

---

_Verified: 2026-07-26T07:40:00Z_
_Verifier: Claude (gsd-verifier)_
