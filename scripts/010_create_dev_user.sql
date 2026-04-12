-- Script para criar usuário dev com acesso premium gratuito
-- Execute este script após criar sua conta dev no sistema

-- Primeiro, você precisa criar uma conta normalmente através da interface
-- Depois, execute este script substituindo 'seu-email-dev@exemplo.com' pelo seu email

-- Atualizar usuário para ter plano premium
UPDATE users 
SET 
  subscription_plan = 'premium',
  subscription_status = 'active',
  subscription_start_date = NOW(),
  subscription_end_date = NOW() + INTERVAL '100 years'
WHERE email = 'dev@viraweb.com';

-- Criar assinatura premium gratuita para o usuário dev
INSERT INTO subscriptions (
  user_id,
  plan_type,
  status,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
)
SELECT 
  id,
  'premium',
  'active',
  NULL,
  'dev_subscription_' || id,
  NOW(),
  NOW() + INTERVAL '100 years',
  false,
  NOW(),
  NOW()
FROM users
WHERE email = 'dev@viraweb.com'
ON CONFLICT DO NOTHING;

-- Verificar se foi criado com sucesso
SELECT 
  u.email,
  u.subscription_plan,
  u.subscription_status,
  s.plan_type,
  s.status,
  s.current_period_end
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email = 'dev@viraweb.com';
