import { timingSafeEqual } from "node:crypto";
import { getResend } from "@/lib/email";
import { getUnemailedPublicPosts, markEmailed } from "@/lib/notion";
import { CONFIG } from "@/site.config";
import { NotionCapabilityError, type Post } from "@4lph4/nolog-core";

export const runtime = "nodejs";

// D-10/D-11/D-12: a reasoned default, not an authoritative one, against
// Vercel Hobby's confirmed 300s maxDuration (04-RESEARCH.md Pitfall 3) — the
// realistic bottleneck is Notion's own per-request latency, not the 300s
// ceiling, and 50 new posts in one digest is already a generous upper bound
// for a personal blog. NOTIFY_BATCH_SIZE exists precisely so Phase 5's live
// duration check can retune this without a code change.
const NOTIFY_BATCH_SIZE_DEFAULT = 50;

// SEC-02 operator signal (same shape as the sibling subscribe route's
// unconfiguredLogged, D-25): bounds the unconfigured console.error to one
// line per serverless instance. The 200 no-op response itself stays OUTSIDE
// this latch so the response contract is identical whether or not the log
// fired.
let unconfiguredLogged = false;

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
 * Whether `post`'s thumbnail is safe to embed as an `<img>` in an outbound
 * email. Requires BOTH: thumbnailType is "external" (a pasted public URL,
 * per 04-RESEARCH.md Pitfall 1 — "file" is a Notion-hosted presigned URL that
 * expires one hour after the page is fetched, with no revalidation for an
 * email already sitting in an inbox) AND the URL parses as absolute https.
 * A malformed or non-https value degrades to text-only rather than emitting
 * a broken or unsafe src.
 */
function getEmbeddableThumbnailUrl(post: Post): string | null {
  if (post.thumbnailType !== "external" || !post.thumbnail) {
    return null;
  }
  try {
    const parsed = new URL(post.thumbnail);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return post.thumbnail;
  } catch {
    return null;
  }
}

/**
 * Renders one digest section: an optional thumbnail image, the escaped title
 * as a link to the post, and the escaped summary below it. The image is
 * emitted only when getEmbeddableThumbnailUrl() confirms it will still
 * resolve when the mail is opened; otherwise the section is text-only — no
 * placeholder, no site-wide fallback image, no empty src (D-05, now covering
 * the Notion-hosted case too). Returns the section HTML plus whether this
 * section was downgraded from a Notion-hosted thumbnail, so the caller can
 * report a single run-level summary. Inline styles only, no external
 * stylesheet, no table layout — a plain list of sections is the ceiling
 * REQUIREMENTS.md sets for v1.
 */
