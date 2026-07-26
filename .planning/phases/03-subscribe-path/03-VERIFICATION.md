---
phase: 03-subscribe-path
verified: 2026-07-27T02:20:00Z
status: human_needed
score: 5/5 roadmap success criteria verified; 3 items remain human-verification-only (unchanged, credential-dependent)
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5 roadmap success criteria verified (1 failed, 1 requires live credentials)
  gaps_closed:
    - "SC#4 rate-limit half (CR-01): rate-limit key spoofing via fabricated x-forwarded-for — independently reproduced as FIXED in this pass"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm a real submitted email address actually lands in the configured Resend Audience (SC#1) and that two live submissions of the same address produce a byte-identical response from an operator's own account (SC#3 live half)"
    expected: "Address appears in the Resend dashboard's Audience list after one submission; a second submission of the same address returns the identical 200 {\"ok\":true} body with no dashboard-visible duplicate error"
    why_human: "Requires a real RESEND_API_KEY and RESEND_AUDIENCE_ID; none exist in this execution environment. Carried to the operator checklist per D-26 in 03-01-SUMMARY.md — not claimed as passed."
  - test: "Terminal-template SSR probe: with CONFIG.template set to \"terminal\" and a real Notion post id, build+serve once with placeholder Resend credentials and once with them unset; curl the post URL both times"
    expected: "The marker data-testid=\"subscribe-form\" appears at least once when configured and exactly zero times when unset, positioned between the article and the terminal console"
    why_human: "Requires NOTION_TOKEN/NOTION_DATABASE_ID to resolve a real post id; both are absent in this execution environment. The credential-free static boundary gates (no client-directive module imports SubscribeSection; SC#5 bundle grep with both template code paths present) were independently re-run in this verification and passed — that is what actually protects SEC-03/SUB-02 here — but the live differential itself has never been executed."
  - test: "Post-partial-failure convergence: after a state where contacts.create succeeds but contacts.update fails, does a visitor's retry of the same address converge to unsubscribed:false in a live Audience?"
    expected: "The retried submission results in the contact present with unsubscribed:false, with no in-route retry loop involved"
    why_human: "Authored as a `verification: backstop` truth in 03-01-PLAN.md; requires a live Audience and a way to force a partial failure, neither available here. Abstains per backstop protocol rather than being claimed as passed."
---

# Phase 3: Subscribe Path Verification Report

**Phase Goal:** A visitor can subscribe to new-post notifications through a form that's fully gated
server-side, resistant to bot/enumeration abuse, and absent entirely when unconfigured.

**Verified:** 2026-07-27T02:20:00Z
**Status:** human_needed
**Re-verification:** Yes — after two rounds of gap closure (03-04 CR-01 rate-limit key; 03-05 CR-01
origin/content-type; 03-06 CR-01 unconfigured-log volume), all independently re-run against the
current code, not assumed fixed from prior SUMMARYs.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Valid email submit -> added to Resend Audience | ? human_needed | Structurally proven up to the Resend API boundary: independently rebuilt with placeholder credentials, POST reaches `resend.contacts.create`/`.update` (confirmed via `[Subscribe] Resend contact create failed: API key is invalid` log line, freshly reproduced in this pass). Live Audience confirmation remains an operator-checklist item, unchanged from prior rounds. |
| 2 | Unset env vars -> `SubscribeSection` renders no form in SSR HTML | ✓ VERIFIED | Independently rebuilt `apps/web` from scratch with both `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` unset: `grep -c 'data-testid="subscribe-form"' .next/server/app/index.html` = 0. Rebuilt again with placeholder credentials: same grep = 1. Additionally, live-served the unconfigured build and confirmed the `/api/subscribe` route itself returns HTTP 404 on **every** POST (tested 4 consecutive requests across two separate server processes), not just the first — the `unconfiguredLogged` latch added in 03-06 gates only the log line (confirmed exactly 1 log line across those requests), never the 404 response itself, which sits outside the latch block. The "indistinguishable from a route that never existed" contract holds. |
| 3 | Duplicate submission -> identical response (status + body) | ✓ VERIFIED | Live-reproduced: two POSTs of the identical address against a running server (placeholder credentials, same trusted rate-limit key) returned byte-identical `{"ok":false,"code":"server_error"}` / HTTP 500 both times. **Regression check on the new 03-05 same-origin/content-type checks (per this re-verification's specific brief):** a cross-origin-rejected request and a wrong-media-type-rejected request both return the pre-existing `{"ok":false,"code":"invalid_email"}` / HTTP 400 — the exact same status and machine code an ordinary malformed-address rejection already produced before this phase. Live-verified in this pass: no new status code, no new `code` value, no response-shape difference introduced by either new check. No enumeration signal added. |
| 4 | Honeypot populated OR past per-IP rate limit -> rejected/dropped | ✓ VERIFIED (both halves) | **Honeypot half:** live-verified — a populated `company` field returns `{"ok":true}`/200 (byte-identical to real success) with zero corresponding Resend log lines, confirmed via server-log diff before/after the honeypot POST. **Rate-limit half (CR-01, previously FAILED):** independently re-ran the identical bypass reproduction from the original verification against the *current* `route.ts`, from a clean process with no prior state — 8 POSTs, each with a distinct fabricated `x-forwarded-for` value: exactly 5 reached the Resend stage (HTTP 500), and 429/`rate_limited` returned starting at request 6, reproduced identically across two separate clean server processes. This is a complete reversal of the original 0-of-8-blocked finding. Additionally verified per-visitor isolation is preserved on the *trusted* tier: two distinct `x-vercel-forwarded-for` values are tracked as two independent counters (visitor A throttled after 5, visitor B — a different simulated IP — unaffected), confirming the fix collapses only the untrusted (spoofable) tier into a shared bucket rather than breaking real per-visitor limiting. |
| 5 | `RESEND_API_KEY` absent from built client-side JS bundle | ✓ VERIFIED | Independently re-ran `grep -rl RESEND_API_KEY apps/web/.next/static/` on a from-scratch unconfigured build and a from-scratch configured (placeholder-credential) build, both freshly rebuilt in this pass — 0 matches in both. Also grepped for the literal fake key value and for a `re_`+20-char pattern — 0 matches in both build states. |

**Score:** 5/5 roadmap success criteria hold up under independent, adversarial re-verification
(rebuilt from scratch, exercised live against a running server, not read from source alone or
trusted from a prior artifact). 3 items remain genuinely un-verifiable in this environment
(real Resend Audience, real Notion post id, forced partial-failure state) — unchanged in nature
from the original verification, not new gaps introduced by this round's fixes.

### CR-01 Gap Closure Verification (this round's focus)

| Fix (plan) | Claim | Independently re-verified? | Result |
|---|---|---|---|
| Rate-limit key spoofing (03-04) | `getRateLimitKey` tiers `x-vercel-forwarded-for`/`x-real-ip` (trusted) ahead of `x-forwarded-for` (untrusted, collapsed) | ✓ Yes — live 8-request bypass reproduction, twice, from clean process state | Fixed. 5 through, 6-8 blocked (was 0-of-8 blocked before) |
| Rate-limit map DoS ceiling (03-04) | `ATTEMPTS_MAX_KEYS`=2000 expiry-independent ceiling | Read directly in source; not independently load-tested (not required — this is a defense-in-depth ceiling unreachable by any test traffic volume run in this verification) | Present, code-reviewed sound, not separately behaviorally exercised |
| Missing Origin/Content-Type validation (03-05) | `isSameOriginRequest`/`hasJsonContentType` run ahead of body parse, in the design's specified order | ✓ Yes — live: cross-origin request rejected before consuming rate-limit budget (confirmed via same-visitor follow-up request still succeeding); wrong-media-type and malformed-JSON requests both rejected with the pre-existing `invalid_email` code, no new signal | Present, correctly ordered, no enumeration-oracle regression |
| Unconditional per-request logging (03-06) | `unconfiguredLogged` latch limits the diagnostic log to once per instance without gating the 404 response | ✓ Yes — live: 4 total unconfigured POSTs across two server processes, exactly 1 log line total per process, 404 returned on every single request | Fixed and confirmed; SC#2/D-22 contract intact |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/email.ts` | Single Resend client construction seam | ✓ VERIFIED | Lazy `getResend()` accessor, no presence check, no fallback key, unchanged since prior verification. |
| `apps/web/src/components/subscribe/SubscribeSection.tsx` | Sole env gate, Server Component | ✓ VERIFIED | No client directive; checks both vars; returns `null` on absence. Unchanged. |
| `apps/web/src/components/subscribe/SubscribeForm.tsx` | Client form island, both variants | ✓ VERIFIED | No `process.env` read; `data-testid="subscribe-form"` present in both variants; one shared `fetch(` call; honeypot written once. **New finding this pass (see Anti-Patterns): static element ids (`subscribe-email`, `company`) collide when `SubscribeSection` mounts twice in the default template's dual mobile/desktop render — a real defect, Warning severity, not a must-have failure.** |
| `apps/web/src/app/api/subscribe/route.ts` | Full pipeline: config -> origin -> rate limit -> content-type -> parse -> honeypot -> validation -> Resend | ✓ VERIFIED | All 8 stages present, live-exercised in the order the design specifies, in this verification. The CR-01 rate-limit defect this file previously carried is confirmed closed. |
| `apps/web/src/templates/default/Layout.tsx` | Two insertion points after Profile | ✓ VERIFIED | `<SubscribeSection variant="default" />` at both the mobile block and the desktop aside, unchanged. |
| `apps/web/src/templates/terminal/PostPage.tsx` | `subscribeSlot` prop, rendered between article and console | ✓ VERIFIED | Optional prop, rendered directly, no import of the subscribe directory, no env read. Unused `CONFIG` import confirmed pre-existing (introduced at monorepo restructure, commit `c658c7d`, predates this phase) — not a phase-3 regression. |
| `apps/web/src/app/post/[id]/page.tsx` | Server-side slot construction | ✓ VERIFIED | Imports `SubscribeSection`, passes `subscribeSlot={<SubscribeSection variant="terminal" />}` only in the terminal branch. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `templates/default/Layout.tsx` | `SubscribeSection.tsx` | Direct import + render, 2 sites | ✓ WIRED | Confirmed by source read. |
| `SubscribeSection.tsx` | `SubscribeForm.tsx` | Renders after presence check | ✓ WIRED | Confirmed by source read. |
| `SubscribeForm.tsx` | `/api/subscribe` | `fetch POST` with JSON body | ✓ WIRED | Confirmed by source read and by live POST/response round-trips throughout this verification. |
| `route.ts` | `lib/email.ts` | `getResend()` import | ✓ WIRED | Confirmed live — `[Subscribe] Resend contact create failed` log observed repeatedly in this pass, proving the SDK layer is reached. |
| `app/post/[id]/page.tsx` | `SubscribeSection.tsx` | Constructs element, passes as `subscribeSlot` | ✓ WIRED | Confirmed by source read. |
| `templates/terminal/PostPage.tsx` | `app/post/[id]/page.tsx` | Renders received `subscribeSlot` | ✓ WIRED | Confirmed by source read; slot rendered strictly between `</article>` and the `h-[50vh]` console block. |

### Behavioral Spot-Checks (live, against this verification's own from-scratch rebuilds)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SSR marker absent when unconfigured | rebuild with both vars unset, grep prerendered `index.html` | 0 matches | ✓ PASS |
| SSR marker present when configured | rebuild with placeholder vars, grep prerendered `index.html` | 1 match | ✓ PASS |
| Bundle excludes secret name/value (both build states) | `grep -rl RESEND_API_KEY .next/static/`, literal key grep, `re_`+20-char pattern grep | 0 matches, all states | ✓ PASS |
| Unconfigured route returns 404 on every request, not just first | 4 POSTs (2 processes) against unconfigured build | 404 x4; exactly 1 log line per process | ✓ PASS |
| Duplicate submission -> identical response | Two live POSTs, same address, same trusted key | Byte-identical `500`/`server_error` both times | ✓ PASS |
| Honeypot -> fake success, no Resend call | Live POST with `company` populated vs. empty control | Trap: `200 {"ok":true}`, zero new Resend log lines; control: `500 server_error`, Resend log line present | ✓ PASS |
| **Rate limit bypass via spoofed `x-forwarded-for` (CR-01 re-test)** | 8 POSTs, distinct fabricated header value each, run twice from clean process state | **5/8 reached Resend (500); 6th-8th returned 429 — both runs** | ✓ **PASS — CR-01 confirmed fixed** |
| Trusted-tier per-visitor isolation preserved | 6 POSTs from visitor A (`x-vercel-forwarded-for`), then 1 from visitor B | Visitor A: 5 allowed, 6th 429. Visitor B (different key): allowed, unaffected by A's limit | ✓ PASS |
| Cross-origin request rejected before consuming rate-limit budget | Cross-origin POST, then 2 same-origin-but-invalid POSTs, then 1 valid POST, all from same trusted key | Cross-origin: 400 `invalid_email` (no rate-limit state change). Same-key valid request afterward still succeeded (reached Resend) | ✓ PASS |
| Cross-origin/wrong-content-type rejections carry no more signal than pre-existing 400 | Cross-origin POST; wrong-`Content-Type` POST; malformed-JSON POST | All three: `{"ok":false,"code":"invalid_email"}` / HTTP 400 — identical status+code to the pre-phase malformed-address rejection | ✓ PASS — no enumeration-oracle regression |
| Opaque `"null"` Origin explicitly refused | POST with `Origin: null` | `{"ok":false,"code":"invalid_email"}` / HTTP 400 | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and none are referenced by any Phase 3 PLAN/SUMMARY. Step 7c: SKIPPED (no probe convention used by this project — this phase's verification relies on the direct live-server behavioral spot-checks above instead).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| SUB-01 | 03-01, 03-03 | Visitor can submit email via a form | ✓ SATISFIED | Default template: full E2E path live-proven again in this pass. Terminal template: form/markup/wiring statically proven (SEC-03 gate, no client import); live SSR probe on a real post page remains an unrun operator-checklist item (needs real Notion credentials), not a contradiction of the static evidence. |
| SUB-02 | 03-01, 03-03 | Form fully absent/inert when env unset | ✓ SATISFIED | Default template SSR absence independently reproduced from a from-scratch rebuild. Route-level 404 confirmed to fire on every unconfigured request (not gated by the new 03-06 logging latch). Terminal template's gate is the same singular `SubscribeSection` (repo-wide scan, 3 files total reference the env vars, none are templates/pages/client components beyond the gate itself). |
| SUB-03 | 03-01, 03-02 | Duplicate submission -> identical response, no enumeration oracle | ✓ SATISFIED | Structural + live-empirical proof, re-confirmed. The two NEW rejection paths added by 03-05 (origin, content-type) were specifically checked in this pass for oracle leakage — both reuse the pre-existing 400/`invalid_email` code verbatim, adding no new signal. |
| SUB-04 | 03-02, 03-04 | Blocks bots via honeypot + per-IP rate limiting | ✓ SATISFIED (previously BLOCKED) | Honeypot half re-confirmed. Rate-limiting half: CR-01 bypass independently re-reproduced against current code and confirmed CLOSED — 5/8 reach Resend, 6th-8th blocked, reproduced twice from clean state. Trusted-tier per-visitor isolation also confirmed intact (fix does not over-collapse legitimate Vercel traffic). |
| SEC-03 | 03-01, 03-03 | Secret never reaches client bundle | ✓ SATISFIED | Re-verified via bundle grep across both build states, freshly rebuilt in this pass, plus a repo-wide scan confirming no client-directive module imports the gate. |

**Orphan check:** REQUIREMENTS.md traceability table maps only SUB-01, SUB-02, SUB-03, SUB-04, and
SEC-03 to Phase 3 — all five are claimed across the six plans' `requirements:` frontmatter fields
(03-05 and 03-06 are gap-closure plans for SUB-04/SUB-02/SEC-03's already-claimed guarantees and
correctly declare no new requirement IDs). No orphaned requirements found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `apps/web/src/components/subscribe/SubscribeForm.tsx` | 145, 191, 260 (also `Layout.tsx:31,57`) | Static element `id`s (`subscribe-email`, `company`) collide because `DefaultLayout` mounts `SubscribeSection` twice (mobile + desktop, both present in the DOM simultaneously, only CSS-hidden) | ⚠️ Warning | Breaks `<label htmlFor>` association for the visible desktop form (resolves to the CSS-hidden mobile instance); accessibility/HTML-validity defect, confirmed still present in current code. Does not block form submission itself (typing directly into the input still works) — not a phase-goal blocker, but a real, unresolved defect from the phase's own code review (WR-01), independently confirmed. |
| `apps/web/src/templates/terminal/PostPage.tsx` | 9 | Unused `CONFIG` import | ℹ️ Info | Confirmed present via lint run (`warning 'CONFIG' is defined but never used`), but confirmed via `git log` to predate this phase (introduced at commit `c658c7d`, the original monorepo restructure) — not a phase-3 regression. Lint reports it as a warning, not a hard error, in this repo's config; the overall `npm run lint` failure is driven by ~15 pre-existing errors in unrelated files (e.g. `TerminalConsole.tsx`), none introduced by Phase 3. |
| `apps/web/src/app/api/subscribe/route.ts` | 227-232 | `isSameOriginRequest` trusts `x-forwarded-host` unconditionally, without the same tiering/splitting rigor applied to `x-forwarded-for` two functions above | ℹ️ Info | Documented residual (WR-03 from `03-REVIEW.md`, independently re-read and confirmed accurate): not exploitable today because a cross-origin `fetch()` setting this header triggers a CORS preflight this route fails (no `Access-Control-Allow-Origin`), and a plain `<form>` POST cannot set arbitrary headers. A scripted non-browser client already bypasses the whole origin check trivially by design (T-03-21), so this doesn't hand an attacker new capability today — it is an inconsistency worth a comment or future tightening, not a phase-goal blocker. |
| `apps/web/src/app/post/[id]/page.tsx` | 67-83 | `getCategories()`/`getPosts()` fetched and discarded on the default-template path | ℹ️ Info | Confirmed unmodified by this phase's diff (pre-existing, review IN-01). |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 7 phase-modified
files (re-confirmed by direct grep in this pass).

### Human Verification Required

See `human_verification` in the frontmatter. Three items, unchanged in substance from the prior
verification round — all three require credentials (a real Resend account, a real Notion post id)
that do not exist in this execution environment, and none are claimed as passed:

1. Live Resend Audience confirmation for a real submitted address (SC#1) and a live duplicate-submission round trip (SC#3's live half).
2. Terminal-template SSR differential probe against a real Notion post id (SUB-01/SUB-02 terminal half) — the credential-free static boundary checks that stand in for this were independently re-run and passed in this verification.
3. Post-partial-failure convergence via visitor retry (D-18 backstop) — requires forcing a live partial-failure state against a real Audience.

### Gaps Summary

**All gaps from the original verification are closed.** The sole gap identified in the initial
verification pass — SC#4's rate-limiting half, defeated by a client-suppliable `x-forwarded-for`
rate-limit key (CR-01) — was independently re-reproduced against the *current* `route.ts` in this
re-verification (not assumed fixed from the SUMMARY or the code-review narrative): the identical
8-fabricated-header-request bypass that previously returned 0/8 blocked now returns 5/8 allowed
through to Resend and 3/8 correctly blocked with 429, reproduced twice from clean process state
across two independent server instances. Per-visitor rate limiting on the trusted (Vercel-header)
tier was separately confirmed still functional and not over-collapsed by the fix.

Two further Critical findings surfaced and closed during the phase's own subsequent code-review
rounds — missing Origin/Content-Type validation (03-05) and unconditional per-request logging on the
unconfigured path (03-06) — were both independently re-verified in this pass per this verification's
specific brief:

- The new origin/content-type checks reject with the **same** pre-existing `400`/`invalid_email`
  response as an ordinary malformed-address rejection, live-confirmed to carry no additional signal
  — SC#3's no-enumeration-oracle guarantee is intact, not weakened by the new checks.
- The `unconfiguredLogged` latch gates only the diagnostic log line (confirmed: exactly one line
  across multiple requests), never the `404` response itself, which was confirmed to fire on every
  single unconfigured request tested — SC#2/D-22's "indistinguishable from a route that never
  existed" contract holds.

No regressions were found from any of the three rounds of fixes. The most recent independent code
review (`03-REVIEW.md`, 2026-07-27) found 0 Critical, 3 Warning, 3 Info findings across all 8
phase-touched files — this verification independently re-confirmed each of those findings still
holds (one pre-existing unused import predates the phase; the duplicate-DOM-id defect is real and
current but does not block form submission; the `x-forwarded-host` trust asymmetry is a documented,
currently-non-exploitable residual). None rise to a phase-goal blocker.

**Status is `human_needed`, not `passed`,** solely because three items genuinely require
credentials/environment this execution context does not have (a real Resend account, a real Notion
post id, a forced partial-failure state) — the same three items carried since the original
verification, none of which are phase-3 implementation gaps. All five ROADMAP success criteria are
independently verified to hold in every way testable without those external dependencies.

---

_Verified: 2026-07-27T02:20:00Z_
_Verifier: Claude (gsd-verifier)_
