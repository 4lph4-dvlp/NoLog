# Phase 3 — API Coverage Matrix

**Produced:** 2026-07-26 (plan time)
**External API in scope:** Resend, consumed through the official `resend` Node SDK added to
`apps/web` this phase (D-19), constructed once in `apps/web/src/lib/email.ts` (D-20).

`INTEGRATE` is the default; every `OPT-OUT` carries a reason. This matrix is the subtraction record,
not a wish list. Phase 4 will integrate against the same full-coverage baseline — the opt-outs below
do not carry over silently.

| capability | decision | reason |
|---|---|---|
| `contacts.create` | INTEGRATE | First half of D-17's unconditional pair; adds the submitted address to the Audience named by the audience env var |
| `contacts.update` | INTEGRATE | Second half of D-17, called unconditionally with `unsubscribed: false`; neutralizes `resend/resend-node#458` by construction rather than by testing SDK behavior |
| `contacts.create` / `.update` error tuple | INTEGRATE | The `{ data, error }` result drives D-18's classification; the update result alone decides the response, so a create error is logged but never short-circuits |
| `contacts.get` | OPT-OUT | Not needed, and deliberately unreachable: D-17 never reads Audience state before writing, because branching on prior state is exactly the enumeration oracle SUB-03 forbids |
| `contacts.list` | OPT-OUT | Not needed — no subscriber-listing surface exists in this phase. Phase 4 sends to the Audience as a whole via a broadcast, so it needs no enumeration either |
| `contacts.remove` | OPT-OUT | Not needed — unsubscribe is handled by Resend's own one-click link, which NOTIFY-02/NOTIFY-03 make the responsibility of the Phase 4 broadcast |
| `audiences.create` | OPT-OUT | Not needed — the forker creates the Audience in the Resend dashboard and supplies its id as an env var; creating one programmatically would fight the off-by-default contract |
| `audiences.get` | OPT-OUT | Not needed — env-var presence is the whole configuration check (D-04, D-22). A live probe would turn a render-time gate into a network call |
| `audiences.list` | OPT-OUT | Not needed — the Audience is named by env var, never discovered |
| `audiences.remove` | OPT-OUT | Not needed, and deliberately out of reach: this template must never destroy a forker's subscriber list |
| `broadcasts.create` | OPT-OUT | Explicitly out of scope — Phase 4 owns the notify path (NOTIFY-01, NOTIFY-03) |
| `broadcasts.send` | OPT-OUT | Explicitly out of scope — Phase 4; one broadcast per cron run is that phase's core requirement |
| `broadcasts.get` / `.list` / `.remove` | OPT-OUT | Explicitly out of scope — Phase 4 broadcast lifecycle; no Phase 3 requirement touches it |
| `emails.send` (transactional) | OPT-OUT | Explicitly out of scope. `PITFALLS.md` Pitfall 1 records a per-subscriber send loop as the expensive mistake this project must avoid; Phase 4 uses one broadcast instead |
| `emails.get` / delivery-status lookup | OPT-OUT | Not needed — this phase sends no email at all; nothing exists to look up |
| `domains.*` (create, verify, list) | OPT-OUT | Not needed — domain, SPF and DKIM verification is a dashboard step, documented for forkers in Phase 6 (DOCS-02), never automated by the template |
| `apiKeys.*` (create, list, remove) | OPT-OUT | Not needed — the forker supplies their own key as an env var; the app never mints, rotates, or reads keys back |
| Resend webhooks (delivery, bounce, complaint events) | OPT-OUT | Not needed — a webhook receiver is a second public endpoint with its own auth surface, and no v1 requirement consumes delivery events |
| Idempotency-key header on contact writes | OPT-OUT | Not needed — D-17's create-then-update pair is already idempotent by construction, so a duplicate submission converges to the same state without server-side deduplication |
| Resend-side rate-limit / 429 handling | OPT-OUT | Not needed at this volume. D-09's limiter is abuse control, not quota handling; a Resend 429 lands in D-18's `server_error` branch, where the visitor's retry is the recovery path |

## Notes

- Every INTEGRATE row is exercised by `apps/web/src/app/api/subscribe/route.ts` through the single
  client in `apps/web/src/lib/email.ts`. No other module in the monorepo touches Resend this phase.
- The 1,000-contact Audience ceiling is a Phase 6 documentation concern (DOCS-02), not a Phase 3 code
  concern — this phase writes contacts without counting them.
- One package is installed (`resend`). `03-RESEARCH.md` § Package Legitimacy Audit cleared it as a
  verified false positive on the seam's `too-new` signal; because a `SUS` verdict is never
  auto-approvable, task `03-01-T0` gates the install behind a blocking human checkpoint, and the
  supply-chain consideration is recorded as threat `T-03-05` in `03-01-PLAN.md`.
