"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { X, Play, Wand2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "@/components/wiki/chat-panel";
import { CodeEditor } from "@/components/sandbox/code-editor";
import { PublishDialog } from "@/components/sandbox/publish-dialog";
import { useChat } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

interface MiniSandboxProps {
  open: boolean;
  initialPrompt: string;
  wikiTitle: string;
  wikiSlug: string;
  onClose: () => void;
}

type RenderStatus = "idle" | "rendering" | "done" | "error";

export function MiniSandbox({
  open,
  initialPrompt,
  wikiTitle,
  onClose,
}: MiniSandboxProps) {
  const [code, setCode] = useState(
    `from manim import *

class ${toClassName(wikiTitle)}(Scene):
    def construct(self):
        # 为 "${wikiTitle}" 创建动画：展示核心概念与可视化演示
        pass
`,
  );
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("idle");
  const [renderError, setRenderError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<import("@/lib/ai/prompts").CodeChange[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const {
    messages,
    isLoading: chatLoading,
    sendMessage,
    cancelSend,
    clearMessages,
  } = useChat({
    onCodeExtracted: (newCode: string) => setCode(newCode),
    onChangesApplied: (changes) => setPendingChanges(changes),
  });

  const resetAndClose = useCallback(() => {
    abortRef.current?.abort();
    setRenderStatus("idle");
    setRenderError("");
    setVideoUrl(null);
    setShowPublish(false);
    setPendingChanges(null);
    clearMessages();
    onClose();
  }, [clearMessages, onClose]);

  // Auto-send prompt on open
  useEffect(() => {
    if (!open || !initialPrompt) return;

    const timer = setTimeout(() => {
      sendMessage(initialPrompt, code, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [open, initialPrompt, code, sendMessage]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetAndClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, resetAndClose]);

  const handleRender = useCallback(async () => {
    if (renderStatus === "rendering") return;

    setRenderStatus("rendering");
    setRenderError("");
    setVideoUrl(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, quality: "-ql", format: "mp4" }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setRenderError(data.error ?? "渲染失败");
        setRenderStatus("error");
      } else {
        if (data.video_url) setVideoUrl(data.video_url);
        setRenderStatus("done");
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setRenderError(
        "无法连接到本地渲染器。请确保 Python 渲染器正在运行 (localhost:9876)",
      );
      setRenderStatus("error");
    }
  }, [code, renderStatus]);

  const handleAIFix = () => {
    if (!renderError) return;
    setRenderStatus("idle");
    sendMessage(renderError, code, true);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
          onClick={resetAndClose}
        />
      )}

      {/* Panel */}
      <div
        data-mini-sandbox
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[min(720px,100vw)]",
          "bg-[#faf9f5] border-l border-[#e6dfd8] shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="h-12 border-b border-[#e6dfd8] flex items-center gap-3 px-4 shrink-0">
          <Wand2 className="w-4 h-4 text-[#cc785c]" />
          <span className="font-medium text-sm text-[#141413]">动画工坊</span>
          <span className="text-xs text-[#6c6a64] px-2 py-0.5 rounded-full bg-[#e6dfd8]/50 truncate max-w-[200px]">
            {wikiTitle}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={resetAndClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Chat */}
        <div className="flex-1 min-h-0 border-b border-[#e6dfd8]">
          <ChatPanel
            messages={messages}
            isLoading={chatLoading}
            onSend={(content) => sendMessage(content, code, false)}
            onCancel={cancelSend}
            onClear={clearMessages}
            className="h-full"
          />
        </div>

        {/* Toolbar */}
        <div className="h-10 border-b border-[#e6dfd8] flex items-center gap-2 px-3 shrink-0 bg-[#f5f2ed]">
          <span className="text-xs text-[#6c6a64] font-mono">scene.py</span>
          <div className="flex-1" />

          {/* Render status */}
          {renderStatus === "rendering" && (
            <span className="text-xs text-[#e8a55a] animate-pulse">
              渲染中...
            </span>
          )}
          {renderStatus === "error" && (
            <span className="text-xs text-[#c64545] truncate max-w-[200px]">
              {renderError.slice(0, 60)}
            </span>
          )}
          {renderStatus === "done" && (
            <span className="text-xs text-[#5db8a6]">渲染完成</span>
          )}

          {/* AI Fix button */}
          {renderStatus === "error" && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-[#e6dfd8]"
              onClick={handleAIFix}
            >
              <Wand2 className="w-3 h-3" />
              AI 修复
            </Button>
          )}

          {/* Render button */}
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-[#cc785c] hover:bg-[#a9583e] text-white"
            onClick={handleRender}
            disabled={renderStatus === "rendering"}
          >
            <Play className="w-3 h-3" />
            {renderStatus === "rendering" ? "渲染中" : "渲染"}
          </Button>

          {/* Publish button */}
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            variant="outline"
            onClick={() => setShowPublish(true)}
            disabled={renderStatus !== "done"}
          >
            <Send className="w-3 h-3" />
            发布
          </Button>
        </div>

        {/* Code editor */}
        <div className="h-[260px] shrink-0 border-b border-[#e6dfd8]">
          <CodeEditor
            value={code}
            onChange={setCode}
            applyChanges={pendingChanges}
            onChangesDone={() => setPendingChanges(null)}
          />
        </div>

        {/* Video preview */}
        {videoUrl && renderStatus === "done" && (
          <div className="h-[200px] shrink-0 bg-black">
            <video
              src={videoUrl}
              controls
              autoPlay
              loop
              muted
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Publish dialog */}
        <PublishDialog
          open={showPublish}
          code={code}
          videoUrl={videoUrl}
          onClose={() => setShowPublish(false)}
        />
      </div>
    </>
  );
}

/** Convert a Chinese title into a Python-safe class name */
function toClassName(title: string): string {
  // Simple approach: use a generic name for non-ASCII titles
  if (/[^\x00-\x7F]/.test(title)) return "MyScene";
  return title.replace(/[^a-zA-Z0-9_]/g, "");
}
