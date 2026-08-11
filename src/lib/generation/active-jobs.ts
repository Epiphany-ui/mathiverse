// In-process registry of active generation promises.
// Uses Symbol.for on globalThis for hot-reload safety.

export type ActiveJob = {
  promise: Promise<void>;
  controller: AbortController;
  runToken: number;
  startedAt: number;
};

const ACTIVE_JOBS_KEY = Symbol.for("mathiverse.generation.activeJobs");

type ActiveJobsRegistry = Map<string, ActiveJob>;

/**
 * Read (or lazily create) the process-wide registry of active generation jobs.
 * Symbol.for makes the key stable across HMR reloads of this module, so a
 * reloaded copy of the orchestrator still sees in-flight jobs.
 */
export function getActiveJobs(): ActiveJobsRegistry {
  const holder = globalThis as unknown as Record<
    typeof ACTIVE_JOBS_KEY,
    ActiveJobsRegistry | undefined
  >;
  if (!holder[ACTIVE_JOBS_KEY]) {
    holder[ACTIVE_JOBS_KEY] = new Map();
  }
  return holder[ACTIVE_JOBS_KEY]!;
}

/**
 * Abort the in-flight work for a job. Returns false when the job is not
 * running in this process (e.g. it belongs to a different worker instance).
 */
export async function cancelActiveGeneration(jobId: string): Promise<boolean> {
  const entry = getActiveJobs().get(jobId);
  if (!entry) return false;
  entry.controller.abort();
  return true;
}
