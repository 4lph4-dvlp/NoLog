"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { Post } from "@/types";

const WRAPPER = {
  card: "relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface",
  hero: "relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10",
} as const;

const ICON_SIZE = { card: "w-8 h-8", hero: "w-12 h-12" } as const;

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
 */
export function PostThumbnail({ post, variant }: PostThumbnailProps) {
  const [failed, setFailed] = useState(false);

  // Preserves the guard all four call sites carry today — no thumbnail
  // configured renders nothing at all, a different, pre-existing condition
  // from a load failure (out of IMG-04's scope).
  if (!post.thumbnail) return null;

  const src =
    post.thumbnailType === "external"
      ? post.thumbnail
      : `/api/thumbnail/${post.id}`;

  return (
    <div className={WRAPPER[variant]}>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff
            className={`${ICON_SIZE[variant]} text-text-tertiary`}
            strokeWidth={1.5}
          />
        </div>
      ) : (
        <Image
          src={src}
          alt={post.title}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          {...(variant === "card" ? { sizes: "96px" } : { priority: true })}
        />
      )}
    </div>
  );
}
