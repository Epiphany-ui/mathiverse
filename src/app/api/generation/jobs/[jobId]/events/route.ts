// GET /api/generation/jobs/[jobId]/events — SSE stream of generation events

import { NextResponse } from "next/server";
import { resolveRequestOwner } from "@/lib/generation/request-owner";
import { getGenerationJobStore } from "@/lib/generation/job-store";
import { parseEventCursor, serializeSseEvent, sseHeaders } from "@/lib/generation/sse";
import { isTerminalStatus } from "@/lib/generation/state-machine";
import { ensureGenerationStarted } from "@/lib/generation/orchestrator";
import { createRendererClient } from "@/lib/generation/renderer-client";

const POLL_INTERVAL_MS = 500;
const HEARTBEAT_MS = 10_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

export async function GET(
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

  // Verify ownership
  const job = await store.getJob(owner, jobId);
  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  // Start/recover the generation pipeline
  const renderer = createRendererClient();
  ensureGenerationStarted(jobId, { store, renderer }).catch(() => {
    // Background errors are surfaced through events
  });

  const cursor = parseEventCursor(request);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const abortController = new AbortController();
      let lastEventId = cursor;

      // Clean up on abort
      const onRequestAbort = () => {
        abortController.abort();
      };
      request.signal.addEventListener("abort", onRequestAbort, { once: true });

      const send = (data: string) => {
        controller.enqueue(encoder.encode(data));
      };

      let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;

      const poll = async () => {
        try {
          const events = (await store.listEvents(owner, jobId, lastEventId))
            .filter((event) => event.id > lastEventId)
            .sort((a, b) => a.id - b.id);
          for (const event of events) {
            send(serializeSseEvent(event));
            lastEventId = event.id;
          }
          const latest = await store.getJob(owner, jobId);
          if (!latest || isTerminalStatus(latest.status)) abortController.abort();
        } catch {
          // Reconnect hint
          send(": retry\n\n");
        }
      };

      const scheduleHeartbeat = () => {
        heartbeatTimer = setTimeout(() => {
          send(": heartbeat\n\n");
          scheduleHeartbeat();
        }, HEARTBEAT_MS);
      };

      try {
        scheduleHeartbeat();

        while (!abortController.signal.aborted) {
          await poll();
          await new Promise<void>((resolve) => {
            const id = setTimeout(resolve, POLL_INTERVAL_MS);
            abortController.signal.addEventListener(
              "abort",
              () => {
                clearTimeout(id);
                resolve();
              },
              { once: true },
            );
          });
        }
      } catch {
        // Stream closed
      } finally {
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        request.signal.removeEventListener("abort", onRequestAbort);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: sseHeaders(),
  });
}
