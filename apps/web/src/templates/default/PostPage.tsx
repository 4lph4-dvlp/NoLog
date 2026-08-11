import type { Post } from "@/types";
import type { ExtendedRecordMap } from "notion-types";
import { NotionPageRenderer } from "@/components/notion/NotionPageRenderer";
import { CommentSection } from "@/components/comments/CommentSection";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONFIG } from "@/site.config";
import { isRecordMapEmpty } from "@/lib/notion-x";
import { PostThumbnail } from "@/components/PostThumbnail";

interface DefaultPostPageProps {
  post: Post;
  recordMap: ExtendedRecordMap | null;
  contentFetchFailed: boolean;
}

export default function DefaultPostPage({ post, recordMap, contentFetchFailed }: DefaultPostPageProps) {
  return (
    // Reading-width cap (SIDE-04, D-01/D-02/D-03): a static ceiling, not
    // part of the sidebar collapse animation. At a 1400px viewport <main>
    // measures 864px with both sidebars expanded (the cap has no effect)
    // and 1304px with both collapsed (the article hits 1100px, a visible
    // +236px). A 900px cap was rejected — it would have widened the prose
    // by only 36px, satisfying SIDE-04's wording on paper while failing it
    // in substance. mx-auto (already present) satisfies D-03's centring.
    <article className="max-w-[1100px] mx-auto py-8 md:px-4">
      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="mb-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-accent transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {CONFIG.site.locale === "ko" ? "목록으로" : "Back to feed"}
        </Link>

        {post.category && (
          <div className="mb-4">
            <Link
              href={`/category/${post.category.toLowerCase().replace(/\s+/g, "-")}`}
              className="inline-block px-2 py-1 text-xs font-medium rounded bg-accent-light text-accent hover:opacity-80 transition-opacity"
            >
              {post.category}
            </Link>
          </div>
        )}

        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary leading-tight mb-4">
          {post.title}
        </h1>

        <div className="flex flex-col gap-1 text-sm text-text-secondary mt-2">
          <span>
            {CONFIG.site.locale === "ko" ? "작성자:" : "Author:"} {post.author}
          </span>
          <time dateTime={post.createDate}>
            {CONFIG.site.locale === "ko" ? "작성:" : "Published:"}{" "}
            {new Date(post.createDate).toLocaleDateString(CONFIG.site.locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
          {post.editDate && post.editDate !== post.createDate && (
            <time dateTime={post.editDate}>
              {CONFIG.site.locale === "ko" ? "수정:" : "Updated:"}{" "}
              {new Date(post.editDate).toLocaleDateString(CONFIG.site.locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          )}
        </div>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}`}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-accent-light text-accent hover:opacity-80 transition-opacity"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* ─── Thumbnail ─────────────────────────────────────────── */}
      <PostThumbnail post={post} variant="hero" />

      {/* ─── Content ───────────────────────────────────────────── */}
      <div className="notion-content-wrapper">
        {recordMap && !isRecordMapEmpty(recordMap) ? (
          <NotionPageRenderer recordMap={recordMap} />
        ) : contentFetchFailed ? (
          <p className="text-text-secondary italic">
            This post&apos;s content could not be loaded right now.
          </p>
        ) : (
          <p className="text-text-secondary italic">This post has no content yet.</p>
        )}
      </div>

      {/* ─── Comments ──────────────────────────────────────────── */}
      <CommentSection postId={post.id} postTitle={post.title} />
    </article>
  );
}
