# Phase 7: Content Failure Isolation & Live Diagnosis - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes the post-detail render failure **legible in production** and **isolates its blast radius**, then **captures the live evidence** that Phase 8's fix will be built against.

Three things are delivered:
1. Production logs that name *which* call failed — `getPageRecordMap`, `getCategories`, or the related-posts `getPosts` — instead of one identical line for all three (CONT-01).
2. Captured live evidence from the deployed site (actual HTTP status + response-body excerpt), recorded against `PITFALLS.md`'s six-candidate discriminating table with a named verdict, or an explicit "matches none of the six" (CONT-02). A local `next dev` run does not satisfy this.
3. Chrome-level failures (categories / related posts) no longer blank the post body (CONT-04).

**Not in this phase:** choosing or shipping the root-cause fix (Phase 8 / CONT-03), and separating the "no content yet" vs "fetch failed" wording (Phase 8 / CONT-05). This phase may nonetheless resolve the reported symptom outright if the real failing leg turns out to be categories or related posts — ROADMAP records that as a legitimate outcome, not scope leak.

</domain>

<decisions>
## Implementation Decisions

### Diagnostic Logging

- **D-01:** The leg-naming log is permanent and ungated. Every failure path records which of the fetches failed, using the repo's existing bracket-prefix convention (e.g. `[PostPage:recordMap]`, `[PostPage:chrome]`) so the three legs are never reported by one identical line. This is CONT-01 itself, not a debug aid.
- **D-02:** The *deep* diagnostics (HTTP status, `content-type`, response-body excerpt) are permanently shipped in the code but **gated behind an explicit debug env var that is unset by default**. Matches the repo's standing "unset env var ⇒ feature inert" convention (Cusdis, Resend). Chosen over a temporary log so the same instrumentation is reusable if the symptom recurs after Phase 8, without a re-deploy to re-add it. Accepted cost: a permanent maintenance surface that is normally dormant. — **Reversibility:** reversible — removing it is a local deletion in `post/[id]/page.tsx` / `lib/notion-x.ts` with no dependent callers.
- **D-03:** When the gate is on, the log records: HTTP status, `content-type`, the **first 200 characters** of the response body, the thrown error's `name`/`message`, and the shape of the page id that was passed in. This is the exact combination `PITFALLS.md` Pitfall 5 specifies for discriminating the six candidate causes — `content-type: text/html` points at a Cloudflare/challenge page, a clean JSON `401`/`404` points at sharing state. 1000 characters was considered and rejected (volume + slight chance of incidental personal data); status-and-content-type-only was rejected because it cannot satisfy SC#2's "response-body excerpt" requirement.
- **D-04:** If the error thrown by `notion-client` does not carry the raw HTTP response, the code falls back to **one** raw `fetch` probe against the same endpoint — but only when the debug gate is on, and only on the failing request. Evidence capture must not depend on what the library happens to surface. Accepted cost: one extra Notion call per failing request while the gate is on.
- **D-05:** Log format is bracket prefix + single-line JSON payload (`[PostPage:recordMap] {"status":…,"contentType":…,"bodyExcerpt":…}`). Keeps the repo's `[Context]` grep-ability for the Vercel dashboard while staying parseable. Pure JSON and pure prose were both rejected.

### Evidence Capture

