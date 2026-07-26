import { timingSafeEqual } from "node:crypto";
import { getResend } from "@/lib/email";
import { getUnemailedPublicPosts, markEmailed } from "@/lib/notion";
import { CONFIG } from "@/site.config";
import type { Post } from "@4lph4/nolog-core";

export const runtime = "nodejs";

// ─── Auth (SEC-01) ──────────────────────────────────────────────────────────

/**
 * Constant-time comparison of `a` against `b`. `node:crypto.timingSafeEqual`
 * THROWS on a byte-length mismatch rather than returning `false` — a naive
 * try/catch around that throw would make a wrong-length secret measurably
 * faster to reject than a right-length-wrong-content one, reintroducing the
 * exact timing side-channel SEC-01 exists to close. The length-mismatch
 * branch below burns comparable time (a same-length self-comparison) and
 * discards the result instead of short-circuiting.
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // burn comparable time; result discarded
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// ─── Digest template helpers ────────────────────────────────────────────────

/** Escapes the five HTML-significant characters so Notion-sourced strings can never break the digest's markup or inject structure into a subscriber's mail client. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders one digest section: escaped title as a link to the post, the
 * escaped summary below it, nothing else. Text-only for this task — no
 * thumbnail is embedded here at all; the thumbnail branch is plan 04-02's
 * slice, and D-05 already fixes the no-thumbnail case as text-only. Inline
 * styles only, no external stylesheet, no table layout — a plain list of
 * sections is the ceiling REQUIREMENTS.md sets for v1.
 */
function buildSectionHtml(post: Post): string {
  const siteUrl = CONFIG.site.url.replace(/\/$/, "");
  const title = escapeHtml(post.title);
  const summary = escapeHtml(post.summary);
  const href = `${siteUrl}/post/${post.id}`;

  return `
    <div style="margin: 0 0 24px 0; padding-bottom: 24px; border-bottom: 1px solid #e5e5e5;">
      <h2 style="margin: 0 0 8px 0; font-size: 18px; line-height: 1.4;">
        <a href="${href}" style="color: #111; text-decoration: none;">${title}</a>
      </h2>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #444;">${summary}</p>
    </div>
  `;
}

/**
 * Three lines, in this order, byte-identical regardless of how many sections
 * precede it: why-you're-receiving-this (D-07), the configured physical
 * address (D-06), and a visible unsubscribe link.
 *
 * D-08 is revised by this task, under D-08's own escape hatch: D-08 planned
 * to rely purely on Resend's automatic header injection and render no
 * unsubscribe markup in the body, explicitly conditional on research
 * confirming that behaviour. 04-RESEARCH.md Open Question 1 could not confirm
 * it from any quotable official Resend page — only the suppression-list half
 * is confirmed. Rendering the merge tag as a visible link satisfies NOTIFY-02
 * with certainty under either interpretation, costs one line in a footer
 * that already needed two, and is strictly additive.
 */
function buildFooterHtml(): string {
  const isKorean = CONFIG.site.locale === "ko";
  const siteTitle = escapeHtml(CONFIG.site.title);
  const address = escapeHtml(CONFIG.notify.physicalAddress);

  const whyLine = isKorean
    ? `${siteTitle}의 새 글 알림을 구독하셨기 때문에 이 메일을 받고 계십니다.`
    : `You're receiving this because you subscribed to new-post alerts on ${siteTitle}.`;

  const unsubscribeLabel = isKorean ? "구독 취소" : "Unsubscribe";

  return `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; line-height: 1.6; color: #888;">
      <p style="margin: 0 0 4px 0;">${whyLine}</p>
      <p style="margin: 0 0 4px 0;">${address}</p>
      <p style="margin: 0;">
        <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color: #888;">${unsubscribeLabel}</a>
      </p>
    </div>
  `;
}

/** A minimal HTML document wrapping the joined sections followed by the footer. No greeting and no intro paragraph above the first section (D-04). */
function buildDigestHtml(sections: string[]): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
        ${sections.join("")}
        ${buildFooterHtml()}
      </body>
    </html>
  `;
}

// ─── Route ──────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // SEC-01 — the literal first statement. Nothing above this block may touch
  // Notion or Resend (04-RESEARCH.md Pattern 1 / Anti-Pattern 2).
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";
  if (!cronSecret || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    // D-16: fixed string literal, zero interpolation — no secret value, no
    // header content and no IP can ever reach this log. Deliberately NOT
    // latched (D-15): every failed attempt against this route is signal,
    // not noise, unlike Phase 3's honeypot/429 hits.
    console.error("[Notify] Unauthorized cron request rejected.");
    return new Response(null, { status: 401 });
  }

  // SEC-02 — fail-closed configuration gate, before any Notion or Resend
  // call. A missing physical address fails closed at exactly the same tier
  // as a missing API key (D-09).
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const physicalAddress = CONFIG.notify.physicalAddress.trim();
  const fromAddress = CONFIG.notify.fromAddress.trim();
  if (!apiKey || !audienceId || !physicalAddress || !fromAddress) {
    return Response.json({ ok: true, code: "unconfigured" }, { status: 200 });
  }

  // Query.
  let candidates: Post[];
  try {
    candidates = await getUnemailedPublicPosts();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Notify] Unemailed-post query failed: ${message}`);
    return Response.json({ ok: false, code: "query_failed" }, { status: 500 });
  }

  if (candidates.length === 0) {
    return Response.json({ ok: true, code: "no_posts" }, { status: 200 });
  }

  // Assemble — preserve array order exactly (D-01): no sort, no reverse, no
  // de-duplication, since getUnemailedPublicPosts() already returns Notion
  // created_time ascending.
  const sections = candidates.map((post) => buildSectionHtml(post));

  // Send — exactly one call, never inside a loop (NOTIFY-03). The subject is
  // count-based and generic (D-02), same shape whether the count is 1 or many.
  const resend = getResend();
  const subject =
    CONFIG.site.locale === "ko"
      ? `${CONFIG.site.title}에 새 글 ${sections.length}개가 올라왔습니다`
      : `${sections.length} new post${sections.length === 1 ? "" : "s"} on ${CONFIG.site.title}`;

  const { error: sendError } = await resend.broadcasts.create({
    audienceId,
    from: fromAddress,
    subject,
    html: buildDigestHtml(sections),
    send: true,
  });

  if (sendError) {
    console.error(`[Notify] Broadcast send failed: ${sendError.message}`);
    return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
  }

  // Mark, only after a clean send.
  for (const post of candidates) {
    await markEmailed(post.id);
  }

  return Response.json({ ok: true, code: "sent", count: candidates.length }, { status: 200 });
}
