"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { FeedItem } from "@/types";
import {
  GALLERY_MEDIA_STARTUP_TIMEOUT_MS,
  galleryMediaReducer,
} from "./gallery-media-state";
import { MathematicalFallback } from "./mathematical-fallback";
import styles from "./home-gallery.module.css";

interface GalleryHeroProps {
  feature: FeedItem | null;
}

export function GalleryHero({ feature }: GalleryHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [mediaState, dispatchMedia] = useReducer(
    galleryMediaReducer,
    "checking",
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const clearStartupTimeout = useCallback(() => {
    if (startupTimeoutRef.current === null) return;
    clearTimeout(startupTimeoutRef.current);
    startupTimeoutRef.current = null;
  }, []);

  const activateFallback = useCallback(() => {
    clearStartupTimeout();
    dispatchMedia({ type: "failed" });
  }, [clearStartupTimeout]);

  const videoUrl = feature?.videoUrl ?? null;

  useEffect(() => {
    clearStartupTimeout();

    if (!videoUrl || reducedMotion !== false) {
      dispatchMedia({ type: "failed" });
      return;
    }

    dispatchMedia({ type: "source-changed" });
    startupTimeoutRef.current = setTimeout(() => {
      startupTimeoutRef.current = null;
      dispatchMedia({ type: "failed" });
    }, GALLERY_MEDIA_STARTUP_TIMEOUT_MS);

    return clearStartupTimeout;
  }, [clearStartupTimeout, reducedMotion, videoUrl]);

  const showVideo = Boolean(
    videoUrl && reducedMotion === false && mediaState !== "fallback",
  );

  const markPlaying = () => {
    clearStartupTimeout();
    dispatchMedia({ type: "played" });
  };

  const playVideo = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      markPlaying();
    } catch {
      activateFallback();
    }
  };

  const handleCanPlay = () => {
    if (mediaState === "checking") {
      void playVideo();
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void playVideo();
    } else {
      video.pause();
    }
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
            onCanPlay={handleCanPlay}
            onError={activateFallback}
            onPause={() => dispatchMedia({ type: "paused" })}
            onPlay={markPlaying}
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
          aria-label={mediaState === "paused" ? "播放主展品" : "暂停主展品"}
        >
          {mediaState === "paused" ? (
            <Play aria-hidden="true" />
          ) : (
            <Pause aria-hidden="true" />
          )}
          <span>{mediaState === "paused" ? "播放" : "暂停"}</span>
        </button>
      )}
    </section>
  );
}
