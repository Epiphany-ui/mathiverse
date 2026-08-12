import assert from "node:assert/strict";
import { describe, it } from "node:test";
// @ts-expect-error TS5097: Node's TypeScript test runner requires explicit extensions.
import { createStudioClientState, studioClientReducer, type StudioClientAction } from "./client-state.ts";

function makeInitial(overrides: Partial<Parameters<typeof createStudioClientState>[0]> = {}) {
  return createStudioClientState({
    initialCode: "from manim import *\n\nclass Test(Scene):\n    pass\n",
    hasAuthoritativeCode: false,
    initialJobId: null,
    ...overrides,
  });
}

describe("job.recovered", () => {
  it("sets activeJobId, connection: connecting, and clears error", () => {
    const state = makeInitial({ initialJobId: null });
    const action: StudioClientAction = { type: "job.recovered", jobId: "job-1" };
    const next = studioClientReducer(state, action);
    assert.equal(next.activeJobId, "job-1");
    assert.equal(next.connection, "connecting");
    assert.equal(next.error, null);
    assert.equal(next.isTakingOver, false);
  });

  it("is idempotent when the same activeJobId is already set", () => {
    const state = makeInitial({ initialJobId: "existing-job" });
    const next = studioClientReducer(state, { type: "job.recovered", jobId: "existing-job" });
    assert.equal(next.activeJobId, "existing-job");
    assert.equal(next.connection, "connecting"); // unchanged from createStudioClientState
  });

  it("replaces stale activeJobId with recovered one", () => {
    const state = makeInitial({ initialJobId: "old-job" });
    const next = studioClientReducer(state, { type: "job.recovered", jobId: "new-job" });
    assert.equal(next.activeJobId, "new-job");
    assert.equal(next.snapshot, null);
    assert.equal(next.events.length, 0);
    assert.equal(next.connection, "connecting");
  });

  it("does not overwrite snapshot or editor state", () => {
    const state = makeInitial({ initialJobId: null });
    const action: StudioClientAction = { type: "job.recovered", jobId: "job-1" };
    const next = studioClientReducer(state, action);
    assert.equal(next.snapshot, null);
    assert.equal(next.editorCode, state.editorCode);
    assert.equal(next.hasAuthoritativeCode, false);
  });
});

describe("snapshot.received after job.recovered", () => {
  it("populates snapshot after recovery", () => {
    const state = makeInitial({ initialJobId: null });
    // Simulate recovery sequence: job.recovered → snapshot.received
    const afterRecover = studioClientReducer(state, { type: "job.recovered", jobId: "job-1" });
    const snapshot = {
      id: "job-1",
      parentJobId: null,
      operation: "generate" as const,
      mode: "new" as const,
      status: "running" as const,
      phase: "generating" as const,
      prompt: "test",
      scenePlan: null,
      currentVersion: {
        id: "v1",
        sequence: 1,
        source: "generated" as const,
        code: "from manim import *\nclass Generated(Scene):\n    pass\n",
        validation: null,
        render: null,
        createdAt: new Date().toISOString(),
      },
      versions: [],
      validation: null,
      render: null,
      repairAttempt: 0 as const,
      runToken: 0,
      failureReason: null,
      cancelRequested: false,
      durability: "persistent" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = studioClientReducer(afterRecover, {
      type: "snapshot.received",
      jobId: "job-1",
      snapshot,
    });
    assert.equal(next.snapshot?.id, "job-1");
    assert.equal(next.editorCode, snapshot.currentVersion!.code);
    assert.equal(next.hasAuthoritativeCode, true);
    assert.equal(next.selectedVersionId, "v1");
  });

  it("ignores snapshot for a different jobId after recovery", () => {
    const state = makeInitial({ initialJobId: null });
    const afterRecover = studioClientReducer(state, { type: "job.recovered", jobId: "job-1" });
    const snapshot = {
      id: "job-2",
      parentJobId: null,
      operation: "generate" as const,
      mode: "new" as const,
      status: "running" as const,
      phase: "generating" as const,
      prompt: "test",
      scenePlan: null,
      currentVersion: null,
      versions: [],
      validation: null,
      render: null,
      repairAttempt: 0 as const,
      runToken: 0,
      failureReason: null,
      cancelRequested: false,
      durability: "persistent" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = studioClientReducer(afterRecover, {
      type: "snapshot.received",
      jobId: "job-2",
      snapshot,
    });
    assert.equal(next.snapshot, null); // ignored
    assert.equal(next.activeJobId, "job-1"); // unchanged
  });
});

describe("job.recovered after takeover", () => {
  it("replaces job even during takeover (recovery wins over stale state)", () => {
    let state = makeInitial({ initialJobId: "job-old" });
    state = studioClientReducer(state, { type: "takeover.started" });
    const next = studioClientReducer(state, { type: "job.recovered", jobId: "job-recovered" });
    assert.equal(next.activeJobId, "job-recovered"); // recovery replaces stale job
    assert.equal(next.isTakingOver, false); // recovery clears takeover
  });
});
