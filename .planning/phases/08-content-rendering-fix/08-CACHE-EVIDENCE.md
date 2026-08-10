---
phase: 8
slug: content-rendering-fix
status: complete
captured_environment: production
deploy_commit: 5013b52
created: 2026-08-10
---

# Phase 8 — Per-Request Cache Evidence

Durable record for ROADMAP SC#1, against `PITFALLS.md` Pitfall 15. Observed values only.

**Recording rule (T-08-13).** Each row carries the single extracted `x-vercel-cache` value and two integer
grep counts. No header dump, no body excerpt, no token or cookie, no env var value — only names where a
variable must be referred to at all.

Site: `https://4lph4-bl0g.vercel.app` · deploy: `a6becd8..5013b52` pushed 2026-08-10 ~17:43 UTC.

Columns: `fail` = occurrences of `could not be loaded right now`; `empty` = occurrences of
`no content yet`. Both `0` means the Notion renderer was entered — the template's three-way branch emits
exactly one of the two sentences whenever it is not.

---

## Observations

| Request | UTC | Post id | HTTP | `x-vercel-cache` | fail | empty |
|---|---|---|---|---|---|---|
| Deploy-watch | 17:44:5x | 3702c61e-…adadb5 | 200 | (not captured) | 0 | 0 |
| **A** | 17:45:16 | 3702c61e-…adadb5 | 200 | `MISS` | 0 | 0 |
| **A** | 17:45:16 | 36e2c61e-…807e23 | 200 | `MISS` | 0 | 0 |
| **A** | 17:45:16 | 6b42c61e-…7110f | 200 | `MISS` | 0 | 0 |
| **B** | 17:49:08 | 3702c61e-…adadb5 | 200 | `MISS` | 0 | 0 |
| **B** | 17:49:08 | 36e2c61e-…807e23 | 200 | `MISS` | 0 | 0 |
| **B** | 17:49:08 | 6b42c61e-…7110f | 200 | `MISS` | 0 | 0 |
| Repeat 1 | 17:50:47 | 3702c61e-…adadb5 | 200 | `MISS` | 0 | 0 |
| Repeat 1 | 17:50:47 | 36e2c61e-…807e23 | 200 | `MISS` | 0 | 0 |
| Repeat 1 | 17:50:47 | 6b42c61e-…7110f | 200 | `MISS` | 0 | 0 |
| Repeat 2 | 17:54:13 | 3702c61e-…adadb5 | 200 | `MISS` | 0 | 0 |
| Repeat 2 | 17:54:13 | 36e2c61e-…807e23 | 200 | `MISS` | 0 | 0 |
| Repeat 2 | 17:54:13 | 6b42c61e-…7110f | 200 | `MISS` | 0 | 0 |

**A→B gap: 232 seconds** (17:45:16 → 17:49:08), untouched throughout — above the 180s `CONFIG.revalidate`
window the procedure required.

Titles observed on the Repeat 1 pass, confirming these are the real posts and not an error surface:
`만년필을 선물 하는 것`, `Antigravity 2.0 사용기`, `NoLog를 만들며`.

---

## The expected `STALE` → `HIT` never appeared, and why

Plan 08-04's `must_haves` asks for "a body observed on an `x-vercel-cache` HIT that followed a STALE".
**That sequence did not occur and could not have.** Recording the deviation rather than normalising it, per
this file's own observed-values-only rule.

Measured route characteristics:

| Route | `cache-control` | `x-vercel-cache` | Build classification |
|---|---|---|---|
| `/post/[id]` | `private, no-cache, no-store, max-age=0, must-revalidate` | `MISS` on every request | `ƒ (Dynamic)` |
| `/` (control) | `public, max-age=0, must-revalidate` | `PRERENDER` | `○` static, `Revalidate 3m / Expire 1y` |

`/post/[id]` is a fully dynamic route. There is no cached page to go `STALE`, so `B` returned `MISS` like
every other request. `08-RESEARCH.md` Finding 2 built the A/B/C procedure on the assumption that the post
route was ISR-cached the way the home page is; that assumption was wrong, and this is where it surfaced.

**What SC#1's guard is, and how it is met instead.** Pitfall 15's concern is that *a page cached from before
the fix keeps rendering regardless of whether anything was fixed*. On this route that failure mode is
impossible: every request is a fresh server render, and the fixed call itself — `getPageRecordMap` via
`notion-client`'s `ofetch` — is absent from Next's Data Cache, so it cannot be served from cache either.
Every row above is therefore a **live `loadPageChunk` call to Notion with the shipped User-Agent**, not a
cache read. That is a stronger guarantee than a single `HIT`-after-`STALE` would have given.

**What is therefore not claimed.** Nothing about ISR regeneration behaviour on `/post/[id]`. SC#1's literal
wording is unsatisfiable for this route, and it is recorded as met-in-substance with the mechanism named —
not marked passed against a sequence nobody observed.

The intermittency half of the guard is covered separately: three posts × four passes spanning **~9 minutes**,
every row identical.

---

## Post-deploy teardown confirmation (D-19)

| Check | Observed |
|---|---|
| `GET /api/diagnose-page?id=…`, no auth | HTTP **404** |
| `GET /api/diagnose-page?id=…`, `Authorization: Bearer …` | HTTP **404** |
| Response shape | The site's own 404 page, **not** the bare empty 404 the gated route used to emit |

The change in response *shape* is the load-bearing part. While the route existed it answered
`new Response(null, { status: 404 })` — an empty body — for every unauthorised shape. It now returns the
application's not-found page, which is what a genuinely absent route produces. The route is gone, not merely
gated shut.

Home feed regression check: 3 public posts listed; the Phase 8 UAT fixture page (`3b82c61e…`), deleted from
Notion by the operator, is absent.

---

## Still outstanding

**Production environment variable list — not captured.** Plan 08-04 Task 2 asks for the Production env var
**names** as positive proof of D-19's "zero net new forker-facing env vars". That reading is only available
from the Vercel dashboard and has not been taken. The negative evidence exists (the route 404s; nothing in
the source reads `NOTION_DEBUG_DIAGNOSTICS` or `NOTION_DEBUG_ROUTE_SECRET`; the operator recorded removing
both at 2026-08-09 17:05 UTC with a closeout redeploy at 17:13 UTC in `07-EVIDENCE.md`), but the affirmative
dashboard listing is not in hand and is **not** claimed here.
