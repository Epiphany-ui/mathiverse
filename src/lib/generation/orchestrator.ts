// Generation orchestrator — bounded pipeline over a GenerationJobStore and the
// local Manim renderer.
//
// Pipeline per operation:
//   generate:            plan → retrieve → generate → validate → quick render
//                        → (auto-repair × ≤2) → complete / fail
//   render:              validate current code → quick render
//   repair:              one user-requested model repair call → validate → render
//   high_quality_render: validate current code → render with -qh
//
// Every model stage performs exactly one model call. Before and after every
// awaited stage the job is re-checked: cancellation (cancelRequested flag or
// status change) stops the pipeline and emits job.cancelled; a runToken change
// (user takeover / supersede) stops it silently.

import type { GenerationJobStore, GenerationOwner } from "./job-store";
import type { RendererClient } from "./renderer-client";
import { RendererError } from "./renderer-client";
import type {
  CreateGenerationJobInput,
  GenerationJobSnapshot,
  GenerationPhase,
  GenerationVersion,
  GenerationVersionSource,
  NewGenerationEvent,
  RenderArtifact,
  ValidationIssue,
  ValidationResult,
} from "./types";
import { isTerminalStatus } from "./state-machine";
import type { AIMessage } from "@/lib/ai/client";
import { chatCompletion } from "@/lib/ai/client";
import { routeGenerationModel, isModelRequired } from "./model-router";
import { planScene } from "./scene-planner";
import { repairCode } from "./repair-code";
import {
  buildGenerationMessages,
  filterRetrievedExamples,
} from "./generation-context";
import { retrieveExamples } from "@/lib/ai/retrieval";
import { getActiveJobs } from "./active-jobs";
import { randomUUID } from "node:crypto";

export interface GenerationDependencies {
  store: GenerationJobStore;
  renderer: RendererClient;
}

const QUICK_QUALITY = "-ql" as const;
const QUICK_FORMAT = "mp4" as const;

const PHASE_LABELS: Record<GenerationPhase, string> = {
  queued: "等待开始",
  planning: "正在规划场景",
  retrieving: "正在检索参考示例",
  generating: "正在生成代码",
  validating: "正在检查 Manim 兼容性",
  rendering: "正在渲染预览",
  repairing: "正在自动修复",
};

// ─── Sentinel errors ────────────────────────────────────────────

/** The job was cancelled (cancelRequested, status=cancelled, or signal abort). */
class JobCancelled extends Error {
  constructor() {
    super("Generation cancelled");
    this.name = "JobCancelled";
  }
}

