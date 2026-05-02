import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

/**
 * GET /api/draft?secret=<DRAFT_SECRET>
 *
 * Enables Next.js Draft Mode, which allows the blog to display
 * non-public posts for preview purposes.
 *
 * Usage:
 *   Visit /api/draft?secret=YOUR_DRAFT_SECRET to enable draft mode.
 *   Visit /api/draft/disable to disable it.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  // Validate the secret token
  if (!secret || secret !== process.env.DRAFT_SECRET) {
    return new Response("Invalid or missing secret token.", { status: 401 });
  }

  // Enable Draft Mode — sets a cookie that persists across requests
  const draft = await draftMode();
  draft.enable();

  // Redirect to the home page with draft mode active
  redirect("/");
}
