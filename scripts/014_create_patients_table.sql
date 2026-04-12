-- Create patients table with proper structure and RLS
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  date_of_birth DATE,
  address TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue')),
  payment_due_date DATE,
  last_payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own patients" ON patients;
DROP POLICY IF EXISTS "Users can insert their own patients" ON patients;
DROP POLICY IF EXISTS "Users can update their own patients" ON patients;
DROP POLICY IF EXISTS "Users can delete their own patients" ON patients;

-- Create RLS policies
CREATE POLICY "Users can view their own patients"
  ON patients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patients"
  ON patients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own patients"
  ON patients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own patients"
  ON patients FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
