-- Activity log: every page visit and API call made by a signed-in user,
-- written by middleware.ts. Separate from audit_logs (security events with a
-- hash chain) because this is high-volume and only kept for 90 days.
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  user_id     uuid NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('page', 'api')),
  method      text NOT NULL,
  path        text NOT NULL,
  query       text,
  referrer    text,
  ip_address  inet,
  user_agent  text
);

CREATE INDEX IF NOT EXISTS activity_logs_user_time_idx ON public.activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_time_idx ON public.activity_logs (created_at DESC);

-- Written and read only by the server (service role). No client access.
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_logs FROM anon, authenticated;

-- 90-day retention.
CREATE OR REPLACE FUNCTION public.purge_old_activity_logs()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH d AS (DELETE FROM public.activity_logs WHERE created_at < now() - interval '90 days' RETURNING 1)
  SELECT count(*)::integer FROM d;
$$;
REVOKE EXECUTE ON FUNCTION public.purge_old_activity_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_activity_logs() TO service_role;
