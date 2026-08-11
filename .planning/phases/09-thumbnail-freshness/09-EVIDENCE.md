---
phase: 9
slug: thumbnail-freshness
status: in-progress
---

# Phase 9 — Verification Evidence

> Plan 09-01 fills the Tier 1 section below. Plans 09-02 and 09-03 append their own tiers to this same
> file, in wave order, so the document reads as the phase's verification record from cheapest evidence
> to most expensive.

## Tier 1 — source assertions

- **Phase:** 9 — thumbnail-freshness
- **Commit range asserted:** `origin/main..HEAD` = `8ee2ccb..22de486`
- **Date:** 2026-08-11

Every row below pastes the literal output of the command in the plan's `<verify>` block for task 3,
run against the commit range above.

| # | Assertion | Decision protected | Command | Expected | Observed | Pass/Fail |
|---|-----------|--------------------|---------|----------|----------|-----------|
| 1 | `packages/` carries zero changes in this phase's range | REQUIREMENTS.md D-05 | `git diff --name-only origin/main..HEAD -- packages/ \| wc -l` | 0 | `0` | PASS |
| 2 | `apps/web/src/templates/terminal/` carries zero changes | D-03 | `git diff --name-only origin/main..HEAD -- apps/web/src/templates/terminal/ \| wc -l` | 0 | `0` | PASS |
| 3 | `apps/web/src/app/api/notify-subscribers/` carries zero changes | D-04 | `git diff --name-only origin/main..HEAD -- apps/web/src/app/api/notify-subscribers/ \| wc -l` | 0 | `0` | PASS |
| 4 | `apps/web/package.json` and the lockfile carry zero changes | REQUIREMENTS.md D-07 | `git diff --name-only origin/main..HEAD -- apps/web/package.json package-lock.json \| wc -l` | 0 | `0` | PASS |
| 5 | `apps/web/next.config.ts` carries zero changes | Same-origin src needs no `remotePatterns` entry (09-RESEARCH.md Item 2) | `git diff --name-only origin/main..HEAD -- apps/web/next.config.ts \| wc -l` | 0 | `0` | PASS |
| 6a | `apps/web/src/lib/notion.ts` carries zero changes | D-14 landmine gate, stated three ways | `git diff --name-only origin/main..HEAD -- apps/web/src/lib/notion.ts \| wc -l` | 0 | `0` | PASS |
| 6b | The route file contains a no-store fetch option | D-14 landmine gate | `grep -c 'no-store' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | >=1 | `2` | PASS |
| 6c | The route file constructs exactly one client | D-14 landmine gate | `grep -c 'new NologClient' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 1 | `1` | PASS |
| 6d | The route file imports nothing from the shared cached client module | D-14 landmine gate | `grep -F -c 'from "@/lib/notion"' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 0 | `0` | PASS |
| 7 | The local `Post` type declares `thumbnailType` | Landmine 2 gate | `grep -c 'thumbnailType' apps/web/src/types/index.ts` | >=1 | `1` | PASS |
| 7b | The production build exits 0 | Landmine 2 gate | `npm run build --workspace=apps/web` | exit 0 | exit 0 (see Task 1/2 build logs, this plan's execution) | PASS |
| 8a | The route reads no query parameter | IMG-03, D-07 | `grep -c 'searchParams' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 0 | `0` | PASS |
| 8b | The route holds exactly two allowlisted hostnames | IMG-03 | `grep -oE '[a-z0-9.-]+\.amazonaws\.com' 'apps/web/src/app/api/thumbnail/[id]/route.ts' \| sort -u \| wc -l` | 2 | `2` | PASS |
| 8c | The route sets `redirect: "error"` on its outbound fetch | IMG-03, D-05 | `grep -F -c 'redirect: "error"' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | >=1 | `1` | PASS |
| 8d | The route asserts content type begins `image/` | IMG-03 | `grep -c 'image/' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | >=1 | `1` | PASS |
| 8e | The route streams the upstream body without buffering | D-05 | `grep -F -c 'new Response(upstream.body' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 1 | `1` | PASS |
| 8f | The response carries the locked cache header | D-06 | `grep -c 's-maxage=14400' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 1 (and same line contains `immutable`) | `1`, `public, s-maxage=14400, immutable` | PASS |
| 9 | Full source diff for this phase is exactly the seven expected paths | Scope discipline | `git diff --name-only origin/main..HEAD -- apps packages \| sort` | 7 paths listed below | `apps/web/src/app/api/thumbnail/[id]/route.ts`, `apps/web/src/components/PostThumbnail.tsx`, `apps/web/src/templates/default/CategoryPage.tsx`, `apps/web/src/templates/default/HomePage.tsx`, `apps/web/src/templates/default/PostPage.tsx`, `apps/web/src/templates/default/SearchPage.tsx`, `apps/web/src/types/index.ts` | PASS |

