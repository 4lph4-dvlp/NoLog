# Phase 6: Documentation - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A forker can configure and safely enable the email subscription feature using only `README.md`/`README_KR.md`, with none of the feature's known silent-failure traps left undocumented. This phase writes documentation only — no application code, no `vercel.json` changes, no new env vars or config fields. It covers DOCS-01, DOCS-02, DOCS-03 (`.planning/REQUIREMENTS.md`), which already lock WHAT must be documented (env vars, the `emailed` Notion property, the "Update content" capability grant, Resend domain/SPF/DKIM verification, the correct free-tier quota, and the UTC/Production-only cron behavior). This discussion resolved HOW to present that content in the two README files — structure, placement, level of detail, and whether the architecture diagram/feature tables get updated.

Out of scope: any code change to the notify route, subscribe route, or `vercel.json` (all complete, Phases 1–5); any new documentation file beyond `README.md`/`README_KR.md` (e.g., no new `apps/web/docs/*.md` file for this feature — unlike the Template Guide, which is a separate authoring guide for a different audience).

</domain>

<decisions>
## Implementation Decisions

### Doc structure & placement

- **D-01:** The email feature gets a **new, dedicated section** in both README files — `## Email Notifications (Optional)` (English) / the equivalent Korean heading in `README_KR.md` — rather than being folded into the existing "Vercel Deployment" numbered steps or "Environment Variables" fenced block the way `NEXT_PUBLIC_CUSDIS_APP_ID` is handled today. Rationale: this feature has far more setup steps (Notion property, Notion capability grant, Resend account + domain verification, 4 env vars) and more failure points than Cusdis's single env var; folding it into the existing flow would blur which steps are core-blog-required vs. optional-feature-required.
- **D-02:** The new section is placed **immediately after "Vercel Deployment"**, before "Environment Variables". Rationale: keeps the core deploy flow (fork → Notion → Vercel → done) uninterrupted for forkers who don't want email, while putting the optional section where a forker who scrolls past deployment will naturally see it next, ahead of the env var reference block it partially duplicates.
- **D-03:** The email feature's env vars (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `CRON_SECRET`, `NOTIFY_PHYSICAL_ADDRESS`) get their **own fenced code block inside the new section**, not merged into the existing "Environment Variables" block. The existing block stays limited to `NOTION_TOKEN`/`NOTION_DATABASE_ID`/`NEXT_PUBLIC_CUSDIS_APP_ID`. Rationale: keeps the optional-feature framing structurally visible (a forker who never opens the new section never sees these 4 vars at all), matching this project's "off-by-default, config-gated" contract expressed in documentation, not just in code.

### Silent-failure gotchas callout

- **D-04:** Known failure traps (Notion "Update content" capability, Resend quota confusion, cron UTC/Production-only behavior) are documented as **inline warnings at the exact setup step they apply to**, not collected into a separate "Troubleshooting" subsection. Rationale: a forker configuring the feature step-by-step is far more likely to see and heed a warning right where the mistake would happen than to have read a troubleshooting list in advance or think to check it after something silently fails.
- **D-05:** The Notion "Update content" capability grant is documented as its **own explicit step**, clearly distinguished from the existing step 4 ("Connections" → add integration to the database). That existing step only grants read access; this phase's new step tells the forker to additionally enable "Update content" (or the local-language equivalent) on the same integration, and states the consequence of skipping it (`markEmailed()` fails with a 403 — new subscribers get the same post emailed to them repeatedly on every cron run since the post is never marked sent). This satisfies DOCS-01's explicit requirement that this capability be its own separately-labeled step, not folded into "set env vars".
- **D-06:** The `emailed` Notion property instructions state the **exact property name and type** — `emailed`, Checkbox — and explicitly warn that the name must match exactly (case-sensitive) or `NologClient` throws `MissingEmailedPropertyError`. Rationale: this repo's Notion property names are lowercase-first camelCase (confirmed in Phase 1, see `.planning/PROJECT.md` Key Decisions), a convention a forker copying "Emailed" or "Email Sent" from intuition would violate.
- **D-07 (cron timing note placement):** The UTC-only / Production-deployment-only cron behavior (DOCS-03) is documented as an **inline note near wherever the cron schedule is described** in the new section — not a separate section — consistent with D-04's inline-warning approach. It should reference that the shipped default (`0 11 * * *` in `vercel.json`) targets 8 PM KST and point forkers at `vercel.json`'s `schedule` field to change it for their own audience's timezone, per Phase 5's `05-CONTEXT.md` D-03.

### Resend setup depth

