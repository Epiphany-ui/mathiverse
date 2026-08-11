import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getGenerationJobStore } from "./job-store";
import { MemoryGenerationJobStore } from "./memory-job-store";
import type { CreateGenerationJobInput, GenerationVersion } from "./types";

const ownerA = { kind: "anonymous", sessionHash: "hash-a" } as const;
const ownerB = { kind: "anonymous", sessionHash: "hash-b" } as const;
const input: CreateGenerationJobInput = {
  operation: "generate",
  mode: "new",
  prompt: "展示单位圆",
  currentCode: null,
  parentJobId: null,
};
const version: Omit<GenerationVersion, "id" | "sequence" | "createdAt"> = {
  source: "generated",
  code: "from manim import *\nclass UnitCircle(Scene):\n    pass\n",
  validation: null,
  render: null,
};

describe("MemoryGenerationJobStore", () => {
  it("isolates owners and replays strictly after the cursor", async () => {
    const store = new MemoryGenerationJobStore();
    const job = await store.createJob(ownerA, input);
    await store.appendEvent(job.id, {
      type: "phase.changed",
      data: { phase: "planning", label: "规划场景" },
    });
    const second = await store.appendEvent(job.id, {
      type: "plan.ready",
      data: {
        plan: {
          objects: ["Circle"],
          layout: "2d",
          stages: [{ title: "建立场景", intent: "显示单位圆" }],
          trackers: [],
          estimatedComplexity: "simple",
        },
      },
    });
    assert.equal(await store.getJob(ownerB, job.id), null);
    assert.deepEqual(
      (await store.listEvents(ownerA, job.id, second.id - 1)).map((event) => event.id),
      [second.id],
    );
  });

  it("persists versions with per-job monotonic sequences", async () => {
    const store = new MemoryGenerationJobStore();
    const job = await store.createJob(ownerA, input);
    await store.saveVersion(job.id, version);
    const second = await store.saveVersion(job.id, {
      ...version,
      code: version.code + "# second\n",
    });
    const saved = await store.getJob(ownerA, job.id);
    assert.deepEqual(saved?.versions.map((item) => item.sequence), [1, 2]);
    assert.equal(saved?.currentVersion?.id, second.id);
  });

  it("rejects unknown jobs and shares one process-wide fallback", async () => {
    const store = new MemoryGenerationJobStore();
    await assert.rejects(() => store.saveVersion("missing", version), /not found/i);
    assert.equal(getGenerationJobStore(), getGenerationJobStore());
  });
});
