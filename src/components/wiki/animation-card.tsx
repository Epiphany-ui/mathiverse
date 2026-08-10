"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Square, ExternalLink, RefreshCw } from "lucide-react";

/* ─── Progress Stages ─── */

type CardStage =
  | "understanding"  // (._.) 正在理解概念...
  | "designing"      // (o_o) 构思场景结构中...
  | "writing"        // (>_<) 正在写 Manim 代码...
  | "launching"      // (・_・) 启动渲染引擎...
  | "rendering"      // (⌐■_■) 渲染动画中...
  | "done"           // (◕‿◕) 完成啦！
  | "failed";        // (╥﹏╥) 生成失败

type CardState = "generating" | "done" | "failed";

const STAGES: { key: CardStage; kaomoji: string; label: string; pct: number }[] = [
  { key: "understanding", kaomoji: "(._.)", label: "正在理解概念...", pct: 10 },
  { key: "designing", kaomoji: "(o_o)", label: "构思场景结构中...", pct: 25 },
  { key: "writing", kaomoji: "(>_<)", label: "正在写 Manim 代码...", pct: 50 },
  { key: "launching", kaomoji: "(・_・)", label: "启动渲染引擎...", pct: 70 },
  { key: "rendering", kaomoji: "(⌐■_■)", label: "渲染动画中...", pct: 85 },
];

interface AnimationCardProps {
  prompt: string;
  wikiTitle: string;
  wikiSlug: string;
  onRemove?: () => void;
}

