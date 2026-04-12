"use server"

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, password } = body

    if (!token || !password) {
      return NextResponse.json({ error: 'Token e senha são obrigatórios' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Configuração do Supabase não encontrada' }, { status: 500 })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Autentica o client com o token de recuperação
    const { error: sessionError } = await supabase.auth.setSession({ access_token: token, refresh_token: '' })
    if (sessionError) {
      return NextResponse.json({ error: sessionError.message || 'Erro ao autenticar com token de recuperação' }, { status: 400 })
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      return NextResponse.json({ error: error.message || 'Erro ao redefinir senha' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
