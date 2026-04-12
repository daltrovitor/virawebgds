DO $$
BEGIN
  -- 1️⃣ Drop existing check constraints first (to avoid violation)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscriptions_plan_name_check'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_plan_name_check;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'subscriptions_billing_cycle_check'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_billing_cycle_check;
  END IF;

  -- 2️⃣ Now update old/variant plan names to standardized values
  UPDATE subscriptions 
  SET plan_name = 'basic' 
  WHERE LOWER(plan_name) IN ('básico', 'basico', 'free', 'basic');

  UPDATE subscriptions 
  SET plan_name = 'premium' 
  WHERE LOWER(plan_name) IN ('premium', 'pro');

  UPDATE subscriptions 
  SET plan_name = 'master' 
  WHERE LOWER(plan_name) IN ('master', 'vitalício', 'vitalicio', 'master');

  -- 3️⃣ Recreate check constraints safely
  ALTER TABLE subscriptions 
  ADD CONSTRAINT subscriptions_plan_name_check 
  CHECK (plan_name IN ('basic', 'premium', 'master'));

  ALTER TABLE subscriptions 
  ADD CONSTRAINT subscriptions_billing_cycle_check 
  CHECK (billing_cycle IN ('monthly', 'yearly', 'master'));

  -- 4️⃣ Add plan limit columns if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'max_patients'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_patients INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'max_professionals'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_professionals INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' AND column_name = 'max_appointments_per_month'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN max_appointments_per_month INTEGER;
  END IF;

  -- 5️⃣ Set default limits based on plan type
  UPDATE subscriptions 
  SET 
    max_patients = 75,
    max_professionals = 7,
    max_appointments_per_month = 50
  WHERE plan_name = 'basic';

  UPDATE subscriptions 
  SET 
    max_patients = 500,
    max_professionals = 50,
    max_appointments_per_month = 500
  WHERE plan_name = 'premium';

  UPDATE subscriptions 
  SET 
    max_patients = NULL,
    max_professionals = NULL,
    max_appointments_per_month = NULL
  WHERE plan_name = 'master';
END $$;
