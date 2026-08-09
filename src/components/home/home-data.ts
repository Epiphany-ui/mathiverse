import type { FeedItem } from "@/types";

export function selectGalleryFeature(items: FeedItem[]): FeedItem | null {
  return (
    items.find(
      (item) => item.type === "visualization" && Boolean(item.videoUrl),
    ) ??
    items.find((item) => item.type === "visualization") ??
    null
  );
}
