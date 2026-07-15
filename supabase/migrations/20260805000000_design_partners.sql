-- lib/design-partner/partners.ts was a single, non-persistent, process-global
-- in-memory Map with no organization scoping at all -- every tenant shared
-- the same 5 hardcoded demo records, and its API routes had zero auth check,
-- so any request (logged in or not) could mutate it. This is a platform-level
-- concern (companies piloting DigiT itself), not per-tenant data, so it gets
-- its own global table rather than an organization_id column -- access is
-- restricted at the API layer to platform admins only.

CREATE TABLE IF NOT EXISTS design_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'awareness' CHECK (stage IN ('awareness', 'evaluation', 'pilot', 'launch', 'advocate')),
  vertical TEXT,
  feedback_score INTEGER NOT NULL DEFAULT 0,
  last_touchpoint DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'awareness';
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS vertical TEXT;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS feedback_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS last_touchpoint DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE design_partners ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE design_partners ENABLE ROW LEVEL SECURITY;

-- Platform-level data with no organization_id -- only the service-role
-- client (used exclusively behind the requirePlatformAdmin-gated API routes)
-- may read/write; no anon/authenticated policy is granted.
DROP POLICY IF EXISTS "Service role only" ON design_partners;
CREATE POLICY "Service role only" ON design_partners FOR ALL
  USING (false) WITH CHECK (false);
