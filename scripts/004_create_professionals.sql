-- Create professionals table
create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  specialty text not null,
  email text not null,
  phone text not null,
  crm text not null,
  work_days text,
  notes text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.professionals enable row level security;

-- RLS Policies for professionals
create policy "professionals_select_own"
  on public.professionals for select
  using (auth.uid() = user_id);

create policy "professionals_insert_own"   
  on public.professionals for insert
  with check (auth.uid() = user_id);

create policy "professionals_update_own"
  on public.professionals for update
  using (auth.uid() = user_id);

create policy "professionals_delete_own"
  on public.professionals for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists professionals_user_id_idx on public.professionals(user_id);
create index if not exists professionals_status_idx on public.professionals(status);
