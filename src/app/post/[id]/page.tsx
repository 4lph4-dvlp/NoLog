import { getPost, getCategories, getPosts } from "@/lib/notion";
import { getPageRecordMap } from "@/lib/notion-x";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";
import DefaultPostPage from "@/templates/default/PostPage";
import TerminalPostPage from "@/templates/terminal/PostPage";

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
    ...(post.status === "public"
      ? {}
      : { robots: { index: false, follow: false } }),
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
  let categories: string[] = [];
  let relatedPosts: Post[] = [];
  try {
    recordMap = await getPageRecordMap(id);
    categories = await getCategories();
    
    if (post.category) {
      const allPosts = await getPosts();
      relatedPosts = allPosts.filter(p => p.category === post.category);
    }
  } catch (error) {
    console.error("[PostPage] Failed to fetch page recordMap or categories:", error);
    recordMap = null;
    categories = [];
    relatedPosts = [];
  }

  if (CONFIG.template === "default") {
    return <DefaultPostPage post={post} recordMap={recordMap} />;
  } else if (CONFIG.template === "terminal") {
    return <TerminalPostPage post={post} recordMap={recordMap} categories={categories} relatedPosts={relatedPosts} />;
  }

  // Default fallback
  return <DefaultPostPage post={post} recordMap={recordMap} />;
}
