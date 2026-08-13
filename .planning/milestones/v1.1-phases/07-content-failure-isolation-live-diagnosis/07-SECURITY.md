---
phase: 7
slug: content-failure-isolation-live-diagnosis
status: secured
asvs_level: 1
block_on: high
threats_total: 19
threats_closed: 19
threats_open: 0
audited: 2026-08-10
---

# Phase 7 — Security Verification

Retroactive verification of the `<threat_model>` blocks declared in `07-01-PLAN.md`, `07-02-PLAN.md` and
`07-03-PLAN.md`, against the code **as it exists now** — after Phase 8's D-19 teardown.

**Verdict: SECURED. 19/19 threats closed, 0 open.**

## Why this audit is unusual

Most of Phase 7's attack surface no longer exists. Phase 8 (shipped, commit `427f8a8`) deleted the
secret-gated debug route and the deep-diagnostic helpers outright. So each declared mitigation was verified
into one of two end-states, and the deletion was confirmed by `git log --diff-filter=D` and repo-wide grep
rather than assumed:

- **mitigated-then-removed** — implemented, and the surface has since been deleted.
- **still-live** — guards code that survives today, and was re-verified in current source.

**Confirmed deleted:** `apps/web/src/app/api/diagnose-page/route.ts`, `describeFetchFailure()`,
`isFetchErrorShape()`, `LOAD_PAGE_CHUNK_URL`, and `notion-x.ts`'s copy of `BODY_EXCERPT_MAX_LENGTH`. Grep for
`describeFetchFailure|LOAD_PAGE_CHUNK_URL|isFetchErrorShape|diagnose-page` across `apps/web/src` returns zero.

**Confirmed surviving Phase-7-origin surface:** `classifyMissingPost()` in `lib/post-availability.ts`; the
ungated `[PostPage:recordMap]` / `[PostPage:chrome]` / `[PostPage:post]` log lines; `PostUnavailable.tsx`;
and — **found by the auditor, not in the brief it was given** — `isDiagnosticsEnabled()` in `lib/notion-x.ts`,
retained under D-13 solely because `post-availability.ts` imports it.

## Threat register

| ID | Plan | Category | Sev | End-state | Evidence |
|---|---|---|---|---|---|
| T-07-01 | 07-01 | Elevation of Privilege | high | mitigated-then-removed | Route file absent; deletion commit `427f8a8` |
| T-07-02 | 07-01 | Information Disclosure | medium | mitigated-then-removed | `safeCompare`/`timingSafeEqual` gone with the route |
| T-07-03 | 07-01 | Tampering (SSRF) | high | mitigated-then-removed | Route + `describeFetchFailure` both deleted; zero grep hits |
| T-07-04 | 07-01 | Information Disclosure | medium | mitigated-then-removed | `bodyExcerpt` capture deleted — see the flag below on its replacement |
| T-07-05 | 07-01 | Denial of Service | medium | mitigated-then-removed | Probe + log latch deleted with the route |
| T-07-06 | 07-01 | Information Disclosure | medium | mitigated-then-removed | Success-payload route deleted |
| T-07-07a | 07-01 | Information Disclosure | medium | **still-live, verified** | `post/[id]/page.tsx`: diagnostics reach `console.error` only, never JSX; `PostUnavailable` takes no props |
| T-07-07b | 07-02 | Tampering (SSRF) | high | **still-live, verified** | `post-availability.ts:78` builds the URL from `parsePageId()`'s return value, never the raw segment; a falsy parse short-circuits before any fetch |
| T-07-09 | 07-02 | Information Disclosure | medium | **still-live, verified** | `buildResponseDetail` gated on `isDiagnosticsEnabled()`; excerpt capped at 200; only the coarse id shape and length reach the log |
| T-07-10 | 07-02 | Information Disclosure | low | **still-live, verified** | `PostUnavailable.tsx` is props-less with hardcoded strings |
| T-07-11 | 07-02 | Denial of Service | medium | **still-live, verified** | `cache: "no-store"` fetch reached only inside `if (!post)`, one call max |
| T-07-12 | 07-02 | Repudiation / SEO | medium | **still-live, verified** | `generateMetadata`'s `!post` branch returns `robots: { index: false, follow: false }` unconditionally |
| T-07-13 | 07-03 | Elevation of Privilege | high | closed (operational) | Both env vars removed 2026-08-09 17:05 UTC, closeout redeploy 17:13 UTC; the route is now permanently absent from source |
| T-07-14 | 07-03 | Information Disclosure | high | closed, verified | Entropy scan over `.planning/`: the only 32-char hex hit is the Notion **database id**, not the debug secret. Every mention of `NOTION_DEBUG_ROUTE_SECRET` is the variable *name* |
| T-07-15 | 07-03 | Information Disclosure | medium | closed, verified | Pasted `bodyExcerpt` blocks are truncated Cloudflare challenge-page HTML, consistent with the 200-char cap |
| T-07-16 | 07-03 | Repudiation | medium | closed, verified | The evidence file documents its paste discipline and **self-flags its own deviation** (5 loads spanning ~2s, not "several minutes") rather than fabricating |
| T-07-SC ×3 | 01/02/03 | Tampering (supply chain) | low | accept, held | No manifest diff in any Phase 7 commit |

