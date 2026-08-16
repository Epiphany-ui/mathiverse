import type {
  CreateGenerationJobInput,
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationVersion,
  NewGenerationEvent,
} from "./types";
import { getAdminClient } from "@/lib/supabase/admin";
import { MemoryGenerationJobStore } from "./memory-job-store";
import { SupabaseGenerationJobStore } from "./supabase-job-store";
export { GenerationStoreError } from "./store-error";

// ─── Owner ─────────────────────────────────────────────────────

export type GenerationOwner =
  | { kind: "user"; userId: string }
  | { kind: "anonymous"; sessionHash: string };

// ─── Store Interface ───────────────────────────────────────────

export interface GenerationJobStore {
  readonly durability: "persistent" | "session";

  createJob(
    owner: GenerationOwner,
    input: CreateGenerationJobInput,
  ): Promise<GenerationJobSnapshot>;

  getJob(
    owner: GenerationOwner,
    jobId: string,
  ): Promise<GenerationJobSnapshot | null>;

  getActiveJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null>;

  /** Return the owner's most recent job regardless of status.
   *  Used for auto-recovery when no active (queued/running) job exists. */
  getMostRecentJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null>;

  /** Server-internal: load a job by ID without owner check. */
  getJobById(jobId: string): Promise<GenerationJobSnapshot | null>;

  updateJob(
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
  ): Promise<void>;

  /** Apply a patch only when the job's runToken still matches.  Returns
   *  false (and writes nothing) when the job was superseded — terminal
   *  writes use this so a cancel can never be overwritten by a finishing
   *  pipeline. */
  updateJobIfCurrent(
    jobId: string,
    expectedRunToken: number,
    patch: Parameters<GenerationJobStore["updateJob"]>[1],
  ): Promise<boolean>;

  saveVersion(
    jobId: string,
    version: Omit<GenerationVersion, "id" | "sequence" | "createdAt">,
  ): Promise<GenerationVersion>;

  updateVersion(
    jobId: string,
    versionId: string,
    patch: Partial<Pick<GenerationVersion, "validation" | "render">>,
  ): Promise<GenerationVersion>;

  appendEvent(
    jobId: string,
    event: NewGenerationEvent,
  ): Promise<GenerationEvent>;

  listEvents(
    owner: GenerationOwner,
    jobId: string,
    afterId: number,
  ): Promise<GenerationEvent[]>;

  markInterruptedJobs(): Promise<number>;
}

const STORE_KEY = Symbol.for("mathiverse.generation.job-store");

export function getGenerationJobStore(): GenerationJobStore {
  const processGlobal = globalThis as unknown as Record<symbol, unknown>;
  const existing = processGlobal[STORE_KEY];
  if (existing) return existing as GenerationJobStore;
  const adminClient = getAdminClient();
  const store: GenerationJobStore = adminClient
    ? new SupabaseGenerationJobStore(adminClient)
    : new MemoryGenerationJobStore();
  processGlobal[STORE_KEY] = store;
  return store;
}
