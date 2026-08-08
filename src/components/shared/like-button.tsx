"use client";

import { useState, useEffect, useCallback } from "react";
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
  targetType: "visualization" | "article" | "comment";
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
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Check auth and like state on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      const liked = await getLikeState(supabase, user.id, targetType, targetId);
      setIsLiked(liked);
    };
    init();
  }, [targetType, targetId]);

  const handleClick = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (loading) return;
    setLoading(true);

    const wasLiked = isLiked;

    // Optimistic update
    setIsLiked(!wasLiked);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);

    // Persist
    const result = wasLiked
      ? await removeLike(supabase, user.id, targetType, targetId)
      : await addLike(supabase, user.id, targetType, targetId);

    if (result.error) {
      // Revert on error
      setIsLiked(wasLiked);
    }

    setLoading(false);
  }, [isLiked, loading, targetType, targetId]);

  // Calculate display count with optimistic offset
  const displayCount = count + (isLiked ? 0 : 0); // server count + local

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 group", className)}
      onClick={handleClick}
      disabled={loading}
    >
      <Heart
        className={cn(
          "w-4 h-4 transition-all",
          isLiked && "fill-red-500 text-red-500",
          animating && "scale-125",
        )}
      />
      <span className={cn(isLiked && "text-red-500")}>
        {displayCount}
      </span>
    </Button>
  );
}
