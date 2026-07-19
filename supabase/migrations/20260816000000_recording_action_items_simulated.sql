-- lib/audio/ingestion.ts's extractActionItems() always returns 3 canned
-- placeholder strings (no NLP/LLM extraction is wired up), but nothing
-- marked them as such -- unlike the transcript above them in the same file,
-- which is honestly labeled transcript_is_simulated and shown with an
-- amber "simulated" banner in the UI. This adds the same disclosure flag
-- to recording_action_items so the recordings page can show the same
-- banner for action items.

ALTER TABLE recording_action_items ADD COLUMN IF NOT EXISTS is_simulated BOOLEAN NOT NULL DEFAULT true;
