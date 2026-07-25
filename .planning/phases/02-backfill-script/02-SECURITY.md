---
phase: 02
slug: backfill-script
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-07-26
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Register built from the `<threat_model>` blocks in `02-01-PLAN.md` and `02-02-PLAN.md`
(both authored at plan time). Verified at ASVS L1 grep depth per the secure-phase
short-circuit rule: `threats_open: 0` + `register_authored_at_plan_time: true` +
`asvs_level == 1`, so no separate auditor pass was required.

`T-02-SC` appears in both plans with identical text; it is deduplicated to one row here.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| operator shell → `backfill.ts` | CLI flags and credentials cross here; a flag typo decides preview-vs-irreversible-write | `NOTION_TOKEN` (secret), `NOTION_DATABASE_ID`, `--dry-run` |
| `backfill.ts` → Notion REST API | Authenticated writes cross here via Phase 1's `NologClient` | bearer token, page ids, checkbox writes |
| Notion API response → operator console | Remote-controlled error text and post content cross into logs an operator may share | error bodies, request ids, post titles |
| Notion API → classification logic | Status codes and body text steer an abort-vs-retry-vs-continue decision on an irreversible write path | HTTP status, error body |
| Notion workspace schema → in-flight run | The `emailed` property can disappear underneath a running backfill (gap 1b) | schema state |
| npm registry → `npx tsx` | The TypeScript runner is resolved ad-hoc at invocation rather than from a lockfile | executable code |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Tampering | `backfill.ts` flag parsing | high | mitigate | `parseArgs` left in default STRICT mode (`backfill.ts:22,29,33`) — a mistyped flag throws `ERR_PARSE_ARGS_UNKNOWN_OPTION` and exits non-zero before any Notion call. Verified by source read + mistyped-flag probe. | closed |
| T-02-02 | Information Disclosure | console output | medium | mitigate | Token appears only at `backfill.ts:42` where it is handed to the client; it is absent from every `console.*` call. Logs carry `post.id`, `post.title` (public by construction), `err.message`, counts, and the database id. Verified by grep + four live runs whose transcripts contain no credential. | closed |
| T-02-03 | Denial of Service | write loop → Notion API | medium | mitigate | Fixed 400ms inter-request delay on every iteration; exactly one bounded retry per post; D-04 abort halts instead of burning the budget. **Measured live** this session: consecutive write gaps 1097ms and 1107ms, sustained ~0.9 req/s against Notion's ~3 req/s limit. | closed |
| T-02-04 | Repudiation | run-outcome signalling | medium | mitigate | Non-zero exit on `failed > 0` and on every abort path; abort additionally prints the partial count. Observed live: exit 1 on both the D-05 missing-property abort and an organic 401 initial-fetch abort. | closed |
| T-02-05 | Elevation of Privilege | Notion "Update content" capability | low | transfer | Write capability is Notion-side configuration owned by the workspace admin. The script cannot escalate; it detects absence via `NotionCapabilityError` and reports the Developer Portal fix. | closed |
| T-02-06 | Spoofing | `NOTION_DATABASE_ID` pointing at an unintended database | medium | accept | See Accepted Risks R-02-01. Residual risk reduced by printing the queried database id on both the count and nothing-to-do lines — **observed live** in this session's runs. | closed |
| T-02-07 | Tampering | error classification in the write loop | medium | mitigate | `isSystemicAbort` classifies on `instanceof` identity only and never inspects `err.message`; it sits strictly ahead of `isRateLimited`, the one remaining classifier that parses remote text. Branch ordering verified in source: outer catch 156 < 167, retry inner catch 180 < 193. A body crafted to read like a rate-limit message cannot route a genuine 403/schema-400 into the retry path. | closed |
| T-02-08 | Denial of Service | denial-of-completion via the widened abort set | low | accept | See Accepted Risks R-02-02. | closed |
| T-02-09 | Repudiation | signalling on the new retry-window abort path | low | mitigate | `reportSystemicAbort` (`backfill.ts:93-101`) is the single emitter for both loop abort sites; it unconditionally prints `ABORT: {message}`, the partial `marked / failed` count, and sets `process.exitCode = 1` before either call site returns. Verified in source. | closed |
| T-02-10 | Information Disclosure | `COVERAGE.md` prose compression | low | accept | See Accepted Risks R-02-03. | closed |
| T-02-SC | Tampering | supply chain — `npx tsx` resolved from the npm registry at invocation | medium | accept | See Accepted Risks R-02-04. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `high` count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Blocking threshold `high`.** T-02-01 is the only high-severity threat and it is mitigated with an
automated gate. `threats_open: 0`.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-02-01 | T-02-06 | An operator supplying a valid-but-wrong database id is indistinguishable from a correct empty one at the API level. Blast radius is a checkbox flip on the wrong workspace's posts, and the operator supplies the id directly. Mitigated-not-closed by printing the database id on every count line plus the mandatory dry-run-first workflow. | project owner (plan-time, 02-01) | 2026-07-25 |
| R-02-02 | T-02-08 | One mid-run `MissingEmailedPropertyError` now halts a long backfill with the catalog partially marked. Not a new attacker vector — removing the property requires workspace write access, i.e. someone who could equally revoke the token. It is the intended trade: the alternative is 400ms × N guaranteed failures, strictly worse for both operator and rate limiter. Bounded by DATA-03 resumability (server-side filter drains the remainder on re-run). | project owner (plan-time, 02-02) | 2026-07-26 |
| R-02-03 | T-02-10 | The `COVERAGE.md` row-9 rewrite shortens a cell documenting an internal scope boundary. No secret material, no endpoint not already public in the same table, no credential. | project owner (plan-time, 02-02) | 2026-07-26 |
| R-02-04 | T-02-SC | This phase installs zero packages and adds zero dependencies (gated byte-identical in 02-01-T1 and re-asserted in 02-02-T1). Ad-hoc `npx tsx` resolution is a pre-existing, already-accepted characteristic of this repo's manual-script convention — `verify-phase-1.ts` and `verify-403.ts` already run this way. Pinning was considered and rejected for consistency with the established `packages/core/scripts/` convention. No `[ASSUMED]`/`[SUS]` package is introduced. | project owner (plan-time, 02-01) | 2026-07-25 |

---

## Residual Observations

Not open threats — recorded so a later audit does not rediscover them as findings.

- **Error messages embed raw Notion response bodies.** T-02-02's mitigation permits logging
  `err.message` from the typed error classes. Phase 1's client composes those messages by
  embedding the raw Notion body, so an abort line can surface the full error JSON including a
  `request_id`. Observed live during UAT test 2:
  `(Notion said: Notion query failed: 400 {"object":"error",...,"request_id":"80eaad5e-..."})`
  This is compliant with the mitigation as written (it is `err.message`, not the raw response
  object) and leaks no credential, but operators sharing logs for support should know request
  ids and raw error bodies travel with them. Severity: informational.

- **PATCH-path error-shape detection remains unmeasured.** `patchPage()`'s
  `MissingEmailedPropertyError` branch matches on `status === 400 && /emailed/i && /propert/i`,
  documented in `client.ts` as an unverified best guess. UAT test 2 measured the *query* path's
  real error body and it satisfies that heuristic, which is strong supporting evidence — but the
  PATCH endpoint's own body was never observed (UAT test 7, the only test that would exercise it,
  was waived). Not a security threat; recorded because a wrong guess would degrade a systemic
  abort into per-post failures, which is the T-02-03 / T-02-09 surface.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-26 | 11 | 11 | 0 | /gsd-secure-phase (orchestrator, L1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-26
