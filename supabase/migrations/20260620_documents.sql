-- Add missing columns safely
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'documents' and column_name = 'content') then
    alter table documents add column content text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'documents' and column_name = 'raw_data') then
    alter table documents add column raw_data jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'documents' and column_name = 'file_size') then
    alter table documents add column file_size integer;
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
drop policy if exists "Enable all for authenticated users" on documents;
drop policy if exists "Enable all for authenticated users" on document_reports;

-- Org-scoped RLS: users can only access rows belonging to their organization.
-- The organization_id is resolved server-side via profiles, never from the client.
create policy "Users can view their org documents"
  on documents for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can insert their org documents"
  on documents for insert
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can update their org documents"
  on documents for update
  using (organization_id = (select organization_id from profiles where id = auth.uid()))
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can delete their org documents"
  on documents for delete
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can view their org reports"
  on document_reports for select
  using (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can insert their org reports"
  on document_reports for insert
  with check (organization_id = (select organization_id from profiles where id = auth.uid()));

create policy "Users can delete their org reports"
  on document_reports for delete
  using (organization_id = (select organization_id from profiles where id = auth.uid()));
