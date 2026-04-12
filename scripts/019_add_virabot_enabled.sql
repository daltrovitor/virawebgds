-- Add virabot_enabled column to subscriptions table

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS virabot_enabled BOOLEAN DEFAULT FALSE;

-- Update existing subscriptions based on plan type
UPDATE subscriptions 
SET virabot_enabled = TRUE 
WHERE plan_name IN ('premium', 'master');

UPDATE subscriptions 
SET virabot_enabled = FALSE 
WHERE plan_name = 'basic';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_virabot_enabled 
ON subscriptions(virabot_enabled);

-- Add comment
COMMENT ON COLUMN subscriptions.virabot_enabled IS 'Whether ViraBot AI is enabled for this subscription (premium and master plans only)';
