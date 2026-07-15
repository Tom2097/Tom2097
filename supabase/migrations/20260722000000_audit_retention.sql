-- Backs lib/audit/retention.ts, rendered on the real
-- app/(dashboard)/platform/admin/security/page.tsx page via
-- components/digit/audit-retention.tsx. (dunning_attempts, hitl_reviews,
-- and workspace_events -- the rest of this batch's original candidates --
-- were confirmed to have zero callers anywhere in the repo and are
-- deliberately skipped rather than migrated for dead code.)

CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  retention_period_days INTEGER NOT NULL DEFAULT 365,
  apply_to TEXT NOT NULL DEFAULT 'all',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS retention_period_days INTEGER NOT NULL DEFAULT 365;
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS apply_to TEXT NOT NULL DEFAULT 'all';
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE audit_retention_policies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_audit_retention_policies_org ON audit_retention_policies(organization_id);

-- Read-only in the current code (no insert path found) -- the run/purge
-- job that would write here isn't wired up yet; created so the read side
-- doesn't error, with a reasonable inferred shape for when it is.
CREATE TABLE IF NOT EXISTS audit_retention_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  policy_id UUID,
  table_name TEXT,
  records_purged INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS policy_id UUID;
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS records_purged INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE audit_retention_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_audit_retention_history_org ON audit_retention_history(organization_id);

ALTER TABLE audit_retention_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_retention_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org retention policies" ON audit_retention_policies;
CREATE POLICY "Users can view their org retention policies" ON audit_retention_policies FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org retention history" ON audit_retention_history;
CREATE POLICY "Users can view their org retention history" ON audit_retention_history FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
