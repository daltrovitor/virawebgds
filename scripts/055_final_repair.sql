-- REPARO FINAL DO SISTEMA DE ADMIN E DASHBOARD
-- Este script resolve a inconsistência entre as tabelas 'users' e 'profiles'
-- e corrige as políticas de RLS recursivas que impedem a visualização de dados.

-- 1. Garantir que a tabela profiles tenha todas as colunas necessárias
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Sincronizar dados da tabela 'users' (caso exista) para 'profiles'
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        INSERT INTO public.profiles (id, full_name, email, subscription_plan, role)
        SELECT id, full_name, email, subscription_plan, 'user'
        FROM public.users
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            subscription_plan = EXCLUDED.subscription_plan;
            
        RAISE NOTICE 'Dados sincronizados de users para profiles.';
    END IF;
END $$;

-- 3. Reset de Permissões (RLS) para PROFILES (Evitando recursividade)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para checar se é admin sem causar recursão infinita
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT (role = 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can see all profiles" ON public.profiles;
CREATE POLICY "Admins can see all profiles" ON public.profiles
FOR SELECT USING ( public.is_admin() );


-- 4. Reparar tabela de LEADS e VISITS para usar FK com profiles
-- Isso ajuda o Supabase a entender as relações para os JOINS no frontend
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
ALTER TABLE public.leads ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.visits DROP CONSTRAINT IF EXISTS visits_user_id_fkey;
ALTER TABLE public.visits ADD CONSTRAINT visits_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 5. Garantir RLS para LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can insert leads" ON public.leads;
CREATE POLICY "Public can insert leads" ON public.leads
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view leads" ON public.leads;
CREATE POLICY "Admins can view leads" ON public.leads
FOR SELECT USING ( public.is_admin() );

-- 6. Garantir RLS para VISITS (Analytics)
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public insert for visits" ON public.visits;
CREATE POLICY "Allow public insert for visits" ON public.visits 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admins to view all visits" ON public.visits;
CREATE POLICY "Allow admins to view all visits" ON public.visits 
FOR SELECT USING ( public.is_admin() );


-- 7. DEFINIR O USUÁRIO ATUAL COMO ADMIN (Importante!)
-- Se o auth.uid() não estiver disponível via console, você pode definir pelo email:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'seu-email@exemplo.com';

-- Caso queira garantir que VOCÊ é o admin agora (o primeiro usuário na auth.users):
UPDATE public.profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users LIMIT 1);
