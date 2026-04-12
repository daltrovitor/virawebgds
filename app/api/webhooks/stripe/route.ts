import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"
import type Stripe from "stripe"

export async function POST(req: Request) {
  const body = await req.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error(" Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  console.log(" Webhook event received:", event.type)

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentSucceeded(invoice)
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(subscription)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      default:
        console.log(" Unhandled event type:", event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(" Webhook handler error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const supabase = await createClient()
  const userId = session.metadata?.user_id
  const planType = session.metadata?.plan_type as any

  if (!userId || !planType) {
    console.error(" Missing metadata in checkout session")
    return
  }

  console.log(" Processing checkout completion for user:", userId, "plan:", planType)

  let maxPatients: number | null = null
  let maxProfessionals: number | null = null
  let maxAppointments: number | null = null
  let viraBotEnabled = false

  if (planType === "basic") {
    maxPatients = 75
    maxProfessionals = 7
    maxAppointments = 50
    viraBotEnabled = false
  } else if (planType === "premium") {
    maxPatients = 500
    maxProfessionals = 50
    maxAppointments = 500
    viraBotEnabled = true
  } else if (planType === "master") {
    maxPatients = null // unlimited
    maxProfessionals = null // unlimited
    maxAppointments = null // unlimited
    viraBotEnabled = true
  }

  const now = new Date()
  let endDate = new Date(now)
  endDate.setMonth(endDate.getMonth() + 1)
  
  let stripeSubscriptionId = session.subscription as string
  let trialEnd: number | null = null

  if (stripeSubscriptionId) {
    try {
      const stripeSub = (await getStripe().subscriptions.retrieve(stripeSubscriptionId)) as any
      if (stripeSub.trial_end) {
        endDate = new Date(stripeSub.trial_end * 1000)
      } else {
        endDate = new Date(stripeSub.current_period_end * 1000)
      }
    } catch (e) {
      console.error("Error retrieving stripe subscription:", e)
    }
  }

  const priceInCents = session.amount_total || 0
  const price = priceInCents / 100

  const { error: upsertError } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      plan_name: planType,
      plan_price: price,
      billing_cycle: "monthly",
      status: "active",
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: session.customer as string,
      start_date: now.toISOString(),
      end_date: endDate.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: endDate.toISOString(),
      cancel_at_period_end: false,
      payment_method: "stripe",
      max_patients: maxPatients,
      max_professionals: maxProfessionals,
      max_appointments_per_month: maxAppointments,
      virabot_enabled: viraBotEnabled,
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (upsertError) {
    console.error(" Error upserting subscription:", upsertError)
    throw upsertError
  }

  await supabase
    .from("users")
    .update({
      subscription_plan: planType,
      subscription_status: "active",
      updated_at: now.toISOString(),
    })
    .eq("id", userId)

  console.log(
    " Subscription updated successfully for user:",
    userId,
    "with plan:",
    planType,
    "viraBotEnabled:",
    viraBotEnabled,
  )
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = await createClient()
  const customerId = invoice.customer as string

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .single()

  if (!subscription) {
    console.error(" Subscription not found for customer:", customerId)
    return
  }

  const now = new Date()
  const endDate = new Date(now)
  endDate.setMonth(endDate.getMonth() + 1)

  await supabase
    .from("subscriptions")
    .update({
      current_period_start: now.toISOString(),
      current_period_end: endDate.toISOString(),
      status: "active",
      updated_at: now.toISOString(),
    })
    .eq("stripe_customer_id", customerId)

  console.log(" Payment succeeded for customer:", customerId)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = await createClient()

  // Map Stripe status to our internal status
  // We consider 'active', 'trialing', and 'past_due' as valid active-like states
  let status: "active" | "canceled" | "expired" | "inactive" = "inactive"
  if (["active", "trialing", "past_due"].includes(subscription.status)) {
    status = "active"
  } else if (subscription.status === "canceled") {
    status = "canceled"
  } else if (subscription.status === "incomplete_expired") {
    status = "expired"
  }

  await supabase
    .from("subscriptions")
    .update({
      status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)

  console.log(` Subscription updated: ${subscription.id} -> ${status} (Stripe: ${subscription.status})`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = await createClient()

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)

  console.log(" Subscription deleted:", subscription.id)
}
