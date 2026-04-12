import { createServerSupabaseClient } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const flow = requestUrl.searchParams.get("flow") || "signup"
    const next = requestUrl.searchParams.get("next") ?? "/"

    console.log("[Auth Callback] Incoming request:", requestUrl.pathname, "code present:", !!code, "flow:", flow)

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data?.user) {
            const user = data.user

            // Check if this is a newly created user (created within the last 60 seconds)
            const createdAt = new Date(user.created_at).getTime()
            const now = Date.now()
            const isNewUser = (now - createdAt) < 60000 // 60 seconds

            console.log("[Auth Callback] User:", user.email, "| created_at:", user.created_at, "| isNew:", isNewUser, "| flow:", flow)

            if (flow === "login" && isNewUser) {
                console.warn("[Auth Callback] Blocking new user registration via login flow:", user.email)

                // Sign the user out first
                await supabase.auth.signOut()

                // Delete the auto-created user using the service role
                try {
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
                    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
                    if (supabaseUrl && serviceKey) {
                        const adminClient = createClient(supabaseUrl, serviceKey, {
                            auth: { autoRefreshToken: false, persistSession: false }
                        })
                        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
                        if (deleteError) {
                            console.error("[Auth Callback] Failed to delete auto-created user:", deleteError.message)
                        } else {
                            console.log("[Auth Callback] Successfully deleted auto-created user:", user.id)
                        }
                    }
                } catch (e) {
                    console.error("[Auth Callback] Error during user cleanup:", e)
                }

                // Redirect with a friendly error message
                const errorUrl = new URL("/", requestUrl.origin)
                errorUrl.searchParams.set("error", "no_account")
                errorUrl.searchParams.set("error_description", "Conta não encontrada. Por favor, crie uma conta primeiro.")

                const response = NextResponse.redirect(errorUrl)
                
                // Força a remoção dos cookies de autenticação do Supabase que foram injetados agora
                // e de qualquer cookie antigo com prefixo sb-
                const cookieHeader = request.headers.get("cookie") || ""
                cookieHeader.split(";").forEach(c => {
                    const cookieName = c.split("=")[0].trim()
                    if (cookieName.startsWith("sb-")) {
                        response.cookies.set({
                            name: cookieName,
                            value: '',
                            maxAge: -1,
                            path: '/',
                        })
                    }
                })                
                return response
            }

            console.log("[Auth Callback] Code exchanged successfully, redirecting to:", next)
            return NextResponse.redirect(new URL(next, requestUrl.origin))
        }

        if (error) {
            console.error("[Auth Callback] Error exchanging code:", error.message, "| code length:", code.length)
        }
    } else {
        console.error("[Auth Callback] No code parameter found in URL. Full URL:", request.url)
    }

    // Return the user to an error page with some instructions
    const errorUrl = new URL("/", requestUrl.origin)
    errorUrl.searchParams.set("error", "auth_callback_error")
    errorUrl.searchParams.set("error_description", "Could not authenticate")
    return NextResponse.redirect(errorUrl)
}
