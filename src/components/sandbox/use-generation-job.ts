"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { GenerationEvent, GenerationOperation, GenerationVersion } from "@/lib/generation/types";
import { createGenerationJob, getGenerationJob, getActiveGenerationJob, GenerationClientError, patchGenerationJob } from "./client-api";
import {
  createStudioClientState,
  studioClientReducer,
  type MobileStudioPanel,
} from "./client-state";

type UseGenerationJobOptions = {
  initialPrompt: string;
  initialCode: string;
  hasAuthoritativeCode: boolean;
  initialJobId: string | null;
  skipAutoRecovery?: boolean;
};

const GENERATION_EVENT_TYPES: GenerationEvent["type"][] = [
  "job.accepted", "phase.changed", "plan.ready", "code.delta",
  "version.created", "validation.completed", "render.started",
  "render.completed", "render.failed", "repair.started",
  "job.completed", "job.failed", "job.cancelled",
];

export function useGenerationJob(options: UseGenerationJobOptions) {
  const [state, dispatch] = useReducer(
    studioClientReducer,
    options,
    createStudioClientState,
  );
  const sourceRef = useRef<EventSource | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Stable identity — effects in parent components depend on this callback,
  // and an inline arrow would re-run them on every render.
  const setEditorCode = useCallback((code: string) => {
    dispatch({ type: "editor.changed", code });
  }, []);

  // Idea queue: submitting while a job is running queues the prompt instead
  // of failing; the next prompt starts automatically when the job settles.
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);
  const queuedRef = useRef<string[]>([]);
  // Busy spans the WHOLE job lifecycle (submit → terminal), not just the POST
  // in flight — otherwise a submit racing the stateRef sync gets a 409
  // instead of being queued.
  const busyRef = useRef(false);

  const replaceJobInUrl = useCallback((jobId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("job", jobId);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const refreshSnapshot = useCallback(async (jobId: string) => {
    try {
      const snapshot = await getGenerationJob(jobId);
      dispatch({ type: "snapshot.received", jobId, snapshot });
      return snapshot;
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "无法恢复任务状态" });
      return null;
    }
  }, []);

  useEffect(() => {
    const jobId = state.activeJobId;
    sourceRef.current?.close();
    sourceRef.current = null;
    if (!jobId || state.isTakingOver) return;

    let cancelled = false;
    dispatch({ type: "connection.changed", connection: "connecting" });
    const source = new EventSource(`/api/generation/jobs/${encodeURIComponent(jobId)}/events`);
    sourceRef.current = source;

    // If the recovered snapshot is already terminal, there is no live stream
    // to listen to — close the EventSource instead of idling on heartbeats.
    void refreshSnapshot(jobId).then((snapshot) => {
      if (cancelled || !snapshot) return;
      const terminal =
        snapshot.status === "completed" ||
        snapshot.status === "failed" ||
        snapshot.status === "cancelled";
      if (terminal) {
        source.close();
        if (sourceRef.current === source) sourceRef.current = null;
        dispatch({ type: "connection.changed", connection: "closed" });
      }
    });

    let errorStreak = 0;
    source.onopen = () => {
      errorStreak = 0;
      dispatch({ type: "connection.changed", connection: "open" });
    };
    source.onerror = () => {
      // CLOSED means we already tore this stream down (terminal event or
      // cleanup) — EventSource may still fire one last error; ignore it.
      if (source.readyState === EventSource.CLOSED) return;
      errorStreak += 1;
      if (errorStreak > 5) {
        source.close();
        if (sourceRef.current === source) sourceRef.current = null;
        dispatch({ type: "error", message: "生成服务连接中断，请刷新页面重试" });
        return;
      }
      dispatch({ type: "connection.changed", connection: "reconnecting" });
      void refreshSnapshot(jobId);
    };
    const handleMessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as GenerationEvent;
        dispatch({ type: "event.received", jobId, event });
        if (event.type === "job.completed" || event.type === "job.failed" || event.type === "job.cancelled") {
          source.close();
          if (sourceRef.current === source) sourceRef.current = null;
          dispatch({ type: "connection.changed", connection: "closed" });
        }
      } catch {
        dispatch({ type: "error", message: "生成事件格式异常，正在恢复状态" });
        void refreshSnapshot(jobId);
      }
    };
    for (const type of GENERATION_EVENT_TYPES) {
      source.addEventListener(type, handleMessage as EventListener);
    }
    return () => {
      cancelled = true;
      source.close();
      if (sourceRef.current === source) sourceRef.current = null;
    };
  }, [state.activeJobId, state.isTakingOver, refreshSnapshot]);

  // Auto-recovery: discover active job on mount when no initialJobId was given.
  // The server-side job survives navigation; this effect re-attaches the client.
  useEffect(() => {
    if (options.initialJobId || options.skipAutoRecovery) return;
    let cancelled = false;
    void (async () => {
      try {
        const job = await getActiveGenerationJob();
        if (cancelled || !job) return;

        // Belt and braces: only in-flight work hijacks a fresh visit.
        // Finished jobs must be opened explicitly via ?job=<id>.
        const terminal =
          job.status === "completed" ||
          job.status === "failed" ||
          job.status === "cancelled";
        if (terminal) return;

        const wasActive = stateRef.current.activeJobId === job.id;

        if (!wasActive) {
          // Different job or no active job — full recovery.
          // The activeJobId change will trigger the SSE effect.
          dispatch({ type: "job.recovered", jobId: job.id });
          dispatch({ type: "snapshot.received", jobId: job.id, snapshot: job });
          replaceJobInUrl(job.id);
        } else {
          // Same-route navigation (e.g. "创作" link while a job is running):
          // React preserved the reducer state so activeJobId is unchanged,
          // but the SSE connection was torn down by the previous cleanup.
          // Force a reconnect by briefly clearing activeJobId, then restoring
          // it so the SSE effect opens a fresh EventSource.
          sourceRef.current?.close();
          sourceRef.current = null;
          dispatch({ type: "snapshot.received", jobId: job.id, snapshot: job });
          // Toggle activeJobId to re-trigger the SSE effect
          dispatch({ type: "job.recovered", jobId: "" });
          setTimeout(() => {
            if (cancelled) return;
            dispatch({ type: "job.recovered", jobId: job.id });
          }, 0);
        }
      } catch (error) {
        // Silent: the job is still running server-side. A subsequent submit
        // will hit the 409-resume path and recover.
        console.warn("[generation] active job discovery failed", error);
      }
    })();
    return () => { cancelled = true; };
  }, [options.initialJobId, options.skipAutoRecovery, replaceJobInUrl]);

  const start = useCallback(async (
    operation: GenerationOperation,
    prompt: string,
    quality?: "-ql" | "-qm" | "-qh",
  ) => {
    try {
      dispatch({ type: "error", message: null });
      const current = stateRef.current;
      const response = await createGenerationJob({
        operation,
        mode: operation === "repair" ? "repair" : current.hasAuthoritativeCode ? "edit" : "new",
        prompt,
        // generate treats the editor content as context only when the user
        // actually produced it; render / repair / high-quality ALWAYS operate
        // on whatever is visible in the editor — otherwise the buttons fail
        // with a baffling "没有可渲染的代码版本" on a fresh workspace.
        currentCode:
          operation === "generate"
            ? current.hasAuthoritativeCode
              ? current.editorCode
              : null
            : current.editorCode,
        parentJobId: current.activeJobId,
        sourceVersionId: current.selectedVersionId,
        renderError: operation === "repair" ? current.snapshot?.failureReason ?? current.error : null,
        quality,
        format: "mp4",
      });
      sourceRef.current?.close();
      dispatch({ type: "job.started", snapshot: response.snapshot });
      replaceJobInUrl(response.jobId);
      return true;
    } catch (error) {
      if (error instanceof GenerationClientError && error.status === 409) {
        const details = error.details as { activeJobId?: string } | null | undefined;
        const activeJobId = details?.activeJobId;
        if (activeJobId && activeJobId !== stateRef.current.activeJobId) {
          sourceRef.current?.close();
          dispatch({ type: "job.recovered", jobId: activeJobId });
          replaceJobInUrl(activeJobId);
          return true; // recovered an in-flight job — still busy
        }
      }
      dispatch({ type: "error", message: error instanceof Error ? error.message : "无法开始任务" });
      return false;
    }
  }, [replaceJobInUrl]);

  // When the current job settles, start the next queued idea automatically.
  useEffect(() => {
    const status = state.snapshot?.status;
    if (!status) return;
    const terminal =
      status === "completed" || status === "failed" || status === "cancelled";
    if (!terminal) return;
    busyRef.current = false;
    if (queuedRef.current.length === 0) return;
    const next = queuedRef.current[0];
    queuedRef.current = queuedRef.current.slice(1);
    setQueuedPrompts(queuedRef.current);
    busyRef.current = true;
    void start("generate", next).then((ok) => {
      if (!ok) busyRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.snapshot?.status, start]);

  /** Returns true when the prompt was queued (a job is already running). */
  const submitPrompt = useCallback((prompt: string): boolean => {
    if (busyRef.current) {
      queuedRef.current = [...queuedRef.current, prompt];
      setQueuedPrompts(queuedRef.current);
      dispatch({ type: "error", message: null });
      return true;
    }
    busyRef.current = true;
    void start("generate", prompt).then((ok) => {
      if (!ok) busyRef.current = false;
    });
    return false;
  }, [start]);

  const patch = useCallback(async (action: Parameters<typeof patchGenerationJob>[1]) => {
    const jobId = stateRef.current.activeJobId;
    if (!jobId) return null;
    try {
      return await patchGenerationJob(jobId, action);
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "操作失败" });
      return null;
    }
  }, []);

  const clearQueue = useCallback(() => {
    queuedRef.current = [];
    setQueuedPrompts([]);
  }, []);

  const cancel = useCallback(async () => {
    // Explicit stop abandons queued ideas too — otherwise the next prompt
    // would start immediately after the cancel and feel like a bug.
    clearQueue();
    busyRef.current = false;
    const result = await patch({ type: "cancel" });
    if (result?.success) {
      dispatch({ type: "job.cancelled.locally" });
    }
  }, [patch, clearQueue]);

  const takeOver = useCallback(async () => {
    // Takeover freezes the pipeline — queued prompts wait until the user
    // submits again, so drop them to avoid surprising auto-starts.
    clearQueue();
    busyRef.current = false;
    sourceRef.current?.close();
    dispatch({ type: "takeover.started" });
    await patch({ type: "take_over" });
  }, [patch, clearQueue]);

  const selectVersion = useCallback((version: GenerationVersion) => {
    dispatch({ type: "version.selected", version });
  }, []);

  return {
    state,
    submitPrompt,
    queuedPrompts,
    clearQueue,
    renderManually: () => start("render", "渲染当前代码", "-ql"),
    repairManually: () => start("repair", "修复当前代码并重新渲染", "-ql"),
    renderHighQuality: () => start("high_quality_render", "高质量渲染当前代码", "-qh"),
    cancel,
    takeOver,
    saveManualVersion: async () => {
      // Versions live on a job — on a fresh workspace the button used to
      // fail silently, which felt broken.
      if (!stateRef.current.activeJobId) {
        dispatch({ type: "error", message: "请先开始一次生成，版本会保存在任务下" });
        return;
      }
      const result = await patch({ type: "save_manual_version", code: stateRef.current.editorCode });
      if (result?.version) selectVersion(result.version);
    },
    rollback: async (versionId: string) => {
      if (!stateRef.current.activeJobId) {
        dispatch({ type: "error", message: "当前没有可回退的任务" });
        return;
      }
      const result = await patch({ type: "rollback", versionId });
      if (result?.version) selectVersion(result.version);
    },
    retry: () => patch({ type: "retry" }),
    selectVersion,
    selectMobilePanel: (panel: MobileStudioPanel) => dispatch({ type: "mobile.selected", panel }),
    setEditorCode: (code: string) => dispatch({ type: "editor.changed", code }),
  };
}
