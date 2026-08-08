"use client";

import { useState, useEffect, useCallback } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  getBookmarkState,
  addBookmark,
  removeBookmark,
} from "@/lib/db/interactions";

interface BookmarkButtonProps {
  targetType: "visualization" | "article";
  targetId: string;
  className?: string;
}

export function BookmarkButton({
  targetType,
  targetId,
  className,
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check auth and bookmark state on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const bookmarked = await getBookmarkState(
        supabase,
        user.id,
        targetType,
        targetId,
      );
      setIsBookmarked(bookmarked);
    };
    init();
  }, [targetType, targetId]);

  const handleClick = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (loading) return;
    setLoading(true);

    const wasBookmarked = isBookmarked;

    // Optimistic update
    setIsBookmarked(!wasBookmarked);

    // Persist
    const result = wasBookmarked
      ? await removeBookmark(supabase, user.id, targetType, targetId)
      : await addBookmark(supabase, user.id, targetType, targetId);

    if (result.error) {
      setIsBookmarked(wasBookmarked);
    }

    setLoading(false);
  }, [isBookmarked, loading, targetType, targetId]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={handleClick}
      disabled={loading}
    >
      <Bookmark
        className={cn(
          "w-4 h-4 transition-colors",
          isBookmarked && "fill-primary text-primary",
        )}
      />
    </Button>
  );
}
