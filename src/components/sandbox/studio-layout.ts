import type { GenerationJobSnapshot } from "@/lib/generation/types";

export type StudioLayout = "single-panel" | "landscape-split" | "tablet-canvas" | "compact-grid" | "full-grid";

export function deriveStudioLayout(width: number, orientation: "portrait" | "landscape"): StudioLayout {
  if (width < 768) return orientation === "landscape" ? "landscape-split" : "single-panel";
  if (orientation === "landscape" && width < 900) return "landscape-split";
  if (width < 900) return "tablet-canvas";
  if (width < 1200) return "compact-grid";
  return "full-grid";
}

export type CanvasState = "idle" | "working" | "preview" | "error";
export function getCanvasState(snapshot: GenerationJobSnapshot | null): CanvasState {
  if (!snapshot) return "idle";
  if (snapshot.status === "failed") return "error";
  if (snapshot.render?.url) return "preview";
  if (snapshot.status === "queued" || snapshot.status === "running") return "working";
  return "idle";
}