- **D-08:** Resend account creation and domain/SPF/DKIM verification are documented as a **numbered step-by-step summary that links out to Resend's own domain-verification documentation** for the exact click path — not a full screenshot-level walkthrough, and not a one-line mention with only an external link. Rationale: a full step-by-step recreation of Resend's UI would go stale whenever Resend changes its dashboard; a bare one-liner risks under-serving DOCS-02's requirement that this be documented as a **mandatory** step, not an aside forkers might skip past.
- **D-09:** The Resend free-tier quota line states **both figures explicitly** — the correct Broadcast/Audience quota this feature actually uses (up to 1,000 contacts/month, unlimited sends) — **and** an explicit disambiguation that this is different from the 100/day transactional Send API cap, which does not apply here. Rationale: this exact confusion is independently documented as a known research-stage risk — `.planning/research/PITFALLS.md` Pitfall 1 records that this project's own earlier planning docs conflated the two Resend quota systems, and its recommended fix (§21) is precisely this both-numbers framing, not just stating the correct one in isolation.

### Diagram & feature list updates

- **D-10:** Both the mermaid architecture diagram and the "Core Services"/"Features" tables in both README files are **updated** to reflect the email feature, not left as pre-feature snapshots covered only by the new section's prose. Rationale: consistency with how Cusdis is already represented in all three places (diagram node, Core Services row, Features bullet) — leaving email out of the diagram/tables while Cusdis appears there would read as an inconsistency to anyone comparing the two optional features.
- **D-11:** The diagram change adds a **new, separate `Notifications` subgraph** (`Vercel Cron -> Notify Route -> Resend -> Subscriber`), parallel to the existing "Content Management"/"Application Layer"/"Visitors" subgraphs — not a node added into the existing "Application Layer" subgraph. Rationale: the cron-triggered notify flow is a genuinely separate trigger path (scheduled, not request-driven like the rest of the diagram) and folding it into "Application Layer" would misrepresent it as another user-facing render path.

### Claude's Discretion

- Exact English/Korean wording for the new section's heading, step text, and warning callouts beyond what D-01 through D-11 fix.
- Exact Resend documentation URL(s) to link for D-08 (domain/SPF/DKIM verification) and D-09 (pricing/quota page) — use Resend's current official docs, verified live rather than assumed.
- Exact mermaid node/edge labels and styling for the new `Notifications` subgraph (D-11) — follow the existing diagram's label conventions (e.g., action-labeled edges like `-->|Deploy|`).
- Whether the new "Email Notifications (Optional)" section uses numbered steps (matching "Vercel Deployment") or a mixed steps+subsections format (given it also needs prose warnings per D-04/D-05/D-07) — planner's call.
- Exact wording of the Notion "Update content" capability step (D-05) and its failure-consequence warning — follow the project's existing warning-tone conventions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` §Documentation (DOCS) — DOCS-01, DOCS-02, DOCS-03, the exact requirement wording this phase must satisfy
- `.planning/ROADMAP.md` §Phase 6: Documentation — the Goal and the 3 success criteria the plan must satisfy
- `.planning/PROJECT.md` §Active — the Phase 6 checklist already drafted there (env vars, quota figure, capability requirement)
- `.planning/PROJECT.md` §Constraints — Vercel Hobby tier limits (cron once/day, ±59min precision, UTC-only), `maxDuration` confirmed 300s

### Research (2026-07-24 session)
- `.planning/research/PITFALLS.md` Pitfall 1 ("Wrong Resend product quota gets documented and designed against") — the exact confusion D-09's both-numbers framing exists to prevent; read in full, including its §21 recommended fix wording
- `.planning/research/PITFALLS.md` Pitfall 2 ("Domain verification is a hard prerequisite that fails silently as 'it just doesn't send'") — motivates D-08's mandatory-step framing
- `.planning/research/PITFALLS.md` Pitfall 4 — cron only fires on Production deployments, UTC-only; directly informs D-07's inline cron-timing note
- `.planning/research/PITFALLS.md` Pitfall 5 — missing Notion "Update content" capability causes 403 on `markEmailed`, combined with mark-after-send ordering, causing a duplicate-email storm; the exact consequence D-05's warning text must state accurately

