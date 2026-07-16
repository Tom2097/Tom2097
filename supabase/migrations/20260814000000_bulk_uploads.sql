-- lib/bulk/processor.ts was pure in-memory (Map-backed, Math.random()
-- progress and success/failure) and the bulk page never even called the
-- real, already-auth-checked /api/v1/bulk routes -- it imported the fake
-- processor directly client-side with a hardcoded 'default' orgId.

INSERT INTO storage.buckets (id, name, public)
VALUES ('bulk-uploads', 'bulk-uploads', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS bulk_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS error_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE bulk_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bulk_jobs_org ON bulk_jobs(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bulk_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES bulk_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  extracted_data JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS job_id UUID;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS extracted_data JSONB;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE bulk_files ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_bulk_files_job ON bulk_files(job_id);

ALTER TABLE bulk_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view their bulk jobs" ON bulk_jobs;
CREATE POLICY "Org members can view their bulk jobs" ON bulk_jobs FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE bulk_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view their bulk files" ON bulk_files;
CREATE POLICY "Org members can view their bulk files" ON bulk_files FOR SELECT
  USING (job_id IN (
    SELECT id FROM bulk_jobs WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));
