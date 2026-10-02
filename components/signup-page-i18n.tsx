// Hello World
"use client"

import type React from "react"
import { AuthInput, AuthShell, AuthTerms } from "@/components/vwo/auth-shell"

import { useState, useEffect } from "react"
import { GoogleButton } from "@/components/ui/google-button"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from 'next-intl'

interface SignupPageProps {
    onSignup: (name: string, email: string, password: string) => Promise<void>
    onLoginClick: () => void
    onBackClick: () => void
    onGoogleSignIn?: () => void
}

export default function SignupPage({ onSignup, onLoginClick, onBackClick, onGoogleSignIn }: SignupPageProps) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [error, setError] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const t = useTranslations('auth.signup')
    const tAuth = useTranslations('auth')
    const tCommon = useTranslations('common')
    const tTitles = useTranslations('titles')
    const locale = useLocale()

    const [termsAccepted, setTermsAccepted] = useState(false)

    useEffect(() => {
        document.title = tTitles('signup')
    }, [tTitles])

    const getPasswordStrength = (pwd: string) => {
        if (!pwd) return { strength: 0, label: "" }
        let strength = 0
        if (pwd.length >= 6) strength++
        if (pwd.length >= 8) strength++
        if (/[A-Z]/.test(pwd)) strength++
        if (/[0-9]/.test(pwd)) strength++
        if (/[^A-Za-z0-9]/.test(pwd)) strength++

        const strengthKey = strength.toString() as "0" | "1" | "2" | "3" | "4";
        return { strength, label: t(`passStrength.${strengthKey}`) }
    }

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

        if (!name || !email || !password || !confirmPassword) {
            const errorMsg = t('allFieldsRequired')
            setError(errorMsg)
            toast({
                title: tAuth('attention'),
                description: errorMsg,
                variant: "destructive",
            })
            return
        }

        if (password !== confirmPassword) {
            const errorMsg = t('passMismatch')
            setError(errorMsg)
            toast({
                title: t('error'),
                description: errorMsg,
                variant: "destructive",
            })
            return
        }

        if (password.length < 6) {
            const errorMsg = t('passwordMinLength')
            setError(errorMsg)
            toast({
                title: t('error'),
                description: errorMsg,
                variant: "destructive",
            })
            return
        }

        setIsLoading(true)
        try {
            await onSignup(name, email, password)
            toast({
                title: t('success'),
                description: t('checkEmail'),
            })
        } catch (err) {
            setError(t('unexpectedError'))
            toast({
                title: t('error'),
                description: err instanceof Error ? err.message : t('unexpectedError'),
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

    const passwordStrength = getPasswordStrength(password)

    const strengthTone = passwordStrength.strength <= 1 ? "bg-rose-600" : passwordStrength.strength === 2 ? "bg-amber-500" : "bg-emerald-600"
    const strengthWidth = `${Math.max(1, Math.min(passwordStrength.strength, 4)) * 25}%`

    return (
        <AuthShell title={t('title')} subtitle={t('subtitle')} backLabel={tCommon('back')} onBack={onBackClick}>
            {error && (
                <div className="mb-5 flex items-start gap-2 rounded-sm border border-rose-200 bg-rose-50 p-3" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />
                    <p className="text-[13px] text-rose-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                <AuthInput id="signup-name" label={t('name')} type="text" autoComplete="name" placeholder={t('namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} required />
                <AuthInput id="signup-email" label={t('email')} type="email" autoComplete="email" inputMode="email" placeholder={t('emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
                <div className="space-y-2">
                    <AuthInput id="signup-password" label={t('password')} type="password" autoComplete="new-password" placeholder={t('passwordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    {password && (
                        <div className="flex items-center gap-3" aria-live="polite">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                                <div className={`h-full transition-all duration-500 ${strengthTone}`} style={{ width: strengthWidth }} />
                            </div>
                            <span className="text-[12px] text-ink-soft">{passwordStrength.label}</span>
                        </div>
                    )}
                </div>
                <AuthInput id="signup-confirm" label={t('confirmPassword')} type="password" autoComplete="new-password" placeholder={t('passwordPlaceholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <AuthTerms
                    id="terms-signup"
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
            <GoogleButton onClick={handleGoogleProvider} variant="signup" isLoading={isLoading} />

            <p className="mt-8 text-center text-[14px] text-ink-soft">
                {t('haveAccount')}{" "}
                <button type="button" onClick={onLoginClick} className="min-h-11 font-semibold text-primary hover:underline">
                    {t('login')}
                </button>
            </p>
        </AuthShell>
    )
}
