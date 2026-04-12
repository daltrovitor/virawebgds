"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase-client"

export default function AnalyticsTracker() {
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Garantir um visitor_id único persistente
        let visitorId = localStorage.getItem('vwd:visitor_id')
        if (!visitorId) {
          visitorId = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
          localStorage.setItem('vwd:visitor_id', visitorId)
        }

        // Obter sessão de forma assíncrona sem bloquear
        supabase.auth.getSession().then(({ data: { session } }) => {
          const userId = session?.user?.id || null
          
          supabase.from('traffic_analytics').insert({
            path: pathname,
            user_id: userId,
            visitor_id: visitorId,
            referrer: document.referrer || null,
            meta: {
              userAgent: navigator.userAgent,
              language: navigator.language,
              screen: `${window.innerWidth}x${window.innerHeight}`,
              timestamp: new Date().getTime()
            }
          }).then(({ error }) => {
            if (error) console.error("Error inserting analytics:", error)
          })
        })
      } catch (e) {
        console.error("Analytics crash skipped:", e)
      }
    }

    // Delay tiny bit to ensure page resources are fully loaded
    const timer = setTimeout(trackVisit, 800)
    return () => clearTimeout(timer)
  }, [pathname, supabase])

  return null
}
