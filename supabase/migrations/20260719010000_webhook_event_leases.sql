ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1;

ALTER TABLE webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE webhook_events
  ADD CONSTRAINT webhook_events_status_check
  CHECK (status IN ('processing', 'completed', 'failed'));

UPDATE webhook_events
SET status = 'completed',
    claimed_at = COALESCE(claimed_at, created_at),
    completed_at = COALESCE(completed_at, created_at)
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_lease
  ON webhook_events(status, claimed_at)
  WHERE status = 'processing';
