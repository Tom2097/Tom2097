-- components/digit/compliance-frameworks.tsx's "New Framework" dialog and
-- app/api/v1/compliance/frameworks/route.ts's POST have always sent a
-- description field, but 20260726000000_compliance_reachable.sql's table
-- never included that column -- every framework creation with a description
-- filled in 500'd with PGRST204 "column not found". Frameworks with no
-- description typed also silently failed for the same reason, since the
-- column is referenced either way.
ALTER TABLE compliance_frameworks ADD COLUMN IF NOT EXISTS description TEXT;
