"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

function UpdatePasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [codeReady, setCodeReady] = useState(false);

  useEffect(() => {
    // Supabase redirects with `?code=...` — exchange the code for a session
    const code = searchParams.get("code");
    if (!code) {
      setError("无效的重置链接，请重新请求密码重置。");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase 未配置");
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeErr }) => {
      if (exchangeErr) {
        setError("重置链接已过期或无效，请重新请求密码重置。");
      } else {
        setCodeReady(true);
      }
    });
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase 未配置");
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <GlassCard className="w-full max-w-md p-8 space-y-6 text-center" hover={false}>
          <div className="w-16 h-16 rounded-full bg-[#25bea5]/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#25bea5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">密码已更新</h2>
            <p className="text-sm text-muted-foreground">你现在可以使用新密码登录。</p>
          </div>
          <Link href="/auth/login">
            <Button className="bg-[#cc785c] hover:bg-[#a9583e] text-white">前往登录</Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <GlassCard className="w-full max-w-md p-8 space-y-6" hover={false}>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">设置新密码</h1>
          <p className="text-muted-foreground">请输入新密码</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        {codeReady && !error && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">新密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-[#cc785c] hover:bg-[#a9583e] text-white"
              disabled={loading}
            >
              {loading ? "更新中..." : "更新密码"}
            </Button>
          </form>
        )}

        {!codeReady && !error && (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-center text-sm">
            <Link href="/auth/reset-password" className="text-primary hover:underline">
              重新请求密码重置
            </Link>
          </p>
        )}
      </GlassCard>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-6">
        <GlassCard className="w-full max-w-md p-8 text-center" hover={false}>
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </GlassCard>
      </div>
    }>
      <UpdatePasswordInner />
    </Suspense>
  );
}
