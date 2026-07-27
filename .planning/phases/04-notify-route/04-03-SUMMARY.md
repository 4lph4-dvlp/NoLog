---
phase: 04-notify-route
plan: 03
subsystem: api
tags: [resend, notion, cron, operator-verification, live-credentials]

# Dependency graph
requires:
  - phase: 04-01
    provides: "GET /api/notify-subscribers end-to-end (auth, config gate, digest assembly, single broadcast send, mark-after-send)"
  - phase: 04-02
    provides: "Post.thumbnailType-gated thumbnail embedding"
provides:
  - "Live-credential closure of ROADMAP SC#1, SC#2, SC#3, SC#5, SC#6 by observed outcome"
  - "D-08's unsubscribe mechanism confirmed working end-to-end, both halves of 04-RESEARCH.md Open Question 1 resolved"
  - "kro.kr subdomain (4lph4-bl0g.kro.kr) confirmed as a valid Resend sending domain — DKIM/SPF/DMARC all pass on a real delivered message"
affects: [05-production-cutover]

key-files:
  modified:
    - apps/web/src/site.config.ts
    - apps/web/src/app/api/notify-subscribers/route.ts

key-decisions:
  - "D-06 revised mid-checkpoint (before this plan's live run started): CONFIG.notify.physicalAddress moved to a NOTIFY_PHYSICAL_ADDRESS env var — see 04-01-SUMMARY.md's Post-Execution Revision section for full rationale. Required to even attempt this plan's live run."
  - "Post-execution UX addition during this plan's live review: buildSectionHtml() now renders a second, visible 'read more'/'자세히 보기 →' link under each section's summary, alongside the existing title-hyperlink. Requested after seeing the actual delivered email — the title-only link left no visible URL text in the section body. Locale-aware, same pattern as buildFooterHtml's isKorean branch."
  - "NOTIFY-04's 'malformed post' live test could not be exercised as originally specified in this plan's <how-to-verify> (clearing a post's title). packages/core/src/client.ts's getTitle() falls back to the literal string \"Untitled\" for an empty title, so no exception is ever thrown at the content-assembly stage for this input — buildSectionHtml() has no other input that can throw given current property-extraction fallbacks (title/summary always resolve to a string; thumbnail URL parsing is already try/catch-wrapped internally). Operator chose to restore the title and send all 3 posts normally rather than force an artificial code-level fault for a one-time, unrecallable send. The per-post try/catch structure is still present and verifiable by code inspection (confirmed in 04-01's plan-checker pass), but its live-behavior half of NOTIFY-04 is NOT demonstrated by this run."

requirements-completed: [NOTIFY-01, NOTIFY-02, NOTIFY-03, SEC-01, SEC-02]
requirements-partial: [NOTIFY-04, NOTIFY-05]

