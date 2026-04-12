-- Add patients.birthday column if missing to support birthday features
BEGIN;

ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Normalize empty birthday strings (if any) to NULL
-- Safe comparison: cast to text before comparing to avoid invalid input syntax for DATE columns
UPDATE public.patients
SET birthday = NULL
WHERE trim(coalesce(birthday::text, '')) = '';

COMMIT;

-- This migration is idempotent and safe to run multiple times.
