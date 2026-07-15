-- Final pass: remaining legacy CRM-naming tables (dead code, zero live
-- callers), migrated per explicit request to leave nothing from the
-- missing-tables audit out. Distinct from the already-migrated crm_*
-- prefixed tables. Backs lib/crm/lead-scoring.ts, lib/intelligence/
-- predictive.ts's predictDealCloseRisk, and lib/company/registry-
-- verification.ts's getCompanyVerificationStatus.

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  name TEXT,
  website TEXT,
  industry TEXT,
  size TEXT,
  phone TEXT,
  address TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  registration_number TEXT,
  status TEXT,
  verification_method TEXT,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  manual_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS manual_review_notes TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_companies_org ON companies(organization_id);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT,
  amount NUMERIC,
  value NUMERIC,
  stage TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS amount NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS value NUMERIC;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'open';
ALTER TABLE deals ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_org ON deals(organization_id);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE activities ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_activities_company ON activities(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_org ON activities(organization_id);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org companies" ON companies;
CREATE POLICY "Users can view their org companies" ON companies FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org deals" ON deals;
CREATE POLICY "Users can view their org deals" ON deals FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org activities" ON activities;
CREATE POLICY "Users can view their org activities" ON activities FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
