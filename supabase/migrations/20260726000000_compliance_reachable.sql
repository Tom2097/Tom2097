-- Of this batch's 10 original candidates, only 4 are reachable: the live
-- /compliance page directly calls lib/compliance/scoring.ts
-- (compliance_frameworks, compliance_evidence) and lib/compliance/checks.ts
-- (compliance_certificates); lib/compliance/dsar.ts's consent_records backs
-- the live /dsar page. compliance_controls, compliance_audit_trail (its
-- viewer component and API routes have zero UI callers), traceability_matrices,
-- esignature_records/esignature_requests (lib/compliance/esignatures.ts,
-- zero callers), and signature_requests (lib/documents/engine.ts's
-- requestSignature/confirmSignature, zero callers -- the live /esign page
-- uses a separate, in-memory-only module instead) are all dead code and
-- deliberately skipped.

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  controls_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_frameworks ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE compliance_frameworks ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE compliance_frameworks ADD COLUMN IF NOT EXISTS controls_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE compliance_frameworks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_org ON compliance_frameworks(organization_id);

CREATE TABLE IF NOT EXISTS compliance_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  framework_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_evidence ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE compliance_evidence ADD COLUMN IF NOT EXISTS framework_id UUID;
ALTER TABLE compliance_evidence ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE compliance_evidence ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_compliance_evidence_org_framework ON compliance_evidence(organization_id, framework_id);

CREATE TABLE IF NOT EXISTS compliance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_certificates ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE compliance_certificates ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE compliance_certificates ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;
ALTER TABLE compliance_certificates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_compliance_certificates_org_expiry ON compliance_certificates(organization_id, expiry_date);

-- Read-only today (lib/compliance/dsar.ts, on the live /dsar page) -- no
-- writer found anywhere yet.
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  consent_type TEXT,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS consent_type TEXT;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS granted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE consent_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_consent_records_org_user ON consent_records(organization_id, user_id);

ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their org compliance frameworks" ON compliance_frameworks;
CREATE POLICY "Users can view their org compliance frameworks" ON compliance_frameworks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org compliance evidence" ON compliance_evidence;
CREATE POLICY "Users can view their org compliance evidence" ON compliance_evidence FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org compliance certificates" ON compliance_certificates;
CREATE POLICY "Users can view their org compliance certificates" ON compliance_certificates FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org consent records" ON consent_records;
CREATE POLICY "Users can view their org consent records" ON consent_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
