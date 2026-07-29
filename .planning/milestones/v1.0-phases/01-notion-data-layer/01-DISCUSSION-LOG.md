# Phase 1: Notion Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 1-Notion Data Layer
**Areas discussed:** Missing Emailed property, Unpublish/republish behavior, 403 diagnostic visibility, Emailed Date property

---

## Missing Emailed property

| Option | Description | Selected |
|--------|-------------|----------|
| Fail loud and clear | Throw a specific, clearly-worded error ("Emailed property not found — add it in Notion first, see README") that stops the pipeline until the forker adds the property. Matches the fail-closed theme. | ✓ |
| Let Notion's own error surface as-is | Don't add custom handling — whatever error Notion's API returns for a filter on a nonexistent property propagates/logs generically. | |
| You decide | Claude picks a reasonable approach during planning. | |

**User's choice:** Fail loud and clear (recommended option)
**Notes:** None beyond the selection.

---

## Unpublish/republish behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Never re-notify | Emailed stays true permanently once set — a post only ever triggers one email, regardless of unpublish/republish cycles. | ✓ |
| Reset Emailed on republish | Un-publishing clears the Emailed flag, so republishing re-notifies subscribers. Requires new transition-detection logic. | |
| You decide | Claude picks a reasonable approach during planning. | |

**User's choice:** Never re-notify (recommended option)
**Notes:** None beyond the selection.

---

## 403 diagnostic visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Typed error, caught upstream | markEmailed throws a specific error type/shape that Phase 4's notify route can catch and log distinctly from generic failures. | ✓ |
| Tagged console.error only | Match the existing repo convention (e.g. `[OG Route Error]`-style tagged console.error), no custom error type. | |
| You decide | Claude picks a reasonable approach during planning. | |

**User's choice:** Typed error, caught upstream (recommended option)
**Notes:** Directly motivated by PITFALLS.md Pitfall 5 (missing capability causes a duplicate-email storm, not a benign no-op).

---

## Emailed Date property

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox only | Just the Emailed boolean, as already scoped in REQUIREMENTS.md. | ✓ |
| Add an Emailed Date property | Also write a timestamp alongside the checkbox, for visibility in Notion. | |
| You decide | Claude picks a reasonable approach during planning. | |

**User's choice:** Checkbox only (recommended option)
**Notes:** None beyond the selection.

---

## Claude's Discretion

None — all four areas received explicit user decisions.

## Deferred Ideas

None raised during this discussion. All four areas stayed within Phase 1's data-layer boundary.
