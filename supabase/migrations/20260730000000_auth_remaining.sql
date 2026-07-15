-- Second pass: remaining dead-code Auth/Security tables (zero live
-- callers, or only reachable via the orphaned /secure-onboarding page),
-- migrated per explicit request to leave nothing from the audit out.

-- lib/auth/device-replay.ts's verifyDeviceBinding() queries user_devices by
-- a "device_id" column distinct from the credential_id-based schema
-- already migrated -- backfilled as an extra nullable column.
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE TABLE IF NOT EXISTS abac_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_key TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '[]',
  effect TEXT NOT NULL DEFAULT 'allow',
  priority INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE abac_rules ADD COLUMN IF NOT EXISTS permission_key TEXT;
ALTER TABLE abac_rules ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE abac_rules ADD COLUMN IF NOT EXISTS effect TEXT NOT NULL DEFAULT 'allow';
ALTER TABLE abac_rules ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_abac_rules_permission ON abac_rules(permission_key, priority);

CREATE TABLE IF NOT EXISTS consumed_passcodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passcode_hash TEXT NOT NULL,
  device_id TEXT,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE consumed_passcodes ADD COLUMN IF NOT EXISTS passcode_hash TEXT;
ALTER TABLE consumed_passcodes ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE consumed_passcodes ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_consumed_passcodes_hash ON consumed_passcodes(passcode_hash);

CREATE TABLE IF NOT EXISTS replay_attempt_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT,
  user_id UUID,
  code_hash TEXT,
  attempt_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS code_hash TEXT;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS attempt_type TEXT;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE replay_attempt_log ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_replay_attempt_log_device_time ON replay_attempt_log(device_id, timestamp);

CREATE TABLE IF NOT EXISTS magic_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  redirect_to TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS redirect_to TEXT;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_email_time ON magic_link_tokens(email, created_at);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS access_token TEXT;
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider, provider_id);

CREATE TABLE IF NOT EXISTS kyc_verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  confidence_score NUMERIC,
  face_match BOOLEAN,
  id_valid BOOLEAN,
  id_type TEXT,
  id_number TEXT,
  name_match BOOLEAN,
  name_on_id TEXT,
  date_of_birth TEXT,
  address_match BOOLEAN,
  address_on_id TEXT,
  verification_method TEXT,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  manual_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS face_match BOOLEAN;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS id_valid BOOLEAN;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS name_match BOOLEAN;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS name_on_id TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS address_match BOOLEAN;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS address_on_id TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS verification_method TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS manual_review_notes TEXT;
ALTER TABLE kyc_verification_results ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_kyc_verification_results_user ON kyc_verification_results(user_id, created_at);

CREATE TABLE IF NOT EXISTS kyc_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  selfie_image TEXT,
  id_type TEXT,
  id_number TEXT,
  id_front_image TEXT,
  id_back_image TEXT,
  full_name TEXT,
  date_of_birth TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS selfie_image TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS id_front_image TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS id_back_image TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE kyc_verification_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_kyc_verification_reviews_status ON kyc_verification_reviews(status);

CREATE TABLE IF NOT EXISTS company_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  company_name TEXT,
  registration_number TEXT,
  country TEXT,
  website TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE company_verification_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_company_verification_reviews_status ON company_verification_reviews(status);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_org_user ON organization_members(organization_id, user_id);

CREATE TABLE IF NOT EXISTS role_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  requested_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  notes TEXT
);
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS requested_role TEXT;
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE role_approval_requests ADD COLUMN IF NOT EXISTS notes TEXT;
CREATE INDEX IF NOT EXISTS idx_role_approval_requests_org_status ON role_approval_requests(organization_id, status);

CREATE TABLE IF NOT EXISTS workspace_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE workspace_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_users_user_workspace ON workspace_users(user_id, workspace_id);

ALTER TABLE abac_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumed_passcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_attempt_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE magic_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verification_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_verification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own oauth accounts" ON oauth_accounts;
CREATE POLICY "Users can view their own oauth accounts" ON oauth_accounts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own kyc results" ON kyc_verification_results;
CREATE POLICY "Users can view their own kyc results" ON kyc_verification_results FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own kyc reviews" ON kyc_verification_reviews;
CREATE POLICY "Users can view their own kyc reviews" ON kyc_verification_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own company verification reviews" ON company_verification_reviews;
CREATE POLICY "Users can view their own company verification reviews" ON company_verification_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their org members" ON organization_members;
CREATE POLICY "Users can view their org members" ON organization_members FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org role approval requests" ON role_approval_requests;
CREATE POLICY "Users can view their org role approval requests" ON role_approval_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their own workspace access" ON workspace_users;
CREATE POLICY "Users can view their own workspace access" ON workspace_users FOR SELECT
  USING (auth.uid() = user_id);
