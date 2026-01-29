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
    signInWithGoogle: () => Promise<any>
}

export default function Home() {
    const router = useRouter()
    const t = useTranslations()
    const { user, loading: authLoading, signUp, signIn, signOut, sendPasswordReset, signInWithGoogle } = useAuth() as UseAuthReturn
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)

    const [cookieConsent, setCookieConsent] = useState<boolean | null>(null)
    const [currentPage, setCurrentPage] = useState<"landing" | "login" | "signup" | "onboarding" | "dashboard">("landing")
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
            const cookieMatch = document.cookie.match(/(?:^|; )vwd_goto=([^;]+)/)
            const cookieGoto = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null

            if (cookieGoto) {
                if (cookieGoto === 'dashboard') setCurrentPage('dashboard')
                else if (cookieGoto === 'onboarding') setCurrentPage('onboarding')
                document.cookie = 'vwd_goto=; Max-Age=0; path=/'
                return
            }

            const params = new URLSearchParams(window.location.search)
            const goto = params.get('goto')
            if (!goto) return

            if (goto === 'dashboard') setCurrentPage('dashboard')
            else if (goto === 'onboarding') setCurrentPage('onboarding')

            params.delete('goto')
            const url = new URL(window.location.href)
            url.search = params.toString()
            window.history.replaceState(null, '', url.toString())
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

        if (cookieConsent !== true) {
            setCurrentPage("landing")
            return
        }

        if (!user) {
            setCurrentPage("landing")
            return
        }

        if (user && !subscription) {
            setCurrentPage("onboarding")
            return
        }

        if (user && subscription) {
            setCurrentPage("dashboard")
            return
        }
    }, [isHydrated, authLoading, subLoading, user, subscription, cookieConsent])

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
            const { error } = await signUp(email, password)
            if (error) {
                toast({
                    title: t('auth.signup.error'),
                    description: error.message,
                    variant: "destructive",
                })
            } else {
                setIsNewUser(true)
                toast({
                    title: t('auth.signup.success'),
                    description: t('auth.signup.checkEmail'),
                })
            }
        } catch (err) {
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

    const handleGoogleSignIn = async () => {
        setIsProcessing(true)
        try {
            const { error } = await signInWithGoogle()
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
                    <Image src="/viraweb6.ico" width={256} height={159} alt="ViraWeb logo" className="w-30" />
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
                    onGoogleSignIn={() => handleGoogleSignIn()}
                />
            )}
            {currentPage === "signup" && (
                <SignupPage
                    onSignup={handleSignup}
                    onLoginClick={() => setCurrentPage("login")}
                    onBackClick={() => setCurrentPage("landing")}
                    onGoogleSignIn={() => handleGoogleSignIn()}
                />
            )}
            {currentPage === "onboarding" && user && (
                <OnboardingPlans onSelectPlan={handleSelectPlan} isLoading={isProcessing} />
            )}
            {currentPage === "dashboard" && user && subscription && (
                <Dashboard
                    user={{
                        email: user?.email ?? "",
                        name: user?.name ?? user?.email?.split("@")[0] ?? "Usuário",
                    }}
                    onLogout={handleLogout}
                    subscription={subscription}
                    isNewUser={isNewUser}
                />
            )}
        </main>
    )
}
