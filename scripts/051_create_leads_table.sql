-- Create leads table for capturing form submissions
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ramo TEXT NOT NULL,
    faturamento TEXT NOT NULL,
    clientes INTEGER,
    agendamentos INTEGER,
    idioma TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
 );

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert leads (as it's a lead generation form)
CREATE POLICY "Public can insert leads" ON leads
FOR INSERT WITH CHECK (true);

-- Allow authenticated admins to select leads
CREATE POLICY "Admins can view leads" ON leads
FOR SELECT USING (auth.role() = 'authenticated');
