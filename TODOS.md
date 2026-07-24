# TODOS

Deferred work, tracked so it doesn't get lost. Newest first.

## From eng review of email subscription plan (2026-07-24)

- **No test framework exists in this repo** — zero `jest`/`vitest`/`playwright` config, zero `*.test.*`/`*.spec.*` files anywhere. Discovered while planning the email subscription feature's test coverage (17 identified gaps, 0% coverage since there's nothing to write tests into). Adding a framework is a separate, larger undertaking than any one feature — tracked here so it isn't silently repeated as a finding on every future feature plan. Once a framework exists, the test diagram in the `plan-eng-review` output for this feature (design doc / CEO plan directory) is the checklist to implement against.

## From email subscription feature planning (2026-07-24)

- **RSS feed (`/feed.xml`)** — a second, zero-infra channel for "notify readers of new posts," reading the same `getPosts()` data the blog already fetches. No new dependency, no env vars, works for every forker immediately. Deferred from the email-subscription plan; not blocking it.
- **On-site "new post" indicator for return visitors** — a small badge/dot shown when there's a post newer than the visitor's last view (cookie or localStorage timestamp). Independent of the email/Resend feature entirely — different blast radius, needs its own design/review pass (SSR/hydration care required for the client-side state).
- **Generic "on-publish" hook abstraction** — considered and explicitly skipped as premature abstraction (only one consumer — email — exists today). Revisit only if/when a second notification channel (Slack, Discord, RSS-as-push, etc.) is actually being built.

## From GSD project setup (2026-07-24)

- ~~Batch same-day multiple publishes into one email~~ — **pulled into v1 scope** during `/gsd-new-project` roadmap review (see `.planning/REQUIREMENTS.md` NOTIFY-05). No longer deferred; kept here only as a pointer since it was previously listed above.
