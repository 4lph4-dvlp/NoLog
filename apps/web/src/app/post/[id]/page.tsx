import { getPost, getCategories, getPosts } from "@/lib/notion";
import { getPageRecordMap, describeFetchFailure } from "@/lib/notion-x";
import { classifyMissingPost } from "@/lib/post-availability";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CONFIG } from "@/site.config";
import type { Post } from "@/types";
import DefaultPostPage from "@/templates/default/PostPage";
import TerminalPostPage from "@/templates/terminal/PostPage";
import PostUnavailable from "@/components/PostUnavailable";
import { SubscribeSection } from "@/components/subscribe/SubscribeSection";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);

  if (!post) {
    // The soft-200 mitigation for the discriminator this plan adds below:
    // an unavailable page must never be indexed in place of a real post.
    // Title left unchanged — copywriting for the not-found/unavailable
    // split is out of scope here (D-14).
    return { title: "Post Not Found", robots: { index: false, follow: false } };
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
    // 07-02: getPost() never throws (it swallows to null), so a null result
    // here is indistinguishable between a genuine 404 and a transient
    // Notion failure. classifyMissingPost() (apps/web/src/lib/
    // post-availability.ts) resolves that ambiguity with one extra request,
    // on this already-failed path only — a successful post render never
    // reaches this branch.
    const { verdict, detail } = await classifyMissingPost(id);

    if (verdict === "unavailable") {
      console.error(`[PostPage:post] ${detail}`);
      return <PostUnavailable />;
    }

    // Reached only when Notion authoritatively answered about the page (an
    // HTTP 404, an invalid page id, or a page Notion returned but getPost()
    // still declined) — a genuinely missing post is not a leg failure, so
    // no log line is emitted here. This is the sole call in the file, and
    // it stays outside every try block: it throws a Next.js control-flow
    // Error whose `digest` field is a sentinel Next reads to render the 404
    // boundary, and an ordinary catch would silently swallow it. If a
    // future edit ever needs to place this call inside a try, the required
    // guard is unstable_rethrow from next/navigation, which rethrows that
    // sentinel unchanged before any other catch logic runs.
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
  //   - `await classifyMissingPost(id)` (this function, `!post` branch):
  //     not inside a try at this call site — its own contract, stated and
  //     enforced in apps/web/src/lib/post-availability.ts, is that it never
  //     throws to its caller (every branch, including a thrown fetch,
  //     resolves to a verdict).
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
