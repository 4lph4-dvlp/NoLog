import { getPost } from "@/lib/notion";
import { getPageRecordMap } from "@/lib/notion-x";
import { getComments } from "@/lib/github";
import type { Comment } from "@/types/comments";
import { NotionPageRenderer } from "@/components/notion/NotionPageRenderer";
import { CommentSection } from "@/components/comments/CommentSection";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    return { title: "Post Not Found" };
  }

  const ogUrl = new URL("/api/og", CONFIG.site.url);
  ogUrl.searchParams.set("title", post.title);
  if (post.category) {
    ogUrl.searchParams.set("category", post.category);
  }

  return {
    title: post.title,
    description: post.summary || post.title,
    openGraph: {
      title: post.title,
      description: post.summary || post.title,
      type: "article",
      publishedTime: post.createDate,
      authors: [post.author],
      images: [
        {
          url: ogUrl.toString(),
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary || post.title,
      images: [ogUrl.toString()],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    notFound();
  }

  // Fetch full page recordMap for react-notion-x rendering
  let recordMap;
  try {
    recordMap = await getPageRecordMap(id);
  } catch (error) {
    console.error("[PostPage] Failed to fetch page recordMap:", error);
    recordMap = null;
  }

  // Fetch comments safely; if github is unconfigured, it will return [] or throw.
  let comments: Comment[] = [];
  try {
    comments = await getComments(id);
  } catch (error) {
    console.error("[PostPage] Failed to fetch comments:", error);
  }

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
            <span className="px-2 py-1 text-xs font-medium rounded bg-accent-light text-accent">
              {post.category}
            </span>
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
              <span
                key={tag}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-accent-light text-accent"
              >
                {tag}
              </span>
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
      <CommentSection postId={post.id} initialComments={comments} />
    </article>
  );
}
