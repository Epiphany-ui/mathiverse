// GET /api/generation/jobs/[jobId] — get job snapshot
// PATCH /api/generation/jobs/[jobId] — perform an action (cancel, retry, etc.)

import { NextResponse } from "next/server";
import { resolveRequestOwner } from "@/lib/generation/request-owner";
import { validatePatchAction } from "@/lib/generation/request-validation";
import { getGenerationJobStore } from "@/lib/generation/job-store";
import { cancelActiveGeneration } from "@/lib/generation/active-jobs";
import { isTerminalStatus } from "@/lib/generation/state-machine";
import { ensureGenerationStarted } from "@/lib/generation/orchestrator";
import { createRendererClient } from "@/lib/generation/renderer-client";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
) {
  const { owner, error } = await resolveRequestOwner();
  if (!owner) {
    return NextResponse.json(
      { error: error?.message ?? "无法识别用户" },
      { status: error?.status ?? 401 },
    );
  }

  const { jobId } = await params;
  const store = getGenerationJobStore();
  const job = await store.getJob(owner, jobId);

  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
) {
  const { owner, error } = await resolveRequestOwner();
  if (!owner) {
    return NextResponse.json(
      { error: error?.message ?? "无法识别用户" },
      { status: error?.status ?? 401 },
    );
  }

  const { jobId } = await params;
  const store = getGenerationJobStore();
  const job = await store.getJob(owner, jobId);

  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  // Parse action
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { errors: [{ field: "body", message: "请求体必须是有效的 JSON" }] },
      { status: 400 },
    );
  }

  const result = validatePatchAction(body);
  if ("errors" in result) {
    return NextResponse.json(result, { status: 400 });
  }

  const { action } = result;

  switch (action.type) {
    case "cancel": {
      if (isTerminalStatus(job.status)) {
        return NextResponse.json({ success: true, action: "cancel" });
      }
      await store.updateJob(jobId, {
        cancelRequested: true,
        runToken: job.runToken + 1,
        status: "cancelled",
      });
      await cancelActiveGeneration(jobId);
      // Emit cancelled event directly — the pipeline's emitCancelled will
      // bail on runToken mismatch, so the route must guarantee the event.
      await store.appendEvent(jobId, {
        type: "job.cancelled",
        data: { versionId: job.currentVersion?.id ?? null },
      });
      return NextResponse.json({ success: true, action: "cancel" });
    }

    case "retry": {
      if (job.status !== "failed") {
        return NextResponse.json(
          { error: "只能重试已结束的任务" },
          { status: 409 },
        );
      }
      await cancelActiveGeneration(jobId);
      await store.updateJob(jobId, {
        status: "running",
        phase: "queued",
        cancelRequested: false,
        failureReason: null,
        repairAttempt: 0,
        runToken: job.runToken + 1,
      });
      void ensureGenerationStarted(jobId, {
        store,
        renderer: createRendererClient(),
      });
      return NextResponse.json({ success: true, action: "retry" });
    }

    case "take_over": {
      if (job.cancelRequested || isTerminalStatus(job.status)) {
        return NextResponse.json({ success: true, action: "take_over" });
      }
      await store.updateJob(jobId, {
        cancelRequested: true,
        runToken: job.runToken + 1,
        status: "cancelled",
      });
      await cancelActiveGeneration(jobId);
      await store.appendEvent(jobId, {
        type: "job.cancelled",
        data: { versionId: job.currentVersion?.id ?? null },
      });
      return NextResponse.json({ success: true, action: "take_over" });
    }

    case "save_manual_version": {
      const v = await store.saveVersion(jobId, {
        source: "manual",
        code: (action as { type: "save_manual_version"; code: string }).code,
        validation: null,
        render: null,
      });
      return NextResponse.json({ success: true, version: v });
    }

    case "rollback": {
      const targetId = (action as { type: "rollback"; versionId: string })
        .versionId;
      const target = job.versions.find((v) => v.id === targetId);
      if (!target) {
        return NextResponse.json(
          { error: "版本不存在" },
          { status: 404 },
        );
      }
      await store.updateJob(jobId, { currentVersion: target });
      return NextResponse.json({ success: true, version: target });
    }

    default:
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
