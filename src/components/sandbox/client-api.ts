import type {
  CreateGenerationJobInput,
  GenerationAction,
  GenerationJobSnapshot,
  GenerationVersion,
} from "@/lib/generation/types";

export class GenerationClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "GenerationClientError";
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const message = typeof record?.error === "string"
      ? record.error
      : Array.isArray(record?.errors)
        ? String((record?.errors[0] as { message?: unknown })?.message ?? "请求失败")
        : `请求失败（${response.status}）`;
    throw new GenerationClientError(message, response.status, body);
  }
  return body as T;
}

export async function createGenerationJob(input: CreateGenerationJobInput) {
  return readJson<{ jobId: string; status: "accepted"; snapshot: GenerationJobSnapshot }>(
    await fetch("/api/generation/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function getGenerationJob(jobId: string) {
  return readJson<GenerationJobSnapshot>(
    await fetch(`/api/generation/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }),
  );
}

export async function patchGenerationJob(jobId: string, action: GenerationAction) {
  return readJson<{ success: true; version?: GenerationVersion; message?: string }>(
    await fetch(`/api/generation/jobs/${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    }),
  );
}
