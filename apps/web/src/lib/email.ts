import { Resend } from "resend";

/**
 * Single Resend client construction point (D-20). Nothing else lives here —
 * no broadcast helpers, no email templates, no send wrapper. No default,
 * fallback, or hard-coded key value exists anywhere in this file; the
 * presence check belongs entirely to the callers (SubscribeSection at
 * render time, the route handler at request time), never to this module.
 *
 * Construction is deferred to first call rather than run at module load:
 * the installed `resend` SDK's constructor throws synchronously when no key
 * is resolvable (from the constructor argument or from `RESEND_API_KEY`
 * directly), which would otherwise crash `next build` for every
 * unconfigured fork the instant this module is imported — the opposite of
 * SUB-02's off-by-default contract. The route only ever calls this after
 * its own D-22 configuration gate has passed, so in practice this never
 * runs unconfigured.
 */
let client: Resend | undefined;

export function getResend(): Resend {
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}
