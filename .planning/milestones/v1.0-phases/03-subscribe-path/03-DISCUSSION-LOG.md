# Phase 3: Subscribe Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 3-Subscribe Path
**Areas discussed:** Form placement & template coverage, Post-submit UX & copy, Rate limit policy & blocked response, Bot blocking & email validation
**Second pass (2026-07-26):** Resubscribe handling, Resend SDK vs raw fetch, Route response contract, Logging & PII policy, Verification split

---

## Form placement & template coverage

### Q1 — Where does the subscribe form appear on the site?

| Option | Description | Selected |
|--------|-------------|----------|
| Post bottom (next to comments) — recommended | Mirrors the `comments/` convention and the placement `.planning/research/ARCHITECTURE.md` suggests; highest-intent moment | ✓ (later reversed) |
| Profile sidebar | Under `Profile` in the default template's right sidebar; always visible, but terminal has no sidebar | |
| Post bottom + home feed bottom | Both surfaces; more exposure, more duplicated state handling | |

**User's choice:** Initially "post bottom", then explicitly reversed during Q2.
**Notes:** See Q2 — the reversal and its reasoning are recorded there.

### Q2 — How is the form handled in the terminal (CLI emulation) template?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the same component as-is — recommended | What `CommentSection` does today: identical markup in both templates, no style branch | |
| Add a terminal-specific variant | CLI-prompt aesthetic; two presentations, one behavior | ✓ |
| Omit from terminal | Default template only | |

**User's choice:** Terminal-specific variant — **and reversed Q1 in the same answer**: default template = under the Profile card, terminal template = below the post.
**Notes:** Reasoning, in the user's words: the two templates have different visual styles, and a third-party developer may build a new template by referencing both — so the per-template placement and variant is the pattern worth establishing. This became the organizing principle for the whole area (CONTEXT.md D-01/D-02) and is the single most consequential input of the session.

### Q3 — Mobile: `Profile` is at the very top of the screen in the default template

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop sidebar only — recommended | Skip the `md:hidden` block; mobile visitors get no subscribe surface in the default template | |
| Mobile: move to bottom of feed | Preserves context but adds a third render point in `Layout.tsx` | |
| Mobile: keep it under Profile as-is | No responsive branch; form sits at the head of the page on mobile | ✓ |

**User's choice:** Keep it under `Profile` on mobile too.
**Notes:** Consistency of the "it lives under the profile card" rule was preferred over optimizing for scroll position.

### Q4 — Where does the env gate (SEC-03 fail-closed point) live, now that variants exist?

| Option | Description | Selected |
|--------|-------------|----------|
| One gate + variant prop — recommended | One `SubscribeSection` reads env, renders `null` or `<SubscribeForm variant=... />` | ✓ |
| One gate + two form components | Single gate, two sibling client components | |
| Two per-template Sections | Each template owns its gate — N copies of the security check | |

**User's choice:** One gate + `variant` prop.
**Notes:** Keeps the number of places a future template author could break fail-closed at exactly one, while the visual variation D-02 asked for lives entirely in presentation.

---

## Post-submit UX & copy

### Q1 — What does the visitor see on success?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace form with message — recommended | Input and button disappear; inline confirmation in their place | ✓ |
| Keep form + note below | Allows a second address, but invites repeat submits that trip the rate limit | |
| Toast/snackbar | No toast system exists in the repo; would need building for two templates | |

**User's choice:** Replace the form with an inline message.

### Q2 — How is form copy managed?

| Option | Description | Selected |
|--------|-------------|----------|
| CommentSection pattern — recommended | `CONFIG.site.locale === "ko"` ternaries hardcoded in the component | ✓ |
| Add a subscribe block to `site.config.ts` | Forker-editable copy, but diverges from how `CommentSection` does it and adds a setting Phase 6 must document | |
| English only | Simplest, but leaves comments in Korean and subscribe in English on the same page | |

**User's choice:** Follow `CommentSection` exactly.

### Q3 — What is shown on a genuine server error?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline generic error + keep form — recommended | Cause-free message, entered value preserved, retry possible | ✓ |
| Distinct copy for malformed input vs. server error | More helpful, but more response branches to audit for enumeration safety | |
| Make failure look like success | Maximally opaque, but the visitor leaves believing they subscribed | |

