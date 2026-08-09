# Phase 7: Content Failure Isolation & Live Diagnosis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 7-Content Failure Isolation & Live Diagnosis
**Areas discussed:** Diagnostic logging design, Evidence capture path, Chrome fetch isolation, ISR throw verification

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Diagnostic logging design | Lifetime, gating, and content of the failure logs | ✓ |
| Evidence capture path | How the real HTTP status + body get into the operator's hands | ✓ |
| Chrome fetch isolation | What to do with the categories/relatedPosts fetches the active template never uses | ✓ |
| ISR throw verification | Whether to measure the unverified Next 16 / Fluid Compute throw-during-regeneration behavior | ✓ |

**User's choice:** All four.

---

## Diagnostic logging design

### Q1 — Lifetime of the deep diagnostic logging

| Option | Description | Selected |
|--------|-------------|----------|
| Env-var gated, permanently shipped | Ships in the code, OFF unless an explicit debug var is set; matches the repo's "unset env var ⇒ inert" convention and stays reusable if the symptom recurs | ✓ |
| Always on, ungated | Evidence accumulates with no setup; louder logs, Notion response fragments always retained | |
| Temporary, removed in Phase 8 | Cleanest end state; a recurrence would need a re-deploy, and deploys reset the ISR observation window | |

**User's choice:** Env-var gated, permanently shipped.
**Notes:** The leg-naming log itself was framed up front as permanent regardless — it *is* CONT-01. Only the deep diagnostics were in question.

### Q2 — What the gated log records

| Option | Description | Selected |
|--------|-------------|----------|
| status + content-type + 200-char body excerpt | Exactly what PITFALLS 5 specifies; `text/html` ⇒ Cloudflare challenge, clean JSON 401/404 ⇒ sharing state. Plus error name/message and page-id shape | ✓ |
| Same, with a 1000-char excerpt | More room to tell challenge-page types apart; more volume, small chance of incidental personal data | |
| status + content-type only | Safest; cannot satisfy SC#2's "response-body excerpt" requirement | |

**User's choice:** status + content-type + 200-char body excerpt.

### Q3 — When the thrown error does not carry the raw HTTP response

| Option | Description | Selected |
|--------|-------------|----------|
| One probe on failure | Try extracting from the error first; if status/body are unobtainable and the gate is on, issue one raw fetch to the same endpoint. Evidence does not depend on luck | ✓ |
| Extract from thrown error only | No side effects; risks a wasted deploy cycle if notion-client discards the status | |
| Always run both paths in parallel | Most information; doubles Notion calls on every post render | |

**User's choice:** One probe on failure.

### Q4 — Log format

| Option | Description | Selected |
|--------|-------------|----------|
| Bracket prefix + structured payload | Keeps the repo's `[Context]` grep-ability for the Vercel dashboard, appends single-line JSON | ✓ |
| Existing plain-string style | Most consistent; fields spill across lines | |
| Pure single-line JSON | Cleanest to parse; worst to scan by eye, clashes with the existing convention | |

**User's choice:** Bracket prefix + structured payload.

---

## Evidence capture path

### Q1 — How to produce a failing request

| Option | Description | Selected |
|--------|-------------|----------|
| Gated debug route | Secret-locked route takes a post id and makes the same call; reproducible on demand, so the six candidates can be eliminated one at a time. `/api/notify-subscribers` is the gate precedent | ✓ |
| Instrument the render path only and wait | No new surface, purest "real production evidence"; capture timing is uncontrollable against a warm ISR cache | |
| Both — narrow with the route, confirm on the render path | Strongest evidence, most work | |

**User's choice:** Gated debug route.

### Q2 — What locks the route

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated new secret var | Separate from CRON_SECRET, combined with the debug gate; both must hold or the route 404s | ✓ |
| Reuse existing CRON_SECRET | No new setup; rotating it would break cron and diagnostics together | |
| Single debug flag for both | Simplest; the route would effectively open unauthenticated the moment diagnostics are enabled | |

**User's choice:** Dedicated new secret var.

### Q3 — Where evidence is recorded

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated 07-EVIDENCE.md | Six-candidate table filled in, raw logs pasted, named verdict at the end; single path for Phase 8's D-08 gate | ✓ |
| A section inside VERIFICATION.md | Fewer files; wrong timing (evidence accrues mid-phase) and harder to find later | |
| Mark verdicts directly in PITFALLS.md | One place to look; would blur research-time hypotheses with measured results | |

**User's choice:** Dedicated 07-EVIDENCE.md.

### Q4 — Deployment environment

| Option | Description | Selected |
|--------|-------------|----------|
| Production directly | Where the live symptom is; SC#2 rules out local dev. Cost: deploys reset the ISR cache and compete with Phase 9's idle window | ✓ |
| Preview first, Production if needed | Leaves the Production cache alone; Preview may not reproduce (different IP range / env vars) | |
| Both, compared | Fastest discrimination between environment-and-IP causes vs sharing/token causes; two deploys | |

**User's choice:** Production directly.

### Q5 — Non-code operator checks

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist + Claude walks through it | Explicit checklist in the plan; Claude asks step by step at execution time and records answers into EVIDENCE.md. Same shape as v1.0 Phase 5 | ✓ |
| Install vercel CLI first | Automatable, output pasteable as evidence; interactive login required, new tool dependency | |
| Operator checks and pastes results ad hoc | Fastest; items get dropped | |

**User's choice:** Checklist + Claude walks through it.
**Notes:** `vercel` CLI is not on this machine and there is no `.vercel` directory — all checks are dashboard-doable.

---

## Chrome fetch isolation

