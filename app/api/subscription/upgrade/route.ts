import { createServerSupabaseClient } from "@/lib/supabase-server"
import { type NextRequest, NextResponse } from "next/server"
import { PLAN_LIMITS } from "@/lib/plan-limits"

const VALID_PLANS = ["basic", "premium", "master"] as const
type ValidPlan = (typeof VALID_PLANS)[number]

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { newPlan } = body

    if (!newPlan || !VALID_PLANS.includes(newPlan)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 })
    }

    const { data: currentSubscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    const currentPlan = currentSubscription.plan_name?.toLowerCase() as ValidPlan
    const planHierarchy: Record<ValidPlan, number> = {
      basic: 0,
      premium: 1,
      master: 2,
    }

    if (planHierarchy[newPlan as ValidPlan] <= planHierarchy[currentPlan]) {
      return NextResponse.json({ error: "Cannot downgrade or select same plan" }, { status: 400 })
    }

    const newPlanDetails = PLAN_LIMITS[newPlan as ValidPlan]
    const now = new Date()
    const endDate = new Date(now)
    endDate.setMonth(endDate.getMonth() + 1)

    let maxPatients: number | null = null
    let maxProfessionals: number | null = null
    let maxAppointments: number | null = null

    if (newPlan === "basic") {
      maxPatients = 75
      maxProfessionals = 7
      maxAppointments = 50
    } else if (newPlan === "premium") {
      maxPatients = 500
      maxProfessionals = 50
      maxAppointments = 500
    }
    // master plan has unlimited (null values)

    const { data: updatedSubscription, error: updateError } = await supabase
      .from("subscriptions")
      .update({
        plan_name: newPlan,
        plan_price: newPlanDetails.price,
        current_period_start: now.toISOString(),
        current_period_end: endDate.toISOString(),
        max_patients: maxPatients,
        max_professionals: maxProfessionals,
        max_appointments_per_month: maxAppointments,
        updated_at: now.toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single()

    if (updateError) {
      console.error(" Error updating subscription:", updateError)
      return NextResponse.json({ error: "Failed to upgrade subscription" }, { status: 500 })
    }

    console.log(" Subscription upgraded successfully:", updatedSubscription)

    return NextResponse.json({
      success: true,
      newPlan,
      subscription: updatedSubscription,
    })
  } catch (error) {
    console.error(" Upgrade error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