**User's choice:** Inline generic error, form preserved.
**Notes:** Framed explicitly against SUB-03 — "already subscribed" is not a failure and never reaches this branch.

### Q4 — Is the success state remembered across reloads/navigation?

| Option | Description | Selected |
|--------|-------------|----------|
| No persistence (memory only) — recommended | `useState` only; duplicate submits absorbed server-side by SUB-03 | ✓ |
| `localStorage` persistent | Hides the form permanently per browser, but can disagree with server truth after an unsubscribe | |
| `sessionStorage` per-session | Precedent exists (`nolog_last_path` in the terminal template) but the payoff is small | |

**User's choice:** No persistence.

---

## Rate limit policy & blocked response

### Q1 — Where does the rate-limit counter live?

| Option | Description | Selected |
|--------|-------------|----------|
| Module-scoped in-memory `Map` — recommended | Zero deps, zero infra; per-instance and cold-start-resetting, so a dampener not a gate | ✓ |
| Delegate to Vercel firewall rules | Platform-level, clean code, but requires per-forker dashboard setup and breaks "fork + set env vars = done" | |
| Honeypot only, skip rate limiting | Simplest, but leaves SUB-04 unsatisfied | |

**User's choice:** In-memory `Map` in the route module.
**Notes:** Presented with its limitations stated up front; Redis/KV was already excluded by the no-new-infrastructure constraint.

### Q2 — What threshold?

| Option | Description | Selected |
|--------|-------------|----------|
| 5 per IP / 10 min — recommended | Room for typos and retries; short window bounds Map growth and clears NAT false positives fast | ✓ |
| 3 per IP / 1 hour | Stricter against sustained single-bot attempts; punishing on shared IPs | |
| 10 per IP / 1 hour | Near-zero false positives; allows ~240 inserts/day from one IP | |

**User's choice:** 5 per IP per 10 minutes.

### Q3 — What does an over-limit request receive?

| Option | Description | Selected |
|--------|-------------|----------|
| 429 + retry guidance — recommended | Honest to a shared-IP false positive; discloses nothing about Audience membership | ✓ |
| Identical 200 (silent drop) | Gives a bot no signal at all, but a real person leaves thinking they subscribed | |

**User's choice:** Real 429.
**Notes:** Explicitly checked against SUB-03 during the question — a 429 is not an enumeration oracle because it says nothing about the submitted address.

### Q4 — What if the client IP cannot be determined?

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared `"unknown"` bucket — recommended | Same limit applies; stripping the header cannot bypass the limiter; local dev still works | ✓ |
| Allow through when IP is missing | Convenient, but a header-strip fail-open hole | |
| Reject when IP is missing | Strictest; may make `npm run dev` untestable | |

**User's choice:** Single shared bucket.

---

## Bot blocking & email validation

### Q1 — What does a honeypot-triggered submission receive?

| Option | Description | Selected |
|--------|-------------|----------|
| Fake success 200 (silent drop) — recommended | Never added to the Audience; bot operator gets no detection signal | ✓ |
| Return 400 | Honest and easier to debug, but teaches the bot to avoid the trap | |

**User's choice:** Fake success, silently dropped.

### Q2 — Add the researched time-on-page trap?

| Option | Description | Selected |
|--------|-------------|----------|
| Don't add — recommended | SUB-04 specifies honeypot + rate limit; mvp mode; client timestamps are forgeable and risk autofill/a11y false positives | ✓ |
| Add (e.g. reject under 3s) | One more layer against honeypot-aware bots | |

**User's choice:** Not implemented — noted as a deferred idea in CONTEXT.md.

### Q3 — How strict is email validation?

| Option | Description | Selected |
|--------|-------------|----------|
| Browser `type="email"` + loose server regex — recommended | Instant client feedback, server guard against bypass, Resend is final authority | ✓ |
| Strict RFC validation server-side | Precise, but classically over-blocks plus-tags, new TLDs, unicode locals | |
| No server validation, delegate to Resend | Least code, but garbage reaches an external API call | |

