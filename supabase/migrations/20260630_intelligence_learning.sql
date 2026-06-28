-- Intelligence Learning: feedback tracking, online models, confidence calibration

-- Feedback tracker for prediction and action outcomes
create table if not exists public.intelligence_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  prediction_id text,
  action_id text,
  metric text,
  action_type text,
  module text,
  predicted_value float,
  actual_value float,
  error float,
  absolute_error_percent float,
  was_correct boolean,
  was_successful boolean,
  time_to_complete float,
  outcome_type text not null check (outcome_type in ('prediction', 'action')),
  notes text,
  created_at timestamptz not null default now()
);

create index idx_intelligence_feedback_org on public.intelligence_feedback(organization_id);
create index idx_intelligence_feedback_metric on public.intelligence_feedback(organization_id, metric);

-- Online learning models (incremental, no batch training needed)
create table if not exists public.intelligence_online_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  model_type text not null check (model_type in ('exponential_smoothing', 'bayesian_average', 'trend', 'seasonal')),
  parameters jsonb not null default '{}'::jsonb,
  observations int not null default 0,
  last_value float not null default 0,
  last_updated timestamptz not null default now()
);

create unique index idx_intelligence_online_models_unique on public.intelligence_online_models(organization_id, metric, model_type);

-- Confidence calibration (accuracy tracking per metric)
create table if not exists public.intelligence_confidence_calibration (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  total_predictions int not null default 0,
  correct_predictions int not null default 0,
  accuracy float not null default 0,
  average_confidence float not null default 0,
  calibration_error float not null default 0,
  last_updated timestamptz not null default now()
);

create unique index idx_intelligence_calibration_unique on public.intelligence_confidence_calibration(organization_id, metric);

-- RLS
alter table public.intelligence_feedback enable row level security;
alter table public.intelligence_online_models enable row level security;
alter table public.intelligence_confidence_calibration enable row level security;

create policy "feedback org-scoped"
  on public.intelligence_feedback for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "online models org-scoped"
  on public.intelligence_online_models for all
  using (organization_id in (select id from public.organizations where id = organization_id));

create policy "confidence calibration org-scoped"
  on public.intelligence_confidence_calibration for all
  using (organization_id in (select id from public.organizations where id = organization_id));