function buildSectionHtml(post: Post): { html: string; downgraded: boolean } {
  const siteUrl = CONFIG.site.url.replace(/\/$/, "");
  const title = escapeHtml(post.title);
  const summary = escapeHtml(post.summary);
  const href = `${siteUrl}/post/${post.id}`;

  const embeddableThumbnail = getEmbeddableThumbnailUrl(post);
  const downgraded = embeddableThumbnail === null && post.thumbnailType === "file";
  const imgHtml = embeddableThumbnail
    ? `<img src="${embeddableThumbnail}" alt="${title}" style="max-width: 100%; display: block; margin: 0 0 12px 0;" />`
    : "";

  const html = `
    <div style="margin: 0 0 24px 0; padding-bottom: 24px; border-bottom: 1px solid #e5e5e5;">
      ${imgHtml}
      <h2 style="margin: 0 0 8px 0; font-size: 18px; line-height: 1.4;">
        <a href="${href}" style="color: #111; text-decoration: none;">${title}</a>
      </h2>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #444;">${summary}</p>
    </div>
  `;

  return { html, downgraded };
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
function buildFooterHtml(physicalAddress: string): string {
  const isKorean = CONFIG.site.locale === "ko";
  const siteTitle = escapeHtml(CONFIG.site.title);
  const address = escapeHtml(physicalAddress);

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
function buildDigestHtml(sections: string[], physicalAddress: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
        ${sections.join("")}
        ${buildFooterHtml(physicalAddress)}
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
  // D-06 revised: physical address moved to an env var so a forker's real
  // mailing address is never committed to a (likely public) git repo — see
  // site.config.ts's `notify` block comment.
  const physicalAddress = (process.env.NOTIFY_PHYSICAL_ADDRESS ?? "").trim();
  const fromAddress = CONFIG.notify.fromAddress.trim();
  if (!apiKey || !audienceId || !physicalAddress || !fromAddress) {
    if (!unconfiguredLogged) {
      unconfiguredLogged = true;
      const missing = [
        !apiKey ? "RESEND_API_KEY" : null,
        !audienceId ? "RESEND_AUDIENCE_ID" : null,
        !physicalAddress ? "NOTIFY_PHYSICAL_ADDRESS" : null,
        !fromAddress ? "CONFIG.notify.fromAddress" : null,
      ].filter(Boolean);
      console.error(
        `[Notify] Route called while unconfigured — missing: ${missing.join(", ")}. Further occurrences in this instance are not logged.`,
      );
    }
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

  // Batch cap (D-10/D-11/D-12/D-13) — measured in post count, never elapsed
  // time. Applied BEFORE any section is assembled. A typo'd/non-positive
  // override can never silently disable the feature or produce a
  // zero-length batch — it falls back to the default instead.
  const parsedBatchSize = Number.parseInt(process.env.NOTIFY_BATCH_SIZE ?? "", 10);
  const batchSize =
    Number.isFinite(parsedBatchSize) && parsedBatchSize > 0 ? parsedBatchSize : NOTIFY_BATCH_SIZE_DEFAULT;
  const batch = candidates.slice(0, batchSize);
  const deferredCount = candidates.length - batch.length;
  if (deferredCount > 0) {
    // D-13: posts past the cap need no resume bookkeeping — they are still
    // unemailed, so the next run's query finds them naturally.
    console.log(`[Notify] Deferred ${deferredCount} post(s) to next run (batch cap NOTIFY_BATCH_SIZE reached).`);
  }

  // Assemble — preserve array order exactly (D-01): no sort, no reverse, no
  // de-duplication, since getUnemailedPublicPosts() already returns Notion
  // created_time ascending. Per-post isolation (NOTIFY-04): a bad section is
  // dropped, never fatal to the rest of the digest.
  const sections: { post: Post; html: string }[] = [];
  let downgradedThumbnailCount = 0;
  for (const post of batch) {
    try {
      const { html, downgraded } = buildSectionHtml(post);
      sections.push({ post, html });
      if (downgraded) {
        downgradedThumbnailCount += 1;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Notify] Failed to build section for post ${post.id}: ${message}`);
    }
  }

  if (downgradedThumbnailCount > 0) {
    console.log(
      `[Notify] ${downgradedThumbnailCount} post(s) rendered without a thumbnail: the image is stored in Notion and its URL expires within the hour. Paste a public image URL into the thumbnail property to include it.`,
    );
  }

  if (sections.length === 0) {
    return Response.json({ ok: true, code: "no_sections" }, { status: 200 });
  }

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
    html: buildDigestHtml(
      sections.map((section) => section.html),
      physicalAddress,
    ),
    send: true,
  });

  if (sendError) {
    console.error(`[Notify] Broadcast send failed: ${sendError.message}`);
    return Response.json({ ok: false, code: "send_failed" }, { status: 500 });
  }

  // Mark, only after a clean send (NOTIFY-05) — isolated per post, so one
  // failure never stops the rest. A missing Notion "Update content" grant
  // 403s identically for every post in the batch, so once seen, short-circuit
  // the remaining attempts rather than burn N doomed PATCH calls (resolves
  // 04-RESEARCH.md Open Question 2 in favor of short-circuiting).
  let marked = 0;
  let capabilityBlocked = false;
  let capabilityErrorLogged = false;
  for (const { post } of sections) {
    if (capabilityBlocked) {
      continue;
    }
    try {
      await markEmailed(post.id);
      marked += 1;
    } catch (error: unknown) {
      if (error instanceof NotionCapabilityError) {
        capabilityBlocked = true;
        if (!capabilityErrorLogged) {
          capabilityErrorLogged = true;
          console.error('[Notify] markEmailed blocked — the Notion integration lacks "Update content".');
        }
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[Notify] markEmailed failed for post ${post.id}: ${message}`);
      }
    }
  }

  const unmarked = sections.length - marked;
  if (capabilityBlocked && unmarked > 0) {
    console.error(
      `[Notify] ${unmarked} post(s) left unmarked due to the missing Notion capability; they will be re-sent on the next run.`,
    );
  }

  return Response.json({ ok: true, code: "sent", count: sections.length, marked }, { status: 200 });
}
