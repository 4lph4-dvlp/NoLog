---
phase: 7
slug: content-failure-isolation-live-diagnosis
status: draft
captured_environment: production
captured_at:
deployment_id:
verdict:
---

# Phase 7 — Live Production Evidence

> The D-08 gate artifact. Phase 8's researcher and planner read this file before any fix is designed.
> CONT-02 and REQUIREMENTS.md D-08 make live evidence the gate on Phase 8. This project has a recorded
> process lesson (PROJECT.md's CR-01 entry, STATE.md's 2026-07-25 correction): diagnosing from internal
> code consistency instead of the live external system cost a full revert-then-refix round trip.
> `PITFALLS.md` Pitfall 5 exists to prevent the repeat. This file is the instrument.

**Nothing in this file may be filled from inference, recollection, or a source read.** Every evidence
cell is an observation copied from the deployed Production system. A cell that cannot be filled that
way is marked `inconclusive` with the missing observation named — never forced.

---

## Capture Context

| Item | Value |
|------|-------|
| Vercel environment (must read `Production` — D-09) | _pending_ |
| Capture timestamp | _pending_ |
| Deployment ID / URL captured against | _pending_ |
| Git commit SHA deployed | _pending_ |
| `NOTION_DEBUG_DIAGNOSTICS` set to `1` at capture time? | _pending_ |
| Failing post's Notion page id | _pending_ |
| Production site URL | https://4lph4-bl0g.vercel.app |

> **Phase 9 dependency.** Every deploy in this capture invalidates the entire ISR cache. Phase 9
> (IMG-01) needs an uninterrupted idle window longer than Notion's ~1h presigned-URL lifetime.
> **Phase 9's idle window must be measured from the closeout redeploy timestamp recorded in the
> Closeout section below**, not from any earlier deploy.

---

## Operator Checklist (D-10)

| Question | How it was checked | Answer | Observed at |
|----------|--------------------|--------|-------------|
| Is `NOTION_TOKEN_V2` set for the **Production** environment? | _pending_ | _pending_ | _pending_ |
| Does the failing Notion page load in a **logged-out incognito** browser tab? | _pending_ | _pending_ | _pending_ |
| When did the failure start, relative to this project's Vercel deployment history? | _pending_ | _pending_ | _pending_ |

**Dashboard navigation used**

- `NOTION_TOKEN_V2` presence — Vercel Dashboard → Project → Settings → Environment Variables, filtered
  by name with Environment = Production. The value is not viewable and is not needed: presence is the
  whole discriminator, because `apps/web/src/lib/notion-x.ts` only tests truthiness
  (`process.env.NOTION_TOKEN_V2 || undefined`).
- Incognito load — a private/incognito browser window, logged out of Notion, against the failing
  page's own `notion.so` URL.
- Failure onset vs deploys — Vercel Dashboard → Project → Deployments.

**No `vercel` CLI was used, and none was installed** (D-10). The CLI is not present on this machine and
there is no `.vercel/` project link; every step above is dashboard-only by design, not by omission.

---

## Raw Evidence (verbatim)

**Rule for this section:** content here is pasted verbatim from its source — never retyped, never
summarised, never reconstructed from memory. This is the prohibition recorded in plan 07-03's
`must_haves`, and it is the reason this file exists.

**Redaction:** the `NOTION_DEBUG_ROUTE_SECRET` *value* must never appear here. Redact the bearer token
from any pasted request line before pasting (T-07-14).

### Debug route response body — `GET /api/diagnose-page?id=<page id>` with bearer secret

```
<paste here>
```

### Unauthorised requests (gate-closed check)

| Request | HTTP status | Body |
|---------|-------------|------|
| No `Authorization` header | _pending_ | _pending_ |
| Wrong bearer token | _pending_ | _pending_ |

### Vercel Production runtime log — `[DiagnosePage]`

```
<paste here>
```

### Vercel Production runtime log — `[PostPage:recordMap]` / `[PostPage:chrome]` / `[PostPage:post]`

```
<paste here>
```

> If a prefix has no matches, record `no matches in the retention window` for it rather than leaving
> the block empty — an absence is itself an observation.

---

## Repeated-Load Observations (PITFALLS 15)

A single successful load proves nothing: the ISR cache may be warm, or the cause intermittent. Five
loads spread across several minutes, cold browser cache, against the Production `/post/<id>` URL.

| Attempt | Time | URL | What rendered | Notes |
|---------|------|-----|---------------|-------|
| 1 | _pending_ | _pending_ | _pending_ | _pending_ |
| 2 | _pending_ | _pending_ | _pending_ | _pending_ |
| 3 | _pending_ | _pending_ | _pending_ | _pending_ |
| 4 | _pending_ | _pending_ | _pending_ | _pending_ |
| 5 | _pending_ | _pending_ | _pending_ | _pending_ |

**What each rendering means**

- The post body → the happy path.
- `Content could not be loaded.` → `getPageRecordMap` failed; the existing unchanged fallback (D-14).
- `This post is temporarily unavailable` → the new card. **If this ever appears, it is the live half of ROADMAP SC#4.**
- A 404 → `notFound()` was reached; only correct for a genuinely missing/non-public post.
- Body renders while a `[PostPage:chrome]` line was logged for the same request → **the live half of ROADMAP SC#3.**

---

## Six-Candidate Discriminating Table (PITFALLS 5)

The three left columns are reproduced **verbatim** from `.planning/research/PITFALLS.md` Pitfall 5 —
unedited, so a reader can diff them against the research and see nothing was quietly reframed. The two
right columns are this capture's judgement.

