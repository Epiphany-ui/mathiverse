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
import { Settings, User, Bell, Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setEmail(user.email ?? "");

      // Load profile from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, bio, website")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
        setWebsite(profile.website ?? "");
      }

      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async () => {
    const supabase = createClient();
    if (!supabase) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    setError("");
    setSaved(false);

    // Update profiles table
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        bio,
        website,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      setError(profileError.message);
      setSaving(false);
      return;
    }

    // Also update auth metadata for header display
    await supabase.auth.updateUser({
      data: { display_name: displayName },
    });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col relative">
        <ParticlesBackground />
        <AppHeader />
        <main className="flex-1 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </main>
      </div>
    );
  }

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
              <AvatarFallback className="text-xl bg-[#cc785c] text-white">
                {displayName
                  ? displayName.slice(0, 2).toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm" disabled>
                更换头像
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                头像上传将在后续版本支持
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

          {error && (
            <p className="text-sm text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="bg-[#cc785c] hover:bg-[#a9583e] text-white gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : null}
            {saving ? "保存中..." : saved ? "已保存" : "保存设置"}
          </Button>
        </GlassCard>

        {/* Preferences */}
        <GlassCard className="p-6 space-y-4" hover={false}>
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">通知偏好</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            通知设置将在后续版本中提供
          </p>
        </GlassCard>

        {/* Security */}
        <GlassCard className="p-6 space-y-4" hover={false}>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">安全</h2>
          </div>
          <Button variant="outline" size="sm" disabled>
            修改密码
          </Button>
          <p className="text-xs text-muted-foreground">
            密码修改将在后续版本中提供
          </p>
        </GlassCard>
      </main>
    </div>
  );
}
