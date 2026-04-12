import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const next = requestUrl.searchParams.get("next") ?? "/dashboard"

    console.log("[Free Trial Auth Callback] Incoming request:", requestUrl.pathname, "code present:", !!code)

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            console.log("[Free Trial Auth Callback] Code exchanged successfully, redirecting to:", next)
            // Successfully authenticated, redirect to the intended page
            // We ensure we redirect back to the localized dashboard if needed
            return NextResponse.redirect(new URL(next, requestUrl.origin))
        }

        console.error("[Free Trial Auth Callback] Error exchanging code:", error.message, "| code length:", code.length)
    } else {
        console.error("[Free Trial Auth Callback] No code parameter found in URL. Full URL:", request.url)
    }

    // Return the user to an error page with some instructions
    const errorUrl = new URL("/", requestUrl.origin)
    errorUrl.searchParams.set("error", "auth_callback_error")
    errorUrl.searchParams.set("error_description", "Could not authenticate")
    return NextResponse.redirect(errorUrl)
}
