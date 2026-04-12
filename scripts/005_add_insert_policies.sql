-- Add missing INSERT policies for notifications (system needs to create notifications)

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;

-- Create policy that allows inserting notifications for authenticated users
CREATE POLICY "notifications_insert_own"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also allow service role to insert notifications (for system-generated notifications)
DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
CREATE POLICY "notifications_insert_service"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Ensure subscriptions can be inserted
DROP POLICY IF EXISTS "subscriptions_insert_own" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to insert their own user record (for signup)
DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);
