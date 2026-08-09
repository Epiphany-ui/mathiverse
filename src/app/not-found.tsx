import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Compass, Home, Search } from "lucide-react";
import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 z-10">
        <GlassCard className="max-w-md w-full p-8 text-center space-y-6" hover={false}>
          {/* 404 illustration */}
          <div className="relative">
            <div className="text-8xl font-black bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent select-none">
              404
            </div>
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-primary to-secondary rounded-full" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold">页面未找到</h1>
            <p className="text-sm text-muted-foreground">
              你寻找的页面可能已被移动、删除，或者从未存在过。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 w-full"
              >
                <Home className="w-4 h-4" />
                返回首页
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                size="sm"
                className="gap-1.5 w-full bg-[#cc785c] hover:bg-[#a9583e] text-white"
              >
                <Compass className="w-4 h-4" />
                浏览社区
              </Button>
            </Link>
          </div>
        </GlassCard>
      </main>
    </div>
  );
}
