"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LikeButtonProps {
  liked?: boolean;
  count: number;
  onToggle?: () => void;
  className?: string;
}

export function LikeButton({
  liked = false,
  count,
  onToggle,
  className,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(liked);
  const [animating, setAnimating] = useState(false);

  const handleClick = () => {
    setIsLiked(!isLiked);
    setAnimating(true);
    setTimeout(() => setAnimating(false), 300);
    onToggle?.();
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 group", className)}
      onClick={handleClick}
    >
      <Heart
        className={cn(
          "w-4 h-4 transition-all",
          isLiked && "fill-red-500 text-red-500",
          animating && "scale-125",
        )}
      />
      <span className={cn(isLiked && "text-red-500")}>
        {count}
      </span>
    </Button>
  );
}
