import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const data = await req.json()
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    
    // Insert lead into database
    const { error } = await supabase.from('leads').insert([
      {
        user_id: user?.id,
        ramo: data.niche,
        faturamento: data.revenue,
        clientes: parseInt(data.clients) || 0,
        agendamentos: parseInt(data.appointments) || 0,
        idioma: data.language,
        created_at: new Date().toISOString()
      }
    ])

    if (error) {
      console.error("Error saving lead:", error)
      // Se houver erro de coluna inexistente (user_id), o Supabase retornará status diferente de ok no frontend
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Leads API error:", err)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