**Additional Task 1 evidence, pasted from the same execution (not re-run for this table, already
produced during task 1's own `<verify>` step and confirmed identical against the same commit range):**

Local end-to-end smoke (`next start`, real Notion credentials, real page):

```
garbage-id  = 400
absent-uuid = 404
resolved-id = 3702c61e-4a24-8001-a9a6-c4ff3aadadb5
HTTP/1.1 200 OK
cache-control: public, s-maxage=14400, immutable
content-type: image/png
x-content-type-options: nosniff
```

`npm run lint --workspace=apps/web`: 14 errors / 4 warnings, all in `apps/web/src/components/Profile.tsx`,
`apps/web/src/components/notion/MermaidBlock.tsx`, and three files under
`apps/web/src/templates/terminal/` — none in any file this phase touched. Confirmed pre-existing on
`main` by stashing this phase's changes and re-running lint (same failure set, same file list). Matches
the STATE.md Phase 7 Plan 01 precedent: "no new errors from this plan's files" is the passing bar, since
`apps/web/src/templates/terminal/components/TerminalConsole.tsx` already fails lint on `main`.

`git diff --stat origin/main..HEAD -- apps/web/src/templates/default/`:

```
apps/web/src/templates/default/CategoryPage.tsx | 14 ++------------
apps/web/src/templates/default/HomePage.tsx     | 14 ++------------
apps/web/src/templates/default/PostPage.tsx     | 14 ++------------
apps/web/src/templates/default/SearchPage.tsx   | 14 ++------------
4 files changed, 8 insertions(+), 48 deletions(-)
```

A net line reduction — the four-surface consolidation reads as a de-duplication (D-01, D-02), not a
redesign.

**What Tier 1 does and does not establish.** Tier 1 proves the code has the shape the decisions
require: both landmines are closed, all five hard constraints (`packages/core`, `terminal`, the digest
route, dependencies, `next.config.ts`) are provably untouched against the commit range above, the route
holds all four IMG-03 guards and streams rather than buffers, and a real Notion page resolves through
the full path end-to-end on a cold local production server. Tier 1 proves nothing at all about whether
a reader sees a thumbnail after a genuine idle gap on the deployed site — that is Tier 3's job (plan
09-03) and cannot be brought forward.

---

## Tier 2 — deployed and controlled-origin checks

> Appended by plan 09-02. Tier 1 above is unmodified.

### IMG-03 guards

- **Date:** 2026-08-11
- **Where run:** local production server (`next start`, port 3009) against a throwaway loopback origin
  (port 3010). **Not** the deployed site — this subsection predates the deploy.
- **Method:** temporary fault injection, then a proven revert. A single guarded branch was added to
  `apps/web/src/app/api/thumbnail/[id]/route.ts` immediately before the outbound `fetch`, substituting
  `process.env.THUMBNAIL_TEST_ORIGIN` for the resolved thumbnail URL when that variable is a non-empty
  string. It was placed **after** the host-allowlist check on purpose, so the two guards under test are
  isolated from the host guard. Same fault-injection-then-revert discipline as `08-03-SUMMARY.md`.
- **Why this is needed at all:** `09-VALIDATION.md`'s Tier 2 table optimistically lists all four IMG-03
  guards as "a `curl` each." Three of the four cannot be exercised against real Notion assets, because
  doing so would require a Notion page whose thumbnail resolves to an off-allowlist host, an S3 object
  that answers with a redirect, or a Notion file property holding a non-image. This harness upgrades two
  of those three from source-assertion to **observed**.
- **The harness** (Node built-in `http`, bound to `127.0.0.1` only, never `0.0.0.0`; lived in the
  scratchpad, never in the repository; killed at end of task — confirmed 0 listeners on both ports):
  `/redirect` answers 302 with `Location: http://127.0.0.1:3010/html`; `/html` answers 200 with
  `content-type: text/html; charset=utf-8` and a 67-byte body containing the sentinel string
  `HARNESS-HTML-BODY`; `/image` answers 200 with `content-type: image/png` and 70 bytes of a real PNG.
  Direct probes of the harness itself confirmed `302 / 200 text/html 67 / 200 image/png 70` before any
  route probe was run, so the harness was known-good going in.
