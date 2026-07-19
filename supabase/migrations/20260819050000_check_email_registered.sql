-- Lets the app definitively check whether an email is already registered in
-- auth.users. auth.users isn't exposed over PostgREST (by design), so the
-- sign-up route previously had to *infer* this from Supabase signUp()'s
-- ambiguous {user: null, error: null} anti-enumeration response -- which
-- also fires for other, unrelated transient failures, incorrectly telling
-- genuinely new users their (actually successful) signup had failed.
create or replace function public.check_email_registered(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from auth.users
    where lower(email) = lower(p_email)
      and deleted_at is null
  );
$$;

revoke all on function public.check_email_registered(text) from public;
grant execute on function public.check_email_registered(text) to service_role;
