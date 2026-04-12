-- Add recurrence columns to payments table
BEGIN;

ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_unit text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

COMMIT;

-- Idempotent migration to support recurring payments
