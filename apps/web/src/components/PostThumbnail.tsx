import type { Post } from "@/types";
import { PostThumbnailImage } from "@/components/PostThumbnailImage";

interface PostThumbnailProps {
  post: Post;
  variant: "card" | "hero";
}

/**
 * Shared thumbnail renderer for all four `default`-template surfaces
 * (D-01, D-02). Resolves a Notion-hosted ("file") thumbnail through the
 * `/api/thumbnail/[id]` proxy so cached HTML never embeds the expiring
 * presigned URL directly; an external thumbnail renders unchanged (IMG-05).
 * On any load failure (proxy non-200, optimizer failure, dropped
 * connection) — detected client-side via `onError` (D-10) — swaps to a
 * centred `ImageOff` icon inside the same unchanged wrapper (D-09: icon
 * only, no caption).
 *
 * This component holds the whole `Post` object and must stay a Server
 * Component: turning it into a client island would re-serialise the
 * expiring presigned URL into the RSC hydration payload — gap G-09-1,
 * 09-EVIDENCE.md Tier 2.
 */
export function PostThumbnail({ post, variant }: PostThumbnailProps) {
  // Preserves the guard all four call sites carry today — no thumbnail
  // configured renders nothing at all, a different, pre-existing condition
  // from a load failure (out of IMG-04's scope).
  if (!post.thumbnail) return null;

  const src =
    post.thumbnailType === "external"
      ? post.thumbnail
      : `/api/thumbnail/${post.id}`;

  return (
    <PostThumbnailImage src={src} alt={post.title} variant={variant} />
  );
}
