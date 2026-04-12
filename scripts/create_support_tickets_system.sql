-- =============================================================
-- Migration: Re-create support tickets system with Admin Access
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- 1. Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create support_messages table
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_id ON public.support_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON public.support_messages(created_at);

-- 4. Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for support_tickets

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets
CREATE POLICY "Users can update their own tickets"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id);

-- !! Admins (or service role) can read all tickets
CREATE POLICY "Admins can read all tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- !! Admins can update all tickets
CREATE POLICY "Admins can update all tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- 6. RLS Policies for support_messages

-- Users can view messages from their tickets
CREATE POLICY "Users can view messages from their tickets"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets 
      WHERE support_tickets.id = support_messages.ticket_id 
      AND support_tickets.user_id = auth.uid()
    )
  );

-- Users can create messages in their tickets
CREATE POLICY "Users can create messages in their tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.support_tickets 
      WHERE support_tickets.id = ticket_id 
      AND support_tickets.user_id = auth.uid()
    )
  );

-- !! Admins can read all messages
CREATE POLICY "Admins can read all messages"
  ON public.support_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- !! Admins can insert messages
CREATE POLICY "Admins can insert messages"
  ON public.support_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );


-- 7. Create updated_at trigger for support_tickets
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();

