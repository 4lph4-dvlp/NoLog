---
phase: 4
slug: notify-route
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `04-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None** — zero `jest`/`vitest`/test config or `*.test.*` files exist repo-wide (confirmed in `04-RESEARCH.md`, matching Phase 1–3 precedent). Adding a test framework is explicitly Out of Scope in `.planning/REQUIREMENTS.md`. |
| **Config file** | none — no test runner to configure (see Wave 0 Requirements) |
| **Quick run command** | `curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/notify-subscribers` |
| **Full suite command** | `npm run build --workspace=apps/web && npm run start --workspace=apps/web`, then re-run all locally-closable snippets below |
| **Estimated runtime** | ~60–90 seconds (dominated by the Next.js production build) |

---

## Sampling Rate

- **After every task commit:** Run the snippet(s) covering what the task touched — auth-check tasks → SEC-01 snippets; config-gate tasks → SEC-02 snippet; send-call tasks → NOTIFY-03 grep.
- **After every plan wave:** Run all locally-closable checks (SEC-01, SEC-02, NOTIFY-03) against a fresh `npm run build` + `npm run start`.
- **Before `/gsd-verify-work`:** All locally-closable checks green. NOTIFY-04 and NOTIFY-05's live-credential checks are explicitly carried to the operator checklist (same carried-forward pattern as Phases 1–3) and do **not** block phase completion.
- **Max feedback latency:** ~90 seconds (build-bound); the `curl`-only checks are sub-5-second.

---

## Automated Verification Snippets

**SEC-01 — missing/invalid `CRON_SECRET` → 401, before any Notion/Resend call**

```sh
# no header at all
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/notify-subscribers
# expect 401

# wrong bearer value
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer wrong-secret" http://localhost:3000/api/notify-subscribers
# expect 401 — and confirm the only related log line is the single
# "[Notify] Unauthorized cron request rejected." (D-16: no secret/IP/header contents logged)
```

**SEC-02 — unset `RESEND_API_KEY` / `RESEND_AUDIENCE_ID` / physical address → no-op 200, no Notion query, no send**

```sh
env -u RESEND_API_KEY -u RESEND_AUDIENCE_ID npm run build --workspace=apps/web
# serve, then with a VALID CRON_SECRET header:
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/notify-subscribers
# expect 200 with a machine-readable "unconfigured"-style code, and no Notion-query / Resend-call log lines
```

**NOTIFY-03 — exactly one `broadcasts.create()`/`.send()` call, never a per-post loop**

```sh
grep -n "resend.broadcasts" apps/web/src/app/api/notify-subscribers/route.ts
# expect exactly one call site, with no loop construct wrapping it
```

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(to be populated once PLAN.md task IDs exist)* | | | | | | | | | ⬜ pending |

*Populated by `/gsd-validate-phase` once PLAN.md task IDs exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework install — deliberately Out of Scope per `.planning/REQUIREMENTS.md`; matches Phase 1–3 precedent (manual/scripted verification only, no test files).
- [ ] No test config, fixtures, or equivalent — there is no test runner to configure.
- [ ] The three shell/grep snippets above are the phase's verification substrate; plans must reference them rather than introduce a framework.

*If none: "Existing infrastructure covers all phase requirements." — not applicable here; the three snippets above ARE the substrate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| One malformed post's section doesn't block the others | NOTIFY-04 | Requires a live Notion workspace with a deliberately malformed candidate post; no credentials exist in this execution environment | Operator sets real `NOTION_TOKEN`/`NOTION_DATABASE_ID`, marks one public unemailed post with e.g. a missing title, runs the route, and confirms the digest still sends with the other posts' sections included and only those posts marked `emailed`. |
| Whole-send failure marks nothing; success marks all surviving posts | NOTIFY-05 | Requires live Resend/Notion credentials to simulate both a forced send failure and a real success | Operator first triggers a run with a deliberately invalid `RESEND_API_KEY` (or equivalent forced-failure condition) and confirms zero `markEmailed` calls fire; then a real successful run and confirms every surviving post is marked. |
| Resend's Broadcast/Audience send actually delivers a working one-click unsubscribe (RESEARCH.md Open Question 1) | NOTIFY-02 | Public docs don't unambiguously confirm header-level RFC 8058 behavior; mitigated in-template via a visible footer link, but a live send is the only way to fully confirm end-to-end | Operator sends a real digest to a test Audience member and confirms the received email has a working unsubscribe mechanism (visible link at minimum; inspect raw headers for `List-Unsubscribe` if possible). |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify referencing one of the snippets above, or an explicit Manual-Only entry
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references (none — no framework being added)
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
