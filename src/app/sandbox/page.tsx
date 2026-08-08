"use client";

import { useState, useCallback } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ParticlesBackground } from "@/components/shared/particles-background";
import { ChatPanel } from "@/components/sandbox/chat-panel";
import { CodeEditor } from "@/components/sandbox/code-editor";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/use-chat";
import {
  Code2,
  Play,
  Loader2,
  Check,
  AlertCircle,
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

export default function SandboxPage() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [renderStatus, setRenderStatus] = useState<
    "idle" | "rendering" | "done" | "error"
  >("idle");
  const [renderError, setRenderError] = useState("");

  const handleCodeExtracted = useCallback((newCode: string) => {
    setCode(newCode);
  }, []);

  const { messages, isLoading, sendMessage, cancelSend, clearMessages } =
    useChat({ onCodeExtracted: handleCodeExtracted });

  const handleRender = async () => {
    setRenderStatus("rendering");
    setRenderError("");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, quality: "-ql", format: "mp4" }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setRenderError(data.error ?? "渲染失败");
        setRenderStatus("error");
      } else {
        setRenderStatus("done");
      }
    } catch {
      setRenderError(
        "无法连接到本地渲染器。请确保 Tauri 渲染器正在运行 (localhost:9876)",
      );
      setRenderStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative">
      <ParticlesBackground />
      <AppHeader />
      <main className="flex-1 flex pt-16 z-10">
        {/* Left: Chat Panel */}
        <aside className="w-[380px] shrink-0 border-r border-border/50 h-[calc(100vh-4rem)]">
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSend={sendMessage}
            onCancel={cancelSend}
            onClear={clearMessages}
            className="h-full"
          />
        </aside>

        {/* Right: Code Editor + Toolbar */}
        <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] min-w-0">
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
                className="text-xs text-red-400 flex items-center gap-1 max-w-[200px] truncate"
                title={renderError}
              >
                <AlertCircle className="w-3 h-3 shrink-0" />
                {renderError}
              </span>
            )}

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
            <Button
              size="sm"
              className="gap-1.5 bg-gradient-to-r from-primary to-secondary"
            >
              发布
            </Button>
          </div>

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              value={code}
              onChange={setCode}
              readOnly={false}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
