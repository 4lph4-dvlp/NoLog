---
phase: 3
slug: subscribe-path
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture and `03-CONTEXT.md` D-26 (verification split).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | **None** — zero `jest`/`vitest`/`playwright` config and zero `*.test.*`/`*.spec.*` files exist anywhere in the repo (confirmed via `find`). Adding a test framework is explicitly Out of Scope in `.planning/REQUIREMENTS.md`. |
| **Config file** | none — no test runner to configure (see Wave 0 Requirements) |
| **Quick run command** | `curl`/`grep` shell snippets below, run against `next dev` or `next start` — there is no `npm test` equivalent |
| **Full suite command** | `npm run build --workspace=apps/web` then re-run all four locally-closable snippets against `npm run start --workspace=apps/web` |
| **Estimated runtime** | ~60–90 seconds (dominated by the Next.js build in the SC#2 / SC#5 checks) |

---

## Sampling Rate

- **After every task commit:** Run the snippet(s) covering what the task touched — route-handler tasks → SC#4 honeypot + rate-limit snippets; `SubscribeSection` tasks → SC#2 build-diff snippet.
- **After every plan wave:** Run all four locally-closable checks (SC#2, SC#4 honeypot half, SC#4 rate-limit half, SC#5) against a fresh `npm run build` + `npm run start`.
- **Before `/gsd-verify-work`:** All four locally-closable checks green. SC#1 and SC#3's live-diff half are explicitly carried to the operator checklist per D-26 and do **not** block phase completion.
- **Max feedback latency:** ~90 seconds (build-bound); the two `curl`-only checks are sub-5-second.

---

## Automated Verification Snippets

These are the copy-pasteable commands referenced by the sampling rates above. They exist here rather than as test files because no test runner exists to host them (D-26 / REQUIREMENTS.md Out of Scope).

**SC#2 — env-unset means no form in the server-rendered HTML (SUB-02, SEC-03)**

Build and serve twice, diffing on a stable marker unique to the form (the planner assigns the exact marker attribute):

```sh
# configured: fake values are fine, this check never calls Resend
RESEND_API_KEY=re_fake RESEND_AUDIENCE_ID=aud_fake npm run build --workspace=apps/web
# → serve, then:
curl -s http://localhost:3000/ | grep -c '<FORM_MARKER>'   # expect > 0

# unconfigured
unset RESEND_API_KEY RESEND_AUDIENCE_ID && npm run build --workspace=apps/web
# → serve, then:
curl -s http://localhost:3000/ | grep -c '<FORM_MARKER>'   # expect exactly 0
```

**SC#4a — honeypot-populated submission is dropped, never reaches Resend (SUB-04)**

With `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` set to obviously-invalid placeholders (env check passes; any real Resend call would loudly fail):

```sh
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/subscribe \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","<HONEYPOT_FIELD>":"bot-filled"}'
# expect 200 with body {"ok":true} AND no Resend-error log line —
# that combination is the evidence the honeypot short-circuited before the Resend call (D-23 order)
```

**SC#4b — 6th submission from one IP inside the window returns 429 (SUB-04)**

```sh
for i in $(seq 1 6); do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/subscribe \
    -H 'Content-Type: application/json' -d "{\"email\":\"test$i@example.com\"}"
done
# expect five 200s (use a syntactically valid throwaway domain so D-15's regex passes), then 429
```

**SC#5 — `RESEND_API_KEY` never appears in the built client bundle (SEC-03)**

```sh
npm run build --workspace=apps/web
grep -rl "RESEND_API_KEY" apps/web/.next/static/ ; echo "exit: $?"
# expect no matches printed, exit: 1
```

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending_ | — | — | — | — | — | — | — | — | ⬜ pending |

*Populated by `/gsd-validate-phase` once PLAN.md task IDs exist. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework install — deliberately Out of Scope per `.planning/REQUIREMENTS.md`; matches Phase 1 and Phase 2 precedent (manual/scripted verification, no test files).
- [ ] No test config, fixtures, or `conftest.py`-equivalent — there is no test runner to configure.
- [ ] The four shell snippets above are the phase's verification substrate; plans must reference them rather than introduce a framework.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A valid email submission actually lands in the Resend Audience (SC#1) | SUB-01 | Requires a real `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` and Resend dashboard inspection; no credentials exist in this environment | Operator sets both env vars on a deployed/dev instance, submits a real address via the form, then confirms the contact appears in the Resend Audience dashboard. Carried to operator checklist per D-26. |
| Two live submissions of the same address are byte-identical (SC#3, live half) | SUB-03 | Needs two real round-trips against a live Audience to diff status code + body | Operator submits the same address twice against a configured instance, capturing `curl -i` output both times, and diffs them. Expect zero observable difference. Carried to operator checklist per D-26. |
| Duplicate-email path runs the identical code path as a first-time submission (SC#3, structural half) | SUB-03 | Closed by code inspection, not runtime — the guarantee is the *absence* of a branch | During plan-checker / code review, confirm the route's success path contains no `if (contactAlreadyExists)`-style branch before the unconditional `create` + `update({ unsubscribed: false })` pair (D-17). |
| `contacts.create` behavior on an already-existing email (errors vs. idempotent no-op) | SUB-01, SUB-03 | Undocumented; RESEARCH.md Open Question 2 | Operator verifies against a live Resend sandbox whether `create` on a duplicate errors; if it does, the route must tolerate that error and still proceed to the `update` call rather than surfacing `server_error` (D-18 classification detail). |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify referencing one of the four snippets, or an explicit Manual-Only entry above
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references (none — no framework being added)
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
