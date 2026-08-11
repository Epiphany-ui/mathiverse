// Input validation for generation API requests.

import type { CreateGenerationJobInput, GenerationAction } from "./types";

const MAX_PROMPT_LENGTH = 8_000;
const MAX_CODE_LENGTH = 50_000;

const VALID_OPERATIONS = ["generate", "render", "repair", "high_quality_render"];
const VALID_MODES = ["new", "edit", "repair"];
const VALID_QUALITIES = ["-ql", "-qm", "-qh"];
const VALID_FORMATS = ["mp4", "gif"];

export interface ValidationErrors {
  errors: Array<{ field: string; message: string }>;
}

export function validateCreateJobInput(
  body: unknown,
): { input: CreateGenerationJobInput } | ValidationErrors {
  const errors: ValidationErrors["errors"] = [];

  if (!body || typeof body !== "object") {
    return { errors: [{ field: "body", message: "请求体必须是 JSON 对象" }] };
  }

  const b = body as Record<string, unknown>;

  // operation
  const operation = String(b.operation ?? "");
  if (!VALID_OPERATIONS.includes(operation)) {
    errors.push({
      field: "operation",
      message: `operation 必须是 ${VALID_OPERATIONS.join(" | ")}，收到: ${operation}`,
    });
  }

  // mode
  const mode = String(b.mode ?? "");
  if (!VALID_MODES.includes(mode)) {
    errors.push({
      field: "mode",
      message: `mode 必须是 ${VALID_MODES.join(" | ")}，收到: ${mode}`,
    });
  }

  // prompt
  const prompt = String(b.prompt ?? "").trim();
  if (operation === "generate" && prompt.length === 0) {
    errors.push({ field: "prompt", message: "prompt 不能为空" });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    errors.push({
      field: "prompt",
      message: `prompt 不能超过 ${MAX_PROMPT_LENGTH} 字符`,
    });
  }

  // currentCode
  const currentCode = b.currentCode !== undefined && b.currentCode !== null
    ? String(b.currentCode)
    : null;
  const codeRequiredOps = ["render", "repair", "high_quality_render"];
  if (codeRequiredOps.includes(operation) && !currentCode) {
    errors.push({
      field: "currentCode",
      message: `${operation} 操作需要提供 currentCode`,
    });
  }
  if (currentCode && currentCode.length > MAX_CODE_LENGTH) {
    errors.push({
      field: "currentCode",
      message: `currentCode 不能超过 ${MAX_CODE_LENGTH} 字符`,
    });
  }

  // quality
  const quality = b.quality ? String(b.quality) : undefined;
  if (quality && !VALID_QUALITIES.includes(quality)) {
    errors.push({
      field: "quality",
      message: `quality 必须是 ${VALID_QUALITIES.join(" | ")}`,
    });
  }

  // format
  const format = b.format ? String(b.format) : undefined;
  if (format && !VALID_FORMATS.includes(format)) {
    errors.push({
      field: "format",
      message: `format 必须是 ${VALID_FORMATS.join(" | ")}`,
    });
  }

  if (errors.length > 0) return { errors };

  return {
    input: {
      operation: operation as CreateGenerationJobInput["operation"],
      mode: mode as CreateGenerationJobInput["mode"],
      prompt,
      currentCode,
      parentJobId: b.parentJobId ? String(b.parentJobId) : null,
      sourceVersionId: b.sourceVersionId
        ? String(b.sourceVersionId)
        : undefined,
      renderError: b.renderError ? String(b.renderError) : undefined,
      quality: quality as CreateGenerationJobInput["quality"],
      format: format as CreateGenerationJobInput["format"],
    },
  };
}

export function validatePatchAction(
  body: unknown,
): { action: GenerationAction } | ValidationErrors {
  if (!body || typeof body !== "object") {
    return { errors: [{ field: "body", message: "请求体必须是 JSON 对象" }] };
  }

  const b = body as Record<string, unknown>;
  const type = String(b.type ?? "");

  const validActions = [
    "cancel",
    "retry",
    "take_over",
    "save_manual_version",
    "rollback",
    "publish",
  ];

  if (!validActions.includes(type)) {
    return {
      errors: [
        {
          field: "type",
          message: `action type 必须是 ${validActions.join(" | ")}`,
        },
      ],
    };
  }

  const action: GenerationAction = { type } as GenerationAction;

  if (type === "save_manual_version" && typeof b.code !== "string") {
    return {
      errors: [
        { field: "code", message: `${type} 操作需要提供 code` },
      ],
    };
  }

  if (type === "save_manual_version" && typeof b.code === "string") {
    (action as { type: "save_manual_version"; code: string }).code = b.code;
  }

  if (type === "rollback" || type === "publish") {
    if (typeof b.versionId !== "string") {
      return {
        errors: [
          { field: "versionId", message: `${type} 操作需要提供 versionId` },
        ],
      };
    }
    if (type === "rollback") {
      (action as { type: "rollback"; versionId: string }).versionId =
        b.versionId;
    }
    if (type === "publish") {
      (action as { type: "publish"; versionId: string }).versionId =
        b.versionId;
    }
  }

  return { action };
}
