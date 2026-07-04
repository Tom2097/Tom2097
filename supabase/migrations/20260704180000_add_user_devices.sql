-- Create user_devices table for WebAuthn/passkey credentials
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  device_type TEXT NOT NULL,
  transports TEXT[],
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(credential_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Create policy for users to manage their own devices
CREATE POLICY "Users can manage their own devices"
ON public.user_devices
FOR ALL
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);