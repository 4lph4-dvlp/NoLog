# API Coverage — Phase 10 (Collapsible Sidebars & Reading Width)

No external API integration: this phase is client-side layout, CSS and React state only — collapsible
sidebars plus a post-detail reading-width cap on the `default` template.

## Why this is a declaration rather than a matrix

The `api-coverage.verify-pre` gate reported `detected: true` with a single signal —
`{"verb": "(surface)", "noun": "api"}`. That is a false positive, and the capability contract's own
escape hatch covers it ("the detector is deterministic, not infallible — confirm by re-reading the
phase scope, not by preference"). Confirmed empirically rather than by preference:

| Check | Result |
|---|---|
| Outbound network calls in the 9 changed source files (`fetch(` / `axios` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `http(s)://` literals) | **0** |
| New npm dependencies added by this phase | **0** (REQUIREMENTS.md D-07 forbids them) |
| Occurrences of the word `api` in the 9 changed **source** files | **0** |
| Occurrences of the word `api` in this phase's **planning prose** | 10 |

The detector matched this phase's own planning artifacts, not its code. The `api` mentions in those
artifacts refer to **browser platform APIs** discussed during verification — CDP
`Accessibility.getFullAXTree`, `Emulation.setEmulatedMedia`, `matchMedia`, the `inert` attribute — and
to pre-existing routes owned by earlier phases (`/api/thumbnail/[id]` from Phase 9,
`/api/subscribe` and `/api/notify-subscribers` from v1.0). None of those are integrated, wrapped,
consumed or newly connected by Phase 10.

At **plan time** the same detector, run over the phase scope before this phase's artifacts existed,
returned `detected: false` — recorded in the plan-phase dispatch for this phase. The disagreement is
purely an artifact of the scope growing to include the phase's own prose.

## What this phase actually touches

`apps/web/src/lib/sidebar.ts` (threshold constant, `localStorage` keys, strict allowlist parse),
`apps/web/src/components/layout/SidebarShell.tsx` + `SidebarToggleLeft.tsx` + `SidebarToggleRight.tsx`
(React client components), `apps/web/src/app/globals.css` (`@property` registrations, attribute-scoped
custom-property overrides, reduced-motion-guarded transition), `apps/web/src/app/layout.tsx`
(pre-hydration inline script), `apps/web/src/templates/default/Layout.tsx` and `PostPage.tsx` (layout
and the 1100px prose cap), `apps/web/src/components/Profile.tsx` (root `<aside>` → `<div>` landmark
fix).

The only persistence is `localStorage` on the visitor's own device — no service, no credential, no
egress. `packages/core` is untouched.

---
*Declared: 2026-08-13 during Phase 10 verify-work (verify:pre api-coverage gate)*
