-- lib/hr/skill-matrix.ts was a single shared in-memory demo (CATALOGS/
-- ASSESSMENTS/USERS module constants) -- every org read and wrote the same
-- process-local arrays, and anything submitted via POST /api/v1/hr/skills
-- was lost on every restart/redeploy. Give the skill matrix real per-tenant
-- tables: a catalog each org gets its own seeded copy of on first read, and
-- an assessments table keyed by (org, user, skill) so submissions persist.
-- Team members reuse the existing real `profiles.organization_id` roster
-- (same source used by getOrganizationId/RLS org checks elsewhere) instead
-- of inventing a parallel fake user list.

CREATE TABLE IF NOT EXISTS hr_skill_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'technical',
  expected_level TEXT NOT NULL DEFAULT 'intermediate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hr_skill_catalog ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE hr_skill_catalog ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE hr_skill_catalog ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'technical';
ALTER TABLE hr_skill_catalog ADD COLUMN IF NOT EXISTS expected_level TEXT NOT NULL DEFAULT 'intermediate';
ALTER TABLE hr_skill_catalog ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_hr_skill_catalog_org ON hr_skill_catalog(organization_id);

CREATE TABLE IF NOT EXISTS hr_skill_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES hr_skill_catalog(id) ON DELETE CASCADE,
  actual_level TEXT NOT NULL DEFAULT 'beginner',
  notes TEXT,
  last_assessed DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS skill_id UUID;
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS actual_level TEXT NOT NULL DEFAULT 'beginner';
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS last_assessed DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE hr_skill_assessments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_skill_assessments_org_user_skill ON hr_skill_assessments(organization_id, user_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_org ON hr_skill_assessments(organization_id);

ALTER TABLE hr_skill_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org skill catalog" ON hr_skill_catalog;
CREATE POLICY "Users can view their org skill catalog" ON hr_skill_catalog FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE hr_skill_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org skill assessments" ON hr_skill_assessments;
CREATE POLICY "Users can view their org skill assessments" ON hr_skill_assessments FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
