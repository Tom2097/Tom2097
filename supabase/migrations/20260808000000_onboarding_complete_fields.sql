-- app/api/v1/onboarding/complete (secure onboarding flow) needs to persist
-- company registration/website/address/country and the user's phone number,
-- none of which have columns on organizations/profiles yet.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS registration_number TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS country TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
