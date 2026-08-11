import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGenerationEvent,
  assertPhaseTransition,
  createInitialSnapshot,
} from "./state-machine";

test("a generation job starts queued without treating placeholder code as current code", () => {
  const job = createInitialSnapshot({
    id: "job-1",
    operation: "generate",
    mode: "new",
    prompt: "展示傅里叶级数",
    currentCode: null,
    parentJobId: null,
    durability: "persistent",
  });

  assert.equal(job.status, "queued");
  assert.equal(job.phase, "queued");
  assert.equal(job.currentVersion, null);
});

test("repair may return to validation but may not exceed two attempts", () => {
  assert.doesNotThrow(() => assertPhaseTransition("repairing", "validating"));
  assert.throws(() => assertPhaseTransition("rendering", "planning"));
});

test("a validation event updates the snapshot without inventing progress", () => {
  const start = createInitialSnapshot({
    id: "job-2",
    operation: "generate",
    mode: "new",
    prompt: "画一个单位圆",
    currentCode: null,
    parentJobId: null,
    durability: "session",
  });
  const next = applyGenerationEvent(start, {
    id: 4,
    jobId: "job-2",
    type: "validation.completed",
    createdAt: "2026-08-11T00:00:00.000Z",
    data: {
      valid: false,
      issues: [{ code: "syntax", message: "invalid syntax", line: 4 }],
      sceneName: null,
    },
  });

  assert.equal(next.validation?.valid, false);
  assert.equal("percent" in next, false);
});
