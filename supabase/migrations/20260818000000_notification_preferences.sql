-- lib/notifications/preferences.ts (listPreferences/upsertPreferences) and
-- app/api/v1/notifications/preferences/route.ts (the settings page's email
-- notification toggle) both read/write a "notification_preferences" table
-- that no prior migration created -- the route only ever exported a GET
-- stub, so PUT silently 405'd and the toggle never persisted.
--
-- Preferences are an opt-out model: the absence of a row means the channel
-- is enabled for that category (see preferences.ts), so no default rows are
-- seeded here.

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- upsertPreferences() upserts on (user_id, category, channel).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_preferences_unique
  ON notification_preferences(user_id, category, channel);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_org ON notification_preferences(organization_id);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON notification_preferences;
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());
