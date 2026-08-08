"use client";

import { useState, useEffect } from "react";
import { GitFork } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ForkButtonProps {
  vizId: string;
  count: number;
  className?: string;
}

export function ForkButton({ vizId, count, className }: ForkButtonProps) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    init();
  }, []);

  const handleFork = async () => {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    // Navigate to sandbox with fork param — the sandbox will load
    // the source visualization's code and set forkedFrom
    router.push(`/sandbox?fork=${vizId}`);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5", className)}
      onClick={handleFork}
    >
      <GitFork className="w-4 h-4" />
      Fork {count > 0 ? count : ""}
    </Button>
  );
}
