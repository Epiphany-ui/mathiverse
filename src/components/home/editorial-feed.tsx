import Link from "next/link";
import { ContentThumbnail } from "@/components/content/content-thumbnail";
import { MathText } from "@/components/content/math-text";
import type { FeedItem } from "@/types";
import type { EditorialSlots } from "./home-data";
import styles from "./home-gallery.module.css";

function itemHref(item: FeedItem): string {
  return item.type === "visualization" ? `/v/${item.id}` : `/a/${item.id}`;
}

function EditorialItem({
  item,
  variant,
}: {
  item: FeedItem;
  variant: "lead" | "story" | "supporting";
}) {
  // Only show real media (poster/cover/video).  Without this guard the
  // generative art fallback would stand in for a "thumbnail" and make real
  // content look like mock data.
  const hasMedia = Boolean(item.posterUrl || item.coverUrl || item.videoUrl);
  return (
    <article className={styles[`${variant}Item`]}>
      <Link className={styles.editorialLink} href={itemHref(item)}>
        {variant !== "story" && hasMedia && (
          <div className={styles.editorialVisual}>
            <ContentThumbnail
              posterUrl={item.posterUrl}
              coverUrl={item.coverUrl}
              videoUrl={item.videoUrl}
              tags={item.tags}
              className={styles.editorialArtwork}
              playBadge={item.type === "visualization"}
            />
          </div>
        )}
        <div className={styles.editorialCopy}>
          <span className={styles.monoLabel}>
            {item.type === "visualization" ? "VISUAL STUDY" : "ESSAY"}
          </span>
          <h3>
            <MathText text={item.title} />
          </h3>
          {item.description && (
            <p>
              <MathText text={item.description} />
            </p>
          )}
          <span className={styles.editorialAuthor}>{item.author.displayName}</span>
        </div>
      </Link>
    </article>
  );
}

export function EditorialFeed({ slots }: { slots: EditorialSlots }) {
  if (!slots.lead && !slots.story && slots.supporting.length === 0) return null;

  return (
    <section className={styles.communitySection} aria-labelledby="community-title">
      <div className={styles.sectionHeading}>
        <span className={styles.monoLabel}>COMMUNITY / SELECTED WORKS</span>
        <h2 id="community-title">社区正在研究什么</h2>
      </div>
      <div className={styles.editorialGrid}>
        {slots.lead && <EditorialItem item={slots.lead} variant="lead" />}
        {slots.story && <EditorialItem item={slots.story} variant="story" />}
        {slots.supporting.map((item) => (
          <EditorialItem
            item={item}
            key={`${item.type}-${item.id}`}
            variant="supporting"
          />
        ))}
      </div>
    </section>
  );
}
