-- Create user_notes table for personal notes
CREATE TABLE IF NOT EXISTS public.user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_notes_user_id ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_created_at ON public.user_notes(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_notes
DROP POLICY IF EXISTS "Users can view their own notes" ON public.user_notes;
CREATE POLICY "Users can view their own notes"
  ON public.user_notes FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.user_notes;
CREATE POLICY "Users can insert their own notes"
  ON public.user_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.user_notes;
CREATE POLICY "Users can update their own notes"
  ON public.user_notes FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.user_notes;
CREATE POLICY "Users can delete their own notes"
  ON public.user_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_notes_updated_at ON public.user_notes;
CREATE TRIGGER user_notes_updated_at
  BEFORE UPDATE ON public.user_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_notes_updated_at();
