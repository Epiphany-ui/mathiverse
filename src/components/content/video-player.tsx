"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, Volume2, VolumeX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  type?: "video" | "gif";
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
}

export function VideoPlayer({
  src,
  poster,
  type = "video",
  className,
  autoPlay = false,
  loop = true,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch (err: unknown) {
        // AbortError: rapid pause/play (second click interrupts first) — not a real error
        // NotAllowedError: browser blocks unmuted autoplay — video still loaded, don't fail
        if (err instanceof DOMException) {
          if (err.name === "AbortError" || err.name === "NotAllowedError") return;
        }
        setHasError(true);
        setErrorMessage(
          err instanceof Error ? err.message : "无法播放此视频",
        );
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(!isMuted);
  };

  const handleError = () => {
    setHasError(true);
    // Try to extract a useful message from the video element
    const video = videoRef.current;
    if (video?.error) {
      const codes = ["", "加载中止", "网络错误", "解码失败", "格式不支持"];
      setErrorMessage(codes[video.error.code] ?? `媒体错误 (${video.error.code})`);
    }
  };

  // Error state — show fallback with message
  if (hasError) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-[#f5f2ed] border border-[#e6dfd8]",
          "flex flex-col items-center justify-center gap-2 aspect-video",
          className,
        )}
      >
        <AlertCircle className="w-8 h-8 text-[#cc785c]/40" />
        <p className="text-sm text-[#6c6a64]">{errorMessage ?? "视频加载失败"}</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-[#cc785c] hover:text-[#a9583e] mt-1"
          onClick={() => {
            setHasError(false);
            setErrorMessage(null);
            setIsPlaying(autoPlay);
          }}
        >
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative group overflow-hidden rounded-lg", className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onEnded={() => setIsPlaying(false)}
        onError={handleError}
        onClick={togglePlay}
      />

      {/* Overlay controls — show on hover */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-12 w-12 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={toggleMute}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
