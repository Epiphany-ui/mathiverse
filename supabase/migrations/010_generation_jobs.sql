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
