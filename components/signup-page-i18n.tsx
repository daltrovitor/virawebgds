"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GoogleButton } from "@/components/ui/google-button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, User, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"
import Image from "next/image"

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

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-between mb-4 px-2">
                    <button
                        onClick={onBackClick}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer text-[12px] font-bold uppercase tracking-tight"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        {tCommon('back')}
                    </button>
                    <LanguageToggle variant="compact" />
                </div>

                <div className="bg-white p-6 sm:p-8 rounded-none border border-slate-300 shadow-sm relative">
                    <div className="mb-8 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-none border border-slate-300 shadow-sm flex items-center justify-center mx-auto mb-4 grayscale">
                            <Image src="/viraweb6.png" width={24} height={24} alt="ViraWeb Logo" className="object-contain" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-900 mb-1 uppercase tracking-tight">{t('title')}</h1>
                        <p className="text-[12px] text-slate-500 font-bold uppercase tracking-wider">{t('subtitle')}</p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-none flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-[11px] font-bold text-red-700 uppercase tracking-tight">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('name')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="text"
                                    placeholder={t('namePlaceholder')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    className="w-full pl-10 h-10 bg-white border-slate-300 focus-visible:ring-primary focus-visible:ring-offset-0 text-[13px] rounded-none font-medium placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="email"
                                    placeholder={t('emailPlaceholder')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full pl-10 h-10 bg-white border-slate-300 focus-visible:ring-primary focus-visible:ring-offset-0 text-[13px] rounded-none font-medium placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('password')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder={t('passwordPlaceholder')}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 h-10 bg-white border-slate-300 focus-visible:ring-primary focus-visible:ring-offset-0 text-[13px] rounded-none font-medium placeholder:text-slate-400"
                                />
                            </div>
                            {password && (
                                <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-slate-100 rounded-none overflow-hidden border border-slate-200">
                                        <div
                                            className={`h-full transition-all ${passwordStrength.strength <= 1
                                                ? "bg-red-500 w-1/3"
                                                : passwordStrength.strength === 2
                                                    ? "bg-yellow-500 w-2/3"
                                                    : "bg-green-500 w-full"
                                                }`}
                                        />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{passwordStrength.label}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('confirmPassword')}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    type="password"
                                    placeholder={t('passwordPlaceholder')}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 h-10 bg-white border-slate-300 focus-visible:ring-primary focus-visible:ring-offset-0 text-[13px] rounded-none font-medium placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <div className="flex items-start gap-2 mb-4">
                                <div className="flex items-center h-5">
                                    <input
                                        id="terms-signup"
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                        className="w-4 h-4 border border-slate-300 rounded-none bg-white font-bold text-primary cursor-pointer accent-primary"
                                    />
                                </div>
                                <label htmlFor="terms-signup" className="text-[10px] text-slate-500 pt-0.5 cursor-pointer leading-tight font-bold uppercase tracking-tight">
                                    {tAuth('termsAgree')}{" "}
                                    <a href="/termos" target="_blank" className="text-primary hover:underline">{tAuth('terms')}</a>
                                    ,{" "}
                                    <a href="/privacidade" target="_blank" className="text-primary hover:underline">{tAuth('privacy')}</a>
                                    {" "} e {" "}
                                    <a href="/privacidade" target="_blank" className="text-primary hover:underline">{tAuth('lgpd')}</a>.
                                </label>
                            </div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-none shadow-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 uppercase text-[12px] tracking-widest"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('loading')}
                                    </>
                                ) : (
                                    t('submit')
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <div className="w-full h-10">
                            <GoogleButton
                                onClick={handleGoogleProvider}
                                variant="signup"
                                isLoading={isLoading}
                                style={{ borderRadius: '0px' }}
                            />
                        </div>
                    </div>

                    <div className="mt-6 text-center text-[12px]">
                        <p className="text-slate-500 font-bold uppercase tracking-tight">
                            {t('haveAccount')}{" "}
                            <button
                                type="button"
                                onClick={onLoginClick}
                                className="text-primary hover:underline font-black transition-colors cursor-pointer"
                            >
                                {t('login')}
                            </button>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}
