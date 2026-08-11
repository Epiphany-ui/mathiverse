import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGenerationEvent,
  assertPhaseTransition,
  createInitialSnapshot,
  isTerminalStatus,
} from "./state-machine";
import type { GenerationEvent, GenerationJobSnapshot, ScenePlan } from "./types";

const samplePlan: ScenePlan = {
  objects: ["Circle"],
  layout: "2d" as const,
  stages: [{ title: "建立场景", intent: "显示单位圆" }],
  trackers: [],
  estimatedComplexity: "simple" as const,
};

function makeSnapshot(
  overrides?: Partial<GenerationJobSnapshot>,
): GenerationJobSnapshot {
  return {
    id: "job-1",
    parentJobId: null,
    operation: "generate",
    mode: "new",
    status: "queued",
    phase: "queued",
    prompt: "画一个单位圆",
    scenePlan: null,
    currentVersion: null,
    versions: [],
    validation: null,
    render: null,
    repairAttempt: 0,
    runToken: 0,
    failureReason: null,
    cancelRequested: false,
    durability: "session",
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

function evt(
  type: GenerationEvent["type"],
  data: GenerationEvent["data"],
  id = 1,
): GenerationEvent {
  return {
    id,
    jobId: "job-1",
    createdAt: new Date().toISOString(),
    type,
    data,
  } as GenerationEvent;
}

// ─── createInitialSnapshot ─────────────────────────────────────

describe("createInitialSnapshot", () => {
  it("starts queued without treating placeholder code as current code", () => {
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
    assert.equal(job.versions.length, 0);
  });

  it("preserves the prompt and operation", () => {
    const job = createInitialSnapshot({
      id: "job-2",
      operation: "repair",
      mode: "repair",
      prompt: "修复单位圆渲染",
      currentCode: "from manim import *",
      parentJobId: "job-1",
      durability: "session",
    });
    assert.equal(job.prompt, "修复单位圆渲染");
    assert.equal(job.operation, "repair");
    assert.equal(job.mode, "repair");
  });
});

// ─── isTerminalStatus ──────────────────────────────────────────

describe("isTerminalStatus", () => {
  it("returns true for completed, failed, cancelled", () => {
    assert.equal(isTerminalStatus("completed"), true);
    assert.equal(isTerminalStatus("failed"), true);
    assert.equal(isTerminalStatus("cancelled"), true);
  });

  it("returns false for queued and running", () => {
    assert.equal(isTerminalStatus("queued"), false);
    assert.equal(isTerminalStatus("running"), false);
  });
});

// ─── assertPhaseTransition ─────────────────────────────────────

describe("assertPhaseTransition", () => {
  it("allows queued -> planning", () => {
    assert.doesNotThrow(() => assertPhaseTransition("queued", "planning"));
  });

  it("allows repairing -> validating", () => {
    assert.doesNotThrow(() => assertPhaseTransition("repairing", "validating"));
  });

  it("rejects rendering -> planning (backwards jump)", () => {
    assert.throws(
      () => assertPhaseTransition("rendering", "planning"),
      /Illegal generation phase transition/,
    );
  });

  it("rejects generating -> planning (skip backwards)", () => {
    assert.throws(
      () => assertPhaseTransition("generating", "planning"),
      /Illegal generation phase transition/,
    );
  });

  it("allows queued -> validating (direct render of existing code)", () => {
    assert.doesNotThrow(() => assertPhaseTransition("queued", "validating"));
  });
});

// ─── applyGenerationEvent ──────────────────────────────────────

describe("applyGenerationEvent", () => {
  it("replaces local state with the accepted server snapshot", () => {
    const local = makeSnapshot({ prompt: "旧提示", runToken: 0 });
    const accepted = makeSnapshot({
      prompt: "服务端提示",
      runToken: 2,
      phase: "generating",
      status: "running",
    });
    const next = applyGenerationEvent(
      local,
      evt("job.accepted", { snapshot: accepted }),
    );
    assert.deepEqual(next, accepted);
  });

  it("updates phase and status on phase.changed", () => {
    const snap = makeSnapshot();
    const next = applyGenerationEvent(
      snap,
      evt("phase.changed", { phase: "planning", label: "规划场景" }),
    );
    assert.equal(next.phase, "planning");
    assert.equal(next.status, "running");
  });

  it("sets scene plan on plan.ready", () => {
    const snap = makeSnapshot({ phase: "planning", status: "running" });
    const next = applyGenerationEvent(
      snap,
      evt("plan.ready", { plan: samplePlan }),
    );
    assert.deepEqual(next.scenePlan, samplePlan);
  });

  it("adds a version on version.created", () => {
    const snap = makeSnapshot();
    const version = {
      id: "v1",
      sequence: 1,
      source: "generated" as const,
      code: "from manim import *",
      validation: { valid: true, sceneName: "Scene", issues: [] },
      render: {
        url: "/output/v1.mp4",
        format: "mp4" as const,
        quality: "-ql" as const,
        duration: 2,
        cacheHit: false,
        renderKey: "v1-key",
      },
      createdAt: new Date().toISOString(),
    };
    const next = applyGenerationEvent(
      snap,
      evt("version.created", { version }),
    );
    assert.equal(next.versions.length, 1);
    assert.equal(next.currentVersion?.id, "v1");
    assert.equal(next.validation?.valid, true);
    assert.equal(next.render?.renderKey, "v1-key");
  });

  it("replaces version with same ID rather than duplicating", () => {
    const v1 = {
      id: "v1",
      sequence: 1,
      source: "generated" as const,
      code: "v1 code",
      validation: null,
      render: null,
      createdAt: new Date().toISOString(),
    };
    const snap = makeSnapshot({ versions: [v1], currentVersion: v1 });
    const v2 = { ...v1, code: "v2 code" };
    const next = applyGenerationEvent(
      snap,
      evt("version.created", { version: v2 }, 2),
    );
    assert.equal(next.versions.length, 1);
    assert.equal(next.currentVersion?.code, "v2 code");
  });

  it("sets validation on validation.completed", () => {
    const snap = makeSnapshot();
    const result = {
      valid: false,
      sceneName: null,
      issues: [{ code: "syntax" as const, message: "invalid syntax", line: 4 }],
    };
    const next = applyGenerationEvent(
      snap,
      evt("validation.completed", result),
    );
    assert.equal(next.validation?.valid, false);
    assert.equal(next.validation?.issues[0].code, "syntax");
  });

  it("marks job completed with render", () => {
    const snap = makeSnapshot({ status: "running", phase: "rendering" });
    const artifact = {
      url: "/output/test.mp4",
      format: "mp4" as const,
      quality: "-ql" as const,
      duration: 3.5,
      cacheHit: false,
      renderKey: "abc123",
    };
    const next = applyGenerationEvent(
      snap,
      evt("job.completed", {
        versionId: "v1",
        render: artifact,
      }),
    );
    assert.equal(next.status, "completed");
    assert.equal(next.render?.url, "/output/test.mp4");
  });

  it("marks job failed with reason", () => {
    const snap = makeSnapshot({ status: "running" });
    const next = applyGenerationEvent(
      snap,
      evt("job.failed", {
        reason: "render_timeout",
        message: "渲染超时",
        retryable: true,
      }),
    );
    assert.equal(next.status, "failed");
    assert.equal(next.failureReason, "render_timeout");
  });

  it("marks job cancelled", () => {
    const snap = makeSnapshot({ status: "running" });
    const next = applyGenerationEvent(
      snap,
      evt("job.cancelled", { versionId: "v1" }),
    );
    assert.equal(next.status, "cancelled");
  });

  it("never adds a percent field", () => {
    const snap = makeSnapshot();
    const next = applyGenerationEvent(
      snap,
      evt("validation.completed", {
        valid: false,
        sceneName: null,
        issues: [{ code: "syntax", message: "invalid syntax", line: 4 }],
      }),
    );
    assert.equal("percent" in next, false);
  });

  it("updates repairAttempt on repair.started", () => {
    const snap = makeSnapshot();
    const next = applyGenerationEvent(
      snap,
      evt("repair.started", {
        attempt: 1,
        maxAttempts: 2,
        reason: "语法错误",
      }),
    );
    assert.equal(next.repairAttempt, 1);
  });

  it("merges render.failed issues into validation", () => {
    const snap = makeSnapshot({
      validation: {
        valid: false,
        sceneName: "Test",
        issues: [{ code: "syntax", message: "bad syntax", line: 1 }],
      },
    });
    const next = applyGenerationEvent(
      snap,
      evt("render.failed", {
        issues: [{ code: "render", message: "timeout" }],
        retryable: true,
      }),
    );
    assert.equal(next.validation?.issues.length, 2);
  });
});
