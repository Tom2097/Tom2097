-- Second pass: remaining dead-code Resources tables (zero live callers),
-- migrated per explicit request to leave nothing from the audit out.

CREATE TABLE IF NOT EXISTS asset_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tag_type TEXT NOT NULL DEFAULT 'qr',
  tag_value TEXT NOT NULL,
  encoded_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS asset_id UUID;
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS tag_type TEXT NOT NULL DEFAULT 'qr';
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS tag_value TEXT;
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS encoded_data TEXT;
ALTER TABLE asset_tags ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_asset_tags_org ON asset_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_value ON asset_tags(tag_value);

CREATE TABLE IF NOT EXISTS asset_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  tag_type TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by UUID,
  location TEXT,
  metadata JSONB DEFAULT '{}'
);
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS asset_id UUID;
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS tag_type TEXT;
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS scanned_by UUID;
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE asset_scans ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_asset_scans_asset_time ON asset_scans(asset_id, scanned_at);

CREATE TABLE IF NOT EXISTS renewal_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  expiry_date TIMESTAMPTZ,
  remind_at TIMESTAMPTZ,
  notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS remind_at TIMESTAMPTZ;
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS notified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE renewal_reminders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_renewal_reminders_org ON renewal_reminders(organization_id, remind_at);

CREATE TABLE IF NOT EXISTS onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  assigned_role TEXT,
  depends_on UUID,
  type TEXT NOT NULL DEFAULT 'checklist',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS assigned_role TEXT;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS depends_on UUID;
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'checklist';
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE onboarding_steps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_org ON onboarding_steps(organization_id);

CREATE TABLE IF NOT EXISTS onboarding_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  steps JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE onboarding_plans ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE onboarding_plans ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE onboarding_plans ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE onboarding_plans ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]';
ALTER TABLE onboarding_plans ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_onboarding_plans_org_user ON onboarding_plans(organization_id, user_id);

CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available',
  booked_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS resource_id UUID;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available';
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS booked_by UUID;
ALTER TABLE booking_slots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_booking_slots_resource_time ON booking_slots(resource_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_booking_slots_org ON booking_slots(organization_id);

ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org asset tags" ON asset_tags;
CREATE POLICY "Users can view their org asset tags" ON asset_tags FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org asset scans" ON asset_scans;
CREATE POLICY "Users can view their org asset scans" ON asset_scans FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org renewal reminders" ON renewal_reminders;
CREATE POLICY "Users can view their org renewal reminders" ON renewal_reminders FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org onboarding steps" ON onboarding_steps;
CREATE POLICY "Users can view their org onboarding steps" ON onboarding_steps FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org onboarding plans" ON onboarding_plans;
CREATE POLICY "Users can view their org onboarding plans" ON onboarding_plans FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org booking slots" ON booking_slots;
CREATE POLICY "Users can view their org booking slots" ON booking_slots FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
