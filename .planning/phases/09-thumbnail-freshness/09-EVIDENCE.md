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

### Deployed route battery

- **Deploy identifier (deploy SHA): `9c3cc9c`** — `docs(09-02): record pre-deploy liveness baseline
  before blocked push`. Pushed `8ee2ccb..9c3cc9c` to `origin/main`; the combined source diff across all
  18 commits is exactly the seven phase-9 paths, every other commit being `.planning/` documentation.
- **Battery run at:** 2026-08-11T12:04:43Z (UTC). Deployment confirmed live at 2026-08-11T12:04:25Z.
- **Production URL:** `https://4lph4-bl0g.vercel.app`

> The push was initially refused by the execution environment's permission layer — not by any gate in
> this plan — and was then performed by the orchestrator after independently re-verifying all four
> pre-push gates. The pre-deploy baseline below was captured during that pause and is retained, because
> it is the control half of the liveness proof and cannot be recaptured now that the route has shipped.

**Pre-deploy baseline — captured 2026-08-11T11:58:53Z, before any push.** This is the half of the
liveness proof that cannot be recaptured later, which is why it is recorded even though the deploy is
blocked. Once the new route ships, the site can never again be observed in this state.

| Probe | Command | Observed status | Observed content type | Observed body length | Reading |
|-------|---------|-----------------|-----------------------|----------------------|---------|
| garbage id, **pre-deploy** | `curl -sD - -o /dev/null https://4lph4-bl0g.vercel.app/api/thumbnail/not-a-real-id` | `HTTP/2 404` | `text/html; charset=utf-8` | `40884` | The framework's 404 **page**, served from the CDN (`x-vercel-cache: HIT`). No route exists at this path on the deployed site yet. |

That row is the control for the liveness check. The shipped route answers a garbage id with `400` and an
**empty** body; the pre-deploy site answers `404` with a 40,884-byte HTML document. The two are trivially
distinguishable, so a post-deploy `400` cannot be confused with a stale deployment or a cached response.

**Liveness.** The first probe below is the proof that the push actually shipped. Compare against the
pre-deploy baseline row: the same URL answered `404` with 40,884 bytes of framework HTML before the
deploy and answers `400` with an empty body after it. A pre-deploy site structurally cannot produce a
`400` at this path, because no route existed there to produce one.

**The deployed battery.** Every request targets `/api/thumbnail/...` and nothing else. The real post id
used is `3702c61e-4a24-8001-a9a6-c4ff3aadadb5`, resolved from the **local** production server's
home-page HTML during task 1 rather than from the deployed site's — a deliberate departure from this
plan's own `<verify>` block, which curls `$S/`. The deployed `/` is not requested at all during task 2,
so nothing here warms the Data Cache or the prerendered HTML the idle window depends on. Both servers
read the same Notion database, and task 3 performs the deployed home-page HTML check anyway.

| # | Probe | Request | Expected | Observed status | Observed content type | Observed body length | Pass/Fail |
|---|-------|---------|----------|-----------------|-----------------------|----------------------|-----------|
| T2-4 | garbage id — **liveness** | `/api/thumbnail/not-a-real-id` | 400, empty | `400` | `[]` (none) | `0` | PASS |
| T2-5 | well-formed UUID naming no page | `/api/thumbnail/00000000-0000-0000-0000-000000000000` | 404, empty | `404` | `[]` (none) | `0` | PASS |
| T2-6 | URL-encoded absolute URL in the id position | `/api/thumbnail/https%3A%2F%2Fexample.com%2Fx.png` | 400 | `400` | `[]` (none) | `0` | PASS |
| T2-7 | a real public post's id | `/api/thumbnail/{id}` | 200, `image/`, non-zero | `200` | `image/png` | `1561628` | PASS |
| T2-8 | the same real id, `?url=…` appended | `/api/thumbnail/{id}?url=https://example.com/x.png` | identical to T2-7 | `200` | `image/png` | `1561628` | PASS |
| T2-9 | the same real id wrapped in non-word characters | `/api/thumbnail/foo.{id}.bar` | 200 — see note | `200` | `image/png` | `1561628` | PASS |

T2-8 matches T2-7 in all three fields exactly. That is the **positive** form of the no-caller-supplied-URL
claim (IMG-03, D-07): the route does not merely happen to ignore the parameter as an accident of parsing,
it produces an identical response with the parameter present. Combined with Tier 1 row 8a
(`grep -c 'searchParams'` = `0`), the query string provably has no path to the outbound fetch.

**Why T2-9's 200 is correct rather than a defect.** `parsePageId`'s regexes are word-boundary matched,
not anchored, so the identifier still parses out of the longer `foo.{id}.bar` segment. The 200 is itself
positive evidence that **only the parsed value** reaches the outbound URL — had the raw segment been used
to build the Notion request, Notion would have answered 404 and the route would have too. The identical
1,561,628-byte body across T2-7 and T2-9 confirms both resolved to the same underlying image.

Header dump observed on T2-7 and, identically, on T2-8:

```
HTTP/2 200
cache-control: public, immutable
content-type: image/png
x-content-type-options: nosniff
x-vercel-cache: HIT
```

#### Correction: the `s-maxage` directive is not observable on the deployed response (D-06)

This plan's acceptance criterion and the `must_haves` truth for D-06 both expect the literal header
`cache-control: public, s-maxage=14400, immutable` on the deployed site. **That is not what is served.**
The deployed response carries `cache-control: public, immutable` — `s-maxage=14400` is absent. Recording
that plainly rather than checking the box, per this phase's evidence-honesty rule.

The route is nevertheless behaving correctly, and the discrepancy is a documented platform behaviour
rather than a defect. Vercel's Edge Network consumes `s-maxage` as a directive addressed to itself and
does not forward it downstream. The full chain, each link independently observed rather than assumed:

| Link | How established | Observation |
|------|-----------------|-------------|
| The route's source sets the full header | Tier 1 row 8f, `grep -c 's-maxage=14400'` | `1`, on a line reading `public, s-maxage=14400, immutable` |
| The **origin** actually emits the full header | Task 1, local `next start` header dump (T2-3 and the no-override baseline) | literally `cache-control: public, s-maxage=14400, immutable` |
| The deployed client sees it stripped on a cache **HIT** | `curl -sD -` against production | `cache-control: public, immutable`, `x-vercel-cache: HIT` |
| …and stripped on a cache **MISS** too, so this is transit rewriting, not a cache artifact | two cache-busted requests, `?cb={nanoseconds}` | `cache-control: public, immutable`, `x-vercel-cache: MISS`, `age: 0` |
| The CDN demonstrably **stores** the response | re-requested one cache-busted URL after its MISS | `x-vercel-cache: HIT`, `age: 2` |