- **D-06:** Add a **secret-gated debug route** that takes a post id and performs the same `getPageRecordMap` call directly, so a failing request can be produced on demand instead of waiting for organic reader traffic. Without it, evidence capture is hostage to ISR cache timing. Precedent for the gate shape: `/api/notify-subscribers`'s `CRON_SECRET` check. The route is expected to be removed in a later phase. — **Reversibility:** reversible — a standalone route file with no other consumers.
- **D-07:** The debug route is locked by a **dedicated new secret env var**, distinct from `CRON_SECRET`, AND requires the D-02 debug gate. Both conditions must hold or the route responds 404 — a forker who sets nothing has no route. Reusing `CRON_SECRET` was rejected (rotating it would break cron and diagnostics together); gating on the debug flag alone was rejected (that would make the route effectively unauthenticated the moment diagnostics are enabled).
- **D-08:** Evidence lands in a dedicated **`07-EVIDENCE.md`** in the phase directory: `PITFALLS.md`'s six-candidate table copied in with each row filled from what was observed, raw log lines pasted verbatim, and a named verdict (or an explicit "matches none of the six") at the end. This file is the D-08 gate artifact Phase 8's researcher and planner read. Not a section of VERIFICATION.md (wrong timing, hard to find later), and not edits to `PITFALLS.md` (would blur research-time hypotheses with measured results).
- **D-09:** Evidence is captured against **Production**, not Preview. The live symptom is there, SC#2 explicitly rules out `next dev`, and a Preview environment may differ in egress IP range and env vars. Accepted cost — record it in the plan: each deploy invalidates the whole ISR cache, so this phase's deploys reset Phase 9's required >1h idle verification window (ROADMAP parallelization caution).
- **D-10:** The non-code operator checks — is `NOTION_TOKEN_V2` actually set in Production, does the failing page load in a logged-out incognito tab, when did the failure start relative to deploys — are carried in the plan as an **explicit operator checklist**, walked through step by step at execution time, with each answer recorded into `07-EVIDENCE.md`. Same shape as v1.0 Phase 5's operator verification. No `vercel` CLI install: it is not on this machine and the checks are all doable from the Vercel dashboard.

### Failure Isolation

- **D-11:** `getCategories()` and the related-posts `getPosts()` stay in `post/[id]/page.tsx`, wrapped in their **own catch, separate from `getPageRecordMap`**. Split by *concern*, not by call, per `PITFALLS.md` Pitfall 6. A chrome failure therefore leaves the body rendering (CONT-04). Making the calls conditional per template was considered and rejected: under the active `default` template it would remove the situation CONT-01 exists to discriminate, shrinking the evidence this phase is meant to produce. Accepted cost: under `default`, these two calls remain unused work.
- **D-12:** **A transient `getPost()` failure must stop producing a 404 for a live post.** `notFound()` stays scoped to a genuinely missing / non-public post; a transient failure is surfaced as a distinct **"temporarily unavailable"** state, with the leg named in the log. This is what closes SC#4 ("a post that exists and is public never responds 404 or a full error page as a result of a content-fetch failure"). Collapsing all failures into `notFound()` was rejected — `PITFALLS.md` Pitfall 6 warns against it explicitly, and one Notion outage could push live posts into search engines as 404s.

  **⚠ Correction (2026-08-09, from `07-RESEARCH.md`).** This decision was taken during discussion on the stated premise that `NologClient.getPost()` *throws* on a non-404 failure and that the throw escapes the render because the call at `apps/web/src/app/post/[id]/page.tsx:57` sits outside the try. **That premise is wrong.** `packages/core/src/client.ts:311–338` wraps its own body in `try { … } catch { return null }` — the `throw` at line 323 never leaves the method. `getPost()` therefore *never throws*; it returns `null` for a transient 429/500/network failure **indistinguishably from a genuine 404**, and `notFound()` already fires on transient failures today.

  **What this changes:** the *intent* of D-12 stands unchanged — SC#4 must be closed. The *mechanism* cannot be a bare `try/catch`, because there is nothing to catch, and `packages/core` must not be modified (REQUIREMENTS.md D-05: it is a published package). **This is an open implementation question for the planner**, to be resolved explicitly rather than silently: either add an app-level discriminating check before `notFound()` (distinguishing "Notion says this page does not exist" from "the call did not succeed"), or record an explicit, accepted residual gap on SC#4 with its rationale. Do not close this by assuming a catch will work.
- **D-13:** A chrome failure degrades **silently** — empty list, body renders, failure recorded in the log only. Matches what `apps/web/src/app/layout.tsx:49` already does for the sidebar categories, keeping site-wide behavior consistent. (Only the `terminal` template consumes these values; `default` is unaffected either way.)
- **D-14:** The reader-facing `"Content could not be loaded."` wording is **left untouched** this phase. Splitting it into "no content yet" vs "fetch failed" is CONT-05 / Phase 8; deciding the wording before the cause is known would mean designing it twice.

### ISR / Throw Behavior

