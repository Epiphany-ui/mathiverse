"use client";

import { useState } from "react";
import { AlertTriangle, Braces, CircleStop, Clapperboard, ListTodo, LoaderCircle, Play, Send, Sparkles, Wrench } from "lucide-react";
import { isLocalRendererUrl } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import { GenerationStatus } from "./generation-status";
import { getCanvasState } from "./studio-layout";
import { VersionStrip } from "./version-strip";
import type { useGenerationJob } from "./use-generation-job";
import styles from "./sandbox-studio.module.css";

type Controller = ReturnType<typeof useGenerationJob>;

export function StudioShell({ controller, initialPrompt, onOpenPublish }: { controller: Controller; initialPrompt: string; onOpenPublish: () => void }) {
  const { state } = controller;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [failedVideo, setFailedVideo] = useState<string | null>(null);
  const working = !state.isTakingOver && (state.snapshot?.status === "queued" || state.snapshot?.status === "running");
  const rawVideo = state.snapshot?.render?.url;
  const mediaError = Boolean(rawVideo && failedVideo === rawVideo);
  const canvasState = mediaError ? "error" : getCanvasState(state.snapshot);
  const video = rawVideo && isLocalRendererUrl(rawVideo) ? `/api/video-proxy?url=${encodeURIComponent(rawVideo)}` : rawVideo;
  const phaseIndex = ["planning", "retrieving", "generating", "validating", "rendering"].indexOf(state.snapshot?.phase ?? "");

  return <main className={`${styles.studio} studio`} data-active-panel={state.activeMobilePanel} data-studio-motion-layer="shell">
    <section className="taskRail" aria-label="创作任务" data-studio-motion-layer="task">
      <span className="railIndex">PROOF / 01</span><h1>构造你的数学场景</h1><GenerationStatus state={state} />
      <form className="promptForm" onSubmit={(event) => { event.preventDefault(); if (prompt.trim()) void controller.submitPrompt(prompt.trim()); }}>
        <label htmlFor="studio-prompt">想看到什么？</label>
        <textarea id="studio-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="例如：让单位圆展开成正弦曲线，并标注角度关系" rows={5} />
        <button className="primaryAction" type="submit" disabled={!prompt.trim() || working}><Send />开始生成</button>
      </form>
      <ol className="proofTrack" aria-label="生成阶段">{["镜头规划", "数学检索", "场景生成", "安全验证", "动画渲染"].map((label, index) => <li key={label} data-active={working && index <= Math.max(0, phaseIndex)}><span>{String(index + 1).padStart(2, "0")}</span>{label}</li>)}</ol>
      <div className="railActions">{working ? <><button type="button" onClick={() => void controller.cancel()}><CircleStop />停止</button><button type="button" onClick={() => void controller.takeOver()}><Sparkles />接管编辑</button></> : <><button type="button" onClick={() => void controller.renderManually()}><Play />快速渲染</button><button type="button" onClick={() => void controller.repairManually()}><Wrench />自动修复</button><button type="button" onClick={() => void controller.renderHighQuality()}><Sparkles />高清渲染</button>{state.snapshot?.status === "failed" && <button type="button" onClick={() => void controller.retry()}>重试</button>}</>}<button type="button" onClick={onOpenPublish} disabled={!state.snapshot?.render}>发布作品</button></div>
      {state.error && <p className="railError" role="alert">{state.error}</p>}
    </section>
    <div className={styles.canvasColumn}>
      <section className="canvas" aria-label="动画画布" data-studio-motion-layer="canvas" data-canvas-state={canvasState}>
        <div className="canvasMeta"><span>CANVAS / 02</span><span>{state.snapshot?.render?.quality ?? "实时预览"}</span></div>
        <div className="canvasStage">
          {canvasState === "idle" && <div className="emptyCanvas"><Clapperboard /><strong>舞台已就绪</strong><p>提交任务后，规划、代码和渲染结果会在这里连续更新。</p></div>}
          {canvasState === "working" && <div className="workingCanvas"><LoaderCircle /><strong>证明正在展开</strong><p>可以离开页面；任务会在后台继续，回来后自动恢复。</p></div>}
          {canvasState === "preview" && video && <video key={video} src={video} controls playsInline onError={() => setFailedVideo(rawVideo ?? null)}>浏览器无法播放此视频。</video>}
          {canvasState === "error" && <div className="errorCanvas"><AlertTriangle /><strong>预览尚未生成</strong><p>{mediaError ? "视频加载失败，请重新渲染。" : state.snapshot?.failureReason ?? "检查代码后重试或使用自动修复。"}</p><button type="button" onClick={() => void controller.retry()}>重新尝试</button></div>}
        </div>
      </section>
      <VersionStrip versions={state.snapshot?.versions ?? []} selectedId={state.selectedVersionId} onSelect={controller.selectVersion} />
    </div>
    <section className={styles.codePanel} data-studio-motion-layer="code" aria-label="Manim 代码">
      <div className={styles.codeHead}><span>CODE / 03</span><b>scene.py</b><button type="button" onClick={() => void controller.saveManualVersion()}>保存版本</button></div>
      <div className={styles.editor}><CodeEditor value={state.editorCode} onChange={controller.setEditorCode} externalUpdateMode="immediate" /></div>
    </section>
    <nav className={styles.mobileTabs} aria-label="工作区面板">{([["task", ListTodo, "任务"], ["canvas", Clapperboard, "画布"], ["code", Braces, "代码"]] as const).map(([panel, Icon, label]) => <button key={panel} type="button" aria-current={state.activeMobilePanel === panel ? "page" : undefined} onClick={() => controller.selectMobilePanel(panel)}><Icon />{label}</button>)}</nav>
  </main>;
}
