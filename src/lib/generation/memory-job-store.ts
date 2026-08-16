import { randomUUID } from "node:crypto";
import type {
  CreateGenerationJobInput,
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationVersion,
  NewGenerationEvent,
} from "./types";
import { createInitialSnapshot } from "./state-machine";
import type { GenerationOwner } from "./job-store";
import { GenerationStoreError } from "./store-error";
import type { GenerationJobStore } from "./job-store";

export class MemoryGenerationJobStore implements GenerationJobStore {
  readonly durability = "session" as const;

  private jobs = new Map<string, GenerationJobSnapshot>();
  private events = new Map<string, GenerationEvent[]>();
  private ownerIndex = new Map<string, Set<string>>(); // ownerKey -> jobIds
  private eventSeq = 0;

  // ─── Helpers ─────────────────────────────────────────────────

  private ownerKey(owner: GenerationOwner): string {
    return `${owner.kind}:${owner.kind === "user" ? owner.userId : owner.sessionHash}`;
  }

  private checkOwner(owner: GenerationOwner, jobId: string): boolean {
    const key = this.ownerKey(owner);
    const owned = this.ownerIndex.get(key);
    return owned?.has(jobId) ?? false;
  }

  // ─── Public API ──────────────────────────────────────────────

  async createJob(
    owner: GenerationOwner,
    input: CreateGenerationJobInput,
  ): Promise<GenerationJobSnapshot> {
    const id = randomUUID();
    const snapshot = createInitialSnapshot({
      id,
      operation: input.operation,
      mode: input.mode,
      prompt: input.prompt,
      currentCode: input.currentCode,
      parentJobId: input.parentJobId,
      durability: "session",
    });

    this.jobs.set(id, snapshot);
    this.events.set(id, []);

    const key = this.ownerKey(owner);
    if (!this.ownerIndex.has(key)) {
      this.ownerIndex.set(key, new Set());
    }
    this.ownerIndex.get(key)!.add(id);

    return snapshot;
  }

  async getJob(
    owner: GenerationOwner,
    jobId: string,
  ): Promise<GenerationJobSnapshot | null> {
    if (!this.checkOwner(owner, jobId)) return null;
    return this.jobs.get(jobId) ?? null;
  }

  async getActiveJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null> {
    const key = this.ownerKey(owner);
    const owned = this.ownerIndex.get(key);
    if (!owned) return null;

    for (const id of owned) {
      const job = this.jobs.get(id);
      if (job && (job.status === "queued" || job.status === "running")) {
        return job;
      }
    }
    return null;
  }

  async getMostRecentJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null> {
    const key = this.ownerKey(owner);
    const owned = this.ownerIndex.get(key);
    if (!owned) return null;

    let mostRecent: GenerationJobSnapshot | null = null;
    for (const id of owned) {
      const job = this.jobs.get(id);
      if (
        job &&
        (!mostRecent || job.updatedAt > mostRecent.updatedAt)
      ) {
        mostRecent = job;
      }
    }
    return mostRecent;
  }

  async getJobById(jobId: string): Promise<GenerationJobSnapshot | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async updateJob(
    jobId: string,
    patch: Partial<
      Pick<
        GenerationJobSnapshot,
        | "status"
        | "phase"
        | "scenePlan"
        | "currentVersion"
        | "validation"
        | "render"
        | "repairAttempt"
        | "runToken"
        | "failureReason"
        | "cancelRequested"
      >
    >,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new GenerationStoreError("Job not found", 404);
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  }

  async updateJobIfCurrent(
    jobId: string,
    expectedRunToken: number,
    patch: Parameters<GenerationJobStore["updateJob"]>[1],
  ): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.runToken !== expectedRunToken) return false;
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    return true;
  }

  async saveVersion(
    jobId: string,
    version: Omit<GenerationVersion, "id" | "sequence" | "createdAt">,
  ): Promise<GenerationVersion> {
    const job = this.jobs.get(jobId);
    if (!job) throw new GenerationStoreError("Job not found", 404);
    const saved = {
      id: randomUUID(),
      sequence: job.versions.length + 1,
      ...version,
      createdAt: new Date().toISOString(),
    };
    job.versions.push(saved);
    job.currentVersion = saved;
    job.validation = saved.validation;
    job.render = saved.render;
    job.updatedAt = saved.createdAt;
    return saved;
  }

  async updateVersion(
    jobId: string,
    versionId: string,
    patch: Partial<Pick<GenerationVersion, "validation" | "render">>,
  ): Promise<GenerationVersion> {
    const job = this.jobs.get(jobId);
    if (!job) throw new GenerationStoreError("Job not found", 404);
    const idx = job.versions.findIndex((version) => version.id === versionId);
    if (idx >= 0) {
      const updated = { ...job.versions[idx], ...patch };
      job.versions[idx] = updated;
      if (job.currentVersion?.id === versionId) {
        job.currentVersion = updated;
        job.validation = updated.validation;
        job.render = updated.render;
      }
      job.updatedAt = new Date().toISOString();
      return updated;
    }
    throw new GenerationStoreError("Version not found", 404);
  }

  async appendEvent(
    jobId: string,
    event: NewGenerationEvent,
  ): Promise<GenerationEvent> {
    const jobEvents = this.events.get(jobId);
    if (!jobEvents) throw new GenerationStoreError("Job not found", 404);

    this.eventSeq++;
    const full: GenerationEvent = {
      id: this.eventSeq,
      jobId,
      createdAt: new Date().toISOString(),
      ...event,
    } as GenerationEvent;

    jobEvents.push(full);
    return full;
  }

  async listEvents(
    owner: GenerationOwner,
    jobId: string,
    afterId: number,
  ): Promise<GenerationEvent[]> {
    if (!this.checkOwner(owner, jobId)) return [];
    const jobEvents = this.events.get(jobId);
    if (!jobEvents) return [];
    return jobEvents.filter((e) => e.id > afterId);
  }

  async markInterruptedJobs(): Promise<number> {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.status === "queued" || job.status === "running") {
        job.status = "failed";
        job.failureReason = "interrupted";
        job.cancelRequested = false;
        count++;
      }
    }
    return count;
  }
}
