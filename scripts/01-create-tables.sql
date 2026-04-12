-- Create users table (extends Supabase auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  clinic_name TEXT,
  phone TEXT,
  subscription_plan TEXT DEFAULT 'free',
  subscription_status TEXT DEFAULT 'active',
  subscription_start_date TIMESTAMP,
  subscription_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT UNIQUE,
  date_of_birth DATE,
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',
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
  crm TEXT UNIQUE,
  specialty TEXT,
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
  plan_name TEXT NOT NULL,
  plan_price DECIMAL(10, 2) NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly',
  status TEXT DEFAULT 'active',
  start_date TIMESTAMP DEFAULT NOW(),
  end_date TIMESTAMP,
  payment_method TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

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
