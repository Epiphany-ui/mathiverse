# AI Generation Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a quality-first Manim generation pipeline with real progress feedback, validation/render/repair automation, retained manual controls, and an immersive responsive Sandbox studio.

**Architecture:** A typed server-side Generation Orchestrator advances durable jobs through planning, retrieval, generation, validation, quick rendering, and at most two repairs. Next.js Route Handlers expose authenticated job creation, snapshots, actions, and SSE events; a client reducer renders those real events inside a dark, canvas-first Studio Shell. The existing `/api/chat`, `/api/chat/fix`, `/api/render`, `useChat`, and Wiki Mini Sandbox remain compatible while the main `/sandbox` route moves to the new workflow.

**Tech Stack:** Next.js 16.3 Route Handlers and Client Components, React 19.2, TypeScript 5, Node 24.19 Web Streams/EventSource, Supabase/Postgres, DeepSeek V4 Pro/Flash, Ollama bge-m3, Python 3 + FastAPI + Manim, CSS Modules, CodeMirror 6, Node test runner via `tsx`, Python `unittest`, Playwright.

## Global Constraints

- Execute `docs/superpowers/plans/2026-08-11-mathiverse-green-baseline.md` first; do not begin this plan until test, typecheck, lint, and build are green.
- Preserve every unrelated user change and keep each task's commit limited to the exact files listed for that task.
- Before editing Next.js files, read these local Next.js 16.3 guides in full: `05-server-and-client-components.md`, `15-route-handlers.md`, `backend-for-frontend.md`, `streaming.md`, and `maxDuration.md` under `node_modules/next/dist/docs/01-app/`.
- Route Handlers are public endpoints: validate content type, payload size, ownership, and authorization in every handler; never expose service-role keys, model credentials, raw internal paths, or unsanitized tracebacks.
- AST validation is defense in depth, not the security boundary. A production renderer must run as an unprivileged service with secrets removed, filesystem access restricted to its work/cache directories, outbound network denied, and CPU, memory, process-count, output-size, and wall-time limits enforced by the deployment runtime.
- The first implementation targets the existing single Node.js server plus local FastAPI renderer. Do not use `after()` for generation work and do not claim cross-process automatic continuation; a server restart persists the last version and marks the job `failed` with reason `interrupted`.
- Model reasoning stays private. UI events contain product phase summaries, never raw `reasoning_content`.
- Automatic repair is capped at exactly two attempts. Manual render and manual AI repair remain available on every supported viewport.
- Quick preview uses low quality; high-quality rendering is an explicit user action after a valid version exists.
- Studio colors are Gallery Black `#0B0F0C`, Archive Paper `#F2F3ED`, Mathematical Ink `#121510`, Function Blue `#4169FF`, Orbit Green `#25BEA5`, and Calculus Orange `#FF603B`.
- Chinese UI uses Noto Sans SC; code and technical metadata use JetBrains Mono.
- Entry animation lasts 700--900ms on capable devices, is non-blocking, plays once per new navigation, and reduces to 120--180ms opacity-only motion under `prefers-reduced-motion: reduce`.
- Required CSS viewports are 1440×900, 1024×768, 768×1024, 390×844, and 844×390; each test must assert the browser's real `innerWidth` and `innerHeight`.
- Completion requires JavaScript/TypeScript tests, Python tests, TypeScript, ESLint, Next.js production build, deterministic browser tests, and one real configured generation/render smoke flow to pass.

---

### Task 1: Define generation contracts and the legal state machine

**Files:**
- Create: `src/lib/generation/types.ts`
- Create: `src/lib/generation/state-machine.ts`
- Test: `src/lib/generation/state-machine.test.ts`

**Interfaces:**
- Consumes: no application modules; these files are pure TypeScript.
- Produces: `GenerationJobSnapshot`, `GenerationEvent`, `GenerationVersion`, `ScenePlan`, `CreateGenerationJobInput`, `GenerationAction`, `assertPhaseTransition()`, `applyGenerationEvent()`, and `isTerminalStatus()`.

- [ ] **Step 1: Write failing state-machine tests**

Create `src/lib/generation/state-machine.test.ts` with cases equivalent to:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  applyGenerationEvent,
  assertPhaseTransition,
  createInitialSnapshot,
} from "./state-machine";

test("a generation job starts queued without treating placeholder code as current code", () => {
  const job = createInitialSnapshot({
    id: "job-1",
    operation: "generate",
    mode: "new",
    prompt: "展示傅里叶级数",
    currentCode: null,
    parentJobId: null,
    durability: "persistent",
  });
  assert.equal(job.status, "queued");
  assert.equal(job.phase, "queued");
  assert.equal(job.currentVersion, null);
});

test("repair may return to validation but may not exceed two attempts", () => {
  assert.doesNotThrow(() => assertPhaseTransition("repairing", "validating"));
  assert.throws(() => assertPhaseTransition("rendering", "planning"));
});

