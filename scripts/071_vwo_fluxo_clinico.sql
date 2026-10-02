-- ==============================================================================
-- 071 — Vira Web Odonto: fluxo clínico (agenda → orçamento → plano de pagamento)
-- Aditiva e idempotente: só cria colunas/índices que ainda não existem.
-- O aplicativo funciona sem ela (com recursos degradados e aviso na interface);
-- após aplicar, passam a ser gravados: status clínico detalhado da consulta,
-- região/execução por procedimento, desconto/dentista do orçamento e o vínculo
-- das parcelas do plano de pagamento com o orçamento.
-- ==============================================================================

BEGIN;

-- 1. AGENDA: status clínico detalhado e dados do atendimento --------------------
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS clinical_status TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS first_visit BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS planned_procedure TEXT;  -- "Previsto"
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS occurrence TEXT;         -- "Realizado"

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_clinical_status_check' AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_clinical_status_check CHECK (
        clinical_status IS NULL OR clinical_status IN (
          'scheduled', 'confirmed', 'reception', 'in_care', 'finished',
          'missed', 'missed_rescheduled',
          'cancelled_patient', 'cancelled_clinic', 'cancelled_rescheduled'
        )
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_appointments_patient_date
  ON public.appointments (patient_id, appointment_date);

-- 2. ORÇAMENTO: região do procedimento e execução clínica -----------------------
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS tooth SMALLINT;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS execution_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS executed_appointment_id UUID
  REFERENCES public.appointments(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'budget_items_execution_status_check' AND conrelid = 'public.budget_items'::regclass
  ) THEN
    ALTER TABLE public.budget_items
      ADD CONSTRAINT budget_items_execution_status_check
      CHECK (execution_status IN ('pending', 'in_progress', 'completed'));
  END IF;
END$$;

-- 3. ORÇAMENTO: dentista indicado, desconto e condições do plano ----------------
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS professional_id UUID
  REFERENCES public.professionals(id) ON DELETE SET NULL;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS first_due_date DATE;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- 4. CONTAS A RECEBER: parcelas vinculadas ao orçamento -------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS budget_id UUID
  REFERENCES public.budgets(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS installment_number SMALLINT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS installment_total SMALLINT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS document_number TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_budget ON public.payments (budget_id);

COMMIT;
