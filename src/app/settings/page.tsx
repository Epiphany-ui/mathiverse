"use client";

import { useState, useEffect } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Settings, User, Bell, Shield, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? "");
        setDisplayName(
          (user.user_metadata?.display_name as string) ?? "",
        );
      }
    });
  }, []);

  const handleSave = async () => {
    // In a real app, update profile in DB
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-2xl mx-auto w-full z-10 space-y-8 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">个人设置</h1>
        </div>

        {/* Profile */}
        <GlassCard className="p-6 space-y-6" hover={false}>
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">个人资料</h2>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="text-xl bg-gradient-to-br from-primary to-secondary text-white">
                {displayName
                  ? displayName.slice(0, 2).toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">
                更换头像
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                建议正方形图片，PNG/JPG
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              value={email}
              disabled
              className="bg-white/5 opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              邮箱地址不可修改
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">显示名称</Label>
            <Input
              id="displayName"
              placeholder="你的显示名称"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">个人简介</Label>
            <Textarea
              id="bio"
              placeholder="介绍一下你自己..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">网站</Label>
            <Input
              id="website"
              placeholder="https://..."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saved}
            className="bg-gradient-to-r from-primary to-secondary gap-1.5"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                已保存
              </>
            ) : (
              "保存设置"
            )}
          </Button>
        </GlassCard>

        {/* Preferences */}
        <GlassCard className="p-6 space-y-4" hover={false}>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">通知偏好</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            邮件通知设置将在 Supabase 配置后可用
          </p>
        </GlassCard>

        {/* Security */}
        <GlassCard className="p-6 space-y-4" hover={false}>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">安全</h2>
          </div>
          <Button variant="outline" size="sm">
            修改密码
          </Button>
        </GlassCard>
      </main>
    </div>
  );
}
