"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeedItem } from "@/types";
import { MathematicalFallback } from "./mathematical-fallback";
import styles from "./home-gallery.module.css";

interface GalleryHeroProps {
  feature: FeedItem | null;
}

export function GalleryHero({ feature }: GalleryHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const showVideo = Boolean(
    feature?.videoUrl && reducedMotion === false && !videoFailed,
  );

  const syncPausedState = () => {
    setPaused(videoRef.current?.paused ?? true);
  };

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        syncPausedState();
        return;
      }
    } else {
      video.pause();
    }
    syncPausedState();
  };

  const title = feature?.title ?? "轨道、引力与三体运动";
  const description =
    feature?.description ?? "看见数学对象如何在时间中改变、相遇与形成结构。";
  const href = feature ? `/v/${feature.id}` : "/sandbox";

  return (
    <section className={styles.galleryHero} aria-labelledby="gallery-title">
      <div className={styles.heroMedia}>
        {showVideo ? (
          <video
            ref={videoRef}
            className={styles.heroVideo}
            src={feature?.videoUrl ?? undefined}
            poster={feature?.posterUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            onLoadedMetadata={syncPausedState}
            onPause={syncPausedState}
            onPlay={syncPausedState}
          />
        ) : (
          <MathematicalFallback />
        )}
      </div>
      <div className={styles.heroScrim} aria-hidden="true" />
      <div className={styles.heroCopy}>
        <p className={`${styles.monoLabel} ${styles.heroIndex}`}>
          NOW SHOWING / 01
        </p>
        <h1 id="gallery-title" className={styles.heroTitle}>
          {title}
        </h1>
        <p className={styles.heroDescription}>{description}</p>
        <div className={styles.heroActions}>
          <Link className={styles.heroPrimary} href="/sandbox">
            开始创作
          </Link>
          <Link className={styles.focusLink} href={href}>
            查看展品
          </Link>
        </div>
      </div>
      {showVideo && (
        <button
          type="button"
          className={styles.mediaControl}
          onClick={togglePlayback}
          aria-label={paused ? "播放主展品" : "暂停主展品"}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{paused ? "播放" : "暂停"}</span>
        </button>
      )}
    </section>
  );
}
