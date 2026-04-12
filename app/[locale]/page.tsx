"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { useToast } from "@/hooks/use-toast"
import { fetchJson } from "@/lib/fetch-client"
import { useRouter } from "next/navigation"
import LandingPage from "@/components/landing-page-i18n"
import LoginPage from "@/components/login-page-i18n"
import SignupPage from "@/components/signup-page-i18n"
import Dashboard from "@/components/dashboard-i18n"
import OnboardingPlans from "@/components/onboarding-plans-i18n"
import type { User, Session, AuthError } from "@supabase/supabase-js"
import Image from "next/image"
import { useTranslations } from 'next-intl'
import { routing } from "@/i18n/routing"

interface AuthUser {
    id?: string
    email?: string
    name?: string
}

type UseAuthReturn = {
    user: AuthUser | null
    loading: boolean
    signUp: (
        email: string,
        password: string,
    ) => Promise<{
        data: { user: User | null; session: Session | null }
        error: AuthError | null
    }>
    signIn: (
        email: string,
        password: string,
    ) => Promise<{
        data: { user: User | null; session: Session | null }
        error: AuthError | null
    }>
    signOut: () => Promise<{ error: AuthError | null }>
    sendPasswordReset: (email: string) => Promise<any>
    signInWithGoogle: (flow?: 'login' | 'signup') => Promise<any>
}

