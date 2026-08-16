"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/content/markdown-renderer";
import { createClient } from "@/lib/supabase/client";
import {
  FileText,
  Eye,
  EyeOff,
  Send,
  Loader2,
  AlertCircle,
  Tag,
} from "lucide-react";

export default function CreateArticlePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [bodyMd, setBodyMd] = useState("");
  const [tags, setTags] = useState("");
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const handlePublish = async () => {
    if (!title.trim()) {
      setError("请输入文章标题");
      return;
    }
    if (!bodyMd.trim()) {
      setError("请输入文章内容");
      return;
    }
    if (publishing) return; // prevent double-click

    const supabase = createClient();
    if (!supabase) {
      setError("Supabase 未配置");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth/login?redirect=/create`);
      return;
    }

    setPublishing(true);
    setError("");

    const cleanTags = tags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), bodyMd, tags: cleanTags }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "发布失败");
        return;
      }

      const { id } = await res.json();
      router.push(`/a/${id}`);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 pt-24 px-6 max-w-4xl mx-auto w-full z-10 space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">创作文章</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPreview(!preview)}
            >
              {preview ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {preview ? "编辑" : "预览"}
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {publishing ? "发布中..." : "发布"}
            </Button>
          </div>
        </div>

        {/* Title */}
        <GlassCard className="p-4" hover={false}>
          <input
            type="text"
            className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/50"
            placeholder="文章标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </GlassCard>

        {/* Content: Editor or Preview */}
        {preview ? (
          <GlassCard className="p-6 min-h-[400px]" hover={false}>
            {bodyMd ? (
              <MarkdownRenderer content={bodyMd} />
            ) : (
              <p className="text-muted-foreground text-center py-20">
                暂无内容，切换到编辑模式开始写作
              </p>
            )}
          </GlassCard>
        ) : (
          <GlassCard className="p-4 min-h-[400px]" hover={false}>
            <textarea
              className="w-full h-full min-h-[400px] bg-transparent resize-none outline-none text-sm leading-relaxed font-mono placeholder:text-muted-foreground/50"
              placeholder="使用 Markdown 书写你的文章...

## 二级标题

正文内容支持 **粗体**、*斜体*、`代码` 等格式。

- 列表项
- 列表项

> 引用文字

数学公式 (KaTeX): $E = mc^2$

```python
# 代码块
print('hello')
```"
              value={bodyMd}
              onChange={(e) => setBodyMd(e.target.value)}
            />
          </GlassCard>
        )}

        {/* Tags */}
        <GlassCard className="p-4 space-y-3" hover={false}>
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">标签</Label>
          </div>
          <Input
            placeholder="用逗号分隔标签，例如：线性代数, 矩阵, 教程"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="bg-white/5"
          />
        </GlassCard>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
