-- Create reports table for storing user-generated reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  report_type TEXT NOT NULL, -- 'financial', 'appointments', 'patients', 'custom'
  date_range_start DATE,
  date_range_end DATE,
  data JSONB, -- Store report data as JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);

-- Enable Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for reports
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports" ON reports
  FOR DELETE USING (auth.uid() = user_id);
