// POST /api/generation/jobs — create a new generation job
// GET /api/generation/jobs — list active jobs for the current owner

import { NextResponse } from "next/server";
import { resolveRequestOwner } from "@/lib/generation/request-owner";
import { validateCreateJobInput } from "@/lib/generation/request-validation";
import { ensureGenerationStarted } from "@/lib/generation/orchestrator";
import { getGenerationJobStore } from "@/lib/generation/job-store";
import { createRendererClient } from "@/lib/generation/renderer-client";

export async function POST(request: Request) {
  // Resolve owner
  const { owner, error } = await resolveRequestOwner();
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

  // Check for existing active job
  const store = getGenerationJobStore();
  const active = await store.getActiveJob(owner);
  if (active) {
    return NextResponse.json(
      {
        error: "已有正在进行的生成任务，请等待完成或取消后再提交。",
        activeJobId: active.id,
      },
      { status: 409 },
    );
  }

  // Persist acceptance first, then start bounded background work without
  // holding the HTTP response open for the generation pipeline.
  try {
    const renderer = createRendererClient();
    const job = await store.createJob(owner, result.input);
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
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
