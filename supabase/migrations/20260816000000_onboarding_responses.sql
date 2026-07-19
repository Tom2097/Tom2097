-- app/onboarding/page.tsx's questionnaire (industry, company size, goals,
-- challenges, compliance requirements) and identity-verification fields
-- (fullLegalName, governmentIdType, companyRegistrationNumber,
-- acceptedTerms) were only ever written to localStorage ("digit_questionnaire")
-- and never sent to the server -- only the final selectedModules array made
-- it to profiles.selected_modules via the "complete" action below. This adds
-- a place to persist the rest server-side.

CREATE TABLE IF NOT EXISTS onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,

  -- Step 2: Industry & Size
  industry TEXT,
  sub_industry TEXT,
  company_size TEXT,
  employee_count_range TEXT,
  annual_revenue_range TEXT,
  business_stage TEXT,
  geographic_scope TEXT,

  -- Step 3: Goals & Challenges
  primary_goals JSONB NOT NULL DEFAULT '[]',
  current_challenges JSONB NOT NULL DEFAULT '[]',
  warmup_response TEXT,

  -- Step 4: Technical Readiness
  technical_maturity TEXT,
  existing_tools JSONB NOT NULL DEFAULT '[]',
  budget_range TEXT,
  timeline_urgency TEXT,
  compliance_requirements JSONB NOT NULL DEFAULT '[]',

  -- Step 5: Identity Verification
  full_legal_name TEXT,
  government_id_type TEXT,
  company_registration_number TEXT,
  verified_domain TEXT,
  terms_accepted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS sub_industry TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS employee_count_range TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS annual_revenue_range TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS business_stage TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS geographic_scope TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS primary_goals JSONB NOT NULL DEFAULT '[]';
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS current_challenges JSONB NOT NULL DEFAULT '[]';
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS warmup_response TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS technical_maturity TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS existing_tools JSONB NOT NULL DEFAULT '[]';
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS budget_range TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS timeline_urgency TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS compliance_requirements JSONB NOT NULL DEFAULT '[]';
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS full_legal_name TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS government_id_type TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS verified_domain TEXT;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE onboarding_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user ON onboarding_responses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_onboarding_responses_user_unique ON onboarding_responses(user_id);

ALTER TABLE onboarding_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own onboarding response" ON onboarding_responses;
CREATE POLICY "Users can view their own onboarding response" ON onboarding_responses FOR SELECT
  USING (user_id = auth.uid());
