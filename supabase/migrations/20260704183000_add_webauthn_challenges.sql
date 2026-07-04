-- Create webauthn_challenges table for WebAuthn registration challenges
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own challenges
CREATE POLICY "Users can manage their own challenges"
ON public.webauthn_challenges
FOR ALL
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_webauthn_challenges_user_id ON public.webauthn_challenges(user_id);
CREATE INDEX idx_webauthn_challenges_expires_at ON public.webauthn_challenges(expires_at);