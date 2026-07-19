-- dsar_requests backs lib/compliance/dsar.ts (createDsarRequest, listDsarRequests,
-- updateDsarStatus). No migration previously existed for this table even though
-- the DSAR API routes (app/api/v1/compliance/dsar/route.ts) have read/written it
-- since they were added — this fills that gap, matching the columns the code
-- already expects exactly.

CREATE TABLE IF NOT EXISTS dsar_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  subject_email TEXT NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS subject_email TEXT;
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS request_type TEXT;
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE dsar_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_dsar_requests_org ON dsar_requests(organization_id);

ALTER TABLE dsar_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org dsar requests" ON dsar_requests;
CREATE POLICY "Users can view their org dsar requests" ON dsar_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
