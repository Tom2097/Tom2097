-- Trials could never end on the live database:
--   * subscriptions_status_check rejected 'expired', so expireTrialIfDue()'s
--     update could not succeed. 'cancelled' is written by lib/billing/razorpay.ts
--     and lib/platform/tenant-lifecycle.ts and was rejected the same way.
--   * handle_new_user() created every trial with no trial_ends_at.
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (ARRAY[
  'pending', 'active', 'canceled', 'cancelled', 'past_due', 'trialing', 'incomplete',
  'incomplete_expired', 'unpaid', 'paused', 'suspended', 'refunded', 'expired'
]));

-- Keep the 30 days in line with STANDARD_TRIAL_DAYS in lib/products.ts. This
-- function was created outside the migrations, so this is its first definition
-- in the repo. Everything apart from the trial dates is unchanged.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  org_id uuid;
  service_ids text[] := '{"analytics","crm","healthcare","banking","agro","pharma"}'::text[];
  sid text;
begin
  -- Create organization from user metadata
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'))
  returning id into org_id;

  -- Create profile linked to auth user
  insert into public.profiles (id, organization_id, full_name, email, role)
  values (
    new.id,
    org_id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'admin'
  );

  -- Create initial trial subscription
  insert into public.subscriptions (organization_id, plan_id, status, trial_start, trial_ends_at)
  values (org_id, 'starter', 'trialing', now(), now() + interval '30 days');

  -- Create service entries (honor selected_services from metadata, else all enabled)
  if new.raw_user_meta_data ? 'selected_services' and new.raw_user_meta_data ->> 'selected_services' != '' then
    foreach sid in array string_to_array(new.raw_user_meta_data ->> 'selected_services', ',') loop
      if sid = any(service_ids) then
        insert into public.organization_services (organization_id, service_id, enabled)
        values (org_id, sid, true);
      end if;
    end loop;
  else
    foreach sid in array service_ids loop
      insert into public.organization_services (organization_id, service_id, enabled)
      values (org_id, sid, true);
    end loop;
  end if;

  return new;
end;
$function$;

-- Give trials that never had an end date a fresh 30 days. None has a payment
-- method or a Stripe subscription, so ending them charges nobody.
UPDATE public.subscriptions
SET trial_start = COALESCE(trial_start, now()),
    trial_ends_at = now() + interval '30 days',
    updated_at = now()
WHERE status = 'trialing'
  AND trial_ends_at IS NULL
  AND stripe_subscription_id IS NULL
  AND razorpay_subscription_id IS NULL;

-- 20260908000002 defines this function but was never applied, so
-- GET /api/v1/analytics/overview returned 500. Same definition, with the
-- search_path pinned and access limited to the service client that calls it.
CREATE OR REPLACE FUNCTION public.analytics_event_retention(
  p_org UUID, p_event TEXT, p_start TIMESTAMPTZ, p_end TIMESTAMPTZ
) RETURNS TABLE(retention NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH cohort AS (
    SELECT DISTINCT user_id
    FROM analytics_events
    WHERE organization_id = p_org
      AND (p_event = '' OR event_name = p_event)
      AND user_id IS NOT NULL
      AND occurred_at >= p_start
      AND occurred_at < p_start + INTERVAL '1 day'
  ),
  retained AS (
    SELECT DISTINCT ae.user_id
    FROM analytics_events ae
    JOIN cohort c ON c.user_id = ae.user_id
    WHERE ae.organization_id = p_org
      AND (p_event = '' OR ae.event_name = p_event)
      AND ae.occurred_at >= p_start + INTERVAL '1 day'
      AND ae.occurred_at < p_end
  )
  SELECT CASE WHEN (SELECT COUNT(*) FROM cohort) = 0 THEN 0
    ELSE ROUND((SELECT COUNT(*) FROM retained)::NUMERIC / (SELECT COUNT(*) FROM cohort) * 100, 2)
  END AS retention;
$$;
REVOKE EXECUTE ON FUNCTION public.analytics_event_retention(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_event_retention(uuid, text, timestamptz, timestamptz) TO service_role;

-- Read by lib/analytics/cohort-benchmarking.ts. Nothing sets them yet, so peer
-- benchmarks stay empty until organizations have these values.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS size TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT;
