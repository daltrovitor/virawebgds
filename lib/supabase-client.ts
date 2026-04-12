import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error("❌ Supabase environment variables are missing!")
    // In browser, we might still return the client but it will fail on calls
  }

  return createBrowserClient(
    url || "",
    key || "",
  )
}
