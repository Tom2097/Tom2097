-- Ensure `documents` has the columns app/api/operations/upload writes to.
-- 20260620_documents.sql added these conditionally, but assumed the `documents`
-- table already existed. On databases where `documents` was actually created
-- later by 20260706000000_resources_module.sql, that ALTER never ran (the
-- table didn't exist yet), leaving `content`/`raw_data` missing and every
-- upload failing with "Failed to save document".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'content') THEN
    ALTER TABLE documents ADD COLUMN content TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'raw_data') THEN
    ALTER TABLE documents ADD COLUMN raw_data JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'type') THEN
    ALTER TABLE documents ADD COLUMN type TEXT NOT NULL DEFAULT 'document';
  END IF;
END $$;
