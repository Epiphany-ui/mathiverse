import Link from "next/link";
import type { FeedItem } from "@/types";
import styles from "./home-gallery.module.css";

interface ExhibitionIndexProps {
  /** Same items passed to GalleryHero carousel (excluding fallback slide 0) */
  features: FeedItem[];
  /** Current carousel index (0 = cover/fallback, 1+ = features) */
  currentIndex: number;
}

function itemHref(item: FeedItem): string {
  return item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
}

/**
 * Get the item at a given carousel position, wrapping around.
 * Position 0 = cover (returns null), 1+ = features[position-1].
 */
function itemAt(features: FeedItem[], carouselPos: number): FeedItem | null {
  if (carouselPos === 0) return null;
  const idx = carouselPos - 1;
  if (idx >= features.length) return null;
  return features[idx] ?? null;
}

export function ExhibitionIndex({
  features,
  currentIndex,
}: ExhibitionIndexProps) {
  const totalSlides = features.length + 1; // +1 for cover

  const nowShowingPos = currentIndex;
  const nextPos = (currentIndex + 1) % totalSlides;
  const communityPos = (currentIndex + 2) % totalSlides;

  const nowItem = itemAt(features, nowShowingPos);
  const nextItem = itemAt(features, nextPos);
  const communityItem = itemAt(features, communityPos);

  return (
    <section className={styles.exhibitionIndex} aria-label="展览索引">
      <div className={styles.indexEntry}>
        <span className={styles.monoLabel}>NOW SHOWING / 01</span>
        {nowItem ? (
          <Link className={styles.indexLink} href={itemHref(nowItem)}>
            {nowItem.title}
          </Link>
        ) : (
          <span className={styles.indexFallback}>Living Mathematics</span>
        )}
      </div>
      <div className={styles.indexEntry}>
        <span className={styles.monoLabel}>NEXT / 02</span>
        {nextItem ? (
          <Link className={styles.indexLink} href={itemHref(nextItem)}>
            {nextItem.title}
          </Link>
        ) : (
          <span className={styles.indexFallback}>Living Mathematics</span>
        )}
      </div>
      <div className={styles.indexEntry}>
        <span className={styles.monoLabel}>COMMUNITY NOTE</span>
        {communityItem ? (
          <Link className={styles.indexLink} href={itemHref(communityItem)}>
            {communityItem.title}
          </Link>
        ) : (
          <Link className={styles.indexLink} href="/explore">
            探索社区精选
          </Link>
        )}
      </div>
    </section>
  );
}
