import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/**
 * GET /api/draft/disable
 *
 * Disables Draft Mode — returns to showing only public posts.
 */
export async function GET() {
  const draft = await draftMode();
  draft.disable();
  redirect("/");
}
