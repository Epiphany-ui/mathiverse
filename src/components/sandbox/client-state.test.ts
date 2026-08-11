import assert from "node:assert/strict";
import test from "node:test";
import { createStudioClientState, studioClientReducer } from "./client-state";
import { createInitialSnapshot } from "@/lib/generation/state-machine";
import type { GenerationEvent, GenerationVersion } from "@/lib/generation/types";

const version: GenerationVersion = {
  id: "v1", sequence: 1, source: "generated", code: "generated",
  validation: null, render: null, createdAt: "2026-01-01T00:00:00Z",
};
const job = (id: string) => createInitialSnapshot({
  id, operation: "generate", mode: "new", prompt: "p", currentCode: null,
  parentJobId: null, durability: "session",
});
const created = (jobId: string, id = 1): GenerationEvent => ({
  id, jobId, type: "version.created", createdAt: "2026-01-01T00:00:01Z", data: { version },
});

test("deduplicates event IDs and keeps panel across snapshots", () => {
  let state = createStudioClientState({ initialCode: "placeholder", hasAuthoritativeCode: false });
  state = studioClientReducer(state, { type: "mobile.selected", panel: "code" });
  state = studioClientReducer(state, { type: "job.started", snapshot: job("A") });
  state = studioClientReducer(state, { type: "event.received", jobId: "A", event: created("A") });
  state = studioClientReducer(state, { type: "event.received", jobId: "A", event: created("A") });
  state = studioClientReducer(state, { type: "snapshot.received", jobId: "A", snapshot: { ...job("A"), currentVersion: version } });
  assert.equal(state.events.length, 1);
  assert.equal(state.activeMobilePanel, "code");
  assert.equal(state.editorCode, "generated");
});

test("takeover and a new job reject late events from the old job", () => {
  let state = createStudioClientState({ initialCode: "manual", hasAuthoritativeCode: true });
  state = studioClientReducer(state, { type: "job.started", snapshot: job("A") });
  state = studioClientReducer(state, { type: "takeover.started" });
  state = studioClientReducer(state, { type: "editor.changed", code: "mine" });
  state = studioClientReducer(state, { type: "event.received", jobId: "A", event: created("A") });
  assert.equal(state.editorCode, "mine");
  state = studioClientReducer(state, { type: "job.started", snapshot: job("B") });
  state = studioClientReducer(state, { type: "event.received", jobId: "A", event: created("A", 2) });
  assert.equal(state.activeJobId, "B");
  assert.equal(state.editorCode, "mine");
});

test("selecting a rollback version makes code authoritative", () => {
  const state = studioClientReducer(
    createStudioClientState({ initialCode: "placeholder", hasAuthoritativeCode: false }),
    { type: "version.selected", version },
  );
  assert.equal(state.selectedVersionId, "v1");
  assert.equal(state.hasAuthoritativeCode, true);
});
