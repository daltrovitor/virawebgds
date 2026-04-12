import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Usar service role para bypass de RLS — este endpoint é protegido por CRON_SECRET
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(req: Request) {
  // ── Proteção: Apenas Vercel Cron ou chamadas autorizadas ──
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const now = new Date()

    // Margem de 24h para dar tempo ao Stripe processar renovação
    const gracePeriod = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1) Buscar todas as assinaturas ativas com período expirado
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from("subscriptions")
      .select("id, user_id, current_period_end, plan_name")
      .eq("status", "active")
      .not("current_period_end", "is", null)
      .lt("current_period_end", gracePeriod.toISOString())

    if (fetchError) {
      console.error("❌ Error fetching expired subscriptions:", fetchError)
      return NextResponse.json(
        { error: "Failed to fetch subscriptions", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!expiredSubscriptions || expiredSubscriptions.length === 0) {
      console.log("✅ Cron check: No expired subscriptions found")
      return NextResponse.json({
        message: "No expired subscriptions",
        checked_at: now.toISOString(),
        expired_count: 0,
      })
    }

    console.log(`⚠️ Found ${expiredSubscriptions.length} expired subscription(s)`)

    // 2) Marcar todas como expiradas em batch
    const expiredIds = expiredSubscriptions.map((s) => s.id)
    const expiredUserIds = expiredSubscriptions.map((s) => s.user_id)

    const { error: updateSubError } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        updated_at: now.toISOString(),
      })
      .in("id", expiredIds)

    if (updateSubError) {
      console.error("❌ Error expiring subscriptions:", updateSubError)
      return NextResponse.json(
        { error: "Failed to update subscriptions", details: updateSubError.message },
        { status: 500 }
      )
    }

    // 3) Atualizar tabela de users para refletir expiração
    for (const userId of expiredUserIds) {
      await supabase
        .from("users")
        .update({
          subscription_status: "expired",
          updated_at: now.toISOString(),
        })
        .eq("id", userId)
    }

    // 4) Log detalhado
    const expiredDetails = expiredSubscriptions.map((s) => ({
      subscription_id: s.id,
      user_id: s.user_id,
      plan: s.plan_name,
      expired_at: s.current_period_end,
    }))

    console.log("✅ Expired subscriptions processed:", JSON.stringify(expiredDetails, null, 2))

    return NextResponse.json({
      message: `Expired ${expiredSubscriptions.length} subscription(s)`,
      checked_at: now.toISOString(),
      expired_count: expiredSubscriptions.length,
      details: expiredDetails,
    })
  } catch (error) {
    console.error("❌ Cron job error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
