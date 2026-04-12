"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export interface UserSubscription {
  id: string
  user_id: string
  plan_name: "basic" | "premium" | "master" | "free" | string
  plan_type: "basic" | "premium" | "master" | "free" | string
  status: "active" | "canceled" | "expired"
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  max_patients: number | null
  max_professionals: number | null
  max_appointments_per_month: number | null
  virabot_enabled: boolean
  created_at: string
  updated_at: string
}

export async function getCurrentPlan(): Promise<"basic" | "premium" | "master" | "free"> {
  try {
    const subscription = await getUserSubscription()

    if (!subscription || (subscription.status !== "active" && subscription.status as string !== "trialing")) {
      return "basic"
    }

    // Normalização robusta: verificamos todos os campos possíveis para encontrar "master"
    const rawPlanName = (subscription.plan_name || "").toLowerCase()
    const rawPlanType = (subscription.plan_type || "").toLowerCase()
    const rawUserPlan = (subscription.user_plan || "").toLowerCase()
    const fullPlanContext = `${rawPlanName} ${rawPlanType} ${rawUserPlan}`
    
    if (fullPlanContext.includes("master")) return "master"
    if (fullPlanContext.includes("premium")) return "premium"
    if (fullPlanContext.includes("free")) return "free"
    if (fullPlanContext.includes("trial")) return "premium"
    
    return "basic"
  } catch (err) {
    console.error("Error in getCurrentPlan:", err)
    return "basic"
  }
}

export async function getUserSubscription(): Promise<UserSubscription | null> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return null
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // Always fetch user_plan for potential overrides
    const { data: userData } = await supabase
      .from("users")
      .select("subscription_plan")
      .eq("id", user.id)
      .single()
    
    const userPlan = userData?.subscription_plan

    // Fallback: if no active subscription record, use user_plan
    if (!data) {
      if (userPlan && userPlan !== "free" && userPlan !== "none") {
        return {
          plan_name: userPlan,
          plan_type: userPlan,
          user_plan: userPlan,
          status: "active",
          user_id: user.id,
          virabot_enabled: userPlan === "master" || userPlan === "premium"
        } as any
      }
      return null
    }

    if (data) {
      // Add user_plan to the data object for normalization
      (data as any).user_plan = userPlan
      
      // ── Verificação de expiração do período ──
      // Se current_period_end já passou, a assinatura expirou.
      // Isso protege contra falhas no webhook do Stripe.
      if (data.current_period_end) {
        const periodEnd = new Date(data.current_period_end)
        const now = new Date()

        // Margem de 24h para dar tempo ao Stripe processar a renovação
        const gracePeriodMs = 24 * 60 * 60 * 1000
        const expiredWithGrace = new Date(periodEnd.getTime() + gracePeriodMs)

        if (now > expiredWithGrace) {
          console.warn(
            `⚠️ Subscription ${data.id} for user ${user.id} expired at ${data.current_period_end}. Auto-marking as expired.`
          )

          // Marcar como expirada no banco
          await supabase
            .from("subscriptions")
            .update({
              status: "expired",
              updated_at: now.toISOString(),
            })
            .eq("id", data.id)

          // Atualizar tabela de users também
          await supabase
            .from("users")
            .update({
              subscription_status: "expired",
              updated_at: now.toISOString(),
            })
            .eq("id", user.id)

          return null
        }
      }

      if (data.plan_name) {
        data.plan_name = data.plan_name.toLowerCase()
        data.plan_type = data.plan_name
      }

      // Enforce 14-day limit for free plan
      if (data.plan_name === "free" || data.plan_type === "free") {
        const startDate = data.current_period_start ? new Date(data.current_period_start) : new Date(data.created_at)
        const fourteenDaysLater = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)
        data.current_period_end = fourteenDaysLater.toISOString()
      }
    }

    return data as UserSubscription | null
  } catch (err) {
    console.error("Critical error in getUserSubscription:", err)
    return null
  }
}

export async function hasAIAccess(): Promise<boolean> {
  const subscription = await getUserSubscription()

  if (!subscription) {
    return false
  }

  return subscription.virabot_enabled === true
}

export async function updateSubscriptionStatus(subscriptionId: string, status: "active" | "canceled" | "expired") {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    console.error("Error updating subscription:", error)
    throw new Error(error.message || "Failed to update subscription")
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/settings")
  revalidatePath("/dashboard/subscription")

  return data as UserSubscription
}
