"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, User, Bell, Shield, Check, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isOAuthUser, setIsOAuthUser] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Avatar upload
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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

      // Check if user is OAuth-only (no email/password provider)
      const providers = user.app_metadata?.providers ?? [];
      setIsOAuthUser(providers.length > 0 && !providers.includes("email"));

      // Load profile from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, bio, website, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setBio(profile.bio ?? "");
        setWebsite(profile.website ?? "");
        setAvatarUrl(profile.avatar_url ?? null);
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
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="头像" />
              ) : null}
              <AvatarFallback className="text-xl bg-[#cc785c] text-white">
                {displayName
                  ? displayName.slice(0, 2).toUpperCase()
                  : "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Client-side size check
                  if (file.size > 5 * 1024 * 1024) {
                    setError("图片大小不能超过 5 MB");
                    return;
                  }

                  setUploading(true);
                  setError("");
                  try {
                    // Optimistic preview
                    const previewUrl = URL.createObjectURL(file);
                    setAvatarUrl(previewUrl);

                    const form = new FormData();
                    form.append("file", file);
                    const res = await fetch("/api/profile/avatar", {
                      method: "POST",
                      body: form,
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setAvatarUrl(data.url);
                      // Refresh session so header picks up the new avatar_url in the JWT
                      const supabase = createClient();
                      if (supabase) {
                        await supabase.auth.refreshSession();
                      }
                    } else {
                      setError(data.error ?? "上传失败");
                      // Revert preview — reload from server
                      const supabase = createClient();
                      if (supabase) {
                        const { data: { user: u } } = await supabase.auth.getUser();
                        if (u) {
                          const { data: p } = await supabase
                            .from("profiles")
                            .select("avatar_url")
                            .eq("id", u.id)
                            .single();
                          setAvatarUrl(p?.avatar_url ?? null);
                        }
                      }
                    }
                  } catch {
                    setError("上传失败，请重试");
                  } finally {
                    setUploading(false);
                    // Clear the file input so the same file can be re-selected
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }
                  }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    上传中...
                  </>
                ) : (
                  "更换头像"
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                支持 PNG、JPEG、WebP、GIF，≤5MB
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
            实时通知已自动开启。你可以在顶部导航栏的铃铛图标中查看所有通知。
          </p>
        </GlassCard>

        {/* Security */}
        <GlassCard className="p-6 space-y-4" hover={false}>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">安全</h2>
          </div>

          {isOAuthUser ? (
            <p className="text-sm text-muted-foreground">
              你通过第三方账号登录，无需密码。如需设置密码，请使用{" "}
              <Link href="/auth/reset-password" className="text-primary hover:underline">
                忘记密码
              </Link>{" "}
              功能。
            </p>
          ) : (
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setPasswordError("");
                setPasswordSuccess(false);

                if (newPassword.length < 6) {
                  setPasswordError("新密码至少需要 6 个字符");
                  return;
                }
                if (newPassword !== confirmPassword) {
                  setPasswordError("两次输入的新密码不一致");
                  return;
                }

                setPasswordBusy(true);
                try {
                  const supabase = createClient();
                  if (!supabase) {
                    setPasswordError("Supabase 未配置");
                    setPasswordBusy(false);
                    return;
                  }

                  // Verify current password first
                  const { error: signInErr } = await supabase.auth.signInWithPassword({
                    email,
                    password: currentPassword,
                  });
                  if (signInErr) {
                    setPasswordError("当前密码不正确");
                    setPasswordBusy(false);
                    return;
                  }

                  const { error: updateErr } = await supabase.auth.updateUser({
                    password: newPassword,
                  });
                  if (updateErr) {
                    setPasswordError(updateErr.message);
                  } else {
                    setPasswordSuccess(true);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }
                } catch {
                  setPasswordError("修改失败，请重试");
                } finally {
                  setPasswordBusy(false);
                }
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {passwordError}
                </p>
              )}
              {passwordSuccess && (
                <p className="text-sm text-green-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  密码已更新
                </p>
              )}

              <Button
                type="submit"
                disabled={passwordBusy}
                className="bg-[#cc785c] hover:bg-[#a9583e] text-white gap-1.5"
              >
                {passwordBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {passwordBusy ? "修改中..." : "修改密码"}
              </Button>
            </form>
          )}
        </GlassCard>

        {/* Danger zone */}
        <GlassCard className="p-6 space-y-4 border-destructive/20" hover={false}>
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h2 className="font-semibold text-destructive">危险区域</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            删除账号后，你的所有数据将被永久删除且无法恢复。
          </p>
          {!deleteConfirm ? (
            <Button
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={() => setDeleteConfirm(true)}
            >
              删除我的账号
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                className="bg-destructive hover:bg-destructive/90 text-white"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  fetch("/api/account", { method: "DELETE" })
                    .then((res) => {
                      if (res.ok) window.location.href = "/";
                      else return res.json().then((d: any) => { throw new Error(d.error ?? "删除失败"); });
                    })
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : "网络错误，请重试");
                      setDeleteConfirm(false);
                    })
                    .finally(() => setDeleting(false));
                }}
              >
                {deleting ? "删除中..." : "确认删除"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => setDeleteConfirm(false)}
              >
                取消
              </Button>
            </div>
          )}
        </GlassCard>
      </main>
    </div>
  );
}
