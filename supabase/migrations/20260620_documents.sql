-- Documents table
create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  type text not null,
  content text,
  raw_data jsonb,
  file_size integer,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Document reports table
create table if not exists document_reports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  document_ids uuid[],
  report_type text not null,
  summary text,
  insights jsonb,
  created_at timestamp default now()
);

-- Enable RLS
alter table documents enable row level security;
alter table document_reports enable row level security;

-- Policies
create policy "Users can view their org documents"
  on documents for select
  using (organization_id = auth.jwt() ->> 'organization_id'::text);

create policy "Users can insert their org documents"
  on documents for insert
  with check (organization_id = auth.jwt() ->> 'organization_id'::text);

create policy "Users can delete their org documents"
  on documents for delete
  using (organization_id = auth.jwt() ->> 'organization_id'::text);

create policy "Users can view their org reports"
  on document_reports for select
  using (organization_id = auth.jwt() ->> 'organization_id'::text);
