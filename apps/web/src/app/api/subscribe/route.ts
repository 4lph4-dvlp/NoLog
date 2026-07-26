import { getResend } from "@/lib/email";

export const runtime = "nodejs";

// Deliberately loose per D-15: local part + @ + dotted domain, nothing more.
// Strict RFC-style validation over-blocks plus-tags, new TLDs, and unicode
// locals — Resend is the final authority on address validity.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, code: "invalid_email" }, { status: 400 });
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
