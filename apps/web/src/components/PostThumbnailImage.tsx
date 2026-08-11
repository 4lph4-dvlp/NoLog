"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

const WRAPPER = {
  card: "relative shrink-0 w-24 h-24 rounded-md overflow-hidden bg-surface",
  hero: "relative w-full aspect-video rounded-xl overflow-hidden bg-surface mb-10",
} as const;

const ICON_SIZE = { card: "w-8 h-8", hero: "w-12 h-12" } as const;

interface PostThumbnailImageProps {
  src: string;
  alt: string;
  variant: "card" | "hero";
}

/**
 * Client-side rendering half of the thumbnail pair. Receives the resolved
 * thumbnail URL already decided — three primitives only, nothing that could
 * serialise a Notion presigned URL into the RSC hydration payload. On any
 * load failure (proxy non-200, optimizer failure, dropped connection) —
 * detected via `onError` (D-10) — swaps to a centred `ImageOff` icon inside
 * the same unchanged wrapper (D-09: icon only, no caption).
 */
export function PostThumbnailImage({
  src,
  alt,
  variant,
}: PostThumbnailImageProps) {
  const [failed, setFailed] = useState(false);

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
          alt={alt}
          fill
          className="object-cover"
          onError={() => setFailed(true)}
          {...(variant === "card" ? { sizes: "96px" } : { priority: true })}
        />
      )}
    </div>
  );
}
