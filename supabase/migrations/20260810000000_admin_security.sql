-- Admin Security page needs three real backends, none of which existed:
--
-- 1. audit_logs exists but is missing hash/previous_hash -- lib/auth/audit.ts's
--    logAuthEvent() has been silently failing on every insert (caught and
--    only console.warn'd) since it writes those two columns.
-- 2. sessions doesn't exist at all -- lib/auth/session's SupabaseSessionStore
--    has had nothing to read/write.
-- 3. IP allowlist was 100% client-side React state with two hardcoded fake
--    seed entries -- no table existed to persist it at all.

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT,
  location JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  fingerprint TEXT
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, is_active);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own sessions" ON sessions;
CREATE POLICY "Users can view their own sessions" ON sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS ip_allowlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidr TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE ip_allowlist_entries ADD COLUMN IF NOT EXISTS cidr TEXT;
ALTER TABLE ip_allowlist_entries ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE ip_allowlist_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ip_allowlist_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON ip_allowlist_entries;
CREATE POLICY "Service role only" ON ip_allowlist_entries FOR ALL
  USING (false) WITH CHECK (false);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON platform_settings;
CREATE POLICY "Service role only" ON platform_settings FOR ALL
  USING (false) WITH CHECK (false);
