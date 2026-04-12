"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Sparkles, Loader2, ArrowLeft, Mail, Lock, User } from "lucide-react"
import { GoogleButton } from "@/components/ui/google-button"
import Image from "next/image"
import Link from "next/link"
import { Checkbox } from "@/components/ui/checkbox"
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
        <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center p-6 font-sans">
            <Link href={`/${locale}/free-trial`} className="absolute top-8 left-8 flex items-center gap-2 text-slate-400 hover:text-primary transition-colors font-bold text-xs uppercase tracking-widest">
                <ArrowLeft className="w-4 h-4" />
                Voltar
            </Link>

            <div className="max-w-md w-full space-y-8">
                <div className="text-center space-y-4">
                    <Image width={140} height={40} alt="ViraWeb logo" src="/viraweb3.png" className="mx-auto" />
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3 h-3 fill-current" />
                        Teste Grátis de 14 Dias
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                        {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
                    </h1>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        Inicie seu teste grátis e automatize sua gestão hoje mesmo.
                    </p>
                </div>

                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[24px] overflow-hidden">
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                                        <Input 
                                            required 
                                            placeholder="Seu nome" 
                                            className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl font-medium"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail Profissional</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                                    <Input 
                                        type="email" 
                                        required 
                                        placeholder="exemplo@email.com" 
                                        className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl font-medium"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Senha</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-300" />
                                    <Input 
                                        type="password" 
                                        required 
                                        placeholder="••••••••" 
                                        className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl font-medium"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                                <div className="flex items-start gap-2 mb-4 pt-2">
                                    <div className="flex items-center h-5">
                                        <input
                                            id="terms-signup"
                                            type="checkbox"
                                            checked={acceptedTerms}
                                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                                            className="w-4 h-4 border border-slate-300 rounded bg-slate-50 focus:ring-3 focus:ring-primary/30 text-primary cursor-pointer"
                                        />
                                    </div>
                                    <label htmlFor="terms-signup" className="text-xs text-slate-500 pt-0.5 cursor-pointer leading-tight">
                                        Li e concordo com os{" "}
                                        <Link href={`/${locale}/termos`} target="_blank" className="text-primary font-bold hover:underline">Termos de Serviço</Link>
                                        ,{" "}
                                        <Link href={`/${locale}/privacidade`} target="_blank" className="text-primary font-bold hover:underline">Política de Privacidade</Link>
                                        {" "}e{" "}
                                        <Link href={`/${locale}/lgpd`} target="_blank" className="text-primary font-bold hover:underline">LGPD</Link>.
                                    </label>
                                </div>

                            <Button 
                                type="submit" 
                                disabled={isLoading || isGoogleLoading || !acceptedTerms}
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isLogin ? "Entrar e Continuar" : "Cadastrar e Iniciar Teste")}
                            </Button>

                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100"></div>
                                </div>
                                <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-slate-300">
                                    <span className="bg-white px-4">Ou continue com</span>
                                </div>
                            </div>

                            <GoogleButton 
                                onClick={handleGoogleSignIn}
                                variant={isLogin ? 'signin' : 'signup'}
                                isLoading={isGoogleLoading}
                                className={!acceptedTerms ? "opacity-50 cursor-not-allowed" : ""}
                            />
                        </form>
                    </CardContent>
                </Card>

                <p className="text-center text-xs font-bold text-slate-400">
                    {isLogin ? "Novo por aqui?" : "Já tem uma conta?"}{" "}
                    <button 
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-primary hover:underline font-black"
                    >
                        {isLogin ? "Criar conta gratuita" : "Fazer login"}
                    </button>
                </p>
            </div>
        </div>
    )
}
