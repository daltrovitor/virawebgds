export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  planType: "basic" | "premium" | "master"
  features: string[]
  billingCycle?: "monthly" | "one_time"
}

export const PRODUCTS: Product[] = [
  {
    id: "basic-plan",
    name: "Plano Básico",
    description: "Perfeito para começar sua clínica",
    priceInCents: 7500, // R$ 75,00
    planType: "basic",
    billingCycle: "monthly",
    features: [
      "Até 75 clientes",
      "Até 7 profissionais",
      "50 agendamentos/mês",
      "Relatórios básicos",
      "Suporte via email",
    ],
  },
  {
    id: "premium-plan",
    name: "Plano Premium",
    description: "Recursos avançados com IA",
    priceInCents: 15000, // R$ 150,00
    planType: "premium",
    billingCycle: "monthly",
    features: [
      "Até 500 clientes",
      "Até 50 profissionais",
      "500 agendamentos/mês",
      "Relatórios avançados",
      "ViraBot AI 24/7",
      "Suporte prioritário",
      "Suporte via email e WhatsApp",
      "Horário: 8:00-18:00 (5 dias/semana)",
    ],
  },
  {
    id: "master-plan",
    name: "Plano Master",
    description: "Recursos ilimitados e suporte premium",
    priceInCents: 25000, // R$ 250,00
    planType: "master",
    billingCycle: "monthly",
    features: [
      "clientes ilimitados",
      "Profissionais ilimitados",
      "Agendamentos ilimitados",
      "Relatórios avançados",
      "ViraBot AI 24/7",
      "Suporte prioritário 24/7",
      "Suporte via email e WhatsApp",
      "Gerente de conta dedicado",
    ],
  },
]

export function getProductByPlanType(planType: "basic" | "premium" | "master"): Product | undefined {
  return PRODUCTS.find((p) => p.planType === planType)
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