export function AnimationCard({ prompt, wikiTitle, wikiSlug, onRemove }: AnimationCardProps) {
  const [cardState, setCardState] = useState<CardState>("generating");
  const [stage, setStage] = useState<CardStage>("understanding");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [stageIndex, setStageIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cancelledRef = useRef(false);

  const advanceStage = useCallback((next: CardStage) => {
    setStage(next);
    const idx = STAGES.findIndex((s) => s.key === next);
    if (idx >= 0) setStageIndex(idx);
  }, []);

  useEffect(() => {
    if (cardState !== "generating") return;

    const run = async () => {
      // Reset cancellation flag on each effect run (React Strict Mode compat)
      cancelledRef.current = false;
      try {
        // Stage 1-3: AI code generation
        advanceStage("understanding");
        await sleep(600);

        if (cancelledRef.current) return;
        advanceStage("designing");
        await sleep(400);

        if (cancelledRef.current) return;
        advanceStage("writing");

        const chatRes = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            // Non-empty currentCode triggers edit mode → reasoning_effort: "high" (not max)
            // Avoids 60-90s thinking phase on wiki inline cards
            currentCode: `from manim import *\n\nclass MyScene(Scene):\n    def construct(self):\n        pass\n`,
          }),
        });

        if (!chatRes.ok) throw new Error("AI 生成失败");

        // Read SSE stream
        const reader = chatRes.body!.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";

        while (true) {
          if (cancelledRef.current) return;
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const { content: delta } = JSON.parse(line.slice(6));
                if (delta) fullContent += delta;
              } catch { /* skip */ }
            }
          }
        }

        // Extract code
        const { extractCode } = await import("@/lib/ai/prompts");
        const code = extractCode(fullContent);
        if (!code) throw new Error("未能提取有效的 Python 代码");
        setGeneratedCode(code);

        if (cancelledRef.current) return;

        // Stage 4: Launch render
        advanceStage("launching");
        await sleep(300);

        if (cancelledRef.current) return;

        // Stage 5: Rendering
        advanceStage("rendering");

        const renderRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, quality: "-ql", format: "mp4" }),
        });

        const renderData = await renderRes.json();
        if (!renderRes.ok || renderData.error) {
          throw new Error(renderData.error ?? "渲染失败");
        }

        if (cancelledRef.current) return;

        setVideoUrl(renderData.video_url);
        setCardState("done");
      } catch (err) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err.message : "未知错误");
        setCardState("failed");
      }
    };

    run();
    return () => { cancelledRef.current = true; };
  }, [retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    cancelledRef.current = true;
    onRemove?.();
  };

  // Auto-fix: send error + code to fix endpoint, then re-render
  const handleRetry = async () => {
    if (!generatedCode || !error) {
      // No code to fix — restart full pipeline
      setCardState("generating");
      setStage("understanding");
      setStageIndex(0);
      setError("");
      setVideoUrl(null);
      setRetryKey((k) => k + 1);
      return;
    }

    // Show fix-in-progress state
    setCardState("generating");
    setStage("writing");
    setStageIndex(2);
    setError("");

    try {
      const fixRes = await fetch("/api/chat/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: generatedCode, error }),
      });

      const fixData = await fixRes.json();
      if (!fixRes.ok) throw new Error(fixData.error ?? "修复失败");

      const fixedCode = fixData.mode === "diff"
        ? applyChanges(generatedCode, fixData.changes)
        : (fixData.code ?? generatedCode);

      setGeneratedCode(fixedCode);

      // Re-render with fixed code
      advanceStage("launching");
      await sleep(300);
      advanceStage("rendering");

      const renderRes = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: fixedCode, quality: "-ql", format: "mp4" }),
      });

      const renderData = await renderRes.json();
      if (!renderRes.ok || renderData.error) {
        throw new Error(renderData.error ?? "渲染失败");
      }

      setVideoUrl(renderData.video_url);
      setCardState("done");
    } catch (err2) {
      setError(err2 instanceof Error ? err2.message : "修复失败");
      setCardState("failed");
    }
  };

  // Store code to localStorage so sandbox can pick it up
  const goToSandbox = () => {
    if (generatedCode) {
      try { localStorage.setItem("sandbox_code", generatedCode); } catch {}
    }
    try { localStorage.setItem("sandbox_prompt", prompt); } catch {}
    window.open(`/sandbox?from=wiki`, "_blank");
  };

  const togglePause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPaused(false); }
    else { v.pause(); setIsPaused(true); }
  };

  const sandboxHref = `/sandbox?prompt=${encodeURIComponent(prompt)}`;

  const currentStage = STAGES[stageIndex] ?? STAGES[0];
  const progressPct = cardState === "done" ? 100
    : cardState === "failed" ? STAGES[STAGES.length - 1].pct + 5
    : currentStage.pct;

  return (
    <div className="my-6 rounded-xl border border-[#e6dfd8] bg-[#fdf8f5]/80 backdrop-blur-sm p-5 animate-in fade-in duration-300">
      {/* ── Generating State ── */}
      {cardState === "generating" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[#6c6a64]">
            <span className="text-base">{currentStage.kaomoji}</span>
            <span>{currentStage.label}</span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[#e6dfd8] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#cc785c] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 text-xs text-[#6c6a64] hover:text-[#c64545] transition-colors cursor-pointer"
          >
            <Square className="w-3 h-3" />
            取消
          </button>
        </div>
      )}

      {/* ── Done State ── */}
      {cardState === "done" && videoUrl && (
        <div className="space-y-3">
          <div
            className="relative rounded-lg overflow-hidden bg-black cursor-pointer"
            onClick={togglePause}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full max-h-[300px] object-contain"
            />
            {isPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="w-8 h-8 text-white" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 text-sm">
            <span className="text-[#5db8a6]">(◕‿◕) 完成啦！</span>
            <div className="flex-1" />
            <button
              onClick={togglePause}
              className="flex items-center gap-1 text-xs text-[#6c6a64] hover:text-[#141413] transition-colors cursor-pointer"
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              {isPaused ? "播放" : "暂停"}
            </button>
            <button
              onClick={goToSandbox}
              className="flex items-center gap-1 text-xs text-[#cc785c] hover:text-[#a9583e] transition-colors font-medium cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              在沙箱中编辑
            </button>
          </div>
        </div>
      )}

      {/* ── Failed State ── */}
      {cardState === "failed" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[#c64545]">
            <span className="text-base">(╥﹏╥)</span>
            <span>生成失败</span>
          </div>

          <div className="text-xs text-[#c64545]/80 font-mono bg-[#c64545]/5 rounded-lg p-3 max-h-[80px] overflow-auto">
            {error}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs text-[#cc785c] hover:text-[#a9583e] transition-colors font-medium cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              重试
            </button>
            <button
              onClick={goToSandbox}
              className="flex items-center gap-1.5 text-xs text-[#6c6a64] hover:text-[#141413] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              在沙箱中修复
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

/** Apply incremental diff changes to code. Simple line-based replacement. */
function applyChanges(code: string, changes: { startLine: number; endLine: number; newCode: string }[]): string {
  if (!changes?.length) return code;
  const lines = code.split("\n");
  // Apply in reverse order so line numbers stay valid
  const sorted = [...changes].sort((a, b) => b.startLine - a.startLine);
  for (const ch of sorted) {
    const start = Math.max(0, ch.startLine - 1);
    const end = Math.min(lines.length, ch.endLine);
    const before = lines.slice(0, start);
    const after = lines.slice(end);
    const insertLines = ch.newCode.split("\n");
    const newLines = [...before, ...insertLines, ...after];
    lines.length = 0;
    lines.push(...newLines);
  }
  return lines.join("\n");
}