That last row is the load-bearing one. The CDN storing and re-serving the bytes requires a positive
shared-cache lifetime, and `s-maxage=14400` is the only directive in the response that supplies one —
`immutable` alone does not authorise a shared-cache duration, and no `max-age` is set. So the directive
was received and honoured by the CDN; it simply is not echoed to the client.

**What this means for D-06.** D-06's stated purpose is that "Vercel's CDN holds the bytes and the
function runs approximately once per image rather than once per request," which is what makes D-05's
byte-proxying affordable. That purpose is **satisfied and directly demonstrated** by the MISS→HIT
transition above. What is *not* satisfied is the literal header-text assertion in the `must_haves` truth,
which was written against the origin's output and is unobservable through Vercel's edge. The truth's
wording should be corrected to name the origin, not the deployed response — carried forward as a
documentation correction, not a code change.

### IMG-04 — the failure placeholder, observed in a real browser

- **Date:** 2026-08-11, against the deployed site at deploy SHA `9c3cc9c`.
- **Tool:** gstack `/browse` (headless Chromium), per this project's `CLAUDE.md`, which mandates it for
  all web browsing. Viewport 1280x900.
- **Status of these rows: agent-observed.** Screenshots were read back and looked at, and every size and
  colour below was additionally measured from the live DOM rather than eyeballed. These are not operator-
  pending rows.

**Method, and how it differs from the plan's.** The plan calls for a devtools request-blocking rule on
the image-optimizer path. `/browse` exposes no request-blocking command, and `Network.setBlockedURLs` is
not in its CDP allowlist (checked: the allowlist carries only `Network.getCookies`,
`getResponseBody`, `loadNetworkResource`, `replayXHR`). Substituted method: after load, every thumbnail
`<img>` had its `srcset` removed and its `src` repointed at `/api/thumbnail/not-a-real-id`, which the
deployed route answers `400` with an empty body. That produces a **genuine failed image request** against
the real route, so the browser fires a real `error` event and React's real `onError` handler runs. This
is arguably a closer match to IMG-04's wording ("a thumbnail whose image request fails") than blocking
would be, since the failure travels through the shipped route's own refusal path. Recorded as a
deviation because it is one, not because it weakens the result.

| # | Surface | Theme | What was measured | Expected (09-UI-SPEC.md) | Observed | Pass/Fail |
|---|---------|-------|-------------------|--------------------------|----------|-----------|
| T3-1 | Feed card | light | icon element + rendered box | `ImageOff`, `w-8 h-8` = 32px | `lucide lucide-image-off w-8 h-8 text-text-tertiary`, box `32x32` | PASS |
| T3-2 | Feed card | light | icon colour / wrapper background | `--text-tertiary` `#9b9a97` on `--surface` `#f7f6f3` | `rgb(155, 154, 151)` on `rgb(247, 246, 243)` | PASS |
| T3-3 | Feed card | dark | icon size, colour, wrapper | 32px, `--text-tertiary` `#6b6b6b` on `--surface` `#252525` | `32x32`, `rgb(107, 107, 107)` on `rgb(37, 37, 37)` | PASS |
| T3-4 | Post hero | dark | icon element + rendered box | `w-12 h-12` = 48px | `lucide lucide-image-off w-12 h-12 text-text-tertiary`, box `48x48` | PASS |
| T3-5 | Post hero | light | icon size + colours | 48px, `#9b9a97` on `#f7f6f3` | `48x48`, `rgb(155, 154, 151)` on `rgb(247, 246, 243)` | PASS |
| T3-6 | Both | both | the swap actually happened | `<img>` replaced, not overlaid | card wrappers: `svg=3, img=0`; hero: `svg=1, img=0`; combined remaining `<img>` in thumbnail wrappers = `0` | PASS |
| T3-7 | Both | both | no caption (D-09) | wrapper text content empty | card wrappers `["","",""]`, hero `""` | PASS |
| T3-8 | Both | both | no browser broken-image glyph | no `<img>` left to render one | `0` `<img>` inside any thumbnail wrapper — the glyph is structurally impossible | PASS |

The wrapper classes were confirmed unchanged from the contract, read off the live DOM:

```
card: relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface
hero: relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10
```

Both are byte-identical to the strings `09-UI-SPEC.md` locks, so the box is unchanged in size and
styling and only its contents were swapped — the "de-duplication, not a redesign" requirement holds at
the failure state too.

Theme toggling used the site's own existing control (the header button, accessible name
`Switch to dark mode` / `Switch to light mode`), not a synthetic class change, so the observation is of
the real theme mechanism. The placeholder survived the toggle in both directions (`svg` count unchanged,
`img` count still 0), confirming the failure state is React state and not a render-time artifact.

Screenshots retained in the run's scratchpad and read back during execution:
`img04-home-baseline.png`, `img04-home-light-placeholder.png`, `img04-home-dark-placeholder.png`,
`img04-hero-dark-placeholder.png`, `img04-hero-light-placeholder.png`.

**Two things this subsection deliberately does not conclude,** per the plan: a post with no thumbnail
configured at all still renders no box — a different, pre-existing condition that is not a placeholder
state and was not tested here. And the placeholder is identical whatever the underlying cause was; no
per-cause copy exists and none was looked for.

### IMG-05 — external-thumbnail bypass: UNEXERCISED

**The operator's live database contains no post whose thumbnail is an external URL.** The live half of
IMG-05 therefore could not be exercised, and this is recorded as a coverage gap rather than a pass.

Established from the served HTML of both pages:

| Check | Observed | Reading |
|-------|----------|---------|
| Distinct post ids referenced by a proxy path on the home feed | 3 | every public post routes through the proxy |
| `<img>` elements on either page whose `src` is an absolute off-site URL | `0` | no post renders an unproxied external thumbnail |
| Notion-hosted host seen in the page payload | `prod-files-secure.s3.us-west-2.amazonaws.com` only | all three thumbnails are `thumbnailType: "file"` |

