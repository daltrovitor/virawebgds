-- Creating comprehensive base schema that all other scripts depend on

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  clinic_name TEXT,
  phone TEXT,
  subscription_plan TEXT DEFAULT 'basic',
  subscription_status TEXT DEFAULT 'active',
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create patients table (renamed to clients in UI but keeping DB name for compatibility)
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  date_of_birth DATE,
  birthday DATE, -- For birthday tracking
  address TEXT,
  notes TEXT,
  patient_notes TEXT,
  profile_photo_url TEXT,
  status TEXT DEFAULT 'active',
  payment_status TEXT DEFAULT 'current',
  payment_due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create professionals table
CREATE TABLE IF NOT EXISTS professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  crm TEXT,
  specialty TEXT,
  date_of_birth DATE,
  birthday DATE, -- For birthday tracking
  work_days TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'basic',
  plan_name TEXT NOT NULL DEFAULT 'Básico',
  plan_price DECIMAL(10, 2) NOT NULL DEFAULT 149.90,
  billing_cycle TEXT DEFAULT 'monthly',
  status TEXT DEFAULT 'active',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  payment_method TEXT,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  stripe_payment_id TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create support_replies table
CREATE TABLE IF NOT EXISTS support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_staff BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create goals table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value DECIMAL(10, 2) NOT NULL,
  current_value DECIMAL(10, 2) DEFAULT 0,
  unit TEXT,
  category TEXT,
  deadline DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  report_data JSONB,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_birthday ON patients(birthday) WHERE birthday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
CREATE INDEX IF NOT EXISTS idx_professionals_birthday ON professionals(birthday) WHERE birthday IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_replies_ticket_id ON support_replies(ticket_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can view their own patients" ON patients;
DROP POLICY IF EXISTS "Users can insert their own patients" ON patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON patients;
DROP POLICY IF EXISTS "Users can view their own professionals" ON professionals;
DROP POLICY IF EXISTS "Users can insert their own professionals" ON professionals;
DROP POLICY IF EXISTS "Users can update their own professionals" ON professionals;
DROP POLICY IF EXISTS "Users can delete their own professionals" ON professionals;
DROP POLICY IF EXISTS "Users can view their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
DROP POLICY IF EXISTS "Users can insert their own payments" ON payments;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
DROP POLICY IF EXISTS "Users can view their own support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can insert their own support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update their own support tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view replies to their tickets" ON support_replies;
DROP POLICY IF EXISTS "Users can insert replies to their tickets" ON support_replies;
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can insert their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;
DROP POLICY IF EXISTS "Users can view their own reports" ON reports;
DROP POLICY IF EXISTS "Users can insert their own reports" ON reports;

-- Create RLS policies for users
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for patients
CREATE POLICY "Users can view their own patients" ON patients
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patients" ON patients
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients" ON patients
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients" ON patients
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for professionals
CREATE POLICY "Users can view their own professionals" ON professionals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own professionals" ON professionals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own professionals" ON professionals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own professionals" ON professionals
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for appointments
CREATE POLICY "Users can view their own appointments" ON appointments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointments" ON appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" ON appointments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" ON appointments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for subscriptions
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for payments
CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments" ON payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for support tickets
CREATE POLICY "Users can view their own support tickets" ON support_tickets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own support tickets" ON support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own support tickets" ON support_tickets
  FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for support replies
CREATE POLICY "Users can view replies to their tickets" ON support_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM support_tickets 
      WHERE support_tickets.id = support_replies.ticket_id 
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert replies to their tickets" ON support_replies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets 
      WHERE support_tickets.id = ticket_id 
      AND support_tickets.user_id = auth.uid()
    )
  );

-- Create RLS policies for goals
CREATE POLICY "Users can view their own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for reports
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
