export const GENERATION_PHASES = [
  "queued",
  "planning",
  "retrieving",
  "generating",
  "validating",
  "rendering",
  "repairing",
] as const;

export type GenerationPhase = (typeof GENERATION_PHASES)[number];
export type GenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type GenerationMode = "new" | "edit" | "repair";
export type GenerationOperation =
  | "generate"
  | "render"
  | "repair"
  | "high_quality_render";
export type GenerationVersionSource =
  | "generated"
  | "auto_repair"
  | "manual"
  | "rollback";

export interface ScenePlan {
  objects: string[];
  layout: "2d" | "3d" | "formula" | "mixed";
  stages: Array<{ title: string; intent: string }>;
  trackers: string[];
  estimatedComplexity: "simple" | "standard" | "complex";
}

export interface ValidationIssue {
  code: "syntax" | "scene" | "security" | "api" | "render" | "timeout";
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  sceneName: string | null;
  issues: ValidationIssue[];
}

export interface RenderArtifact {
  url: string;
  format: "mp4" | "gif";
  quality: "-ql" | "-qm" | "-qh" | "-qk";
  duration: number | null;
  cacheHit: boolean;
  renderKey: string;
}

export interface GenerationVersion {
  id: string;
  sequence: number;
  source: GenerationVersionSource;
  code: string;
  validation: ValidationResult | null;
  render: RenderArtifact | null;
  createdAt: string;
}

export interface GenerationJobSnapshot {
  id: string;
  parentJobId: string | null;
  operation: GenerationOperation;
  mode: GenerationMode;
  status: GenerationStatus;
  phase: GenerationPhase;
  prompt: string;
  scenePlan: ScenePlan | null;
  currentVersion: GenerationVersion | null;
  versions: GenerationVersion[];
  validation: ValidationResult | null;
  render: RenderArtifact | null;
  repairAttempt: 0 | 1 | 2;
  runToken: number;
  failureReason: string | null;
  cancelRequested: boolean;
  durability: "persistent" | "session";
  createdAt: string;
  updatedAt: string;
}

export interface CreateGenerationJobInput {
  operation: GenerationOperation;
  mode: GenerationMode;
  prompt: string;
  currentCode: string | null;
  parentJobId: string | null;
  sourceVersionId?: string | null;
  renderError?: string | null;
  quality?: "-ql" | "-qm" | "-qh";
  format?: "mp4" | "gif";
}

export type GenerationAction =
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "take_over" }
  | { type: "save_manual_version"; code: string }
  | { type: "rollback"; versionId: string }
  | { type: "publish"; versionId: string };

type GenerationEventData = {
  "job.accepted": { snapshot: GenerationJobSnapshot };
  "phase.changed": { phase: GenerationPhase; label: string };
  "plan.ready": { plan: ScenePlan };
  "code.delta": { delta: string };
  "version.created": { version: GenerationVersion };
  "validation.completed": ValidationResult;
  "render.started": {
    requestId: string;
    quality: RenderArtifact["quality"];
    format: RenderArtifact["format"];
  };
  "render.completed": { artifact: RenderArtifact };
  "render.failed": { issues: ValidationIssue[]; retryable: boolean };
  "repair.started": { attempt: 1 | 2; maxAttempts: 2; reason: string };
  "job.completed": { versionId: string; render: RenderArtifact };
  "job.failed": { reason: string; message: string; retryable: boolean };
  "job.cancelled": { versionId: string | null };
};

export type GenerationEvent = {
  [Type in keyof GenerationEventData]: {
    id: number;
    jobId: string;
    createdAt: string;
    type: Type;
    data: GenerationEventData[Type];
  };
}[keyof GenerationEventData];

export type NewGenerationEvent = GenerationEvent extends infer Event
  ? Event extends GenerationEvent
    ? Omit<Event, "id" | "jobId" | "createdAt">
    : never
  : never;
