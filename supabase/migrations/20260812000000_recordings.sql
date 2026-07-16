-- Recordings page (lib/audio/ingestion.ts) was a pure in-memory Map --
-- every upload, transcript, and action item vanished on server restart or
-- across serverless instances. This makes uploads real (private Storage
-- bucket + persisted rows). Transcription/action-item extraction still has
-- no speech-to-text provider wired up anywhere in this codebase, so that
-- output stays clearly labeled as demo/simulated in the UI -- but it now
-- persists so it's at least consistent per recording instead of
-- regenerating random values on every view.

INSERT INTO storage.buckets (id, name, public)
VALUES ('recordings', 'recordings', false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  duration_seconds INTEGER,
  transcript_text TEXT,
  transcript_confidence NUMERIC,
  transcript_is_simulated BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT 'audio/mpeg';
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcript_text TEXT;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcript_confidence NUMERIC;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS transcript_is_simulated BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS uploaded_by UUID;
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE recordings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_recordings_org ON recordings(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recording_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  start_seconds INTEGER NOT NULL,
  end_seconds INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS recording_id UUID;
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS start_seconds INTEGER;
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS end_seconds INTEGER;
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS speaker TEXT;
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE recording_segments ADD COLUMN IF NOT EXISTS ordinal INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_recording_segments_recording ON recording_segments(recording_id, ordinal);

CREATE TABLE IF NOT EXISTS recording_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  assignee TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS recording_id UUID;
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS assignee TEXT;
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_recording_action_items_recording ON recording_action_items(recording_id);

ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view their recordings" ON recordings;
CREATE POLICY "Org members can view their recordings" ON recordings FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE recording_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view their recording segments" ON recording_segments;
CREATE POLICY "Org members can view their recording segments" ON recording_segments FOR SELECT
  USING (recording_id IN (
    SELECT id FROM recordings WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));

ALTER TABLE recording_action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can view their recording action items" ON recording_action_items;
CREATE POLICY "Org members can view their recording action items" ON recording_action_items FOR SELECT
  USING (recording_id IN (
    SELECT id FROM recordings WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  ));
