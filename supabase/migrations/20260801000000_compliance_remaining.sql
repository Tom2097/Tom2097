-- Second pass: remaining Compliance tables (some dead code, zero live
-- callers), migrated per explicit request to leave nothing from the audit
-- out. Backs lib/compliance/{regulatory,traceability-matrix,audit-trail,
-- esignatures}.ts and lib/documents/engine.ts's requestSignature/
-- confirmSignature.

CREATE TABLE IF NOT EXISTS compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  control_id TEXT,
  title TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS framework_id UUID REFERENCES compliance_frameworks(id) ON DELETE CASCADE;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS control_id TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE compliance_controls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls(framework_id);

CREATE TABLE IF NOT EXISTS compliance_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_hash TEXT,
  hash TEXT NOT NULL,
  data_snapshot JSONB NOT NULL DEFAULT '{}',
  changed_by UUID,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS record_type TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS record_id TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS hash TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS data_snapshot JSONB NOT NULL DEFAULT '{}';
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS changed_by UUID;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE compliance_audit_trail ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_compliance_audit_trail_record ON compliance_audit_trail(organization_id, record_type, record_id);

CREATE TABLE IF NOT EXISTS traceability_matrices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  framework TEXT NOT NULL,
  control_id TEXT NOT NULL,
  control_title TEXT,
  evidence_status TEXT,
  score NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, framework, control_id)
);
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS control_id TEXT;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS control_title TEXT;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS evidence_status TEXT;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS score NUMERIC;
ALTER TABLE traceability_matrices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_traceability_matrices_org ON traceability_matrices(organization_id);

CREATE TABLE IF NOT EXISTS esignature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  document_name TEXT,
  requester_id UUID,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  signer_phone TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  signature_data TEXT,
  signature_hash TEXT,
  signed_at TIMESTAMPTZ,
  signed_ip TEXT,
  expires_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS requester_id UUID;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signer_phone TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signature_hash TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS signed_ip TEXT;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE esignature_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_esignature_requests_org ON esignature_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_esignature_requests_document ON esignature_requests(document_id);

CREATE TABLE IF NOT EXISTS esignature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  signature_type TEXT NOT NULL DEFAULT 'draw',
  signature_data TEXT,
  signature_hash TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  certificate_info JSONB
);
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signature_type TEXT NOT NULL DEFAULT 'draw';
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signature_hash TEXT;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE esignature_records ADD COLUMN IF NOT EXISTS certificate_info JSONB;
CREATE INDEX IF NOT EXISTS idx_esignature_records_org ON esignature_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_esignature_records_document ON esignature_records(document_id);

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID,
  requester_id UUID,
  signer_email TEXT NOT NULL,
  signer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS document_id UUID;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS requester_id UUID;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE signature_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_signature_requests_org ON signature_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_document ON signature_requests(document_id);

ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE traceability_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE esignature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE esignature_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view controls of their org frameworks" ON compliance_controls;
CREATE POLICY "Users can view controls of their org frameworks" ON compliance_controls FOR SELECT
  USING (framework_id IN (
    SELECT id FROM compliance_frameworks WHERE organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view their org audit trail" ON compliance_audit_trail;
CREATE POLICY "Users can view their org audit trail" ON compliance_audit_trail FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org traceability matrices" ON traceability_matrices;
CREATE POLICY "Users can view their org traceability matrices" ON traceability_matrices FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org esignature requests" ON esignature_requests;
CREATE POLICY "Users can view their org esignature requests" ON esignature_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org esignature records" ON esignature_records;
CREATE POLICY "Users can view their org esignature records" ON esignature_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org signature requests" ON signature_requests;
CREATE POLICY "Users can view their org signature requests" ON signature_requests FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
