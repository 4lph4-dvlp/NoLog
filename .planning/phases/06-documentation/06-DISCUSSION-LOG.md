# Phase 6: Documentation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 6-Documentation
**Areas discussed:** Doc structure & placement, Silent-failure gotchas callout, Resend setup depth, Diagram & feature list updates

---

## Doc structure & placement

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated section | New top-level "Email Notifications (Optional)" section, all setup steps sequenced together | ✓ |
| Blend into existing steps | Add steps into "Vercel Deployment" list and merge env vars into the existing block | |
| Hybrid | Env vars in existing block; longer steps (Notion capability, Resend verification) in a separate subsection | |

**User's choice:** New dedicated section.

---

## Section placement

| Option | Description | Selected |
|--------|-------------|----------|
| Right after "Vercel Deployment" | Core deploy flow stays uninterrupted; optional section immediately follows, before env var reference block | ✓ |
| End of document (after Templates) | Doesn't interrupt core flow at all, placed last as fully optional | |
| Right after "Environment Variables" | Closest to the env var reference | |

**User's choice:** Right after "Vercel Deployment".

---

## Env var placement

| Option | Description | Selected |
|--------|-------------|----------|
| Separate code block inside new section | Existing "Environment Variables" block stays limited to NOTION_TOKEN/NOTION_DATABASE_ID/CUSDIS | ✓ |
| Merge into existing block | All env vars (required + optional) in one block with comments marking optional ones | |

**User's choice:** Separate code block inside new section.

**Notes:** User confirmed no further questions on structure/placement — moved to next area.

---

## Silent-failure gotchas callout

| Option | Description | Selected |
|--------|-------------|----------|
| Inline warnings at each step | Warning appears directly under the relevant setup step | ✓ |
| Separate "Troubleshooting" subsection | All gotchas collected at the end of the new section | |
| Both | Inline warnings plus an end-of-section checklist recap | |

**User's choice:** Inline warnings at each step.

---

## Notion "Update content" capability step

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit, separate email-specific step | Distinguished from the existing step 4 ("Connections" → add integration, read-only) | ✓ |
| Modify existing step 4 | Add a conditional note to the original 4-step list instead | |

**User's choice:** Explicit, separate email-specific step.

---

## 'emailed' Notion property

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit name + type | States "emailed" (Checkbox), warns name must match exactly (case-sensitive) | ✓ |
| Brief mention only | States a property is needed without naming it precisely | |

**User's choice:** Explicit name + type.

**Notes:** User confirmed no further questions on gotchas callout — moved to next area.

---

## Resend setup depth

| Option | Description | Selected |
|--------|-------------|----------|
| Step-by-step summary + official docs link | Numbered summary of the flow, links to Resend's domain-verification docs for exact UI steps | ✓ |
| Full step-by-step detail | Screenshot-level walkthrough of Resend's dashboard | |
| One-line mention + link only | Minimal text, defers everything to the external link | |

**User's choice:** Step-by-step summary + official docs link.

---

## Resend quota wording

| Option | Description | Selected |
|--------|-------------|----------|
| State both figures with disambiguation | States the correct Broadcast/Audience figure (1,000 contacts/month) and explicitly rules out the 100/day transactional figure | ✓ |
| Correct figure only | States only "up to 1,000 contacts/month" without addressing the wrong number | |

**User's choice:** State both figures with disambiguation.

**Notes:** User confirmed no further questions on Resend setup depth — moved to next area.

---

## Diagram & feature list updates

| Option | Description | Selected |
|--------|-------------|----------|
| Update both | Diagram gets a Resend node/flow; Core Services and Features tables get new rows/bullets | ✓ |
| Features table only | Diagram left as a simplified core-flow-only diagram | |
| No changes | Email feature documented only in the new section's prose | |

**User's choice:** Update both.

---

## Cron trigger flow in diagram

| Option | Description | Selected |
|--------|-------------|----------|
| New separate "Notifications" subgraph | Vercel Cron → Notify Route → Resend → Subscriber, parallel to existing subgraphs | ✓ |
| Add node to existing "Application Layer" subgraph | No new subgraph; Resend node added into the existing application layer | |

**User's choice:** New separate "Notifications" subgraph.

**Notes:** User confirmed no further questions — discussion concluded, ready for CONTEXT.md.

---

## Claude's Discretion

- Exact English/Korean wording for the new section's heading, step text, and warning callouts.
- Exact Resend documentation URL(s) to link for domain/SPF/DKIM verification and pricing/quota — verified live, not assumed.
- Exact mermaid node/edge labels and styling for the new `Notifications` subgraph — follow existing diagram conventions.
- Whether the new section uses numbered steps or a mixed steps+subsections format.
- Exact wording of the Notion "Update content" capability step and its failure-consequence warning.

## Deferred Ideas

None — all four areas stayed within Phase 6's documentation boundary. No scope creep occurred.