- **D-15:** The open question — does a Server Component throw during ISR regeneration fall back to stale HTML or surface as a 500 on this Next 16 / Vercel Fluid Compute setup — is **not measured in this phase**. Because D-11/D-12 already require that no leg throws, the answer does not change any code here. It stays recorded as an open question, to be verified when something actually depends on it. Deploying a deliberately-throwing scratch route was rejected on cost: an extra deploy that resets the ISR cache and competes with D-09's evidence-capture window.
- **D-16:** **No `error.tsx` is added.** If nothing throws, an error boundary is an unreachable safety net, and `PITFALLS.md` Pitfall 6 warns specifically against adding one that is then trusted without a verified test against a live ISR regeneration failure.
- **D-17:** The "no leg throws uncaught" guarantee is enforced as an **explicit phase-verification checklist item** — confirm every `await` in `post/[id]/page.tsx` sits inside a catch, with a comment recording why. Matches the repo's existing mechanism (code review + comments); a lint/type rule was rejected because no standard rule targets this and the repo has no lint/test infrastructure for a custom one, and a never-throws wrapper helper was rejected because it would blur the per-leg log distinction D-01 depends on.
- **D-18:** If the catch decomposition resolves the symptom outright (i.e. the failing leg was categories or related posts), the six-candidate verdict is **still recorded in full** in `07-EVIDENCE.md` before the phase closes. Closing on "the symptom stopped appearing" without a recorded cause is exactly the CR-01 failure mode D-08 exists to prevent, and `PITFALLS.md` Pitfall 15 warns the same disappearance can come from a warm cache or one lucky request.

### Claude's Discretion

- Exact env var names for the debug gate (D-02) and the debug-route secret (D-07), and the route path itself.
- Exact JSON field names inside the log payload (D-05).
- Exact copy and HTTP status of the transient-failure state introduced by D-12 (only its distinctness from `notFound()` is locked).
- Whether the deep-diagnostic instrumentation lives in `lib/notion-x.ts`, in `post/[id]/page.tsx`, or a shared helper.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root-cause candidates and verification constraints
- `.planning/research/PITFALLS.md` — **the central document for this phase.** Pitfall 5 carries the six-candidate discriminating table SC#2 must be recorded against, plus the required evidence shape. Pitfall 6 constrains how the try/catch may be split and warns against misusing `notFound()` and against relying on an unverified `error.tsx`/ISR fallback. Pitfall 12 rules out `next dev` verification. Pitfall 15 constrains what counts as "verified". Open Questions lists the `NOTION_TOKEN_V2`-in-Production and egress-IP-blocking items D-10 checks.
- `.planning/research/ARCHITECTURE.md` — verified file-disjointness across v1.1 phases; scoping reference for what this phase may touch.

### Requirements and phase scope
- `.planning/REQUIREMENTS.md` — CONT-01 / CONT-02 / CONT-04 texts, plus locked decisions D-01 (keep `notion-client` + `react-notion-x`), D-07 (no new deps / no new infra), D-08 (live evidence before a fix is locked).
- `.planning/ROADMAP.md` §"Phase 7" — the four success criteria this phase is verified against, and the notes on decomposing by concern and on the deploy/ISR-cache interaction with Phase 9.

### Project standards
- `.planning/PROJECT.md` — the "fail-closed, not fail-open" standard for anything env-gated, and the CR-01 process lesson (diagnose against the live system, not code consistency).
- `.planning/codebase/CONCERNS.md` — the pre-existing silent-catch-all criticism this phase's logging directly addresses.
- `.planning/codebase/CONVENTIONS.md` — the `[Context]` log-prefix convention D-05 builds on.

