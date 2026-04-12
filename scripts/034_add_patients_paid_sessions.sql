-- 034_add_patients_paid_sessions.sql
-- Add a paid_sessions integer column to patients so triggers in
-- payments can update a running total of paid sessions.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS paid_sessions integer DEFAULT 0;

-- Optional index for queries that filter/sort by paid_sessions
CREATE INDEX IF NOT EXISTS idx_patients_paid_sessions ON public.patients(paid_sessions);

-- Backfill existing counts (safe to run multiple times)
UPDATE public.patients p
SET paid_sessions = COALESCE(pct.paid_count, 0)
FROM (
  SELECT patient_id, COUNT(*) as paid_count
  FROM public.payments
  WHERE status = 'paid'
  GROUP BY patient_id
) pct
WHERE p.id = pct.patient_id;

-- Note: If your DB uses a different schema prefix, adjust 'public.' accordingly.
