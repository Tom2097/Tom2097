-- lib/simulation/workspace-simulator.ts had no server guard, so importing
-- it directly into the "use client" /simulate page bundled it into the
-- browser -- creating simulations there populated a browser-local Map,
-- while the server-side commit/discard API routes imported the SAME file
-- but got a separate, empty server-side Map instance. Commit/Discard threw
-- "Simulation not found" on every call, and nothing was ever persisted.

CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  workspace_id TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'committed', 'discarded')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  committed_at TIMESTAMPTZ
);
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS workspace_id TEXT;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS changes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS committed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_simulations_org_workspace ON simulations(organization_id, workspace_id);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org simulations" ON simulations;
CREATE POLICY "Users can view their org simulations" ON simulations FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
