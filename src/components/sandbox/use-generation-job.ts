"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
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

  const replaceJobInUrl = useCallback((jobId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("job", jobId);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const refreshSnapshot = useCallback(async (jobId: string) => {
    try {
      const snapshot = await getGenerationJob(jobId);
      dispatch({ type: "snapshot.received", jobId, snapshot });
    } catch (error) {
      dispatch({ type: "error", message: error instanceof Error ? error.message : "无法恢复任务状态" });
    }
  }, []);

  useEffect(() => {
    const jobId = state.activeJobId;
    sourceRef.current?.close();
    sourceRef.current = null;
    if (!jobId || state.isTakingOver) return;

    dispatch({ type: "connection.changed", connection: "connecting" });
    void refreshSnapshot(jobId);
    const source = new EventSource(`/api/generation/jobs/${encodeURIComponent(jobId)}/events`);
    sourceRef.current = source;
    source.onopen = () => dispatch({ type: "connection.changed", connection: "open" });
    source.onerror = () => {
      dispatch({ type: "connection.changed", connection: "reconnecting" });
      void refreshSnapshot(jobId);
    };
    const handleMessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as GenerationEvent;
        dispatch({ type: "event.received", jobId, event });
        if (event.type === "job.completed" || event.type === "job.failed" || event.type === "job.cancelled") {
          source.close();
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
        currentCode: current.hasAuthoritativeCode ? current.editorCode : null,
        parentJobId: current.activeJobId,
        sourceVersionId: current.selectedVersionId,
        renderError: operation === "repair" ? current.snapshot?.failureReason ?? current.error : null,
        quality,
        format: "mp4",
      });
      sourceRef.current?.close();
      dispatch({ type: "job.started", snapshot: response.snapshot });
      replaceJobInUrl(response.jobId);
    } catch (error) {
      if (error instanceof GenerationClientError && error.status === 409) {
        const details = error.details as { activeJobId?: string } | null | undefined;
        const activeJobId = details?.activeJobId;
        if (activeJobId && activeJobId !== stateRef.current.activeJobId) {
          sourceRef.current?.close();
          dispatch({ type: "job.recovered", jobId: activeJobId });
          replaceJobInUrl(activeJobId);
          return;
        }
      }
      dispatch({ type: "error", message: error instanceof Error ? error.message : "无法开始任务" });
    }
  }, [replaceJobInUrl]);

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

  const takeOver = useCallback(async () => {
    sourceRef.current?.close();
    dispatch({ type: "takeover.started" });
    await patch({ type: "take_over" });
  }, [patch]);

  const selectVersion = useCallback((version: GenerationVersion) => {
    dispatch({ type: "version.selected", version });
  }, []);

  return {
    state,
    submitPrompt: (prompt: string) => start("generate", prompt),
    renderManually: () => start("render", "渲染当前代码", "-ql"),
    repairManually: () => start("repair", "修复当前代码并重新渲染", "-ql"),
    renderHighQuality: () => start("high_quality_render", "高质量渲染当前代码", "-qh"),
    cancel: () => patch({ type: "cancel" }),
    takeOver,
    saveManualVersion: async () => {
      const result = await patch({ type: "save_manual_version", code: stateRef.current.editorCode });
      if (result?.version) selectVersion(result.version);
    },
    rollback: async (versionId: string) => {
      const result = await patch({ type: "rollback", versionId });
      if (result?.version) selectVersion(result.version);
    },
    retry: () => patch({ type: "retry" }),
    selectVersion,
    selectMobilePanel: (panel: MobileStudioPanel) => dispatch({ type: "mobile.selected", panel }),
    setEditorCode: (code: string) => dispatch({ type: "editor.changed", code }),
  };
}
