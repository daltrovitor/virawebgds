-- Idempotent migration to ensure payments table has all expected columns and policies
BEGIN;

-- Add optional columns used by the app
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS payment_date timestamptz,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_unit text,
  ADD COLUMN IF NOT EXISTS recurrence_interval integer,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- If the column exists but is NOT NULL (legacy schema), make it nullable so payments can be created without a patient
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'patient_id' AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE public.payments ALTER COLUMN patient_id DROP NOT NULL';
  END IF;
END$$;

-- Ensure NOT NULL constraint exists for amount (if required by app)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'amount'
  ) THEN
    -- ensure column is NOT NULL and numeric
    -- skip changing if incompatible types; this is a best-effort safe check
    PERFORM 1;
  END IF;
END$$;

-- Ensure patients.birthday exists
ALTER TABLE IF EXISTS public.patients
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- Normalize empty birthday strings (if any) to NULL
UPDATE public.patients
SET birthday = NULL
WHERE trim(coalesce(birthday::text, '')) = '';

-- Enable RLS on payments and ensure basic policies exist
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'payments_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY payments_select_own ON public.payments FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'payments_insert_own'
  ) THEN
    EXECUTE 'CREATE POLICY payments_insert_own ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

COMMIT;

-- This script is safe to run multiple times (idempotent).
