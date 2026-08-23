-- Push-notification device registration, for the mobile app. One row per
-- device a user has ever signed in on; a token is replaced (not duplicated)
-- if the same device re-registers (e.g. after a token refresh from FCM).
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);

ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
-- Service-role only, same convention as other internal-delivery tables
-- (payouts, site_visits) -- reads/writes go through lib/notifications/push.ts
-- and the register/unregister API route, both using the service client.