test("a validation event updates the snapshot without inventing progress", () => {
  const start = createInitialSnapshot({
    id: "job-2",
    operation: "generate",
    mode: "new",
    prompt: "画一个单位圆",
    currentCode: null,
    parentJobId: null,
    durability: "session",
  });
  const next = applyGenerationEvent(start, {
    id: 4,
    jobId: "job-2",
    type: "validation.completed",
    createdAt: "2026-08-11T00:00:00.000Z",
    data: { valid: false, issues: [{ code: "syntax", message: "invalid syntax", line: 4 }] },
  });
  assert.equal(next.validation?.valid, false);
  assert.equal("percent" in next, false);
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```bash
pnpm test -- src/lib/generation/state-machine.test.ts
```

Expected: FAIL because `types.ts` and `state-machine.ts` do not exist.

- [ ] **Step 3: Define the shared contracts**

Create `src/lib/generation/types.ts` with these exact public shapes:

```ts
export const GENERATION_PHASES = [
  "queued",
  "planning",
  "retrieving",
  "generating",
  "validating",
  "rendering",
  "repairing",
] as const;

export type GenerationPhase = (typeof GENERATION_PHASES)[number];
export type GenerationStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
export type GenerationMode = "new" | "edit" | "repair";
export type GenerationOperation =
  | "generate"
  | "render"
  | "repair"
  | "high_quality_render";
export type GenerationVersionSource =
  | "generated"
  | "auto_repair"
  | "manual"
  | "rollback";

export interface ScenePlan {
  objects: string[];
  layout: "2d" | "3d" | "formula" | "mixed";
  stages: Array<{ title: string; intent: string }>;
  trackers: string[];
  estimatedComplexity: "simple" | "standard" | "complex";
}

export interface ValidationIssue {
  code: "syntax" | "scene" | "security" | "api" | "render" | "timeout";
  message: string;
  line?: number;
  column?: number;
}

export interface ValidationResult {
  valid: boolean;
  sceneName: string | null;
  issues: ValidationIssue[];
}

export interface RenderArtifact {
  url: string;
  format: "mp4" | "gif";
  quality: "-ql" | "-qm" | "-qh" | "-qk";
  duration: number | null;
  cacheHit: boolean;
  renderKey: string;
}

export interface GenerationVersion {
  id: string;
  sequence: number;
  source: GenerationVersionSource;
  code: string;
  validation: ValidationResult | null;
  render: RenderArtifact | null;
  createdAt: string;
}

export interface GenerationJobSnapshot {
  id: string;
  parentJobId: string | null;
  operation: GenerationOperation;
  mode: GenerationMode;
  status: GenerationStatus;
  phase: GenerationPhase;
  prompt: string;
  scenePlan: ScenePlan | null;
  currentVersion: GenerationVersion | null;
  versions: GenerationVersion[];
  validation: ValidationResult | null;
  render: RenderArtifact | null;
  repairAttempt: 0 | 1 | 2;
  runToken: number;
  failureReason: string | null;
  cancelRequested: boolean;
  durability: "persistent" | "session";
  createdAt: string;
  updatedAt: string;
}

export interface CreateGenerationJobInput {
  operation: GenerationOperation;
  mode: GenerationMode;
  prompt: string;
  currentCode: string | null;
  parentJobId: string | null;
  sourceVersionId?: string | null;
  renderError?: string | null;
  quality?: "-ql" | "-qm" | "-qh";
  format?: "mp4" | "gif";
}

export type GenerationAction =
  | { type: "cancel" }
  | { type: "retry" }
  | { type: "take_over" }
  | { type: "save_manual_version"; code: string }
  | { type: "rollback"; versionId: string }
  | { type: "publish"; versionId: string };
```

Define `GenerationEvent` as a discriminated union whose shared fields are `id: number`, `jobId: string`, `createdAt: string`, and whose `type`/`data` pairs are:

```ts
type GenerationEventData = {
  "job.accepted": { snapshot: GenerationJobSnapshot };
  "phase.changed": { phase: GenerationPhase; label: string };
  "plan.ready": { plan: ScenePlan };
  "code.delta": { delta: string };
  "version.created": { version: GenerationVersion };
  "validation.completed": ValidationResult;
  "render.started": { requestId: string; quality: RenderArtifact["quality"]; format: RenderArtifact["format"] };
  "render.completed": { artifact: RenderArtifact };
  "render.failed": { issues: ValidationIssue[]; retryable: boolean };
  "repair.started": { attempt: 1 | 2; maxAttempts: 2; reason: string };
  "job.completed": { versionId: string; render: RenderArtifact };
  "job.failed": { reason: string; message: string; retryable: boolean };
  "job.cancelled": { versionId: string | null };
};

export type GenerationEvent = {
  [Type in keyof GenerationEventData]: {
    id: number;
    jobId: string;
    createdAt: string;
    type: Type;
    data: GenerationEventData[Type];
  };
}[keyof GenerationEventData];

export type NewGenerationEvent = GenerationEvent extends infer Event
  ? Event extends GenerationEvent
    ? Omit<Event, "id" | "jobId" | "createdAt">
    : never
  : never;
```

Heartbeat comments exist only on the SSE transport and are not `GenerationEvent` records.

- [ ] **Step 4: Implement legal transitions and the pure reducer**

Create `src/lib/generation/state-machine.ts` with a transition map that permits:

```ts
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
    throw new Error(`Illegal generation phase transition: ${current} -> ${next}`);
  }
}

export function isTerminalStatus(status: GenerationStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
```

`applyGenerationEvent()` must be exhaustive over every event type, update only fields supplied by the event, replace a version with the same ID rather than duplicate it, and never add a percentage field.

- [ ] **Step 5: Run GREEN and static checks**

Run:

```bash
pnpm test -- src/lib/generation/state-machine.test.ts
pnpm typecheck
pnpm eslint src/lib/generation/types.ts src/lib/generation/state-machine.ts src/lib/generation/state-machine.test.ts
```

Expected: all pass.

- [ ] **Step 6: Commit the contracts**

```bash
git add src/lib/generation/types.ts src/lib/generation/state-machine.ts src/lib/generation/state-machine.test.ts
git diff --cached --check
git commit -m "feat: define generation job contracts"
```

### Task 2: Add durable job storage and anonymous ownership

**Files:**
- Create: `supabase/migrations/005_generation_jobs.sql`
- Create: `.env.example`
- Create: `src/lib/generation/job-store.ts`
- Create: `src/lib/generation/memory-job-store.ts`
- Create: `src/lib/generation/supabase-job-store.ts`
- Create: `src/lib/generation/session.ts`
- Test: `src/lib/generation/job-store.test.ts`
- Test: `src/lib/generation/session.test.ts`

**Interfaces:**
- Consumes: all Task 1 types, `getAdminClient()`, server Supabase auth, and `GENERATION_SESSION_SECRET`.
- Produces: `GenerationJobStore`, `getGenerationJobStore()`, `createSignedAnonymousSession()`, `verifySignedAnonymousSession()`, `hashAnonymousSession()`, and `GenerationOwner`.

- [ ] **Step 1: Write failing ownership and store tests**

Create tests that assert:

```ts
test("anonymous session tokens reject payload tampering", () => {
  const token = createSignedAnonymousSession("test-secret", "session-a");
  assert.equal(verifySignedAnonymousSession("test-secret", token), "session-a");
  assert.equal(
    verifySignedAnonymousSession("test-secret", token.replace("session-a", "session-b")),
    null,
  );
});

test("memory store isolates owners and replays only later events", async () => {
  const store = new MemoryGenerationJobStore();
  const ownerA = { kind: "anonymous", sessionHash: "hash-a" } as const;
  const ownerB = { kind: "anonymous", sessionHash: "hash-b" } as const;
  const plan = {
    objects: ["Circle"],
    layout: "2d",
    stages: [{ title: "建立场景", intent: "显示单位圆" }],
    trackers: [],
    estimatedComplexity: "simple",
  } satisfies ScenePlan;
  const job = await store.createJob(ownerA, validCreateInput);
  await store.appendEvent(job.id, { type: "phase.changed", data: { phase: "planning", label: "规划场景" } });
  const second = await store.appendEvent(job.id, { type: "plan.ready", data: { plan } });
  assert.equal(await store.getJob(ownerB, job.id), null);
  assert.deepEqual((await store.listEvents(ownerA, job.id, second.id - 1)).map(event => event.id), [second.id]);
});
```

Define `validCreateInput` with operation `generate`, mode `new`, a non-empty prompt, and no current code.

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm test -- src/lib/generation/job-store.test.ts src/lib/generation/session.test.ts
```

Expected: FAIL because the store and session modules do not exist.

- [ ] **Step 3: Create the database migration**

`005_generation_jobs.sql` must create these service-only tables:

```sql
CREATE TABLE generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_job_id uuid REFERENCES generation_jobs(id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_session_hash text,
  operation text NOT NULL CHECK (operation IN ('generate', 'render', 'repair', 'high_quality_render')),
  mode text NOT NULL CHECK (mode IN ('new', 'edit', 'repair')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  phase text NOT NULL DEFAULT 'queued' CHECK (phase IN ('queued', 'planning', 'retrieving', 'generating', 'validating', 'rendering', 'repairing')),
  prompt text NOT NULL DEFAULT '',
  scene_plan jsonb,
  current_version_id uuid,
  repair_attempt smallint NOT NULL DEFAULT 0 CHECK (repair_attempt BETWEEN 0 AND 2),
  run_token integer NOT NULL DEFAULT 0,
  failure_reason text,
  cancel_requested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((owner_user_id IS NOT NULL) <> (owner_session_hash IS NOT NULL))
);

CREATE TABLE generation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  sequence bigint GENERATED ALWAYS AS IDENTITY,
  source text NOT NULL CHECK (source IN ('generated', 'auto_repair', 'manual', 'rollback')),
  code text NOT NULL,
  validation jsonb,
  render_artifact jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, sequence)
);

ALTER TABLE generation_jobs
  ADD CONSTRAINT generation_jobs_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES generation_versions(id) ON DELETE SET NULL;

CREATE TABLE generation_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generation_jobs_user_idx ON generation_jobs(owner_user_id, updated_at DESC);
CREATE INDEX generation_jobs_session_idx ON generation_jobs(owner_session_hash, updated_at DESC);
CREATE INDEX generation_events_replay_idx ON generation_events(job_id, sequence);
CREATE INDEX generation_versions_job_idx ON generation_versions(job_id, sequence);

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;
```

Do not create public policies; all reads and writes go through owner-checking Route Handlers using the service-role client.

- [ ] **Step 4: Define the store interface**

Create `src/lib/generation/job-store.ts` with:

```ts
export type GenerationOwner =
  | { kind: "user"; userId: string }
  | { kind: "anonymous"; sessionHash: string };

export interface GenerationJobStore {
  readonly durability: "persistent" | "session";
  createJob(owner: GenerationOwner, input: CreateGenerationJobInput): Promise<GenerationJobSnapshot>;
  getJob(owner: GenerationOwner, jobId: string): Promise<GenerationJobSnapshot | null>;
  getActiveJob(owner: GenerationOwner): Promise<GenerationJobSnapshot | null>;
  getJobById(jobId: string): Promise<GenerationJobSnapshot | null>;
  updateJob(jobId: string, patch: Partial<Pick<GenerationJobSnapshot,
    "status" | "phase" | "scenePlan" | "validation" | "render" | "repairAttempt" | "runToken" | "failureReason" | "cancelRequested"
  >>): Promise<void>;
  saveVersion(jobId: string, version: Omit<GenerationVersion, "id" | "sequence" | "createdAt">): Promise<GenerationVersion>;
  updateVersion(
    jobId: string,
    versionId: string,
    patch: Partial<Pick<GenerationVersion, "validation" | "render">>,
  ): Promise<GenerationVersion>;
  appendEvent(jobId: string, event: NewGenerationEvent): Promise<GenerationEvent>;
  listEvents(owner: GenerationOwner, jobId: string, afterId: number): Promise<GenerationEvent[]>;
  markInterruptedJobs(): Promise<number>;
}
```

Add `getGenerationJobStore()` that returns the Supabase implementation when `getAdminClient()` is configured and a process-wide memory store otherwise. The fallback must expose `durability: "session"` so the UI never implies refresh durability it does not have. `getJobById()` is a server-internal orchestrator method and must never be exposed directly through a route without an owner check.

- [ ] **Step 5: Implement signed anonymous ownership**

Use Node `crypto` HMAC SHA-256 and `timingSafeEqual` in `session.ts`. The cookie payload is a random UUID plus a hex signature; `hashAnonymousSession()` stores only a SHA-256 hash of the UUID in the database. Export:

```ts
export const SANDBOX_SESSION_COOKIE = "mathiverse_sandbox_session";
export function createSignedAnonymousSession(secret: string, sessionId = randomUUID()): string;
export function verifySignedAnonymousSession(secret: string, token: string): string | null;
export function hashAnonymousSession(sessionId: string): string;
```

Add this documented variable to the new `.env.example` without copying real values:

```dotenv
GENERATION_SESSION_SECRET=replace_with_at_least_32_random_bytes
```

- [ ] **Step 6: Implement both stores**

The memory store uses Maps and monotonically increasing event/version counters. The Supabase store uses `getAdminClient()`, checks owner columns before returning snapshots/events, converts snake_case rows to Task 1 types in one private mapper, and throws a server-side `GenerationStoreError` rather than returning raw Supabase errors to routes.

`markInterruptedJobs()` must update rows where `status IN ('queued', 'running')` to:

```ts
{
  status: "failed",
  failureReason: "interrupted",
  cancelRequested: false,
}
```

- [ ] **Step 7: Run GREEN and migration checks**

Run:

```bash
pnpm test -- src/lib/generation/job-store.test.ts src/lib/generation/session.test.ts
pnpm typecheck
pnpm eslint src/lib/generation
rg -n "ENABLE ROW LEVEL SECURITY|owner_session_hash|repair_attempt|run_token" supabase/migrations/005_generation_jobs.sql
```

Expected: tests and static checks pass; all three tables have RLS enabled.

- [ ] **Step 8: Commit persistence and ownership**

```bash
git add supabase/migrations/005_generation_jobs.sql .env.example src/lib/generation/job-store.ts src/lib/generation/memory-job-store.ts src/lib/generation/supabase-job-store.ts src/lib/generation/session.ts src/lib/generation/job-store.test.ts src/lib/generation/session.test.ts
git diff --cached --check
git commit -m "feat: persist owned generation jobs"
```

### Task 3: Build quality-aware planning, model routing, and RAG context

**Files:**
- Create: `supabase/migrations/006_manim_example_quality.sql`
- Create: `src/lib/ai/validated-examples.ts`
- Create: `src/lib/generation/model-router.ts`
- Create: `src/lib/generation/scene-planner.ts`
- Create: `src/lib/generation/generation-context.ts`
- Modify: `src/lib/ai/client.ts`
- Modify: `src/lib/ai/embedding.ts`
- Modify: `src/lib/ai/retrieval.ts`
- Modify: `src/lib/ai/prompts.ts`
- Modify: `src/lib/ai/types.ts`
- Modify: `src/app/api/visualizations/route.ts`
- Test: `src/lib/generation/model-router.test.ts`
- Test: `src/lib/generation/generation-context.test.ts`

**Interfaces:**
- Consumes: `ScenePlan`, existing DeepSeek client, Ollama embeddings, and `manim_examples`.
- Produces: `routeGenerationModel()`, `planScene()`, `buildGenerationMessages()`, `retrieveVerifiedExamples()`, abortable AI requests, and two render-certified fallback examples.

- [ ] **Step 1: Write failing routing and context tests**

Cover these exact behaviors:

```ts
test("new work never includes placeholder code", () => {
  const result = buildGenerationMessages({
    prompt: "展示勾股定理",
    mode: "new",
    currentCode: null,
    plan,
    examples: [],
  });
  assert.equal(result.some(message => message.content.includes("FirstScene")), false);
});

test("edit code appears exactly once in model context", () => {
  const code = "from manim import *\nclass Existing(Scene):\n    pass";
  const result = buildGenerationMessages({
    prompt: "把圆改成绿色",
    mode: "edit",
    currentCode: code,
    plan,
    examples: [],
  });
  const joined = result.map(message => message.content).join("\n");
  assert.equal(joined.split(code).length - 1, 1);
});

test("complex scenes route to Pro with a bounded budget", () => {
  assert.deepEqual(routeGenerationModel("generate", "complex"), {
    model: "deepseek-v4-pro",
    reasoningEffort: "max",
    maxTokens: 12288,
  });
});

test("retrieval drops unverified, incompatible, and weak matches", () => {
  const kept = filterRetrievedExamples(rows, {
    minSimilarity: 0.72,
    dimension: "3d",
    manimVersion: "0.19",
    maxDifficulty: 3,
  });
  assert.deepEqual(kept.map(example => example.id), ["verified-3d"]);
});
```

- [ ] **Step 2: Run the tests to verify RED**

Run:

```bash
pnpm test -- src/lib/generation/model-router.test.ts src/lib/generation/generation-context.test.ts
```

Expected: FAIL because the generation modules do not exist.

- [ ] **Step 3: Add RAG quality columns and a verified RPC**

Create `006_manim_example_quality.sql` that adds:

```sql
ALTER TABLE manim_examples
  ADD COLUMN IF NOT EXISTS dimension text NOT NULL DEFAULT '2d'
    CHECK (dimension IN ('2d', '3d', 'formula', 'mixed')),
  ADD COLUMN IF NOT EXISTS manim_version text NOT NULL DEFAULT '0.19',
  ADD COLUMN IF NOT EXISTS render_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS render_hash text;

CREATE OR REPLACE FUNCTION match_verified_manim_examples(
  query_embedding vector(1024),
  match_count int DEFAULT 3,
  match_threshold float DEFAULT 0.72,
  dimension_filter text DEFAULT NULL,
  max_difficulty smallint DEFAULT 3,
  manim_version_filter text DEFAULT '0.19'
) RETURNS TABLE (
  id uuid, title text, description text, code text, tags text[],
  difficulty smallint, source text, dimension text, manim_version text,
  render_verified boolean, render_hash text, similarity float
) LANGUAGE sql STABLE AS $$
  SELECT e.id, e.title, e.description, e.code, e.tags, e.difficulty,
         e.source, e.dimension, e.manim_version, e.render_verified,
         e.render_hash, 1 - (e.embedding <=> query_embedding) AS similarity
  FROM manim_examples e
  WHERE e.render_verified = true
    AND e.embedding IS NOT NULL
    AND e.difficulty <= max_difficulty
    AND e.manim_version = manim_version_filter
    AND (dimension_filter IS NULL OR e.dimension = dimension_filter)
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

Keep the existing `ManimExample` compatible for legacy callers and add a stricter retrieved subtype in `src/lib/ai/types.ts`:

```ts
export interface VerifiedManimExample extends ManimExample {
  dimension: "2d" | "3d" | "formula" | "mixed";
  manimVersion: string;
  renderVerified: boolean;
  renderHash: string | null;
}
```

Map the migration's snake_case columns to these camelCase fields inside the retrieval boundary.

- [ ] **Step 4: Make model and embedding calls abortable**

Add `signal?: AbortSignal` to `ChatCompletionRequest` and pass it to both DeepSeek `fetch` calls. Change the default max tokens in `buildRequestBody()` from `32768` to `8192`; every generation call from `model-router.ts` supplies its explicit budget.

Change embedding signatures to:

```ts
export async function embed(text: string, signal?: AbortSignal): Promise<number[]>;
export async function embedBatch(texts: string[], signal?: AbortSignal): Promise<number[][]>;
```

Pass `signal` into `fetch`. The new retrieval path calls `embed()` directly under `AbortSignal.any([callerSignal, AbortSignal.timeout(800)])`; it does not first call the separate Ollama health subprocess/request.

- [ ] **Step 5: Implement bounded model routing**

Create `model-router.ts` with:

```ts
export interface ModelRoute {
  model: (typeof MODELS)[keyof typeof MODELS];
  reasoningEffort?: "high" | "max";
  thinking?: { type: "disabled" };
  maxTokens: 4096 | 8192 | 12288;
}

export function routeGenerationModel(
  operation: GenerationOperation,
  complexity: ScenePlan["estimatedComplexity"],
): ModelRoute {
  if (operation === "repair") {
    return { model: MODELS.code, reasoningEffort: "high", maxTokens: 8192 };
  }
  if (complexity === "simple") {
    return { model: MODELS.metadata, thinking: { type: "disabled" }, maxTokens: 4096 };
  }
  return {
    model: MODELS.code,
    reasoningEffort: complexity === "complex" ? "max" : "high",
    maxTokens: complexity === "complex" ? 12288 : 8192,
  };
}
```

- [ ] **Step 6: Implement structured planning**

`planScene(prompt, currentCode, signal)` calls Flash with thinking disabled and `max_tokens: 900`. The planner prompt requires JSON matching `ScenePlan`; parse the first JSON object, validate arrays and enum values, and fall back to:

```ts
{
  objects: [prompt.slice(0, 80)],
  layout: currentCode?.includes("ThreeDScene") ? "3d" : "2d",
  stages: [
    { title: "建立场景", intent: "创建数学对象和布局" },
    { title: "演示关系", intent: "按用户描述播放核心动画" },
    { title: "收束画面", intent: "保留关键公式或结论" },
  ],
  trackers: [],
  estimatedComplexity: "standard",
}
```

The fallback is a product plan summary, not model reasoning.

- [ ] **Step 7: Implement verified retrieval and de-duplicated messages**

Expose:

```ts
export interface RetrievalOptions {
  limit: number;
  minSimilarity: number;
  dimension: ScenePlan["layout"];
  maxDifficulty: 1 | 2 | 3;
  manimVersion: string;
  timeoutMs: number;
  signal?: AbortSignal;
}

export async function retrieveVerifiedExamples(
  query: string,
  options: RetrievalOptions,
): Promise<VerifiedManimExample[]>;
```

Call `match_verified_manim_examples`; return an empty array on configured timeout/unavailability and record the internal cause without exposing it to users. `validated-examples.ts` contains exactly two concise fallback scenes that compile and render under Manim 0.19: a 2D Axes plot and a basic ThreeDScene surface.

`buildGenerationMessages()` places the current code only in one user message, includes the serialized Scene Plan and at most three verified examples, and does not append historical assistant code. Update legacy `buildMessages()` in `prompts.ts` to use the same verified fallback examples instead of injecting the corrupted/full `FEW_SHOT_EXAMPLES` collection; keep its exported signature for Wiki callers.

- [ ] **Step 8: Require render evidence before auto-indexing**

Change `tryAutoIndex()` to require:

```ts
verification: {
  renderVerified: true;
  renderHash: string;
  manimVersion: string;
  dimension: "2d" | "3d" | "formula" | "mixed";
}
```

If verification is absent, return `null`. Update `src/app/api/visualizations/route.ts` to skip best-effort indexing when a publish request has no trusted generation render evidence; publishing itself must still succeed.

- [ ] **Step 9: Run GREEN and compatibility checks**

Run:

```bash
pnpm test -- src/lib/generation/model-router.test.ts src/lib/generation/generation-context.test.ts
pnpm typecheck
pnpm eslint src/lib/ai src/lib/generation src/app/api/visualizations/route.ts
```

Expected: all pass; `/api/chat` retains its legacy response contract.

- [ ] **Step 10: Commit AI quality controls**

```bash
git add supabase/migrations/006_manim_example_quality.sql src/lib/ai/validated-examples.ts src/lib/ai/client.ts src/lib/ai/embedding.ts src/lib/ai/retrieval.ts src/lib/ai/prompts.ts src/lib/ai/types.ts src/lib/generation/model-router.ts src/lib/generation/scene-planner.ts src/lib/generation/generation-context.ts src/lib/generation/model-router.test.ts src/lib/generation/generation-context.test.ts src/app/api/visualizations/route.ts
git diff --cached --check
git commit -m "feat: add quality-aware generation context"
```

### Task 4: Make the renderer validate, cache, diagnose, and cancel safely

**Files:**
- Create: `renderer/core.py`
- Create: `renderer/tests/__init__.py`
- Create: `renderer/tests/test_core.py`
- Modify: `renderer/server.py`
- Modify: `renderer/README.md`

**Interfaces:**
- Consumes: Python code, Manim environment version, quality flag, format, and request ID.
- Produces: `validate_code()`, `compute_render_key()`, `/validate`, cache-aware `/render`, `DELETE /render/{request_id}`, structured diagnostics, and non-blocking FastAPI handlers.

- [ ] **Step 1: Write failing renderer core tests**

Create `renderer/tests/test_core.py` with:

```python
import unittest
from renderer.core import compute_render_key, validate_code


VALID_CODE = """from manim import *
class UnitCircle(Scene):
    def construct(self):
        self.play(Create(Circle()))
"""


class RendererCoreTests(unittest.TestCase):
    def test_render_key_is_stable_and_environment_sensitive(self):
        first = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        second = compute_render_key(VALID_CODE, "-ql", "mp4", "0.19.0")
        changed = compute_render_key(VALID_CODE, "-qh", "mp4", "0.19.0")
        self.assertEqual(first, second)
        self.assertNotEqual(first, changed)

    def test_validation_discovers_scene_and_rejects_process_access(self):
        valid = validate_code(VALID_CODE)
        blocked = validate_code("import subprocess\nclass Bad(Scene):\n    pass")
        self.assertTrue(valid.valid)
        self.assertEqual(valid.scene_name, "UnitCircle")
        self.assertFalse(blocked.valid)
        self.assertEqual(blocked.issues[0].code, "security")

    def test_syntax_error_has_a_line_number(self):
        result = validate_code("from manim import *\nclass Broken(Scene)\n    pass")
        self.assertFalse(result.valid)
        self.assertEqual(result.issues[0].line, 2)
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
python -m unittest discover -s renderer/tests -p 'test_*.py' -v
```

Expected: FAIL because `renderer/core.py` does not exist.

- [ ] **Step 3: Implement AST validation and stable cache keys**

In `renderer/core.py`, use `ast.parse()` and dataclasses. Allow imports rooted at `manim`, `numpy`, `math`, `random`, and `statistics`. Reject imports/calls rooted at `os`, `sys`, `subprocess`, `socket`, `pathlib`, `shutil`, `requests`, `urllib`, `open`, `eval`, `exec`, `compile`, and `__import__`.

Implement the key without time:

```python
def compute_render_key(
    code: str,
    quality: str,
    fmt: str,
    manim_version: str,
) -> str:
    normalized = code.replace("\r\n", "\n").strip() + "\n"
    payload = json.dumps(
        {
            "code": normalized,
            "quality": quality,
            "format": fmt,
            "manim_version": manim_version,
            "python": f"{sys.version_info.major}.{sys.version_info.minor}",
        },
        ensure_ascii=False,
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]
```

Scene discovery accepts subclasses ending in `Scene`, including `ThreeDScene` and `MovingCameraScene`, and returns a structured issue when none exists.

Keep the AST allowlist even in an isolated renderer, but document that it is not a substitute for the production runtime boundary described in Global Constraints.

- [ ] **Step 4: Expand the FastAPI response contract**

Add Pydantic models matching the TypeScript contract:

```python
class ValidationIssueModel(BaseModel):
    code: str
    message: str
    line: int | None = None
    column: int | None = None


class ValidationResponse(BaseModel):
    valid: bool
    scene_name: str | None = None
    issues: list[ValidationIssueModel] = []


class RenderRequest(BaseModel):
    code: str
    quality: str = "-ql"
    format: str = "mp4"
    request_id: str


class RenderResponse(BaseModel):
    success: bool
    video_url: str | None = None
    gif_url: str | None = None
    duration: float | None = None
    error: str | None = None
    diagnostics: list[ValidationIssueModel] = []
    scene_name: str | None = None
    render_key: str | None = None
    cache_hit: bool = False
```

Use `Field(default_factory=list)` rather than mutable list defaults in the actual models.

- [ ] **Step 5: Implement validation and cache-first render routes**

- `POST /validate` returns `ValidationResponse` and never executes code.
- `POST /render` validates again, computes the key, returns an existing final file with `cache_hit=true`, or renders in a stable key directory.
- Pass CLI arguments separately: `[python, "-m", "manim", code_file, scene_name, quality, "--format", fmt]`.
- Cache the Manim version check with `functools.lru_cache`; do not spawn it for every request.
- Run blocking file/process work with `await asyncio.to_thread(...)` so FastAPI's event loop remains responsive.
- Keep a per-render-key `asyncio.Lock` so identical concurrent requests share one output.

- [ ] **Step 6: Track and cancel subprocesses**

Replace `subprocess.run` with `subprocess.Popen` plus `communicate(timeout=MANIM_TIMEOUT)`. Register each process in `ACTIVE_PROCESSES[request_id]` under a lock and remove it in `finally`.

Implement:

```python
@app.delete("/render/{request_id}")
async def cancel_render(request_id: str):
    process = ACTIVE_PROCESSES.get(request_id)
    if process is None:
        return {"cancelled": False}
    process.terminate()
    try:
        process.wait(timeout=3)
    except subprocess.TimeoutExpired:
        process.kill()
    return {"cancelled": True}
```

Sanitize absolute temporary paths in returned diagnostics. Preserve the complete traceback internally and return a concise issue list plus a bounded, sanitized technical detail; do not reduce it to only the final three error lines.

- [ ] **Step 7: Run renderer tests and a real health check**

Run:

```bash
python -m unittest discover -s renderer/tests -p 'test_*.py' -v
python renderer/server.py
```

In a second terminal:

```bash
curl http://127.0.0.1:9876/health
curl -X POST http://127.0.0.1:9876/validate -H 'Content-Type: application/json' -d '{"code":"from manim import *\nclass Smoke(Scene):\n    def construct(self):\n        self.add(Circle())"}'
```

Expected: health reports the Manim version and validation returns `valid: true` with scene `Smoke`.

- [ ] **Step 8: Prove cache reuse with a low-quality render**

Submit the same code, quality, and format twice with different `request_id` values. Expected: both return the same `render_key`; the second response has `cache_hit: true` and completes without invoking a second Manim process.

- [ ] **Step 9: Document the new contract and commit**

Update `renderer/README.md` with `/validate`, `request_id`, structured errors, cache behavior, and cancellation examples. Then:

```bash
git add renderer/core.py renderer/tests renderer/server.py renderer/README.md
git diff --cached --check
git commit -m "feat: validate and cache Manim renders"
```

### Task 5: Add a typed renderer client without breaking legacy consumers

**Files:**
- Create: `src/lib/generation/renderer-client.ts`
- Test: `src/lib/generation/renderer-client.test.ts`
- Modify: `src/app/api/render/route.ts`
- Modify: `.env.example`

**Interfaces:**

```ts
interface RendererClient {
  validateManim(code: string, signal?: AbortSignal): Promise<ValidationResult>;
  renderManim(input: {
    code: string;
    quality: "-ql" | "-qm" | "-qh";
    format: "mp4" | "gif";
    requestId: string;
    signal?: AbortSignal;
  }): Promise<RenderArtifact>;
  cancelManimRender(requestId: string): Promise<boolean>;
}

function createRendererClient(options?: {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): RendererClient;

class RendererError extends Error {
  status: number;
  issues: ValidationIssue[];
  retryable: boolean;
}
```

- [ ] **Step 1: Write failing renderer-client tests**

With an injected `fetchImpl`, test that `/validate` maps structured success, a cache-hit `/render` response preserves `renderKey` and `cacheHit`, HTTP 422 throws `RendererError` with its line-numbered diagnostic, and cancellation sends `DELETE /render/{requestId}`.

```bash
pnpm test src/lib/generation/renderer-client.test.ts
```

Expected: fail because the module does not exist.

- [ ] **Step 2: Implement the server-only renderer client**

Start with `import "server-only"`. Resolve the URL in this order:

```ts
const baseUrl =
  options.baseUrl ??
  process.env.RENDERER_URL ??
  process.env.NEXT_PUBLIC_RENDERER_URL ??
  "http://127.0.0.1:9876";
```

Add `RENDERER_URL=http://127.0.0.1:9876` to `.env.example`; keep the public variable only as a backward-compatible fallback. Compose the caller signal with an internal timeout through `AbortSignal.any`: 10 seconds for validation and 130 seconds for rendering. Parse non-2xx JSON before throwing; classify 408, 429, and 5xx as retryable.

- [ ] **Step 3: Preserve the existing `/api/render` contract**

Refactor `src/app/api/render/route.ts` to call the typed client, but retain the response keys consumed by Wiki cards and Mini Sandbox:

```ts
return NextResponse.json({
  success: true,
  video_url: artifact.format === "mp4" ? artifact.url : null,
  gif_url: artifact.format === "gif" ? artifact.url : null,
  duration: artifact.duration,
});
```

On `RendererError`, retain the legacy `error` string while also returning `diagnostics`.

- [ ] **Step 4: Verify and commit**

```bash
pnpm test src/lib/generation/renderer-client.test.ts
pnpm typecheck
pnpm eslint src/lib/generation/renderer-client.ts src/app/api/render/route.ts
git add src/lib/generation/renderer-client.ts src/lib/generation/renderer-client.test.ts src/app/api/render/route.ts .env.example
git diff --cached --check
git commit -m "feat: bridge structured renderer results"
```

### Task 6: Build the bounded generation orchestrator

**Files:**
- Create: `src/lib/generation/repair-code.ts`
- Create: `src/lib/generation/orchestrator.ts`
- Create: `src/lib/generation/active-jobs.ts`
- Test: `src/lib/generation/orchestrator.test.ts`

**Interfaces:**

```ts
interface GenerationDependencies {
  store: GenerationJobStore;
  renderer: RendererClient;
  planScene(input: CreateGenerationJobInput, signal: AbortSignal): Promise<ScenePlan>;
  generateCode(input: {
    request: CreateGenerationJobInput;
    plan: ScenePlan;
    signal: AbortSignal;
  }): Promise<string>;
  repairCode(input: {
    code: string;
    issues: ValidationIssue[];
    prompt: string;
    signal: AbortSignal;
  }): Promise<string>;
}

function ensureGenerationStarted(
  jobId: string,
  dependencies?: GenerationDependencies,
): Promise<void>;

function cancelActiveGeneration(jobId: string): Promise<boolean>;
```

- [ ] **Step 1: Write stateful orchestration tests before implementation**

Use a memory store, deferred promises, and fake model/renderer functions. Assert:

1. A successful generate job emits `job.accepted`, `phase.changed` with planning, `plan.ready`, `phase.changed` with generating, `version.created`, `phase.changed` with validating, `validation.completed`, `phase.changed` with rendering, `render.completed`, then `job.completed` in that exact order.
2. Three failed render attempts cause exactly two repair model calls and emit `job.failed` with a recoverable version.
3. User takeover while generation is deferred increments the run token and prevents late generated code from overwriting the manual version.
4. `render`, `repair`, and `high_quality_render` take their dedicated paths instead of calling the initial scene planner.

```bash
pnpm test src/lib/generation/orchestrator.test.ts
```

Expected: fail because the orchestrator does not exist.

- [ ] **Step 2: Implement one-call repair semantics**

`repairCode` performs exactly one model request whose response must be a complete Manim Python module. Validate that it contains one `Scene` subclass before accepting it. Do not retain the current diff-first request followed by a second full-code fallback request.

- [ ] **Step 3: Implement bounded operation pipelines**

- `generate`: plan, retrieve, generate, validate, quick render, then at most two repair/validate/quick-render cycles.
- `render`: validate current code, then quick render.
- `repair`: one user-requested repair, validate, then quick render.
- `high_quality_render`: validate the selected version, then render with `-qh`; never mutate its code.

Before and after every awaited stage, load the job and compare its `runToken`:

```ts
async function checkpoint(jobId: string, expectedRunToken: number) {
  const current = await dependencies.store.getJobById(jobId);
  if (!current || current.runToken !== expectedRunToken) {
    throw new DOMException("Generation superseded", "AbortError");
  }
}
```

Pass the same `AbortSignal` through retrieval, model, validation, and rendering. On cancellation, abort the model request and call `cancelManimRender(requestId)`.

- [ ] **Step 4: Keep active promises in a hot-process registry**

Use `Symbol.for("mathiverse.generation.activeJobs")` on `globalThis`:

```ts
type ActiveJob = {
  promise: Promise<void>;
  controller: AbortController;
  runToken: number;
  startedAt: number;
};
```

This registry deduplicates starts only in the current Node process. Supabase snapshots/events remain authoritative. After a process restart, mark a previously `running` job as `interrupted` and allow retry; do not claim in-memory work resumes automatically. Persist only meaningful events; SSE heartbeats are transport traffic.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test src/lib/generation/orchestrator.test.ts
pnpm typecheck
pnpm eslint src/lib/generation
git add src/lib/generation/repair-code.ts src/lib/generation/orchestrator.ts src/lib/generation/active-jobs.ts src/lib/generation/orchestrator.test.ts
git diff --cached --check
git commit -m "feat: orchestrate validated generation jobs"
```

### Task 7: Expose owner-scoped job and SSE APIs

**Files:**
- Create: `src/lib/generation/request-validation.ts`
- Create: `src/lib/generation/request-owner.ts`
- Create: `src/lib/generation/sse.ts`
- Create: `src/app/api/generation/jobs/route.ts`
- Create: `src/app/api/generation/jobs/[jobId]/route.ts`
- Create: `src/app/api/generation/jobs/[jobId]/events/route.ts`
- Test: `src/lib/generation/request-validation.test.ts`
- Test: `src/lib/generation/sse.test.ts`
- Test: `src/app/api/generation/jobs/route.test.ts`

**Interfaces:**

```http
POST /api/generation/jobs
GET /api/generation/jobs/:jobId
PATCH /api/generation/jobs/:jobId
GET /api/generation/jobs/:jobId/events?after=<event-id>
```

- [ ] **Step 1: Write failing validation and SSE tests**

Test these boundaries:

- `prompt` is required for `generate` and limited to 8,000 characters.
- `currentCode` is optional for a genuinely new `generate`, required for `render`, `repair`, and `high_quality_render`, and limited to 50,000 characters.
- quality, format, and operation reject unknown values.
- `serializeSseEvent(event)` emits `id:`, `event:`, one JSON `data:` line, and a blank line.
- replay starts strictly after the cursor and preserves ascending event ID order.

- [ ] **Step 2: Resolve and sign anonymous ownership**

`request-owner.ts` first checks the existing Supabase auth user. If absent, read or create a random anonymous ID signed with HMAC-SHA256 using `GENERATION_SESSION_SECRET`; store it in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production cookie. If the secret is missing outside tests, return 503 instead of accepting an unsigned owner.

All read, update, and event queries include the owner. Return 404 for another owner's ID so its existence is not disclosed.

- [ ] **Step 3: Implement fast, bounded acceptance**

POST validates the body, rejects a second active job for the same owner with 409, creates the snapshot/event, starts the orchestrator without awaiting it, and returns within one second:

```ts
return NextResponse.json(
  { jobId: job.id, status: "accepted", snapshot: job },
  { status: 202 },
);
```

GET returns the snapshot. PATCH accepts only `cancel`, `retry`, `take_over`, `save_manual_version`, `rollback`, and `publish`; cancel/takeover increments `runToken`, retry is legal only for a terminal failed/interrupted job, and rollback/publish validates version ownership.

- [ ] **Step 4: Implement resumable SSE**

The events route exports:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
```

Read the cursor from `Last-Event-ID` first, then `after`. Replay persisted events, call `ensureGenerationStarted(jobId)`, poll for new events, and send `: heartbeat\n\n` every ten seconds while idle.

Return:

```ts
{
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
}
```

Do not use `after()` as a durable worker; its lifetime remains bounded by the route/platform duration.

- [ ] **Step 5: Verify security, replay, and acceptance latency**

```bash
pnpm test src/lib/generation/request-validation.test.ts src/lib/generation/sse.test.ts src/app/api/generation/jobs/route.test.ts
pnpm typecheck
pnpm eslint src/lib/generation src/app/api/generation
```

Add a route test with a deferred orchestrator and assert POST returns 202 before deferred work resolves. Add owner A/owner B tests proving B receives 404 for A's snapshot and events.

- [ ] **Step 6: Commit the API surface**

```bash
git add src/lib/generation/request-validation.ts src/lib/generation/request-owner.ts src/lib/generation/sse.ts src/lib/generation/request-validation.test.ts src/lib/generation/sse.test.ts src/app/api/generation
git diff --cached --check
git commit -m "feat: stream resumable generation jobs"
```

### Task 8: Build the resumable client state layer

**Files:**
- Create: `src/components/sandbox/client-state.ts`
- Create: `src/components/sandbox/client-api.ts`
- Create: `src/components/sandbox/use-generation-job.ts`
- Test: `src/components/sandbox/client-state.test.ts`

**State:**

```ts
type StudioClientState = {
  activeJobId: string | null;
  snapshot: GenerationJobSnapshot | null;
  events: GenerationEvent[];
  connection: "idle" | "connecting" | "open" | "reconnecting" | "closed";
  editorCode: string;
  hasAuthoritativeCode: boolean;
  selectedVersionId: string | null;
  activeMobilePanel: "task" | "canvas" | "code";
  isTakingOver: boolean;
  error: string | null;
};
```

- [ ] **Step 1: Write reducer tests for ordering and takeover safety**

Cover event-ID deduplication, reconnect snapshots, active mobile panel retention, rollback selection, and this race: job A is generating, the user takes over and starts job B, then a late `version.created` from A arrives; the editor must keep B/manual code.

- [ ] **Step 2: Implement typed API helpers**

`client-api.ts` exposes `createGenerationJob`, `getGenerationJob`, and `patchGenerationJob`, parses non-2xx responses into a typed client error, and never imports server-only modules.

- [ ] **Step 3: Implement `useGenerationJob`**

Return:

```ts
{
  state,
  submitPrompt,
  renderManually,
  repairManually,
  renderHighQuality,
  cancel,
  takeOver,
  saveManualVersion,
  rollback,
  retry,
  publish,
  selectVersion,
  selectMobilePanel,
}
```

Open an `EventSource` for the active job so cookies and browser-native reconnect/`Last-Event-ID` behavior are preserved. On transport failure, mark `reconnecting`; separately fetch the snapshot so the UI remains informative. Close the old source before switching jobs.

When a job is created, update the URL with `history.replaceState` to add `job=<id>` while preserving `prompt` and `fork`. For a fresh prompt with `hasAuthoritativeCode=false`, send `currentCode: null`; never send the decorative placeholder as editing context.

- [ ] **Step 4: Verify and commit**

```bash
pnpm test src/components/sandbox/client-state.test.ts
pnpm typecheck
pnpm eslint src/components/sandbox/client-state.ts src/components/sandbox/client-api.ts src/components/sandbox/use-generation-job.ts
git add src/components/sandbox/client-state.ts src/components/sandbox/client-api.ts src/components/sandbox/use-generation-job.ts src/components/sandbox/client-state.test.ts
git diff --cached --check
git commit -m "feat: resume generation state in the client"
```

### Task 9: Build the responsive immersive Studio UI

**Files:**
- Create: `src/components/sandbox/studio-layout.ts`
- Test: `src/components/sandbox/studio-layout.test.ts`
- Create: `src/components/sandbox/generation-status.tsx`
- Create: `src/components/sandbox/studio-task-rail.tsx`
- Create: `src/components/sandbox/studio-canvas.tsx`
- Create: `src/components/sandbox/version-strip.tsx`
- Create: `src/components/sandbox/studio-shell.tsx`
- Create: `src/components/sandbox/sandbox-studio.module.css`
- Modify: `src/components/sandbox/code-editor.tsx`

**Responsive contract:**

- Mobile: below 768 px.
- Tablet: 768--1199 px.
- Desktop: 1200 px and above.

- [ ] **Step 1: Test the pure layout/state derivation**

Implement failing table tests for `deriveStudioLayout(width, orientation)`:

| Viewport | Expected layout |
| --- | --- |
| 390 × 844 | one panel plus bottom tabs |
| 844 × 390 | two-panel landscape split |
| 768 × 1024 | task rail plus canvas; code drawer |
| 1024 × 768 | compact three-region grid |
| 1440 × 900 | full task/canvas/code grid |

Also test `getCanvasState(snapshot)` returns exactly one of `idle`, `working`, `preview`, or `error`.

- [ ] **Step 2: Implement status, task rail, canvas, and versions**

- `GenerationStatus` has one `aria-live="polite"` region for phase-level copy such as “正在规划镜头”; never announce token chunks.
- `StudioTaskRail` exposes prompt, progress steps, stop, take over, render, repair, high-quality render, rollback, and publish. Every touch target is at least 44 × 44 CSS pixels.
- `StudioCanvas` renders the four-state union and uses a real `<video controls playsInline>` for completed MP4; media load failure becomes an actionable error state.
- `VersionStrip` labels versions by source and validation/render result and keeps selection keyboard reachable.

Dialog/drawer variants trap focus, restore it to their trigger on close, close on Escape, and expose an accessible name.

- [ ] **Step 3: Build a quiet, immersive visual system**

Use a near-black ink background, restrained teal/cyan accents, warm paper text, fine grid lines, and subtle depth. Do not reintroduce particles, purple AI gradients, glass-card stacks, or excessive glowing pills. Desktop CSS starts from:

```css
.studio {
  --studio-ink: #071012;
  --studio-panel: #0d181a;
  --studio-line: rgba(190, 232, 225, 0.14);
  --studio-accent: #79d8c7;
  --studio-paper: #e8f1ed;
  display: grid;
  grid-template-columns: minmax(16rem, 0.72fr) minmax(28rem, 1.55fr) minmax(22rem, 1fr);
  min-height: calc(100dvh - var(--header-height));
}
```

At tablet widths keep the task rail visible, promote the canvas, and move code to a drawer. At mobile widths show one active region with bottom tabs; in landscape show canvas and the selected secondary panel side-by-side. Use container-safe `min-width: 0`, `overflow-wrap: anywhere`, and scrollable internal regions so no document-level horizontal overflow appears.

- [ ] **Step 4: Make editor updates authoritative and motion-safe**

Add:

```ts
type CodeEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  applyChanges?: CodeChange[] | null;
  onChangesDone?: () => void;
  externalUpdateMode?: "immediate" | "paint";
};
```

Default to the existing `paint` behavior for Mini Sandbox compatibility. Studio passes `immediate` when applying versions, repairs, or rollback. If `prefers-reduced-motion: reduce`, apply external code immediately. Remove the duplicate CodeMirror update listener so one edit dispatch produces one `onChange`.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test src/components/sandbox/studio-layout.test.ts
pnpm typecheck
pnpm eslint src/components/sandbox
git add src/components/sandbox/studio-layout.ts src/components/sandbox/studio-layout.test.ts src/components/sandbox/generation-status.tsx src/components/sandbox/studio-task-rail.tsx src/components/sandbox/studio-canvas.tsx src/components/sandbox/version-strip.tsx src/components/sandbox/studio-shell.tsx src/components/sandbox/sandbox-studio.module.css src/components/sandbox/code-editor.tsx
git diff --cached --check
git commit -m "feat: build responsive generation studio"
```

### Task 10: Integrate the Studio route and transition

**Files:**
- Modify: `src/app/sandbox/page.tsx`
- Modify: `src/app/sandbox/sandbox-content.tsx`
- Modify: `src/components/layout/app-header.tsx`
- Modify: `src/app/globals.css`
- Verify unchanged contracts: `src/hooks/use-chat.ts`
- Verify unchanged contracts: `src/components/wiki/mini-sandbox.tsx`

- [ ] **Step 1: Pass the resumable job through the Server Component**

Update the page search-parameter contract to include `job` alongside `prompt` and `fork`, then pass normalized strings into the client component. Follow the installed Next 16.3 page/searchParams guide; do not add a client-only search-param wrapper.

- [ ] **Step 2: Distinguish placeholder code from real editing context**

Rename the current default example to `PLACEHOLDER_CODE` and initialize `hasAuthoritativeCode=false` for a plain or homepage-prompt visit. Set it true only when code comes from a fork, Wiki handoff, saved/manual version, or generated version. Prefill a homepage prompt but do not auto-send it; submitting a new prompt sends `currentCode: null`.

- [ ] **Step 3: Replace only the main Sandbox workflow**

`SandboxContent` mounts `StudioShell` and `useGenerationJob`, removing its particle background, direct `/api/render` request, and main-route `useChat` flow. Keep `/api/chat`, `/api/chat/fix`, `/api/render`, `useChat`, and Mini Sandbox operational for their existing Wiki consumers.

Wire stop, take over, quick render, manual repair, high-quality render, version selection, rollback, and publish. After takeover, later model events cannot replace the editor until the user explicitly starts another operation.

- [ ] **Step 4: Give the route a stable Studio header**

Extend the header appearance union with `"studio"`. It uses the same dark ink surface and subtle lower border as the Studio, keeps the existing logo/auth/navigation behavior, and does not change gallery/default pages.

- [ ] **Step 5: Add an immersive but non-blocking entrance**

Use transform/opacity-only CSS animations:

- First Studio visit in the session: shell 780 ms, canvas 820 ms, task/code delays 70/140 ms.
- Returning to an existing `job`: 200 ms opacity settle.
- Reduced motion: no transform and at most 150 ms opacity.

Store only a presentation marker in `sessionStorage`; job truth stays in the snapshot. Controls are enabled immediately and animation layers use `pointer-events: none`, so the transition never blocks clicks or keyboard focus.

- [ ] **Step 6: Run integration gates and commit**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
git add src/app/sandbox/page.tsx src/app/sandbox/sandbox-content.tsx src/components/layout/app-header.tsx src/app/globals.css
git diff --cached --check
git commit -m "feat: launch immersive AI sandbox"
```

### Task 11: Add multi-viewport E2E and real-pipeline acceptance

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `playwright.config.ts`
- Create: `e2e/sandbox-studio.spec.ts`
- Create: `e2e/sandbox-studio-accessibility.spec.ts`
- Create: `scripts/verify-generation-flow.mjs`
- Modify: `renderer/README.md`

- [ ] **Step 1: Install and configure Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Add scripts without removing existing ones:

```json
{
  "scripts": {
    "test:renderer": "python -m unittest discover -s renderer/tests -p 'test_*.py' -v",
    "test:e2e": "playwright test",
    "check": "pnpm test && pnpm test:renderer && pnpm typecheck && pnpm lint && pnpm build"
  }
}
```

Configure `webServer.command = "pnpm dev"`, `webServer.url = "http://127.0.0.1:3000"`, and five Chromium projects:

| Project | Viewport |
| --- | --- |
| mobile-portrait | 390 × 844 |
| mobile-landscape | 844 × 390 |
| tablet-portrait | 768 × 1024 |
| tablet-landscape | 1024 × 768 |
| desktop | 1440 × 900 |

- [ ] **Step 2: Drive the real client with deterministic network fixtures**

Use Playwright route handlers to mock the job/SSE network boundary with the real `GenerationJobSnapshot` and `GenerationEvent` wire format; do not mock React state or component internals. Cover:

- accepted → planning → generating → validating → rendering → completed;
- reconnect followed by snapshot reconciliation and event deduplication;
- stop and user takeover rejecting a late version event;
- validation failure with manual repair recovery;
- media failure with retry controls;
- high-quality render as a child operation;
- long prompt, diagnostic, version, and code content.

- [ ] **Step 3: Assert responsive layout rather than trusting screenshot dimensions**

In every project assert `window.innerWidth/innerHeight` exactly match the requested viewport, `document.documentElement.scrollWidth <= innerWidth`, primary controls are visible and keyboard reachable, and the expected mobile/tablet/desktop layout mode is active. This prevents a browser minimum-viewport crop from being mistaken for an application overflow.

Capture stable screenshots for idle, working, preview, error, code-open, and long-content states in all five projects.

- [ ] **Step 4: Verify accessibility and motion**

Test keyboard-only prompt submission, panel switching, version selection, drawer focus trap/restore, Escape close, and video controls. Assert the live region reports phase changes but not token fragments.

Add a reduced-motion project/describe block with `reducedMotion: "reduce"`: the entrance completes within 180 ms and no element has a non-none transform animation. In normal motion, measure the first-session shell transition between 700 and 900 ms while proving the primary control is clickable during it.

- [ ] **Step 5: Add an opt-in real pipeline smoke script**

`scripts/verify-generation-flow.mjs` requires `GENERATION_SMOKE_BASE_URL`, renderer availability, and the relevant AI/Supabase credentials. It must:

1. create a simple geometry prompt and require 202 within one second;
2. consume SSE for at most five minutes;
3. observe planning, generation, validation, rendering, one generated version, and a playable media URL;
4. request a high-quality child operation and verify its artifact;
5. exit nonzero on timeout, invalid code, missing event, or missing render;
6. never print secrets, raw cookies, or authorization headers.

Document this opt-in check in `renderer/README.md`; it is not part of the credential-free CI command.

- [ ] **Step 6: Run automated acceptance**

```bash
pnpm check
pnpm test:e2e
```

Expected: unit tests, Python tests, typecheck, lint, production build, five viewports, keyboard/accessibility, reconnect, media failure, long-content, and reduced-motion cases all pass.

- [ ] **Step 7: Run the real acceptance flow when credentials are available**

```bash
GENERATION_SMOKE_BASE_URL=http://127.0.0.1:3000 node scripts/verify-generation-flow.mjs
```

Record prompt-to-accepted, prompt-to-first-plan, prompt-to-first-version, prompt-to-preview, repair attempts, cache hit, and high-quality render duration. Keep the exact model chain in server logs/metadata, not user-facing reasoning text.

- [ ] **Step 8: Perform the final visual and repository audit**

Review the captured five-viewport screenshots for hierarchy, clipping, text contrast, stable header alignment, and harmony with the Mathiverse gallery. Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated user work remains untouched and uncommitted.

- [ ] **Step 9: Commit acceptance tooling**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts e2e/sandbox-studio.spec.ts e2e/sandbox-studio-accessibility.spec.ts scripts/verify-generation-flow.mjs renderer/README.md
git diff --cached --check
git commit -m "test: verify generation studio end to end"
```

## Completion Criteria

- A fresh prompt is accepted without sending placeholder code as editing context.
- Users see durable, resumable phase feedback throughout long model and render work.
- Generated code is validated and successfully rendered before it becomes the primary preview.
- Automatic repair is bounded to two attempts; manual repair remains available.
- Stop, takeover, rollback, quick render, high-quality render, and publish remain functional.
- Legacy Wiki/Mini Sandbox chat and render contracts remain functional.
- The Studio is coherent with Mathiverse, immersive without blocking interaction, and verified at all five viewports.
- `pnpm check` and `pnpm test:e2e` exit 0; the optional credentialed smoke flow passes in its configured environment.
