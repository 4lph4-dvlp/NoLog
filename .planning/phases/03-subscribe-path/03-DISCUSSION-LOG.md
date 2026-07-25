# Phase 3: Subscribe Path - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 3-Subscribe Path
**Areas discussed:** Form placement & template coverage, Post-submit UX & copy, Rate limit policy & blocked response, Bot blocking & email validation

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

## Claude's Discretion

The user made an explicit call in every question asked. Discretion was left implicitly on the sub-details listed in CONTEXT.md's "Claude's Discretion" section: exact copy strings in both locales, pending-submit affordance, field layout within each variant, honeypot field naming and hiding technique, expiry/cleanup strategy for the rate-limit `Map`, and file/module naming beyond the `components/subscribe/` directory implied by existing convention.

## Deferred Ideas

- **Time-on-page bot trap** — researched and recommended, deliberately excluded (Q2 above). Revisit only if real bot signups appear.
- **Form copy in `site.config.ts`** — belongs to a future i18n pass across the whole template, not this feature.
- **Subscribe form on the home feed / extra placements** — considered during Q1 of the placement area and rejected; a growth/conversion concern.