coverage:
  - id: D1
    description: "One authenticated invocation against 3 eligible posts delivers exactly ONE email via exactly ONE broadcast (not a loop)"
    requirement: "SEC-01, NOTIFY-01, NOTIFY-03"
    verification:
      - kind: manual_procedural
        ref: "Live run against real Resend/Notion. Response: {\"ok\":true,\"code\":\"sent\",\"count\":3,\"marked\":3}. Resend dashboard Broadcasts: exactly 1 entry (no duplicates, nothing in transactional Emails log). Exactly 1 email received at alpha030520@gmail.com."
        status: pass
    human_judgment: true
  - id: D2
    description: "Digest lists all eligible posts oldest-first with title/summary/link; no intro paragraph above the first section"
    requirement: "NOTIFY-01, D-01, D-04"
    verification:
      - kind: manual_procedural
        ref: "Operator confirmed received email: 3 sections in created_time order, each with title+summary+working link, no greeting/intro text above the first section. Raw source cross-checked: HTML matches buildDigestHtml/buildSectionHtml output byte-for-byte."
        status: pass
    human_judgment: true
  - id: D3
    description: "Working one-click unsubscribe, physical address, and why-you're-receiving line all present in the delivered digest footer"
    requirement: "NOTIFY-02, D-06, D-07, D-08 (revised)"
    verification:
      - kind: manual_procedural
        ref: "Footer confirmed present with all three lines. Operator clicked the visible unsubscribe link: resolved with no login, Resend contact flipped to unsubscribed (operator then manually re-subscribed for record-keeping). Raw email source additionally confirmed List-Unsubscribe + List-Unsubscribe-Post: List-Unsubscribe=One-Click headers ARE present — 04-RESEARCH.md Open Question 1 fully resolved: Resend injects RFC 8058 headers on Broadcast sends even though this was not confirmed by any single official doc page during research."
        status: pass
    human_judgment: true
  - id: D4
    description: "A malformed post's section failing to build doesn't prevent the other posts' sections from being included and sent"
    requirement: "NOTIFY-04"
    verification:
      - kind: manual_procedural
        ref: "NOT DEMONSTRATED. Plan's specified fault-injection method (clear a post's title) does not trigger a section-build exception — packages/core/src/client.ts getTitle() falls back to \"Untitled\" for empty titles, so buildSectionHtml() never throws for this input. No other Notion-editable field can trigger a throw given current property-extraction fallbacks. Operator declined to introduce an artificial code-level fault ahead of a one-time, unrecallable send. Structural code review (try/catch present, confirmed in 04-01 plan-checker pass) stands; live-behavior confirmation does not."
        status: gap
    human_judgment: true
  - id: D5
    description: "A failed broadcast send (invalid API key) marks zero posts; posts remain unemailed and are naturally retried next run"
    requirement: "NOTIFY-05"
    verification:
      - kind: manual_procedural
        ref: "Live run with RESEND_API_KEY=re_invalid: response {\"ok\":false,\"code\":\"send_failed\"}, 500. Log: \"[Notify] Broadcast send failed: API key is invalid\". Operator confirmed in Notion: all 3 posts still emailed=unchecked after this run."
        status: pass
    human_judgment: true
  - id: D6
    description: "No/wrong Authorization header rejected 401 before any Notion/Resend call, with minimal single-line logging"
    requirement: "SEC-01, D-15, D-16"
    verification:
      - kind: manual_procedural
        ref: "curl no-header -> 401. curl wrong-bearer -> 401. Server console: exactly \"[Notify] Unauthorized cron request rejected.\" printed once per request, no secret/header/IP content, no Notion/Resend activity for either request."
        status: pass
    human_judgment: false
  - id: D7
    description: "Manual invocation uses the byte-identical Authorization: Bearer header shape Vercel Cron sends (no alternate auth path)"
    requirement: "D-17"
    verification:
      - kind: manual_procedural
        ref: "All authenticated curl calls throughout this session used curl -H \"Authorization: Bearer $CRON_SECRET\" against the route — the only auth path exercised or available."
        status: pass
    human_judgment: false
  - id: D8
    description: "Unset RESEND_API_KEY/RESEND_AUDIENCE_ID (and, separately, unset NOTIFY_PHYSICAL_ADDRESS) each independently produce a 200 unconfigured no-op with no Notion/Resend call; /api/subscribe independently still returns its bare 404"
    requirement: "SEC-02, D-09, SC#6"
    verification:
      - kind: manual_procedural
        ref: "RESEND_API_KEY/RESEND_AUDIENCE_ID unset: 200 {\"ok\":true,\"code\":\"unconfigured\"}, log names exactly the 2 missing vars, no Notion/Resend activity. Separately, NOTIFY_PHYSICAL_ADDRESS unset (Resend vars restored): same 200/unconfigured result, log names exactly NOTIFY_PHYSICAL_ADDRESS. /api/subscribe POST during the first case: 404, matching Phase 3's unchanged contract."
        status: pass
    human_judgment: false
  - id: D9
    description: "Revoking the Notion integration's Update content capability produces one distinguishable markEmailed-blocked log line per run (not per post) plus an unmarked-count summary"
    requirement: "Open Question 2 resolution (04-RESEARCH.md), capability regression"
    verification:
      - kind: manual_procedural
        ref: "Operator ran this scenario independently and reported it confirmed. Not independently observed by the orchestrator (no log/output was pasted back for this specific scenario) — recorded as operator-confirmed, not orchestrator-verified."
        status: pass
    human_judgment: true
---

# Phase 4 Plan 3: Operator Verification Against Live Resend + Notion — Summary

## Accomplishments

