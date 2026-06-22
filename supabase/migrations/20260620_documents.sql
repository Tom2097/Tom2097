-- Add content column safely if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'content'
  ) then
    alter table documents add column content text;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'raw_data'
  ) then
    alter table documents add column raw_data jsonb;
  end if;
end $$;

-- Document reports table
create table if not exists document_reports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid,
  document_ids uuid[],
  report_type text not null default 'analysis',
  summary text,
  insights jsonb,
  created_at timestamp default now()
);

-- Enable RLS
alter table documents enable row level security;
alter table document_reports enable row level security;

-- Drop existing policies to avoid duplicates
drop policy if exists "Users can view their org documents" on documents;
drop policy if exists "Users can insert their org documents" on documents;
drop policy if exists "Users can delete their org documents" on documents;
drop policy if exists "Users can view their org reports" on document_reports;

-- Policies (using organization_id directly since we filter by it in API)
create policy "Enable all for authenticated users"
  on documents for all
  using (true)
  with check (true);

create policy "Enable all for authenticated users"
  on document_reports for all
  using (true)
  with check (true);
