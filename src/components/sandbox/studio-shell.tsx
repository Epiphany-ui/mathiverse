"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Braces, CircleStop, Clapperboard, ListTodo, LoaderCircle, Play, Send, Sparkles, Wrench } from "lucide-react";
import { isLocalRendererUrl } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { GenerationStatus } from "./generation-status";
import { getCanvasState } from "./studio-layout";
import { VersionStrip } from "./version-strip";
import type { useGenerationJob } from "./use-generation-job";
import styles from "./sandbox-studio.module.css";

type Controller = ReturnType<typeof useGenerationJob>;

/** Line-based prefix/suffix diff: returns the 1-based inclusive range in the
 *  NEW document that differs from the old one, or null when identical. */
function computeDiffRange(prev: string, next: string): { start: number; end: number } | null {
  if (prev === next) return null;
  const a = prev.split("\n");
  const b = next.split("\n");
  let prefix = 0;
  const maxPrefix = Math.min(a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  const maxSuffix = Math.min(a.length, b.length) - prefix;
  while (suffix < maxSuffix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  const start = prefix + 1;
  const end = b.length - suffix;
  if (end < start) return null;
  return { start, end };
}

export function StudioShell({ controller, initialPrompt, onOpenPublish }: { controller: Controller; initialPrompt: string; onOpenPublish: () => void }) {
  const { state } = controller;
  const [prompt, setPrompt] = useState(initialPrompt);
  const lastSyncedJobRef = useRef<string | null>(null);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  // The prompt that produced the current job — when the job was cancelled we
  // show a hint that the description is "spent" but re-submittable.
  const [lastSubmitted, setLastSubmitted] = useState<string | null>(initialPrompt || null);
  // Diagnostics → editor highlight, and version comparison → diff tint.
  const [diagLine, setDiagLine] = useState<number | null>(null);
  const [diagNonce, setDiagNonce] = useState(0);
  const [rollbackDiff, setRollbackDiff] = useState<{ start: number; end: number; nonce: number; versionId: string } | null>(null);
  const submitPrompt = (text: string) => {
    const queued = controller.submitPrompt(text);
    if (queued) {
      // Queued for later — clear the field so the user can write the NEXT
      // idea while the current job is still running.
      setPrompt("");
    } else {
      setLastSubmitted(text);
    }
    // On narrow layouts the task panel covers the screen — jump to the
    // canvas so the user immediately sees the job start.
    controller.selectMobilePanel("canvas");
  };

  // Keep the prompt as a draft too, and focus the input on desktop.
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!prompt) return;
    const id = setTimeout(() => {
      try { localStorage.setItem("sandbox_draft_prompt", prompt); } catch {}
    }, 800);
    return () => clearTimeout(id);
  }, [prompt]);
  useEffect(() => {
    if (window.innerWidth >= 900) promptInputRef.current?.focus();
  }, []);
  // When auto-recovery restores a job, sync its prompt into the textarea so
  // the user sees their original prompt after navigating back.  Sync at most
  // once per job id — otherwise a queued idea's cleared textarea would get
  // re-filled by the RUNNING job's prompt.
  useEffect(() => {
    const snapshotPrompt = state.snapshot?.prompt;
    const jobId = state.snapshot?.id ?? null;
    if (initialPrompt) {
      lastSyncedJobRef.current = jobId;
      return;
    }
    if (snapshotPrompt && lastSyncedJobRef.current !== jobId) {
      lastSyncedJobRef.current = jobId;
      setPrompt(snapshotPrompt);
    }
  }, [state.snapshot?.prompt, state.snapshot?.id, initialPrompt]);
  const working = !state.isTakingOver && (state.snapshot?.status === "queued" || state.snapshot?.status === "running");
  // Submitting while a job is running QUEUES the idea — the submit button
  // therefore stays enabled and relabels itself.
  const submitLabel = working ? "加入队列" : "开始生成";

  // Stale diff marks disappear once the selected version moves elsewhere.
  // Deferred to a microtask so the effect itself stays side-effect-free for
  // the render that just committed.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (rollbackDiff && rollbackDiff.versionId !== state.selectedVersionId) {
        setRollbackDiff(null);
      }
      if (diagLine !== null && state.selectedVersionId !== null) setDiagLine(null);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedVersionId]);

  // Global sandbox shortcuts: Ctrl/Cmd+S 保存版本, Ctrl/Cmd+R 快速渲染。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void controller.saveManualVersion();
      } else if (key === "r") {
        event.preventDefault();
        if (!working) void controller.renderManually();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controller, working]);
  const rawVideo = state.snapshot?.render?.url;
  const mediaError = Boolean(rawVideo && failedVideo === rawVideo);
  // Takeover freezes the generation pipeline but preserves the last render
  // so the user doesn't lose their video while editing.
  const canvasState = state.isTakingOver
    ? (state.snapshot?.render ? "preview" : "idle")
    : (mediaError ? "error" : getCanvasState(state.snapshot));
  const video = rawVideo && isLocalRendererUrl(rawVideo) ? `/api/video-proxy?url=${encodeURIComponent(rawVideo)}` : rawVideo;
  const phaseIndex = ["planning", "retrieving", "generating", "validating", "rendering"].indexOf(state.snapshot?.phase ?? "");
  const jobCompleted = state.snapshot?.status === "completed";

  return <main className={`${styles.studio} studio`} data-active-panel={state.activeMobilePanel} data-studio-motion-layer="shell">
    <section className="taskRail" aria-label="创作任务" data-studio-motion-layer="task">
      <span className="railIndex">PROOF / 01</span><h1>构造你的数学场景</h1><GenerationStatus state={state} />
      {controller.queuedPrompts.length > 0 && (
        <p className="promptHint" role="status">
          已排队 {controller.queuedPrompts.length} 个想法，当前任务结束后自动开始 ·
          <button type="button" className="queueClear" onClick={controller.clearQueue}>清空队列</button>
        </p>
      )}
      <form className="promptForm" onSubmit={(event) => { event.preventDefault(); if (prompt.trim()) submitPrompt(prompt.trim()); }}>
        <label htmlFor="studio-prompt">想看到什么？</label>
        <textarea
          ref={promptInputRef}
          id="studio-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd + Enter submits like the chat editors people expect.
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              if (prompt.trim()) submitPrompt(prompt.trim());
            }
          }}
          placeholder="例如：让单位圆展开成正弦曲线，并标注角度关系（Ctrl+Enter 提交）"
          rows={5}
        />
        <button className="primaryAction" type="submit" disabled={!prompt.trim()} title={working ? "当前任务进行中，提交后加入队列" : prompt.trim() ? "开始生成" : "先描述你想看到什么"}><Send />{submitLabel}</button>
        {state.snapshot?.status === "cancelled" && lastSubmitted && (
          <p className="promptHint" role="status">上次任务已停止，描述已保留 —— 修改后可直接重新提交，或点「快速渲染」继续用当前代码。</p>
        )}
      </form>
      <ol className="proofTrack" aria-label="生成阶段">{["镜头规划", "数学检索", "场景生成", "安全验证", "动画渲染"].map((label, index) => <li key={label} data-active={working && index <= Math.max(0, phaseIndex)} data-done={jobCompleted || undefined}><span>{String(index + 1).padStart(2, "0")}</span>{label}</li>)}</ol>
      <div className="railActions">{working ? <><button type="button" onClick={() => void controller.cancel()}><CircleStop />停止</button><button type="button" onClick={() => void controller.takeOver()}><Sparkles />接管编辑</button></> : <><button type="button" onClick={() => void controller.renderManually()} title="渲染编辑器中的当前代码"><Play />快速渲染</button><button type="button" onClick={() => void controller.repairManually()} title="让 AI 修复并重新渲染当前代码"><Wrench />自动修复</button><button type="button" onClick={() => void controller.renderHighQuality()} title="用更高画质渲染当前代码"><Sparkles />高清渲染</button>{state.snapshot?.status === "failed" && <button type="button" onClick={() => void controller.retry()}>重试</button>}</>}<button type="button" onClick={onOpenPublish} disabled={!state.hasAuthoritativeCode && !state.snapshot?.render} title={state.hasAuthoritativeCode || state.snapshot?.render ? "发布到社区" : "还没有可发布的代码或渲染结果"}>发布作品</button></div>
      {state.error && <p className="railError" role="alert">{state.error}</p>}
    </section>
    <div className={styles.canvasColumn}>
      <section className="canvas" aria-label="动画画布" data-studio-motion-layer="canvas" data-canvas-state={canvasState}>
        <div className="canvasMeta"><span>CANVAS / 02</span><span>{state.snapshot?.render?.quality ?? "实时预览"}</span></div>
        <div className="canvasStage">
          {canvasState === "idle" && <div className="emptyCanvas"><Clapperboard /><strong>舞台已就绪</strong><p>提交任务后，规划、代码和渲染结果会在这里连续更新。</p></div>}
          {canvasState === "working" && <div className="workingCanvas"><LoaderCircle /><strong>证明正在展开</strong><p>可以离开页面；任务会在后台继续，回来后自动恢复。</p></div>}
          {canvasState === "preview" && video && <video key={video} src={video} controls playsInline onError={() => setFailedVideo(rawVideo ?? null)}>浏览器无法播放此视频。</video>}
          {canvasState === "error" && <div className="errorCanvas"><AlertTriangle /><strong>预览尚未生成</strong><p>{mediaError ? "视频加载失败，请重新渲染。" : state.snapshot?.failureReason ?? "检查代码后重试或使用自动修复。"}</p>{(state.snapshot?.validation?.issues?.length ?? 0) > 0 && (
            <details className="diagList">
              <summary>诊断详情（{state.snapshot?.validation?.issues?.length} 条）</summary>
              <ul>
                {state.snapshot?.validation?.issues?.map((issue, index) => (
                  <li
                    key={index}
                    role={issue.line ? "button" : undefined}
                    tabIndex={issue.line ? 0 : undefined}
                    title={issue.line ? "点击在编辑器中定位到这一行" : undefined}
                    onClick={issue.line ? () => { setDiagLine(issue.line ?? null); setDiagNonce((n) => n + 1); } : undefined}
                    onKeyDown={issue.line ? (event) => { if (event.key === "Enter") { setDiagLine(issue.line ?? null); setDiagNonce((n) => n + 1); } } : undefined}
                  >
                    <code>{issue.code}</code>
                    {issue.line ? <span>第 {issue.line} 行</span> : null}
                    <em>{issue.message}</em>
                  </li>
                ))}
              </ul>
            </details>
          )}<button type="button" onClick={() => {
            // A completed job whose video 404s must be re-rendered, not
            // "retried" — retry only exists for failed jobs (409 otherwise).
            if (state.snapshot?.status === "completed") void controller.renderManually();
            else void controller.retry();
          }}>重新尝试</button></div>}
        </div>
      </section>
      <VersionStrip versions={state.snapshot?.versions ?? []} selectedId={state.selectedVersionId} onSelect={(v) => {
        // Compare before rolling back: tint the block that differs.
        const diff = computeDiffRange(state.editorCode, v.code);
        setRollbackDiff(diff ? { ...diff, nonce: Date.now(), versionId: v.id } : null);
        void controller.rollback(v.id);
      }} />
    </div>
    <section className={styles.codePanel} data-studio-motion-layer="code" aria-label="Manim 代码">
      <div className={styles.codeHead}><span>CODE / 03</span><b>scene.py</b><button type="button" onClick={() => void controller.saveManualVersion()} title="Ctrl/Cmd+S">保存版本</button></div>
      <div className={styles.editor}><CodeEditor
        value={state.editorCode}
        onChange={controller.setEditorCode}
        versionId={state.selectedVersionId}
        externalUpdateMode={rollbackDiff?.versionId === state.selectedVersionId ? "immediate" : "paint"}
        errorLine={diagLine}
        errorLineNonce={diagNonce}
        diffRange={rollbackDiff}
      /></div>
    </section>
    <nav className={styles.mobileTabs} aria-label="工作区面板">{([["task", ListTodo, "任务"], ["canvas", Clapperboard, "画布"], ["code", Braces, "代码"]] as const).map(([panel, Icon, label]) => <button key={panel} type="button" aria-current={state.activeMobilePanel === panel ? "page" : undefined} onClick={() => controller.selectMobilePanel(panel)}><Icon />{label}</button>)}</nav>
  </main>;
}