**A row may be marked `eliminated` only when a pasted observation above rules it out.** An inference
drawn from reading the source is not sufficient and must be marked `inconclusive` with the missing
observation named.

| Candidate cause | What it looks like | Discriminating evidence | Observed evidence | Status |
|---|---|---|---|---|
| Notion/Cloudflare blocking Vercel's rotating serverless egress IPs | Works locally, fails only in prod; error is a 403 or an HTML "challenge" page instead of JSON | Add a temporary debug log of the raw response `status` + first 200 chars of body inside `getPageRecordMap()`'s catch (currently there is none — the failure is swallowed silently in `post/[id]/page.tsx`'s combined catch). A non-JSON body or `text/html` response body containing a challenge/Cloudflare marker is diagnostic; a clean `401`/`404` JSON body is not this. | _pending_ | _pending_ |
| `fetch` / runtime differences under Next 16 (edge vs nodejs runtime, missing User-Agent, following/not-following redirects) | Consistent failure across both environments once headers differ, or works in one Next.js runtime and not the other | Confirm which runtime the route/page is executing in (`export const runtime = "nodejs"` vs default/edge) and whether `notion-client` requires Node-only APIs; a runtime mismatch would surface as an import/require error, not a network error — check the actual thrown error's `name`/message, not just "it failed." | _pending_ | _pending_ |
| Page ID format (dashed UUID vs compact) | `getPage()` throws immediately on a malformed ID, before any network call | `notion-client`'s `get_page`-equivalent accepts both dashed and 32-char compact formats per its own docs (LOW confidence, single source) — unlikely root cause on its own, but verify by logging the exact `id` value passed into `getPageRecordMap(id)` and confirming it matches one of the two accepted shapes. | _pending_ | _pending_ |
| Database row vs "shared page" distinction, and whether a page inside a database inherits the parent's public sharing | Some posts render, others don't; or all fail identically | Sharing inherits from a shared parent (database) down to child pages UNLESS a specific row's Share settings were narrowed ("Access Restricted") — Notion explicitly supports overriding a single row to NOT inherit (MEDIUM confidence). Discriminator: open the exact failing page's URL directly in an **incognito/logged-out** browser tab (not the operator's authenticated session, which can see restricted pages regardless) — if it 404s or prompts to request access there, that row's sharing was overridden; if it loads fine logged-out, sharing is not the cause. | _pending_ | _pending_ |
| `NOTION_TOKEN_V2` cookie expiry | Works, then stops working after some time, correlating with a Notion session/password change | This repo's `notion-x.ts` currently passes `process.env.NOTION_TOKEN_V2 \|\| undefined` — i.e. unauthenticated unless that var is explicitly set. Discriminator: run `vercel env ls` and check whether `NOTION_TOKEN_V2` is actually set in the Production environment. If it is NOT set (matching local `.env` also unset), cookie expiry is structurally impossible as the cause — the client is running unauthenticated end-to-end and the failure must be sharing state or IP blocking, not a stale cookie. If it IS set, diff it against a freshly captured cookie and check for staleness. | _pending_ | _pending_ |
| Notion-side 2025–2026 changes to the unofficial endpoint | Failure started at a specific point in time uncorrelated with any deploy in this repo | Check whether the failure predates or postdates a Vercel deploy — if it started with no corresponding commit, it's more likely Notion/infra-side; correlate against Vercel's deployment history and any incident reports. | _pending_ | _pending_ |

> **Note on the `NOTION_TOKEN_V2` row's discriminator.** PITFALLS.md names `vercel env ls` because that
> was the research-time assumption. Per D-10 the equivalent dashboard check (Settings → Environment
> Variables, Production filter) is used instead — the *observation* is identical (presence/absence),
> only the instrument differs. The discriminator text above is left unedited on purpose.

---

## Verdict

_pending_

**Permitted forms — exactly one of these two:**

1. **A named candidate** from the table above, plus the specific pasted observation that confirms it.
   If more than one row is `confirmed`, say so and rank them by the strength of the observation rather
   than picking one silently.
2. **"The evidence matches none of the six"** — stated explicitly, followed by what was observed instead.

**D-18.** This section is completed **even if** the catch decomposition already made the reported
symptom stop appearing. "The symptom stopped" is not a cause. If step 8's repeated loads all rendered
the body, say that plainly, then state which candidate the captured diagnostics point at anyway — and
if the diagnostics captured nothing because nothing failed during the window, record that as the honest
outcome with the reason, rather than closing the phase on a disappearance.

---

## Closeout

| Step | Done | Timestamp |
|------|------|-----------|
| `NOTION_DEBUG_DIAGNOSTICS` removed from Production | _pending_ | _pending_ |
| `NOTION_DEBUG_ROUTE_SECRET` removed from Production | _pending_ | _pending_ |
| Production redeployed so running instances lost both vars | _pending_ | _pending_ |

> The redeploy timestamp above is the point Phase 9's >1h idle verification window must be measured
> from (ROADMAP parallelization caution).

---

## Hand-off to Phase 8

_pending_

To be filled with: which of CONT-03 and CONT-05 the verdict informs; what Phase 8's researcher should
treat as established fact versus still-open; and anything this capture could not settle — including a
cross-reference to plan 07-03's flagged assumption on whether a 200-character body excerpt is
*sufficient* to discriminate all six candidates, or whether some candidate needs evidence this phase's
instrumentation does not collect.
