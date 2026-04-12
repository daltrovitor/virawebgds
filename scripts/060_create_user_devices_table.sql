-- Migration: Create user_devices table for FCM tokens
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure unique token per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_token ON public.user_devices (user_id, fcm_token);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can manage own devices" ON public.user_devices;
CREATE POLICY "Users can manage own devices" ON public.user_devices
    FOR ALL USING (auth.uid() = user_id);

-- Grand access to authenticated users
GRANT ALL ON public.user_devices TO authenticated;
GRANT ALL ON public.user_devices TO service_role;
