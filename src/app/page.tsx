import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import Link from "next/link";
import Image from "next/image";

/**
 * Home page — renders the main post feed.
 * Uses ISR to stay fresh without rebuilding.
 */
export default async function HomePage() {
  let posts: Post[];
  try {
    posts = await getPosts();
  } catch {
    // Gracefully handle missing Notion config
    posts = [];
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
          <span className="text-2xl">📝</span>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          No posts yet
        </h2>
        <p className="text-sm text-text-secondary max-w-sm">
          Connect your Notion database and publish your first post by setting
          its status to &quot;public&quot;.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {posts.map((post) => (
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
                  {new Date(post.createDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </div>
            </div>
          </Link>
        </article>
      ))}
    </div>
  );
}
