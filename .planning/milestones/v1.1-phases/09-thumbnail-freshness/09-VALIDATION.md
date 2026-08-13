---
phase: 9
slug: thumbnail-freshness
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — repo has zero test infrastructure (no jest/vitest/playwright config, no `*.test.*`); adding a framework is explicitly Out of Scope in REQUIREMENTS.md |
| **Config file** | none |
| **Quick run command** | `npm run lint --workspace=apps/web` |
| **Full suite command** | `npm run build --workspace=apps/web` |
| **Estimated runtime** | ~{N} seconds (measure during execution) |

---

## Sampling Rate

- **After every task commit:** `npm run lint --workspace=apps/web`
- **After every plan wave:** `npm run build --workspace=apps/web`
- **Before `/gsd-verify-work`:** build green, lint clean, and the deployed-site checks below run
- **Max feedback latency:** {N} seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | IMG-{XX} | T-09-{NN} / — | {expected secure behavior or "N/A"} | source-assertion | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Filled by the planner / validate-phase. With no test runner, expect `source-assertion` (grep / build / lint), `curl-deployed`, and `manual-idle-window` rows rather than `unit`.*

---

## Wave 0 Requirements

- [ ] None — no test framework may be installed (REQUIREMENTS.md Out of Scope; D-07 no new dependencies).

*Automated verification is limited to source assertions, `next build`, and ESLint. Everything behavioural is deployed-site or operator-verified.*

---

## Three tiers of verification, because they cost wildly different amounts

### Tier 1 — automated, runs on every commit

| Behaviour | Requirement | How |
|---|---|---|
| The four call sites all route through the shared component | IMG-01/02, D-01/D-02 | grep: no `src={post.thumbnail}` remains in `templates/default/` |
| `packages/core` untouched | REQUIREMENTS D-05 | `git diff --exit-code packages/` |
| No new dependency | REQUIREMENTS D-07 | `git diff --exit-code apps/web/package.json package-lock.json` |
| The local `Post` type carries `thumbnailType` | 09-CONTEXT D-07 note | `tsc` via `next build` — this is the compile-blocking gap research found |
| The route never reads a caller-supplied URL | IMG-03 | grep: no `searchParams.get("url")`-shaped access in the route |
| The uncached client is a second instance, not the singleton | 09-CONTEXT **D-14** | grep the route for `no-store` and assert it does **not** import `getPost`/`getPosts` from `lib/notion.ts` |
| `terminal` template unchanged | 09-CONTEXT D-03 | `git diff --exit-code apps/web/src/templates/terminal/` |

### Tier 2 — deployed site, immediate (a `curl` each, no waiting)

All four IMG-03 guards are checkable the moment the route is live. **These are the cheapest real evidence in
the phase — run them first, before any idle window is spent.**

| Behaviour | Requirement | Check |
|---|---|---|
| Non-page-identifier input refused | IMG-03 | `curl` the route with garbage in the id position → expect non-200 |
| Host outside the `next.config.ts` allowlist refused | IMG-03 | Exercise whatever path could yield an off-allowlist host → expect non-200 |
| Origin redirect refused | IMG-03 | `redirect: "error"` must surface as a non-200, not a followed hop |
| Non-`image/*` content type refused | IMG-03 | Expect non-200 rather than a passed-through body |
| A working thumbnail returns image bytes | IMG-01/02 | 200 + `content-type: image/*` + non-zero length |
| The proxy response carries the long cache header | 09-CONTEXT D-06 | Read `cache-control` off the response |
| External thumbnails bypass the proxy entirely | IMG-05 | Page source for a post with `thumbnailType === "external"` shows the original URL, **not** the proxy path |

### Tier 3 — the idle window (expensive, cannot be shortened)

| Behaviour | Requirement | Constraint |
|---|---|---|
| Home feed thumbnails render on a cold first load after >1h idle | IMG-01 | **The one unavoidable wait.** No visits to `/` for longer than Notion's ~1h presign lifetime, then a cold/incognito load |
| Post hero thumbnail, same conditions | IMG-02 | Same window, same load — see the note below |
| A genuinely failing thumbnail shows the placeholder, not an empty box | IMG-04 | Client-side `onError` (D-10); can be exercised by pointing the component at a deliberately bad id |

**Procedure (PITFALLS 13/14, no shortcuts):**

1. Deploy. Note the time.
2. **Do not touch the site** for >1h. Any visit — including an automated check — resets the window.
3. Cold/incognito load of `/`. Every thumbnail must render.
4. **Read the raw origin URL from page source**, not the `/_next/image?...` wrapper. Next 16's optimizer has
   its own 4-hour cache floor that can make a broken origin look fine (PITFALLS 14).
5. Same for a post detail page (IMG-02).

**Do not synthesise an expired presigned URL to skip the wait** (09-CONTEXT D-13). It is the substitute
PITFALLS 13 names, and there is no guarantee it exercises the same path.

**IMG-02's mechanism is MEDIUM confidence, not HIGH.** `09-RESEARCH.md` infers it from documented Data Cache
behaviour rather than measurement: `/post/[id]` is dynamic (no `generateStaticParams`), so the page HTML is
not cached, but `getPost`'s Data Cache entry (`revalidate: 180`, constructor-baked) can outlive the presign on
a low-traffic site. The Tier 3 check is what settles it. If the post page's thumbnail turns out **not** to
break, record that as the finding rather than forcing IMG-02 to pass — the fix covers it either way.

---

## Validation Sign-Off

- [ ] Every task has an `<automated>` verify (source assertion / build / lint) or appears in Tier 2 or Tier 3
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (N/A — no framework may be added)
- [ ] No watch-mode flags
- [ ] Tier 2 ran **before** the idle window was spent
- [ ] The idle window was ≥1h with no intervening visits, and that is recorded with timestamps
- [ ] The raw origin URL was checked, not the `/_next/image` wrapper
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