All three public posts are Notion-hosted file thumbnails, so there is no external-thumbnail post to
load. IMG-05 consequently rests on two source assertions made in 09-01 and **not** on live observation:
the component's `post.thumbnailType === "external"` branch, which returns `post.thumbnail` unchanged and
never constructs a proxy path, and the route's own non-`"file"` refusal (`route.ts:74-76`, a 404 for any
thumbnail that is not a Notion file). Per the plan and this phase's honesty rule, the database was **not**
modified to manufacture the case — mutating production content to make a check pass is not evidence, and
it would have disturbed the data the idle window is about to measure.

### Served-HTML baseline capture (IMG-01 / IMG-02, structural half)

Captured 2026-08-11 from the deployed site at deploy SHA `9c3cc9c`, before the idle window opened.

| Counter | Home (`/`) | Post (`/post/{id}`) |
|---------|-----------|---------------------|
| proxy-path occurrences | `48` | `17` |
| `amazonaws.com` occurrences | `3` | `1` |
| `amazonaws.com` occurrences **inside an `<img>` src** | **`0`** | **`0`** |

Every thumbnail is served through the stable, post-id-keyed path. The complete set of distinct `<img>`
`src` values on the home feed, with the optimizer's sizing parameters trimmed:

```
/_next/image?url=%2Fapi%2Fthumbnail%2F36e2c61e-4a24-8048-b7be-c6765c807e23&w=…&q=…
/_next/image?url=%2Fapi%2Fthumbnail%2F3702c61e-4a24-8001-a9a6-c4ff3aadadb5&w=…&q=…
/_next/image?url=%2Fapi%2Fthumbnail%2F6b42c61e-4a24-82b0-ae11-01fdb5e7110f&w=…&q=…
/_next/image?url=%2Favatar.png&w=…&q=…
```

and on the post page, the hero plus the profile avatar:

```
/_next/image?url=%2Fapi%2Fthumbnail%2F3702c61e-4a24-8001-a9a6-c4ff3aadadb5&w=…&q=…
/_next/image?url=%2Favatar.png&w=…&q=…
```

**This is the substitution that IS IMG-01 and IMG-02's structural half.** Before the fix, each of those
`src` values was a presigned S3 URL carrying an expiry; after it, each is a stable path keyed on the post
id. What remains for 09-03 to answer is only whether the bytes still arrive after the idle gap — not
whether an expiring value is still what the browser is asked to fetch. It is not.

#### Finding: a presigned URL is still embedded in the RSC flight payload (must_haves truth needs correcting)

The `must_haves` truth for this plan reads: the served HTML "contains no Notion presigned S3 URL for any
Notion-hosted thumbnail — the expiring value is no longer embedded anywhere in cached markup." **As
literally worded, that is false, and it is recorded as false rather than quietly narrowed to the `<img>`
elements where it does hold.**

Three presigned URLs remain in the home page's markup and one in the post page's. Every one of them sits
inside a `self.__next_f.push([...])` script — the React Server Components flight payload — and **none**
sits in an `<img>` `src`. The cause is structural: `PostThumbnail` is a Client Component that receives
the whole `post` object as a prop, so React serialises every field of it, `post.thumbnail` included, so
the client can hydrate. The value is inert for rendering — the component computes
`/api/thumbnail/${post.id}` for file-type thumbnails and never reads `post.thumbnail` on that branch —
but it is present.

Redaction applied, and deliberately stricter than the plan requires: the plan permits recording scheme,
host and path. Recorded here are the scheme (`https`) and the host
(`prod-files-secure.s3.us-west-2.amazonaws.com`); the paths are described by shape only — a workspace
UUID, a file UUID, and a filename — rather than pasted, since the UUIDs identify the operator's
workspace and objects and carry no analytic value here. The query string is described **by role only**:
it carries a credential, a signature, an expiry and the usual accompanying signing parameters. Neither
the parameter names nor any value appears anywhere in this document; the gate
`grep -cE 'X-Amz-(Signature|Credential)'` returns `0`.

**Assessed impact, stated precisely:**

- **On the phase's goal — none.** The reader's browser never requests an expiring URL, because no `<img>`
  carries one. The idle-window test in 09-03 remains a valid and meaningful test of the fix.
- **On the phase's security posture — an improvement, not a regression, but not a fix.** Before this
  phase the presigned URL was in the `<img>` `src` *and* in the flight payload; now it is only in the
  flight payload. Exposure is strictly reduced. It is not eliminated: a live read grant sits in public,
  CDN-cached markup for the remainder of its lifetime, and `/` is prerendered with a long expiry.
- **Not fixed here, and deliberately not.** Removing it means narrowing the client component's props from
  the whole `Post` to just the values the client actually needs, which changes a component interface —
  an architectural change, and outside this plan's file scope (task 3 may modify only `09-EVIDENCE.md`).
  Raised for the operator as a follow-up rather than patched mid-verification.

### Idle window

- **Deploy SHA under test:** `9c3cc9c`
- **Last request of any kind made against the deployed site:** **2026-08-11T12:13:13Z** (UTC)
- **Window starts:** 2026-08-11T12:13:13Z
- **Earliest permissible cold load (09-03):** **2026-08-11T13:23:13Z** (UTC) — a 70-minute gap

Seventy minutes rather than sixty, to leave margin against clock skew and against Notion's presign
lifetime being approximate rather than exact.

**No request of any kind may be made against `https://4lph4-bl0g.vercel.app` until 13:23:13Z.** An
automated check counts as a request. A link preview, an uptime monitor, a browser tab left open on the
site, or a "just to double-check" curl all count as requests. **If one is made, the window restarts from
zero** and 09-03 must wait a further seventy minutes from that moment.

The last request was the `/browse` session's post-page load during the IMG-04 observation above. The
headless browser was then navigated off the site and its daemon shut down before the clock was taken;
confirmed afterwards that zero browse-daemon processes remain and no process on this machine holds the
site host in its command line. Committing this document does not touch the site.

