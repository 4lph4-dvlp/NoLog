---
phase: 6
slug: documentation
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-07-29
---

# Phase 6 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| README.md / README_KR.md fenced code blocks | Example env var values shown to any reader of the public repo | Must never contain a real secret, API key, or forker's real mailing address — placeholder-only |
| Documentation prose vs. shipped code behavior | READMEs describe security-relevant behavior (fail-closed gates, capability checks) already implemented in Phases 1–5 | Risk is a false claim about a security property (see T-06-04 and the resolved CR-01 finding), not data exposure |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Information Disclosure | New fenced env-var block in README.md / README_KR.md | high | mitigate | Every example value carries an obviously-fictional token matching the repo's existing placeholder convention (`ntn_your_notion_integration_token`, `your_cusdis_app_id`). Verified: no real secret present in either file (code review + goal verification both confirmed zero non-placeholder env-var lines). | closed |
| T-06-02 | Information Disclosure | `NOTIFY_PHYSICAL_ADDRESS` example value and the `fromAddress` step | medium | mitigate | Mailing-address example is a fictional street address; the real value is routed to a Vercel env var, kept out of the public fork's git history (Phase 4 D-06 revision). Verified present in both files. | closed |
| T-06-03 | Tampering | Outbound documentation links to resend.com and notion.so | low | accept | Both Resend URLs and the Notion capability reference were fetched and confirmed live on 2026-07-29 (06-RESEARCH.md Sources; re-confirmed during goal verification via live fetch). A vendor later altering its own doc page is outside this repo's control. | closed |
| T-06-04 | Repudiation | Step-2 capability warning's claim of a failure mode | medium | mitigate | STATE.md records Phase 4 could NOT reproduce the 403 in two live tests. Warning text explicitly avoids claiming first-hand verification, sourcing the failure mode to Notion's published capability model and the shipped `NotionCapabilityError` class instead. Verified present in both files. | closed |
| T-06-05 | Information Disclosure | New mermaid subgraph node and edge labels | low | mitigate | Labels name service roles only (`Vercel Cron`, `Notify Route`, `Resend`, `Subscriber`) — no secret, audience ID, or real forker domain. Verified via live diagram render during goal verification. | closed |
| T-06-06 | Spoofing | Misrepresenting an optional feature as a required part of the stack | medium | mitigate | Core Services row and Features bullet both carry explicit optional/`선택` framing matching the Cusdis precedent. Verified present and matching in both files. | closed |
| T-06-07 | Tampering | Mermaid block syntax corruption breaking the rendered diagram | low | mitigate | Balance gates (4 subgraph/4 end) plus an actual headless-browser mermaid render (performed during goal verification) confirmed both diagrams render correctly with no duplicate node. | closed |
| T-06-SC | Tampering | npm / pip / cargo installs | low | accept | This phase installs no packages and touches no manifest or lockfile. No supply-chain surface to gate. | closed |
| T-06-08 (post-review) | Information Disclosure / Repudiation | False fail-closed claim about `CONFIG.notify.fromAddress` default (code review CR-01) | high | mitigate | Reviewer + independent code inspection confirmed the original README text falsely claimed the gate rejects the shipped default sender identity. Corrected in both files (commit `6a6a1fa`) to state the gate only rejects a blank value. Verified against `route.ts:210-230` during goal verification. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (`high`) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Register origin:** `register_authored_at_plan_time: true` — both `06-01-PLAN.md` and `06-02-PLAN.md` contained parseable `<threat_model>` blocks (T-06-01 through T-06-07, T-06-SC). T-06-08 was added post-hoc from the code-review pass (`06-REVIEW.md` CR-01), then verified closed during phase goal verification, per this workflow's practice of tracking review-surfaced threats in the same register.

**Short-circuit applied:** `threats_open: 0 AND register_authored_at_plan_time: true AND asvs_level == 1` → per `secure-phase.md` Step 3, this satisfies the L1 grep-depth bar. All eight threats above were independently confirmed closed via direct evidence gathered during code review (`06-REVIEW.md`) and phase goal verification (`06-VERIFICATION.md`, including a live headless-browser Mermaid render and live fetches of the cited Resend documentation pages) rather than accepted on the plan's claim alone — the `gsd-security-auditor` subagent was not spawned since no threat required L2/L3 deep verification.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-03 | External Resend/Notion doc links could change without this repo's knowledge; mitigated by citing the authoritative page rather than restating figures as permanent, per D-08/D-09 | Project owner (implicit, via locked CONTEXT.md decisions) | 2026-07-29 |
| AR-06-02 | T-06-SC | No packages installed by this documentation-only phase — no supply-chain surface exists to accept or mitigate | Project owner (implicit) | 2026-07-29 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-29 | 8 | 8 | 0 | Claude (gsd-secure-phase, L1 short-circuit — mitigations independently confirmed via 06-REVIEW.md and 06-VERIFICATION.md evidence rather than auditor re-scan) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-29