/** The job was superseded (runToken changed) or already terminal — stop silently. */
class JobSuperseded extends Error {
  constructor() {
    super("Generation superseded");
    this.name = "JobSuperseded";
  }
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

/** Build a single diagnostic issue when the renderer gives none back. */
function fallbackIssue(
  message: string,
  code: ValidationIssue["code"] = "timeout",
): ValidationIssue {
  return { code, message };
}

// ─── Store / event helpers ──────────────────────────────────────

async function emitEvent(
  jobId: string,
  deps: GenerationDependencies,
  event: NewGenerationEvent,
): Promise<void> {
  try {
    await deps.store.appendEvent(jobId, event);
  } catch (err) {
    // Event transport must never take the pipeline down; SSE reconnects replay.
    console.error(
      `[generation] appendEvent ${event.type} failed for ${jobId}:`,
      err,
    );
  }
}

async function setPhase(
  jobId: string,
  deps: GenerationDependencies,
  phase: GenerationPhase,
): Promise<void> {
  await deps.store.updateJob(jobId, { phase });
  await emitEvent(jobId, deps, {
    type: "phase.changed",
    data: { phase, label: PHASE_LABELS[phase] },
  });
}

/** Load the job and verify it is still owned by this pipeline run. */
async function checkpoint(
  jobId: string,
  deps: GenerationDependencies,
  expectedRunToken: number,
  signal: AbortSignal,
): Promise<GenerationJobSnapshot> {
  if (signal.aborted) throw new JobCancelled();
  const job = await deps.store.getJobById(jobId);
  if (!job) throw new JobCancelled();
  if (job.cancelRequested || job.status === "cancelled") throw new JobCancelled();
  if (isTerminalStatus(job.status)) throw new JobSuperseded();
  if (job.runToken !== expectedRunToken) throw new JobSuperseded();
  return job;
}

/**
 * Resolve the code to operate on: the job's own version, else the client's
 * currentCode (persisted as a manual version first), else the parent's.
 */
async function resolveCurrentVersion(
  job: GenerationJobSnapshot,
  deps: GenerationDependencies,
  currentCode: string | null = null,
): Promise<{ code: string; versionId: string } | null> {
  if (job.currentVersion) {
    return { code: job.currentVersion.code, versionId: job.currentVersion.id };
  }
  // No stored version yet (fresh render/repair job): the client's currentCode
  // is authoritative — save it as a version first so validation/render
  // results attach to a version owned by this job.
  if (currentCode && currentCode.trim().length > 0) {
    const version = await saveVersion(job.id, deps, currentCode, "manual");
    return { code: version.code, versionId: version.id };
  }
  if (job.parentJobId) {
    const parent = await deps.store.getJobById(job.parentJobId);
    if (parent?.currentVersion) {
      return {
        code: parent.currentVersion.code,
        versionId: parent.currentVersion.id,
      };
    }
  }
  return null;
}

async function resolveCurrentCode(
  job: GenerationJobSnapshot,
  deps: GenerationDependencies,
): Promise<string | null> {
  return (await resolveCurrentVersion(job, deps))?.code ?? null;
}

async function saveVersion(
  jobId: string,
  deps: GenerationDependencies,
  code: string,
  source: GenerationVersionSource,
): Promise<GenerationVersion> {
  const version = await deps.store.saveVersion(jobId, {
    code,
    source,
    validation: null,
    render: null,
  });
  await emitEvent(jobId, deps, { type: "version.created", data: { version } });
  await emitEvent(jobId, deps, { type: "code.delta", data: { delta: code } });
  return version;
}

async function failJob(
  jobId: string,
  deps: GenerationDependencies,
  reason: string,
  message: string,
  retryable: boolean,
): Promise<void> {
  try {
    await deps.store.updateJob(jobId, { status: "failed", failureReason: reason });
  } catch (err) {
    console.error(`[generation] updateJob failed for ${jobId}:`, err);
  }
  await emitEvent(jobId, deps, {
    type: "job.failed",
    data: { reason, message, retryable },
  });
}

// ─── Validate + render primitives ───────────────────────────────

/**
 * One validate → render attempt. Returns "completed" with the artifact, or
 * "failed" with the issues that blocked it (validation or render issues).
 * Rethrows non-RendererError failures (abort, transport).
 */
async function attemptValidateAndRender(
  jobId: string,
  deps: GenerationDependencies,
  code: string,
  versionId: string,
  signal: AbortSignal,
  expectedRunToken: number,
  quality: "-ql" | "-qm" | "-qh" = QUICK_QUALITY,
): Promise<
  | { kind: "completed"; artifact: RenderArtifact }
  | { kind: "failed"; issues: ValidationIssue[] }
> {
  await setPhase(jobId, deps, "validating");

  let issues: ValidationIssue[] = [];
  try {
    const validation = await deps.renderer.validateManim(code, signal);
    await checkpoint(jobId, deps, expectedRunToken, signal);
    issues = validation.issues;
    await deps.store.updateJob(jobId, { validation });
    await deps.store.updateVersion(jobId, versionId, { validation });
    await emitEvent(jobId, deps, {
      type: "validation.completed",
      data: validation,
    });
  } catch (err) {
    if (!(err instanceof RendererError) && !isTimeoutError(err)) throw err;
    issues =
      err instanceof RendererError && err.issues.length > 0
        ? err.issues
        : [
            fallbackIssue(
              err instanceof RendererError ? err.message : "验证超时",
            ),
          ];
    const validation: ValidationResult = { valid: false, sceneName: null, issues };
    await deps.store.updateJob(jobId, { validation });
    await deps.store.updateVersion(jobId, versionId, { validation });
    await emitEvent(jobId, deps, {
      type: "validation.completed",
      data: validation,
    });
  }

  if (issues.length === 0) {
    const requestId = randomUUID();
    await setPhase(jobId, deps, "rendering");
    await emitEvent(jobId, deps, {
      type: "render.started",
      data: { requestId, quality, format: QUICK_FORMAT },
    });
    try {
      const artifact = await deps.renderer.renderManim({
        code,
        quality,
        format: QUICK_FORMAT,
        requestId,
        signal,
      });
      await checkpoint(jobId, deps, expectedRunToken, signal);
      await deps.store.updateVersion(jobId, versionId, { render: artifact });
      await emitEvent(jobId, deps, {
        type: "render.completed",
        data: { artifact },
      });
      return { kind: "completed", artifact };
    } catch (err) {
      // Best effort: tell the renderer to stop the subprocess.
      await deps.renderer.cancelManimRender(requestId).catch(() => {});
      if (!(err instanceof RendererError) && !isTimeoutError(err)) throw err;
      const renderIssues =
        err instanceof RendererError && err.issues.length > 0
          ? err.issues
          : [
              fallbackIssue(
                err instanceof RendererError ? err.message : "渲染超时",
                "render",
              ),
            ];
      await emitEvent(jobId, deps, {
        type: "render.failed",
        data: {
          issues: renderIssues,
          retryable: err instanceof RendererError ? err.retryable : true,
        },
      });
      return { kind: "failed", issues: renderIssues };
    }
  }

  return { kind: "failed", issues };
}

async function completeJob(
  jobId: string,
  deps: GenerationDependencies,
  artifact: RenderArtifact,
  versionId: string,
  expectedRunToken: number,
  signal: AbortSignal,
): Promise<void> {
  await checkpoint(jobId, deps, expectedRunToken, signal);
  await deps.store.updateJob(jobId, { render: artifact, status: "completed" });
  await checkpointCompletedRun(jobId, deps, expectedRunToken);
  await emitEvent(jobId, deps, {
    type: "job.completed",
    data: { versionId, render: artifact },
  });
}

async function checkpointCompletedRun(
  jobId: string,
  deps: GenerationDependencies,
  expectedRunToken: number,
): Promise<void> {
  const job = await deps.store.getJobById(jobId);
  if (!job || job.runToken !== expectedRunToken) throw new JobSuperseded();
}

// ─── Operation pipelines ────────────────────────────────────────

/** generate: plan → retrieve → generate → validate → render → (repair ≤2). */
async function runGenerate(
  jobId: string,
  deps: GenerationDependencies,
  controller: AbortController,
  expectedRunToken: number,
): Promise<void> {
  const signal = controller.signal;
  let job = await checkpoint(jobId, deps, expectedRunToken, signal);
  const prompt = job.prompt;

  // 1. Structured scene planning (fast model, no reasoning).
  await setPhase(jobId, deps, "planning");
  const currentCode = await resolveCurrentCode(job, deps);
  const plan = await planScene(prompt, currentCode, signal);
  await checkpoint(jobId, deps, expectedRunToken, signal);
  await deps.store.updateJob(jobId, { scenePlan: plan });
  await emitEvent(jobId, deps, { type: "plan.ready", data: { plan } });

  // 2. Retrieval of reference examples (quality-gated; empty is acceptable).
  await setPhase(jobId, deps, "retrieving");
  const rawExamples = await retrieveExamples(prompt, 3);
  await checkpoint(jobId, deps, expectedRunToken, signal);
  const examples = filterRetrievedExamples(
    rawExamples.map((row) => ({ ...row, similarity: row.similarity ?? 0 })),
    {
      minSimilarity: 0.72,
      dimension: plan.layout,
      manimVersion: "0.21.0",
      maxDifficulty: 3,
    },
  );

  // 3. Code generation — exactly one model call.
  await setPhase(jobId, deps, "generating");
  const route = routeGenerationModel("generate", plan.estimatedComplexity);
  const messages: AIMessage[] = buildGenerationMessages({
    prompt,
    mode: job.mode,
    currentCode,
    plan,
    examples,
  });
  const code = await chatCompletion({
    messages,
    model: route.model,
    max_tokens: route.maxTokens,
    reasoning_effort: route.reasoningEffort,
    thinking: route.thinking,
    signal,
  });
  await checkpoint(jobId, deps, expectedRunToken, signal);
  let version = await saveVersion(jobId, deps, code, "generated");

  // 4. Validate → quick render → auto-repair loop (at most two repairs).
  while (true) {
    job = await checkpoint(jobId, deps, expectedRunToken, signal);

    const outcome = await attemptValidateAndRender(
      jobId,
      deps,
      version.code,
      version.id,
      signal,
      expectedRunToken,
    );
    if (outcome.kind === "completed") {
      await completeJob(
        jobId,
        deps,
        outcome.artifact,
        version.id,
        expectedRunToken,
        signal,
      );
      return;
    }

    if (job.repairAttempt >= 2) {
      await failJob(
        jobId,
        deps,
        "repair_limit",
        "自动验证与修复均未成功（最多 2 次）。请手动修改代码或重试。",
        true,
      );
      return;
    }

    const attempt = (job.repairAttempt + 1) as 1 | 2;
    await setPhase(jobId, deps, "repairing");
    const reason =
      outcome.issues.map((issue) => issue.message).join("; ").slice(0, 800) ||
      "验证未通过";
    await emitEvent(jobId, deps, {
      type: "repair.started",
      data: { attempt, maxAttempts: 2, reason },
    });

    const repaired = await repairCode({
      code: version.code,
      issues: outcome.issues,
      prompt,
      signal,
    });
    await checkpoint(jobId, deps, expectedRunToken, signal);
    await deps.store.updateJob(jobId, { repairAttempt: attempt });
    version = await saveVersion(jobId, deps, repaired, "auto_repair");
  }
}

/** render / high_quality_render: validate the current code, then render. */
async function runRenderOnly(
  jobId: string,
  deps: GenerationDependencies,
  controller: AbortController,
  expectedRunToken: number,
  operation: "render" | "high_quality_render",
  currentCode: string | null = null,
): Promise<void> {
  const signal = controller.signal;
  const job = await checkpoint(jobId, deps, expectedRunToken, signal);
  const current = await resolveCurrentVersion(job, deps, currentCode);
  if (!current) {
    await failJob(jobId, deps, "no_code", "没有可渲染的代码版本。", true);
    return;
  }

  const quality = operation === "high_quality_render" ? "-qh" : "-ql";
  const outcome = await attemptValidateAndRender(
    jobId,
    deps,
    current.code,
    current.versionId,
    signal,
    expectedRunToken,
    quality,
  );
  if (outcome.kind === "completed") {
    await completeJob(
      jobId,
      deps,
      outcome.artifact,
      current.versionId,
      expectedRunToken,
      signal,
    );
  } else {
    await failJob(
      jobId,
      deps,
      "validation_failed",
      "代码未能通过验证或渲染，请检查诊断信息。",
      true,
    );
  }
}

/** repair: one user-requested model repair call, then validate + render. */
async function runManualRepair(
  jobId: string,
  deps: GenerationDependencies,
  controller: AbortController,
  expectedRunToken: number,
  currentCode: string | null = null,
): Promise<void> {
  const signal = controller.signal;
  const job = await checkpoint(jobId, deps, expectedRunToken, signal);
  const current = await resolveCurrentVersion(job, deps, currentCode);
  if (!current) {
    await failJob(jobId, deps, "no_code", "没有可修复的代码版本。", true);
    return;
  }

  const issues: ValidationIssue[] = job.validation?.issues?.length
    ? job.validation.issues
    : [{ code: "render", message: "用户请求修复当前代码" }];

  await setPhase(jobId, deps, "repairing");
  await emitEvent(jobId, deps, {
    type: "repair.started",
    data: { attempt: 1, maxAttempts: 2, reason: "用户手动请求修复" },
  });

  const repaired = await repairCode({
    code: current.code,
    issues,
    prompt: job.prompt,
    signal,
  });
  await checkpoint(jobId, deps, expectedRunToken, signal);
  const version = await saveVersion(jobId, deps, repaired, "auto_repair");

  const outcome = await attemptValidateAndRender(
    jobId,
    deps,
    version.code,
    version.id,
    signal,
    expectedRunToken,
  );
  if (outcome.kind === "completed") {
    await completeJob(
      jobId,
      deps,
      outcome.artifact,
      version.id,
      expectedRunToken,
      signal,
    );
  } else {
    await failJob(
      jobId,
      deps,
      "validation_failed",
      "修复后的代码仍未通过验证或渲染。",
      true,
    );
  }
}

// ─── Pipeline runner ────────────────────────────────────────────

async function runGenerationPipeline(
  jobId: string,
  deps: GenerationDependencies,
  controller: AbortController,
  expectedRunToken: number,
  currentCode: string | null = null,
): Promise<void> {
  const signal = controller.signal;

  try {
    const job = await checkpoint(jobId, deps, expectedRunToken, signal);
    const operation = job.operation;

    // Dispatch by operation. Only generate and repair are model-backed
    // (see isModelRequired); render and high_quality_render never call a model.
    if (isModelRequired(operation)) {
      if (operation === "generate") {
        await runGenerate(jobId, deps, controller, expectedRunToken);
      } else {
        await runManualRepair(jobId, deps, controller, expectedRunToken, currentCode);
      }
      return;
    }

    if (operation === "render" || operation === "high_quality_render") {
      await runRenderOnly(
        jobId,
        deps,
        controller,
        expectedRunToken,
        operation,
        currentCode,
      );
    }
  } catch (err) {
    if (err instanceof JobCancelled) {
      await emitCancelled(jobId, deps, expectedRunToken);
      return;
    }
    if (err instanceof JobSuperseded) {
      // User takeover or terminal stop — the takeover already persisted its
      // own version; emit nothing.
      return;
    }
    if (err instanceof Error && err.name === "AbortError") {
      // Signal aborted mid-request (cancelActiveGeneration).
      await emitCancelled(jobId, deps, expectedRunToken);
      return;
    }
    console.error(`[generation] pipeline error for ${jobId}:`, err);
    const latest = await deps.store.getJobById(jobId).catch(() => null);
    if (!latest || latest.runToken !== expectedRunToken) return;
    await failJob(
      jobId,
      deps,
      "internal",
      err instanceof Error ? err.message : "内部错误",
      false,
    );
  }
}

async function emitCancelled(
  jobId: string,
  deps: GenerationDependencies,
  expectedRunToken: number,
): Promise<void> {
  const current = await deps.store.getJobById(jobId).catch(() => null);
  if (!current || current.runToken !== expectedRunToken) return;
  await deps.store
    .updateJob(jobId, { status: "cancelled" })
    .catch((err) =>
      console.error(`[generation] updateJob cancelled failed for ${jobId}:`, err),
    );
  await emitEvent(jobId, deps, {
    type: "job.cancelled",
    data: { versionId: current?.currentVersion?.id ?? null },
  });
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Create a generation job, emit job.accepted, and start the pipeline in the
 * background. Resolves with the accepted snapshot immediately — the pipeline
 * is NOT awaited (structured events carry progress to the client).
 */
export async function executeGenerationJob(
  owner: GenerationOwner,
  input: CreateGenerationJobInput,
  deps: GenerationDependencies,
): Promise<GenerationJobSnapshot> {
  const snapshot = await deps.store.createJob(owner, input);
  await emitEvent(snapshot.id, deps, {
    type: "job.accepted",
    data: { snapshot },
  });

  const registry = getActiveJobs();
  const controller = new AbortController();

  const promise = runGenerationPipeline(
    snapshot.id,
    deps,
    controller,
    snapshot.runToken,
    input.currentCode,
  )
    .catch((err) => {
      // Belt and braces — the pipeline handles its own failures internally.
      console.error(
        `[generation] background pipeline crashed for ${snapshot.id}:`,
        err,
      );
    })
    .finally(() => {
      if (registry.get(snapshot.id)?.promise === promise) {
        registry.delete(snapshot.id);
      }
    });

  registry.set(snapshot.id, {
    promise,
    controller,
    runToken: snapshot.runToken,
    startedAt: Date.now(),
  });

  return snapshot;
}

/**
 * Ensure a (possibly pre-existing) job is running in this process.
 * No-op for terminal jobs or when the same runToken is already active.
 * Resolves when the pipeline finishes (routes call this without awaiting).
 */
export async function ensureGenerationStarted(
  jobId: string,
  deps: GenerationDependencies,
): Promise<void> {
  const job = await deps.store.getJobById(jobId);
  if (!job || isTerminalStatus(job.status)) return;

  const registry = getActiveJobs();
  const existing = registry.get(jobId);
  if (existing && existing.runToken === job.runToken) return;

  const controller = new AbortController();
  const promise = runGenerationPipeline(jobId, deps, controller, job.runToken)
    .catch((err) => {
      console.error(`[generation] background pipeline crashed for ${jobId}:`, err);
    })
    .finally(() => {
      if (registry.get(jobId)?.promise === promise) {
        registry.delete(jobId);
      }
    });

  registry.set(jobId, {
    promise,
    controller,
    runToken: job.runToken,
    startedAt: Date.now(),
  });

  await promise;
}
