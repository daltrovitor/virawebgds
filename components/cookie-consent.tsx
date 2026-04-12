"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export default function CookieConsent() {
  const [consent, setConsent] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
    try {
      const stored = localStorage.getItem("vwd:consent_cookies")
      setConsent(stored)
    } catch (e) {
      setConsent(null)
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem("vwd:consent_cookies", "true")
      setConsent("true")

      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new Event("vwd:consent_changed"))
      }
    } catch (e) {
      console.error("[CookieConsent] error in accept:", e)
    }
  }

  const decline = () => {
    try {
      localStorage.setItem("vwd:consent_cookies", "false")
      setConsent("false")

      if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
        window.dispatchEvent(new Event("vwd:consent_changed"))
      }
    } catch (e) {
      console.error("[CookieConsent] error in decline:", e)
    }
  }

  // If user already made a choice, don't render
  if (!isHydrated || consent === "true" || consent === "false") return null

  return (
    <div className="fixed bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-50 flex flex-col md:flex-row items-start md:items-center justify-between bg-card border border-border p-3 md:p-4 rounded-lg shadow-md max-w-4xl mx-auto gap-3 md:gap-4">
      <div className="flex-1">
        <p className="text-xs md:text-sm leading-relaxed">
          Usamos cookies para manter você conectado e melhorar a experiência. Deseja ativar cookies?
        </p>
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto">
        <Button
          variant="outline"
          onClick={decline}
          className="flex-1 md:flex-none text-xs md:text-sm h-8 md:h-10 bg-transparent"
        >
          Recusar
        </Button>
        <Button onClick={accept} className="flex-1 md:flex-none text-xs md:text-sm h-8 md:h-10">
          Ativar cookies
        </Button>
      </div>
    </div>
  )
}

