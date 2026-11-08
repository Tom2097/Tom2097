-- Diwali 2026 offer: sign-ups until the end of 11 Nov 2026 (IST) get a 90-day
-- trial, then it falls back to 30 days. Keep in line with trialDaysAt() in
-- lib/products.ts. Applied to production by hand in the SQL Editor (see
-- 20261106000003 for why migrations aren't pushed with `supabase db push`).
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
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'))
  returning id into org_id;

  insert into public.profiles (id, organization_id, full_name, email, role)
  values (new.id, org_id, new.raw_user_meta_data ->> 'full_name', new.email, 'admin');

  insert into public.subscriptions (organization_id, plan_id, status, trial_start, trial_ends_at)
  values (org_id, 'starter', 'trialing', now(),
          now() + case when now() < '2026-11-12 00:00+05:30' then interval '90 days'
                       else interval '30 days' end);

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

-- Anyone who signed up since the offer started also gets 90 days.
UPDATE public.subscriptions
SET trial_ends_at = created_at + interval '90 days', updated_at = now()
WHERE status = 'trialing'
  AND created_at >= '2026-11-08 00:00+05:30'
  AND stripe_subscription_id IS NULL
  AND razorpay_subscription_id IS NULL;
