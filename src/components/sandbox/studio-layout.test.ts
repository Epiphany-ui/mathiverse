import assert from "node:assert/strict";
import test from "node:test";
import { deriveStudioLayout, getCanvasState } from "./studio-layout";
import { createInitialSnapshot } from "@/lib/generation/state-machine";

test("derives the five viewport contracts", () => {
  assert.equal(deriveStudioLayout(390, "portrait"), "single-panel");
  assert.equal(deriveStudioLayout(844, "landscape"), "landscape-split");
  assert.equal(deriveStudioLayout(768, "portrait"), "tablet-canvas");
  assert.equal(deriveStudioLayout(1024, "landscape"), "compact-grid");
  assert.equal(deriveStudioLayout(1440, "landscape"), "full-grid");
});

const base = createInitialSnapshot({ id: "j", operation: "generate", mode: "new", prompt: "p", currentCode: null, parentJobId: null, durability: "session" });
test("canvas state is an exact four-state union", () => {
  assert.equal(getCanvasState(null), "idle");
  assert.equal(getCanvasState(base), "working");
  assert.equal(getCanvasState({ ...base, status: "failed" }), "error");
  assert.equal(getCanvasState({ ...base, status: "completed", render: { url: "/x.mp4", format: "mp4", quality: "-ql", duration: 1, cacheHit: false, renderKey: "x" } }), "preview");
});
