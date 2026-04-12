"use client"

import { useEffect, useRef } from "react"

/**
 * Sends a heartbeat to /api/activity to record the user's last activity.
 * - Fires immediately on mount
 * - Then every `intervalMs` (default: 5 minutes)
 * - Also fires on window focus (user comes back to tab)
 */
export function useActivityTracker(intervalMs = 5 * 60 * 1000) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const ping = async () => {
    try {
      await fetch("/api/activity", { method: "POST", credentials: "same-origin" })
    } catch {
      // Silently fail – connectivity issues shouldn't affect UX
    }
  }

  useEffect(() => {
    // Immediate ping on mount
    ping()

    // Periodic heartbeat
    intervalRef.current = setInterval(ping, intervalMs)

    // Also ping when user focuses the window (comes back from another tab)
    const handleFocus = () => ping()
    window.addEventListener("focus", handleFocus)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener("focus", handleFocus)
    }
  }, [intervalMs])
}
