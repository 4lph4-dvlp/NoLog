---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-07-26T07:11:57.236Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unrun-verify | apps/web/src/templates/terminal/PostPage.tsx |  | Terminal-template SSR probe (subscribe form marker present/absent) not run - no NOTION_TOKEN/NOTION_DATABASE_ID in this environment; carried to operator checklist per D-26 | open |  | 2026-07-26T07:11:57.236Z |  |

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
  }
]
````
