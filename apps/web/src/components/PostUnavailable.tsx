import Link from "next/link";
import { ArrowLeft, CloudOff } from "lucide-react";

/**
 * Reader-facing "temporarily unavailable" state for `/post/[id]`, rendered
 * when `classifyMissingPost()` (`apps/web/src/lib/post-availability.ts`)
 * judges a `null` `getPost()` result to be a transient fetch failure rather
 * than a genuine 404. Props-less Server Component — no `post` data is
 * available or needed. English-only, unlocalized, and standalone per
 * `07-UI-SPEC.md`'s Copywriting Contract and Placement & Composition Notes.
 */
export default function PostUnavailable() {
  return (
    <div className="max-w-none mx-auto py-8 md:px-4">
      <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6 rounded-xl border border-border bg-surface">
        <CloudOff className="w-10 h-10 text-warning" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold text-text-primary">
          This post is temporarily unavailable
        </h1>
        <p className="max-w-md text-text-secondary text-base">
          We couldn&apos;t load this post from Notion right now. This is
          usually temporary — please check back in a few minutes.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover transition-colors mt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to feed
        </Link>
      </div>
    </div>
  );
}
