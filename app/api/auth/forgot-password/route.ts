"use server"

import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = (body?.email || '').toString().trim()
    if (!email) return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 })

    // Try to use service role key to check if user exists
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL

    // If no service key, fallback to calling public reset endpoint and return success (can't verify existence)
    if (!serviceKey || !supabaseUrl) {
      // call public recover endpoint via supabase-js
      const { createClient } = await import('@supabase/supabase-js')
      const client = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || undefined,
      })
      if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 400 })
      return NextResponse.json({ ok: true })
    }

    // Create a service-role client to inspect auth users
    const { createClient } = await import('@supabase/supabase-js')
    const serviceClient = createClient(supabaseUrl!, serviceKey)

    // Try admin lookup first (supabase-js admin API)
    let userFound = null
    try {
      // @ts-ignore - call admin API if available
      if (serviceClient.auth && (serviceClient.auth as any).admin && (serviceClient.auth as any).admin.getUserByEmail) {
        // v2 admin helper
        const resp = await (serviceClient.auth as any).admin.getUserByEmail(email)
        if (resp?.data) userFound = resp.data
      }
    } catch (e) {
      // ignore and try fallback
    }

    // Fallback: try admin.listUsers (if available) or query auth.users directly using the service role
    if (!userFound) {
      try {
        // Try admin.listUsers search if available
        if ((serviceClient.auth as any).admin && (serviceClient.auth as any).admin.listUsers) {
          const list = await (serviceClient.auth as any).admin.listUsers({ per_page: 1, query: `email:${email}` })
          if (list?.data && list.data.length > 0) {
            userFound = list.data[0]
          }
        }

        // If still not found, query the auth.users table directly (service role can access this)
        if (!userFound) {
          try {
            const { data: userRow, error: usersError } = await serviceClient
              .from('auth.users')
              .select('id, email')
              .eq('email', email)
              .limit(1)
              .maybeSingle()

            if (!usersError && userRow) {
              userFound = userRow
            }
          } catch (innerErr) {
            // swallow
          }
        }
      } catch (e) {
        // swallow fallback errors
      }
    }

    if (!userFound) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    // Send reset email using public recover API (works even server-side)
    const publicClient = createClient(supabaseUrl!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await publicClient.auth.resetPasswordForEmail(email, {
      redirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || undefined,
    })
    if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
