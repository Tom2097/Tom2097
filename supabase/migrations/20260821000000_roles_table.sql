-- app/api/v1/auth/roles/route.ts (list/create/update/delete) and the
-- platform-admin Roles page (app/(dashboard)/platform/admin/roles/page.tsx)
-- read/write a "roles" table that exists in production (created outside any
-- tracked migration) but with an older, incompatible shape: no "permissions"
-- column at all, and "is_system" instead of "is_system_role". Every GET
-- failed with a genuine Postgres "column does not exist" error, surfaced to
-- the UI as "Failed to fetch roles". permissions are a static id list from
-- app/api/v1/auth/permissions/route.ts (workspace:read, crm:create, etc.),
-- stored here as a JSONB array of those ids.
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE roles ALTER COLUMN organization_id SET NOT NULL;

-- Backfill from the legacy "is_system" column if this ran against the
-- pre-existing table rather than creating a fresh one.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'is_system'
  ) THEN
    UPDATE roles SET is_system_role = is_system WHERE is_system_role = false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org roles" ON roles;
CREATE POLICY "Users can view their org roles" ON roles FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
