-- Intelligence Brain tables
-- Entities graph for cross-department causal chains
create table if not exists public.intelligence_entities (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('certificate','instrument','asset','batch','deal','document','compliance_gap','resource')),
  name text not null,
  status text not null default 'active',
  module text not null,
  properties jsonb default '{}'::jsonb,
  last_updated timestamptz not null default now()
);

create index idx_intelligence_entities_org on public.intelligence_entities(organization_id);
create index idx_intelligence_entities_type on public.intelligence_entities(organization_id, type);
create index idx_intelligence_entities_module on public.intelligence_entities(organization_id, module);

-- Entity relations (edges in the graph)
create table if not exists public.intelligence_relations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_entity_id text not null references public.intelligence_entities(id) on delete cascade,
  to_entity_id text not null references public.intelligence_entities(id) on delete cascade,
  relationship text not null,
  created_at timestamptz not null default now()
);

create index idx_intelligence_relations_from on public.intelligence_relations(organization_id, from_entity_id);
create index idx_intelligence_relations_to on public.intelligence_relations(organization_id, to_entity_id);

-- Intelligence findings (output of the perceive step)
create table if not exists public.intelligence_findings (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  description text not null,
  impact_score float not null default 0,
  confidence float not null default 0,
  status text not null default 'active' check (status in ('active','resolved','dismissed')),
  detected_at timestamptz not null default now(),
  source_module text not null,
  entity_id text,
  monetary_risk float default 0,
  suggested_action text,
  requires_approval boolean not null default true,
  causal_chain jsonb,
  evidence jsonb default '{}'::jsonb,
  assigned_agent_id text
);

create index idx_intelligence_findings_org on public.intelligence_findings(organization_id);
create index idx_intelligence_findings_status on public.intelligence_findings(organization_id, status);
create index idx_intelligence_findings_risk on public.intelligence_findings(organization_id, monetary_risk desc);

-- Agent actions (output of the act step)
create table if not exists public.intelligence_actions (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id text not null,
  type text not null,
  target_entity text,
  target_module text not null,
  config jsonb default '{}'::jsonb,
  status text not null default 'pending_approval' check (status in ('pending_approval','approved','executing','completed','failed')),
  confidence float not null default 0,
  requires_approval boolean not null default true,
  executed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);

create index idx_intelligence_actions_org on public.intelligence_actions(organization_id);
create index idx_intelligence_actions_status on public.intelligence_actions(organization_id, status);

-- Executive briefings
create table if not exists public.intelligence_briefings (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null,
  summary text not null,
  metrics jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  generated_at timestamptz not null default now()
);

create index idx_intelligence_briefings_org on public.intelligence_briefings(organization_id);
create index idx_intelligence_briefings_date on public.intelligence_briefings(organization_id, date desc);

-- Custom agent definitions
create table if not exists public.intelligence_agents (
  id text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null,
  scope text[] not null default '{}',
  capabilities text[] not null default '{}',
  confidence_threshold float not null default 0.7,
  requires_approval boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_intelligence_agents_org on public.intelligence_agents(organization_id);

-- Graph path-finding function (recursive CTE)
create or replace function public.find_entity_path(
  p_organization_id uuid,
  p_from_id text,
  p_to_id text
) returns table(entity_id text, depth int, path text[]) as $$
  with recursive graph_path as (
    select
      from_entity_id as entity_id,
      0 as depth,
      array[from_entity_id] as path
    from public.intelligence_relations
    where organization_id = p_organization_id
      and from_entity_id = p_from_id

    union all

    select
      r.to_entity_id,
      gp.depth + 1,
      gp.path || r.to_entity_id
    from public.intelligence_relations r
    join graph_path gp on r.from_entity_id = gp.entity_id
    where r.organization_id = p_organization_id
      and not r.to_entity_id = any(gp.path)
      and gp.depth < 10
  )
  select entity_id, depth, path
  from graph_path
  where entity_id = p_to_id
  order by depth
  limit 1;
$$ language sql stable;

-- RLS: all tables are org-scoped
alter table public.intelligence_entities enable row level security;
alter table public.intelligence_relations enable row level security;
alter table public.intelligence_findings enable row level security;
alter table public.intelligence_actions enable row level security;
alter table public.intelligence_briefings enable row level security;
alter table public.intelligence_agents enable row level security;

-- Network insights (anonymized cross-tenant benchmarks)
create table if not exists public.intelligence_network_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  value float not null,
  industry text,
  employee_range text,
  recorded_at timestamptz not null default now()
);

create index idx_intelligence_network_insights_metric on public.intelligence_network_insights(metric, industry);

alter table public.intelligence_network_insights enable row level security;

create policy "network insights org-scoped"
  on public.intelligence_network_insights for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence entities org-scoped"
  on public.intelligence_entities for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence relations org-scoped"
  on public.intelligence_relations for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence findings org-scoped"
  on public.intelligence_findings for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence actions org-scoped"
  on public.intelligence_actions for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence briefings org-scoped"
  on public.intelligence_briefings for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "intelligence agents org-scoped"
  on public.intelligence_agents for all
  using (organization_id in (select id from public.organizations where id = organization_id));
