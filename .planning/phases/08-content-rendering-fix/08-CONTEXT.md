# Phase 8: Content Rendering Fix - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the fix for the root cause Phase 7 established, so every post published to the web renders its Notion
body on a reader's first visit to the deployed site (CONT-03) — and split the one fallback sentence into two
distinct reader-facing states (CONT-05).

Three things are delivered:
1. **The fix.** `notion-client` is given a `User-Agent`, which is what Cloudflare's block keys on.
2. **CONT-05.** "This post has no content yet" and "the content could not be loaded" stop being the same
   sentence.
3. **D-19 teardown.** Every diagnosis-only surface Phase 7 added is removed, in this same deploy.

Phase 8 also **closes Phase 7's two outstanding UAT items** (SC#3, SC#4) — see D-15 below. Phase 7 verified
3/4 and sits at `human_needed`; its remaining criteria can only be exercised once the body renders again,
which happens here.

**Not in this phase:** thumbnail freshness (Phase 9), sidebars/reading width (Phase 10), a reader-facing
retry control (CONT-F01, v2), any caching/revalidation wrapper for `getPageRecordMap` (CONT-F02, v2).

</domain>

<decisions>
## Implementation Decisions

### The Fix — User-Agent

- **D-01:** The fix is to send a **`User-Agent` header** on `notion-client`'s requests. This is the cause
  Phase 7 confirmed (`07-EVIDENCE.md`): Cloudflare answers Node's default `user-agent: node` with 403 + an
  HTML challenge page, in front of a `loadPageChunk` endpoint that returns 200 to any other user-agent from
  the same IP. Satisfies ROADMAP SC#2 — the fix targets the evidence, not the hypothesis.
- **D-02:** **`ofetchOptions` on the `NotionAPI` constructor is the mechanism.** Established by direct
  inspection of the installed package, not assumed: `node_modules/notion-client/build/index.js:26-37` accepts
  `ofetchOptions`, and lines 538-545 merge `...this._ofetchOptions?.headers` into every request's headers
  (only `Content-Type`, `cookie` and `x-notion-active-user-header` are applied after it, so a `User-Agent`
  set this way reaches the wire). **No patch, no fetch wrapper, no new dependency** — this closes
  `07-EVIDENCE.md`'s first open question inside D-01/D-07 of REQUIREMENTS.md.
- **D-03:** The UA is an **honest, self-identifying string** — the shape
  `NoLog (+https://github.com/4lph4-dvlp/NoLog)`, naming the software and giving a contact URL.
  **Impersonating a browser is unnecessary, and this was measured, not assumed.** Against the live endpoint,
  same body and page id: `node` → 403; `NoLog/1.1 (+…)` → 200; `Mozilla/5.0 (compatible; NoLog/1.1; +…)` →
  200; bare `NoLog` → 200; a real Chrome UA → 200. Cloudflare is blocking `node` specifically, not admitting
  browsers only. This also resolves `07-EVIDENCE.md`'s third open question — the one flagged as the
  operator's call rather than a technical one — in the direction that needs no impersonation. A
  self-identifying bot UA with a contact URL is the conventional, well-behaved choice.
- **D-04:** **No version number in the UA.** Identification and contact are the whole purpose, and a fork's
  "version" diverges from upstream immediately, so a version is either wrong or maintenance. Reading it from
  `package.json` was rejected as needing bundling plumbing for no benefit.
- **D-05:** The UA is a **hardcoded constant, not forker-configurable** — no env var, no `site.config.ts`
  field. This is load-bearing, not incidental: D-19's whole premise (and the operator's condition for
  accepting Phase 7's instrumentation) is that a forker ends up with **zero** net new env vars. A
  `NOTION_USER_AGENT` variable would break exactly that. Accepted cost: every NoLog deployment sends the same
  UA, so a block against it would affect all forks at once — which also means Notion sees one identifiable,
  well-behaved client rather than an unattributable swarm.
