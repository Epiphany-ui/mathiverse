// POST /api/generation/jobs — create a new generation job
// GET /api/generation/jobs — return the current owner's active (queued/running) job

import { NextResponse } from "next/server";
import { resolveRequestOwner } from "@/lib/generation/request-owner";
import { validateCreateJobInput } from "@/lib/generation/request-validation";
import { ensureGenerationStarted } from "@/lib/generation/orchestrator";
import { getGenerationJobStore } from "@/lib/generation/job-store";
import { createRendererClient } from "@/lib/generation/renderer-client";

/** Per-owner mutex chain for concurrent job creation (process-local). */
const CREATION_LOCKS = new Map<string, Promise<unknown>>();

export async function GET() {
  const { owner, error } = await resolveRequestOwner();
  if (!owner) {
    return NextResponse.json(
      { error: error?.message ?? "无法识别用户" },
      { status: error?.status ?? 401 },
    );
  }

  const store = getGenerationJobStore();

  // Only in-flight work is auto-restored.  Falling back to the most recent
  // job (any status) made every fresh visit to /sandbox resurrect finished
  // work indefinitely — completed/failed jobs stay reachable via their
  // explicit ?job=<id> URL instead.
  const active = await store.getActiveJob(owner);
  if (active) return NextResponse.json(active);

  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  // Require login for generation (protects API key quota)
  const { owner, error } = await resolveRequestOwner({ requireAuth: true });
  if (!owner) {
    return NextResponse.json(
      { error: error?.message ?? "无法识别用户" },
      { status: error?.status ?? 401 },
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "请求体必须是有效的 JSON" }] },
      { status: 400 },
    );
  }

  const result = validateCreateJobInput(body);
  if ("errors" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  // Serialize the check-and-create per owner: without this, two concurrent
  // submissions both pass the active-job check and create two running jobs.
  const store = getGenerationJobStore();
  const ownerKey = owner.kind === "user" ? `user:${owner.userId}` : `anon:${owner.sessionHash}`;
  const prevLock = CREATION_LOCKS.get(ownerKey) ?? Promise.resolve();
  let releaseLock!: () => void;
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  CREATION_LOCKS.set(ownerKey, prevLock.then(() => lock));
  await prevLock;
  try {
    // Check for existing active job
    const active = await store.getActiveJob(owner);
    if (active) {
      // If the active job hasn't been updated in 5 minutes, the pipeline
      // that owns it was killed (Vercel eviction / timeout / crash).  Auto-
      // fail it so the user isn't locked out of submitting new work.
      const STALE_MS = 5 * 60 * 1_000;
      const age = Date.now() - new Date(active.updatedAt).getTime();
      if (age > STALE_MS && active.durability === "persistent") {
        await store.updateJob(active.id, {
          status: "failed",
          failureReason: "interrupted",
          cancelRequested: false,
        });
        await store.appendEvent(active.id, {
          type: "job.failed",
          data: { reason: "interrupted", message: "之前的任务因超时中断，请重试。", retryable: true },
        });
      } else {
        return NextResponse.json(
          {
            error: "已有正在进行的生成任务，请等待完成或取消后再提交。",
            activeJobId: active.id,
          },
          { status: 409 },
        );
      }
    }

    // The parent job is only read back by the pipeline through the
    // server-internal (owner-less) getJobById — enforce ownership here so one
    // user can never reference another user's job as parentJobId.
    if (result.input.parentJobId) {
      const parent = await store.getJob(owner, result.input.parentJobId);
      if (!parent) {
        return NextResponse.json(
          { error: "父任务不存在或不属于当前用户" },
          { status: 400 },
        );
      }
    }

    // Persist acceptance first, then start bounded background work without
    // holding the HTTP response open for the generation pipeline.
    try {
      const renderer = createRendererClient();
      const job = await store.createJob(owner, result.input);

      // Save the client's current code as a manual version BEFORE starting the
      // pipeline so that render/repair operations see the user's edits (e.g.,
      // after takeover).  generate operations produce their own version later.
      if (result.input.currentCode && result.input.currentCode.trim().length > 0) {
        await store.saveVersion(job.id, {
          source: "manual",
          code: result.input.currentCode,
          validation: null,
          render: null,
        });
      }

      await store.appendEvent(job.id, {
        type: "job.accepted",
        data: { snapshot: job },
      });
      void ensureGenerationStarted(job.id, { store, renderer });

      return NextResponse.json(
        { jobId: job.id, status: "accepted", snapshot: job },
        { status: 202 },
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "创建任务失败";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  } finally {
    releaseLock();
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
