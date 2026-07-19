-- app/(dashboard)/settings/page.tsx's API Keys panel (generate/list/revoke)
-- and lib/multitenant/database.ts's tenant-provisioning step both read/write
-- an "api_keys" table that no migration ever created. A prior cleanup commit
-- ("fix: remove remaining invalid API routes and ensure clean build") deleted
-- app/api/v1/api-keys/route.ts as a result, leaving the directory empty and
-- the frontend's calls 404ing. This restores the table so that route (and
-- the tenant-provisioning insert) can be restored too.

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'API Key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '["read", "write"]',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'API Key';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes JSONB NOT NULL DEFAULT '["read", "write"]';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org api keys" ON api_keys;
CREATE POLICY "Users can view their org api keys" ON api_keys FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
