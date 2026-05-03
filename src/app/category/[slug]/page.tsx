import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";

/**
 * Dynamic metadata for each category page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const displayName = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${displayName} — ${CONFIG.site.title}`,
    description: `Posts in the "${displayName}" category on ${CONFIG.site.title}`,
  };
}

/**
 * Category page — shows all posts matching a given category slug.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let allPosts: Post[] = [];
  try {
    allPosts = await getPosts();
  } catch {
    allPosts = [];
  }

  // Match posts whose category slug matches the URL slug
  const posts = allPosts.filter((post) => {
    const postSlug = post.category?.toLowerCase().replace(/\s+/g, "-");
    return postSlug === slug.toLowerCase();
  });

  // Derive a human-readable name from the first matching post, or from the slug
  const displayName =
    posts[0]?.category ||
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {CONFIG.site.locale === "ko" ? "목록으로" : "Back to feed"}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">{displayName}</h1>
        <p className="text-sm text-text-secondary mt-1">
          {posts.length}{" "}
          {CONFIG.site.locale === "ko"
            ? "개의 포스트"
            : `post${posts.length === 1 ? "" : "s"}`}
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            <span className="text-2xl">📂</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            No posts in this category
          </h2>
          <p className="text-sm text-text-secondary max-w-sm">
            There are no published posts in &quot;{displayName}&quot; yet.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <article
            key={post.id}
            className="group p-4 rounded-lg border border-border hover:border-border-strong hover:shadow-sm transition-all"
          >
            <Link href={`/post/${post.id}`} className="flex gap-4">
              {/* Thumbnail */}
              {post.thumbnail && (
                <div className="relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface">
                  <Image
                    src={post.thumbnail}
                    alt={post.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-text-primary group-hover:text-accent transition-colors line-clamp-2">
                  {post.title}
                </h2>
                {post.summary && (
                  <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                    {post.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary flex-wrap">
                  {post.category && (
                    <span className="px-2 py-0.5 rounded-full bg-surface text-text-secondary">
                      {post.category}
                    </span>
                  )}
                  {post.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full bg-accent-light text-accent"
                    >
                      {tag}
                    </span>
                  ))}
                  <time dateTime={post.createDate}>
                    {new Date(post.createDate).toLocaleDateString(CONFIG.site.locale, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>
            </Link>
          </article>
        ))
      )}
    </div>
  );
}
