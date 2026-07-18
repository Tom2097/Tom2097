-- Canonical credential store used by /api/auth/passkeys/register and
-- /api/auth/passkeys/authenticate. Older environments created this table
-- outside the tracked migrations, so keep this migration idempotent.
CREATE TABLE IF NOT EXISTS public.passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name TEXT NOT NULL DEFAULT 'Unknown Device',
  transports TEXT[] NOT NULL DEFAULT '{}',
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS credential_id TEXT;
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS public_key TEXT;
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS counter BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS device_name TEXT NOT NULL DEFAULT 'Unknown Device';
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS transports TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE public.passkeys ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.passkeys ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.passkeys ALTER COLUMN credential_id SET NOT NULL;
ALTER TABLE public.passkeys ALTER COLUMN public_key SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_passkeys_credential_id ON public.passkeys(credential_id);
CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON public.passkeys(user_id);

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
-- Replace any untracked legacy policies so no permissive insert/update policy
-- can bypass the authenticated, server-owned registration ceremony.
DO $$
DECLARE policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'passkeys'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.passkeys', policy_name);
  END LOOP;
END $$;
REVOKE ALL ON TABLE public.passkeys FROM anon, authenticated;
GRANT ALL ON TABLE public.passkeys TO service_role;
GRANT SELECT, DELETE ON TABLE public.passkeys TO authenticated;
CREATE POLICY "Users can read their own passkeys" ON public.passkeys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own passkeys" ON public.passkeys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Registration flows are user-bound and server-only. Delete-and-return in the
-- route consumes a challenge exactly once before credential verification.
CREATE TABLE IF NOT EXISTS public.passkey_registration_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_registration_challenges_user
  ON public.passkey_registration_challenges(user_id, expires_at);
ALTER TABLE public.passkey_registration_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.passkey_registration_challenges FROM anon, authenticated;
GRANT ALL ON TABLE public.passkey_registration_challenges TO service_role;
