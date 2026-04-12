-- Migration script to update master plans to master and update constraints
-- This script only runs if plan_type column exists

DO $$
BEGIN
  -- Check if plan_type column exists before updating
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscriptions' 
    AND column_name = 'plan_type'
  ) THEN
    -- Update existing master subscriptions to master
    UPDATE public.subscriptions
    SET plan_type = 'master'
    WHERE plan_type = 'master';

    -- Drop the old constraint
    ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

    -- Add new constraint with master instead of master
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_plan_type_check
    CHECK (plan_type IN ('basic', 'premium', 'master'));
  END IF;

  -- Update all existing billing_cycle values to 'monthly' before adding constraint
  -- Check if billing_cycle column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscriptions' 
    AND column_name = 'billing_cycle'
  ) THEN
    -- Update all existing records to monthly
    UPDATE public.subscriptions
    SET billing_cycle = 'monthly'
    WHERE billing_cycle IS NULL OR billing_cycle != 'monthly';

    -- Drop the old constraint if it exists
    ALTER TABLE public.subscriptions
    DROP CONSTRAINT IF EXISTS subscriptions_billing_cycle_check;

    -- Add new constraint - all plans are now monthly
    ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_billing_cycle_check
    CHECK (billing_cycle IN ('monthly'));
  END IF;
END $$;
