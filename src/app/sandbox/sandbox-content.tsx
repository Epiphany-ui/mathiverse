"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { ChatPanel } from "@/components/sandbox/chat-panel";
import { CodeEditor } from "@/components/sandbox/code-editor";
import { PublishDialog } from "@/components/sandbox/publish-dialog";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/use-chat";
import { createClient } from "@/lib/supabase/client";
import {
  Code2,
  Play,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  Video,
} from "lucide-react";

const DEFAULT_CODE = `from manim import *

class FirstScene(Scene):
    def construct(self):
        # AI 生成的代码将出现在这里
        # 在左侧对话框描述你想看的数学动画

        circle = Circle(radius=1, color=BLUE)
        square = Square(side_length=2, color=YELLOW)

        self.play(Create(circle))
        self.wait(0.5)
        self.play(Transform(circle, square))
        self.wait(1)
`;

interface SandboxContentProps {
  forkId: string | null;
  initialPrompt: string;
}

export function SandboxContent({
  forkId,
  initialPrompt,
}: SandboxContentProps) {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<
    "idle" | "rendering" | "done" | "error"
  >("idle");
  const [renderError, setRenderError] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<import("@/lib/ai/prompts").CodeChange[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load forked visualization source code
  useEffect(() => {
    if (!forkId) return;
    const loadFork = async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase
        .from("visualizations")
        .select("source_code, title")
        .eq("id", forkId)
        .single();
      if (data?.source_code) {
        setCode(data.source_code);
        setForkedFrom(forkId);
      }
    };
    loadFork();
  }, [forkId]);

  // Load code passed from wiki animation cards via localStorage (once)
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (forkId || initialPrompt) return; // Don't override fork or homepage prompt
    if (autoSentRef.current) return;
    try {
      const storedCode = localStorage.getItem("sandbox_code");
      const storedPrompt = localStorage.getItem("sandbox_prompt");
      if (storedCode) {
        setCode(storedCode);
        localStorage.removeItem("sandbox_code");
      }
      if (storedPrompt && storedCode) {
        localStorage.removeItem("sandbox_prompt");
        autoSentRef.current = true;
        // Delay to let ChatPanel mount and initialize
        const timer = setTimeout(() => {
          sendMessage(storedPrompt, storedCode, false);
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [forkId, initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeExtracted = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const { messages, isLoading, sendMessage, cancelSend, clearMessages } =
    useChat({
      onCodeExtracted: handleCodeExtracted,
      onChangesApplied: (changes) => setPendingChanges(changes),
    });

  // Wrap sendMessage to always pass current code
  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content, code);
    },
    [sendMessage, code],
  );

  // AI Fix: send render error to AI
  const handleAIFix = useCallback(() => {
    if (!renderError) return;
    sendMessage(renderError, code, true);
    setRenderStatus("idle");
    setRenderError("");
  }, [renderError, sendMessage, code]);

  const handleRender = async () => {
    setRenderStatus("rendering");
    setRenderError("");
    setVideoUrl(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, quality: "-ql", format: "mp4" }),
        signal: controller.signal,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        const errMsg = data.error ?? "渲染失败";
        setRenderError(errMsg);
        setRenderStatus("error");
      } else {
        // Store the video URL for display and publishing
        if (data.video_url) {
          setVideoUrl(data.video_url);
        }
        setRenderStatus("done");
      }
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "name" in err &&
        err.name === "AbortError"
      ) return;
      setRenderError(
        "无法连接到本地渲染器。请确保 Python 渲染器正在运行 (localhost:9876)",
      );
      setRenderStatus("error");
    }
  };

  const handlePublish = () => {
    setShowPublishDialog(true);
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 flex pt-16 z-10 min-h-0">
        {/* Left: Chat Panel */}
        <aside className="w-[380px] shrink-0 border-r border-border/50 h-[calc(100vh-4rem)]">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={handleSend}
            onCancel={cancelSend}
            onClear={clearMessages}
            initialPrompt={initialPrompt}
            className="h-full"
          />
        </aside>

        {/* Right: Code Editor + Toolbar + Video Preview */}
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] min-w-0 min-h-0">
          {/* Toolbar */}
          <div className="h-12 border-b border-border/50 flex items-center px-4 gap-3 shrink-0">
            <Code2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-mono">
              scene.py
            </span>
            <div className="flex-1" />

            {/* Render status */}
            {renderStatus === "rendering" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                渲染中...
              </span>
            )}
            {renderStatus === "done" && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                渲染完成
              </span>
            )}
            {renderStatus === "error" && (
              <span
                className="text-xs text-red-400 flex items-center gap-1 max-w-[300px]"
                title={renderError}
              >
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span className="truncate">{renderError}</span>
              </span>
            )}

            {/* AI Fix button (only when error) */}
            {renderStatus === "error" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-purple-400 border-purple-400/30 hover:bg-purple-400/10"
                onClick={handleAIFix}
                disabled={isLoading}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI 修复
              </Button>
            )}

            {/* Render button */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleRender}
              disabled={renderStatus === "rendering"}
            >
              {renderStatus === "rendering" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              渲染
            </Button>

            {/* Publish button */}
            <Button
              size="sm"
              className="gap-1.5 bg-[#cc785c] hover:bg-[#a9583e] text-white"
              onClick={handlePublish}
              disabled={renderStatus !== "done"}
              title={
                renderStatus !== "done"
                  ? "请先渲染成功后再发布"
                  : "发布到社区"
              }
            >
              发布
            </Button>
          </div>

          {/* Video Preview (shown after successful render) */}
          {videoUrl && renderStatus === "done" && (
            <div className="border-b border-border/30 bg-black/20">
              <div className="max-w-2xl mx-auto p-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <Video className="w-3.5 h-3.5" />
                  渲染预览
                </div>
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-md max-h-[200px] bg-black"
                  poster={undefined}
                >
                  你的浏览器不支持视频播放
                </video>
              </div>
            </div>
          )}

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              value={code}
              onChange={setCode}
              readOnly={false}
              applyChanges={pendingChanges}
              onChangesDone={() => setPendingChanges(null)}
            />
          </div>
        </div>
      </main>

      {/* Publish Dialog */}
      <PublishDialog
        open={showPublishDialog}
        code={code}
        videoUrl={videoUrl}
        forkedFrom={forkedFrom}
        onClose={() => setShowPublishDialog(false)}
      />
    </div>
  );
}