export default function Home() {
    const router = useRouter()
    const t = useTranslations()
    const { user, loading: authLoading, signUp, signIn, signOut, sendPasswordReset, signInWithGoogle } = useAuth() as UseAuthReturn
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)

    const [cookieConsent, setCookieConsent] = useState<boolean | null>(null)
    const [currentPage, setCurrentPage] = useState<"landing" | "login" | "signup" | "onboarding" | "dashboard" | "renewal">("landing")
    const [isProcessing, setIsProcessing] = useState(false)
    const [isNewUser, setIsNewUser] = useState(false)
    const [isHydrated, setIsHydrated] = useState(false)
    const { toast } = useToast()

    // Initialize from localStorage on mount
    useEffect(() => {
        if (typeof window === "undefined") return

        try {
            const stored = localStorage.getItem('vwd:consent_cookies')
            if (stored === 'true') setCookieConsent(true)
            else if (stored === 'false') setCookieConsent(false)
            else setCookieConsent(null)
        } catch (e) {
            setCookieConsent(null)
        }

        setIsHydrated(true)
    }, [])

    // If the middleware redirected to `/?goto=...`, honor that on hydration
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!isHydrated || authLoading || subLoading) return

        try {
            const params = new URLSearchParams(window.location.search)
            const goto = params.get('goto')
            if (!goto) return

            const mode = params.get('mode')
            if (goto === 'dashboard') setCurrentPage('dashboard')
            else if (goto === 'onboarding') setCurrentPage('onboarding')
            else if (goto === 'free-trial') {
                if (!user && mode === 'signup') setCurrentPage('signup')
                else if (!user && mode === 'login') setCurrentPage('login')
            }

            params.delete('goto')
            params.delete('mode')
            const url = new URL(window.location.href)
            url.search = params.toString()
            window.history.replaceState(null, '', url.toString())
        } catch (e) {
            // ignore
        }
    }, [isHydrated])

    // Handle auth error messages from the callback redirect
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!isHydrated) return

        try {
            const params = new URLSearchParams(window.location.search)
            const error = params.get('error')
            const errorDescription = params.get('error_description')

            if (error) {
                if (error === 'no_account') {
                    toast({
                        title: "Conta não encontrada",
                        description: errorDescription || "Você precisa criar uma conta antes de fazer login com o Google.",
                        variant: "destructive",
                    })
                    setCurrentPage("signup")
                } else if (error === 'auth_callback_error') {
                    toast({
                        title: "Erro de autenticação",
                        description: errorDescription || "Não foi possível autenticar. Tente novamente.",
                        variant: "destructive",
                    })
                }

                // Clean up error params from URL
                params.delete('error')
                params.delete('error_description')
                const url = new URL(window.location.href)
                url.search = params.toString()
                window.history.replaceState(null, '', url.toString())
            }
        } catch (e) {
            // ignore
        }
    }, [isHydrated])

    // Redirect to reset-password if Supabase recovery link is accessed
    useEffect(() => {
        if (typeof window !== "undefined") {
            const hash = window.location.hash;
            if (hash.includes("type=recovery")) {
                router.replace("/reset-password" + hash);
            }
        }
    }, []);

    // Listen to cookie consent changes
    useEffect(() => {
        if (typeof window === "undefined") return

        const handler = () => {
            try {
                const stored = localStorage.getItem('vwd:consent_cookies')
                if (stored === 'true') setCookieConsent(true)
                else if (stored === 'false') setCookieConsent(false)
                else setCookieConsent(null)
            } catch (e) {
                // ignore
            }
        }

        window.addEventListener('vwd:consent_changed', handler)
        window.addEventListener('storage', handler)
        const gotoHandler = (e: Event) => {
            try {
                const detail = (e as CustomEvent).detail
                if (detail === 'dashboard') setCurrentPage('dashboard')
                else if (detail === 'onboarding') setCurrentPage('onboarding')
            } catch (err) {
                // ignore
            }
        }
        window.addEventListener('vwd:goto', gotoHandler as EventListener)

        return () => {
            window.removeEventListener('vwd:consent_changed', handler)
            window.removeEventListener('storage', handler)
            window.removeEventListener('vwd:goto', gotoHandler as EventListener)
        }
    }, [])

    // Main navigation logic
    useEffect(() => {
        if (!isHydrated) return
        if (authLoading || subLoading) return

        // 1. Check for cross-subdomain persistence cookie (vwd_goto) OR URL param (goto=free-trial)
        // This is essential for the trial flow, so we check it BEFORE cookieConsent
        const cookieMatch = document.cookie.match(/(?:^|; )vwd_goto=([^;]+)/)
        const cookieGoto = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null
        const searchParams = new URLSearchParams(window.location.search)
        const queryGoto = searchParams.get('goto')

        const hasCustomerCookie = typeof document !== 'undefined' && document.cookie.includes('vwd_is_customer=true')
        const locale = window.location.pathname.split('/')[1] || 'pt-BR'
        const hostname = window.location.hostname
        const domain = hostname.includes('.') ? hostname.split('.').slice(-2).join('.') : hostname
        const cookieDomain = hostname.includes('.') ? `.${domain}` : domain

        // 1. Loading protection - Wait for essential data
        if (authLoading || (user && subLoading)) return

        // 2. Not Logged In path
        if (!user) {
            // Keep user on auth pages if that's where they are
            if (currentPage === "signup" || currentPage === "login") return

            // If they have a trial cookie or goto param, maybe we should push them to trial auth?
            // But usually landing is fine as it has the "Start Trial" CTAs
            if (currentPage !== "landing") setCurrentPage("landing")
            return
        }

        // 3. Logged In path
        if (user) {
            // We consider them "New/Trial" if they have no subscription record OR if it exists but is null/not active
            // and we rely on the DB status, not just the cookie.
            // valid statuses to stay in dashboard: active, expired, trialing, past_due
            const status = subscription?.status as string
            const isActiveState = status === 'active' || status === 'expired' || status === 'trialing' || status === 'past_due'
            
            if (!subscription || !isActiveState) {
               
                
                // Clear customer cookie ONLY IF we are certain about the state (fully loaded and no sub)
                if (hasCustomerCookie && !subLoading && !authLoading) {
                    document.cookie = `vwd_is_customer=; Domain=${cookieDomain}; Path=/; Max-Age=0`
                }

                // Set/refresh trial intent cookie
                document.cookie = `vwd_goto=free-trial; Path=/; Max-Age=3600; SameSite=Lax`
                
                if (currentPage !== "onboarding") {
                    setCurrentPage("onboarding")
                }
                
                // We REMOVE the router.push here because it can cause a loop if the plans page
                // redirects back to root. Instead, we render the onboarding component locally.
               
                return
            }

            // Case B: HAS SUBSCRIPTION (Active or Expired)
            if (subscription) {
                // Set/refresh customer cookie for cross-subdomain middleware bypass
                if (!hasCustomerCookie) {
                    document.cookie = `vwd_is_customer=true; Domain=${cookieDomain}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
                }

                // --- Trial Detection Heuristic for UI Badges ---
                const planName = (subscription.plan_name || "").toLowerCase()
                const userPlan = (subscription.user_plan || "").toLowerCase()
                const isExplicitTrial = planName.includes("trial") || userPlan.includes("trial") || subscription.plan_type === 'free'
                
                let isHeuristicTrial = false
                if (subscription.current_period_end && subscription.current_period_start) {
                    const start = new Date(subscription.current_period_start).getTime()
                    const end = new Date(subscription.current_period_end).getTime()
                    const diffDays = (end - start) / (1000 * 60 * 60 * 24)
                    isHeuristicTrial = diffDays > 0 && diffDays < 16 
                }

                if (isExplicitTrial || isHeuristicTrial) {
                    if (!document.cookie.includes('vwd_is_trial=true')) {
                        document.cookie = `vwd_is_trial=true; Domain=${cookieDomain}; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax`
                    }
                } else {
                    if (document.cookie.includes('vwd_is_trial=true')) {
                        document.cookie = `vwd_is_trial=; Domain=${cookieDomain}; Path=/; Max-Age=0`
                    }
                }

                if (subscription.status === 'expired') {
                    if (currentPage !== "renewal") setCurrentPage("renewal")
                } else {
                    if (currentPage !== "dashboard") setCurrentPage("dashboard")
                }
            }
        }
    }, [isHydrated, authLoading, subLoading, user, subscription, cookieConsent, router, currentPage])

    const handleLogin = async (email: string, password: string) => {
        setIsProcessing(true)
        try {
            const { error } = await signIn(email, password)
            if (error) {
                toast({
                    title: t('auth.login.error'),
                    description: t('auth.login.incorrectCredentials'),
                    variant: "destructive",
                })
            } else {
                toast({
                    title: t('auth.login.successMessage'),
                    description: t('auth.login.welcomeBack'),
                })
            }
        } catch (err) {
            toast({
                title: t('auth.login.error'),
                description: t('errors.generic'),
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSignup = async (name: string, email: string, password: string) => {
        setIsProcessing(true)
        try {
            // Salvar intenção no cookie antes de processar
            document.cookie = `vwd_goto=free-trial; Path=/; Max-Age=3600; SameSite=Lax`
            
            const { data, error } = await signUp(email, password) as any
            if (error) {
                toast({
                    title: t('auth.signup.error'),
                    description: error.message,
                    variant: "destructive",
                })
            } else {
                setIsNewUser(true)
                
                // Se o usuário foi logado automaticamente (comum em algumas configs de Supabase ou auth externa)
                if (user && subscription && (subscription.status === 'active' || subscription.status === 'trialing')) {
                    // Redireciona para a raiz do domínio atual (resolve localhost e produção)
                    window.location.href = window.location.origin
                    return null
                } else {
                    toast({
                        title: t('auth.signup.success'),
                        description: t('auth.signup.checkEmail'),
                    })
                }
            }
        } catch (error: any) {
            toast({
                title: t('auth.signup.error'),
                description: t('auth.signup.unexpectedError'),
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSelectPlan = async (plan: "basic" | "premium" | "master") => {
        setIsProcessing(true)
        try {
            await fetchJson("/api/subscriptions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan_type: plan }),
            })

            toast({
                title: t('onboarding.success'),
                description: t('onboarding.successMessage'),
            })

            setCurrentPage("dashboard")
        } catch (err) {
            toast({
                title: t('onboarding.error'),
                description: err instanceof Error ? err.message : t('auth.login.tryAgain'),
                variant: "destructive",
            })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleLogout = async () => {
        await signOut()
        setCurrentPage("landing")
    }

    const handleGoogleSignIn = async (flow: 'login' | 'signup' = 'signup') => {
        setIsProcessing(true)
        try {
            const { error } = await signInWithGoogle(flow)
            if (error) {
                const msg = (error && (error as any).message) || String(error || '')
                if (msg.toLowerCase().includes('provider is not enabled') || msg.toLowerCase().includes('unsupported provider')) {
                    toast({
                        title: t('auth.login.googleUnavailable'),
                        description: 'O provedor Google não está habilitado no painel Supabase.',
                        variant: 'destructive',
                    })
                } else {
                    toast({ title: t('auth.login.googleError'), description: msg, variant: 'destructive' })
                }
            }
        } catch (err) {
            toast({ title: t('auth.login.googleError'), description: t('auth.login.tryAgain'), variant: "destructive" })
        } finally {
            setIsProcessing(false)
        }
    }

    const handleForgotPassword = async (email?: string) => {
        try {
            let userEmail = email
            if (!userEmail) {
                router.push('/email-input')
                return
            }
            if (!userEmail) return

            const { error } = await sendPasswordReset(userEmail)
            if (error) {
                toast({ title: t('auth.forgotPassword.error'), description: error.message || t('auth.forgotPassword.errorMessage'), variant: 'destructive' })
            } else {
                toast({ title: t('auth.forgotPassword.success'), description: t('auth.forgotPassword.successMessage') })
            }
        } catch (err) {
            toast({ title: t('auth.forgotPassword.error'), description: t('errors.generic'), variant: 'destructive' })
        }
    }

    if (authLoading || subLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Image src="/viraweb6.png" width={256} height={159} alt="ViraWeb logo" className="w-32" style={{ height: "auto" }} priority />
                    <p className="text-muted-foreground">{t('common.loading')}</p>
                </div>
            </div>
        )
    }

    return (
        <main className="min-h-screen bg-background">
            {currentPage === "landing" && (
                <LandingPage onLoginClick={() => setCurrentPage("login")} onSignupClick={() => setCurrentPage("signup")} />
            )}
            {currentPage === "login" && (
                <LoginPage
                    onLogin={handleLogin}
                    onSignupClick={() => setCurrentPage("signup")}
                    onBackClick={() => setCurrentPage("landing")}
                    onForgotPassword={() => handleForgotPassword()}
                    onGoogleSignIn={() => handleGoogleSignIn('login')}
                />
            )}
            {currentPage === "signup" && (
                <SignupPage
                    onSignup={handleSignup}
                    onLoginClick={() => setCurrentPage("login")}
                    onBackClick={() => setCurrentPage("landing")}
                    onGoogleSignIn={() => handleGoogleSignIn('signup')}
                />
            )}
            {currentPage === "onboarding" && user && (
                <OnboardingPlans onSelectPlan={handleSelectPlan} onLogout={handleLogout} isLoading={isProcessing} />
            )}
            {currentPage === "dashboard" && user && subscription && (
                <Dashboard
                    user={{
                        email: user?.email ?? "",
                        name: user?.name ?? user?.email?.split("@")[0] ?? "Usuário",
                    }}
                    onLogout={handleLogout}
                    subscription={subscription as any}
                    isNewUser={isNewUser}
                />
            )}
            {currentPage === "renewal" && (
                <div className="min-h-screen">
                    <iframe src={`/${routing.defaultLocale}/renewal`} className="w-full h-screen border-none" />
                </div>
            )}
        </main>
    )
}
