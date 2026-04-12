-- Fix schema compatibility issues and consolidate structure

-- 1. Fix timestamp columns to use TIMESTAMP WITH TIME ZONE for consistency
DO $$
BEGIN
  -- Users table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'created_at'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.users 
      ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE USING created_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'updated_at'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.users 
      ALTER COLUMN updated_at TYPE TIMESTAMP WITH TIME ZONE USING updated_at AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'subscription_start_date'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.users 
      ALTER COLUMN subscription_start_date TYPE TIMESTAMP WITH TIME ZONE USING subscription_start_date AT TIME ZONE 'UTC';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'subscription_end_date'
    AND data_type = 'timestamp without time zone'
  ) THEN
    ALTER TABLE public.users 
      ALTER COLUMN subscription_end_date TYPE TIMESTAMP WITH TIME ZONE USING subscription_end_date AT TIME ZONE 'UTC';
  END IF;
END $$;

-- 2. Add missing duration_minutes column to appointments if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'duration_minutes'
  ) THEN
    ALTER TABLE public.appointments ADD COLUMN duration_minutes INTEGER DEFAULT 30;
  END IF;
END $$;

-- 3. Ensure all CHECK constraints are properly named and exist
DO $$
BEGIN
  -- Patients status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'patients_status_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_status_check
    CHECK (status IN ('active', 'inactive'));
  END IF;

  -- Professionals status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'professionals_status_check' AND conrelid = 'public.professionals'::regclass
  ) THEN
    ALTER TABLE public.professionals
    ADD CONSTRAINT professionals_status_check
    CHECK (status IN ('active', 'inactive'));
  END IF;

  -- Appointments status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'appointments_status_check' AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('scheduled', 'completed', 'canceled', 'cancelled'));
  END IF;

  -- Subscriptions status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscriptions_status_check' AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'cancelled', 'expired', 'past_due'));
  END IF;

  -- Notifications type check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check' AND conrelid = 'public.notifications'::regclass
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('info', 'warning', 'error', 'success'));
  END IF;

  -- Payments status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payments_status_check' AND conrelid = 'public.payments'::regclass
  ) THEN
    ALTER TABLE public.payments
    ADD CONSTRAINT payments_status_check
    CHECK (status IN ('paid', 'pending', 'overdue', 'cancelled'));
  END IF;

  -- Patients payment_status check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'patients_payment_status_check' AND conrelid = 'public.patients'::regclass
  ) THEN
    ALTER TABLE public.patients
    ADD CONSTRAINT patients_payment_status_check
    CHECK (payment_status IN ('up_to_date', 'overdue', 'pending'));
  END IF;
END $$;

-- 4. Create missing indexes
CREATE INDEX IF NOT EXISTS idx_patients_payment_status ON public.patients(payment_status);
CREATE INDEX IF NOT EXISTS idx_patients_payment_due_date ON public.patients(payment_due_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_professional_id ON public.appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- 5. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create triggers for updated_at on all tables (only if updated_at column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'patients' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_patients_updated_at ON public.patients;
    CREATE TRIGGER update_patients_updated_at
      BEFORE UPDATE ON public.patients
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'professionals' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_professionals_updated_at ON public.professionals;
    CREATE TRIGGER update_professionals_updated_at
      BEFORE UPDATE ON public.professionals
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appointments' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_appointments_updated_at ON public.appointments;
    CREATE TRIGGER update_appointments_updated_at
      BEFORE UPDATE ON public.appointments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscriptions' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'payments' 
    AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
    CREATE TRIGGER update_payments_updated_at
      BEFORE UPDATE ON public.payments
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
