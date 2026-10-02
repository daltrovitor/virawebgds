"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

/**
 * Registro de visitas. O cliente Supabase é importado sob demanda, depois que a página fica ociosa,
 * para não competir com a primeira pintura.
 */
export default function AnalyticsTracker() {
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    const trackVisit = async () => {
      try {
        let visitorId = localStorage.getItem("vwd:visitor_id")
        if (!visitorId) {
          visitorId = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36)
          localStorage.setItem("vwd:visitor_id", visitorId)
        }

        const { createClient } = await import("@/lib/supabase-client")
        if (cancelled) return
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const { error } = await supabase.from("traffic_analytics").insert({
          path: pathname,
          user_id: session?.user?.id || null,
          visitor_id: visitorId,
          referrer: document.referrer || null,
          meta: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            screen: `${window.innerWidth}x${window.innerHeight}`,
            timestamp: Date.now(),
          },
        })
        if (error) console.error("Error inserting analytics:", error)
      } catch (e) {
        console.error("Analytics crash skipped:", e)
      }
    }

    const idle = (cb: () => void) => {
      // Safari antigo não tem requestIdleCallback
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(cb, { timeout: 4000 })
      else setTimeout(cb, 2500)
    }
    const timer = window.setTimeout(() => idle(() => void trackVisit()), 1500)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [pathname])

  return null
}
