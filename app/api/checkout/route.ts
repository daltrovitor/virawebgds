import { createServerSupabaseClient } from "@/lib/supabase-server"
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"

// 🚫 Impede execução no build
export const dynamic = "force-dynamic"

const PLANS = {
  basic: { priceId: "price_basic", amount: 14990, name: "Básico" },
  premium: { priceId: "price_premium", amount: 24990, name: "Premium" },
  master: { priceId: "price_master", amount: 34990, name: "Master" },
} as const

export async function POST(request: NextRequest) {
  try {
    // ✅ Stripe SÓ é criado em runtime
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

    const supabase = await createServerSupabaseClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { plan_type, coupon_code } = await request.json()

    if (!plan_type || !(plan_type in PLANS)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 })
    }

    const plan = PLANS[plan_type as keyof typeof PLANS]
    const origin =
      request.headers.get("origin") || "https://gds.viraweb.online"

    // Prepare discount options
    let discounts: { coupon?: string; promotion_code?: string }[] | undefined

    if (coupon_code) {
      // First, try to find if it's a promotion code
      try {
        const promotionCodes = await stripe.promotionCodes.list({
          code: coupon_code,
          active: true,
          limit: 1,
        })

        if (promotionCodes.data.length > 0) {
          discounts = [{ promotion_code: promotionCodes.data[0].id }]
        } else {
          // Try as a direct coupon ID
          discounts = [{ coupon: coupon_code }]
        }
      } catch (err) {
        console.error("Error looking up coupon/promotion code:", err)
        // Try as a direct coupon ID as fallback
        discounts = [{ coupon: coupon_code }]
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      mode: "subscription",
      payment_method_types: ["card"],
      // Allow users to enter promotion codes if no specific coupon was provided
      allow_promotion_codes: !discounts,
      // Apply specific discount if provided
      ...(discounts && { discounts }),
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `ViraWeb - Plano ${plan.name}`,
              description: `Assinatura ${plan.name} do ViraWeb`,
            },
            unit_amount: plan.amount,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: {
        user_id: user.id,
        plan_type,
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