- **D-06:** Define the UA **once as a shared exported constant**, and apply it **only to the `notion-client`
  construction** in this phase. Phase 9's thumbnail-proxy work will make outbound requests to S3 and can
  reuse the constant. Deliberately not applied to the official `@notionhq/client`, Resend, or any other
  currently-working call path: `07-REVIEW.md` F-05's point is that *an outbound request without a UA is now
  known to be blockable* — that is a reason to have one place to put it, not a reason to change paths that
  have no observed problem. — **Reversibility:** reversible.

### Resilience Scope

- **D-07:** **Ship the header fix alone. Build no escalation defence.** If Cloudflare later escalates to a JS
  challenge or TLS fingerprinting, the header stops being sufficient — but the behaviour on that day is
  already safe, because Phase 7 shipped it: nothing throws out of the render, the body degrades to a fallback
  message, and a leg-named log line records which call failed and why. Writing a fallback path for an
  unobserved future failure mode is the "unverified safety net" pattern `PITFALLS.md` Pitfall 6 warns about.
  This closes `07-EVIDENCE.md`'s second open question by scoping it out with a reason, not by ignoring it.
- **D-08:** No new detection logging for a future re-block. The existing ungated leg-named logs already name
  the failing call; adding fresh diagnostic code in the same phase that removes Phase 7's diagnostic code
  would be self-cancelling.
- **D-09:** If the block ever returns, the reader sees **exactly what they see today** — title and metadata
  render, the body area carries the "could not be loaded" wording (as sharpened by CONT-05). No retry button:
  that is CONT-F01, deferred to v2, and against a systemic block a retry would fail identically anyway.

### CONT-05 — Two Distinct States

- **D-10:** The two states are discriminated by **whether the fetch succeeded**, not by inspecting content
  volume. A caught failure ⇒ "could not be loaded"; a `recordMap` that arrived but has nothing to render ⇒
  "no content yet". This uses only information the render already holds — Phase 7's per-leg catch
  decomposition makes the distinction available for free, with no extra Notion call. Counting blocks was
  rejected as needing an arbitrary threshold (an "empty" Notion page still carries structural blocks); a
  cross-check against the official API was rejected under `PITFALLS.md` Pitfall 4 (it adds a live call to
  every render and quietly pushes the page toward dynamic).
- **D-11:** Copy is **factual and short**, matching the existing tone (one plain sentence,
  `text-text-secondary italic`): no-content ≈ *"This post has no content yet."*; fetch-failed ≈ *"This post's
  content could not be loaded right now."* The exact wording is the planner's to finalize within that shape.
  English, matching the existing reader-facing fallback and `PostUnavailable` — this repo's reader-facing
  fallback copy is unlocalized by existing precedent, and changing that is a separate decision affecting
  three places and the fork template's default language.
- **D-12:** No recovery hint ("try again in a few minutes") on the fetch-failed state. Against a systemic
  block, waiting does not help, and the sentence would be false. `PostUnavailable` (Phase 7) keeps its own
  "check back in a few minutes" copy because it describes a genuinely transient `getPost` failure — a
  different condition.

### D-19 Teardown and Deploy Ordering

- **D-13:** **Resolution (a) of D-19: keep `isDiagnosticsEnabled()`.** It is a three-line
  `process.env` truthiness check that costs a forker nothing when the variable is unset, and
  `apps/web/src/lib/post-availability.ts` — a permanent file — imports it to decide log detail. Removing the
  route, the deep diagnostics and any documentation achieves the "zero net new forker-facing env vars" goal
  without touching it. Resolution (b) (collapsing `buildResponseDetail` to `buildBasicDetail`) was considered
  and rejected: it costs log fidelity in a permanent file to delete three lines. **Removed in this phase:**
  `apps/web/src/app/api/diagnose-page/route.ts` in full; `describeFetchFailure()` in
  `apps/web/src/lib/notion-x.ts` including its D-04 raw-fetch probe and every call site; any documentation
  mention of `NOTION_DEBUG_DIAGNOSTICS` / `NOTION_DEBUG_ROUTE_SECRET`. **Kept:** the ungated leg-naming logs
  (`[PostPage:recordMap]` / `[PostPage:chrome]` / `[PostPage:post]` — these are CONT-01), the per-concern
  catch decomposition, `classifyMissingPost`, `PostUnavailable`, and `isDiagnosticsEnabled()`.
