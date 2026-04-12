import { PLAN_LIMITS, type PlanType } from "./plan-limits"
import type { UsageStats } from "./usage-stats"

/**
 * Get warning level based on usage percentage
 */
export function getWarningLevel(percentage: number): "safe" | "warning" | "danger" | "critical" {
  if (percentage < 70) return "safe"
  if (percentage < 85) return "warning"
  if (percentage < 100) return "danger"
  return "critical"
}

/**
 * Get next available upgrade plan
 */
export function getNextUpgradePlan(currentPlan: PlanType): PlanType | null {
  if (currentPlan === "basic") return "premium"
  if (currentPlan === "premium") return "master"
  return null // Already on highest plan
}

/**
 * Get upgrade recommendation message
 */
export function getUpgradeRecommendation(planType: PlanType, limitType: keyof UsageStats): string {
  const nextPlan = getNextUpgradePlan(planType)
  if (!nextPlan) return ""

  const limitNames = {
    patients: "clientes",
    professionals: "profissionais",
    appointments: "agendamentos",
  }

  const nextPlanLimits = PLAN_LIMITS[nextPlan]
  const nextLimit = nextPlanLimits[limitType === "appointments" ? "appointmentsPerMonth" : limitType]

  if (nextLimit === "unlimited") {
    return `Faça upgrade para o plano ${nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)} e tenha ${limitNames[limitType]} ilimitados!`
  }

  return `Faça upgrade para o plano ${nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1)} e aumente seu limite para ${nextLimit} ${limitNames[limitType]}.`
}
