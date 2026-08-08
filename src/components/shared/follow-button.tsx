"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getFollowState, toggleFollow } from "@/lib/db/interactions";

interface FollowButtonProps {
  userId: string;
  className?: string;
}

export function FollowButton({ userId, className }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      if (user.id === userId) {
        setIsSelf(true);
        return;
      }

      const following = await getFollowState(supabase, user.id, userId);
      setIsFollowing(following);
    };
    init();
  }, [userId]);

  const handleToggle = useCallback(async () => {
    if (!currentUserId || loading) return;

    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setLoading(true);
    const result = await toggleFollow(supabase, user.id, userId, isFollowing);

    if (!result.error) {
      setIsFollowing(result.following);
    }

    setLoading(false);
  }, [currentUserId, userId, isFollowing, loading]);

  // Don't show follow button for own profile
  if (isSelf) return null;

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      className={cn(
        "gap-1.5 shrink-0",
        isFollowing
          ? ""
          : "bg-gradient-to-r from-primary to-secondary",
        className,
      )}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="w-4 h-4" />
      ) : (
        <UserPlus className="w-4 h-4" />
      )}
      {isFollowing ? "已关注" : "关注"}
    </Button>
  );
}