- **D-14:** **The fix, CONT-05, and the teardown ship in ONE deploy.** Every deploy invalidates the entire
  ISR cache, and Phase 9 (IMG-01) needs an uninterrupted idle window longer than Notion's ~1h presign
  lifetime — the ROADMAP flags this collision explicitly. One deploy resets that clock once instead of two or
  three times. Accepted cost: if the UA fix does not work, the diagnostic tooling is already gone and
  re-adding it costs a deploy. That risk is small and quantified — the fix is verified working against the
  live endpoint before it ships (D-03's measurements), so this is not a leap. — **Reversibility:** costly —
  undoing the teardown means restoring deleted code and re-adding two Production env vars, not a one-line
  revert.
- **D-15:** **Phase 8 also closes Phase 7's two outstanding UAT items** (`07-UAT.md`: SC#3 chrome-failure
  isolation, SC#4 transient-failure discrimination). Both were `PRESENT_BEHAVIOR_UNVERIFIED` because neither
  state transition could be observed while the content leg was failing for an unrelated reason. Once the body
  renders again, SC#3 becomes testable and unambiguous. Doing them here uses the same build and avoids
  dragging an unfinished phase to the milestone audit. On success, Phase 7's verification is re-run and
  expected to move from `human_needed` to `passed`.

### Claude's Discretion

- The exact final UA string within D-03's shape, and which module the shared constant lives in.
- The exact final wording of the two CONT-05 sentences within D-11's shape.
- Whether the `terminal` template's post view gets the same CONT-05 split (it is out of scope for this
  milestone, so the default is: leave it alone).
- Ordering of tasks within the single deploy, and whether teardown lands in the same commit or a sibling
  commit inside the same push.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The evidence this phase is built on — read first
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-EVIDENCE.md` — **the D-08 gate artifact.**
  Root cause, the six-candidate table with five eliminations, the single-variable UA experiment, and a
  "Hand-off to Phase 8" section naming what is established fact versus still-open. Do not re-derive any of it.
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-CONTEXT.md` — D-19's teardown scope and
  its cross-file coupling warning; D-14, which deferred CONT-05 to this phase.
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-REVIEW.md` — F-05's generality point about
  outbound requests without a `User-Agent`; the resolution record for F-01/F-02.
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-UAT.md` — the two tests D-15 commits this
  phase to running, including why they are legitimately testable locally.
- `.planning/phases/07-content-failure-isolation-live-diagnosis/07-VERIFICATION.md` — what Phase 7 did and did
  not close.

### Requirements and scope
- `.planning/REQUIREMENTS.md` — CONT-03 / CONT-05; locked D-01 (keep `notion-client` + `react-notion-x`),
  D-05 (`packages/core` unchanged), D-07 (no new dependencies / no new infrastructure).
- `.planning/ROADMAP.md` §"Phase 8" — the four success criteria, and the parallelization caution about
  deploys resetting Phase 9's idle window.

### Pitfalls that bind this phase
- `.planning/research/PITFALLS.md` — Pitfall 12 (`next dev` proves nothing for CONT-03), Pitfall 15 (a
  "fixed" recordMap can be a warm cache or a lucky request — force a real regeneration and repeat), Pitfall 6
  (do not add an unverified safety net), Pitfall 4 (do not add a per-request live call and silently make the
  page dynamic).

### Code under change
- `apps/web/src/lib/notion-x.ts` — `NotionAPI` construction (the fix lands here); `describeFetchFailure` and
  the D-04 probe (deleted here); `isDiagnosticsEnabled` (kept).
- `apps/web/src/app/post/[id]/page.tsx` — the per-leg catches; the `recordMap` null path CONT-05 splits.
- `apps/web/src/templates/default/PostPage.tsx:100` — the single `"Content could not be loaded."` sentence
  CONT-05 replaces with two.
