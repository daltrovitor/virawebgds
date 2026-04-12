-- Create reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  report_type text not null check (report_type in ('financial', 'appointments', 'patients', 'custom')),
  date_range_start date,
  date_range_end date,
  data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.reports enable row level security;

-- RLS Policies for reports
create policy "reports_select_own"
  on public.reports for select
  using (auth.uid() = user_id);

create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = user_id);

create policy "reports_update_own"
  on public.reports for update
  using (auth.uid() = user_id);

create policy "reports_delete_own"
  on public.reports for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists reports_user_id_idx on public.reports(user_id);
create index if not exists reports_type_idx on public.reports(report_type);
