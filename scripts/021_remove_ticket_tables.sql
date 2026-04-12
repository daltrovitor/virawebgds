-- Remove ticket functionality completely
-- Drop support ticket tables and related objects

-- Drop policies first
DROP POLICY IF EXISTS "Users can view their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can create their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update their own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view messages from their tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Users can create messages in their tickets" ON public.support_messages;

-- Drop triggers
DROP TRIGGER IF EXISTS support_tickets_updated_at ON public.support_tickets;

-- Drop functions
DROP FUNCTION IF EXISTS update_support_tickets_updated_at();

-- Drop tables
DROP TABLE IF EXISTS public.support_messages CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Note: Ticket functionality has been removed. 
-- Support is now handled via Email (viraweb.online@gmail.com) and WhatsApp ((62) 9 9246-6109)
-- Premium and Master users also have access to ViraBot AI chat for instant support.
