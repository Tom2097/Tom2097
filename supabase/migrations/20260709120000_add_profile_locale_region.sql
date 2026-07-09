-- Add locale and region preferences to profiles for region & language detection
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT;

-- Create index for locale lookups
CREATE INDEX IF NOT EXISTS idx_profiles_locale ON public.profiles(locale);

-- Add comments explaining columns
COMMENT ON COLUMN public.profiles.locale IS 'User preferred UI language (BCP-47 code, e.g. en, hi, pa)';
COMMENT ON COLUMN public.profiles.country IS 'Detected or configured country for region/currency/legal defaults';
COMMENT ON COLUMN public.profiles.timezone IS 'Detected or configured timezone for time display';
