---
phase: 10
slug: collapsible-sidebars-reading-width
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-14
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Built in State B — no prior SECURITY.md existed; the register was consolidated from the
> `<threat_model>` blocks all four PLAN.md files carried at plan time
> (`register_authored_at_plan_time: true`), then each mitigation was verified against the
> implementation as shipped.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| reader's `localStorage` → pre-hydration inline script | The visitor, or any same-origin script, can write arbitrary bytes to `nolog:sidebar:*`; the script reads them before first paint | Attacker-writable string (2 keys) |
| reader's `localStorage` → `SidebarShell` client runtime | Same store, second reader (`readSidebarPref`) | Attacker-writable string |
| `templates/default/Layout.tsx` (server) → `SidebarShell` (client) | A server-only secret gate (`RESEND_API_KEY`) sits inside the React tree crossing this boundary | Rendered element only — the secret itself must never cross |
| `/avatar.png` (fork-supplied static asset) → `SidebarToggleRight` | A fork controls this file; it may be absent, wrong-typed or oversized | Image bytes |
| reader keyboard/AT input → `SidebarShell`'s focus and `inert` writes | Focus position is reader-controlled state this phase reads and moves | Focus/AT state |
| operator's local environment → `10-EVIDENCE.md` | Secrets could be transcribed into a committed artifact if a battery output were pasted carelessly | Env var NAMES and grep output only |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | `parseSidebarPref` / `initSidebarState` — `apps/web/src/lib/sidebar.ts` | medium | mitigate | Strict allowlist parse — only the exact strings `"true"`/`"false"` map to booleans, everything else to `null`. Verified in source: the function is three literal comparisons with a `null` fallthrough, and the file contains zero `Boolean(`, `JSON.parse` or `!!` coercions. Both readers (inline script and client runtime) share this one parser. Additionally **observed**, not just asserted: plan 10-04's battery fed a tampered/XSS-shaped value and it fell through to the `null` auto branch with no raw value reflected into the DOM. | closed |
| T-10-02 | Information Disclosure | `templates/default/Layout.tsx` (server) ↔ `SidebarShell` (client) boundary, and the committed `10-EVIDENCE.md` | **high** | mitigate | **This phase's stop-ship item (ROADMAP SC#3 / SIDE-10).** `Layout.tsx` carries no client directive and still constructs `<SubscribeSection variant="default" />` itself, handing it to `SidebarShell` as a pre-rendered `ReactNode`. Verified at every wave that touched `SidebarShell.tsx` (waves 1, 2, 3, plus the CR-01 fix and this audit): `use client` count `0` in `Layout.tsx`, `SubscribeSection` count `0` in `SidebarShell.tsx`, `NEXT_PUBLIC_RESEND` count `0` under `apps/web/src`. Corroborated by a direct read of the compiled `.next` client-reference-manifest and by zero `NEXT_PUBLIC_RESEND` / `re_…` occurrences in the served production HTML. Evidence-file half: `10-EVIDENCE.md` contains no secret VALUE — the one UUID-shaped match is the public Notion page id `3702c61e-…`, which resolves HTTP 200 as a published post and already appears in Phase 7/9 artifacts, not the Resend audience id. **Live end-to-end confirmation:** the operator submitted the form against the real Resend account on the first Phase-10 deploy and it worked (`10-UAT.md` test 1). | closed |
| T-10-03 | Tampering (script injection) | the inline `<script dangerouslySetInnerHTML>` in `apps/web/src/app/layout.tsx` | medium | mitigate | Only build-time constants are interpolated: a `.toString()`-serialized function invoked with a numeric constant (`SIDEBAR_BREAKPOINT_PX`) and two `JSON.stringify`-escaped string constants (`SIDEBAR_STORAGE_KEY_PREFIX`, `SIDEBAR_ATTR_PREFIX`). No request-derived or visitor-derived value reaches the script body. This mirrors the technique used by the installed `next-themes` bundle. **Standing constraint for future changes:** any string that could originate from a visitor must first escape `</script>`, U+2028 and U+2029 before interpolation here. | closed |
| T-10-04 | Denial of Service (local, cosmetic) | `SidebarToggleRight`'s `next/image` load of the fork-controlled `/avatar.png` | low | mitigate | A missing, malformed or non-image asset resolves through the native `onError` handler to the D-14 `lucide-react` icon fallback, so the control stays operable and the row's geometry is unchanged. Verified: `onError` present, and zero `setTimeout` / `setInterval` / retry constructs in the component — a persistently failing asset cannot generate repeated requests. Exercised live in wave 2 against a real 404. | closed |
| T-10-05 | Denial of Service (accessibility) | the `inert` write in `SidebarShell.tsx`'s shared collapse routine | medium | mitigate | Applying `inert` before rescuing focus would strand a keyboard user inside an inert subtree with no visible caret and no reachable next stop. Mitigated by enforced step order — the `document.activeElement` containment check and `.focus()` move happen strictly before the `inert` write, in the same tick, with no `setTimeout`/`rAF`/effect between them — and by both toggle buttons living outside both panels, so a collapse can never inert its own re-expand control. Verified in source order and observed live on **both** collapse paths (click and resize) for both sides. | closed |
| T-10-06 | Information Disclosure | temporary config edits made to exercise the D-14 fallback and the long-text backstops | medium | mitigate | Every temporary edit to `site.config.ts` or to page content was reverted before commit, matching the fault-injection-and-revert discipline used in Phases 8 and 9. Verified at audit time: `git status --porcelain apps/web/src` returns zero lines and `git diff apps/web/src/site.config.ts` is clean. Production Notion content was never mutated. | closed |
| T-10-SC | Tampering | npm / package-manager installs | low | accept | This phase installs nothing (REQUIREMENTS.md D-07). Verified: zero changes to any `package.json` or `package-lock.json` across the phase's commit range. `lucide-react`, `next/image` and the native `inert` attribute are all pre-existing or platform-native — no polyfill, no new package. `10-RESEARCH.md`'s Package Legitimacy Audit records zero new packages, zero `[SUS]`, zero `[SLOP]`. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (`high`) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Non-applicable ASVS categories

