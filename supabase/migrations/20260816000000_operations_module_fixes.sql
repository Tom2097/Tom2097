-- Operations module audit fixes (document intake, reports, copilot).

-- 1. report_schedules was already read/written by lib/reporting/engine.ts
--    (scheduleReport/getSchedule) and by
--    app/api/v1/operations/reports/[id]/schedule/route.ts, but no migration
--    ever created it -- scheduling a report failed at the DB level
--    ("relation report_schedules does not exist") regardless of what the
--    request body contained. Columns match lib/reporting/types.ts's
--    ReportSchedule exactly; definition_id is deliberately a bare UUID (no
--    FK) since both operational_reports and report_definitions rows are
--    scheduled through this same table.
CREATE TABLE IF NOT EXISTS report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  definition_id UUID NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  hour_utc INTEGER NOT NULL DEFAULT 8,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS definition_id UUID;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'weekly';
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS hour_utc INTEGER NOT NULL DEFAULT 8;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS recipients TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- lib/reporting/engine.ts's scheduleReport() upserts with onConflict:
-- "definition_id", which requires a unique constraint/index on that column.
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_schedules_definition ON report_schedules(definition_id);
CREATE INDEX IF NOT EXISTS idx_report_schedules_org ON report_schedules(organization_id);

ALTER TABLE report_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their org report schedules" ON report_schedules;
CREATE POLICY "Users can view their org report schedules" ON report_schedules FOR SELECT
  USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- 2. document_tasks previously only supported tasks that are auto-created
--    from a document classification (document_id NOT NULL, plus a pointer
--    to a capa_records/accounts_payable row via task_type/task_id). The
--    copilot's "Create Task" action (app/api/v1/operations/execute-action/
--    route.ts) has no source document -- it comes from a freeform chat
--    message -- so document_id must become optional, and the task's own
--    title/description/assignee/due date need somewhere to live instead of
--    being silently dropped into a generic "notifications" row.
ALTER TABLE document_tasks ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS assignee_id UUID;
ALTER TABLE document_tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- 3. lib/document-processing/pipeline.ts and
--    app/api/v1/operations/summarize/route.ts both read documents.metadata,
--    spread new fields on top of the value they read, then write it back --
--    a classic lost-update race when two requests for the same document
--    (e.g. summarize + the understanding pipeline) run concurrently: the
--    slower write wins and silently drops whatever the faster write added.
--    This RPC merges into whatever metadata is in the row *at write time*
--    via jsonb's `||` concatenation, executed atomically inside Postgres, so
--    two concurrent callers merging different keys can no longer clobber
--    each other regardless of read/write timing.
CREATE OR REPLACE FUNCTION merge_document_metadata(
  p_document_id UUID,
  p_organization_id UUID,
  p_patch JSONB
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  UPDATE documents
  SET metadata = COALESCE(metadata, '{}'::jsonb) || p_patch
  WHERE id = p_document_id AND organization_id = p_organization_id
  RETURNING metadata INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