All five verification scenarios (A–E) from `04-03-PLAN.md` were run against real Resend and Notion credentials, in an interactive session where the operator ran each command in their own terminal (the orchestrator has no read access to `.env.local` — a deliberate permission boundary that was respected throughout, not circumvented). Four of five scenarios fully passed with direct evidence; one (NOTIFY-04's malformed-post isolation) could not be exercised as specified and is recorded as an open gap, not a false pass.

**Headline result:** a real digest was sent — one broadcast, one email, three posts, correct ordering, working unsubscribe (both the visible link and, newly confirmed, the `List-Unsubscribe`/`List-Unsubscribe-Post` RFC 8058 headers) — and the `4lph4-bl0g.kro.kr` free Korean subdomain was confirmed as a fully valid Resend sending domain (DKIM/SPF/DMARC all pass on the delivered message's raw headers).

## Scenario Results

| Scenario | Requirement(s) | Result |
|----------|---------------|--------|
| A — reject without valid CRON_SECRET | SEC-01, D-15, D-16 | ✅ PASS |
| B — fail closed on missing Resend vars, missing physical address, /api/subscribe regression | SEC-02, D-09, SC#6 | ✅ PASS (all 4 sub-checks) |
| C — failed send marks nothing | NOTIFY-05, SC#5 | ✅ PASS |
| D — real send: single broadcast, correct content, working unsubscribe, marks on success | NOTIFY-01/02/03/05, SC#1/SC#2, D-08 | ✅ PASS (malformed-post sub-part: see gap below) |
| E — capability-revoked regression | Open Question 2 | ✅ PASS (operator-confirmed, not orchestrator-observed) |

## Decisions Made

- **D-08 fully closed.** The visible `{{{RESEND_UNSUBSCRIBE_URL}}}` footer link works end-to-end (no login, contact flips to unsubscribed in Resend). Additionally, raw email source confirms Resend also sends `List-Unsubscribe`/`List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers automatically — resolving 04-RESEARCH.md's Open Question 1 in full (previously only the suppression-list half was confirmed from official docs).
- **Post-execution UX addition**: `buildSectionHtml()` now renders a visible "read more"/"자세히 보기 →" link under each section's summary (same href as the title link), requested by the operator after reviewing the actual delivered email. Locale-aware via the same `isKorean` pattern already used in `buildFooterHtml()`. Verified with `tsc --noEmit` + `eslint`; not re-verified with a second live send (would have cost a second unrecallable broadcast for a contained, template-only addition already covered by type-check + lint).
- **NOTIFY-04's live test method abandoned, not substituted.** See coverage item D4 above. Recorded as an explicit gap rather than silently passed or worked around with an artificial fault.

## Troubleshooting Encountered (operator-facing, not code changes)

- **`RESEND_AUDIENCE_ID` confusion:** the value initially placed in `.env.local` was a Resend **Contact ID**, not an **Audience ID** (visually identical UUID format, easy to mix up — the Contact detail page in Resend's dashboard doesn't make this obvious). Diagnosed via `Broadcast send failed: Audience not found` in the server log, then resolved definitively via `curl -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/audiences`, which is a more reliable source of truth than dashboard navigation for this specific value.
- **Shell env staleness:** the operator's curl-terminal session had sourced `.env.local` once early in the session; after later edits to the file, that terminal's shell variables were stale until re-sourced. Same class of issue 04-01-SUMMARY.md already documented for the dev-server process itself (Next.js only falls back to `.env.local` when the shell doesn't already have a value set) — this time on the human operator's side, not the server's.

## User Setup Completed (for the record — carried forward into Phase 5/6 documentation)

- `apps/web/.env.local`: `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NOTIFY_PHYSICAL_ADDRESS` all set to real, working values.
- `apps/web/src/site.config.ts`: `CONFIG.notify.fromAddress` set to `4lph4 <no-reply@4lph4-bl0g.kro.kr>`.
- Resend: `4lph4-bl0g.kro.kr` added and verified as a sending domain (TXT SPF, TXT DKIM, MX all registered via kro.kr's own DNS panel — confirmed no nameserver-delegation escape hatch exists on kro.kr, so this had to go through kro.kr's native record types directly). A test Audience ("General") created holding only the operator's own address.
- Notion: 3 test posts staged (`status=public`, `emailed` unchecked); "Update content" capability confirmed grantable/revocable for the capability-regression test.

## Next Phase Readiness

- ROADMAP SC#1, SC#2, SC#3, SC#5, SC#6 are closed by observed live outcome, not source inspection alone.
- SC#4 (malformed-post handling) remains open — carried into `STATE.md` Blockers, matching this project's established carried-forward pattern for credential/live-environment-gated items (Phases 1–3). Recommend either (a) accepting the current try/catch as sufficient structural coverage without a live trigger, or (b) a small follow-up task that gives `buildSectionHtml()` (or an earlier validation point) an actual throwable precondition — e.g. reject a post whose title resolved to the `getTitle()` fallback sentinel — if live-exercised NOTIFY-04 coverage is required before this phase is considered fully closed.
- `nyquist_compliant` in `04-VALIDATION.md` can now be set `true` for every row except NOTIFY-04's manual/live check, which stays open pending the decision above.
- Phase 5 (Production Cutover) can proceed — the notify route, thumbnail handling, and live send path are all confirmed working end-to-end against real infrastructure.

---
*Phase: 04-notify-route*
*Completed: 2026-07-27*

## Self-Check: PASSED (with one recorded gap — see coverage D4)

- FOUND: apps/web/src/app/api/notify-subscribers/route.ts (modified, commits 1f036c3, 2a14cbe)
- FOUND: .planning/phases/04-notify-route/04-03-SUMMARY.md
- FOUND commits: 1f036c3 (D-06 revision), 2a14cbe (read-more link)
- Live send confirmed via operator-reported broadcast ID and raw email source (pasted in session, not fabricated)