### Code under change
- `apps/web/src/app/post/[id]/page.tsx` — the combined try/catch at lines 67–80; `getPost` outside it at line 57.
- `apps/web/src/lib/notion-x.ts` — `getPageRecordMap()`, currently a bare passthrough with no error handling.
- `packages/core/src/client.ts:311–338` — `getPost()` wraps its whole body in `try { … } catch { return null }`, so it **never throws**: a transient 429/500/network failure returns `null` indistinguishably from a genuine 404. Read this before touching D-12 — the correction note there depends on it. **Do not modify `packages/core`** (D-05 in REQUIREMENTS.md: it is a published package).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CRON_SECRET` gate in `/api/notify-subscribers`** — the exact fail-closed, secret-checked-before-anything-else route shape D-06/D-07 need. Copy its structure, not its variable.
- **`[Context]` prefixed `console.error` convention** — already used across page routes and API routes; D-05 extends rather than replaces it.
- **`apps/web/src/app/layout.tsx:44–52`** — an existing per-concern try/catch around `getCategories()` that degrades to `[]`. D-11/D-13 mirror this, so behavior stays consistent site-wide.
- **`Post.thumbnailType` / `mapPageToPost`** — untouched by this phase; noted only to confirm no `packages/core` change is needed.

### Established Patterns
- **Env-gated features are inert when unset** (Cusdis via `NEXT_PUBLIC_CUSDIS_APP_ID`, subscribe via `RESEND_API_KEY`) — D-02 and D-07 follow this exactly.
- **Server-first rendering, no `error.tsx` anywhere in the repo today** — an uncaught throw currently goes to Next's default handling. This is why D-12 matters and why D-16 declines to add one.
- **React `cache()` around the official-API loaders** (`lib/notion.ts`), but `getPageRecordMap()` uses `notion-client`'s own transport and is neither memoized nor ISR-tagged. Any caching treatment for it is explicitly deferred (REQUIREMENTS.md CONT-F02) and out of scope here.

### Integration Points
- `apps/web/src/app/post/[id]/page.tsx` — the single file where all four legs (`getPost`, `getPageRecordMap`, `getCategories`, `getPosts`) meet; the catch decomposition and leg-named logging land here.
- `apps/web/src/lib/notion-x.ts` — where the deep diagnostics and the D-04 probe most naturally attach.
- A new route under `apps/web/src/app/api/` for D-06.
- **File-disjoint from Phases 9 and 10** (verified in `research/ARCHITECTURE.md`) — this phase touches none of `HomePage.tsx`, `Layout.tsx`, `app/layout.tsx`, or `globals.css`.

### Non-obvious finding from this discussion
The active `default` template's `DefaultPostPage` (`apps/web/src/templates/default/PostPage.tsx:14`) accepts only `post` and `recordMap` — it never receives `categories` or `relatedPosts`. Those two fetches serve the `terminal` template only, yet run on every `default` render and, under the current single catch, can null out an already-successfully-fetched `recordMap`. That is the precise mechanism behind CONT-04. D-11 keeps the calls deliberately (for CONT-01 evidence) while removing their ability to destroy the body.

</code_context>

<specifics>
## Specific Ideas

- Log line should be findable by eye in the Vercel dashboard by searching the bracket prefix, then readable as structured data on the same line.
- The six-candidate table from `PITFALLS.md` Pitfall 5 should be reproduced verbatim in `07-EVIDENCE.md` and filled in row by row, so "which candidates were actually eliminated" is visible rather than implied.
- The operator checklist should be walked through interactively at execution time, one item at a time, with answers written down as they come — not handed over as a document to complete alone.

</specifics>

<deferred>
## Deferred Ideas

- **Measuring ISR throw behavior on Next 16 / Fluid Compute** (stale-HTML fallback vs 500) — deliberately not measured here (D-15). Revisit whenever a design actually depends on the answer. Recorded as an open question in `PITFALLS.md`.
- **Adding an `error.tsx`** — declined this phase (D-16). If ever added, `PITFALLS.md` Pitfall 6 requires testing it against a real deployed ISR regeneration failure first.
- **Removing the unused `getCategories`/`getPosts` calls under the `default` template** — kept for now (D-11) because they are part of CONT-01's evidence surface. Reconsider once the cause is known.
- **Wording split for "no content yet" vs "fetch failed"** — CONT-05, Phase 8 (D-14).
- **Caching / revalidation wrapper for `getPageRecordMap()`** — already tracked as CONT-F02 in REQUIREMENTS.md's v2 section; needs its own design pass since `notion-client` cannot take `next: { revalidate, tags }`.
- **Validating the dynamic route segment before it reaches the Notion API URL** — long-standing open security item, explicitly declined for this milestone in REQUIREMENTS.md's Out of Scope, still tracked in `PROJECT.md`.
- **Removing the debug route added by D-06** — planned for a later phase once evidence capture is complete.

</deferred>

---

*Phase: 7-Content Failure Isolation & Live Diagnosis*
*Context gathered: 2026-08-09*
