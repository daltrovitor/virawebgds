-- Create goals table
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_value numeric,
  current_value numeric default 0,
  unit text,
  deadline date,
  status text default 'em_progresso' check (status in ('em_progresso', 'concluida', 'cancelada')),
  category text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.goals enable row level security;

-- RLS Policies for goals
create policy "goals_select_own"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "goals_insert_own"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "goals_update_own"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "goals_delete_own"
  on public.goals for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists goals_status_idx on public.goals(status);
