-- Incidents table backing the admin incident-response workflow (lib/incident/response.ts)
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'mitigated', 'resolved')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  runbook_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage incidents in their organization"
ON public.incidents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
    AND organization_members.organization_id = incidents.organization_id
    AND organization_members.role IN ('owner', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_incidents_org_id ON public.incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);

-- Platform-wide feature flag state (lib/feature-flags/admin.ts). Accessed only via the
-- service-role client from admin API routes, so no anon/authenticated RLS policies.
CREATE TABLE IF NOT EXISTS public.global_feature_flags (
  id TEXT PRIMARY KEY,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.global_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_kill_switches (
  flag TEXT PRIMARY KEY,
  killed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_kill_switches ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.feature_flag_canary (
  flag TEXT PRIMARY KEY,
  percent INTEGER NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_flag_canary ENABLE ROW LEVEL SECURITY;
