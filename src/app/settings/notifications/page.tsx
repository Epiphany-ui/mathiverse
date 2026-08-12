"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Bell, ExternalLink } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  actor?: { username: string; displayName: string; avatarUrl?: string | null };
  targetType?: string;
  targetId?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const hrefFor = (n: Notification) => {
    if (!n.targetId) return "#";
    if (n.type === "follow") return n.actor ? `/u/${n.actor.username}` : "#";
    if (n.targetType === "article") return `/a/${n.targetId}`;
    if (n.targetType === "wiki") return `/wiki/${n.targetId}`;
    if (n.targetType === "comment") return `/v/${n.targetId}`;
    return `/v/${n.targetId}`;
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "like": return "赞了";
      case "comment": return "评论了";
      case "follow": return "关注了";
      case "fork": return "Fork 了";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-20 px-6 max-w-3xl mx-auto w-full z-10 space-y-6 pb-20">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 rounded-full">
              <ArrowLeft className="w-4 h-4" /> 返回设置
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" /> 通知历史
          </h1>
          {notifications.some((n) => !n.isRead) && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              全部已读
            </Button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-[#9c9890]">加载中…</div>
        ) : notifications.length === 0 ? (
          <GlassCard className="p-12 text-center" hover={false}>
            <Bell className="w-12 h-12 text-[#e6dfd8] mx-auto mb-4" />
            <p className="text-[#6c6a64] text-sm">暂无通知</p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <a key={n.id} href={hrefFor(n)} className="block">
                <GlassCard className={`p-4 flex items-center gap-3 hover:border-[#cc785c]/30 transition-colors ${!n.isRead ? "border-[#cc785c]/20 bg-[#cc785c]/5" : ""}`} hover>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#141413] truncate">
                      <span className="font-medium">{n.actor?.displayName ?? "某人"}</span>{" "}
                      {typeLabel(n.type)}你的作品
                    </p>
                    <p className="text-xs text-[#9c9890] mt-0.5">
                      {new Date(n.createdAt).toLocaleDateString("zh-CN")}{" "}
                      {new Date(n.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[#9c9890] shrink-0" />
                </GlassCard>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
