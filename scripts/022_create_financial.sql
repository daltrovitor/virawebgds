-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'BRL',
  status text DEFAULT 'paid' CHECK (status IN ('paid','pending','overdue','refunded')),
  payment_date timestamptz,
  due_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_own" ON public.payments;
DROP POLICY IF EXISTS "payments_update_own" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_own" ON public.payments;

CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "payments_insert_own"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "payments_update_own"
  ON public.payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "payments_delete_own"
  ON public.payments FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS payments_patient_id_idx ON public.payments(patient_id);
CREATE INDEX IF NOT EXISTS payments_payment_date_idx ON public.payments(payment_date);

-- Create financial_sessions table
CREATE TABLE IF NOT EXISTS public.financial_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  session_date date NOT NULL,
  unit_price numeric(12,2) NOT NULL,
  discount numeric(12,2) DEFAULT 0,
  paid boolean DEFAULT false,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.financial_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own" ON public.financial_sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.financial_sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.financial_sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.financial_sessions;

CREATE POLICY "sessions_select_own"
  ON public.financial_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own"
  ON public.financial_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_own"
  ON public.financial_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own"
  ON public.financial_sessions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.financial_sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_patient_id_idx ON public.financial_sessions(patient_id);
CREATE INDEX IF NOT EXISTS sessions_session_date_idx ON public.financial_sessions(session_date);
