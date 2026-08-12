"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (username.length < 3) {
      setError("用户名至少 3 个字符");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase 未配置，请在 .env.local 中设置 Supabase 密钥");
      setLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, display_name: username },
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // If email confirmation is required, show feedback instead of redirecting
      setLoading(false);
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <GlassCard className="w-full max-w-md p-8 space-y-6 text-center" hover={false}>
        <div className="w-16 h-16 rounded-full bg-[#25bea5]/10 flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-[#25bea5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">验证你的邮箱</h2>
          <p className="text-sm text-muted-foreground">
            我们已向 <span className="font-medium text-foreground">{email}</span> 发送了一封验证邮件。
            请点击邮件中的链接完成注册。
          </p>
          <p className="text-xs text-muted-foreground/60">未收到邮件？请检查垃圾邮件文件夹。</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="w-full max-w-md p-8 space-y-6" hover={false}>
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">创建账户</h1>
        <p className="text-muted-foreground">加入 Mathiverse 社区</p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">用户名</Label>
          <Input
            id="username"
            placeholder="your_username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </div>
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
            minLength={6}
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-[#cc785c] hover:bg-[#a9583e] text-white"
          disabled={loading}
        >
          {loading ? "注册中..." : "注册"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        已有账户？{" "}
        <Link href="/auth/login" className="text-primary hover:underline">
          登录
        </Link>
      </p>
    </GlassCard>
  );
}
