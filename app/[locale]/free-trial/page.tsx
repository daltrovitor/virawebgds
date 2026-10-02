// Hello World
"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import VwoLanding from "@/components/vwo/landing"

// Supabase/Auth só depois da primeira pintura: a landing pinta sem esperar a sessão.
const SessionRedirect = dynamic(() => import("@/components/vwo/session-redirect"), { ssr: false })

export default function FreeTrialPage() {
    const router = useRouter()
    const [armed, setArmed] = useState(false)
    const [signedIn, setSignedIn] = useState(false)

    useEffect(() => {
        const timer = window.setTimeout(() => setArmed(true), 1200)
        return () => window.clearTimeout(timer)
    }, [])

    const locale = () => window.location.pathname.split("/")[1] || "pt-BR"
    const handleStartTrial = () => router.push(signedIn ? `/${locale()}/free-trial/plans` : `/${locale()}/free-trial/auth`)
    const handleLogin = () => router.push(`/${locale()}/free-trial/auth?login=true`)

    return (
        <>
            {armed && <SessionRedirect onUser={setSignedIn} />}
            <VwoLanding onStart={handleStartTrial} onLogin={handleLogin} />
        </>
    )
}
