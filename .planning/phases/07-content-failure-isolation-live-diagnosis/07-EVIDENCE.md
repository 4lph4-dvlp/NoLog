---
phase: 7
slug: content-failure-isolation-live-diagnosis
status: complete
captured_environment: production
captured_at: 2026-08-09T16:43:00Z/2026-08-09T16:51:26Z
deployment_id: dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz
verdict: "Candidate 2 confirmed — notion-client sends no User-Agent, so Node's default `user-agent: node` is answered by Cloudflare with 403 + an HTML challenge page in front of a loadPageChunk endpoint that returns 200 to a browser-shaped request from the same IP. Five other candidates eliminated on pasted observations."
closeout_redeploy: 2026-08-09T17:13:00Z
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
| Vercel environment (must read `Production` — D-09) | `production` (read from every request-log entry's Deployment Information block) |
| Capture timestamp | **2026-08-09 16:43–16:51 UTC** = 2026-08-10 01:43–01:51 KST (operator is UTC+9). Both clocks recorded because the Vercel console log stamps UTC while the request-detail view stamps the viewer's local zone — reading one as the other shifts the date by a day |
| Deployment ID / URL captured against | `dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz` — alias `4lph4-bl0g-6bmp43n1j-4lph4.vercel.app`, domain `4lph4-bl0g.vercel.app`, branch `main` |
| Git commit SHA deployed | `a6becd8` (`docs(07-03): add 07-EVIDENCE.md skeleton with six-candidate table`) |
| `NOTION_DEBUG_DIAGNOSTICS` set to `1` at capture time? | Yes — proven behaviourally: the authenticated route call returned a diagnostic payload, which is unreachable unless the gate is open |
| Failing post's Notion page id | Three captured: `3702c61e-4a24-8001-a9a6-c4ff3aadadb5`, `36e2c61e-4a24-8048-b7be-c6765c807e23`, `6b42c61e-4a24-82b0-ae11-01fdb5e7110f`. Operator reports this is **every post whose Notion `status` property is `public`** — i.e. all of them |
| Production site URL | https://4lph4-bl0g.vercel.app |

> **Secret rotation note.** `NOTION_DEBUG_ROUTE_SECRET` was generated, set, and then not retained by the
> operator (Vercel does not display a saved value). It was overwritten with a fresh value and Production
> redeployed before step 5. Same commit SHA throughout; only the env value changed. Recorded because the
> gate-closed checks at 16:43 ran against the pre-rotation value and the authenticated call at 16:49 ran
> against the post-rotation one — both are valid observations of the same deployed code.

> **Phase 9 dependency.** Every deploy in this capture invalidates the entire ISR cache. Phase 9
> (IMG-01) needs an uninterrupted idle window longer than Notion's ~1h presigned-URL lifetime.
> **Phase 9's idle window must be measured from the closeout redeploy timestamp recorded in the
> Closeout section below**, not from any earlier deploy.

---

## Operator Checklist (D-10)

| Question | How it was checked | Answer | Observed at |
|----------|--------------------|--------|-------------|
| Is `NOTION_TOKEN_V2` set for the **Production** environment? | Operator read Vercel Dashboard → Settings → Environment Variables, filtered to Production | **Absent.** `NOTION_TOKEN` exists; `NOTION_TOKEN_V2` does not exist at all | 2026-08-10, during capture |
| Does the failing Notion page load in a **logged-out incognito** browser tab? | **Not performed as a browser session.** Superseded by a stronger observation: a fully unauthenticated `POST https://www.notion.so/api/v3/loadPageChunk` carrying a browser `User-Agent` returned **HTTP 200 with a complete `recordMap`** for page `3702c61e-…`. No session, no cookie — strictly less access than an incognito tab has | **Yes — the page is publicly shared.** A non-public page cannot return a `recordMap` to an unauthenticated caller | 2026-08-10 16:5x UTC |
| When did the failure start, relative to this project's Vercel deployment history? | **Not determined.** Reason recorded rather than left blank: the controlled User-Agent experiment (below) identified the cause deterministically from a single variable, so the onset-vs-deploy correlation — whose only job was to discriminate candidate 6 from candidates 1–2 — was no longer load-bearing. Candidate 6 is eliminated on direct evidence instead | Not determined (reason above) | — |

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

Operator ran the authenticated call against Production for all three page ids at 2026-08-10 16:49 UTC.
Pasted verbatim from the terminal; the `Authorization` header was never included in what was pasted.

```
--- 3702c61e-4a24-8001-a9a6-c4ff3aadadb5
{"ok":false,"code":"record_map_failed","diagnostic":"{\"name\":\"FetchError\",\"message\":\"[POST] \\\"https://www.notion.so/api/v3/loadPageChunk\\\": 403 Forbidden\",\"pageIdShape\":\"dashed-uuid\",\"pageIdLength\":36,\"status\":403,\"contentType\":\"text/html; charset=UTF-8\",\"bodyExcerpt\":\"<!DOCTYPE html>\\n<!--[if lt IE 7]> <html class=\\\"no-js ie6 oldie\\\" lang=\\\"en-US\\\"> <![endif]-->\\n<!--[if IE 7]>    <html class=\\\"no-js ie7 oldie\\\" lang=\\\"en-US\\\"> <![endif]-->\\n<!--[if IE 8]>    <html class=\\\"no-\",\"viaProbe\":false}"}
--- 36e2c61e-4a24-8048-b7be-c6765c807e23
{"ok":false,"code":"record_map_failed","diagnostic":"{\"name\":\"FetchError\",\"message\":\"[POST] \\\"https://www.notion.so/api/v3/loadPageChunk\\\": 403 Forbidden\",\"pageIdShape\":\"dashed-uuid\",\"pageIdLength\":36,\"status\":403,\"contentType\":\"text/html; charset=UTF-8\",\"bodyExcerpt\":\"<!DOCTYPE html>\\n<!--[if lt IE 7]> <html class=\\\"no-js ie6 oldie\\\" lang=\\\"en-US\\\"> <![endif]-->\\n<!--[if IE 7]>    <html class=\\\"no-js ie7 oldie\\\" lang=\\\"en-US\\\"> <![endif]-->\\n<!--[if IE 8]>    <html class=\\\"no-\",\"viaProbe\":false}"}
--- 6b42c61e-4a24-82b0-ae11-01fdb5e7110f
{"ok":false,"code":"record_map_failed","diagnostic":"{\"name\":\"FetchError\",\"message\":\"[POST] \\\"https://www.notion.so/api/v3/loadPageChunk\\\": 403 Forbidden\",\"pageIdShape\":\"dashed-uuid\",\"pageIdLength\":36,\"status\":403,\"contentType\":\"text/html; charset=UTF-8\",\"bodyExcerpt\":\"<!DOCTYPE html>\\n<!--[if lt IE 7]> <html class=\\\"no-js ie6 oldie\\\" lang=\\\"en-US\\\"> <![endif]-->\\n<!--[if IE 8]>    <html class=\\\"no-\",\"viaProbe\":false}"}
```

All three are byte-identical apart from the id. `viaProbe: false` means the status, content-type and body
excerpt came off the thrown `FetchError` itself — the D-04 raw-fetch probe was never needed.

### Controlled discriminating experiment — the single-variable test (2026-08-10 ~16:5x UTC)

The production payload above establishes *what* the failure is. This experiment establishes *what triggers
it*. Run from one developer machine — **one host, one egress IP** — against the same endpoint, same POST
body, same page id. **The only variable is the `User-Agent` header.**

```
1) curl 기본 UA (curl/8.x)          status=200  ctype=application/json; charset=utf-8
   {"cursor":{"stack":[]},"recordMap":{"__version__":3,"block":{"3702c61e-4a24-8001-a9a6-c4ff

2) user-agent: node                 status=403  ctype=text/html; charset=UTF-8
   <!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US"> <![endif]-->

3) 브라우저 UA (Chrome/131 on macOS) status=200  ctype=application/json; charset=utf-8
   {"cursor":{"stack":[]},"recordMap":{"__version__":3,"block":{"3702c61e-4a24-8001-a9a6-c4ff
```

Because the IP is constant across all three, **egress IP cannot be the trigger**. `user-agent: node` is
what `notion-client` produces by default: it sets no `User-Agent` of its own (07-RESEARCH.md, read from
`node_modules`), so Node's built-in `fetch` supplies `node`. Row 2 of the 403 body is byte-compatible with
the production `bodyExcerpt` above.

### Unauthorised requests (gate-closed check) — 2026-08-10 16:43 UTC

| Request | HTTP status | Body |
|---------|-------------|------|
| No `Authorization` header | **404** | empty — `bytes=0` |
| Wrong bearer token (`Bearer deliberately-wrong-token-0000`) | **404** | empty — `bytes=0` |

Both are indistinguishable from each other and from a non-existent route (404, never 401), which is the
intended posture. Vercel's own request log independently corroborates that the rejection happens before any
network call: both 404 entries record **`External APIs: No outgoing requests`**, while every authorised call
records `POST www.notion.so/api/v3/loadPageChunk`.

### Vercel Production request log (dashboard, Environment = production)

Pasted from the dashboard. These are **request-level** entries, not console output — see the note below.

```
# GET /api/diagnose-page          Status: 404   Started: Aug 10 01:43:04.44 GMT+9
  User Agent: curl/8.14.1   Search Params: id=3702c61e-4a24-8001-a9a6-c4ff3aadadb5
  Function Invocation: /api/diagnose-page   External APIs: No outgoing requests
  Deployment ID: dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz   Environment: production   Branch: main

# GET /api/diagnose-page          Status: 404   Started: Aug 10 01:43:05.41 GMT+9
  External APIs: No outgoing requests
  Deployment ID: dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz   Environment: production

# GET /api/diagnose-page          Status: 200   Started: Aug 10 01:49:25.62 GMT+9
  Search Params: id=3702c61e-4a24-8001-a9a6-c4ff3aadadb5
  External APIs: | POST | Button: www.notion.so/api/v3/loadPageChunk |
  Execution Duration: 570ms   Deployment ID: dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz   Environment: production

# GET /api/diagnose-page          Status: 200   Started: Aug 10 01:49:26.63 GMT+9
  Search Params: id=36e2c61e-4a24-8048-b7be-c6765c807e23
  External APIs: | POST | Button: www.notion.so/api/v3/loadPageChunk |

# GET /api/diagnose-page          Status: 200   Started: Aug 10 01:49:26.93 GMT+9
  Search Params: id=6b42c61e-4a24-82b0-ae11-01fdb5e7110f
  External APIs: | POST | Button: www.notion.so/api/v3/loadPageChunk |

# GET /post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5   Status: 200   Started: Aug 10 01:51:23.27 GMT+9
  User Agent: curl/8.14.1   Search Params: cb=1
  External APIs:
    | GET  | Using cache api.notion.com/v1/databases/3532c61e4a248000aac4f0bee1bbfb68/query |
    | GET  | Using cache api.notion.com/v1/pages/3702c61e-4a24-8001-a9a6-c4ff3aadadb5 |
    | GET  | Button: api.notion.com/v1/pages/3702c61e-4a24-8001-a9a6-c4ff3aadadb5 |
    | POST | Button: www.notion.so/api/v3/loadPageChunk |
    | POST | Button: api.notion.com/v1/databases/3532c61e4a248000aac4f0bee1bbfb68/query |
    | SET  | Updating Data Cache |
    | SET  | Updating Data Cache |
  Execution Duration: 742ms   Deployment ID: dpl_DQWk6fxhJDQfUAHA9bTPMcAZ9bMz   Environment: production

# GET /post/3702c61e-… (cb=2 … cb=5)   Status: 200   01:51:24.11 – 01:51:25.94 GMT+9
  External APIs: official-API calls all `Using cache`; | POST | Button: www.notion.so/api/v3/loadPageChunk | on every one
```

**What this corroborates independently of the route's own response body:**

- The 404s record `External APIs: No outgoing requests` — the double gate rejects **before** any network
  call is made (T-07-03's SSRF mitigation, observed on the live platform rather than inferred from source).
- Every post render calls `www.notion.so/api/v3/loadPageChunk` while the official `api.notion.com` calls are
  served from cache. **The failing leg is isolated to the unofficial client**, on the live system.
- All entries carry `Environment: production` — satisfying D-09.

### Vercel Production **console** output — `[DiagnosePage]` / `[PostPage:recordMap]` / `[PostPage:chrome]` / `[PostPage:post]`

Pasted verbatim from Vercel Dashboard → Logs, Environment = production. Timestamps are UTC.
Repetitive identical lines are elided with an explicit count; no line is paraphrased.

```
2026-08-09 16:51:26.102 [error] [PostPage:recordMap] {"name":"FetchError","message":"[POST] \"https://www.notion.so/api/v3/loadPageChunk\": 403 Forbidden","pageIdShape":"dashed-uuid","pageIdLength":36,"status":403,"contentType":"text/html; charset=UTF-8","bodyExcerpt":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-","viaProbe":false}

  … 5 further byte-identical [PostPage:recordMap] lines at
    16:51:25.767, 16:51:25.255, 16:51:24.762, 16:51:24.254, 16:51:23.698
    (6 lines total, one per production render of /post/3702c61e-…)

2026-08-09 16:49:27.094 [error] [DiagnosePage] {"name":"FetchError","message":"[POST] \"https://www.notion.so/api/v3/loadPageChunk\": 403 Forbidden","pageIdShape":"dashed-uuid","pageIdLength":36,"status":403,"contentType":"text/html; charset=UTF-8","bodyExcerpt":"<!DOCTYPE html>\n<!--[if lt IE 7]> <html class=\"no-js ie6 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 7]>    <html class=\"no-js ie7 oldie\" lang=\"en-US\"> <![endif]-->\n<!--[if IE 8]>    <html class=\"no-","viaProbe":false}

  … 2 further byte-identical [DiagnosePage] lines at 16:49:26.767 and 16:49:26.464
    (3 lines total, one per authenticated debug-route call)

2026-08-09 16:43:05.253 [error] [DiagnosePage] Route called while diagnostics are off, unconfigured, or unauthorized. Further occurrences in this instance are not logged.
```

**`[PostPage:chrome]` — no matches in the retention window.**
**`[PostPage:post]` — no matches in the retention window.**

**This block closes ROADMAP SC#1's live half, and it does so in the exact shape SC#1 demands.** A real
failing request on the deployed site produced a production log line naming **one** of the three fetches —
`[PostPage:recordMap]` — and the operator can point at exactly that one. The other two legs are absent, not
merged: `[PostPage:chrome]` and `[PostPage:post]` produced nothing, because those legs did not fail. Before
this phase, all three shared the single line `"[PostPage] Failed to fetch page recordMap or categories:"`
and no such distinction was possible.

**Two behaviours confirmed live that were only structural before:**

- **The gate-rejection latch works.** The 16:43 line appears **once** for the **two** unauthorised requests
  recorded in the request log at 16:43:04.44 and 16:43:05.41. That is `gateRejectionLogged`, the
  module-scope one-shot latch, bounding log volume exactly as designed — and the 404 response contract was
  identical for both, since the latch wraps only the log, not the return.
- **`viaProbe: false` on every diagnostic.** The status, content-type and body excerpt all came off the
  thrown `FetchError` itself. D-04's raw-fetch fallback probe was implemented, deployed, and never needed —
  it cost one extra Notion request on exactly zero occasions.

---

## Repeated-Load Observations (PITFALLS 15)

A single successful load proves nothing: the ISR cache may be warm, or the cause intermittent. Five
loads spread across several minutes, cold browser cache, against the Production `/post/<id>` URL.

| Attempt | Time | URL | What rendered | Notes |
|---------|------|-----|---------------|-------|
| 1 | 16:51:23Z | `/post/3702c61e-…?cb=1` | `Content could not be loaded.` fallback | HTTP 200. Vercel log: 742ms, `SET Updating Data Cache` ×2 — this request populated the cache |
| 2 | 16:51:24Z | `/post/3702c61e-…?cb=2` | `Content could not be loaded.` fallback | HTTP 200. Official-API calls now `Using cache` |
| 3 | 16:51:24Z | `/post/3702c61e-…?cb=3` | `Content could not be loaded.` fallback | HTTP 200 |
| 4 | 16:51:25Z | `/post/3702c61e-…?cb=4` | `Content could not be loaded.` fallback | HTTP 200 |
| 5 | 16:51:25Z | `/post/3702c61e-…?cb=5` | `Content could not be loaded.` fallback | HTTP 200 |

**Deviation from PITFALLS 15, recorded rather than hidden:** these five loads span ~2 seconds, not "several
minutes". The spread exists to catch (a) a warm ISR cache masking a fix and (b) an intermittent cause. Both
are addressed here by stronger evidence than time-spread would give: attempt 1's log shows `SET Updating
Data Cache`, i.e. it was a genuine regeneration, not a cache read; and the controlled single-variable
experiment above reproduces the failure deterministically on demand, which settles intermittency directly.
A cache-busting `?cb=N` param was used on every attempt.

**What was and was not observed**

- **No 404 and no `PostUnavailable` card appeared.** This is correct, not a gap: `getPost()` (official API)
  succeeded on every request — the page `<title>` rendered as `만년필을 선물 하는 것` — so the `!post`
  branch that `classifyMissingPost` guards was never entered. **SC#4's live half is therefore
  unexercised, not failed.** It cannot be exercised without inducing an official-API failure, which this
  capture deliberately did not do.
- **SC#3's live half is likewise unexercised:** the chrome leg (`getCategories` / related-posts `getPosts`)
  did not fail during the window — the Vercel log shows those official-API calls served from cache — so no
  `[PostPage:chrome]` line was produced. The body-survives-chrome-failure behaviour remains verified
  structurally (code review, plans 07-01/07-02) but not live.
- **The reported symptom is reproduced exactly:** every public post renders its title and metadata and then
  the `Content could not be loaded.` fallback in place of its body.

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
| Notion/Cloudflare blocking Vercel's rotating serverless egress IPs | Works locally, fails only in prod; error is a 403 or an HTML "challenge" page instead of JSON | Add a temporary debug log of the raw response `status` + first 200 chars of body inside `getPageRecordMap()`'s catch (currently there is none — the failure is swallowed silently in `post/[id]/page.tsx`'s combined catch). A non-JSON body or `text/html` response body containing a challenge/Cloudflare marker is diagnostic; a clean `401`/`404` JSON body is not this. | **The Cloudflare half is confirmed; the egress-IP half is refuted.** The production body is `text/html; charset=UTF-8` opening `<!DOCTYPE html>` + the `<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US">` conditional-comment block — Cloudflare error-page boilerplate, not a Notion JSON error. But the trigger is not the IP: the controlled experiment ran three requests from **one non-Vercel host on one IP**, varying only the `User-Agent`, and got 200 / 403 / 200. A constant IP that both succeeds and fails cannot be the discriminating variable. 07-01's local tracer independently reproduced the same 403 from that same non-Vercel IP. | **eliminated** *(as stated — "blocking Vercel's rotating egress IPs". The blocker is Cloudflare, but keyed on request headers, not on origin IP — that is row 2.)* |
| `fetch` / runtime differences under Next 16 (edge vs nodejs runtime, missing User-Agent, following/not-following redirects) | Consistent failure across both environments once headers differ, or works in one Next.js runtime and not the other | Confirm which runtime the route/page is executing in (`export const runtime = "nodejs"` vs default/edge) and whether `notion-client` requires Node-only APIs; a runtime mismatch would surface as an import/require error, not a network error — check the actual thrown error's `name`/message, not just "it failed." | **The `missing User-Agent` clause of this row is the cause.** `notion-client` sets no `User-Agent` of its own (07-RESEARCH.md, read directly from `node_modules`), so Node's built-in `fetch` supplies its default `user-agent: node`. Single-variable experiment, one host, one IP, same POST body, same page id: `curl/8.x` → **200 `application/json`** with a full `recordMap`; `node` → **403 `text/html`** Cloudflare page; a Chrome UA → **200 `application/json`**. The 403 arm is byte-compatible with the production `bodyExcerpt`. The other clauses of this row are separately excluded: the route declares `export const runtime = "nodejs"`, and the thrown value is `name: "FetchError"` with an HTTP status — a network-layer rejection, not the import/require error a runtime mismatch would produce. | **confirmed** |
| Page ID format (dashed UUID vs compact) | `getPage()` throws immediately on a malformed ID, before any network call | `notion-client`'s `get_page`-equivalent accepts both dashed and 32-char compact formats per its own docs (LOW confidence, single source) — unlikely root cause on its own, but verify by logging the exact `id` value passed into `getPageRecordMap(id)` and confirming it matches one of the two accepted shapes. | All three production diagnostics report `"pageIdShape":"dashed-uuid","pageIdLength":36` — an accepted form, logged by the shipped instrumentation exactly as this discriminator prescribes. Decisive corroboration: **the identical id string returns HTTP 200 with a full `recordMap`** when only the `User-Agent` changes. An id that is malformed cannot succeed on any header. | **eliminated** |
| Database row vs "shared page" distinction, and whether a page inside a database inherits the parent's public sharing | Some posts render, others don't; or all fail identically | Sharing inherits from a shared parent (database) down to child pages UNLESS a specific row's Share settings were narrowed ("Access Restricted") — Notion explicitly supports overriding a single row to NOT inherit (MEDIUM confidence). Discriminator: open the exact failing page's URL directly in an **incognito/logged-out** browser tab (not the operator's authenticated session, which can see restricted pages regardless) — if it 404s or prompts to request access there, that row's sharing was overridden; if it loads fine logged-out, sharing is not the cause. | Two independent observations. (1) **Symptom shape:** all three ids fail *identically* — byte-identical payloads apart from the id — and the operator reports every post with Notion `status = public` is affected. This is the "all fail identically" arm, not the "some render, others don't" arm that a per-row override produces. (2) **Direct access test:** a fully unauthenticated request carrying a browser UA returned **HTTP 200 with a complete `recordMap`** for `3702c61e-…`. That is strictly less access than the prescribed incognito tab has, and a page with narrowed sharing cannot serve a `recordMap` to a caller with no session at all. | **eliminated** |
| `NOTION_TOKEN_V2` cookie expiry | Works, then stops working after some time, correlating with a Notion session/password change | This repo's `notion-x.ts` currently passes `process.env.NOTION_TOKEN_V2 \|\| undefined` — i.e. unauthenticated unless that var is explicitly set. Discriminator: run `vercel env ls` and check whether `NOTION_TOKEN_V2` is actually set in the Production environment. If it is NOT set (matching local `.env` also unset), cookie expiry is structurally impossible as the cause — the client is running unauthenticated end-to-end and the failure must be sharing state or IP blocking, not a stale cookie. If it IS set, diff it against a freshly captured cookie and check for staleness. | Operator read Vercel → Settings → Environment Variables with the Production filter: `NOTION_TOKEN` exists, **`NOTION_TOKEN_V2` does not exist at all.** `apps/web/src/lib/notion-x.ts` passes `process.env.NOTION_TOKEN_V2 \|\| undefined`, so the client runs unauthenticated end-to-end and there is no cookie that could go stale. This is the discriminator's own "structurally impossible" branch, reached on an operator observation rather than an inference. | **eliminated** |
| Notion-side 2025–2026 changes to the unofficial endpoint | Failure started at a specific point in time uncorrelated with any deploy in this repo | Check whether the failure predates or postdates a Vercel deploy — if it started with no corresponding commit, it's more likely Notion/infra-side; correlate against Vercel's deployment history and any incident reports. | **The endpoint itself is alive and unchanged in shape.** `POST https://www.notion.so/api/v3/loadPageChunk` returned **HTTP 200 with a well-formed `{"cursor":…,"recordMap":{"__version__":3,…}}`** twice during this capture, using the request body `notion-client` builds. An endpoint that was withdrawn, moved, or had its contract changed cannot do that. The onset-vs-deploy correlation was not gathered (Operator Checklist row 3) — but it was only ever needed to *reach* this conclusion indirectly, and the direct observation supersedes it. | **eliminated** *(as stated — "the unofficial endpoint changed". See the adjacent-reading note below, which is NOT eliminated.)* |

> **Note on the `NOTION_TOKEN_V2` row's discriminator.** PITFALLS.md names `vercel env ls` because that
> was the research-time assumption. Per D-10 the equivalent dashboard check (Settings → Environment
> Variables, Production filter) is used instead — the *observation* is identical (presence/absence),
> only the instrument differs. The discriminator text above is left unedited on purpose.

> **Adjacent reading that row 6's elimination does NOT cover — read this before concluding "nothing
> changed upstream".** Row 6 is eliminated only in its literal sense: the `loadPageChunk` endpoint was not
> withdrawn and its contract was not changed. What *did* change, at an unknown date, is upstream bot
> filtering: Cloudflare now answers `user-agent: node` with a 403 challenge page in front of an endpoint
> that still works normally for a browser-shaped request. That is a **policy** change on Notion's edge, not
> an endpoint change, and it is precisely what makes row 2's long-standing condition (`notion-client` sends
> no `User-Agent`) newly fatal. The code did not change; the environment around it did. Recorded explicitly
> so a later reader does not mistake six eliminations plus one confirmation for "this was always broken".

---

## Verdict

**Named candidate — row 2: `fetch` / runtime differences under Next 16, specifically the missing `User-Agent`.**
One row `confirmed`, five `eliminated`, none `inconclusive`.

**The mechanism, stated so Phase 8 can act on it without re-deriving anything.** `notion-client` sets no
`User-Agent` header. Node's built-in `fetch` therefore sends its default, `user-agent: node`. Cloudflare,
sitting in front of `www.notion.so/api/v3/loadPageChunk`, answers that user-agent with **HTTP 403 and an
HTML challenge/error page** instead of JSON. `ofetch` raises a `FetchError`, `getPageRecordMap` rethrows,
and `post/[id]/page.tsx`'s content-leg catch nulls `recordMap` — so every public post renders its title and
metadata (official API, unaffected) followed by the `Content could not be loaded.` fallback in place of its
body. This is the reported symptom, end to end.

**The observation that confirms it, and why it is decisive.** Three requests from one host on one IP,
identical POST body and page id, varying only the `User-Agent`:

| `User-Agent` | Status | Content-Type | Result |
|---|---|---|---|
| `curl/8.14.1` | 200 | `application/json` | full `recordMap` returned |
| `node` | **403** | `text/html` | Cloudflare error page |
| `Mozilla/5.0 … Chrome/131 …` | 200 | `application/json` | full `recordMap` returned |

A single-variable experiment in which the constant (IP, body, id, endpoint, time) both succeeds and fails
isolates the variable. This is what eliminates the egress-IP framing of row 1 and, together with the
unauthenticated 200, rows 3 and 4 as well.

**Confidence: HIGH, and higher than the surrounding research.** `PROJECT.md` and `PITFALLS.md` both carried
the react-notion-x #710 / `User-Agent` idea at MEDIUM confidence as a *hypothesis*. It is no longer a
hypothesis: it is reproduced on demand, from the deployed system and from a controlled local experiment,
with the failing and passing arms differing by one header.

**What this verdict does not claim.** It does not claim that setting a browser `User-Agent` is a *sufficient*
or *durable* fix — only that it is the trigger. Whether `notion-client`'s public API exposes a way to set
the header without patching, and whether Cloudflare escalates to a JS challenge that a header alone cannot
satisfy, are Phase 8 questions listed in the hand-off below.

**D-18 compliance.** The catch decomposition shipped in plan 07-01 did **not** make the symptom disappear —
five repeated production loads all showed the fallback. So this section is not a formality here. Had the
symptom vanished, this verdict would still have been written from the captured diagnostics, and the
diagnostics did in fact capture the cause independently of whether any reader ever noticed the symptom.

---

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
| `NOTION_DEBUG_DIAGNOSTICS` removed from Production | ✅ yes | 2026-08-10 02:05 KST = **2026-08-09 17:05 UTC** |
| `NOTION_DEBUG_ROUTE_SECRET` removed from Production | ✅ yes | 2026-08-10 02:05 KST = **2026-08-09 17:05 UTC** |
| Production redeployed so running instances lost both vars | ✅ yes | 2026-08-10 02:13 KST = **2026-08-09 17:13 UTC** |

**T-07-13 fully mitigated.** Removing a variable in Vercel's dashboard only changes what the *next*
deployment receives — running instances keep the environment they booted with — so the removal at 17:05 UTC
left `/api/diagnose-page` reachable to a secret-holder until the redeploy landed at 17:13 UTC. Total window
in which the route existed at all: **~34 minutes** (16:39-ish first enabling deploy → 17:13 UTC teardown).
The secret was high-entropy, never committed, and is now un-retrievable and orphaned.

Post-teardown verification, 2026-08-09 ~17:1x UTC:

| Check | Result |
|---|---|
| `GET /` | 200 |
| `GET /api/diagnose-page?id=3702c61e-…` (unauthenticated) | 404, 0 bytes |
| `GET /post/3702c61e-…` | 200, page `<title>` renders, `Content could not be loaded.` fallback still shown |

The fallback persisting is expected and correct: this phase diagnoses, it does not fix. The fix is CONT-03,
Phase 8.

> **Phase 9 dependency — measure from here.** The >1h idle verification window Phase 9 (IMG-01) requires
> must be measured from **2026-08-09 17:13 UTC**, the closeout redeploy, not from the 17:05 UTC variable
> removal (ROADMAP parallelization caution). Any further deploy before Phase 9's check resets this clock.

---

## Hand-off to Phase 8

**Which requirements this informs.** **CONT-03** ("reader sees the post's Notion content rendered on first
visit") directly — its root cause is now named. **CONT-05** ("distinct wording for *no content yet* vs
*fetch failed*") is **not** informed by this verdict: it is a UX split that stands regardless of why the
fetch failed, and it stays Phase 8's own work. Do not let the cause's clarity collapse CONT-05 into it.

**Treat as established fact — do not re-derive.**

1. The failing call is `POST https://www.notion.so/api/v3/loadPageChunk`, made by `notion-client` from
   `getPageRecordMap`. The official `api.notion.com` calls are healthy and cache-served.
2. It fails with **403 + `text/html`**, a Cloudflare page — not a Notion JSON error.
3. The trigger is the **`User-Agent` header**, not the origin IP, not the page id, not sharing state, not a
   stale `NOTION_TOKEN_V2` (which is not set at all), and not a withdrawn endpoint.
4. `notion-client` sets no `User-Agent`; Node's `fetch` default `node` is what Cloudflare rejects.
5. The same endpoint returns a well-formed `recordMap` unauthenticated when the header looks like a browser.
6. All public posts are affected identically — this is systemic, not per-post.

**Still open — Phase 8 must settle these, and they are why this file does not prescribe a fix.**

- **Can the header be set through `notion-client`'s public API?** Check the `NotionAPI` constructor and
  request options in `node_modules/notion-client` before assuming a patch or a fetch wrapper is needed.
  D-01 keeps the library; D-07 forbids new dependencies — the fix must live inside both.
- **Is a static browser `User-Agent` durable?** If Cloudflare escalates from UA filtering to a JS challenge
  or TLS fingerprinting, a header alone stops working. Phase 8 should decide whether to ship the header fix
  alone or pair it with a graceful degradation path, and record that decision.
- **Is impersonating a browser UA appropriate here?** This is a judgement call for the operator, not a
  technical one — it touches Notion's terms and the project's posture toward an unofficial endpoint. Surface
  it; do not decide it silently.
- **Verification shape.** PITFALLS 15 still applies: after the fix, force a genuine ISR regeneration and
  repeat across several requests. Do not sign off on one lucky load shortly after deploy.

**Carried from this phase and NOT to be dropped.**

- **D-19 teardown** (`07-CONTEXT.md`): the diagnostic instrumentation added by this phase is temporary and
  must be removed — `NOTION_DEBUG_DIAGNOSTICS`, `NOTION_DEBUG_ROUTE_SECRET`, `api/diagnose-page/route.ts`,
  and `isDiagnosticsEnabled` / `describeFetchFailure` in `lib/notion-x.ts`. The operator's condition for
  accepting the instrumentation at all was that a forker ends up with **zero** net new env vars. Ship the
  teardown in the same pass as the fix so it costs one deploy, not two. The ungated leg-naming logs, the
  catch decomposition, `classifyMissingPost` and `PostUnavailable` all **stay** — they are requirements.
- **SC#3 and SC#4 live halves are unexercised, not failed.** Neither the chrome leg nor the official-API
  `getPost` failed during the capture window, so neither `[PostPage:chrome]` nor the `PostUnavailable` card
  was produced. Both remain verified structurally only. Phase 8 should say so plainly rather than inheriting
  them as "verified".

**Resolution of plan 07-03's flagged assumption on CONT-02 completeness.** The assumption asked whether a
**200-character** body excerpt is genuinely sufficient to discriminate all six candidates, or whether some
candidate needs evidence this instrumentation does not collect. **Answer: it was sufficient, with room to
spare.** The excerpt's first ~90 characters — `<!DOCTYPE html>` followed by the
`<!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US">` conditional comment — were already enough to
classify the response as a Cloudflare error page rather than a Notion API response, which is the single
discrimination the excerpt existed to make. The `contentType` field alone (`text/html` vs
`application/json`) carried most of that weight. D-03's choice of 200 over 1000 characters is vindicated.
The residual caveat is honest: sufficiency was demonstrated *for this failure*, and a different future
failure could need more. Nothing in this capture required an observation the instrumentation could not
collect — `viaProbe: false` throughout means even the D-04 fallback probe was never needed.
