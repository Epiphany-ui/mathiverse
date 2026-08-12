import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerationJobStore, GenerationOwner } from "./job-store";
import { GenerationStoreError } from "./store-error";
import type {
  CreateGenerationJobInput,
  GenerationEvent,
  GenerationJobSnapshot,
  GenerationVersion,
  NewGenerationEvent,
} from "./types";

type DbRow = Record<string, unknown>;

export class SupabaseGenerationJobStore implements GenerationJobStore {
  readonly durability = "persistent" as const;

  constructor(private readonly client: SupabaseClient) {}

  private fail(operation: string, error: unknown): never {
    console.error(`[generation/store] ${operation} failed`, error);
    throw new GenerationStoreError("Generation storage operation failed");
  }

  private owns(row: DbRow, owner: GenerationOwner): boolean {
    return owner.kind === "user"
      ? row.owner_user_id === owner.userId && row.owner_session_hash == null
      : row.owner_session_hash === owner.sessionHash && row.owner_user_id == null;
  }

  private mapVersion(row: DbRow): GenerationVersion {
    return {
      id: String(row.id),
      sequence: Number(row.sequence),
      source: row.source as GenerationVersion["source"],
      code: String(row.code),
      validation: (row.validation ?? null) as GenerationVersion["validation"],
      render: (row.render_artifact ?? null) as GenerationVersion["render"],
      createdAt: String(row.created_at),
    };
  }

