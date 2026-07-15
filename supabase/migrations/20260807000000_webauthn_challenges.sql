-- Short-lived store for WebAuthn registration challenges. The server must
-- verify a registration response against a challenge IT generated and
-- stored -- trusting a client-echoed challenge would let a forged client
-- fake verification, so this can't be passed through the request body.

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  challenge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS challenge TEXT;
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE webauthn_challenges ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_email ON webauthn_challenges(email, created_at DESC);

ALTER TABLE webauthn_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only" ON webauthn_challenges;
CREATE POLICY "Service role only" ON webauthn_challenges FOR ALL
  USING (false) WITH CHECK (false);
