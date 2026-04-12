-- 035_add_payments_attendance_id.sql
-- Add attendance_id FK to payments so payments can be linked to attendance rows.

-- 1) Add the column (idempotent)
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS attendance_id uuid REFERENCES public.attendance(id) ON DELETE SET NULL;

-- 2) Optional index to speed joins
CREATE INDEX IF NOT EXISTS idx_payments_attendance_id ON public.payments(attendance_id);

-- 3) Backfill attendance_id when attendance.payment_id points to the payment
--    This matches existing attendance rows that already reference payments.
UPDATE public.payments p
SET attendance_id = a.id
FROM public.attendance a
WHERE p.id = a.payment_id
  AND p.attendance_id IS NULL;

-- Notes:
-- - If your DB schema uses a different schema than 'public', adjust the table names.
-- - After adding the column, PostgREST / Supabase REST should expose the new column; if you still get a schema cache error, re-deploy or refresh the Supabase REST cache (often reloading the project or waiting a minute suffices).
