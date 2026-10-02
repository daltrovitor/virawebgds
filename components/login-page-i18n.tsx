// Hello World
"use client"

import type React from "react"
import { AuthInput, AuthShell, AuthTerms } from "@/components/vwo/auth-shell"

import { useState, useEffect } from "react"
import { GoogleButton } from "@/components/ui/google-button"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from 'next-intl'

interface LoginPageProps {
    onLogin: (email: string, password: string) => void
    onSignupClick: () => void
    onBackClick: () => void
    onForgotPassword?: () => void
    onGoogleSignIn?: () => void
}

export default function LoginPage({ onLogin, onSignupClick, onBackClick, onForgotPassword, onGoogleSignIn }: LoginPageProps) {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const t = useTranslations('auth.login')
    const tAuth = useTranslations('auth')
    const tTitles = useTranslations('titles')
    const locale = useLocale()

    const [termsAccepted, setTermsAccepted] = useState(false)

    useEffect(() => {
        document.title = tTitles('login')
    }, [tTitles])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        if (!termsAccepted) {
            setError(tAuth('mustAcceptTerms'))
            toast({
                title: tAuth('attention'),
                description: tAuth('acceptToContinue'),
                variant: "destructive",
            })
            return
        }

        if (!email || !password) {
            setError(t('fillAllFields'))
            toast({
                title: t('requiredFields'),
                description: t('fillAllFields'),
                variant: "destructive",
            })
            return
        }

        setIsLoading(true)
        try {
            await onLogin(email, password)
        } catch (err) {
            setError(t('checkCredentials'))
            toast({
                title: t('error'),
                description: t('checkCredentials'),
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleProvider = () => {
        if (!termsAccepted) {
            setError(tAuth('mustAcceptTerms'))
            toast({
                title: tAuth('attention'),
                description: tAuth('acceptToContinue'),
                variant: "destructive",
            })
            return
        }
        if (onGoogleSignIn) {
            onGoogleSignIn()
        }
    }

    return (
        <AuthShell title={t('title')} subtitle={t('subtitle')} backLabel={t('back')} onBack={onBackClick}>
            {error && (
                <div className="mb-5 flex items-start gap-2 rounded-sm border border-rose-200 bg-rose-50 p-3" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />
                    <p className="text-[13px] text-rose-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <AuthInput
                    id="login-email"
                    label={t('email')}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <AuthInput
                    id="login-password"
                    label={t('password')}
                    type="password"
                    autoComplete="current-password"
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    aside={
                        <button type="button" onClick={() => onForgotPassword && onForgotPassword()} className="min-h-9 text-[13px] font-medium text-primary hover:underline">
                            {t('forgotPassword')}
                        </button>
                    }
                />
                <AuthTerms
                    id="terms-login"
                    checked={termsAccepted}
                    onChange={setTermsAccepted}
                    labels={{ agree: tAuth('termsAgree'), terms: tAuth('terms'), privacy: tAuth('privacy'), lgpd: tAuth('lgpd'), and: locale === 'en' ? 'and' : 'e' }}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    {isLoading ? t('loading') : t('submit')}
                </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-hairline" />
                ou
                <span className="h-px flex-1 bg-hairline" />
            </div>
            <GoogleButton onClick={handleGoogleProvider} variant="signin" isLoading={isLoading} />

            <p className="mt-8 text-center text-[14px] text-ink-soft">
                {t('noAccount')}{" "}
                <button type="button" onClick={onSignupClick} className="min-h-11 font-semibold text-primary hover:underline">
                    {t('signup')}
                </button>
            </p>
        </AuthShell>
    )
}