**Why this window was safe to open only now.** Every check in Tier 2 either targeted `/api/thumbnail/...`
only — a path that resolves through a `cache: "no-store"` fetch and so writes no Data Cache entry — or
happened here in task 3, before the clock was started. Task 2 made no request to `/` or to a post page
at all. The ordering is the mitigation for T-09-14, and it is the reason the one unrepeatable resource
in this phase is still intact.

**Why T2-9's expected 200 is correct rather than a defect,** recorded now so a future reader meeting a
200 for a deliberately mangled input has the reasoning in front of them: `parsePageId`'s regexes are
word-boundary matched, not anchored, so the identifier still parses out of a longer segment. A 200 there
is itself positive evidence that **only the parsed value** reaches the outbound URL — had the raw segment
been used to build the Notion request, Notion would have answered 404 and so would the route.

---

## Tier 3 — the idle window

> Appended by plan 09-03. Tiers 1 and 2 above are unmodified.

### Window accounting

| | Timestamp (UTC) |
|---|---|
| Window start (recorded by 09-02 task 3 — last request of any kind before the gap) | `2026-08-11T12:13:13Z` |
| Earliest permissible cold load | `2026-08-11T13:23:13Z` |
| First request made after the gap (this plan's cold home-page request) | `2026-08-11T15:57:19Z` |
| **Elapsed gap** | **224 minutes 6 seconds** (3h 44m 06s) |

224 minutes is well past both the 70-minute margin `09-02` set and the ~1h Notion presign lifetime the
window exists to outlast. No request of any kind was made against `https://4lph4-bl0g.vercel.app` between
the window start and the cold request above — attested by the operator, in this session, as instructed;
this is the repudiation risk T-09-16 names, and it is why the corroborating signal below matters
independently of the attestation.

### Step 1 — the first request after the gap, captured whole (home)

Request: `GET /` on `https://4lph4-bl0g.vercel.app`, executed at `2026-08-11T15:57:19Z`, headers dumped
and body saved before any second request was made.

| Header | Observed |
|---|---|
| `HTTP` status | `200` |
| `x-vercel-cache` | `STALE` |
| `age` | `13514` (seconds) |
| `cache-control` | `public, max-age=0, must-revalidate` |
| `date` (the cached response's own generation time, forwarded by Vercel unchanged) | `Tue, 11 Aug 2026 12:12:04 GMT` |
| `x-nextjs-prerender` | `1` |
| `x-nextjs-stale-time` | `300` |

**This is the honesty check on the window, and it passes two ways at once.** `/` is `PRERENDER`-classed
with a 3-minute revalidate (08-CACHE-EVIDENCE.md, inherited), so a genuine post-gap first request should
report HTML from a cache populated before the gap rather than a fresh render — `x-vercel-cache: STALE`
is exactly that signature: the cached entry is past its revalidate window and was served as-is while a
background regeneration was (or will be) triggered by this very request, per the Full Route Cache's lazy
model (`research/ARCHITECTURE.md` §1). It is not a `MISS`, which would have meant this request itself
forced a fresh render and answered nothing about staleness.

Second, and independently: the forwarded `date` header — `12:12:04Z` — is the timestamp of the cached
HTML's own generation, not of this request. `age` (`13514`s) subtracted from the request time
(`15:57:19Z`) lands at `12:12:05Z`, matching the `date` header to within a second. **That generation time
sits *before* the recorded window start (`12:13:13Z`)** — the cached HTML this request served was already
sitting there when the window opened, most plausibly the served-HTML baseline capture 09-02 performed
immediately before starting the clock. This is the second, machine-observed half of T-09-16's mitigation:
the window-start timestamp and this response's own cache-generation timestamp agree with each other and
with the operator's attestation, rather than merely restating it. No disagreement occurred, so the run is
not invalidated.

`home amazonaws hits` (raw count anywhere in the captured body): `3`. `amazonaws.com` occurrences inside
an `<img>` `src`: `0`. Every occurrence is inside a `self.__next_f.push([...])` RSC flight-payload script,
consistent with Tier 2's earlier finding — recorded again here because the acceptance criterion asks for
it against *this* capture, not a re-citation of Tier 2's.

### Step 2 — the src read out of that captured HTML

Extracted from the saved body of the step-1 response (not a fresh request). Three distinct thumbnail
paths, all the stable post-id-keyed proxy path, all present on the stale, hour-old HTML:

```
/api/thumbnail/36e2c61e-4a24-8048-b7be-c6765c807e23
/api/thumbnail/3702c61e-4a24-8001-a9a6-c4ff3aadadb5
/api/thumbnail/6b42c61e-4a24-82b0-ae11-01fdb5e7110f
```

No `amazonaws.com` host appears in any `<img>` `src` (confirmed above). Before this phase's fix, this is
exactly where a presigned URL minted more than an hour before this request would have been sitting.

### Step 3 — the load-bearing request: direct proxy-path fetches

Each path above, requested directly, outside the optimizer, immediately after step 2's extraction:

| # | Path (id only) | Status | Content type | Size (bytes) | Pass/Fail |
|---|---|---|---|---|---|
| 1 | `36e2c61e-4a24-8048-b7be-c6765c807e23` | `200` | `image/png` | `53788` | PASS |
| 2 | `3702c61e-4a24-8001-a9a6-c4ff3aadadb5` | `200` | `image/png` | `1561628` | PASS |
| 3 | `6b42c61e-4a24-82b0-ae11-01fdb5e7110f` | `200` | `image/png` | `183062` | PASS |

**This is IMG-01's evidence.** Three distinct home-feed thumbnail references, read out of HTML that had
sat cached for 224 minutes — longer than Notion's ~1h presign lifetime — all resolve to live, non-zero
image bytes on a direct request. The reference embedded in hour-old HTML still works, because the URL
behind it is minted when the image is asked for, not when the page was last rendered. Not the browser
view; this direct request is the establishing evidence.

### Step 4 — the post detail page, same window, same discipline

Request: `GET /post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5`, executed at `2026-08-11T15:58:04Z` (within the
same 224-minute-plus gap; the post route is dynamic and answers on every request, so no separate "first
request" honesty check applies to it the way it does to `/`).

| Header | Observed |
|---|---|
| `HTTP` status | `200` |
| `x-vercel-cache` | `MISS` |
| `cache-control` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `age` | `0` |

A `MISS` here is expected, not a failed window: `08-CACHE-EVIDENCE.md` (inherited, not re-derived)
measured `/post/[id]` as `ƒ (Dynamic)` answering `x-vercel-cache: MISS` on every request, because the
route has no `generateStaticParams` and so no Full Route Cache entry exists for it to be stale in. What
can go stale on this route is `getPost`'s Next.js **Data Cache** entry (D-08's finding), which this
response's HTML is the product of — that staleness, if present, would show up in what the hero `src`
resolves to, not in the page's own cache header.

`post amazonaws hits` (raw count anywhere in the captured body): `1`. Occurrences inside an `<img>` `src`:
`0`. The one occurrence sits in the RSC flight payload, same pattern as the home page and Tier 2's prior
finding.

**Hero thumbnail path, extracted from this captured body:** `/api/thumbnail/3702c61e-4a24-8001-a9a6-c4ff3aadadb5`
— the stable post-id-keyed path, not a presigned URL.

**Direct request to that path, immediately after extraction:**

| Path (id only) | Status | Content type | Size (bytes) | Pass/Fail |
|---|---|---|---|---|
| `3702c61e-4a24-8001-a9a6-c4ff3aadadb5` | `200` | `image/png` | `1561628` | PASS |

**This is IMG-02's evidence.** The post detail page's hero thumbnail, resolved from a page render that
happened inside the idle window's Data Cache uncertainty, still returns live image bytes on direct
request. Size matches the home-feed occurrence of the same post's thumbnail (`1561628` bytes both places),
which is expected — same underlying Notion file, same resolved URL.

### Step 5 — the reader's view, corroboration only

**Performed at approximately `2026-08-11T16:10Z`, after the cold capture in steps 1-4 above** — the
mechanical criterion and the timing together are why this cannot disturb the one-shot window, and why it
is corroboration rather than a second establishing observation.

**Who/what performed it, stated plainly:** this was **not** a human eyeball in a personal incognito
window. It was run in a **freshly started headless Chromium daemon** (the gstack `/browse` skill), whose
only prior state was `about:blank` — the previous daemon (used earlier in 09-02 for the IMG-04
observation) was stopped and a new one started specifically for this check, so the session carried no
cookies, no `localStorage`, and no prior visit to this origin for either page. That is
cookie-and-storage-equivalent to a fresh incognito window, but the record must not present it as a human
visual confirmation, and it does not.

**Method:** navigated to each page, waited for network idle, then enumerated every `<img>` element and
read `currentSrc`, `naturalWidth`, `naturalHeight`, and `complete` off the live DOM. The pass criterion was
mechanical and specific — `naturalWidth > 0 && complete === true` — not "it looked fine to the eye."
Screenshots were also captured for both pages.

**`/` (home feed):**

| # | src (role) | naturalWidth × naturalHeight | complete |
|---|---|---|---|
| 1 | optimizer-wrapped `/avatar.png` | 80 × 80 | true |
| 2 | optimizer-wrapped proxy path, post `3702c61e-…adb5` | 96 × 47 | true |
| 3 | optimizer-wrapped proxy path, post `36e2c61e-…7e23` | 96 × 54 | true |
| 4 | optimizer-wrapped proxy path, post `6b42c61e-…110f` | 96 × 54 | true |
| 5 | optimizer-wrapped `/avatar.png` | 80 × 80 | true |

Broken-image count (`!complete || naturalWidth === 0`): **0**. Console errors: **none**. The three
thumbnail ids match the three extracted from the step-1 captured cold HTML exactly.

**`/post/3702c61e-4a24-8001-a9a6-c4ff3aadadb5`:**

| # | src (role) | naturalWidth × naturalHeight | complete |
|---|---|---|---|
| 1 | optimizer-wrapped `/avatar.png` | 80 × 80 | true |
| 2 | optimizer-wrapped proxy path (hero), post `3702c61e-…adb5` | 1280 × 630 | true |
| 3 | Notion body image (`www.notion.so/image/attachment…`) | 1920 × 945 | true |
| 4 | Notion body image (same host/shape) | 1920 × 945 | true |
| 5 | Notion body image (same host/shape) | 800 × 944 | true |
| 6 | Notion body image (same host/shape) | 4000 × 3000 | true |
| 7 | optimizer-wrapped `/avatar.png` | 80 × 80 | true |

Broken-image count: **0**. Console errors: **none**. Rows 3-6 are `react-notion-x` body-block images
served from Notion's own `www.notion.so/image/...` redirect endpoint — they are post *content* images,
not thumbnails, and are **out of scope for IMG-01/IMG-02**. Noted only because their rendering was
observed alongside the hero's, and labelled as out of scope rather than presented as thumbnail evidence.
Only row 2 (the hero) is this task's corroborating signal for IMG-02.

**Why this is corroboration and not proof, unchanged from the plan's own reasoning:** Next 16's image
optimizer holds a derived variant for at least four hours, and 09-02's earlier `/browse` pass populated
that cache within this same window's span. A thumbnail rendering here — even under a fresh, cookie-less
daemon session — could in principle be the optimizer replaying bytes it fetched before the gap rather than
proof of a fresh resolution through the proxy route. Steps 1-4 above, which requested the proxy path
directly and outside the optimizer, are what establish IMG-01 and IMG-02; this step corroborates that a
reader's actual browser view matches what those direct requests found.

### Result

- **IMG-01: established.** Steps 1-3: three distinct home-feed thumbnail references, read out of HTML that
  had sat cached for 224 minutes (past both the 70-minute margin and Notion's ~1h presign lifetime), each
  resolve to live image bytes (`200`, `image/png`, non-zero size) on a direct, outside-the-optimizer
  request. Step 5 corroborates: the same three thumbnails render with `naturalWidth > 0 && complete` and
  zero broken-image count in a freshly started, cookie-less browser session, with the caveat above about
  what the optimizer's own cache floor can and cannot mask.
- **IMG-02: established.** Step 4: the post hero thumbnail, extracted from a dynamic-route render that
  occurred inside the same idle window (page HTML uncached, `x-vercel-cache: MISS` as always for this
  route; what could have gone stale is `getPost`'s Data Cache entry per D-08), resolves to live image bytes
  on direct request. Step 5 corroborates: the hero renders with `naturalWidth: 1280 × 630` and `complete:
  true` in the same fresh browser session, zero broken-image count, no console errors.

---

## The IMG-02 finding

### Result, judged against ROADMAP Phase 9 success criterion 2

> "The same idle-gap-then-cold-load check passes for a post detail page's hero thumbnail."

**The hero thumbnail resolved after the gap, and IMG-02 is met.** Task 1 step 4's direct request to the
hero's extracted proxy path returned `200`, `image/png`, `1561628` bytes — the same behaviour the home
feed showed for IMG-01 — and step 5's corroborating browser observation shows the hero rendering
(`1280 × 630`, `complete: true`) in a fresh session. This is stated as observed, not defaulted to a pass:
the post page's own render happened inside the idle window (dynamic route, `x-vercel-cache: MISS`), so
whatever staleness the Data Cache mechanism (below) could have introduced had the same 224 minutes to
manifest that IMG-01's home-feed check had, and it did not prevent the hero from resolving.

### What this phase made unobservable, and why that is a recorded trade-off, not an oversight

D-11 chose to spend this phase's single idle window on **verifying the fix**, not on first reproducing the
bug on an unfixed deployment. Combined with the fix itself — which works by removing the presigned URL
from the served HTML entirely, on all four surfaces including the post hero (D-01) — the one signal that
would have *discriminated* IMG-02's mechanism no longer exists to be looked at: an embedded presigned URL,
sitting in a post page's markup, older than Notion's presign lifetime. Before the fix, that URL would have
been directly readable from the page source and its age directly comparable to the presign window. After
the fix, no such URL is ever embedded (D-01/D-05), so there is nothing left in the served HTML whose
staleness could be measured. This is the direct consequence of D-11's own trade-off, made explicitly and
recorded at the time it was made — not something this task discovered belatedly.

**Confidence in the mechanism stays MEDIUM, not HIGH.** `09-RESEARCH.md`'s "Resolving the IMG-02
Contradiction" infers the mechanism from documented Next.js caching behaviour rather than from a direct
measurement: `/post/[id]` is dynamic because it declares no `generateStaticParams` (confirmed by grep,
HIGH confidence), so the **page HTML** is never cached by the Full Route Cache — but `getPost`'s call
inside that render lands in Next's separate **Data Cache**, under the constructor-baked
`next: { revalidate: 180 }` (`apps/web/src/lib/notion.ts:8-16`). The Data Cache uses the same lazy
stale-while-revalidate model ISR does: on a low-traffic site, an entry can sit well past its 180-second
`revalidate` window because nothing proactively refreshes it, so a post page can in principle serve a
`post.thumbnail` value resolved from a `getPost` call made over an hour earlier — older than the presign
lifetime — even though the page's own HTML is freshly rendered on every request. This is a correct
application of documented Data Cache semantics to this specific fetch call, not a measurement of it in
production; `09-RESEARCH.md`'s own Assumption A3 and Open Question 2 name exactly this gap and rate it
MEDIUM, and nothing performed in this phase (verify-after-fix by design, D-11) closed it.

**The discriminating test remains available for future re-diagnosis, not owed by this phase:** a
temporary latency-timing log placed around `getPost()`'s internal fetch call, read during a genuinely idle
window, would separate a near-instant Data Cache hit (confirming the stale-entry mechanism) from a live
Notion round-trip (refuting it). Recorded here as the named, ready-to-run test for whoever needs to
re-open this question — not run in this phase, because the fix bypasses the mechanism regardless of
whether this specific diagnosis is exactly right (`09-RESEARCH.md` Open Question 2).

### Correcting `research/ARCHITECTURE.md` §1 — D-08's actual deliverable

`research/ARCHITECTURE.md` §1 ("Full lifetime trace of a thumbnail URL") states the mechanism as:

> "Next Full Route Cache (ISR) entry for `/` or `/post/[id]` — this HTML, containing the (possibly
> already-old) presigned URL, is what gets served to the NEXT visitor..."

**This is right for `/` and wrong for `/post/[id]`.** `08-CACHE-EVIDENCE.md` (inherited from Phase 8,
not re-derived here) measured `/post/[id]` as `ƒ (Dynamic)`, `cache-control: private, no-cache, no-store,
max-age=0, must-revalidate`, `x-vercel-cache: MISS` on every one of 12 requests across a 232-second gap —
there is no Full Route Cache entry for this route at all, so it cannot be the mechanism behind any
staleness observed on a post page. The correct attribution, per `09-RESEARCH.md`'s finding above, is the
**Next.js Data Cache** entry inside `getPost()`'s own fetch — a different cache layer, with the same
lazy-refresh *behaviour* (which is why the ROADMAP's user-facing symptom description still held) but a
different *mechanism* and a different code location (`apps/web/src/lib/notion.ts`'s constructor-baked
`revalidate: 180`, not the page-level Full Route Cache).

This document is the amendment `ARCHITECTURE.md` §1 needs: the wrong attribution is "Full Route Cache for
both `/` and `/post/[id]`"; the right attribution is "Full Route Cache for `/`, Next.js Data Cache
(`getPost`'s fetch) for `/post/[id]`". Not applied as a code change — `ARCHITECTURE.md` is a research
document, not a locked spec, and this phase's file scope for task 2 is `09-EVIDENCE.md` alone — but
recorded here in writing so the next reader of `ARCHITECTURE.md` finds the correction from this side.

---

## Closing — per-requirement summary, IMG-01 through IMG-05

A reader should be able to tell, without opening another file, exactly which claims rest on observation
and which rest on source assertion alone.

| Requirement | What was established | By which tier | Exercised? |
|---|---|---|---|
| **IMG-01** — home feed thumbnails survive an idle gap | Three distinct home-feed thumbnail references, extracted from HTML that sat cached 224 minutes past the window's 70-minute margin, each resolve to live image bytes (`200`, `image/png`, non-zero size) on a direct, outside-the-optimizer request; corroborated by a fresh headless-browser pass (`naturalWidth > 0 && complete`, 0 broken images) | Tier 3 (this plan), steps 1-3 and 5 | **Observed** |
| **IMG-02** — post hero thumbnail survives an idle gap | The hero thumbnail, extracted from a dynamic-route render that occurred inside the idle window, resolves to live image bytes on direct request; corroborated by the same browser pass | Tier 3 (this plan), step 4 and 5 | **Observed.** Mechanism (why it could have gone stale) is MEDIUM-confidence and **unexercised** — see "What this phase made unobservable" above; this phase's own fix removed the discriminating signal. |
| **IMG-03** — the route refuses non-Notion input, off-allowlist hosts, redirects, and non-image content | id-parse guard, redirect refusal, and content-type assertion all **observed** (Tier 1 local smoke + Tier 2 controlled-origin probes T2-1/T2-2 + Tier 2 deployed battery T2-4..T2-9). **Host-allowlist guard is source-asserted only** — Tier 1 row 8b confirms by grep that exactly the two `next.config.ts`-allowlisted hostnames appear in the route file; the guard's *firing* was never observed | Tier 1 + Tier 2 | Three of four guards observed; **host-allowlist guard unexercised** — Notion chooses the presign host at signing time, so an off-allowlist resolution cannot be constructed from real data, and this project's honesty rule (D-13's spirit) rules out fabricating one |
| **IMG-04** — a genuinely failing thumbnail shows the placeholder | 32×32 (card) / 48×48 (hero) `ImageOff` icon, exact token colour matches in both light and dark themes, no caption, zero `<img>` left to render a broken-image glyph, confirmed to survive a real theme toggle | Tier 2 (`09-02`) | **Observed**, by direct browser measurement against a genuine failed request (the route's own `400` refusal path, substituted for devtools request-blocking which `/browse` does not expose) |
| **IMG-05** — external (non-Notion) thumbnails bypass the proxy entirely | Structural half observed: 3 distinct post ids all route through the proxy, `0` absolute-URL `<img src>` values on either page, meaning no post currently renders an unproxied external thumbnail. **Live half unexercised**: the operator's database contains no post whose thumbnail is an external URL, so the `thumbnailType === "external"` branch and the route's non-`"file"` 404 refusal rest on source assertion (`09-01`) rather than a live external-thumbnail post resolving correctly | Tier 2 (`09-02`) | **Unexercised (live half)** — no external-thumbnail post exists in the operator's Notion database; production content was deliberately not mutated to manufacture the case (would corrupt the data this phase's idle-window test measures) |

**Everything not exercised, gathered in one place:**

1. **The host-allowlist guard (IMG-03).** Source-asserted only. The host is chosen by Notion when it
   presigns a file, not by the operator, so an off-allowlist resolution cannot be constructed from real
   Notion data.
2. **IMG-05's live half.** Unexercised. No post in the operator's database has an external thumbnail;
   fabricating one by editing production content was explicitly ruled out (`09-VALIDATION.md`, this
   phase's honesty rule) because it would have disturbed the data the idle window measures.
3. **The IMG-02 mechanism.** Unexercised, and unexercisable by this phase's own design: D-11 spent the
   window on verifying the fix rather than reproducing the pre-fix bug, and the fix removes the one signal
   (an embedded, ageable presigned URL) that would have let a live check discriminate the Data Cache
   hypothesis from any alternative. MEDIUM confidence, named discriminating test (a temporary latency-timing
   log around `getPost()`) recorded as available for whoever needs it.

**This document reads end to end as three tiers, in the order they were run:** Tier 1 (source assertions,
`09-01`), Tier 2 (deployed and controlled-origin checks, `09-02`), Tier 3 (the idle window, `09-03`, this
plan). No claim above is unsupported by pasted output, and every unexercised item is named with its reason
rather than silently omitted.

---

## Tier 4 — RSC flight-payload closure (G-09-1)

> Appended by plan 09-04. Tiers 1-3 above are unmodified. This tier exists because the operator was
> offered "accept as residual risk" at UAT test 1 (see `09-VERIFICATION.md`'s first
> `human_verification` item) and chose to fix it instead. The phase's single idle window was already
> spent and its record closed (Tier 3 above) before this section's first request was made — nothing
> below touches the idle-window claim, and requesting `/` or a post page here does not endanger it.

### Task 2 — local production proof and deployed before-control

**Local production proof.** Built and served with `next start` on a non-default port (3210), detached
via `setsid` so the sandbox's process-group timeout could not kill it — the pattern Phase 3 and 09-02
both used. Real Notion credentials, real page. Server confirmed down afterwards (`ss -ltnp` showed zero
listeners on 3210 once fully killed).

| Body | Distinct `/api/thumbnail/{uuid}` refs (vacuity guard, must be >0) | `amazonaws.com` occurrences | `X-Amz-(Signature\|Credential)` occurrences |
|------|---|---|---|
| Home (`/`), local `next start` | `3` | `0` | `0` |
| Post (`/post/3702c61e-…adb5`), local `next start` | `1` | `0` | `0` |

The vacuity guard passes on both bodies — the zero `amazonaws.com` counts above are real absences, not
an empty page. This is the local, pre-deploy proof that the boundary split (Task 1) works end to end
against real Notion data.

**Deployed before-control.** Requested `https://4lph4-bl0g.vercel.app/` and the post detail page for the
same hero post id, against the deploy that shipped *before* this plan's fix (still carrying the whole
`Post` object across the `PostThumbnail` client boundary).

| Body | Distinct `/api/thumbnail/{uuid}` refs, raw/unescaped | `amazonaws.com` occurrences |
|------|---|---|
| Home (`/`), deployed before-control | `0` | `3` |
| Post (`/post/3702c61e-…adb5`), deployed before-control | `0` | `1` |

The `amazonaws.com` counts (3 and 1) reproduce Tier 2's recorded figures exactly, confirming this is the
same before-state Tier 2 measured — a genuine before/after pair inside this one document. The
raw-unescaped proxy-ref count is `0` on both bodies here, and that is expected rather than a vacuity
failure: before this plan's fix, `PostThumbnail` served the computed thumbnail `src` only inside the
rendered `<img>` element (as a percent-encoded `/_next/image?url=%2Fapi%2Fthumbnail%2F{uuid}&…` string,
confirmed present at `3` and `1` distinct occurrences respectively), never as a raw client-component prop
in the RSC flight payload — because the pre-fix component received the whole `post` object and computed
`src` internally, rather than receiving `src` as a passed-in prop. Only *after* the Task 1 split does the
resolved `src` string exist as a literal Client Component prop, which is exactly the artifact the raw
(unescaped) regex is built to detect in the after-measurement below. This document therefore uses
different counters for different purposes, deliberately: `amazonaws.com`/`X-Amz-*` for the closure gate
(unaffected by encoding), and the raw proxy-ref pattern specifically to confirm the *new* prop shape
exists post-fix — its `0` here is a property of the old code's data flow, not a vacuous capture.

**Liveness signal recorded for Task 3.** The set of `/_next/static/chunks/*.js` filenames from this
deployed home-page before-capture — `5` distinct filenames — is saved so Task 3 can confirm the new
deploy actually shipped by observing the set change, rather than inferring liveness from the measurement
itself.

Redaction: counts, hostnames and path shapes only, matching Tier 2's discipline. No signature,
credential, query string or filename from any presigned URL enters this repository —
`grep -cE 'X-Amz-(Signature|Credential)'` over this document returns `0`.

### Task 3 — push, deploy-liveness confirmation, and the deployed closure measurement

**Continuation note.** This section was produced by a second executor run, resumed after the
orchestrator merged the worktree wave and performed the push itself (Task 3's `<precondition>`
correctly refused a direct push from a worktree-isolated context, per the halt recorded in this
plan's Deviation 1). `git push origin main` landed the wave at commit `34fceee` (`6d61daa..34fceee`),
which — verified directly against `git show --stat 6d61daa..34fceee -- . ':(exclude).planning'` —
carries **only** `apps/web/src/components/PostThumbnail.tsx` and
`apps/web/src/components/PostThumbnailImage.tsx` as source changes. This corrects the plan's own
`<design>` section, which anticipated five additional unrelated source files
(`components/Profile.tsx`, `components/notion/MermaidBlock.tsx`, three `templates/terminal/` files)
riding along in this deploy — those five had already shipped in an earlier, separate push before
this wave, so this deploy is a clean, single-change deploy. Recorded here rather than silently
dropped, per the plan's own instruction that a future reader must not misattribute this deploy's
effects to files it did not actually carry.

**Deploy-liveness confirmation, independent of the closure measurement itself.** Task 2's before-
capture recorded `5` distinct `/_next/static/chunks/*.js` filenames but (as a count only, not a
saved list — the actual filenames lived in a `/tmp` scratch file from that prior executor process,
which did not persist across the handoff to this continuation agent). Liveness was therefore
confirmed by three independent signals, none of which is the presigned-URL count being measured:

1. **Chunk-file count changed:** the home page now serves `6` distinct chunk filenames, not `5` —
   consistent with the plan's own prediction that this change "adds a new client chunk"
   (`PostThumbnailImage.tsx` is new and is the only Client Component in the split).
2. **Vercel cache-state headers show a fresh origin render, not a stale cached hit:** the first home-page
   request returned `x-vercel-cache: PRERENDER`, `age: 0` (a fresh regeneration at request time); the
   post-page request returned `x-vercel-cache: MISS`, `age: 0` (served fresh from origin, not the edge
   cache). A stale, pre-fix deploy still cached at the edge would instead show `HIT` with a growing `age`
   and would still carry the *old* code's `3`/`1` `amazonaws.com` counts.
3. **Byte-for-byte non-regression match:** all three direct proxy-path fetches below return the exact
   same content-length Tier 2 recorded (`53788`, `1561628`, `183062` bytes) — the deploy did not simply
   go dark, it is serving the same real images through the same live route.

**Closure measurement — deployed, after this plan's fix:**

| Body | Distinct `/api/thumbnail/{uuid}` refs (vacuity guard, must be >0) | `amazonaws.com` occurrences (GATE — must be 0) | `X-Amz-(Signature\|Credential)` occurrences (GATE — must be 0) | `amazonaws.com` inside an `<img src>` |
|------|---|---|---|---|
| Home (`/`), deployed after | `3` | `0` | `0` | `0` |
| Post (`/post/3702c61e-…adb5`), deployed after | `1` | `0` | `0` | `0` |

The vacuity guard passes on both bodies (non-zero proxy-path counts), so the `0` `amazonaws.com` and
`0` `X-Amz-*` counts above are real absences on the live, deployed site — not an empty page. **G-09-1 is
closed**: against Tier 2's recorded `3` (home) and `1` (post), both are now `0`, and the guard that
distinguishes a real zero from a vacuous one held.

**Non-regression — same three ids, same live image bytes, on a direct (non-optimizer) request:**

| Id | Surface | HTTP status | Content-Type | Bytes | Tier 2's recorded bytes | Match |
|----|---------|-------------|---------------|-------|--------------------------|-------|
| `36e2c61e-4a24-8048-b7be-c6765c807e23` | home feed | `200` | `image/png` | `53788` | `53788` | ✓ identical |
| `3702c61e-4a24-8001-a9a6-c4ff3aadadb5` | home feed + post hero | `200` | `image/png` | `1561628` | `1561628` | ✓ identical |
| `6b42c61e-4a24-82b0-ae11-01fdb5e7110f` | home feed | `200` | `image/png` | `183062` | `183062` | ✓ identical |

All three distinct home-feed ids match the ids Tier 2 recorded, and the post page's hero id is the
same `3702c61e-…adb5` id used throughout this phase. Every path returns `200` with an `image/*`
content type and a non-zero body — IMG-01/IMG-02 non-regression confirmed on the deployed, post-fix
site.

**A non-zero result would have meant, and did not:** per this plan's `<action>` text, a non-zero
`amazonaws.com` count on a body that still carries proxy paths would have meant a *second* client
boundary somewhere else in the render tree was still receiving the whole `post` object, and G-09-1
would have been narrowed rather than closed. That did not occur — both gate counts are `0`.

**`terminal` template (09-REVIEW.md INFO-02), carried forward.** `templates/terminal/PostPage.tsx`
still renders `post.thumbnail` directly into an `<img src>` and is untouched by this plan, per D-03.
It is inactive (`site.config.ts` sets `template: "default"`), so it contributes nothing to either
body measured above and cannot make this measurement fail — but the underlying bug survives there
for a future terminal-parity phase to inherit rather than rediscover.

Redaction: counts, hostnames and path shapes only, matching Tier 2's and this Tier's own discipline
above. No signature, credential, query string or filename from any presigned URL enters this
repository — `grep -cE 'X-Amz-(Signature|Credential)'` over this document returns `0`.
