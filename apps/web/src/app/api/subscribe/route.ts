import { getResend } from "@/lib/email";

export const runtime = "nodejs";

// Deliberately loose per D-15: local part + @ + dotted domain, nothing more.
// Strict RFC-style validation over-blocks plus-tags, new TLDs, and unicode
// locals — Resend is the final authority on address validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// IN-04, defense in depth: the regex above is deliberately loose and runs
// over whatever arrived, so bounding its input first keeps an unbounded body
// from becoming regex work. This is not a validity rule and must not
// tighten what D-15 accepts — 254 is the maximum length of a practical
// SMTP addr-spec, well above any real address.
const MAX_EMAIL_LENGTH = 254;

// D-10: five attempts per key per fixed ten-minute window. A legitimate
// visitor subscribes once and retries at most once or twice; the window
// lets a shared-key false positive clear itself quickly. It does NOT bound
// the counter map's size — ATTEMPTS_MAX_KEYS below is what does that.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
// Expiry-based sweep, run on write once this many keys exist rather than on
// a timer (no background work in this serverless path). This sweep alone
// does not bound the map either — it only evicts entries whose window has
// ELAPSED, so a high-cardinality burst of fresh keys is un-sweepable for a
// full window. ATTEMPTS_MAX_KEYS below is the actual, expiry-independent
// bound.
const ATTEMPTS_SWEEP_THRESHOLD = 1000;
// Hard ceiling on distinct keys `attempts` can hold, enforced independent of
// expiry (CR-01 secondary defect). Sized to the quantity it bounds: distinct
// rate-limit keys observed within one ten-minute window on a personal
// blog's email signup form — only an actual submission creates a key, so
// real peak traffic sits orders of magnitude below this even for a
// front-page-of-an-aggregator moment. Unreachable by real use, cheap in
// memory. It also bounds the sweep's per-request iteration cost above,
// which was previously unbounded along with the map. See isRateLimited for
// how the ceiling is enforced and why collapse (not rejection) is chosen.
const ATTEMPTS_MAX_KEYS = 2000;
// Shared bucket a new key collapses into once ATTEMPTS_MAX_KEYS distinct
// keys already exist. Collapse over rejection: rejecting a new key would
// hand an attacker a global lockout lever (fill the map, refuse every new
// visitor); collapsing means overflow traffic shares one bucket at the same
// five-per-ten-minutes limit, so a rotating attacker is refused on their
// sixth attempt too, at the cost of a legitimate late arrival occasionally
// sharing that bucket's genuine 429 (D-11) until the window clears.
const ATTEMPTS_OVERFLOW_KEY = "overflow";

// D-09: this counter lives in ONE serverless instance's memory. It is NOT
// shared across instances and it resets on every cold start, so it is a
// bulk-abuse dampener rather than a deterministic gate — that limitation is
// accepted and recorded here rather than glossed over.
const attempts = new Map<string, { count: number; windowStart: number }>();

// Shared bucket for a request whose only identity claim is a
// client-suppliable header (see getRateLimitKey tier 3). Kept distinct from
// the "unknown" literal below on purpose: merging them would let a tier-3
// spoofing burst throttle header-less traffic too.
const ATTEMPTS_UNTRUSTED_KEY = "untrusted";

/**
 * Derives the rate-limit bucket key for `request`, preferring platform-owned
 * headers over a client-suppliable one (CR-01). Tries, in order, first
 * non-empty match winning:
 *
 *   1. `x-vercel-forwarded-for` — the platform-owned client IP. Trusted.
 *   2. `x-real-ip` — the documented platform-injected equivalent. Trusted.
 *   3. `x-forwarded-for` — present with neither platform header alongside
 *      it. NOT trusted: the value is deliberately discarded and every such
 *      request shares one bucket (`ATTEMPTS_UNTRUSTED_KEY`) instead of
 *      minting a fresh counter per fabricated value. Restoring the raw
 *      value here would re-introduce the exact defect this replaces.
 *
 * Falls back to the shared `"unknown"` literal (D-12, unchanged) when none
 * of the three headers yields a non-empty entry, so stripping every header
 * is never a bypass and local development still works against one shared
 * key.
 *
 * Deployment tradeoff, stated plainly: on Vercel a platform header is
 * always present, so tier 3 is unreachable in production and per-visitor
 * counting is unaffected. On a host that injects no platform header, every
 * visitor collapses into the tier-3 bucket and the limit becomes site-wide
 * rather than per-visitor — over-throttling, never under-throttling, the
 * same fail-closed direction D-12 already chose. Vercel is this template's
 * only supported host (PROJECT.md), so this tradeoff is accepted.
 */
function getRateLimitKey(request: Request): string {
  const candidates = [
    { header: "x-vercel-forwarded-for", trusted: true },
    { header: "x-real-ip", trusted: true },
    { header: "x-forwarded-for", trusted: false },
  ] as const;

  for (const { header, trusted } of candidates) {
    const raw = request.headers.get(header);
    if (!raw) continue;

    // Exactly one trusted hop — the Vercel edge — appends to these headers
    // on a supported deployment, so if a header ever carries several
    // comma-separated entries, the LAST is the one that hop appended (the
    // entry nearest the platform, not nearest the client).
    const parts = raw.split(",");
    const entry = parts[parts.length - 1]?.trim();
    if (!entry) continue;

    if (!trusted) {
      // Tier 3: the value itself is untrustworthy (client-suppliable), so
      // it is discarded rather than used as a key — every such request
      // shares one bucket instead of minting a fresh one. This is the
      // substance of the CR-01 fix.
      return ATTEMPTS_UNTRUSTED_KEY;
    }

    return entry;
  }

  return "unknown";
}

