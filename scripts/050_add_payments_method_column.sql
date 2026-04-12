-- Migration: add missing `method` column to payments (idempotent)
-- This addresses runtime errors where queries reference payments.method
BEGIN;

-- Add column if it doesn't exist
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS method text;

-- Add a check constraint if it does not already exist (safe because new column defaults to NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_method_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_method_check CHECK (method IS NULL OR method IN ('cash','credit','debit','pix','transfer'));
  END IF;
END$$;

-- Keep RLS enabled and policies unchanged; this migration is idempotent and safe to run multiple times.
COMMIT;
