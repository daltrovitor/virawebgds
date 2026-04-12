-- Tabela para rastreamento de visitas reais (Analytics próprio)
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    visitor_id TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Habilitar RLS mas permitir inserções públicas (para qualquer um logar uma visita)
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert for visits" ON public.visits 
FOR INSERT WITH CHECK (true);

-- Ensure admins can view all visits
DROP POLICY IF EXISTS "Allow admins to view all visits" ON public.visits;
CREATE POLICY "Allow admins to view all visits" ON public.visits 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
