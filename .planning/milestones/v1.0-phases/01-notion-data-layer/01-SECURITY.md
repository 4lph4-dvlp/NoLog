---
phase: 1
slug: notion-data-layer
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-25
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `NologClient` → Notion REST API | Outbound authenticated requests carrying the integration token; responses (incl. error bodies) flow back and may reach logs | Notion integration token, page/property data |
| caller → `markEmailed(pageId)` | `pageId` crosses into a URL template; in this phase it originates only from `NologClient`'s own prior query results (`getUnemailedPublicPosts()`), never raw user input | Page ID (Notion UUID) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-1-01 | Information Disclosure | `NotionCapabilityError` / `MissingEmailedPropertyError` messages | high | mitigate | Error messages include only the page id and Notion's response `message` text; verified via source grep (`this.token`/`Authorization` appear only in `getNotionHeaders()`/constructor/SDK-init, never in either error constructor) — holds after the 588496d/a5eb42d property-casing corrections, which touched message text (`Emailed`→`emailed` wording only, no new leak surface) | closed |
| T-1-02 | Tampering | `pageId` interpolated into `fetch(\`.../pages/${pageId}\`)` in `patchPage()`/`markEmailed()` | low | accept | Not a new risk: within this phase's scope, `pageId` only ever originates from `getUnemailedPublicPosts()` → `post.id`, never from raw user input. Accepted with a documented invariant: a future caller must not pass an unvalidated user-supplied `pageId` here without revisiting this analysis. | closed |
| T-1-SC | Tampering | npm/pip/cargo installs | low | accept | Zero new packages across both plans and the post-hoc casing corrections — nothing to audit. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Note — related but out-of-register finding:** `01-REVIEW.md`'s post-fix code review (commit `76ffed4`) found an unvalidated/unencoded `pageId` in `getPost()` (line ~292) reachable from `apps/web/src/app/post/[id]/page.tsx`'s raw dynamic route segment — this **does** cross from raw user input, unlike `markEmailed()`'s `pageId` (T-1-02 above). This finding postdates this phase's plan-time threat model (it wasn't part of the original register at either 01-01 or 01-02) and is **not** dispositioned here — it needs its own review pass. Tracked as a recommendation, not a phase-blocking threat for Phase 1's own DATA-01/02/04 scope.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-1-01 | T-1-02 | `pageId` in `markEmailed()`'s write path originates only from this client's own query results in this phase's scope; no external caller passes user-supplied ids into it yet | Claude (gsd-secure-phase) | 2026-07-25 |
| AR-1-02 | T-1-SC | No new packages installed in this phase or its corrections | Claude (gsd-secure-phase) | 2026-07-25 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-25 | 3 | 3 | 0 | Claude (gsd-secure-phase, ASVS L1 short-circuit — register authored at plan time in both 01-01-PLAN.md and 01-02-PLAN.md, threats_open: 0, grep-depth verification sufficient) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-25
