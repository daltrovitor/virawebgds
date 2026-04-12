import { createServerSupabaseClient } from "@/lib/supabase-server"
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

// 🚫 Impede execução no build
export const dynamic = "force-dynamic"

const PLANS = {
  basic: { price: 14990, name: "Básico" },
  premium: { price: 15000, name: "Premium" },
  master: { price: 147990, name: "Vitalício" },
} as const

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}

/* =========================
   POST — criar assinatura
========================= */
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe()
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { plan_type } = await request.json()

    if (!plan_type || !(plan_type in PLANS)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 })
    }

    // 🔎 Buscar ou criar customer no Stripe
    let stripeCustomerId: string

    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    })

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id
    }

    // 💾 Criar assinatura no Supabase
    const { data, error } = await supabase
      .from("subscriptions")
      .insert({
        user_id: user.id,
        plan_type,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Subscription creation error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

/* =========================
   GET — buscar assinatura
========================= */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error && error.code !== "PGRST116") throw error

    return NextResponse.json(data || null)
  } catch (error) {
    console.error("Subscription fetch error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}

/* =========================
   PUT — atualizar assinatura
========================= */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, status } = await request.json()

    const { data, error } = await supabase
      .from("subscriptions")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error("Subscription update error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
