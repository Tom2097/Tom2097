-- Supabase advisor rls_disabled_in_public: event_job_subscriptions was created
-- without RLS, leaving it readable and writable with the public anon key.
-- It is only read through the service-role client (lib/events/bus.ts), which
-- bypasses RLS, so no policies are needed.
ALTER TABLE IF EXISTS public.event_job_subscriptions ENABLE ROW LEVEL SECURITY;

-- kb_articles already has RLS in production, but no migration enabled it, so a
-- database rebuilt from migrations would have exposed it.
ALTER TABLE IF EXISTS public.kb_articles ENABLE ROW LEVEL SECURITY;
