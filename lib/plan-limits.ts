export type PlanType = "basic" | "premium" | "master" | "free"

export interface PlanLimits {
  patients: number | "unlimited"
  professionals: number | "unlimited"
  appointmentsPerMonth: number | "unlimited"
  support: string[]
  features: string[]
  price: number
  supportHours: string
  viraBotEnabled: boolean
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  basic: {
    patients: 75,
    professionals: 7,
    appointmentsPerMonth: 50,
    support: ["Email"],
    features: ["Gestão básica de clientes", "Agendamentos limitados", "Relatórios básicos", "Suporte via email"],
    price: 149.9,
    supportHours: "Horário comercial",
    viraBotEnabled: false,
  },
  premium: {
    patients: 500,
    professionals: 50,
    appointmentsPerMonth: 500,
    support: ["Email", "WhatsApp"],
    features: [
      "500 clientes",
      "50 profissionais",
      "500 agendamentos/mês",
      "ViraBot AI 24/7",
      "Suporte prioritário",
      "Email e WhatsApp",
      "Suporte 8:00-18:00 (5 dias por semana)",
    ],
    price: 249.9,
    supportHours: "8:00 às 18:00 (5 dias por semana)",
    viraBotEnabled: true,
  },
  master: {
    patients: "unlimited",
    professionals: "unlimited",
    appointmentsPerMonth: "unlimited",
    support: ["Email", "WhatsApp", "24/7"],
    features: [
      "Clientes ilimitados",
      "Profissionais ilimitados",
      "Agendamentos ilimitados",
      "ViraBot AI 24/7",
      "Suporte prioritário 24/7",
      "Email e WhatsApp",
      "Suporte 24 horas",
    ],
    price: 249.9,
    supportHours: "24 horas, 7 dias por semana",
    viraBotEnabled: true,
  },
  free: {
    patients: 500,
    professionals: 50,
    appointmentsPerMonth: 500,
    support: ["Email", "WhatsApp"],
    features: [
      "500 clientes",
      "50 profissionais",
      "500 agendamentos/mês",
      "ViraBot AI 24/7",
      "Suporte prioritário",
      "Email e WhatsApp",
      "Suporte 8:00-18:00 (5 dias por semana)",
    ],
    price: 0,
    supportHours: "8:00 às 18:00 (5 dias por semana)",
    viraBotEnabled: true,
  },
}

export function getPlanLimit(planType: string | null, limitType: keyof PlanLimits): number | "unlimited" {
  if (!planType) return 0
  
  // Clean prefix if exists and normalize
  const lowerPlan = planType.toLowerCase()
  let basePlan: PlanType = "basic"
  
  if (lowerPlan.includes("master")) basePlan = "master"
  else if (lowerPlan.includes("premium")) basePlan = "premium"
  else if (lowerPlan.includes("free")) basePlan = "free"
  else if (lowerPlan.includes("trial")) basePlan = "premium"
  else if (lowerPlan.includes("past_due")) basePlan = "basic"
  else if (lowerPlan.includes("basic")) basePlan = "basic"
  
  if (!PLAN_LIMITS[basePlan]) return 0
  
  const limit = PLAN_LIMITS[basePlan][limitType]
  return typeof limit === "number" || limit === "unlimited" ? limit : 0
}

export function canAddPatient(planType: string | null, currentCount: number): boolean {
  const limit = getPlanLimit(planType, "patients")
  if (limit === "unlimited") return true
  return currentCount < (limit as number)
}

export function canAddProfessional(planType: string | null, currentCount: number): boolean {
  const limit = getPlanLimit(planType, "professionals")
  if (limit === "unlimited") return true
  return currentCount < (limit as number)
}

export function canAddAppointment(planType: string | null, currentMonthCount: number): boolean {
  const limit = getPlanLimit(planType, "appointmentsPerMonth")
  if (limit === "unlimited") return true
  return currentMonthCount < (limit as number)
}

export function hasAIAccess(planType: string | null): boolean {
  if (!planType) return false
  const lowerPlan = planType.toLowerCase()
  return lowerPlan.includes("premium") || lowerPlan.includes("master") || lowerPlan.includes("free") || lowerPlan.includes("trial")
}

export function getSupportChannels(planType: string | null): string[] {
  if (!planType) return []
  const lowerPlan = planType.toLowerCase()
  let basePlan: PlanType = "basic"
  if (lowerPlan.includes("master")) basePlan = "master"
  else if (lowerPlan.includes("premium")) basePlan = "premium"
  else if (lowerPlan.includes("free")) basePlan = "free"
  else if (lowerPlan.includes("trial")) basePlan = "premium"
  
  if (!PLAN_LIMITS[basePlan]) return []
  return PLAN_LIMITS[basePlan].support
}

export function getSupportHours(planType: string | null): string {
  if (!planType) return ""
  const lowerPlan = planType.toLowerCase()
  let basePlan: PlanType = "basic"
  if (lowerPlan.includes("master")) basePlan = "master"
  else if (lowerPlan.includes("premium")) basePlan = "premium"
  else if (lowerPlan.includes("free")) basePlan = "free"
  else if (lowerPlan.includes("trial")) basePlan = "premium"
  
  if (!PLAN_LIMITS[basePlan]) return ""
  return PLAN_LIMITS[basePlan].supportHours
}

export function hasViraBotAccess(planType: string | null): boolean {
  if (!planType) return false
  const lowerPlan = planType.toLowerCase()
  let basePlan: PlanType = "basic"
  if (lowerPlan.includes("master")) basePlan = "master"
  else if (lowerPlan.includes("premium")) basePlan = "premium"
  else if (lowerPlan.includes("free")) basePlan = "free"
  else if (lowerPlan.includes("trial")) basePlan = "premium"
  
  if (!PLAN_LIMITS[basePlan]) return false
  return PLAN_LIMITS[basePlan].viraBotEnabled
}
