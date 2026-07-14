-- Backs the /operations "Understanding Layer" / "Action Layer": document
-- classification/extraction fields, plus the CAPA, accounts-payable, and
-- document-task tables that lib/operational/actions.ts, auto-create.ts, and
-- recipes.ts already write to but that were never migrated. Also bootstraps
-- the "documents" storage bucket, needed for real OCR (lib/ocr/engine.ts
-- reads uploaded files from Supabase Storage via a signed URL).
--
-- Defensive throughout (IF NOT EXISTS) -- the migrations checked into this
-- repo are known to be out of sync with the live schema (see
-- 20260714050000_ensure_documents_upload_columns.sql), so this must not
-- assume any specific prior state.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'classification') THEN
    ALTER TABLE documents ADD COLUMN classification TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'extracted_entities') THEN
    ALTER TABLE documents ADD COLUMN extracted_entities JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS capa_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigation', 'action', 'verification', 'closed')),
  assigned_to UUID,
  sla_deadline TIMESTAMPTZ,
  investigation_notes TEXT,
  action_taken TEXT,
  verification_notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts_payable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  vendor TEXT,
  amount NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review',
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  task_type TEXT NOT NULL,
  task_id UUID,
  auto_created BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- lib/operational/recipes.ts's send_notification step writes here; no
-- migration for it existed either.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Storage bucket for uploaded files -- needed so lib/ocr/engine.ts's
-- createSignedUrl() call has something to read from.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_capa_records_org ON capa_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_payable_org ON accounts_payable(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_tasks_document ON document_tasks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tasks_org ON document_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(classification);

ALTER TABLE capa_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts_payable ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Org-scoped RLS, mirroring the existing documents policies in
-- 20260620_documents.sql. Defense-in-depth only: all current/planned access
-- to these tables goes through the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS "Users can view their org capa records" ON capa_records;
CREATE POLICY "Users can view their org capa records" ON capa_records FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org payables" ON accounts_payable;
CREATE POLICY "Users can view their org payables" ON accounts_payable FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org document tasks" ON document_tasks;
CREATE POLICY "Users can view their org document tasks" ON document_tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can view their org notifications" ON notifications;
CREATE POLICY "Users can view their org notifications" ON notifications FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));
