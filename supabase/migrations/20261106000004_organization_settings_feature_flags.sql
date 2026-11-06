-- Read by lib/feature-flags.ts. Apply only after the code that treats trialing
-- orgs as entitled is deployed: with this column in place, the older code turns
-- off AI Intelligence and AI Analytics in the sidebar for every trial.
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}';
