"use client";

import { useEffect } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 z-10">
        <GlassCard className="max-w-md w-full p-8 text-center space-y-6" hover={false}>
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">出错了</h1>
            <p className="text-sm text-muted-foreground">
              页面加载时发生了意外错误。请尝试刷新页面。
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/50 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={reset}
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </Button>
            <Link href="/">
              <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-secondary">
                <Home className="w-4 h-4" />
                返回首页
              </Button>
            </Link>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
