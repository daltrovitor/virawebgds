-- Enhance payments schema with additional visit tracking and recurrence options
BEGIN;

-- Add visit tracking columns
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS visit_date date,
  ADD COLUMN IF NOT EXISTS visits_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_visit_date date;

-- Update recurrence_unit check constraint to support daily and weekly
ALTER TABLE IF EXISTS public.payments
  DROP CONSTRAINT IF EXISTS check_recurrence_unit;

ALTER TABLE IF EXISTS public.payments
  ADD CONSTRAINT check_recurrence_unit 
  CHECK (recurrence_unit IN ('daily', 'weekly', 'monthly'));

-- Add index for visit tracking
CREATE INDEX IF NOT EXISTS idx_payments_visit_date ON public.payments(visit_date);
CREATE INDEX IF NOT EXISTS idx_payments_next_visit_date ON public.payments(next_visit_date);

COMMIT;
