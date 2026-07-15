-- lib/compliance/dsar.ts's recordConsent/revokeConsent/listConsentRecords write
-- and order by granted_at/revoked_at/ip_address/user_agent, none of which exist
-- on the live consent_records table (only id/organization_id/user_id/
-- consent_type/granted/created_at) -- every consent call currently throws.
-- These are safe, nullable additions (no NOT NULL conflicts).

ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS granted_at TIMESTAMPTZ;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Backfill granted_at for any existing rows so ordering/filtering doesn't
-- silently drop them.
UPDATE consent_records SET granted_at = created_at WHERE granted_at IS NULL;
