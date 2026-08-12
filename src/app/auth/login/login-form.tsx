"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Suspense } from "react";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Display error params passed from middleware or OAuth callback
  const serverError = searchParams.get("error");
  const serverErrorText =
    serverError === "banned"
      ? "你的账号已被封禁。如有疑问请联系管理员。"
      : serverError === "auth_callback_error"
        ? "第三方登录失败，请重试或使用邮箱密码登录。"
        : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase 未配置，请在 .env.local 中设置 Supabase 密钥");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else {
      const rawRedirect = searchParams.get("redirect");
      // Only allow same-origin relative paths — block protocol-absolute URLs
      const safeRedirect =
        rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
          ? rawRedirect
          : "/";
      router.push(safeRedirect);
      router.refresh();
    }
  };

  return (
    <GlassCard className="w-full max-w-md p-8 space-y-6" hover={false}>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">欢迎回来</h1>
        <p className="text-muted-foreground">登录你的 Mathiverse 账户</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}
      {serverErrorText && !error && (
        <div className="p-3 rounded-lg bg-[#e8a55a]/10 border border-[#e8a55a]/20 text-sm text-[#c7852a]">
          {serverErrorText}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-[#cc785c] hover:bg-[#a9583e] text-white"
          disabled={loading}
        >
          {loading ? "登录中..." : "登录"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">或</span>
        <Separator className="flex-1" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2 border-[#e6dfd8]"
        onClick={async () => {
          const supabase = createClient();
          if (!supabase) return;
          const { data } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
              redirectTo: `${location.origin}/auth/callback`,
            },
          });
          if (data.url) location.href = data.url;
        }}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        使用 GitHub 登录
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/auth/reset-password" className="text-primary hover:underline">
          忘记密码？
        </Link>
      </p>
      <p className="text-center text-sm text-muted-foreground">
        还没有账户？{" "}
        <Link href="/auth/register" className="text-primary hover:underline">
          注册
        </Link>
      </p>
    </GlassCard>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={
      <GlassCard className="w-full max-w-md p-8 text-center" hover={false}>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </GlassCard>
    }>
      <LoginFormInner />
    </Suspense>
  );
}
