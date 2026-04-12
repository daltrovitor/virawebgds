-- Create visits tracking table
BEGIN;

CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  visit_date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "visits_select_own" ON public.visits;
DROP POLICY IF EXISTS "visits_insert_own" ON public.visits;
DROP POLICY IF EXISTS "visits_update_own" ON public.visits;
DROP POLICY IF EXISTS "visits_delete_own" ON public.visits;

-- Create policies
CREATE POLICY "visits_select_own"
  ON public.visits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "visits_insert_own"
  ON public.visits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "visits_update_own"
  ON public.visits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "visits_delete_own"
  ON public.visits FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS visits_user_id_idx ON public.visits(user_id);
CREATE INDEX IF NOT EXISTS visits_patient_id_idx ON public.visits(patient_id);
CREATE INDEX IF NOT EXISTS visits_payment_id_idx ON public.visits(payment_id);
CREATE INDEX IF NOT EXISTS visits_date_idx ON public.visits(visit_date);

COMMIT;
