"use client"

const isDev = process.env.NODE_ENV === 'development'

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import { fetchJson } from "@/lib/fetch-client"

interface Subscription {
  id: string
  user_id: string
  plan_name: string
  plan_type: string
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

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<(Subscription & { user_plan?: string }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchSubscription = useCallback(async () => {
    if (!userId) {
      setSubscription(null)
      setLoading(false)
      return
    }

    try {
      // Fetch both subscription and user data for plan status
      const [subResult, userResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", userId)
          .in("status", ["active", "trialing", "past_due"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("users")
          .select("subscription_plan")
          .eq("id", userId)
          .maybeSingle()
      ])

      if (subResult.error && subResult.error.code !== "PGRST116") throw subResult.error
      
      const data = subResult.data
      const userPlan = userResult.data?.subscription_plan

      if (data) {
        // ── Verificação de expiração do período (client-side) ──
        if (data.current_period_end) {
          const periodEnd = new Date(data.current_period_end)
          const now = new Date()
          const gracePeriodMs = 24 * 60 * 60 * 1000 // 24h de margem
          const expiredWithGrace = new Date(periodEnd.getTime() + gracePeriodMs)

          if (now > expiredWithGrace) {
            if (isDev) console.warn(`⚠️ Subscription expired at ${data.current_period_end}. Marking as expired.`)

            // Marcar como expirada no banco (fire-and-forget)
            supabase
              .from("subscriptions")
              .update({ status: "expired", updated_at: now.toISOString() })
              .eq("id", data.id)
              .then(() => {
                supabase
                  .from("users")
                  .update({ subscription_status: "expired", updated_at: now.toISOString() })
                  .eq("id", userId)
              })

            setSubscription({ ...data, status: "expired", user_plan: userPlan })
            setError(null)
            return
          }
        }

        // Handle trialing/past_due as active for UI logic
        if (data.status as string === "trialing" || data.status as string === "past_due") {
            data.status = "active"
        }
        
        data.plan_type = data.plan_name || data.plan_type
        setSubscription({ ...data, user_plan: userPlan })
      } else if (userPlan && userPlan !== 'free' && userPlan !== 'none') {
        // Priority 2: Manual plan assignment in users table
        setSubscription({ 
            plan_name: userPlan, 
            plan_type: userPlan, 
            user_plan: userPlan,
            status: "active"
        } as any)
      } else {
        // Look for the latest record if no active or manual one exists
        const { data: latestSub } = await supabase
            .from("subscriptions")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        
        if (latestSub) {
            // Priority 3: Stale/Expired/Canceled record (for UI info)
            setSubscription({ ...latestSub, user_plan: userPlan })
        } else {
            setSubscription(null)
        }
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch subscription")
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  useEffect(() => {
    fetchSubscription()

    const channel = supabase
      .channel("subscription-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          fetchSubscription()
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "users",
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          fetchSubscription()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, fetchSubscription])

  const createSubscription = async (planType: "basic" | "premium" | "master") => {
    try {
      const data = await fetchJson("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_type: planType }),
      })

      setSubscription(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create subscription"
      setError(message)
      throw err
    }
  }

  const cancelSubscription = async () => {
    if (!subscription) return

    try {
      const data = await fetchJson("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: subscription.id, status: "canceled" }),
      })

      setSubscription(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to cancel subscription"
      setError(message)
      throw err
    }
  }

  const refreshSubscription = async () => {
    await fetchSubscription()
  }

  return {
    subscription,
    loading,
    error,
    createSubscription,
    cancelSubscription,
    refreshSubscription,
  }
}
