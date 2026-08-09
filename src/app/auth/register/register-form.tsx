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
      router.push("/?registered=true");
    }
  };

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
