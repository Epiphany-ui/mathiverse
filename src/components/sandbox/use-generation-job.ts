"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { GenerationEvent, GenerationOperation, GenerationVersion } from "@/lib/generation/types";
import { createGenerationJob, getGenerationJob, patchGenerationJob } from "./client-api";
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
    publish: () => {
      const versionId = stateRef.current.selectedVersionId ?? stateRef.current.snapshot?.currentVersion?.id;
      return versionId ? patch({ type: "publish", versionId }) : Promise.resolve(null);
    },
    selectVersion,
    selectMobilePanel: (panel: MobileStudioPanel) => dispatch({ type: "mobile.selected", panel }),
    setEditorCode: (code: string) => dispatch({ type: "editor.changed", code }),
  };
}
