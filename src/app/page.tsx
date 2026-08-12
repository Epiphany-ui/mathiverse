import { ConceptPrompt } from "@/components/home/concept-prompt";
import { EditorialFeed } from "@/components/home/editorial-feed";
import { GallerySection } from "@/components/home/gallery-section";
import {
  buildEditorialSlots,
  buildFieldLinks,
  selectGalleryFeature,
} from "@/components/home/home-data";
import styles from "@/components/home/home-gallery.module.css";
import { MathFieldMap } from "@/components/home/math-field-map";
import { WikiSpotlight } from "@/components/home/wiki-spotlight";
import { AppHeader } from "@/components/layout/app-header";
import { RegisteredToast } from "@/components/home/registered-toast";
import { buildFeedItems } from "@/lib/db/queries";
import { getAllWikiEntriesForListing } from "@/lib/db/wiki";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const [feedItems, wikiEntries] = supabase
    ? await Promise.all([
        buildFeedItems(supabase, "hot"),
        getAllWikiEntriesForListing(supabase),
      ])
    : [[], []];
  const feature = selectGalleryFeature(feedItems);
  const slots = buildEditorialSlots(feedItems, feature);
  const fields = buildFieldLinks(feedItems);

  // Carousel: featured item first, then up to 3 other visualizations with video
  const carouselFeatures = [
    ...(feature ? [feature] : []),
    ...feedItems
      .filter(
        (f) =>
          f.type === "visualization" &&
          f.videoUrl &&
          f.id !== feature?.id,
      )
      .slice(0, 3),
  ];

  return (
    <div className={styles.page}>
      <RegisteredToast />
      <div className={styles.darkStage}>
        <AppHeader appearance="gallery" />
        <GallerySection features={carouselFeatures} />
      </div>
      <main className={styles.lightStage}>
        <MathFieldMap fields={fields} />
        <WikiSpotlight entries={wikiEntries} />
        <EditorialFeed slots={slots} />
        <ConceptPrompt />
      </main>
    </div>
  );
}
