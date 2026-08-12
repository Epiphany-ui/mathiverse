import Link from "next/link";
import type { FeedItem } from "@/types";
import styles from "./home-gallery.module.css";

interface ExhibitionIndexProps {
  feature: FeedItem | null;
  next: FeedItem | null;
  story: FeedItem | null;
}

function itemHref(item: FeedItem): string {
  return item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
}

export function ExhibitionIndex({
  feature,
  next,
  story,
}: ExhibitionIndexProps) {
  const entries = [
    { label: "NOW SHOWING / 01", item: feature, fallback: "Living Mathematics" },
    { label: "NEXT / 02", item: next, fallback: "Create the next study" },
    { label: "COMMUNITY NOTE", item: story, fallback: "Ideas become motion" },
  ];

  return (
    <section className={styles.exhibitionIndex} aria-label="展览索引">
      {entries.map((entry) => (
        <div className={styles.indexEntry} key={entry.label}>
          <span className={styles.monoLabel}>{entry.label}</span>
          {entry.item ? (
            <Link className={styles.indexLink} href={itemHref(entry.item)}>
              {entry.item.title}
            </Link>
          ) : (
            <span className={styles.indexFallback}>{entry.fallback}</span>
          )}
        </div>
      ))}
    </section>
  );
}
