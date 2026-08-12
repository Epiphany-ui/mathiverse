"use client";

/**
 * ContentThumbnail — shows the real media for a feed item.
 *
 * Resolution order:
 *   1. posterUrl / coverUrl — an actual image stored in Supabase Storage
 *   2. videoUrl — renders a muted, non-autoplaying <video> so the first
 *      frame acts as the thumbnail (real video content, zero server cost)
 *   3. GenerativeThumbnail — abstract math-art fallback when no media exists
 */

import { GenerativeThumbnail } from "@/components/content/generative-thumbnail";
import { cn } from "@/lib/utils";

interface ContentThumbnailProps {
  /** Poster image URL (visualizations) */
  posterUrl?: string | null;
  /** Cover image URL (articles/wiki) */
  coverUrl?: string | null;
  /** Video URL (visualizations) */
  videoUrl?: string | null;
  /** Fallback tags for the generative thumbnail */
  tags: string[];
  className?: string;
  /** Show a play badge overlay for visualization videos */
  playBadge?: boolean;
}

export function ContentThumbnail({
  posterUrl,
  coverUrl,
  videoUrl,
  tags,
  className,
  playBadge = false,
}: ContentThumbnailProps) {
  const imageUrl = posterUrl ?? coverUrl ?? null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className={cn("absolute inset-0 w-full h-full object-cover", className)}
      />
    );
  }

  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        muted
        playsInline
        preload="metadata"
        className={cn("absolute inset-0 w-full h-full object-cover", className)}
      />
    );
  }

  return <GenerativeThumbnail tags={tags} className={cn("absolute inset-0", className)} />;
}
