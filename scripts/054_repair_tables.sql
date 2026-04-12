-- SCRIPTS DE REPARO DAS TABELAS
-- Execute este conteúdo no console SQL do seu Supabase para garantir que as novas colunas existam.

-- 1. Reparar tabela de LEADS
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Reparar tabela de VISITS (Analytics)
-- Criar a tabela se ela não existir
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL,
    visitor_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referrer TEXT,
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir que a coluna visitor_id existe (caso a tabela já existisse sem ela)
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

-- 3. Reset de Permissões (RLS) e Correção de Recursividade
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem seus próprios perfis
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
CREATE POLICY "Users can see own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

-- Política para admins verem tudo (Evitando recursividade)
DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
CREATE POLICY "Admins can see all profiles" ON public.profiles
FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
-- Nota: Se a de cima ainda der erro de recursão no seu Supabase, use esta alternativa:
-- CREATE POLICY "Admins can see all profiles" ON public.profiles FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

-- Corrigir RLS para VISITS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert for visits" ON public.visits;
CREATE POLICY "Allow public insert for visits" ON public.visits 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admins to view all visits" ON public.visits;
CREATE POLICY "Allow admins to view all visits" ON public.visits 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Corrigir RLS para Leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view leads" ON public.leads;
CREATE POLICY "Admins can view leads" ON public.leads
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
