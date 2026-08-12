"use client";

import { useEffect, useState } from "react";
import "@/components/sandbox/entrance-animation.css";
import { AppHeader } from "@/components/layout/app-header";
import { PublishDialog } from "@/components/sandbox/publish-dialog";
import { StudioShell } from "@/components/sandbox/studio-shell";
import { useGenerationJob } from "@/components/sandbox/use-generation-job";
import { createClient } from "@/lib/supabase/client";
import {
  resolveStudioEntrance,
  STUDIO_PRESENTATION_MARKER,
  type StudioEntrance,
} from "@/lib/studio/entrance-motion";

export const PLACEHOLDER_CODE = `from manim import *

class FirstScene(Scene):
    def construct(self):
        # 描述一个数学想法，生成的 Manim 场景会出现在这里
        circle = Circle(radius=1, color=TEAL)
        self.play(Create(circle))
        self.wait(1)
`;

interface SandboxContentProps {
  forkId: string | null;
  initialPrompt: string;
  jobId: string | null;
}

export function SandboxContent({ forkId, initialPrompt, jobId }: SandboxContentProps) {
  // Defer entrance resolution until sessionStorage is available.
  // "resume" is safe to set synchronously (keyed on the URL param);
  // "first" requires knowing whether the marker was already set.
  const [entrance, setEntrance] = useState<StudioEntrance | undefined>(() =>
    jobId?.trim() ? "resume" : undefined,
  );
  const [promptSeed, setPromptSeed] = useState(initialPrompt);
  const [forkedFrom, setForkedFrom] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const controller = useGenerationJob({
    initialPrompt,
    initialCode: PLACEHOLDER_CODE,
    hasAuthoritativeCode: false,
    initialJobId: jobId,
    skipAutoRecovery: forkId !== null,
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let presented = true;
      try {
        presented = sessionStorage.getItem(STUDIO_PRESENTATION_MARKER) === "1";
        sessionStorage.setItem(STUDIO_PRESENTATION_MARKER, "1");
      } catch {}
      setEntrance(resolveStudioEntrance({ hasPresentationMarker: presented, jobId }));
    });
    return () => { cancelled = true; };
  }, [jobId]);

  useEffect(() => {
    if (!forkId) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      if (!supabase) return;
      const { data } = await supabase
        .from("visualizations")
        .select("source_code")
        .eq("id", forkId)
        .eq("is_published", true)
        .single();
      const row = data as { source_code?: string | null } | null;
      if (!cancelled && row?.source_code) {
        controller.setEditorCode(row.source_code);
        setForkedFrom(forkId);
      }
    })();
    return () => { cancelled = true; };
  }, [forkId, controller.setEditorCode]);

  useEffect(() => {
    if (forkId || initialPrompt) return;
    try {
      const code = localStorage.getItem("sandbox_code");
      const prompt = localStorage.getItem("sandbox_prompt");
      if (code) {
        controller.setEditorCode(code);
        localStorage.removeItem("sandbox_code");
      }
      if (prompt) {
        queueMicrotask(() => setPromptSeed(prompt));
        localStorage.removeItem("sandbox_prompt");
      }
    } catch {}
  }, [forkId, initialPrompt, controller.setEditorCode]);

  // When entrance is "first" and a recovered job loads mid-animation,
  // let the animation finish before switching.  The CSS animation runs
  // for 900ms; delaying the bump avoids a visual clash.
  const activeJobId = controller.state.activeJobId;
  useEffect(() => {
    if (!activeJobId || entrance !== "first") return;
    const id = setTimeout(() => setEntrance("resume"), 950);
    return () => clearTimeout(id);
  }, [activeJobId, entrance]);

  const videoUrl = controller.state.snapshot?.render?.url ?? null;
  return (
    <div className="studio-entrance-shell min-h-screen bg-[#071012]" {...(entrance ? { "data-studio-entrance": entrance } : {})}>
      <AppHeader appearance="studio" />
      <div className="pt-16 min-w-0 overflow-x-clip">
        <StudioShell key={promptSeed} controller={controller} initialPrompt={promptSeed} onOpenPublish={() => setPublishOpen(true)} />
      </div>
      <PublishDialog
        open={publishOpen}
        code={controller.state.editorCode}
        videoUrl={videoUrl}
        forkedFrom={forkedFrom}
        onClose={() => setPublishOpen(false)}
      />
    </div>
  );
}