## The one thing worth reading twice

**Raw-error logging is a format regression, not a leak — and that was tested, not asserted.**

Phase 8's teardown replaced Phase 7's curated single-line JSON payload with
`console.error(prefix, error)` on the bare error object. The obvious worry is that an error object drags a
stack trace, a request URL, or headers into the log.

The auditor read `node_modules/ofetch/dist/shared/ofetch.CWycOUEr.mjs:24-43` and found `FetchError`'s
`request` / `options` / `response` / `data` / `status` are attached via `Object.defineProperty` with the
default `enumerable: false` — then **ran it** to confirm Node's `console.error` / `util.inspect` does not
print non-enumerable properties. Only `name`, `message` and the stack surface. `notion-client`'s own throws
are plain `new Error(message)` with nothing extra.

So no cookie, token, or response body reaches a log line. What was lost is grep-ability: the payload used to
be one parseable JSON line. That is a real cost — it is what made Phase 7's production log reading work — but
it is a diagnosability cost, not a security one.

**Flagged because nobody flagged it.** This log-format change crossed no trust boundary in either phase's
threat register, and `08-01-SUMMARY.md`'s own `## Threat Flags` section says *"None… No new network endpoint,
auth path, or schema surface was introduced"* — which is true as written and still under-reports a change to
what gets written into production logs. Recording it here so the omission is on the record rather than
invisible.

## Documentation-hygiene note (not a security finding)

`T-07-07` is used as the id for **two unrelated threats** — "diagnostics reaching the reader" in `07-01` and
"SSRF via `classifyMissingPost`'s URL" in `07-02`. Both are verified independently above and are disambiguated
here as `T-07-07a` / `T-07-07b`. Flagged only so a later reader of the plans does not conflate them.

## D-19 goal check

`NOTION_DEBUG_ROUTE_SECRET`: zero references in current `apps/web/src`.
`NOTION_DEBUG_DIAGNOSTICS`: exactly one live reference — `notion-x.ts:48`, inside `isDiagnosticsEnabled()` —
retained by deliberate decision (D-13), not oversight. No README (`README.md`, `README_KR.md`,
`packages/core/README*`) mentions either variable. **D-19's "zero net new forker-facing env vars" holds.**

Not claimed here: an affirmative listing of the Production environment variables from the Vercel dashboard.
That reading has not been taken; see `08-CACHE-EVIDENCE.md` § Still outstanding.

---

*Audited 2026-08-10 by `gsd-security-auditor` at ASVS L1, block on `high`. No implementation file was modified
by the audit.*
