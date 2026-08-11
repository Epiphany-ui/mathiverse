import type {
  CreateGenerationJobInput,
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationPhase,
  GenerationStatus,
  GenerationVersion,
} from "./types";

const ALLOWED_NEXT: Record<GenerationPhase, readonly GenerationPhase[]> = {
  queued: ["planning", "validating", "repairing", "rendering"],
  planning: ["retrieving"],
  retrieving: ["generating"],
  generating: ["validating"],
  validating: ["rendering", "repairing"],
  rendering: ["repairing"],
  repairing: ["validating"],
};

type InitialSnapshotInput = CreateGenerationJobInput & {
  id: string;
  durability: GenerationJobSnapshot["durability"];
};

export function createInitialSnapshot(
  input: InitialSnapshotInput,
): GenerationJobSnapshot {
  const now = new Date().toISOString();

  return {
    id: input.id,
    parentJobId: input.parentJobId,
    operation: input.operation,
    mode: input.mode,
    status: "queued",
    phase: "queued",
    prompt: input.prompt,
    scenePlan: null,
    currentVersion: null,
    versions: [],
    validation: null,
    render: null,
    repairAttempt: 0,
    runToken: 0,
    failureReason: null,
    cancelRequested: false,
    durability: input.durability,
    createdAt: now,
    updatedAt: now,
  };
}

export function assertPhaseTransition(
  current: GenerationPhase,
  next: GenerationPhase,
): void {
  if (!ALLOWED_NEXT[current].includes(next)) {
    throw new Error(`Illegal generation phase transition: ${current} -> ${next}`);
  }
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function replaceVersion(
  versions: GenerationVersion[],
  version: GenerationVersion,
): GenerationVersion[] {
  const index = versions.findIndex((candidate) => candidate.id === version.id);
  if (index === -1) {
    return [...versions, version];
  }

  return versions.map((candidate, candidateIndex) =>
    candidateIndex === index ? version : candidate,
  );
}

function assertNever(value: never): never {
  throw new Error(`Unhandled generation event: ${JSON.stringify(value)}`);
}

export function applyGenerationEvent(
  snapshot: GenerationJobSnapshot,
  event: GenerationEvent,
): GenerationJobSnapshot {
  switch (event.type) {
    case "job.accepted":
      return event.data.snapshot;
    case "phase.changed":
      assertPhaseTransition(snapshot.phase, event.data.phase);
      return {
        ...snapshot,
        phase: event.data.phase,
        status: "running",
        updatedAt: event.createdAt,
      };
    case "plan.ready":
      return { ...snapshot, scenePlan: event.data.plan, updatedAt: event.createdAt };
    case "code.delta":
      return { ...snapshot, updatedAt: event.createdAt };
    case "version.created":
      return {
        ...snapshot,
        currentVersion: event.data.version,
        versions: replaceVersion(snapshot.versions, event.data.version),
        validation: event.data.version.validation,
        render: event.data.version.render,
        updatedAt: event.createdAt,
      };
    case "validation.completed":
      return { ...snapshot, validation: event.data, updatedAt: event.createdAt };
    case "render.started":
      return { ...snapshot, updatedAt: event.createdAt };
    case "render.completed":
      return { ...snapshot, render: event.data.artifact, updatedAt: event.createdAt };
    case "render.failed":
      return { ...snapshot, updatedAt: event.createdAt };
    case "repair.started":
      return {
        ...snapshot,
        repairAttempt: event.data.attempt,
        updatedAt: event.createdAt,
      };
    case "job.completed":
      return {
        ...snapshot,
        status: "completed",
        currentVersion:
          snapshot.versions.find((version) => version.id === event.data.versionId) ??
          snapshot.currentVersion,
        render: event.data.render,
        updatedAt: event.createdAt,
      };
    case "job.failed":
      return {
        ...snapshot,
        status: "failed",
        failureReason: event.data.reason,
        updatedAt: event.createdAt,
      };
    case "job.cancelled":
      return {
        ...snapshot,
        status: "cancelled",
        currentVersion:
          snapshot.versions.find((version) => version.id === event.data.versionId) ??
          snapshot.currentVersion,
        updatedAt: event.createdAt,
      };
    default:
      return assertNever(event);
  }
}
