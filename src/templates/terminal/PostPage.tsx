"use client";

import type { Post } from "@/types";
import { NotionPageRenderer } from "@/components/notion/NotionPageRenderer";
import { CommentSection } from "@/components/comments/CommentSection";
import Image from "next/image";
import Link from "next/link";
import { TerminalConsole } from "./components/TerminalConsole";
import { CONFIG } from "@/site.config";
import { useRouter } from "next/navigation";

interface TerminalPostPageProps {
  post: Post;
  recordMap: any;
  categories: string[];
}

export default function TerminalPostPage({ post, recordMap, categories }: TerminalPostPageProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-8 items-start w-full max-w-6xl mx-auto">
      {/* Post Content Area */}
      <article className="w-full bg-transparent rounded-xl">
        <header className="mb-10">
          {post.category && (
            <div className="mb-4">
              <Link
                href={`/category/${post.category.toLowerCase().replace(/\s+/g, "-")}`}
                className="inline-block px-2 py-1 text-xs font-mono rounded bg-emerald-950 text-emerald-400 border border-emerald-800 hover:opacity-80"
              >
                [{post.category}]
              </Link>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl font-bold text-emerald-400 leading-tight mb-4">
            {post.title}
          </h1>

          <div className="flex flex-col gap-1 text-sm font-mono text-zinc-500 mt-2">
            <span>author: {post.author}</span>
            <time dateTime={post.createDate}>
              created: {new Date(post.createDate).toISOString().split('T')[0]}
            </time>
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="px-2 py-0.5 text-xs font-mono rounded-full bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
        </header>

        {post.thumbnail && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-10 border border-zinc-800">
            <Image
              src={post.thumbnail}
              alt={post.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="notion-content-wrapper">
          {recordMap ? (
            <NotionPageRenderer recordMap={recordMap} />
          ) : (
            <p className="text-error font-mono">ERR: Content could not be loaded.</p>
          )}
        </div>

        <div className="mt-16">
           <CommentSection postId={post.id} postTitle={post.title} />
        </div>
      </article>

      {/* Terminal Area (Below the post) */}
      <div className="w-full h-[50vh] flex border-t border-zinc-800 pt-8">
        <TerminalConsole 
          path={`~/${post.category ? post.category.toLowerCase().replace(/\s+/g, "-") : ""}/${post.id.slice(0, 8)}`} 
          posts={[]} // Pass empty posts to force user to use cd to navigate around
          categories={categories} 
          initialCommand="" // Start empty so user can type `cd ~`
          onClear={() => {
            const lastPath = sessionStorage.getItem("nolog_last_path");
            router.push(lastPath || "/");
          }}
        />
      </div>
    </div>
  );
}
