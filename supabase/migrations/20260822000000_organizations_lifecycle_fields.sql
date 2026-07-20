-- lib/platform/tenant-lifecycle.ts (listTenants/suspendTenant/activateTenant/
-- deprovisionTenant, backing the founder console's Tenants page) reads and
-- writes organizations.status/suspended_at/suspension_reason/deprovisioned_at,
-- none of which exist. listTenants()'s PostgREST select errored on the
-- missing "status" column, and the route's `if (!data) return []` silently
-- swallowed that into an empty tenant list instead of surfacing the failure.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS deprovisioned_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_status_check'
  ) THEN
    ALTER TABLE organizations ADD CONSTRAINT organizations_status_check
      CHECK (status IN ('active', 'suspended', 'trialing', 'deprovisioned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
