import { getPost, getCategories, getPosts } from "@/lib/notion";
import { getPageRecordMap, describeFetchFailure } from "@/lib/notion-x";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";
import DefaultPostPage from "@/templates/default/PostPage";
import TerminalPostPage from "@/templates/terminal/PostPage";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";

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

  // D-17 audit — every `await` in this file, and either the `try` that
  // encloses it or why it structurally cannot throw:
  //   - `await params` (generateMetadata + this function): awaiting an
  //     already-resolved value, no I/O, cannot throw.
  //   - `await getPost(id)` (generateMetadata + this function):
  //     `packages/core/src/client.ts:311-338` wraps this method's entire
  //     body in `try { ... } catch { return null }`, so it cannot throw to
  //     a caller.
  //   - `await getPageRecordMap(id)`: content leg `try`, below.
  //   - `await getCategories()` / `await getPosts()`: chrome leg `try`,
  //     below.
  //   - `await describeFetchFailure(...)` (both catch blocks below): inside
  //     each leg's own `catch`; the helper is documented (lib/notion-x.ts)
  //     to never throw.

  // Content leg — isolated per concern (D-11/CONT-01/CONT-04): a chrome-leg
  // failure below can never null a recordMap that already succeeded here,
  // because the two are caught separately.
  let recordMap: Awaited<ReturnType<typeof getPageRecordMap>> | null = null;
  try {
    recordMap = await getPageRecordMap(id);
  } catch (error) {
    console.error(`[PostPage:recordMap] ${await describeFetchFailure(error, id, true)}`);
    recordMap = null;
  }

  // Chrome leg — categories + related posts, attempted after the content
  // leg so a request failing on both legs logs in a fixed, deterministic
  // order (content before chrome). `allowProbe` is false: these calls go
  // through @notionhq/client against api.notion.com, not through
  // notion-client against the unofficial endpoint, so the D-04 probe's
  // loadPageChunk target would describe the wrong request. Per D-13 this
  // degradation is silent to the reader — the empty arrays are the only
  // user-visible consequence, matching apps/web/src/app/layout.tsx:46-53's
  // existing site-wide precedent (which lacks logging; this leg adds it).
  let categories: string[] = [];
  let relatedPosts: Post[] = [];
  try {
    categories = await getCategories();

    if (post.category) {
      const allPosts = await getPosts();
      relatedPosts = allPosts.filter(p => p.category === post.category);
    }
  } catch (error) {
    console.error(`[PostPage:chrome] ${await describeFetchFailure(error, id, false)}`);
    categories = [];
    relatedPosts = [];
  }

  if (CONFIG.template === "default") {
    return <DefaultPostPage post={post} recordMap={recordMap} />;
  } else if (CONFIG.template === "terminal") {
    // The gate is constructed here, in a Server Component, and passed down as
    // an already-rendered element — never as a direct import inside the
    // client-directive terminal template (D-01, D-04, SEC-03).
    return (
      <TerminalPostPage
        post={post}
        recordMap={recordMap}
        categories={categories}
        relatedPosts={relatedPosts}
        subscribeSlot={<SubscribeSection variant="terminal" />}
      />
    );
  }

  // Default fallback
  return <DefaultPostPage post={post} recordMap={recordMap} />;
}
