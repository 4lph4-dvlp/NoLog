import type { Post } from "@/types";
import { NotionPageRenderer } from "@/components/notion/NotionPageRenderer";
import { CommentSection } from "@/components/comments/CommentSection";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONFIG } from "@/site.config";

interface DefaultPostPageProps {
  post: Post;
  recordMap: any; // Allow any type since it's from notion-x which has complex types
}

export default function DefaultPostPage({ post, recordMap }: DefaultPostPageProps) {
  return (
    <article className="max-w-none mx-auto py-8 md:px-4">
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
            {new Date(post.createDate).toLocaleString(CONFIG.site.locale, {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {post.editDate && post.editDate !== post.createDate && (
            <time dateTime={post.editDate}>
              {CONFIG.site.locale === "ko" ? "수정:" : "Updated:"}{" "}
              {new Date(post.editDate).toLocaleString(CONFIG.site.locale, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
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
      {post.thumbnail && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10">
          <Image
            src={post.thumbnail}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
        </div>
      )}

      {/* ─── Content ───────────────────────────────────────────── */}
      <div className="notion-content-wrapper">
        {recordMap ? (
          <NotionPageRenderer recordMap={recordMap} />
        ) : (
          <p className="text-text-secondary italic">Content could not be loaded.</p>
        )}
      </div>

      {/* ─── Comments ──────────────────────────────────────────── */}
      <CommentSection postId={post.id} postTitle={post.title} />
    </article>
  );
}
