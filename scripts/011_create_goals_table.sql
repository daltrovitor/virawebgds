-- Create goals table for user-defined goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT, -- e.g., "clientes", "consultas", "R$"
  deadline DATE,
  status TEXT DEFAULT 'em_progresso' CHECK (status IN ('em_progresso', 'concluida', 'cancelada')),
  category TEXT, -- e.g., "financeiro", "clientes", "profissionais", "geral"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see only their own goals
CREATE POLICY "Users can view their own goals"
  ON goals FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own goals
CREATE POLICY "Users can insert their own goals"
  ON goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own goals
CREATE POLICY "Users can update their own goals"
  ON goals FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own goals
CREATE POLICY "Users can delete their own goals"
  ON goals FOR DELETE
  USING (auth.uid() = user_id);