- `apps/web/src/app/api/diagnose-page/route.ts` — deleted in full.
- `apps/web/src/lib/post-availability.ts` — **not** modified; its `isDiagnosticsEnabled` import is why D-13
  chose resolution (a).
- `node_modules/notion-client/build/index.js:26-37, 538-545` — read-only reference for D-02's mechanism.
  **Do not modify `packages/core`** (REQUIREMENTS.md D-05: published npm package).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`NotionAPI`'s `ofetchOptions` option** — already supported by the installed version; the fix is a
  constructor argument, not a workaround.
- **Phase 7's per-leg catch decomposition** — CONT-05's discrimination falls out of it for free. The content
  leg already knows whether it caught an error; that boolean is the whole distinction D-10 needs.
- **`PostUnavailable.tsx` + `07-UI-SPEC.md`** — an already-approved design contract for reader-facing failure
  copy (tokens, spacing, tone). CONT-05's two sentences should sit consistently beside it.
- **The ungated leg-named logs** — remain the observability surface after teardown, at zero forker cost.

### Established Patterns
- Env-gated features are inert when unset (Cusdis, Resend) — the reason D-05 refuses to add a UA env var is
  that this phase's goal is the *opposite*: fewer knobs, not another inert one.
- Reader-facing fallback copy is unlocalized English (`PostPage.tsx:100`, `PostUnavailable.tsx`), which D-11
  follows rather than reopening.
- No test infrastructure exists and none may be added. Verification is source assertions,
  `npm run build --workspace=apps/web`, `npm run lint --workspace=apps/web`, and deployed-site observation.

### Integration Points
- `apps/web/src/lib/notion-x.ts` is the single chokepoint for both the fix and most of the teardown.
- The deleted route removes `/api/diagnose-page` from the build's route list — a visible, checkable signal
  that teardown actually happened.
- **File-disjoint from Phases 9 and 10** — this phase touches none of `HomePage.tsx`, `Layout.tsx`,
  `app/layout.tsx`, or `globals.css`.

### Non-obvious finding from this discussion
The ethical question the evidence file escalated ("is impersonating a browser appropriate?") **dissolved on
measurement.** Cloudflare is not gating on browser-ness; it is blocking the literal `node` default. An honest
`NoLog (+url)` UA passes with a 200 and a full `recordMap`. The question was worth escalating and worth
answering with a test rather than a judgement call.

</code_context>

<specifics>
## Specific Ideas

- The UA should read as a well-behaved bot identifying itself, in the spirit of `Googlebot` — software name
  plus a URL a Notion-side operator could follow if this client ever misbehaved.
- CONT-05's two sentences should be distinguishable at a glance by a reader who is not looking for the
  difference, not merely different on close reading.
- The teardown should be visible in the diff as deletions, not as newly-dead code left in place.

</specifics>

<deferred>
## Deferred Ideas

- **Reader-facing retry control** on a content-fetch failure — CONT-F01, v2 (D-09/D-12).
- **Caching / revalidation wrapper for `getPageRecordMap()`** — CONT-F02, v2; `notion-client` uses `ofetch`,
  not Next's patched `fetch`, so it needs its own design pass.
- **Escalation defence** if Cloudflare moves beyond UA filtering — deliberately unbuilt (D-07). Revisit only
  on an observed re-block.
- **Applying the shared UA constant to other outbound paths** (official API, Resend, S3) — the constant is
  created here so Phase 9 can reuse it, but no currently-working path is changed (D-06).
- **`terminal` template parity** for the CONT-05 split — TMPL-F01, out of scope this milestone.
- **Localizing reader-facing fallback copy** — would touch three places and raise the fork template's default
  language question; not this phase (D-11).
- **Validating the dynamic route segment before it reaches the Notion API URL** — long-standing open security
  item, explicitly out of scope for v1.1 in REQUIREMENTS.md, still tracked in `PROJECT.md`.

</deferred>

---

*Phase: 8-Content Rendering Fix*
*Context gathered: 2026-08-10*
