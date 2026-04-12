-- =============================================================
-- Migration: Create User Reminders Table
-- =============================================================

CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    trigger_at TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user_id and trigger time
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON public.reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_trigger_at ON public.reminders(trigger_at) WHERE is_sent = false;

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Users can insert, update, select and delete their own reminders
CREATE POLICY "Users can manage own reminders"
    ON public.reminders
    USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_reminders_updated_at
    BEFORE UPDATE ON public.reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_support_tickets_updated_at();

-- Provide a comment
COMMENT ON TABLE public.reminders IS 'Table for storing scheduled user reminders.';
