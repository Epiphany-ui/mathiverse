"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/update-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <GlassCard className="w-full max-w-md p-8 space-y-6 text-center" hover={false}>
          <div className="w-16 h-16 rounded-full bg-[#25bea5]/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#25bea5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">邮件已发送</h2>
            <p className="text-sm text-muted-foreground">
              如果 <span className="font-medium">{email}</span> 已注册，你将收到密码重置链接。
            </p>
            <p className="text-xs text-muted-foreground/60">未收到邮件？请检查垃圾邮件文件夹。</p>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" size="sm" className="gap-1.5">
              返回登录
            </Button>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <GlassCard className="w-full max-w-md p-8 space-y-6" hover={false}>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">重置密码</h1>
          <p className="text-muted-foreground">输入你的注册邮箱，我们将发送重置链接</p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
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
          <Button
            type="submit"
            className="w-full bg-[#cc785c] hover:bg-[#a9583e] text-white"
            disabled={loading}
          >
            {loading ? "发送中..." : "发送重置链接"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/auth/login" className="text-primary hover:underline">
            返回登录
          </Link>
        </p>
      </GlassCard>
    </div>
  );
}
