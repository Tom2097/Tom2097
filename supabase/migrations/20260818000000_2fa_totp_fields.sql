-- app/api/v1/auth/2fa/{setup,verify,disable} were 5-line stubs even though
-- lib/auth/2fa/totp-service.ts has real, working TOTP logic (secret
-- generation, verify2FACode, backup codes) -- nothing ever called it because
-- profiles had nowhere to persist a user's TOTP secret/backup codes.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS totp_confirmed_at TIMESTAMPTZ;