**User's choice:** Browser validation plus a loose server-side regex.

### Q4 — Normalize the submitted address?

| Option | Description | Selected |
|--------|-------------|----------|
| `trim()` + lowercase — recommended | `" A@B.com "` and `a@b.com` become one contact; no duplicate Audience entries | ✓ |
| `trim()` only | Respects RFC case-sensitivity of local parts, which effectively no mail server honors | |
| Leave untouched | Simplest; a pasted trailing space can silently split a subscription | |

**User's choice:** `trim()` + lowercase.

---

# Second Pass — 2026-07-26

> Update run of `/gsd-discuss-phase 3` against the existing CONTEXT.md. D-01–D-16 were treated as locked and not re-opened; the four areas below were the gray areas remaining after them. Produced D-17 through D-26.

---

## Resubscribe handling

### Q1: How should the route behave when an already-present but unsubscribed contact submits the form again?

| Option | Description | Selected |
|--------|-------------|----------|
| create then always update — recommended | `contacts.create` followed unconditionally by `contacts.update({unsubscribed:false})`; outcome independent of the `resend-node#458` SDK behavior. One extra API call per subscription | ✓ |
| Conditional update on create response | Fewer calls, but branches on a Resend response shape that is undocumented and version-dependent | |
| create only | Simplest; leaves open the "believes they subscribed, never receives mail" silent-failure path until a live account confirms #458 | |

**User's choice:** create then always update.
**Notes:** Form submission itself is treated as the opt-in signal that justifies clearing a prior unsubscribe.

### Q2: What does the visitor see when create succeeds but the follow-up update fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Generic error via D-07 path — recommended | Form stays mounted, value preserved, cause not disclosed; the path is idempotent so retry is the recovery mechanism | ✓ |
| Success + distinguishable server log | Accurate for a new subscriber, but a resubscriber is told they succeeded while still unsubscribed | |
| Retry update once, then decide | Higher success rate, but makes a visitor-facing serverless request wait on a second failure | |

**User's choice:** Generic error via the D-07 path.

---

## Resend SDK vs raw fetch

### Q1: How does /api/subscribe call Resend?

| Option | Description | Selected |
|--------|-------------|----------|
| Add the `resend` SDK — recommended | Dependency of `apps/web`, Node runtime, same entry point Phase 4's Broadcast API will use; `packages/core` stays Notion-only | ✓ |
| raw fetch, zero dependency | Matches `NologClient`'s Notion style and would allow Edge runtime, but hand-rolls response types and Phase 4's broadcast payloads | |
| SDK behind a `lib/email.ts` wrapper | (Overlapped with the follow-up question, which settled the module location) | |

**User's choice:** Add the `resend` SDK.
**Notes:** `NologClient`'s raw REST calls are a documented workaround for SDK bugs on inline Notion databases, not a repo-wide preference — `@notionhq/client` is still a dependency.

### Q2: Where is the Resend client instantiated, and where is the Phase 4 boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Create `lib/email.ts` now — recommended | Holds client construction only, no broadcast/template helpers; Phase 4 imports it; Phase 3 stays independently shippable | ✓ |
| Instantiate inside `route.ts` | Phase 3 stays one file; Phase 4 extracts a shared module when it actually needs one | |

**User's choice:** Create `apps/web/src/lib/email.ts` now.

---

## Route response contract

### Q1: What response body shape does /api/subscribe return?

| Option | Description | Selected |
|--------|-------------|----------|
| `ok` + machine `code` — recommended | `{ok:true}` / `{ok:false, code:"invalid_email"\|"rate_limited"\|"server_error"}`; the form maps code → copy through D-06's locale ternaries | ✓ |
| Status code only, empty body | Smallest, and makes SUB-03's "status + body diff" trivially self-evident; but future reason-branching would break the contract | |
| `{error: "prose"}` | Fewer lines in the form, but splits locale branching across server and component, conflicting with D-06 | |

**User's choice:** `ok` + machine code.

### Q2: What does the route return when the RESEND env vars are unset and it is called directly?

