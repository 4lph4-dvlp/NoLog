# Phase 6 — API Coverage Declaration

No external API integration: this phase writes only prose/diagrams into README.md and README_KR.md, describing Notion/Resend/Vercel integrations already built in Phases 1-5 — no new call site, SDK, endpoint, or client.

**Detector note:** `api-coverage.cjs` returned `detected: true`, but both signals (`sdk`, `api`) were matched against *prior-phase* text in `ROADMAP.md` (Phase 3's "Resend SDK + `lib/email.ts`" plan line and Phase 4's goal sentence), not against Phase 6's own scope. Phase 6's scope — `DOCS-01`, `DOCS-02`, `DOCS-03` — modifies exactly two Markdown files and zero source files. Fabricating a coverage matrix row for an integration this phase does not write would record a decision that no code in this phase can honour.

**Where the real coverage lives:** `.planning/phases/03-subscribe-path/` and `.planning/phases/04-notify-route/` own the Resend Contacts/Broadcasts and Notion API integration decisions; Phase 2's `COVERAGE.md` (18 rows, 9/9 INTEGRATE/OPT-OUT decisions) is the audited artifact for this milestone's external-API surface.

*Declared: 2026-07-29 during `/gsd-plan-phase 6`*
