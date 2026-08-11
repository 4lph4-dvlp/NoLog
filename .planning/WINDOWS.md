---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 0
total_count: 7
last_updated: 2026-08-11T23:04:35.236Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unrun-verify | apps/web/src/templates/terminal/PostPage.tsx |  | Terminal-template SSR probe (subscribe form marker present/absent) not run - no NOTION_TOKEN/NOTION_DATABASE_ID in this environment; carried to operator checklist per D-26 | open |  | 2026-07-26T07:11:57.236Z |  |
| 2 | 10 | unrun-verify | .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md |  | SIDE-10 live subscribe submit-and-response round trip UNEXERCISED — harness auto-mode classifier blocked the side-effecting fill+submit against production Resend/PII | open |  | 2026-08-11T23:04:22.240Z |  |
| 3 | 10 | unrun-verify | .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md |  | A11Y-04 simultaneous JS-bypass + real-engine prefers-reduced-motion combination UNEXERCISED — CDP Emulation.setEmulatedMedia not on the /browse tool's allowlist | open |  | 2026-08-11T23:04:22.393Z |  |
| 4 | 10 | unrun-verify | .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md |  | E7 wide-table/code-block/long-title overflow backstop UNEXERCISED against real content — operator's 3 published posts contain 0 tables/code blocks; a same-CSS-class synthetic proxy was exercised instead | open |  | 2026-08-11T23:04:22.545Z |  |
| 5 | 10 | unrun-verify | .planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md |  | ROADMAP SC#5 sticky check UNEXERCISED at meaningful scroll depth on the home page — only 3 real posts give 900px of scroll room; post-page check fully passed | open |  | 2026-08-11T23:04:22.694Z |  |
| 6 | 10 | deviation | .planning/phases/10-collapsible-sidebars-reading-width/10-04-PLAN.md |  | Plan-authoring deviation: literal 'transition-colors' grep in Task 2's own verify is over-broad (matches Tailwind's unrelated utility class in 9+ files); precise classList-scoped grep substituted instead | open |  | 2026-08-11T23:04:35.082Z |  |
| 7 | 10 | deviation | apps/web/src/components/PostThumbnailImage.tsx |  | Out-of-scope: React 'state update on unmounted component' console error reproducible on /post/[id] hard navigation, not on home — logged to deferred-items.md, not fixed (unrelated to Phase 10's SidebarShell changes) | open |  | 2026-08-11T23:04:35.236Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "apps/web/src/templates/terminal/PostPage.tsx",
    "line": null,
    "description": "Terminal-template SSR probe (subscribe form marker present/absent) not run - no NOTION_TOKEN/NOTION_DATABASE_ID in this environment; carried to operator checklist per D-26",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-26T07:11:57.236Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md",
    "line": null,
    "description": "SIDE-10 live subscribe submit-and-response round trip UNEXERCISED — harness auto-mode classifier blocked the side-effecting fill+submit against production Resend/PII",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:22.240Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md",
    "line": null,
    "description": "A11Y-04 simultaneous JS-bypass + real-engine prefers-reduced-motion combination UNEXERCISED — CDP Emulation.setEmulatedMedia not on the /browse tool's allowlist",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:22.393Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md",
    "line": null,
    "description": "E7 wide-table/code-block/long-title overflow backstop UNEXERCISED against real content — operator's 3 published posts contain 0 tables/code blocks; a same-CSS-class synthetic proxy was exercised instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:22.545Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "10",
    "file": ".planning/phases/10-collapsible-sidebars-reading-width/10-EVIDENCE.md",
    "line": null,
    "description": "ROADMAP SC#5 sticky check UNEXERCISED at meaningful scroll depth on the home page — only 3 real posts give 900px of scroll room; post-page check fully passed",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:22.694Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "10",
    "file": ".planning/phases/10-collapsible-sidebars-reading-width/10-04-PLAN.md",
    "line": null,
    "description": "Plan-authoring deviation: literal 'transition-colors' grep in Task 2's own verify is over-broad (matches Tailwind's unrelated utility class in 9+ files); precise classList-scoped grep substituted instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:35.082Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "deviation",
    "phase": "10",
    "file": "apps/web/src/components/PostThumbnailImage.tsx",
    "line": null,
    "description": "Out-of-scope: React 'state update on unmounted component' console error reproducible on /post/[id] hard navigation, not on home — logged to deferred-items.md, not fixed (unrelated to Phase 10's SidebarShell changes)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-11T23:04:35.236Z",
    "resolved_at": null
  }
]
````