/**
 * Records this attempt for `key` and reports whether it now exceeds
 * `RATE_LIMIT_MAX` within the current fixed window (D-10). The boundary
 * comparison is strictly greater-than, so a request arriving at exactly the
 * window length still belongs to the old window.
 */
function isRateLimited(key: string): boolean {
  const now = Date.now();

  if (attempts.size > ATTEMPTS_SWEEP_THRESHOLD) {
    for (const [k, value] of attempts) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        attempts.delete(k);
      }
    }
  }

  // Expiry-independent hard ceiling (CR-01 secondary defect): the sweep
  // above only evicts entries whose window has ELAPSED, so a high-
  // cardinality burst of distinct keys keeps every entry fresh and
  // un-sweepable for a full window, growing the map by roughly one entry
  // per request. This collapse bounds that growth regardless of expiry.
  // The `attempts.has` check runs first so a visitor who already holds a
  // bucket never loses it once the map fills — otherwise a flood would
  // become a total outage for everyone, not just new arrivals.
  const effectiveKey =
    !attempts.has(key) && attempts.size >= ATTEMPTS_MAX_KEYS
      ? ATTEMPTS_OVERFLOW_KEY
      : key;

  const entry = attempts.get(effectiveKey);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(effectiveKey, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID ?? "";

  // D-23 stage 1, first pipeline stage. External response is a 404 —
  // indistinguishable from a deployment that never had this route, matching
  // SubscribeSection's render-time posture (SUB-02, SEC-03). Per D-22, this
  // is deliberately not a status that would confirm feature existence to a
  // scanner, and deliberately not a fake success for a half-configured
  // forker. The operator log below is the one place the missing detail
  // is spelled out.
  if (!apiKey || !audienceId) {
    const missing = [
      !apiKey ? "RESEND_API_KEY" : null,
      !audienceId ? "RESEND_AUDIENCE_ID" : null,
    ].filter(Boolean);
    console.error(`[Subscribe] Route called while unconfigured — missing: ${missing.join(", ")}`);
    return new Response(null, { status: 404 });
  }

  // D-23 stage 2 — ahead of every other request stage, including body
  // parsing, so a flood of malformed bodies costs the same budget as
  // well-formed submissions. A genuine 429 rather than a silent fake success
  // (D-11): a real person caught by a shared-key false positive would
  // otherwise walk away believing they subscribed. The body carries only the
  // machine code — nothing here varies with Audience membership (SUB-03).
  // Logs nothing (D-25); the rate-limit key never reaches a log (D-24).
  const rateLimitKey = getRateLimitKey(request);
  if (isRateLimited(rateLimitKey)) {
    return Response.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
  }

  // D-23 stage 3 — after the rate limit (so a bot still spends its own
  // quota; the counter measures attempts, not subscriptions) and before
  // validation/Resend (so a trapped submission never reaches either). A
  // populated honeypot returns the exact same 200/{ok:true} a real success
  // produces — byte-identical, so a bot operator learns nothing — and the
  // submission is dropped without ever calling Resend. No 400, no distinct
  // response of any kind: revealing detection would teach an operator to
  // route around the trap. Logs nothing (D-25).
  const honeypotValue =
    typeof body === "object" && body !== null && "company" in body
      ? String((body as { company?: unknown }).company ?? "").trim()
      : "";

  if (honeypotValue.length > 0) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const rawEmail =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email?: unknown }).email
      : undefined;

  // Normalize before anything else touches the value (D-16). This is the
  // ONLY identifier in the module holding the address — D-24's no-logging
  // guarantee is asserted against this identifier specifically.
  const normalizedEmail = String(rawEmail ?? "").trim().toLowerCase();

  if (normalizedEmail.length > MAX_EMAIL_LENGTH) {
    return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
  }

  try {
    const resend = getResend();
    const { error: createError } = await resend.contacts.create({
      email: normalizedEmail,
      audienceId,
      unsubscribed: false,
    });

    if (createError) {
      console.error(`[Subscribe] Resend contact create failed: ${createError.message}`);
    }

    // Unconditional follow-up (D-17) — runs no matter what create returned,
    // with no prior Audience read and no branch on the create result. This
    // neutralizes resend/resend-node#458 by construction: whatever create
    // does under the hood, this call fixes the subscribed state.
    const { error: updateError } = await resend.contacts.update({
      email: normalizedEmail,
      audienceId,
      unsubscribed: false,
    });

    if (updateError) {
      // D-18: create may have succeeded but the requested end state —
      // subscribed AND receiving — was not reached, so report the generic
      // error rather than success. No retry loop: the whole path is
      // idempotent and the visitor's own retry is the recovery mechanism.
      console.error(`[Subscribe] Resend contact update (post-create) failed: ${updateError.message}`);
      return Response.json({ ok: false, code: "server_error" }, { status: 500 });
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch {
    // A thrown SDK/network error reaches the same generic branch instead of
    // escaping as an unhandled 500 with a stack trace.
    return Response.json({ ok: false, code: "server_error" }, { status: 500 });
  }
}
