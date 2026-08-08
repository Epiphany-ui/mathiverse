"use client";

import { GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface ForkButtonProps {
  vizId: string;
  count: number;
  className?: string;
}

export function ForkButton({ vizId, count, className }: ForkButtonProps) {
  const router = useRouter();

  const handleFork = () => {
    router.push(`/sandbox/${vizId}`);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={handleFork}
    >
      <GitFork className="w-4 h-4" />
      <span>Fork {count > 0 ? count : ""}</span>
    </Button>
  );
}
