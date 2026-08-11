import { applyGenerationEvent } from "@/lib/generation/state-machine";
import type {
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationVersion,
} from "@/lib/generation/types";

export type MobileStudioPanel = "task" | "canvas" | "code";

export type StudioClientState = {
  activeJobId: string | null;
  snapshot: GenerationJobSnapshot | null;
  events: GenerationEvent[];
  connection: "idle" | "connecting" | "open" | "reconnecting" | "closed";
  editorCode: string;
  hasAuthoritativeCode: boolean;
  selectedVersionId: string | null;
  activeMobilePanel: MobileStudioPanel;
  isTakingOver: boolean;
  error: string | null;
};

export type StudioClientAction =
  | { type: "job.started"; snapshot: GenerationJobSnapshot }
  | { type: "snapshot.received"; jobId: string; snapshot: GenerationJobSnapshot }
  | { type: "event.received"; jobId: string; event: GenerationEvent }
  | { type: "connection.changed"; connection: StudioClientState["connection"] }
  | { type: "editor.changed"; code: string; authoritative?: boolean }
  | { type: "takeover.started" }
  | { type: "version.selected"; version: GenerationVersion }
  | { type: "mobile.selected"; panel: MobileStudioPanel }
  | { type: "error"; message: string | null };

export function createStudioClientState({
  initialCode,
  hasAuthoritativeCode,
  initialJobId = null,
}: {
  initialCode: string;
  hasAuthoritativeCode: boolean;
  initialJobId?: string | null;
}): StudioClientState {
  return {
    activeJobId: initialJobId,
    snapshot: null,
    events: [],
    connection: initialJobId ? "connecting" : "idle",
    editorCode: initialCode,
    hasAuthoritativeCode,
    selectedVersionId: null,
    activeMobilePanel: "canvas",
    isTakingOver: false,
    error: null,
  };
}

function applySnapshotCode(
  state: StudioClientState,
  snapshot: GenerationJobSnapshot,
): Pick<StudioClientState, "editorCode" | "hasAuthoritativeCode" | "selectedVersionId"> {
  if (state.isTakingOver || !snapshot.currentVersion) {
    return {
      editorCode: state.editorCode,
      hasAuthoritativeCode: state.hasAuthoritativeCode,
      selectedVersionId: state.selectedVersionId,
    };
  }
  return {
    editorCode: snapshot.currentVersion.code,
    hasAuthoritativeCode: true,
    selectedVersionId: snapshot.currentVersion.id,
  };
}

export function studioClientReducer(
  state: StudioClientState,
  action: StudioClientAction,
): StudioClientState {
  switch (action.type) {
    case "job.started":
      return {
        ...state,
        activeJobId: action.snapshot.id,
        snapshot: action.snapshot,
        events: [],
        connection: "connecting",
        isTakingOver: false,
        error: null,
        ...applySnapshotCode({ ...state, isTakingOver: false }, action.snapshot),
      };
    case "snapshot.received":
      if (action.jobId !== state.activeJobId) return state;
      return {
        ...state,
        snapshot: action.snapshot,
        ...applySnapshotCode(state, action.snapshot),
      };
    case "event.received": {
      if (
        action.jobId !== state.activeJobId ||
        action.event.jobId !== state.activeJobId ||
        state.events.some((event) => event.id === action.event.id) ||
        state.isTakingOver
      ) {
        return state;
      }
      const snapshot = state.snapshot
        ? applyGenerationEvent(state.snapshot, action.event)
        : action.event.type === "job.accepted"
          ? action.event.data.snapshot
          : null;
      const next = {
        ...state,
        snapshot,
        events: [...state.events, action.event].sort((a, b) => a.id - b.id),
        error:
          action.event.type === "job.failed" ? action.event.data.message : state.error,
      };
      if (action.event.type === "version.created") {
        return {
          ...next,
          editorCode: action.event.data.version.code,
          hasAuthoritativeCode: true,
          selectedVersionId: action.event.data.version.id,
        };
      }
      return next;
    }
    case "connection.changed":
      return { ...state, connection: action.connection };
    case "editor.changed":
      return {
        ...state,
        editorCode: action.code,
        hasAuthoritativeCode: action.authoritative ?? true,
        selectedVersionId: null,
      };
    case "takeover.started":
      return {
        ...state,
        isTakingOver: true,
        connection: "closed",
        error: null,
      };
    case "version.selected":
      return {
        ...state,
        editorCode: action.version.code,
        hasAuthoritativeCode: true,
        selectedVersionId: action.version.id,
        isTakingOver: false,
      };
    case "mobile.selected":
      return { ...state, activeMobilePanel: action.panel };
    case "error":
      return { ...state, error: action.message };
  }
}
