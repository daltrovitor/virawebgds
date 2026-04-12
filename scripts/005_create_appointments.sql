-- Create appointments table
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer default 60,
  status text default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.appointments enable row level security;

-- RLS Policies for appointments
create policy "appointments_select_own"
  on public.appointments for select
  using (auth.uid() = user_id);

create policy "appointments_insert_own"
  on public.appointments for insert
  with check (auth.uid() = user_id);

create policy "appointments_update_own"
  on public.appointments for update
  using (auth.uid() = user_id);

create policy "appointments_delete_own"
  on public.appointments for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists appointments_user_id_idx on public.appointments(user_id);
create index if not exists appointments_patient_id_idx on public.appointments(patient_id);
create index if not exists appointments_professional_id_idx on public.appointments(professional_id);
create index if not exists appointments_date_idx on public.appointments(appointment_date);
create index if not exists appointments_status_idx on public.appointments(status);
