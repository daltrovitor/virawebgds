-- =============================================================
-- Migration: Create user_activity table for tracking last login
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add a comment for documentation
COMMENT ON TABLE public.user_activity IS 'Tracks the last time each user accessed the dashboard';

-- 3. Create index for fast lookups by last_seen_at (useful for admin queries)
CREATE INDEX IF NOT EXISTS idx_user_activity_last_seen
  ON public.user_activity (last_seen_at DESC);

-- 4. Enable RLS
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- 5. Policy: Users can INSERT/UPDATE their own row
CREATE POLICY "Users can upsert own activity"
  ON public.user_activity
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Policy: Admins (or service role) can read all rows
-- This allows the admin dashboard (which uses the anon key with the admin's session)
-- to read all activity rows. We use a simple SELECT policy tied to profiles.role = 'admin'.
CREATE POLICY "Admins can read all activity"
  ON public.user_activity
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
