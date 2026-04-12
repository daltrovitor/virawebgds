-- Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Set first user as admin (optional, user can run manually)
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';

-- Update RLS for profiles to allow admins to see everything
CREATE POLICY "Admins can see all profiles" ON public.profiles
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Update RLS for leads to allow admins to see everything
DROP POLICY IF EXISTS "Admins can view leads" ON leads;
CREATE POLICY "Admins can view leads" ON leads
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Update RLS for subscriptions table (assuming it exists)
-- CREATE POLICY "Admins can view subscriptions" ON subscriptions
-- FOR SELECT USING (
--   (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
-- );