| Option | Description | Selected |
|--------|-------------|----------|
| 404 + distinguishable server log — recommended | Externally indistinguishable from a deployment without the route; the log line names the missing vars so a half-configured forker is not left in silence | ✓ |
| 503 + `code:"not_configured"` | Most direct for a forker running `curl`, but tells a scanner the feature exists and is unconfigured | |
| Fake success 200 | Opaque like the honeypot, but the worst outcome for the person actually trying to set the feature up | |

**User's choice:** 404 + distinguishable server log.

### Q3: Where does the rate-limit check sit in the request pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| env → rate limit → honeypot → validation → Resend — recommended | Cheapest check first; honeypot-tripped requests consume the IP budget so no path bypasses it and a bot exhausts its own quota | ✓ |
| env → honeypot → rate limit → validation → Resend | Honeypot hits are not counted; slightly fewer shared-IP false positives, but a bot can submit indefinitely | |
| env → honeypot → validation → rate limit → Resend | Counter reflects only genuine subscribe attempts, but defends latest | |

**User's choice:** env → rate limit → honeypot → validation → Resend.
**Notes:** Fixes the one position `.planning/research/ARCHITECTURE.md`'s Subscribe Flow left unspecified. Consequence recorded: D-10's counter measures attempts, not subscriptions.

---

## Logging & PII policy

### Q1: How should the submitted email address be treated in server logs?

| Option | Description | Selected |
|--------|-------------|----------|
| Never logged — recommended | No path logs the address; not domain-only, not hashed. Vercel logs are visible to anyone with dashboard access, so the alternative accumulates a plaintext subscriber list as a side effect | ✓ |
| Domain only | Would surface provider-specific failure patterns, at the cost of an ongoing log-format discipline | |
| Full address on error only | Best for reproduction, but peaks exactly when logs are most voluminous | |

**User's choice:** Never logged.

### Q2: Which paths produce log output?

| Option | Description | Selected |
|--------|-------------|----------|
| Failure and configuration classes only — recommended | Resend errors, D-18 partial failure, D-22 unconfigured call. Honeypot drops and 429s are not logged — high-frequency, low-information, and bot-drivable | ✓ |
| Include blocked events | Would let a forker gauge bot volume and sanity-check D-10's threshold, but log volume spikes under attack | |
| Everything including success | With addresses never logged, a success line can only report that one happened; Vercel retention makes that weak for analytics | |

**User's choice:** Failure and configuration classes only.

---

## Verification split

### Q1: SC#1 is the only roadmap criterion that strictly needs a live Resend account. How should verification be divided?

| Option | Description | Selected |
|--------|-------------|----------|
| Close the credential-free criteria now — recommended | SC#2, SC#4, SC#5 provable from a local build; only SC#1 and the live half of SC#3 carried to an operator checklist | ✓ |
| Defer everything, as Phases 1 and 2 did | Consistent with prior phases, but postpones checks that are already possible | |
| Provision the live Resend account first | Cleanest evidence, but `PITFALLS.md` Pitfall 2 notes domain verification can take 48–72h and would block the phase | |

**User's choice:** Close the credential-free criteria now.

---

## Claude's Discretion

Second pass added: exact log-line wording and level for the D-25 events (following the repo's `[Context] message` prefix convention), the `code` → message mapping copy introduced by D-21, and the mechanism used to produce D-22's 404. Removed from discretion: the Resend client's module location, now fixed by D-20.

First pass: the user made an explicit call in every question asked. Discretion was left implicitly on the sub-details listed in CONTEXT.md's "Claude's Discretion" section: exact copy strings in both locales, pending-submit affordance, field layout within each variant, honeypot field naming and hiding technique, expiry/cleanup strategy for the rate-limit `Map`, and file/module naming beyond the `components/subscribe/` directory implied by existing convention.

## Deferred Ideas

- **Time-on-page bot trap** — researched and recommended, deliberately excluded (Q2 above). Revisit only if real bot signups appear.
- **Form copy in `site.config.ts`** — belongs to a future i18n pass across the whole template, not this feature.
- **Subscribe form on the home feed / extra placements** — considered during Q1 of the placement area and rejected; a growth/conversion concern.
