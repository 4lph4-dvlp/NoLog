import { timingSafeEqual } from "node:crypto";
import { parsePageId } from "notion-utils";
import { describeFetchFailure, getPageRecordMap, isDiagnosticsEnabled } from "@/lib/notion-x";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison of `a` against `b`. Duplicated (not imported)
 * from `apps/web/src/app/api/notify-subscribers/route.ts:43-52` — deliberate
 * per D-06's discretion note, so this diagnostic-only route never touches a
 * live cron route's file. `node:crypto.timingSafeEqual` THROWS on a
 * byte-length mismatch rather than returning `false`; the length-mismatch
 * branch below burns comparable time (a same-length self-comparison) and
 * discards the result instead of short-circuiting, closing the timing
 * side-channel a naive try/catch would reintroduce.
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

// T-07-05 / D-25-style latch (mirrors unconfiguredLogged in the sibling
// routes): bounds the gate-rejection console.error to one line per instance.
// The 404 response itself sits outside this latch so the response contract
// is identical whether or not the log fired.
let gateRejectionLogged = false;

export async function GET(request: Request) {
  // T-07-01 double gate, checked as the literal first statements: BOTH the
  // debug flag AND a correct bearer secret must hold, or the response is a
  // bare 404 — never 401, which would confirm the route exists to a prober
  // (D-07, 07-RESEARCH.md Pitfall C).
  const diagnosticsOn = isDiagnosticsEnabled();
  const routeSecret = process.env.NOTION_DEBUG_ROUTE_SECRET;
  const authHeader = request.headers.get("authorization") ?? "";

  if (!diagnosticsOn || !routeSecret || !safeCompare(authHeader, `Bearer ${routeSecret}`)) {
    if (!gateRejectionLogged) {
      gateRejectionLogged = true;
      console.error(
        "[DiagnosePage] Route called while diagnostics are off, unconfigured, or unauthorized. Further occurrences in this instance are not logged.",
      );
    }
    return new Response(null, { status: 404 });
  }

  // T-07-03 (SSRF): id validation happens BEFORE any outbound request. A
  // rejected id returns 400 with no network request made.
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get("id");
  const pageId = rawId ? parsePageId(rawId) : undefined;

  if (!pageId) {
    return Response.json({ ok: false, code: "invalid_id" }, { status: 400 });
  }

  try {
    const recordMap = await getPageRecordMap(pageId);
    // T-07-06: success returns a block count only — never the recordMap,
    // any block, or any page text.
    return Response.json(
      { ok: true, code: "record_map_ok", blockCount: Object.keys(recordMap?.block ?? {}).length },
      { status: 200 },
    );
  } catch (error) {
    const diagnostic = await describeFetchFailure(error, pageId, true);
    console.error(`[DiagnosePage] ${diagnostic}`);
    // The HTTP status here is 200 with ok:false, deliberately: this route's
    // job is to report, and a successfully-produced report of a downstream
    // failure is not itself a route failure. This keeps the operator's curl
    // output readable and keeps Vercel's own error classification from
    // adding noise to the very logs being read.
    return Response.json({ ok: false, code: "record_map_failed", diagnostic }, { status: 200 });
  }
}
