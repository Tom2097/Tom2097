-- Asset hierarchies may only connect rows inside the same tenant. NOT VALID
-- enforces this for new writes while allowing legacy rows to be audited before
-- a later VALIDATE CONSTRAINT rollout.
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_org_id_unique
  ON public.assets(organization_id, id);

ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_parent_id_fkey;
ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_parent_tenant_fkey;
ALTER TABLE public.assets
  ADD CONSTRAINT assets_parent_tenant_fkey
  FOREIGN KEY (organization_id, parent_id)
  REFERENCES public.assets(organization_id, id)
  ON DELETE SET NULL (parent_id)
  NOT VALID;
