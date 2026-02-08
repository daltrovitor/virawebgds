import { createServerSupabaseClient } from "@/lib/supabase-server"
import { type NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { getProductByPlanType } from "@/lib/products"

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
    const { targetPlan, couponCode } = body

    if (!targetPlan || !["basic", "premium", "master"].includes(targetPlan)) {
      return NextResponse.json({ error: "Invalid plan type" }, { status: 400 })
    }

    const product = getProductByPlanType(targetPlan)
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }

    let customerId: string | undefined

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single()

    if (subscription?.stripe_customer_id) {
      customerId = subscription.stripe_customer_id
    } else {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id
    }

    // Normalize origin: prefer request origin, then NEXT_PUBLIC_APP_URL, then VERCEL_URL, then default.
    const rawOrigin =
      request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

    const origin = (rawOrigin || "https://gds.viraweb.online").replace(/\/$/, "")

    // Defensive checks
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("Stripe secret key is not set in environment variables (STRIPE_SECRET_KEY)")
    }
    if (!user.email) {
      console.error("User has no email, cannot create Stripe customer")
      return NextResponse.json({ error: "User has no email" }, { status: 400 })
    }

    // Prepare discount options
    let discounts: { coupon?: string; promotion_code?: string }[] | undefined

    if (couponCode) {
      // First, try to find if it's a promotion code
      try {
        const promotionCodes = await getStripe().promotionCodes.list({
          code: couponCode,
          active: true,
          limit: 1,
        })

        if (promotionCodes.data.length > 0) {
          discounts = [{ promotion_code: promotionCodes.data[0].id }]
        } else {
          // Try as a direct coupon ID
          discounts = [{ coupon: couponCode }]
        }
      } catch (err) {
        console.error("Error looking up coupon/promotion code:", err)
        // Try as a direct coupon ID as fallback
        discounts = [{ coupon: couponCode }]
      }
    }

    let session
    try {
      session = await getStripe().checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: product.name,
                description: product.description,
              },
              unit_amount: product.priceInCents,
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        // Allow users to enter promotion codes if no specific coupon was provided
        allow_promotion_codes: !discounts,
        // Apply specific discount if provided
        ...(discounts && { discounts }),
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/?upgrade=cancelled`,
        metadata: {
          user_id: user.id,
          plan_type: targetPlan,
        },
      })

    } catch (err) {
      console.error("Failed to create Stripe checkout session:", err)
      return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
    }

    if (!session || !session.url) {
      console.error("Stripe session missing or has no url", session)
      throw new Error("Failed to create checkout session")
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error(" Checkout error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}
