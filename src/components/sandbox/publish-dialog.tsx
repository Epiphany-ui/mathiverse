"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";

interface PublishDialogProps {
  open: boolean;
  code: string;
  videoUrl: string | null;
  posterUrl?: string | null;
  forkedFrom?: string | null;
  onClose: () => void;
}

export function PublishDialog({
  open,
  code,
  videoUrl,
  posterUrl,
  forkedFrom,
  onClose,
}: PublishDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [generatingMeta, setGeneratingMeta] = useState(false);
  const [error, setError] = useState("");
  const [publishedId, setPublishedId] = useState<string | null>(null);

  // Auto-generate metadata with AI — once per dialog opening.  Regenerating
  // on every code change while the dialog is open would overwrite fields the
  // user is editing, so the latest code is read via ref at open time.
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setGeneratingMeta(true);
      setError("");
    });

    const latestCode = codeRef.current;
    const generate = async () => {
      try {
        const { generateMetadata } = await import("@/lib/ai/prompts");
        const meta = await generateMetadata("", latestCode);

        if (!cancelled) {
          setTitle(meta.title);
          setDescription(meta.description);
          setTags(meta.tags.join(", "));
        }
      } catch {
        // Graceful fallback — user fills manually
        if (!cancelled) {
          // Extract class name as default title
          const classMatch = latestCode.match(/class\s+(\w+)\s*\(/);
          if (classMatch) {
            setTitle(classMatch[1]);
          }
        }
      } finally {
        if (!cancelled) setGeneratingMeta(false);
      }
    };

    generate();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handlePublish = async () => {
    if (!title.trim()) {
      setError("请输入标题");
      return;
    }
    setPublishing(true);
    setError("");

    try {
      const res = await fetch("/api/visualizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          tags: tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          sourceCode: code,
          videoUrl: videoUrl,
          posterUrl: posterUrl ?? null,
          forkedFrom: forkedFrom ?? null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "发布失败");
      }

      // Stay in the studio — offer both "view" and "keep editing" instead of
      // yanking the user to the detail page.
      setPublishedId(data.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "发布失败");
      setPublishing(false);
    }
  };

  if (!open) return null;

  // Published successfully — offer both destinations.
  if (publishedId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-background border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-green-500" />
          </div>
          <h2 className="text-lg font-semibold">发布成功！</h2>
          <p className="text-sm text-muted-foreground">
            作品已进入社区画廊，其他用户可以浏览、点赞和 Fork 它。
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href={`/v/${publishedId}`} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#cc785c] hover:bg-[#a9583e] text-white text-sm">
              查看作品
            </Link>
            <button
              type="button"
              onClick={() => {
                setPublishedId(null);
                setPublishing(false);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-border text-sm hover:bg-white/5"
            >
              回到沙箱继续编辑
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">发布可视化作品</h2>
          {generatingMeta && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
              <Sparkles className="w-3 h-3 text-purple-400" />
              AI 生成元数据中...
            </span>
          )}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              标题 <span className="text-red-400">*</span>
              {generatingMeta && (
                <Loader2 className="w-3 h-3 animate-spin inline ml-1 text-muted-foreground" />
              )}
            </label>
            <input
              type="text"
              className="w-full bg-white/5 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="给你的作品起个名字..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">描述</label>
            <textarea
              className="w-full bg-white/5 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none min-h-[80px]"
              placeholder="简单描述你的可视化展示了什么数学概念..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              标签（用逗号分隔）
            </label>
            <input
              type="text"
              className="w-full bg-white/5 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="例如: 微积分, 导数, 极限"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {/* Preview indicator */}
          {videoUrl && (
            <div className="text-xs text-green-400 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              视频已就绪 — 发布后可在作品详情页观看
            </div>
          )}
          {!videoUrl && (
            <div className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              未检测到渲染视频。将仅发布源代码。
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={publishing}
          >
            取消
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
    </div>
  );
}
