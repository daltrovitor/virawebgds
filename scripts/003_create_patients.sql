-- Create patients table
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  cpf text,
  date_of_birth date,
  address text,
  notes text,
  status text default 'active',
  payment_status text,
  last_payment_date date,
  payment_due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.patients enable row level security;
 
-- RLS Policies for patients
-- Drop existing policies if they exist (make script idempotent)
DROP POLICY IF EXISTS "patients_select_own" ON public.patients;
DROP POLICY IF EXISTS "patients_insert_own" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own" ON public.patients;
DROP POLICY IF EXISTS "patients_delete_own" ON public.patients;

create policy "patients_select_own"
  on public.patients for select
  using (auth.uid() = user_id);

create policy "patients_insert_own"
  on public.patients for insert
  with check (auth.uid() = user_id);

create policy "patients_update_own"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "patients_delete_own"
  on public.patients for delete
  using (auth.uid() = user_id);

-- Create indexes
create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists patients_status_idx on public.patients(status);
