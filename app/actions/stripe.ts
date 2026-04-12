"use server"

import { getStripe } from "@/lib/stripe"
import { getProductByPlanType } from "@/lib/products"
import { createClient } from "@/lib/supabase/server"

export async function startCheckoutSession(planType: "basic" | "premium" | "master", couponCode?: string) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const product = getProductByPlanType(planType)
  if (!product) {
    throw new Error(`Product with plan type "${planType}" not found`)
  }

  // Get or create Stripe customer
  let customerId: string | undefined

  // Check if user already has a Stripe customer ID
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (subscription?.stripe_customer_id) {
    try {
      // Verify customer exists in Stripe
      await getStripe().customers.retrieve(subscription.stripe_customer_id)
      customerId = subscription.stripe_customer_id
    } catch (err: any) {
      // If customer not found, create a new one
      const isNotFound = err.status === 404 || err.statusCode === 404 || err.code === "resource_missing"
      if (isNotFound) {
        console.warn("Stripe customer from DB not found, creating new one")
        const customer = await getStripe().customers.create({
          email: user.email!,
          metadata: { supabase_user_id: user.id },
        })
        customerId = customer.id
        // Update DB with new customer ID
        await supabase
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("user_id", user.id)
      } else {
        throw err
      }
    }
  } else {
    // Create new Stripe customer
    const customer = await getStripe().customers.create({
      email: user.email!,
      metadata: {
        supabase_user_id: user.id,
      },
    })
    customerId = customer.id
  }

  // Always use the main app domain for checkout redirect URLs
  const origin = "https://gdc.viraweb.online"

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

  // Create Checkout Session
  const session = await getStripe().checkout.sessions.create({
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
          recurring: product.billingCycle === "monthly" ? { interval: "month" } : undefined,
        },
        quantity: 1,
      },
    ],
    mode: product.billingCycle === "monthly" ? "subscription" : "payment",
    // Allow users to enter promotion codes if no specific coupon was provided
    allow_promotion_codes: !discounts,
    // Apply specific discount if provided
    ...(discounts && { discounts }),
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled`,
    metadata: {
      user_id: user.id,
      plan_type: planType,
    },
  })

  if (!session.url) {
    throw new Error("Failed to create checkout session")
  }

  return session.url
}

export async function handleCheckoutSuccess(sessionId: string) {
  const supabase = await createClient()

  // Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  const { data: existingUser, error: userCheckError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single()

  if (userCheckError || !existingUser) {
    const { error: userInsertError } = await supabase.from("users").insert({
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || null,
      subscription_plan: "free",
      subscription_status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (userInsertError) {
      console.error("Error creating user:", userInsertError)
      throw new Error(`Failed to create user record: ${userInsertError.message}`)
    }
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId)

  if (session.payment_status !== "paid") {
    throw new Error("Payment not completed")
  }

  const planType = session.metadata?.plan_type as any
  const isTrial = session.metadata?.is_trial === "true"
  const product = getProductByPlanType(planType)

  if (!product) {
    throw new Error("Invalid plan type")
  }

  const now = new Date()
  let endDate: Date | null = null

  if (product.billingCycle === "monthly") {
    endDate = new Date(now)
    // If it's a trial, the period ends in 14 days initially, 
    // but the DB current_period_end should probably reflect the trial end.
    if (isTrial) {
        endDate.setDate(endDate.getDate() + 14)
    } else {
        endDate.setMonth(endDate.getMonth() + 1)
    }
  }

  const { data: existingSubscription, error: subCheckError } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (subCheckError) {
    console.warn("Multiple subscriptions found for user or other query error in handleCheckoutSuccess:", subCheckError)
  }

  let maxPatients: number | null = null
  let maxProfessionals: number | null = null
  let maxAppointments: number | null = null

  if (planType === "basic") {
    maxPatients = 75
    maxProfessionals = 7
    maxAppointments = 50
  } else if (planType === "premium") {
    maxPatients = 500
    maxProfessionals = 50
    maxAppointments = 500
  }
  // master plan has unlimited (null values)

  const subscriptionData = {
    user_id: user.id,
    plan_name: isTrial ? `Trial ${planType}` : planType, 
    plan_price: product.priceInCents / 100,
    billing_cycle: product.billingCycle === "monthly" ? "monthly" : "master",
    status: "active",
    stripe_subscription_id: session.subscription as string | null,
    stripe_customer_id: session.customer as string,
    start_date: now.toISOString(),
    end_date: endDate?.toISOString() || null,
    current_period_start: now.toISOString(),
    current_period_end: endDate?.toISOString() || null,
    cancel_at_period_end: false,
    payment_method: "stripe",
    max_patients: maxPatients,
    max_professionals: maxProfessionals,
    max_appointments_per_month: maxAppointments,
    updated_at: now.toISOString(),
  }

  let upsertError

  if (existingSubscription) {
    const { error } = await supabase.from("subscriptions").update(subscriptionData).eq("user_id", user.id)
    upsertError = error
  } else {
    const { error } = await supabase.from("subscriptions").insert(subscriptionData)
    upsertError = error
  }

  if (upsertError) {
    console.error("Error upserting subscription:", upsertError)
    throw new Error(`Failed to update subscription: ${upsertError.message}`)
  }

  await supabase
    .from("users")
    .update({
      subscription_plan: isTrial ? `Trial ${planType}` : planType,
      subscription_status: "active",
      subscription_start_date: now.toISOString(),
      subscription_end_date: endDate?.toISOString() || null,
      updated_at: now.toISOString(),
    })
    .eq("id", user.id)

  return { success: true, isTrial }
}

export async function cancelSubscription() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  // Get user's subscription
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (subError || !subscription) {
    throw new Error("Subscription not found")
  }

  // Cancel Stripe subscription if it exists
  if (subscription.stripe_subscription_id) {
    await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: true,
    })
  }

  // Update database
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (updateError) {
    throw new Error("Failed to cancel subscription")
  }

  return { success: true }
}

export async function reactivateSubscription() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error("User not authenticated")
  }

  // Get user's subscription
  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  if (subError || !subscription) {
    throw new Error("Subscription not found")
  }

  // Reactivate Stripe subscription if it exists
  if (subscription.stripe_subscription_id) {
    await getStripe().subscriptions.update(subscription.stripe_subscription_id, {
      cancel_at_period_end: false,
    })
  }

  // Update database
  const { error: updateError } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (updateError) {
    throw new Error("Failed to reactivate subscription")
  }

  return { success: true }
}
