-- Drop existing subscriptions table if it exists and recreate with complete schema
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Create subscriptions table with all required columns
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL CHECK (plan_name IN ('basic', 'premium', 'master')),
  plan_price DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'master')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'past_due')),
  
  -- Stripe integration fields
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  
  -- Date fields
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  
  -- Payment
  payment_method TEXT DEFAULT 'stripe',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one subscription per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert a test subscription for the current user (if authenticated)
-- This will create a Premium subscription for testing
INSERT INTO subscriptions (
  user_id,
  plan_name,
  plan_price,
  billing_cycle,
  status,
  start_date,
  end_date,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  payment_method
)
SELECT 
  auth.uid(),
  'premium',
  49.90,
  'monthly',
  'active',
  NOW(),
  NOW() + INTERVAL '1 month',
  NOW(),
  NOW() + INTERVAL '1 month',
  FALSE,
  'stripe'
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;
