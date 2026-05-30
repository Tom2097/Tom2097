-- DigiT Enterprise Platform - Database Setup

-- 1. Organizations table
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Profiles table (links auth.users to organizations)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete set null,
  full_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Subscriptions table (tracks Stripe subscriptions per org)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan_id text not null,
  status text not null default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_profiles_org on profiles(organization_id);
create index if not exists idx_subscriptions_org on subscriptions(organization_id);
create index if not exists idx_subscriptions_stripe_customer on subscriptions(stripe_customer_id);

-- Enable Row Level Security
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table subscriptions enable row level security;

-- RLS policies: users can only see their own org's data
create policy "Users can view their own organization"
  on organizations for select
  using (id in (
    select organization_id from profiles where id = auth.uid()
  ));

create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can view their org's subscription"
  on subscriptions for select
  using (organization_id in (
    select organization_id from profiles where id = auth.uid()
  ));

-- Auto-create profile + organization on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  org_id uuid;
begin
  -- Create organization from user metadata
  insert into public.organizations (name)
  values (coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'))
  returning id into org_id;

  -- Create profile linked to auth user
  insert into public.profiles (id, organization_id, full_name)
  values (
    new.id,
    org_id,
    new.raw_user_meta_data ->> 'full_name'
  );

  -- Create initial trial subscription
  insert into public.subscriptions (organization_id, plan_id, status)
  values (org_id, 'starter', 'trialing');

  return new;
end;
$$;

-- Trigger the function on every user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
