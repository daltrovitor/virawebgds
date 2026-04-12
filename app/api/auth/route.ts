import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * POST /api/auth
 *
 * Called by the client-side useAuth hook to persist the Supabase auth
 * session as HTTP-only cookies so that server-side routes (middleware,
 * Server Components, API routes) can read the same session.
 *
 * Body: { event: string, session: Session | null }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { event, session } = body as {
            event: string
            session: { access_token: string; refresh_token: string } | null
        }

        const cookieStore = await cookies()

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.json(
                { error: "Missing Supabase env vars" },
                { status: 500 }
            )
        }

        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Swallow errors when called from a response context
                    }
                },
            },
        })

        // Sync the session from the client into server-side cookies
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            if (session) {
                await supabase.auth.setSession({
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                })
            }
        }

        if (event === "SIGNED_OUT") {
            // Clear auth cookies by signing out on the server too
            await supabase.auth.signOut()
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[POST /api/auth] Error:", error)
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        )
    }
}
