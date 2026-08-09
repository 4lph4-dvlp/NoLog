# Project Research Summary

**Project:** NoLog v1.1 — Live Blog Bug Fixes & Reading Width
**Domain:** Next.js 16 App Router blog with Notion-as-datastore on Vercel; ISR caching, unofficial Notion client, collapsible UI with secret-gated components
**Researched:** 2026-08-09
**Confidence:** HIGH for stack/architecture facts; MEDIUM for pitfall severity and verification procedures

## Executive Summary

NoLog v1.1 consists of three bug fixes + one UX feature, all implementable with **zero new npm dependencies** using already-installed versions. The three fixes target: (1) presigned Notion thumbnail URLs expiring between ISR generations, (2) an undifferentiated error catch masking whether `notion-client`'s `getPageRecordMap()` or downstream queries fail, and (3) missing collapsible sidebar UI with independent state and localStorage. All are technically sound within the "Notion + Vercel + GitHub" constraint.

The **single highest-value finding**: `react-notion-x` v7.10.0 (installed) includes `ofetchOptions` constructor field that already solves GitHub issue #710 (Cloudflare rejecting `notion-client` for missing `User-Agent` header)—a MEDIUM-confidence identification not yet verified against this deployment's actual Vercel logs, but the most specific, recent finding for "Content could not be loaded."

The **critical prerequisite**: decompose `post/[id]/page.tsx`'s combined try/catch into three independent catches—not for elegance but because the current architecture makes it **impossible to diagnose whether `getPageRecordMap()`, `getCategories()`, or related-posts queries are the real failure**, all producing the same fallback. This is a prerequisite for diagnosis, not a nice-to-have.

The **largest open decision**: Which of three competing auto-collapse-vs-manual-override designs for sidebars? Research strongly supports **Option A** (ephemeral auto-state + sticky explicit override via `null | true | false`), but requires explicit requirement-scoping—only Option A avoids "site fights user on resize" failures documented in GitLab's issue tracker. Flagged as **OPEN DECISION**.

## Key Findings

### Recommended Stack

**No new packages needed.** All three fixes work with currently-installed versions:

- **`next@16.2.4`** — Image config fields (`maximumRedirects`, `remotePatterns.search`) available since 16.0.0.
- **`notion-client@7.10.0` + ecosystem at `^7.10.0`** — Fix #2 uses the already-present `ofetchOptions` field to inject `User-Agent` header. No upgrade required; `7.10.1`+ (unreleased-to-npm as of research) would make the explicit header redundant but harmless.
- **`next-themes@0.4.6`** — Already current-latest; sidebar pattern reuses its blocking-inline-script technique (no new dependency).
- **`tailwindcss@^4`** — Arbitrary-variant breakpoints work at installed major version.

**Do NOT add:** CDN workers, `unoptimized`, cookie infrastructure, or reverse proxies without allowlist.

### Expected Features

**Item 1: Image Freshness**
- Root cause: Notion's presigned S3 URLs expire in ~1h; ISR's stale-while-revalidate serves cached HTML with expired URLs on idle gaps.
- Must have: Thumbnails + hero images load on first visit (no "blank until refresh").

