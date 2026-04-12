-- Create subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Updated plan_type constraint to use 'master' instead of 'master'
  plan_type text not null check (plan_type in ('basic', 'premium', 'master')),
  status text not null check (status in ('active', 'canceled', 'expired')),
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.subscriptions enable row level security;

-- RLS Policies for subscriptions
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "subscriptions_insert_own"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = user_id);

create policy "subscriptions_delete_own"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- Create index for faster queries
create index if not exists subscriptions_user_id_idx on public.subscriptions(user_id);
create index if not exists subscriptions_status_idx on public.subscriptions(status);
