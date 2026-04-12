-- Atualizar a tabela subscriptions para corresponder à estrutura esperada pelo código

-- Primeiro, remover a tabela antiga se existir
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Criar a tabela subscriptions com a estrutura correta
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'premium', 'master')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired')),
  -- Adicionando coluna billing_cycle que estava faltando
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'master')),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Habilitar Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Inserir uma assinatura de teste para o usuário atual (se houver)
-- Isso será útil para testar a interface
INSERT INTO subscriptions (user_id, plan_type, status, billing_cycle, current_period_start, current_period_end)
SELECT 
  auth.uid(),
  'premium',
  'active',
  'monthly',
  NOW(),
  NOW() + INTERVAL '30 days'
WHERE auth.uid() IS NOT NULL
ON CONFLICT DO NOTHING;
