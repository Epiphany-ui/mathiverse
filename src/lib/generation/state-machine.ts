import type {
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationPhase,
  GenerationStatus,
  GenerationVersion,
} from "./types";

// ─── Legal Phase Transitions ───────────────────────────────────

const ALLOWED_NEXT: Record<GenerationPhase, readonly GenerationPhase[]> = {
  queued: ["planning", "validating", "repairing", "rendering"],
  planning: ["retrieving"],
  retrieving: ["generating"],
  generating: ["validating"],
  validating: ["rendering", "repairing"],
  rendering: ["repairing"],
  repairing: ["validating"],
};

export function assertPhaseTransition(
  current: GenerationPhase,
  next: GenerationPhase,
): void {
  if (!ALLOWED_NEXT[current].includes(next)) {
    throw new Error(
      `Illegal generation phase transition: ${current} -> ${next}`,
    );
  }
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

// ─── Snapshot Factory ──────────────────────────────────────────

interface CreateSnapshotParams {
  id: string;
  operation: GenerationJobSnapshot["operation"];
  mode: GenerationJobSnapshot["mode"];
  prompt: string;
  currentCode: string | null;
  parentJobId: string | null;
  durability: "persistent" | "session";
}

export function createInitialSnapshot(
  params: CreateSnapshotParams,
): GenerationJobSnapshot {
  const now = new Date().toISOString();
  return {
    id: params.id,
    parentJobId: params.parentJobId,
    operation: params.operation,
    mode: params.mode,
    status: "queued",
    phase: "queued",
    prompt: params.prompt,
    scenePlan: null,
    currentVersion: null,
    versions: [],
    validation: null,
    render: null,
    repairAttempt: 0,
    runToken: 0,
    failureReason: null,
    cancelRequested: false,
    durability: params.durability,
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Event Reducer ─────────────────────────────────────────────

/**
 * Pure reducer: apply a GenerationEvent to a snapshot, returning a new snapshot.
 * Exhaustive over all event types. Never adds a percentage field.
 */
export function applyGenerationEvent(
  snapshot: GenerationJobSnapshot,
  event: GenerationEvent,
): GenerationJobSnapshot {
  const next = { ...snapshot, updatedAt: event.createdAt };

  switch (event.type) {
    case "job.accepted":
      return event.data.snapshot;

    case "phase.changed": {
      assertPhaseTransition(snapshot.phase, event.data.phase);
      next.phase = event.data.phase;
      next.status = "running";
      return next;
    }

    case "plan.ready": {
      next.scenePlan = event.data.plan;
      return next;
    }

    case "code.delta": {
      // code_delta updates editor draft only; does not create a version
      return next;
    }

    case "version.created": {
      const v = event.data.version;
      // Replace version with same ID rather than duplicate
      const existingIdx = next.versions.findIndex((x) => x.id === v.id);
      if (existingIdx >= 0) {
        next.versions = [
          ...next.versions.slice(0, existingIdx),
          v,
          ...next.versions.slice(existingIdx + 1),
        ];
      } else {
        next.versions = [...next.versions, v];
      }
      next.currentVersion = v;
      next.validation = v.validation;
      next.render = v.render;
      return next;
    }

    case "validation.completed": {
      next.validation = event.data;
      return next;
    }

    case "render.started": {
      // render.started is informational; no state change
      return next;
    }

    case "render.completed": {
      next.render = event.data.artifact;
      if (next.currentVersion) {
        const v = next.currentVersion;
        const updated: GenerationVersion = {
          ...v,
          render: event.data.artifact,
        };
        next.currentVersion = updated;
        next.versions = next.versions.map((x) =>
          x.id === v.id ? updated : x,
        );
      }
      return next;
    }

    case "render.failed": {
      // failure info is in the event; mark validation with render issues
      next.validation = {
        valid: false,
        sceneName: next.validation?.sceneName ?? null,
        issues: [
          ...(next.validation?.issues ?? []),
          ...event.data.issues,
        ],
      };
      return next;
    }

    case "repair.started": {
      next.repairAttempt = event.data.attempt;
      return next;
    }

    case "job.completed": {
      next.status = "completed";
      next.currentVersion =
        snapshot.versions.find((version) => version.id === event.data.versionId) ??
        snapshot.currentVersion;
      next.render = event.data.render;
      return next;
    }

    case "job.failed": {
      next.status = "failed";
      next.failureReason = event.data.reason;
      return next;
    }

    case "job.cancelled": {
      next.status = "cancelled";
      next.currentVersion =
        snapshot.versions.find((version) => version.id === event.data.versionId) ??
        snapshot.currentVersion;
      return next;
    }

    default: {
      // Exhaustiveness check — should never reach
      const _exhaustive: never = event;
      throw new Error("Unhandled generation event: " + JSON.stringify(_exhaustive));
    }
  }
}
