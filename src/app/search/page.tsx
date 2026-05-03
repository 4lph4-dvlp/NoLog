import { getPosts } from "@/lib/notion";
import type { Post } from "@/types";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { CONFIG } from "@/site.config";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const rawQuery = (await searchParams).q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim() ?? "";

  let allPosts: Post[] = [];
  try {
    allPosts = await getPosts();
  } catch {
    allPosts = [];
  }

  const q = query ? query.toLowerCase() : "";
  const posts = allPosts.filter((post) => {
    if (!q) return false;
    if (post.title?.toLowerCase().includes(q)) return true;
    if (post.summary?.toLowerCase().includes(q)) return true;
    if (post.category?.toLowerCase().includes(q)) return true;
    if (post.tags?.some((tag) => tag.toLowerCase().includes(q))) return true;
    return false;
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-accent transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {CONFIG.site.locale === "ko" ? "목록으로" : "Back to feed"}
        </Link>
        <h1 className="text-2xl font-bold text-text-primary">
          {CONFIG.site.locale === "ko"
            ? `"${query}"에 대한 검색 결과`
            : `Search Results for "${query}"`}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {CONFIG.site.locale === "ko"
            ? `${posts.length}개의 포스트를 찾았습니다.`
            : `Found ${posts.length} post${posts.length === 1 ? "" : "s"}`}
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            {CONFIG.site.locale === "ko" ? "검색 결과 없음" : "No results found"}
          </h2>
          <p className="text-sm text-text-secondary max-w-sm">
            {CONFIG.site.locale === "ko"
              ? "검색어를 조정하거나 카테고리를 찾아보세요."
              : "Try adjusting your search query or browse categories."}
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <article
            key={post.id}
            className="group p-4 rounded-lg border border-border hover:border-border-strong hover:shadow-sm transition-all"
          >
            <Link href={`/post/${post.id}`} className="flex gap-4">
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