### Q1 — The unused categories/relatedPosts fetches

| Option | Description | Selected |
|--------|-------------|----------|
| Keep and isolate with a separate catch | PITFALLS 6's "split by concern, not by call"; body survives a chrome failure, terminal template unaffected, CONT-01's three-way evidence preserved | ✓ |
| Fetch conditionally per template | Removes the failure path and some Notion load under `default`; also removes the situation CONT-01 exists to discriminate | |
| Isolate now, clean up in Phase 8 | Smallest diff this phase | |

**User's choice:** Keep and isolate with a separate catch.
**Notes:** Surfaced during scouting — `DefaultPostPage` (`templates/default/PostPage.tsx:14`) accepts only `post` and `recordMap`; the two fetches serve the `terminal` template only yet run on every `default` render, and under the current single catch can null out an already-fetched `recordMap`. That is the exact CONT-04 mechanism.

### Q2 — `getPost()` failures that are not 404

| Option | Description | Selected |
|--------|-------------|----------|
| Catch and distinguish transient failure | `notFound()` only for a genuine Notion 404; everything else becomes a distinct "temporarily unavailable" state with the leg named in the log. Closes SC#4 | ✓ |
| Catch and collapse into notFound() | Simplest code; PITFALLS 6 warns against it, and one Notion outage could push live posts into search engines as 404s | |
| Leave getPost untouched this phase | Narrowest scope; leaves SC#4 open and reopens the same file next phase | |

**User's choice:** Catch and distinguish transient failure.
**Notes:** Raised after reading `page.tsx:57` (call sits outside the try) against `packages/core/src/client.ts:322` (throws on any non-404). With no `error.tsx` in the repo, that throw escapes the render today.

### Q3 — What a terminal-template reader sees on chrome failure

| Option | Description | Selected |
|--------|-------------|----------|
| Silent degradation to empty state | Empty list, body renders, failure in the log only; matches `app/layout.tsx:49` so site-wide behavior stays consistent | ✓ |
| Show a short notice in the section | Distinguishes empty from broken; wording is CONT-05 / Phase 8 territory | |
| Hide the section entirely | Visually cleanest; layout shifts between requests | |

**User's choice:** Silent degradation to empty state.

### Q4 — The "Content could not be loaded." wording

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as is | Wording separation is CONT-05 / Phase 8; deciding before the cause is known means designing it twice | ✓ |
| Fix the wording now too | Same file is already open; would pull CONT-05 out of Phase 8 and change roadmap scope | |

**User's choice:** Leave as is.

---

## ISR throw verification

### Q1 — Measure the throw-during-regeneration behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip the measurement, design around it | Nothing throws by design, so the answer changes no code here; stays an open question, and one fewer deploy resetting the ISR cache | ✓ |
| Verify with a scratch route | Closes a roadmap open question for Phase 8; extra deploy, ISR reset, competes with the evidence window | |
| Do it after evidence capture if there's room | Ordering compromise; tends to get dropped at the end of a plan | |

**User's choice:** Skip the measurement, design around it.

### Q2 — Add an `error.tsx`?

| Option | Description | Selected |
|--------|-------------|----------|
| Do not add | An unreachable safety net if nothing throws; PITFALLS 6 warns against adding one that is then trusted untested | ✓ |
| Add a minimal one | Site-styled screen instead of Next's default on an unexpected escape; introduces an unverified fallback path | |

**User's choice:** Do not add.

### Q3 — How "nothing throws" is guaranteed

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-verification checklist item | Confirm every `await` in `page.tsx` sits inside a catch, comment the reason; matches the repo's existing review + comment mechanism | ✓ |
| Type/lint rule | Machine-enforced; no standard rule targets this and the repo has no lint/test infrastructure for a custom one | |
| Single never-throws wrapper helper | Structurally strongest; blurs the per-leg log distinction CONT-01 depends on | |

**User's choice:** Phase-verification checklist item.

### Q4 — If the phase resolves the symptom outright

| Option | Description | Selected |
|--------|-------------|----------|
| Record the verdict either way | Six-candidate verdict written into EVIDENCE.md before closing, even if the symptom is gone; lets Phase 8 shrink its scope on evidence rather than on absence | ✓ |
| Close as soon as it works | Faster; PITFALLS 15 warns a warm cache or one lucky request looks identical to a fix | |

**User's choice:** Record the verdict either way.

---

## Claude's Discretion

- Exact env var names for the debug gate and the debug-route secret, and the debug route's path.
- Exact JSON field names inside the log payload.
- Exact copy and HTTP status of the transient-failure state (only its distinctness from `notFound()` was locked).
- Whether the deep-diagnostic instrumentation lives in `lib/notion-x.ts`, `post/[id]/page.tsx`, or a shared helper.

## Deferred Ideas

- Measuring ISR throw behavior on Next 16 / Fluid Compute — revisit when a design depends on it.
- Adding an `error.tsx` — only with a live deployed-regeneration test, per PITFALLS 6.
- Removing the unused `getCategories`/`getPosts` calls under the `default` template — reconsider once the cause is known.
- Wording split for "no content yet" vs "fetch failed" — CONT-05, Phase 8.
- Caching/revalidation wrapper for `getPageRecordMap()` — already tracked as CONT-F02 (v2).
- Validating the dynamic route segment before it reaches the Notion API URL — declined for this milestone, still tracked in PROJECT.md.
- Removing the debug route once evidence capture is complete.

**Scope creep redirected:** none — the discussion stayed inside the phase boundary. Two adjacent items (CONT-05 wording, `error.tsx`) were raised as boundary checks and deliberately left out.
