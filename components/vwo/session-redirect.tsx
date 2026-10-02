// Hello World
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"

type AuthState = { user: { id?: string } | null; loading: boolean }

/**
 * Leva quem já tem sessão ao painel (assinatura ativa) ou à escolha de plano.
 * Carregado depois da primeira pintura para que a landing não espere o Supabase.
 */
export default function SessionRedirect({ onUser }: { onUser?: (signedIn: boolean) => void }) {
  const { user, loading: authLoading } = useAuth() as AuthState
  const { subscription, loading: subLoading } = useSubscription(user?.id || null)
  const router = useRouter()

  useEffect(() => {
    if (!authLoading) onUser?.(Boolean(user))
  }, [authLoading, user, onUser])

  useEffect(() => {
    if (authLoading || subLoading || !user) return
    const hasCustomerCookie = document.cookie.includes("vwd_is_customer=true")
    const locale = window.location.pathname.split("/")[1] || "pt-BR"
    const currentStatus = subscription?.status as string | undefined
    const isActive = currentStatus === "active" || currentStatus === "trialing" || currentStatus === "past_due" || currentStatus === "expired"

    if ((subscription && isActive) || hasCustomerCookie) {
      const hostname = window.location.hostname
      const domain = hostname.includes(".") ? hostname.split(".").slice(-2).join(".") : hostname
      const cookieDomain = hostname.includes(".") ? `.${domain}` : domain
      document.cookie = `vwd_is_customer=true; Domain=${cookieDomain}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
      window.location.href = `/${locale}`
      return
    }
    router.push(`/${locale}/free-trial/plans`)
  }, [user, authLoading, subLoading, subscription, router])

  return null
}
