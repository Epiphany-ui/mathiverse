import { ConceptPrompt } from "@/components/home/concept-prompt";
import { EditorialFeed } from "@/components/home/editorial-feed";
import { ExhibitionIndex } from "@/components/home/exhibition-index";
import { GalleryHero } from "@/components/home/gallery-hero";
import {
  buildEditorialSlots,
  buildFieldLinks,
  selectGalleryFeature,
} from "@/components/home/home-data";
import styles from "@/components/home/home-gallery.module.css";
import { MathFieldMap } from "@/components/home/math-field-map";
import { AppHeader } from "@/components/layout/app-header";
import { buildFeedItems } from "@/lib/db/queries";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const feedItems = supabase ? await buildFeedItems(supabase, "hot") : [];
  const feature = selectGalleryFeature(feedItems);
  const slots = buildEditorialSlots(feedItems, feature);
  const fields = buildFieldLinks(feedItems);

  return (
    <div className={styles.page}>
      <div className={styles.darkStage}>
        <AppHeader appearance="gallery" />
        <GalleryHero feature={feature} />
        <ExhibitionIndex
          feature={feature}
          next={slots.lead}
          story={slots.story}
        />
      </div>
      <main className={styles.lightStage}>
        <MathFieldMap fields={fields} />
        <EditorialFeed slots={slots} />
        <ConceptPrompt />
      </main>
    </div>
  );
}
