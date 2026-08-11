"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getLikeState,
  addLike,
  removeLike,
} from "@/lib/db/interactions";

interface LikeButtonProps {
  targetType: "visualization" | "article" | "comment" | "wiki";
  targetId: string;
  count: number;
  className?: string;
}

export function LikeButton({
  targetType,
  targetId,
  count,
  className,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [localCount, setLocalCount] = useState(count);
  const [animating, setAnimating] = useState(false);
  const [burst, setBurst] = useState(false);
  const inFlightRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const lastServerCount = useRef(count);

  // Sync localCount only when server count genuinely changes (not after our own mutations)
  useEffect(() => {
    if (count !== lastServerCount.current) {
      lastServerCount.current = count;
      if (!inFlightRef.current) {
        setLocalCount(count);
      }
    }
  }, [count]);

  // Check auth and like state on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const liked = await getLikeState(supabase, user.id, targetType, targetId);
      if (!cancelled) {
        setIsLiked(liked);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [targetType, targetId]);

  const handleClick = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPending(true);

    try {
      const supabase = createClient();
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href =
          `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      const wasLiked = isLiked;
      setIsLiked(!wasLiked);
      setLocalCount((current) => current + (wasLiked ? -1 : 1));
      setAnimating(true);
      if (!wasLiked) setBurst(true);
      setTimeout(() => setAnimating(false), 400);
      setTimeout(() => setBurst(false), 500);

      const result = wasLiked
        ? await removeLike(supabase, user.id, targetType, targetId)
        : await addLike(supabase, user.id, targetType, targetId);

      if (result.error) {
        setIsLiked(wasLiked);
        setLocalCount((current) => current + (wasLiked ? 1 : -1));
      }
    } finally {
      inFlightRef.current = false;
      setIsPending(false);
    }
  }, [isLiked, targetId, targetType]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 group relative btn-press", className)}
      onClick={handleClick}
      disabled={isPending}
    >
      {burst && (
        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-heart-ring pointer-events-none" />
      )}
      <Heart
        className={cn(
          "w-4 h-4 transition-all",
          isLiked && "fill-red-500 text-red-500",
          animating && "animate-heart-burst",
        )}
      />
      <span className={cn(isLiked && "text-red-500")}>
        {localCount}
      </span>
    </Button>
  );
}
