import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * POST /api/activity
 * Records the user's last activity timestamp in the user_activity table.
 * Called by the dashboard on mount and periodically (heartbeat).
 */
export async function POST() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const now = new Date().toISOString()

    const { error: upsertError } = await supabase
      .from("user_activity")
      .upsert(
        {
          user_id: user.id,
          last_seen_at: now,
        },
        { onConflict: "user_id" }
      )

    if (upsertError) {
      console.error("[Activity] Upsert error:", upsertError)
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, last_seen_at: now })
  } catch (err: any) {
    console.error("[Activity] Unexpected error:", err)
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/activity
 * Returns all user activity records (admin use).
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_activity")
      .select("user_id, last_seen_at")
      .order("last_seen_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error("[Activity] GET error:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
