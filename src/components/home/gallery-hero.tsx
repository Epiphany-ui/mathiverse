"use client";

import Link from "next/link";
import { Pause, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { FeedItem } from "@/types";
import {
  GALLERY_MEDIA_STARTUP_TIMEOUT_MS,
  galleryMediaReducer,
} from "./gallery-media-state";
import { MathematicalFallback } from "./mathematical-fallback";
import styles from "./home-gallery.module.css";

const AUTOPLAY_INTERVAL = 8000; // 8s per slide

interface GalleryHeroProps {
  features: FeedItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function GalleryHero({
  features,
  currentIndex,
  onIndexChange,
}: GalleryHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  const [mediaState, dispatchMedia] = useReducer(
    galleryMediaReducer,
    "checking",
  );

  // Carousel: index 0 = fallback animation (cover, no text), 1+ = actual features
  const slides = [null, ...features];
  const totalSlides = slides.length;
  const feature = slides[currentIndex] ?? null;

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
  const posterUrl = feature?.posterUrl ?? null;

  useEffect(() => {
    clearStartupTimeout();

    if (!videoUrl || reducedMotion !== false) {
      dispatchMedia({ type: "failed" });
      return;
    }

    dispatchMedia({ type: "source-changed" });
    // If a real poster frame exists, it's acceptable content — keep
    // buffering until the video can actually play.  Without a poster,
    // give up after the startup window and show the fallback art.
    if (!posterUrl) {
      startupTimeoutRef.current = setTimeout(() => {
        startupTimeoutRef.current = null;
        dispatchMedia({ type: "failed" });
      }, GALLERY_MEDIA_STARTUP_TIMEOUT_MS);
    }

    return clearStartupTimeout;
  }, [clearStartupTimeout, reducedMotion, videoUrl, posterUrl]);

  // Autoplay carousel
  useEffect(() => {
    if (totalSlides <= 1) return;
    autoplayRef.current = setInterval(() => {
      onIndexChange((currentIndex + 1) % totalSlides);
    }, AUTOPLAY_INTERVAL);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [totalSlides, currentIndex, onIndexChange]);

  const goTo = (index: number) => {
    onIndexChange(index);
  };

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

  // Only start playback once enough data is buffered — otherwise play()
  // succeeds immediately, the poster disappears, and the video stalls on a
  // black first frame while the rest buffers.
  const handleCanPlay = () => {
    if (mediaState !== "checking") return;
    if ((videoRef.current?.readyState ?? 0) >= 3) {
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
        {showVideo && (
          <video
            ref={videoRef}
            className={`${styles.heroVideo} ${
              mediaState === "video" || mediaState === "paused"
                ? styles.heroVideoVisible
                : ""
            }`}
            src={feature?.videoUrl ?? undefined}
            muted
            loop
            autoPlay
            playsInline
            preload="auto"
            onCanPlay={handleCanPlay}
            onError={activateFallback}
            onPause={() => dispatchMedia({ type: "paused" })}
            onPlay={markPlaying}
          />
        )}
        {/* Real poster frame stays visible while the video buffers */}
        {mediaState !== "video" &&
          mediaState !== "paused" &&
          (feature?.posterUrl ? (
            <img
              className={styles.heroPoster}
              src={feature.posterUrl}
              alt=""
            />
          ) : (
            <MathematicalFallback />
          ))}
      </div>
      <div className={styles.heroScrim} aria-hidden="true" />

      <div className={styles.heroCopy}>
        <p className={`${styles.monoLabel} ${styles.heroIndex}`}>
          NOW SHOWING / {String(currentIndex).padStart(2, "0")}
        </p>
        <h1 id="gallery-title" className={styles.heroTitle}>
          {title}
        </h1>
        <p className={styles.heroDescription}>{description}</p>
        <div className={styles.heroActions}>
          {feature ? (
            <Link className={styles.heroPrimary} href={href}>
              继续学习
            </Link>
          ) : (
            <Link className={styles.heroPrimary} href="/sandbox">
              开始创作
            </Link>
          )}
          <Link className={styles.focusLink} href={feature ? href : "/explore"}>
            {feature ? "查看展品" : "浏览社区"}
          </Link>
        </div>
      </div>

      {/* Carousel controls */}
      {totalSlides > 1 && (
        <>
          <button
            type="button"
            className={styles.carouselPrev}
            onClick={() => goTo((currentIndex - 1 + totalSlides) % totalSlides)}
            aria-label="上一个展品"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.carouselNext}
            onClick={() => goTo((currentIndex + 1) % totalSlides)}
            aria-label="下一个展品"
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <div className={styles.carouselDots} role="tablist" aria-label="展品列表">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentIndex}
                className={`${styles.carouselDot} ${i === currentIndex ? styles.carouselDotActive : ""}`}
                onClick={() => goTo(i)}
                aria-label={i === 0 ? "封面" : `展品 ${i}`}
              />
            ))}
          </div>
        </>
      )}

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
