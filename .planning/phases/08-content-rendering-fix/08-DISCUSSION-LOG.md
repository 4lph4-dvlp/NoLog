# Phase 8: Content Rendering Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 8-Content Rendering Fix
**Areas discussed:** User-Agent string, Resilience scope, CONT-05 wording split, Teardown scope & deploy ordering

---

## Scouting done before the discussion (it changed what was worth asking)

Two facts were established before any question was put, so the gray areas would be real choices rather than
speculation:

1. **`notion-client` supports header injection as a first-class option.** `node_modules/notion-client/build/index.js:26-37`
   accepts `ofetchOptions`; lines 538-545 merge `...this._ofetchOptions?.headers` into every request. This
   collapsed `07-EVIDENCE.md`'s first open question ("can the header be set without patching?") to *yes, in
   two lines*.
2. **An honest UA passes Cloudflare.** Measured against the live endpoint, same body and page id:

   | User-Agent | Status | Content-Type |
   |---|---|---|
   | `node` (control) | **403** | `text/html` |
   | `NoLog/1.1 (+https://github.com/4lph4-dvlp/NoLog)` | 200 | `application/json` |
   | `Mozilla/5.0 (compatible; NoLog/1.1; +…)` | 200 | `application/json` |
   | `NoLog` | 200 | `application/json` |
   | Real Chrome UA (control) | 200 | `application/json` |

   This turned the third open question — *"is impersonating a browser appropriate for this project?"*, which
   Phase 7 deliberately escalated as the operator's call — from a judgement call into a settled fact:
   impersonation is not required.

---

## User-Agent string

### Q1 — What UA shape

| Option | Description | Selected |
|--------|-------------|----------|
| Honest self-identifying | `NoLog (+https://github.com/…)`; measured 200; visible to Notion, contactable if it misbehaves; conventional for bots | ✓ |
| Mozilla-prefixed hybrid | `Mozilla/5.0 (compatible; NoLog/…; +…)`; also 200; catches looser UA-parsing filters; the prefix is itself mild disguise | |
| Real browser UA | Least likely to be blocked, now and later; unnecessary disguise, and a stale version looks suspicious | |

**User's choice:** Honest self-identifying.

### Q2 — Forker configurability

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded, not configurable | No env var, nothing for a forker to think about; keeps the "zero net new env vars" goal intact; Notion sees one identifiable client | ✓ |
| Env-var override | Flexible; would directly break the D-19 condition the operator set one phase earlier | |
| Exposed in `site.config.ts` | No env var, still tunable; clutters a config file most forkers have no reason to touch | |

**User's choice:** Hardcoded, not configurable.
**Notes:** The URL points at the upstream repo rather than the fork's own — deliberate; a UA identifies the
*software*, not the deployment, the same way `Googlebot` points at Google's docs.

### Q3 — Version in the string

| Option | Description | Selected |
|--------|-------------|----------|
| No version | Name + URL only; a fork's version diverges from upstream immediately, so a version is wrong or maintenance | ✓ |
| Read from `package.json` | Auto-tracks; needs bundling plumbing and is meaningless if a forker never bumps it | |
| Hardcoded version | Simple; drifts into being a lie | |

**User's choice:** No version.

### Q4 — Scope of application (raised by 07-REVIEW F-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared constant, applied to `notion-client` only | One place to put it so Phase 9's S3 proxy can reuse it; no unverified path is changed | ✓ |
| Inline in `notion-x.ts` only | Smallest diff; guarantees duplication when Phase 9 needs the same string | |
| Apply to every outbound call now | Most consistent; changes working paths with no evidence of a problem | |

**User's choice:** Shared constant, applied to `notion-client` only.

---

## Resilience scope

### Q1 — How far to defend against escalation

| Option | Description | Selected |
|--------|-------------|----------|
| Header fix only, no defence | Behaviour on a future re-block is already safe — Phase 7 shipped non-throwing degradation and leg-named logs. Building for an unobserved failure mode is PITFALLS 6's "unverified safety net" | ✓ |
| Add detection logging | Faster notice of a re-block; adds new diagnostic code in the same phase that deletes Phase 7's diagnostic code | |
| Build a fallback path | Would mean the official blocks API — a direct D-01 violation | |

