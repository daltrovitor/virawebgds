  -- Create professionals table with proper structure and RLS
  CREATE TABLE IF NOT EXISTS professionals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    crm TEXT,
    specialty TEXT,
    work_days TEXT,
    notes TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  -- Enable Row Level Security
  ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view their own professionals" ON professionals;
  DROP POLICY IF EXISTS "Users can insert their own professionals" ON professionals;
  DROP POLICY IF EXISTS "Users can update their own professionals" ON professionals;
  DROP POLICY IF EXISTS "Users can delete their own professionals" ON professionals;

  -- Create RLS policies
  CREATE POLICY "Users can view their own professionals"
    ON professionals FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY "Users can insert their own professionals"
    ON professionals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can update their own professionals"
    ON professionals FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY "Users can delete their own professionals"
    ON professionals FOR DELETE
    USING (auth.uid() = user_id);

  -- Create index for better query performance
  CREATE INDEX IF NOT EXISTS idx_professionals_user_id ON professionals(user_id);
  CREATE INDEX IF NOT EXISTS idx_professionals_status ON professionals(status);
