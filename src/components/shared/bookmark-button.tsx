"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  bookmarked?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function BookmarkButton({
  bookmarked = false,
  onToggle,
  className,
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(bookmarked);

  const handleClick = () => {
    setIsBookmarked(!isBookmarked);
    onToggle?.();
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8", className)}
      onClick={handleClick}
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
