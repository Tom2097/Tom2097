-- Supabase-js has no way to call nextval() directly (it's not a table
-- operation) -- this wraps the invoice_number_seq added in
-- 20260904000000_pricing_v2.sql so lib/billing/charge.ts can fetch a real
-- sequential number through a normal RPC call.
CREATE OR REPLACE FUNCTION next_invoice_number()
RETURNS BIGINT
LANGUAGE sql
AS $$
  SELECT nextval('invoice_number_seq');
$$;
