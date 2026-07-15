-- Of the 9 original candidates in this batch, only 3 are reachable from a
-- real page: asset_telemetry (the live /predictive-maintenance page calls
-- /api/v1/predictive/{rul,telemetry}), and skill_profiles/skill_requirements
-- (lib/resources/analytics.ts's getSkillGaps, called from
-- app/(dashboard)/resources/page.tsx). asset_scans/asset_tags
-- (lib/resources/qr-rfid.ts), renewal_reminders (lib/resources/contracts.ts),
-- onboarding_plans/onboarding_steps (lib/resources/onboarding.ts), and
-- booking_slots (lib/booking/engine.ts, a separate booking system from the
-- already-migrated resource_bookings) all have zero callers anywhere and
-- are deliberately skipped.

CREATE TABLE IF NOT EXISTS asset_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature NUMERIC,
  vibration NUMERIC,
  pressure NUMERIC,
  rpm NUMERIC,
  power_consumption NUMERIC,
  humidity NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS asset_id UUID;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS temperature NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS vibration NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS pressure NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS rpm NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS power_consumption NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS humidity NUMERIC;
ALTER TABLE asset_telemetry ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_asset_telemetry_asset_time ON asset_telemetry(asset_id, timestamp);

-- calculateRUL also reads assets.installation_date/expected_lifespan_days --
-- backfill those onto the already-migrated assets table too.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS installation_date DATE;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS expected_lifespan_days INTEGER;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_type TEXT;

CREATE TABLE IF NOT EXISTS skill_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  skill TEXT NOT NULL,
  min_level NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE skill_requirements ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE skill_requirements ADD COLUMN IF NOT EXISTS skill TEXT;
ALTER TABLE skill_requirements ADD COLUMN IF NOT EXISTS min_level NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE skill_requirements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_skill_requirements_org ON skill_requirements(organization_id);

CREATE TABLE IF NOT EXISTS skill_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  skill TEXT NOT NULL,
  level NUMERIC NOT NULL DEFAULT 1,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS skill TEXT;
ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS level NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE skill_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_skill_profiles_org ON skill_profiles(organization_id);

ALTER TABLE asset_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org skill requirements" ON skill_requirements;
CREATE POLICY "Users can view their org skill requirements" ON skill_requirements FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org skill profiles" ON skill_profiles;
CREATE POLICY "Users can view their org skill profiles" ON skill_profiles FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org asset telemetry" ON asset_telemetry;
CREATE POLICY "Users can view their org asset telemetry" ON asset_telemetry FOR SELECT
  USING (asset_id IN (SELECT id FROM assets WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())));
