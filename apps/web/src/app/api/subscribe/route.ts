import { getResend } from "@/lib/email";

export const runtime = "nodejs";

// Deliberately loose per D-15: local part + @ + dotted domain, nothing more.
// Strict RFC-style validation over-blocks plus-tags, new TLDs, and unicode
// locals — Resend is the final authority on address validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// D-10: five attempts per IP per fixed ten-minute window. A legitimate
// visitor subscribes once and retries at most once or twice; the window
// keeps the counter map bounded and lets a shared-office/NAT false positive
// clear itself quickly.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
// Bound on the counter map's growth — swept on write once this many keys
// exist, rather than on a timer, so there is no background work in this
// serverless path.
const ATTEMPTS_SWEEP_THRESHOLD = 1000;

// D-09: this counter lives in ONE serverless instance's memory. It is NOT
// shared across instances and it resets on every cold start, so it is a
// bulk-abuse dampener rather than a deterministic gate — that limitation is
// accepted and recorded here rather than glossed over.
const attempts = new Map<string, { count: number; windowStart: number }>();

/**
 * Extracts the client IP from `x-forwarded-for` (D-12): first
 * comma-separated entry, trimmed, since intermediary proxies append hops to
 * that header. Falls back to the single shared literal `"unknown"` when the
 * header is absent, empty, or whitespace-only, so stripping the header is
 * never a bypass and local development still works against one shared key.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : "unknown";
}

/**
 * Records this attempt for `ip` and reports whether it now exceeds
 * `RATE_LIMIT_MAX` within the current fixed window (D-10). The boundary
 * comparison is strictly greater-than, so a request arriving at exactly the
 * window length still belongs to the old window.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();

  if (attempts.size > ATTEMPTS_SWEEP_THRESHOLD) {
    for (const [key, value] of attempts) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        attempts.delete(key);
      }
    }
  }

  const entry = attempts.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
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
  // (D-11): a real person caught by a shared-IP false positive would
  // otherwise walk away believing they subscribed. The body carries only the
  // machine code — nothing here varies with Audience membership (SUB-03).
  // Logs nothing (D-25); the IP key never reaches a log (D-24).
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
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
