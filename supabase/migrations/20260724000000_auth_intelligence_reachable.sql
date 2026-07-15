-- Backs the confirmed-reachable subset of the Auth/Security/Platform-Admin
-- and AI Intelligence table gaps (see the missing-tables audit). A
-- dedicated research pass confirmed each of these has a real page a user
-- can navigate to today: break-glass/impersonation/JIT admin pages,
-- WebAuthn login, the admin monitoring/DSAR pages, and the /intelligence
-- page's default briefing/findings tab. The rest of that audit's AUTH/
-- Intelligence candidates (agents, causal/operational graph, correlated
-- events, ai_models/datasets, magic links, OAuth, KYC, device-replay,
-- ABAC, organization_members/role_approval) were confirmed to have zero
-- live callers or only reach the orphaned /secure-onboarding page, and are
-- deliberately not migrated here.

CREATE TABLE IF NOT EXISTS break_glass_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  admin_name TEXT,
  admin_email TEXT,
  reason TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'platform_admin',
  status TEXT NOT NULL DEFAULT 'active',
  alarm_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS admin_id UUID;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS admin_name TEXT;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS admin_email TEXT;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'platform_admin';
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS alarm_triggered BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_break_glass_sessions_admin ON break_glass_sessions(admin_id);

CREATE TABLE IF NOT EXISTS impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  target_email TEXT,
  target_organization_id UUID,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS admin_user_id UUID;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS target_user_id UUID;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS target_email TEXT;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS target_organization_id UUID;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS consent_granted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE impersonation_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin ON impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_target ON impersonation_sessions(target_user_id);

CREATE TABLE IF NOT EXISTS jit_elevation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  requested_role TEXT NOT NULL,
  reason TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  denial_reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS requested_role TEXT;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS denial_reason TEXT;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE jit_elevation_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_jit_elevation_requests_user ON jit_elevation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_jit_elevation_requests_status ON jit_elevation_requests(status);

-- A migration file for this already exists (20260704180000_add_user_devices.sql)
-- but -- same pattern as everything else in this audit -- was apparently
-- never actually applied. Re-declared here defensively; backs the real
-- passkey button on the live /auth/login page.
CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'unknown',
  transports TEXT[],
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS credential_id TEXT;
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS counter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS transports TEXT[];
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS device_name TEXT;
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE user_devices ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_credential ON user_devices(credential_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id);

-- Snake_case, matching the read side (lib/observability/dashboard.ts's
-- admin-monitoring query, "changed_at"). Note: impersonation.ts/
-- jit-access.ts's createAuditEntry() inserts with camelCase JS keys
-- (tableName, changedAt, ...) -- a pre-existing mismatch that will
-- continue to silently no-op on insert (its result is never checked)
-- without breaking the rest of either flow. Fixing that insert/read
-- mismatch is a separate, smaller follow-up, not a missing-table issue.
CREATE TABLE IF NOT EXISTS audit_log_entries (
  id TEXT PRIMARY KEY DEFAULT ('audit-' || gen_random_uuid()::text),
  table_name TEXT,
  record_id TEXT,
  action TEXT,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash TEXT,
  previous_hash TEXT,
  organization_id UUID,
  metadata JSONB DEFAULT '{}'
);
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS old_data JSONB;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS new_data JSONB;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS hash TEXT;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE audit_log_entries ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_audit_log_entries_org ON audit_log_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entries_changed_at ON audit_log_entries(changed_at);

-- Read-only today (lib/compliance/dsar.ts, on the live /dsar page) -- no
-- writer found anywhere, so this stays empty until something populates it.
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID,
  action TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE auth_audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_org_user ON auth_audit_logs(organization_id, user_id);

CREATE TABLE IF NOT EXISTS intelligence_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  content TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE intelligence_briefings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE intelligence_briefings ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE intelligence_briefings ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE intelligence_briefings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_intelligence_briefings_org ON intelligence_briefings(organization_id, generated_at);

CREATE TABLE IF NOT EXISTS intelligence_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  source_module TEXT,
  monetary_risk NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS source_module TEXT;
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS monetary_risk NUMERIC DEFAULT 0;
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE intelligence_findings ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_intelligence_findings_org_status ON intelligence_findings(organization_id, status);

-- Two different callers use two different shapes of this table
-- (cohort-benchmarking.ts: score/metric; driver-decomposition.ts:
-- overall_score/compliance_score/resources_score/performance_score) --
-- union of both, all nullable so either write path works.
CREATE TABLE IF NOT EXISTS digit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  metric TEXT,
  score NUMERIC,
  overall_score NUMERIC,
  compliance_score NUMERIC,
  resources_score NUMERIC,
  performance_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS metric TEXT;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS overall_score NUMERIC;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS compliance_score NUMERIC;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS resources_score NUMERIC;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS performance_score NUMERIC;
ALTER TABLE digit_scores ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_digit_scores_org_time ON digit_scores(organization_id, created_at);

-- lib/auth/rbac.ts's isPlatformAdmin() gates every app/admin-platform page
-- via this table (not profiles) -- without it, that gate always returns
-- false and every platform-admin page (including the break-glass/
-- impersonation/JIT pages this migration is otherwise fixing) stays
-- inaccessible. Backfilled from profiles, which already has a role column.
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  role TEXT
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
INSERT INTO users (id, role)
SELECT id, role FROM profiles
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

ALTER TABLE break_glass_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jit_elevation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE digit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own devices" ON user_devices;
CREATE POLICY "Users can manage their own devices" ON user_devices FOR ALL
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own row" ON users;
CREATE POLICY "Users can view their own row" ON users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their org intelligence briefings" ON intelligence_briefings;
CREATE POLICY "Users can view their org intelligence briefings" ON intelligence_briefings FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org intelligence findings" ON intelligence_findings;
CREATE POLICY "Users can view their org intelligence findings" ON intelligence_findings FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org digit scores" ON digit_scores;
CREATE POLICY "Users can view their org digit scores" ON digit_scores FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org auth audit logs" ON auth_audit_logs;
CREATE POLICY "Users can view their org auth audit logs" ON auth_audit_logs FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
