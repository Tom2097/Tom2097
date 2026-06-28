-- Intelligence Runtime: scheduler, task history, cross-tenant metrics
-- Continuous 24/7 monitoring schedules
create table if not exists public.intelligence_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task text not null check (task in ('monitor_scan','generate_briefing','auto_assign','sync_graph','push_alerts')),
  interval_minutes int not null default 60,
  last_run_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_intelligence_schedules_org on public.intelligence_schedules(organization_id);
create unique index idx_intelligence_schedules_task on public.intelligence_schedules(organization_id, task);

-- Scheduled task execution history
create table if not exists public.intelligence_scheduled_tasks (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  schedule_id uuid references public.intelligence_schedules(id) on delete set null,
  task text not null,
  status text not null check (status in ('running','completed','failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  details jsonb default '{}'::jsonb
);

create index idx_intelligence_scheduled_tasks_org on public.intelligence_scheduled_tasks(organization_id);
create index idx_intelligence_scheduled_tasks_status on public.intelligence_scheduled_tasks(organization_id, status);

-- Modify findings table to add causal_chain link rendering support
alter table public.intelligence_findings add column if not exists chain_link_ids text[] default '{}';
alter table public.intelligence_findings add column if not exists resolution_url text;
alter table public.intelligence_findings add column if not exists resolved_at timestamptz;

-- RLS
alter table public.intelligence_schedules enable row level security;
alter table public.intelligence_scheduled_tasks enable row level security;

create policy "schedules org-scoped"
  on public.intelligence_schedules for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "scheduled tasks org-scoped"
  on public.intelligence_scheduled_tasks for all
  using (organization_id in (select id from public.organizations where id = organization_id));