Recorded so the model is auditable rather than padded. Consistent across all four plans.

| Category | Applies | Why not |
|---|---|---|
| V2 Authentication | no | No auth surface — NoLog has no accounts. The avatar toggle is explicitly prohibited from implying one (`must_haves.prohibitions`, plan 10-02) |
| V3 Session Management | no | No cookie or server-side session state is created or read. The only persistence is `localStorage` on the visitor's own device |
| V4 Access Control | no | No access-control logic exists or is introduced. `inert` is a presentation/AT-visibility mechanism, not a security control, and nothing behind it is confidential |
| V5 Input Validation | **yes** | Covered by T-10-01 — the `localStorage` values are visitor-writable and are the only untrusted input this phase reads |
| V6 Cryptography | no | No cryptographic operation |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-10-01 | T-10-SC | Supply-chain exposure from package installs is accepted as nil because this phase performs no install. Recorded as `accept` rather than `mitigate` because there is no install step to gate — not because a risk was waived. | plan-time threat model (all 4 plans), re-verified at audit | 2026-08-14 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-14 | 7 | 7 | 0 | Claude (`/gsd-secure-phase 10`, State B, ASVS L1, block on `high`) |

**Method.** `register_authored_at_plan_time: true` — all four PLAN.md files carried a parseable
`<threat_model>` block, so the auditor's role was to verify the existing register's mitigations, not
to scan for new threats. With `threats_open: 0`, `register_authored_at_plan_time: true` and
`asvs_level: 1`, the workflow's short-circuit rule applies and the `gsd-security-auditor` subagent was
not spawned — L1 grep-depth verification is sufficient at this level. Note the explicit consequence:
**this audit is grep-depth.** It confirms each declared mitigation is present in the shipped code; it
is not an L2 boundary-placement or L3 end-to-end trace review. Raising
`workflow.security_asvs_level` to 2 or 3 would force the deeper auditor pass.

**One finding worth recording.** An initial regex sweep for leaked secrets in `10-EVIDENCE.md`
returned a match. It was investigated rather than waved through: the match is the Notion page id
`3702c61e-4a24-8001-a9a6-c4ff3aadadb5`, which resolves HTTP 200 as a published post on the deployed
site and already appears in nine places across Phase 7 and Phase 9 artifacts. It is a public
identifier, not the `RESEND_AUDIENCE_ID`. No `re_…` Resend key prefix exists anywhere in the phase
directory. T-10-02's evidence-file half is therefore genuinely clean.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-14
