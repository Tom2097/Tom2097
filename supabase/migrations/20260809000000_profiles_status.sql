-- app/admin/users/page.tsx displays and suspends users by status, but
-- profiles has no status column at all -- GET /api/v1/admin/users was a
-- 5-line stub with no persistence for this whatsoever.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
