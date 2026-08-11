"use client";

import { useState } from "react";
import type { FeedItem } from "@/types";
import { GalleryHero } from "./gallery-hero";
import { ExhibitionIndex } from "./exhibition-index";

interface GallerySectionProps {
  features: FeedItem[];
}

export function GallerySection({ features }: GallerySectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <>
      <GalleryHero
        features={features}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
      />
      <ExhibitionIndex
        features={features}
        currentIndex={currentIndex}
      />
    </>
  );
}
