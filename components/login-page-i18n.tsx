"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { GoogleButton } from "@/components/ui/google-button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft, Mail, Lock, AlertCircle, Loader2 } from "lucide-react"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"
import Image from "next/image"

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
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="flex items-center justify-between mb-4 px-2">
                    <button
                        onClick={onBackClick}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors group cursor-pointer text-[12px] font-bold uppercase tracking-tight"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                        {t('back')}
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
                            <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">{t('password')}</label>
                                <button
                                    type="button"
                                    onClick={() => onForgotPassword && onForgotPassword()}
                                    className="text-[10px] text-primary font-bold cursor-pointer hover:underline uppercase tracking-tight"
                                >
                                    {t('forgotPassword')}
                                </button>
                            </div>
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
                        </div>

                        <div className="pt-2">
                            <div className="flex items-start gap-2 mb-4">
                                <div className="flex items-center h-5">
                                    <input
                                        id="terms-login"
                                        type="checkbox"
                                        checked={termsAccepted}
                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                        className="w-4 h-4 border border-slate-300 rounded-none bg-white font-bold text-primary cursor-pointer accent-primary"
                                    />
                                </div>
                                <label htmlFor="terms-login" className="text-[10px] text-slate-500 pt-0.5 cursor-pointer leading-tight font-bold uppercase tracking-tight">
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
                                variant="signin"
                                isLoading={isLoading}
                                style={{ borderRadius: '0px' }}
                            />
                        </div>
                    </div>

                    <div className="mt-6 text-center text-[12px]">
                        <p className="text-slate-500 font-bold uppercase tracking-tight">
                            {t('noAccount')}{" "}
                            <button
                                type="button"
                                onClick={onSignupClick}
                                className="text-primary hover:underline font-black cursor-pointer"
                            >
                                {t('signup')}
                            </button>
                        </p>
                    </div>
                </div>

            </div>
        </div>
    )
}