  private mapJob(row: DbRow, versionRows: DbRow[]): GenerationJobSnapshot {
    const versions = versionRows.map((version) => this.mapVersion(version));
    const currentVersion =
      versions.find((version) => version.id === row.current_version_id) ?? null;
    return {
      id: String(row.id),
      parentJobId: (row.parent_job_id ?? null) as string | null,
      operation: row.operation as GenerationJobSnapshot["operation"],
      mode: row.mode as GenerationJobSnapshot["mode"],
      status: row.status as GenerationJobSnapshot["status"],
      phase: row.phase as GenerationJobSnapshot["phase"],
      prompt: String(row.prompt),
      scenePlan: (row.scene_plan ?? null) as GenerationJobSnapshot["scenePlan"],
      currentVersion,
      versions,
      validation: currentVersion?.validation ?? null,
      render: currentVersion?.render ?? null,
      repairAttempt: Number(row.repair_attempt) as 0 | 1 | 2,
      runToken: Number(row.run_token),
      failureReason: (row.failure_reason ?? null) as string | null,
      cancelRequested: Boolean(row.cancel_requested),
      durability: "persistent",
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  private async versionsFor(jobId: string): Promise<DbRow[]> {
    const { data, error } = await this.client
      .from("generation_versions")
      .select("*")
      .eq("job_id", jobId)
      .order("sequence", { ascending: true });
    if (error) this.fail("load versions", error);
    return (data ?? []) as DbRow[];
  }

  private async snapshot(row: DbRow): Promise<GenerationJobSnapshot> {
    return this.mapJob(row, await this.versionsFor(String(row.id)));
  }

  async createJob(
    owner: GenerationOwner,
    input: CreateGenerationJobInput,
  ): Promise<GenerationJobSnapshot> {
    const ownerColumns =
      owner.kind === "user"
        ? { owner_user_id: owner.userId, owner_session_hash: null }
        : { owner_user_id: null, owner_session_hash: owner.sessionHash };
    const { data, error } = await this.client
      .from("generation_jobs")
      .insert({
        ...ownerColumns,
        parent_job_id: input.parentJobId,
        operation: input.operation,
        mode: input.mode,
        prompt: input.prompt,
      })
      .select("*")
      .single();
    if (error || !data) this.fail("create job", error);
    return this.snapshot(data as DbRow);
  }

  async getJob(
    owner: GenerationOwner,
    jobId: string,
  ): Promise<GenerationJobSnapshot | null> {
    let query = this.client.from("generation_jobs").select("*").eq("id", jobId);
    query =
      owner.kind === "user"
        ? query.eq("owner_user_id", owner.userId).is("owner_session_hash", null)
        : query.eq("owner_session_hash", owner.sessionHash).is("owner_user_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) this.fail("get job", error);
    if (!data || !this.owns(data as DbRow, owner)) return null;
    return this.snapshot(data as DbRow);
  }

  async getActiveJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null> {
    let query = this.client
      .from("generation_jobs")
      .select("*")
      .in("status", ["queued", "running"])
      .order("updated_at", { ascending: false })
      .limit(1);
    query =
      owner.kind === "user"
        ? query.eq("owner_user_id", owner.userId).is("owner_session_hash", null)
        : query.eq("owner_session_hash", owner.sessionHash).is("owner_user_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) this.fail("get active job", error);
    if (!data || !this.owns(data as DbRow, owner)) return null;
    return this.snapshot(data as DbRow);
  }

  async getMostRecentJob(
    owner: GenerationOwner,
  ): Promise<GenerationJobSnapshot | null> {
    let query = this.client
      .from("generation_jobs")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1);
    query =
      owner.kind === "user"
        ? query.eq("owner_user_id", owner.userId).is("owner_session_hash", null)
        : query.eq("owner_session_hash", owner.sessionHash).is("owner_user_id", null);
    const { data, error } = await query.maybeSingle();
    if (error) this.fail("get most recent job", error);
    if (!data || !this.owns(data as DbRow, owner)) return null;
    return this.snapshot(data as DbRow);
  }

  async getJobById(jobId: string): Promise<GenerationJobSnapshot | null> {
    const { data, error } = await this.client
      .from("generation_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();
    if (error) this.fail("get internal job", error);
    return data ? this.snapshot(data as DbRow) : null;
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
    const columns: DbRow = { updated_at: new Date().toISOString() };
    if (patch.status !== undefined) columns.status = patch.status;
    if (patch.phase !== undefined) columns.phase = patch.phase;
    if (patch.scenePlan !== undefined) columns.scene_plan = patch.scenePlan;
    if (patch.currentVersion !== undefined) {
      columns.current_version_id = patch.currentVersion?.id ?? null;
    }
    if (patch.repairAttempt !== undefined) columns.repair_attempt = patch.repairAttempt;
    if (patch.runToken !== undefined) columns.run_token = patch.runToken;
    if (patch.failureReason !== undefined) columns.failure_reason = patch.failureReason;
    if (patch.cancelRequested !== undefined) {
      columns.cancel_requested = patch.cancelRequested;
    }
    const { error } = await this.client
      .from("generation_jobs")
      .update(columns)
      .eq("id", jobId);
    if (error) this.fail("update job", error);

    if (patch.validation !== undefined || patch.render !== undefined) {
      const versionId =
        patch.currentVersion?.id ?? (await this.getJobById(jobId))?.currentVersion?.id;
      if (versionId) {
        await this.updateVersion(jobId, versionId, {
          ...(patch.validation !== undefined
            ? { validation: patch.validation }
            : {}),
          ...(patch.render !== undefined ? { render: patch.render } : {}),
        });
      }
    }
  }

  async saveVersion(
    jobId: string,
    version: Omit<GenerationVersion, "id" | "sequence" | "createdAt">,
  ): Promise<GenerationVersion> {
    if (!(await this.getJobById(jobId))) {
      throw new GenerationStoreError("Job not found", 404);
    }
    const { data, error } = await this.client
      .from("generation_versions")
      .insert({
        job_id: jobId,
        source: version.source,
        code: version.code,
        validation: version.validation,
        render_artifact: version.render,
      })
      .select("*")
      .single();
    if (error || !data) this.fail("save version", error);
    const saved = this.mapVersion(data as DbRow);
    const { error: updateError } = await this.client
      .from("generation_jobs")
      .update({
        current_version_id: saved.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (updateError) this.fail("select current version", updateError);
    return saved;
  }

  async updateVersion(
    jobId: string,
    versionId: string,
    patch: Partial<Pick<GenerationVersion, "validation" | "render">>,
  ): Promise<GenerationVersion> {
    const columns: DbRow = {};
    if (patch.validation !== undefined) columns.validation = patch.validation;
    if (patch.render !== undefined) columns.render_artifact = patch.render;
    const { data, error } = await this.client
      .from("generation_versions")
      .update(columns)
      .eq("job_id", jobId)
      .eq("id", versionId)
      .select("*")
      .maybeSingle();
    if (error) this.fail("update version", error);
    if (!data) throw new GenerationStoreError("Version not found", 404);
    return this.mapVersion(data as DbRow);
  }

  async appendEvent(
    jobId: string,
    event: NewGenerationEvent,
  ): Promise<GenerationEvent> {
    const { data: job, error: jobError } = await this.client
      .from("generation_jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();
    if (jobError) this.fail("check event job", jobError);
    if (!job) throw new GenerationStoreError("Job not found", 404);
    const { data, error } = await this.client
      .from("generation_events")
      .insert({ job_id: jobId, type: event.type, payload: event.data })
      .select("*")
      .single();
    if (error || !data) this.fail("append event", error);
    const row = data as DbRow;
    return {
      id: Number(row.sequence),
      jobId: String(row.job_id),
      createdAt: String(row.created_at),
      type: row.type,
      data: row.payload,
    } as GenerationEvent;
  }

  async listEvents(
    owner: GenerationOwner,
    jobId: string,
    afterId: number,
  ): Promise<GenerationEvent[]> {
    if (!(await this.getJob(owner, jobId))) return [];
    const { data, error } = await this.client
      .from("generation_events")
      .select("*")
      .eq("job_id", jobId)
      .gt("sequence", afterId)
      .order("sequence", { ascending: true });
    if (error) this.fail("list events", error);
    return ((data ?? []) as DbRow[]).map(
      (row) =>
        ({
          id: Number(row.sequence),
          jobId: String(row.job_id),
          createdAt: String(row.created_at),
          type: row.type,
          data: row.payload,
        }) as GenerationEvent,
    );
  }

  async markInterruptedJobs(): Promise<number> {
    const { data, error } = await this.client
      .from("generation_jobs")
      .update({
        status: "failed",
        failure_reason: "interrupted",
        cancel_requested: false,
        updated_at: new Date().toISOString(),
      })
      .in("status", ["queued", "running"])
      .select("id");
    if (error) this.fail("mark interrupted jobs", error);
    return data?.length ?? 0;
  }
}
