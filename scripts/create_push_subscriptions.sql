-- =============================================================
-- Migration: Create Push Subscriptions table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
-- Ensure unique endpoint per user to avoid duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_unique_endpoint ON public.push_subscriptions(user_id, endpoint);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert and select their own subscriptions
CREATE POLICY "Users can manage own push subscriptions"
    ON public.push_subscriptions
    USING (auth.uid() = user_id);

-- Trigger for update
CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_support_tickets_updated_at(); -- using the same generic function
