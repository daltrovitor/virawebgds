// Hello World
"use client"

import { useState } from "react"
import { AuthInput, AuthShell, AuthTerms } from "@/components/vwo/auth-shell"
import { useAuth } from "@/hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"
import { GoogleButton } from "@/components/ui/google-button"
import { createClient } from "@/lib/supabase-client"

export default function FreeTrialAuthPage() {
    const { signIn, signUp, signInWithGoogle } = useAuth() as any
    const searchParams = useSearchParams()
    const [isLogin, setIsLogin] = useState(searchParams.get('login') === 'true')
    const [isLoading, setIsLoading] = useState(false)
    const [isGoogleLoading, setIsGoogleLoading] = useState(false)
    const supabase = createClient()
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [fullName, setFullName] = useState("")
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const { toast } = useToast()
    const router = useRouter()
    const locale = searchParams.get('locale') || 'pt-BR'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            // Set trial cookie both locally and cross-subdomain
            const host = window.location.hostname
            const domain = host.includes('.') ? host.split('.').slice(-2).join('.') : null
            document.cookie = `vwd_goto=free-trial; Path=/; Max-Age=3600; SameSite=Lax`
            if (domain && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                document.cookie = `vwd_goto=free-trial; Domain=.${domain}; Path=/; Max-Age=3600; SameSite=Lax`
            }

            const isProd = host.includes('viraweb.online')
            const baseOrigin = isProd ? 'https://gdc.viraweb.online' : window.location.origin
            const redirectTo = `${baseOrigin}/${locale}?goto=free-trial`
            if (isLogin) {
                const { error } = await signIn(email, password)
                if (error) throw error
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName },
                        emailRedirectTo: redirectTo
                    }
                })
                if (error) throw error
                toast({
                    title: "Conta criada!",
                    description: "Por favor, verifique seu e-mail para confirmar a conta.",
                })
            }
            router.push(`/${locale}/free-trial/plans`)
        } catch (err: any) {
            toast({
                title: "Erro",
                description: err.message || "Ocorreu um erro ao processar sua solicitação.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        if (!acceptedTerms) {
            toast({
                title: "Atenção",
                description: "Você precisa aceitar os Termos de Serviço, Política de Privacidade e LGPD para continuar com o Google.",
                variant: "destructive",
            })
            return
        }
        setIsGoogleLoading(true)
        try {
            // Set trial cookie both locally and cross-subdomain
            const host = window.location.hostname
            const domain = host.includes('.') ? host.split('.').slice(-2).join('.') : null
            document.cookie = `vwd_goto=free-trial; Path=/; Max-Age=3600; SameSite=Lax`
            if (domain && !host.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                document.cookie = `vwd_goto=free-trial; Domain=.${domain}; Path=/; Max-Age=3600; SameSite=Lax`
            }

            const isProd = host.includes('viraweb.online')
            const baseOrigin = isProd ? 'https://gdc.viraweb.online' : window.location.origin
            const localePath = locale ? `/${locale}` : ''
            const afterAuthRedirect = `${baseOrigin}${localePath}?goto=free-trial`
            const redirectTo = `${baseOrigin}/auth/callback?flow=signup&next=${encodeURIComponent(afterAuthRedirect)}`
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo
                }
            })
        } catch (err: any) {
            toast({
                title: "Erro com Google",
                description: err.message || "Tente novamente.",
                variant: "destructive",
            })
            setIsGoogleLoading(false)
        }
    }

    return (
        <AuthShell
            title={isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            subtitle={isLogin ? "Entre para continuar no Vira Web Odonto." : "14 dias grátis. Cancele quando quiser."}
            backLabel="Voltar"
            onBack={() => router.push(`/${locale}/free-trial`)}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                    <AuthInput id="trial-name" label="Nome completo" required autoComplete="name" placeholder="Seu nome" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                )}
                <AuthInput id="trial-email" label="E-mail profissional" type="email" required autoComplete="email" inputMode="email" placeholder="exemplo@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <AuthInput id="trial-password" label="Senha" type="password" required autoComplete={isLogin ? "current-password" : "new-password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                <AuthTerms id="terms-trial" checked={acceptedTerms} onChange={setAcceptedTerms} labels={{ agree: "Li e concordo com os", terms: "Termos de Serviço", privacy: "Política de Privacidade", lgpd: "LGPD", and: "e" }} />
                <button
                    type="submit"
                    disabled={isLoading || isGoogleLoading || !acceptedTerms}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                    {isLogin ? "Entrar e continuar" : "Cadastrar e iniciar teste"}
                </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-[12px] uppercase tracking-[0.14em] text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 bg-hairline" />
                ou
                <span className="h-px flex-1 bg-hairline" />
            </div>
            <GoogleButton onClick={handleGoogleSignIn} variant={isLogin ? "signin" : "signup"} isLoading={isGoogleLoading} className={!acceptedTerms ? "opacity-50" : ""} />

            <p className="mt-8 text-center text-[14px] text-ink-soft">
                {isLogin ? "Novo por aqui?" : "Já tem uma conta?"}{" "}
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="min-h-11 font-semibold text-primary hover:underline">
                    {isLogin ? "Criar conta gratuita" : "Fazer login"}
                </button>
            </p>
        </AuthShell>
    )
}