- **The post used:** the same real, currently-public post the local home page's HTML resolves to,
  id `3702c61e-4a24-8001-a9a6-c4ff3aadadb5`. Baseline with **no** override set:
  `status=200 ct=image/png size=1561628` — the route works normally, so each refusal below is the guard
  firing rather than a broken request.

| # | Probe | Override pointed at | Guard under test | Expected | Observed status | Observed body length | Harness HTML body leaked? | Pass/Fail |
|---|-------|---------------------|------------------|----------|-----------------|----------------------|---------------------------|-----------|
| T2-1 | redirect | `http://127.0.0.1:3010/redirect` (302 → `/html`) | `redirect: "error"` on the outbound fetch | non-200, empty body, hop not followed | `502` | `0` | no (`grep -c HARNESS-HTML-BODY` = `0`) | PASS |
| T2-2 | content type | `http://127.0.0.1:3010/html` (200 `text/html`, 67 bytes) | `contentType.startsWith("image/")` assertion | non-200, empty body, HTML never streamed | `502` | `0` | no (`grep -c HARNESS-HTML-BODY` = `0`) | PASS |
| T2-3 | image control | `http://127.0.0.1:3010/image` (200 `image/png`, 70 bytes) | none — proves the harness and the override are wired correctly | 200, `image/`, locked cache header | `200` | `70` | n/a | PASS |

Server-side log lines observed during T2-1 and T2-2 respectively, confirming which branch answered:

```
[Thumbnail] outbound fetch to resolved URL failed or redirected
[Thumbnail] upstream response was not an ok image response
```

Response headers observed on T2-3, the control:

```
HTTP/1.1 200 OK
cache-control: public, s-maxage=14400, immutable
content-type: image/png
x-content-type-options: nosniff
```

T2-3 is what makes T2-1 and T2-2 mean anything. The override reaches the same fetch call site in all
three probes; the only variable is what the controlled origin answers with. A 200 with the locked cache
header on the image path proves the plumbing was correct, so the two 502s above are the guards refusing
rather than a misconfigured harness refusing for it.

**The host-allowlist guard was NOT exercised.** It is source-asserted only. `09-01` task 3 established
by grep that the route file holds exactly the two hostnames `next.config.ts` allowlists and no third
(Tier 1 row 8b, observed `2`), and the check itself is a plain `ALLOWED_HOSTS.has(hostname)` refusal
before any outbound call. Exercising it would require a Notion page whose thumbnail property resolves
to a host outside that allowlist, which this project cannot construct: the host is chosen by Notion when
it presigns the file, not by the operator. This row is an assertion about the code's shape, not an
observation of the guard firing, and it must not be read as the latter.

**Guard scoreboard after this subsection:** id-parse guard — observed (Tier 1 local smoke, and again on
the deployed site in the next subsection). Redirect refusal — **observed** (T2-1). Content-type
assertion — **observed** (T2-2). Host allowlist — **source-asserted, unexercised**.

### Revert gate

The fault injection never reached a commit. Run after the override block was deleted and both servers
were killed:

| Gate | Command | Expected | Observed | Pass/Fail |
|------|---------|----------|----------|-----------|
| Working tree clean under `apps/web/src` | `git status --porcelain apps/web/src \| wc -l` | 0 | `0` | PASS |
| No residue of the test-origin literal | `grep -c 'THUMBNAIL_TEST_ORIGIN' 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | 0 | `0` | PASS |
| Route file byte-identical to its committed state | `git diff --exit-code -- 'apps/web/src/app/api/thumbnail/[id]/route.ts'` | exit 0 | exit 0 | PASS |
| Production build green after revert | `npm run build --workspace=apps/web` | exit 0 | exit 0 | PASS |
| Harness and local server both down | `ss -ltnp \| grep -c ':3010'` / `':3009'` | 0 / 0 | `0` / `0` | PASS |

`npm run lint --workspace=apps/web` exits **1**, not 0, with `✖ 18 problems (14 errors, 4 warnings)` in
`apps/web/src/components/Profile.tsx`, `apps/web/src/components/notion/MermaidBlock.tsx`,
`apps/web/src/templates/terminal/components/TerminalConsole.tsx`, `apps/web/src/templates/terminal/Layout.tsx`
and `apps/web/src/templates/terminal/PostPage.tsx`. **None** of those five files is among the seven this
phase touches. This is the identical pre-existing failure set Tier 1 already recorded and confirmed
present on `main` by stashing; the passing bar in this repo is "no new errors from this plan's files"
(STATE.md, Phase 7 Plan 01 precedent, adopted because `TerminalConsole.tsx` already fails lint on
`main`). Recorded as a deviation from this plan's literal "lint exits 0" wording rather than silently
counted as a pass.