### Existing Codebase (files the new README section describes)
- `README.md` / `README_KR.md` — the two files this phase edits; read both in full before planning to match existing tone, heading levels, and the English/Korean parity convention
- `apps/web/src/app/api/notify-subscribers/route.ts` lines 196–223, 251–259 — the exact env vars read (`CRON_SECRET`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `NOTIFY_PHYSICAL_ADDRESS`, `NOTIFY_BATCH_SIZE`) and their fail-closed config gate, ground truth for D-03's code block
- `apps/web/src/app/api/subscribe/route.ts` lines 300–321 — `RESEND_API_KEY`/`RESEND_AUDIENCE_ID` fail-closed gate for the subscribe path
- `apps/web/src/site.config.ts` lines 40–51 — `CONFIG.notify.fromAddress` and the comment documenting why `NOTIFY_PHYSICAL_ADDRESS` is an env var, not a config field (a forker-privacy rationale worth surfacing in the new README section's warning text)
- `apps/web/src/lib/email.ts` — `getResend()` lazy accessor; confirms `RESEND_API_KEY` is the only Resend credential the forker needs
- `packages/core/src/client.ts` — `NotionCapabilityError`, `MissingEmailedPropertyError` — the exact typed errors D-05/D-06's warnings describe the consequence of triggering
- `vercel.json` — the `crons` entry (`"0 11 * * *"`), ground truth for D-07's default-schedule note
- `apps/web/docs/TEMPLATE_GUIDE.md` / `TEMPLATE_GUIDE_KR.md` — existing precedent for a feature-specific doc file, referenced only to confirm D-01's decision NOT to create an equivalent separate file for this feature (email docs stay inline in the README)

### Prior Phase Context (carried forward)
- `.planning/phases/05-production-cutover/05-CONTEXT.md` D-02/D-03 — the cron schedule's default value (`0 11 * * *` = 8 PM KST) and its rationale, and the explicit note that "Phase 6's README should note this default is KST-oriented and point forkers at `vercel.json`'s `schedule` field" — directly implemented by this phase's D-07
- `.planning/phases/04-notify-route/04-CONTEXT.md` D-06 (revised) — why `NOTIFY_PHYSICAL_ADDRESS` is an env var rather than a `site.config.ts` field (public-repo privacy exposure); relevant context for how the new section explains this env var
- `.planning/phases/03-subscribe-path/03-CONTEXT.md` D-04 — the single-env-gate-per-feature security rationale, useful background for why this phase documents all 4 notify-side env vars together rather than piecemeal
- `.planning/phases/01-notion-data-layer/01-CONTEXT.md` and `.planning/PROJECT.md` Key Decisions — the lowercase-first-camelCase Notion property naming convention (`emailed`, not `Emailed`), the exact fact D-06's warning states

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `README.md`'s existing "Vercel Deployment" numbered list and "Environment Variables" fenced block — the structural pattern (numbered steps, then a `bash` code block of env vars with an inline "optional" note) this phase's new section extends, per D-01/D-02/D-03
- `README.md`'s existing mermaid diagram (`Content Management` / `Application Layer` / `Visitors` subgraphs) — the pattern D-11's new `Notifications` subgraph must match stylistically (action-labeled edges, consistent node shape)

### Established Patterns
- Every optional/env-gated feature in this repo (Cusdis today) is documented with: one line in the intro diagram, one row in "Core Services", one bullet in "Features", and an explicit "optional, unset to disable" note next to its env var. D-10/D-11 extend this exact pattern to the email feature rather than inventing a new documentation shape.
- English/Korean parity: every README.md section has a 1:1 README_KR.md counterpart at the same heading position. The new "Email Notifications (Optional)" section must be added to both files in the same relative position (per D-02).

### Integration Points
- `README.md` — new `## Email Notifications (Optional)` section after "Vercel Deployment"; mermaid diagram gets a new subgraph; "Core Services" table gets a new Resend row; "Features" list gets a new bullet
- `README_KR.md` — identical structural changes, Korean translation, maintaining the existing "[English Version](./README.md)" / "[Korean Version](./README_KR.md)" cross-link pattern at the top of each file

</code_context>

<specifics>
## Specific Ideas

The user's guiding principle across all four areas was **parity with how Cusdis is already documented, scaled up for a feature with more setup steps and more failure modes**. Cusdis gets one env var and one line; the email feature needs its own section because it has ~6 discrete setup actions (Notion property, Notion capability, Resend account, domain verification, 4 env vars, understanding the cron schedule) each of which can silently fail if skipped or misconfigured. Rather than inventing new documentation conventions, every decision maps an existing README pattern onto the larger feature: the "optional feature" framing that gates Cusdis's line in "Environment Variables" becomes a whole optional section (D-01); the diagram/table representation Cusdis already gets is extended in kind (D-10/D-11), not treated differently.

The second consistent thread — carried directly from this project's "fail-closed, not fail-open" theme that recurred through Phases 1–5 — is that warnings belong **at the point of failure, not in a separate reference list** (D-04, D-05, D-07). This mirrors the code-level pattern established across the feature (distinguishable log lines at each fail-closed gate) applied to documentation: a forker should encounter the warning exactly where they're about to make the mistake, not have to have already read a troubleshooting appendix.

The third thread is precision on numbers that are easy to get subtly wrong: the Resend quota (D-09) and the exact Notion property name/type (D-06) are both places where this project's own history shows the wrong-but-plausible value getting written down (`.planning/research/PITFALLS.md` Pitfall 1 for quota; Phase 1's CR-01 misdiagnosis-then-revert for Notion property casing). Both decisions respond by stating the correct value explicitly alongside the wrong one being ruled out, rather than stating only the correct value in isolation.

</specifics>

<deferred>
## Deferred Ideas

None raised during this discussion — all four areas stayed within Phase 6's documentation boundary. No scope creep occurred.

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 6.

</deferred>

---

*Phase: 6-Documentation*
*Context gathered: 2026-07-29*
