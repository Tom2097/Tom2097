-- operational-reports.tsx's Report interface expects status/last_generated/
-- schedule as real fields, but the table never had them -- they always
-- rendered undefined. The frontend also never sent `config` at all when
-- creating a report (a separate bug, fixed in the component), so every
-- report create attempt was rejected by the API's `!config` check.

ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS last_generated TIMESTAMPTZ;
ALTER TABLE operational_reports ADD COLUMN IF NOT EXISTS schedule JSONB;
