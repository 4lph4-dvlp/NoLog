import { Resend } from "resend";

/**
 * Single Resend client construction point (D-20). Nothing else lives here —
 * no broadcast helpers, no email templates, no send wrapper. Constructed
 * unconditionally, same division of responsibility as lib/notion.ts: the
 * presence check belongs to the callers (SubscribeSection at render time,
 * the route handler at request time), never to this module.
 */
export const resend = new Resend(process.env.RESEND_API_KEY);