**User's choice:** Header fix only.

### Q2 — What a reader sees if it recurs

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current behaviour | Title and metadata render; body area carries the (now sharpened) could-not-load wording | ✓ |
| Add a retry button | CONT-F01, deferred to v2; against a systemic block, retrying fails identically | |

**User's choice:** Keep current behaviour.

---

## CONT-05 wording split

### Q1 — How to discriminate the two states

| Option | Description | Selected |
|--------|-------------|----------|
| By whether the fetch succeeded | Uses only what the render already holds; Phase 7's leg decomposition supplies it free; no extra Notion call | ✓ |
| By block count | More granular; needs an arbitrary threshold, since an "empty" Notion page still has structural blocks | |
| Cross-check via the official API | Most accurate; adds a live call per render — PITFALLS 4's "silently becomes dynamic" trap | |

**User's choice:** By whether the fetch succeeded.

### Q2 — Tone of the two sentences

| Option | Description | Selected |
|--------|-------------|----------|
| Factual and short | Matches the existing one-sentence `text-text-secondary italic` treatment; the two read as clearly different | ✓ |
| Add a recovery hint to the failure state | Warmer, matches `PostUnavailable`; would be false against a systemic block | |
| Site language (Korean) | Matches the content; would require changing three places and reopening the fork template's default-language question | |

**User's choice:** Factual and short.

---

## Teardown scope & deploy ordering

### Q1 — D-19's open (a)/(b) choice

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Keep `isDiagnosticsEnabled()` | Three-line env check, zero forker cost when unset, and `post-availability.ts` (permanent) imports it; the "zero net new env vars" goal is met by removing the route, deep diagnostics and docs | ✓ |
| (b) Collapse the gated branch and remove it | No diagnostic trace at all; costs log fidelity in a permanent file to delete three lines | |

**User's choice:** (a) Keep the predicate.

### Q2 — Deploy ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Fix + CONT-05 + teardown in ONE deploy | Resets Phase 9's >1h idle clock once instead of two or three times; the ROADMAP flags this collision explicitly | ✓ |
| Fix first, teardown after | Keeps diagnostics alive in case the fix misses; two deploys, two clock resets | |
| Fix only; teardown as separate work | Cleanest scope; a detached teardown is the kind that quietly never happens | |

**User's choice:** One deploy.
**Notes:** Accepted cost recorded — if the fix misses, the tooling is already gone. Risk is small and
quantified: the UA fix was verified against the live endpoint *before* being written into the plan.

### Q3 — Ownership of Phase 7's outstanding UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 8 closes them | SC#3 only becomes unambiguously testable once the body renders; same build, and no unfinished phase dragged to the milestone audit | ✓ |
| Leave as Phase 7 items | Cleaner scope; Phase 7 stays In Progress and resurfaces at audit | |
| SC#4 now, SC#3 in Phase 8 | SC#4 is testable today; splits one phase's verification across two sittings | |

**User's choice:** Phase 8 closes them.

---

## Claude's Discretion

- Final UA string within the agreed shape, and which module hosts the shared constant.
- Final wording of the two CONT-05 sentences within the agreed tone.
- Whether the out-of-scope `terminal` template gets the same split (default: no).
- Task ordering inside the single deploy; same commit vs sibling commits within one push.

## Deferred Ideas

- Reader-facing retry control — CONT-F01, v2.
- Caching/revalidation wrapper for `getPageRecordMap()` — CONT-F02, v2.
- Escalation defence beyond the header — revisit only on an observed re-block.
- Applying the shared UA constant to other outbound paths — created here, reused by Phase 9.
- `terminal` template parity — TMPL-F01.
- Localizing reader-facing fallback copy.
- Route-segment validation before the Notion API URL — out of scope for v1.1, tracked in `PROJECT.md`.

**Scope creep redirected:** none. Two adjacent items (a retry control, an escalation fallback) were raised as
options and declined with reasons rather than silently omitted.
