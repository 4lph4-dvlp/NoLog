# Phase 2 — API Coverage Matrix

**Produced:** 2026-07-25 (plan time)
**External API in scope:** Notion REST API v1, consumed exclusively through Phase 1's `NologClient`
(`packages/core/src/client.ts`), which this phase does not modify.

The capability surface below is the set of Notion REST capabilities reachable from a backfill
operator script. `INTEGRATE` is the default; every `OPT-OUT` carries a reason. This matrix is the
subtraction record, not a wish list.

| capability | decision | reason |
|---|---|---|
| `POST /v1/databases/{id}/query` — fetch public posts with `emailed` unchecked (via `getUnemailedPublicPosts()`) | INTEGRATE | |
| Query pagination (`start_cursor` / `next_cursor`, `page_size: 100`) | INTEGRATE | Handled inside `getUnemailedPublicPosts()`; the script consumes the complete returned array, so a >100-post back catalog drains in one run |
| Query sort (`created_time` ascending) | INTEGRATE | Script preserves the returned order; it never re-sorts or reverses |
| `PATCH /v1/pages/{id}` — set the `emailed` checkbox (via `markEmailed()`) | INTEGRATE | |
| 403 response — integration lacks "Update content" capability | INTEGRATE | Classified via `NotionCapabilityError` → D-04 abort-immediately with one message |
| 400 response — `emailed` property absent from the database schema | INTEGRATE | Classified via `MissingEmailedPropertyError` → D-05 abort-immediately |
| 429 response status — rate limited | INTEGRATE | Detected from `patchPage()`'s generic Error message prefix → D-07 single retry with fixed backoff |
| 529 response status — service overloaded | INTEGRATE | Notion's own rate-limit documentation directs callers to handle 529 identically to 429; one extra alternation, no cost on the 429 path (02-RESEARCH.md assumption A3, resolved by planner discretion) |
| Documented ~3 req/s rate limit | INTEGRATE | Fixed 400ms inter-request delay (~2.5 req/s, ~17% headroom) per D-09/D-10 |
| `Retry-After` response header on a 429 | OPT-OUT | `patchPage()` surfaces only the response body text through the thrown `Error`'s message — never the `Response` object or its headers — and this phase's boundary forbids changing `packages/core/src/client.ts`. D-14 locks fixed-backoff-only. Reinstating this is a purely additive change Phase 4 can make on its own terms. |
| Notion structured error `code` field / request id | OPT-OUT | Not surfaced by `patchPage()`; the thrown message already carries the status code plus body text, which is sufficient for both the D-07 retry decision and the D-06 per-post failure log |
| `POST /v1/pages` (create page) | OPT-OUT | Not needed — a backfill only flips an existing checkbox; it never creates content |
| Page archive / delete (`PATCH` with `archived: true`) | OPT-OUT | Not needed, and deliberately out of reach: this tool must never destroy a forker's posts |
| Any property write other than the `emailed` checkbox | OPT-OUT | Phase 1 D-04 locked `markEmailed()` to write ONLY the checkbox — no timestamp, no "emailed date" property |
| `GET /v1/blocks/{id}/children` (block content) | OPT-OUT | Not needed — the backfill logs only `post.id` and `post.title`; post bodies are irrelevant to marking |
| `/v1/users`, `/v1/comments`, `/v1/search` | OPT-OUT | Not needed for a backfill; no phase requirement touches them |
| Notion webhooks / database automations as a trigger | OPT-OUT | Explicitly Out of Scope in `REQUIREMENTS.md` — requires a paid Notion plan and would silently break for free-plan forkers |
| Notion OAuth / public-integration auth flow | OPT-OUT | The project uses a single internal integration token (`NOTION_TOKEN`) per fork; no multi-tenant auth surface exists |

## Notes

- This phase adds no new API client code. Every INTEGRATE row above is satisfied by Phase 1's
  already-shipped, live-verified `NologClient` methods; Phase 2 only calls them and classifies what
  they throw.
- No packages are installed (`02-RESEARCH.md` § Package Legitimacy Audit: not applicable), so no
  package-legitimacy checkpoint applies. The supply-chain consideration for ad-hoc `npx tsx`
  resolution is recorded as threat `T-02-SC` in `02-01-PLAN.md`.
