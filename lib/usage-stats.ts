"use server"

import { createClient } from "@/lib/supabase/server"
import { PLAN_LIMITS, type PlanType } from "./plan-limits"

export interface UsageStats {
  patients: {
    current: number
    limit: number | "unlimited"
    percentage: number
    remaining: number | "unlimited"
  }
  professionals: {
    current: number
    limit: number | "unlimited"
    percentage: number
    remaining: number | "unlimited"
  }
  appointments: {
    current: number
    limit: number | "unlimited"
    percentage: number
    remaining: number | "unlimited"
    resetDate: string
  }
}

export interface LimitCheckResult {
  allowed: boolean
  message?: string
  currentCount: number
  limit: number | "unlimited"
  percentage: number
}

/**
 * Get comprehensive usage statistics for the current user
 */
export async function getUserUsageStats(planType: PlanType): Promise<UsageStats> {
  const emptyStats: UsageStats = {
    patients: { current: 0, limit: 0, percentage: 0, remaining: 0 },
    professionals: { current: 0, limit: 0, percentage: 0, remaining: 0 },
    appointments: { current: 0, limit: 0, percentage: 0, remaining: 0, resetDate: "" },
  }

  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return emptyStats
    }

    // Get patients count
    const { count: patientsCount } = await supabase
      .from("patients")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    // Get professionals count
    const { count: professionalsCount } = await supabase
      .from("professionals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    // Get appointments count for current month
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
    const { count: appointmentsCount } = await supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("appointment_date", firstDayOfMonth)

    // Normalize plan type to handle "free"/"trial" as "premium"
    const lowerPlan = planType.toLowerCase()
    const normalizedPlan: PlanType = lowerPlan.includes("master") ? "master" : 
                                   lowerPlan.includes("premium") ? "premium" :
                                   lowerPlan.includes("free") ? "free" :
                                   lowerPlan.includes("trial") ? "premium" : "basic"

    const planLimits = PLAN_LIMITS[normalizedPlan]

    // Calculate next month reset date
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(1)
    const resetDate = nextMonth.toISOString().split("T")[0]

    return {
      patients: {
        current: patientsCount || 0,
        limit: planLimits.patients,
        percentage: calculatePercentage(patientsCount || 0, planLimits.patients),
        remaining: calculateRemaining(patientsCount || 0, planLimits.patients),
      },
      professionals: {
        current: professionalsCount || 0,
        limit: planLimits.professionals,
        percentage: calculatePercentage(professionalsCount || 0, planLimits.professionals),
        remaining: calculateRemaining(professionalsCount || 0, planLimits.professionals),
      },
      appointments: {
        current: appointmentsCount || 0,
        limit: planLimits.appointmentsPerMonth,
        percentage: calculatePercentage(appointmentsCount || 0, planLimits.appointmentsPerMonth),
        remaining: calculateRemaining(appointmentsCount || 0, planLimits.appointmentsPerMonth),
        resetDate,
      },
    }
  } catch (err) {
    console.error("Critical error in getUserUsageStats:", err)
    return emptyStats
  }
}

/**
 * Calculate percentage of usage
 */
function calculatePercentage(current: number, limit: number | "unlimited"): number {
  if (limit === "unlimited") return 0
  if (limit === 0) return 100
  return Math.min(Math.round((current / limit) * 100), 100)
}

/**
 * Calculate remaining count
 */
function calculateRemaining(current: number, limit: number | "unlimited"): number | "unlimited" {
  if (limit === "unlimited") return "unlimited"
  return Math.max(limit - current, 0)
}

/**
 * Check if user can perform an action based on limits
 */
export async function checkLimit(
  planType: PlanType,
  limitType: "patients" | "professionals" | "appointmentsPerMonth",
): Promise<LimitCheckResult> {
  const stats = await getUserUsageStats(planType)
  const resource = limitType === "appointmentsPerMonth" ? stats.appointments : stats[limitType]

  const limit = resource.limit
  const current = resource.current

  if (limit === "unlimited") {
    return {
      allowed: true,
      currentCount: current,
      limit: "unlimited",
      percentage: 0,
    }
  }

  const allowed = current < limit
  const percentage = resource.percentage

  let message: string | undefined
  if (!allowed) {
    const limitNames = {
      patients: "clientes",
      professionals: "profissionais",
      appointmentsPerMonth: "agendamentos mensais",
    }
    message = `Você atingiu o limite de ${limit} ${limitNames[limitType]} do seu plano. Faça upgrade para adicionar mais.`
  }

  return {
    allowed,
    message,
    currentCount: current,
    limit,
    percentage,
  }
}

// These are now only in lib/usage-stats-utils.ts as regular (non-async) utility functions
