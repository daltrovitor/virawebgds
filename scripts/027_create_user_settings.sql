-- Create user_settings table (if missing) and add RLS policies
-- This migration is safe to run multiple times (uses IF NOT EXISTS)

BEGIN;

-- Create table with user_id as primary key
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY,
  has_watched_tutorial boolean DEFAULT FALSE,
  show_tutorial_notification boolean DEFAULT TRUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Attempt to add foreign key to auth.users (if the auth schema exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    BEGIN
      ALTER TABLE public.user_settings
        ADD CONSTRAINT fk_user_settings_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN duplicate_object THEN
      -- constraint already exists, ignore
      NULL;
    END;
  END IF;
END$$;

-- Enable row level security so policies can be added safely
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Selective policies to allow the authenticated user to manage their own settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'user_settings' AND p.polname = 'user_settings_select_own') THEN
    EXECUTE 'CREATE POLICY user_settings_select_own ON public.user_settings FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'user_settings' AND p.polname = 'user_settings_insert_own') THEN
    EXECUTE 'CREATE POLICY user_settings_insert_own ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_policy p
    JOIN pg_catalog.pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'user_settings' AND p.polname = 'user_settings_update_own') THEN
    EXECUTE 'CREATE POLICY user_settings_update_own ON public.user_settings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

COMMIT;

-- Notes:
-- Run this migration in your Supabase SQL editor or via psql connected to the project's DB.
-- If you're using Supabase's migrations tooling, adapt the filename/ordering as needed.
