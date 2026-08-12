// Typed client for the local Manim renderer (FastAPI on http://127.0.0.1:9876).
// Wraps /validate, /render, and DELETE /render/{requestId}.

import type {
  RenderArtifact,
  ValidationIssue,
  ValidationResult,
} from "./types";

const VALIDATE_TIMEOUT_MS = 10_000;
const RENDER_TIMEOUT_MS = 130_000;
const DEFAULT_BASE_URL = "http://127.0.0.1:9876";

export interface RendererClient {
  validateManim(code: string, signal?: AbortSignal): Promise<ValidationResult>;
  renderManim(input: {
    code: string;
    quality: "-ql" | "-qm" | "-qh";
    format: "mp4" | "gif";
    requestId: string;
    signal?: AbortSignal;
  }): Promise<RenderArtifact>;
  cancelManimRender(requestId: string): Promise<boolean>;
}

export class RendererError extends Error {
  status: number;
  issues: ValidationIssue[];
  retryable: boolean;

  constructor(
    status: number,
    message: string,
    issues: ValidationIssue[] = [],
    retryable?: boolean,
  ) {
    super(message);
    this.name = "RendererError";
    this.status = status;
    this.issues = issues;
    this.retryable = retryable ?? isRetryable(status);
  }
}

// ─── Raw wire shapes (snake_case from the Python renderer) ──────────────

interface RawValidationIssue {
  code: string;
  message: string;
  line?: number;
  column?: number;
}

interface RawValidationResponse {
  valid: boolean;
  scene_name: string | null;
  issues: RawValidationIssue[];
}

interface RawRenderResponse {
  success: boolean;
  video_url: string | null;
  gif_url: string | null;
  poster_url: string | null;
  duration: number | null;
  error: string | null;
  diagnostics: RawValidationIssue[];
  scene_name: string | null;
  render_key: string | null;
  cache_hit: boolean;
}

function toValidationIssue(raw: RawValidationIssue): ValidationIssue {
  const issue: ValidationIssue = {
    code: (raw.code as ValidationIssue["code"]) || "render",
    message: raw.message,
  };
  if (raw.line !== undefined) issue.line = raw.line;
  if (raw.column !== undefined) issue.column = raw.column;
  return issue;
}

function isRetryable(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function composeSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timeout", "TimeoutError")),
    timeoutMs,
  );

  const cleanup = () => clearTimeout(timeout);

  if (signal) {
    if (signal.aborted) {
      cleanup();
      return { signal, cleanup: () => {} };
    }
    const onAbort = () => {
      cleanup();
      controller.abort(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return {
      signal: controller.signal,
      cleanup: () => {
        cleanup();
        signal.removeEventListener("abort", onAbort);
      },
    };
  }

  return { signal: controller.signal, cleanup };
}

async function parseErrorResponse(
  res: Response,
): Promise<{ message: string; issues: ValidationIssue[] }> {
  let message = res.statusText || "Renderer request failed";
  let issues: ValidationIssue[] = [];
  try {
    const body = (await res.json()) as {
      error?: string;
      diagnostics?: RawValidationIssue[];
    };
    if (typeof body.error === "string" && body.error.length > 0) {
      message = body.error;
    }
    if (Array.isArray(body.diagnostics)) {
      issues = body.diagnostics.map(toValidationIssue);
    }
  } catch {
    // Non-JSON body; fall back to status text.
  }
  return { message, issues };
}

function throwFetchError(err: unknown): never {
  if (err instanceof Error && err.name === "AbortError") {
    throw err;
  }
  const message =
    err instanceof Error
      ? err.message
      : "Failed to reach the local renderer";
  throw new RendererError(0, message, [], true);
}

export function createRendererClient(options?: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): RendererClient {
  const baseUrl = (
    options?.baseUrl ??
    process.env.RENDERER_URL ??
    process.env.NEXT_PUBLIC_RENDERER_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;

  return {
    async validateManim(code: string, signal?: AbortSignal) {
      const composed = composeSignal(signal, VALIDATE_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          signal: composed.signal,
        });
      } catch (err) {
        throwFetchError(err);
      } finally {
        composed.cleanup();
      }

      if (!res.ok) {
        const { message, issues } = await parseErrorResponse(res);
        throw new RendererError(
          res.status,
          message,
          issues,
          isRetryable(res.status),
        );
      }

      const data = (await res.json()) as RawValidationResponse;
      const issues = (data.issues ?? []).map(toValidationIssue);

      if (!data.valid) {
        const message = issues[0]?.message ?? "Validation failed";
        throw new RendererError(422, message, issues, false);
      }

      return {
        valid: true,
        sceneName: data.scene_name ?? null,
        issues,
      };
    },

    async renderManim({ code, quality, format, requestId, signal }) {
      const composed = composeSignal(signal, RENDER_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchImpl(`${baseUrl}/render`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            quality,
            format,
            request_id: requestId,
          }),
          signal: composed.signal,
        });
      } catch (err) {
        throwFetchError(err);
      } finally {
        composed.cleanup();
      }

      if (!res.ok) {
        const { message, issues } = await parseErrorResponse(res);
        throw new RendererError(
          res.status,
          message,
          issues,
          isRetryable(res.status),
        );
      }

      const data = (await res.json()) as RawRenderResponse;
      const issues = (data.diagnostics ?? []).map(toValidationIssue);

      if (!data.success) {
        const message = data.error ?? issues[0]?.message ?? "Render failed";
        throw new RendererError(422, message, issues, false);
      }

      return {
        url: data.video_url ?? data.gif_url ?? "",
        posterUrl: data.poster_url ?? null,
        format,
        quality,
        duration: data.duration ?? null,
        cacheHit: data.cache_hit ?? false,
        renderKey: data.render_key ?? "",
      };
    },

    async cancelManimRender(requestId: string): Promise<boolean> {
      let res: Response;
      try {
        res = await fetchImpl(
          `${baseUrl}/render/${encodeURIComponent(requestId)}`,
          { method: "DELETE" },
        );
      } catch {
        return false;
      }
      if (!res.ok) {
        return false;
      }
      try {
        const body = (await res.json()) as { cancelled?: boolean };
        return body.cancelled ?? true;
      } catch {
        return true;
      }
    },
  };
}