**Item 2: Content Rendering**
- Root cause: Unknown until diagnosed (candidates: User-Agent #710, IP blocking, permissions, stale cookie).
- Must have: Post body renders on first visit for all published posts.
- Prerequisite: Decompose try/catch with granular logging (diagnostic prerequisite).

**Item 3: Collapsible Sidebars**
- Must have: Left/right toggles pinned outside asides, independent state, auto-collapse + manual override via localStorage, aria-expanded/controls, focus management, prefers-reduced-motion.
- **OPEN DECISION:** Which of three auto-collapse designs (Option A/B/C from FEATURES.md) applies—only Option A avoids resize-fighting bugs.

### Architecture Approach

All three fixes are **file-disjoint** (can parallelize). Recommended sequence: Fix 2 → Fix 1 → Fix 3 (diagnostic first).

**Fix 1:** New `/api/thumbnail/[id]` route handler, new `lib/thumbnail.ts` helper, modify HomePage/PostPage templates. **Zero changes to `packages/core`** (metadata already shipped v1.0).

**Fix 2:** Decompose `post/[id]/page.tsx` try/catch (three independent catches), wrap `getPageRecordMap()` in caching. Prerequisite: capture actual Vercel error logs.

**Fix 3:** New `SidebarShell.tsx` (client component), blocking inline script in `app/layout.tsx`, modify `Layout.tsx` (stays Server Component—critical constraint), new CSS in globals.css.

### Critical Pitfalls

1. **Image proxy becomes open SSRF relay** — Accept only Notion IDs, allowlist hostnames, set `redirect: "error"`, verify `content-type` is `image/*`.
2. **`unoptimized` reintroduces full-resolution cost** — Never use as primary fix; bug is URL staleness, not optimizer incompatibility.
3. **Shortened `revalidate` doesn't fix idle-gap** — Doesn't help low-traffic pages; risks Notion rate limits. Use proxy fix as actual solution.
4. **Request-time re-signing opts out of ISR** — Every pageview becomes live API call. Keep resolution in existing cached data path.
5. **Diagnosing `recordMap` failure from code alone repeats CR-01 mistake** — Capture actual Vercel error (status + body) and prod-vs-local response comparison before writing fix.
6. **Splitting try/catch introduces new failure modes** — `notFound()` in content-render catch (wrong), or leaving legs uncaught without verified ISR fallback (wrong). Decompose by concern only.

(See PITFALLS.md for 15 detailed pitfalls, recovery strategies, integration gotchas.)

## Implications for Roadmap

### Phase 1: Content-Rendering Diagnostic & Fix
- **Rationale:** Prerequisite for understanding actual failure. Current combined catch makes diagnosis impossible.
- **Delivers:** Decomposed try/catch with granular logging, captured Vercel evidence, post body rendering on first visit.
- **Addresses:** Item 2.
- **Research flags:** Must deploy diagnostic logging to production and observe real failure (not `next dev`). Pitfall 5's discriminating-evidence table guides root-cause categorization.

### Phase 2: Image Freshness Fix (Proxy + Templates)
- **Rationale:** Root cause fully understood, fix shape locked. Mechanical, high-confidence.
- **Delivers:** `/api/thumbnail/[id]` route, template updates, images load correctly on first visit regardless of idle gaps.
- **Addresses:** Item 1.
- **Research flags:** **Critical:** Test on deployed site with Pitfall 13's procedure (idle > presign TTL, then reload). Do not rely on `next dev` or immediate post-deploy testing. Verify raw origin S3 URL directly per Pitfall 14.
- **Implementation choice:** Redirect (307) vs. stream bytes? Both work; streaming more reliable with next/image.

### Phase 3: Sidebar Collapse + Reading Width
- **Rationale:** Largest UX feature; no technical dependencies on 1–2. Sequenced last (fix broken first).
- **Delivers:** Independent left/right toggles, content-column push layout (animated), auto-collapse + manual override with localStorage, full a11y.
- **Addresses:** Item 3.
- **Research flags:** **OPEN DECISION:** Which auto-collapse design (A/B/C from FEATURES.md)? Only A avoids resize-fighting. Lock during requirements. Threshold: confirm 1280px against real rendered widths (1024/1152/1280/1366). Verification: keyboard focus test, sticky scroll test, hydration warning check.

### Phase Ordering Rationale

1. Phase 1 first (diagnostic prerequisite unblocks Phase 2 scope).
2. Phase 1 ↔ Phase 2 can overlap (disjoint files).
3. Phase 2 before Phase 3 (fix bugs before new UX).
4. Phase 3 last (largest file surface, most novel patterns; lets 1–2 stabilize first).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 1:** Root cause unknown; multiple candidates. Must gather live evidence (Pitfall 5) before locking fix shape.
- **Phase 3:** Auto-collapse design decision (OPEN) must be made during requirements, not discovered mid-build.

**Phases with standard patterns (skip research-phase):**
- **Phase 2:** Proxy-redirect pattern fully spec'd, standard Next.js image config, no novel integration questions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | Verified against npm registry, GitHub API, official docs. No new dependencies; all fixes work with installed versions. |
| **Features** | MEDIUM–HIGH | Table-stakes patterns verified (W3C APG, MDN, Docusaurus, GitLab). Design trade-offs (A/B/C) documented with competing precedents; not a single universal convention. |
| **Architecture** | HIGH | All paths, dependencies verified by reading codebase. Component responsibilities concrete. Secret-gating constraint read directly from code. |
| **Pitfalls** | MEDIUM | Codebase inspection (HIGH) + best practices (MEDIUM). Deployment/testing reality from Vercel/Next.js docs (MEDIUM) + project's recorded lessons (HIGH). Some severity claims (ISR fallback reliability) rest on GitHub issues + unverified assumptions; flagged as Open Questions. |

**Overall: MEDIUM–HIGH.** Stack/architecture high-confidence. Feature design and verification procedures medium-confidence, dependent on Phase 1's live evidence capture and Phase 3's explicit design decision.

### Gaps to Address

1. **Phase 1 (Root Cause):** Actual error (status, body) from Vercel logs unknown. Pitfall 5's discriminating table covers six candidates; Phase 1 planning must reserve time for live capture + prod-vs-local comparison.

2. **Phase 3 (Auto-Collapse Design):** FEATURES.md documents Options A/B/C; only A avoids "site fights user" bugs. Needs explicit requirements decision; must not be inferred at code-time.

3. **Phase 2 (Route: Redirect vs. Stream):** Both documented as working; streaming more reliable with next/image. Recommend streaming unless explicitly verified against this deployment's Vercel config.

4. **Phase 3 (Threshold Confirmation):** 1280px proposed from grid math (more trustworthy than generic benchmarks). Before locking, measure actual rendered content-column width at 1024/1152/1280/1366 viewports.

5. **ISR Fallback Uncertainty:** Pitfall 6 flags discrepancy between Next.js docs (keep stale on regen throw) and GitHub issue #54797 (sometimes surfaces as 500). Needs direct verification against this Next 16 / Vercel configuration before Phase 1 relies on ISR as safety net.

6. **NOTION_TOKEN_V2 Status:** `notion-x.ts` defaults to unauthenticated if unset. Phase 1 planning: run `vercel env ls` to confirm whether var is actually set in Production.

7. **Notion Rate Limiting Scale:** Unknown if aggregate API call volume risks ~3 req/s average limit. Phase planning: gather actual/expected traffic before deciding whether to shorten `CONFIG.revalidate`.

## Sources

**Primary (HIGH — verified directly):**
- `.planning/PROJECT.md`, codebase reads (all key files), npm registry (direct API), GitHub REST API, official docs (Notion, Next.js, W3C WAI-ARIA, MDN, next-themes).

**Secondary (MEDIUM):**
- GitHub issue NotionX/react-notion-x#710, Docusaurus PR #8971, GitLab issues #27340/#378544/#580565, Next.js revalidation guide, Notion rate limits, off-canvas patterns.

**Tertiary (LOW/MEDIUM):**
- vercel/next.js Issue #54797, web.dev grid animations, Polypane sticky failures, Notion sharing/permissions synthesis.

---

*Research completed: 2026-08-09*
*Status: Ready for roadmap planning*
