-- Create billing_analytics table
create table if not exists public.billing_analytics (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  plan_id text not null,
  metadata jsonb,
  created_at timestamp with time zone not null default now()
);

-- Add indexes
create index if not exists idx_billing_analytics_organization_id on public.billing_analytics(organization_id);
create index if not exists idx_billing_analytics_event_type on public.billing_analytics(event_type);
create index if not exists idx_billing_analytics_created_at on public.billing_analytics(created_at);

-- Enable RLS
alter table public.billing_analytics enable row level security;

-- RLS policy: users can see their organization's analytics
create policy "Users can view their organization's billing analytics"
on public.billing_analytics
for select
using (auth.uid() in (
  select user_id from public.organization_members
  where organization_id = billing_analytics.organization_id
));

-- RLS policy: app can insert analytics events
create policy "App can insert billing analytics"
on public.billing_analytics
for insert
with check (true);