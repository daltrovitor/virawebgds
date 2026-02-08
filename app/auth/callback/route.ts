import { createServerSupabaseClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get("code")
    const next = requestUrl.searchParams.get("next") ?? "/"

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            // Successfully authenticated, redirect to the intended page
            return NextResponse.redirect(new URL(next, requestUrl.origin))
        }

        console.error("[Auth Callback] Error exchanging code:", error.message)
    }

    // Return the user to an error page with some instructions
    return NextResponse.redirect(
        new URL(`/?error=auth_callback_error&error_description=Could not authenticate`, requestUrl.origin)
    )
}
