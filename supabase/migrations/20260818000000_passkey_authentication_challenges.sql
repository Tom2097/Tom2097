-- One-time, anonymous authentication challenges for discoverable passkeys.
-- The browser receives only an opaque flow ID in an HttpOnly cookie; the
-- challenge itself remains server-side and is deleted atomically on use.
CREATE TABLE IF NOT EXISTS public.passkey_authentication_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkey_authentication_challenges_expires_at
  ON public.passkey_authentication_challenges(expires_at);

ALTER TABLE public.passkey_authentication_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.passkey_authentication_challenges FROM anon, authenticated;
GRANT ALL ON TABLE public.passkey_authentication_challenges TO service_role;
