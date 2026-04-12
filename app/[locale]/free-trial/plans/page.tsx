"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Check, X, Sparkles, Loader2, Zap, Shield, ArrowRight, LogOut} from "lucide-react"
import Image from "next/image"
import { fetchJson } from "@/lib/fetch-client"
import { useToast } from "@/hooks/use-toast"
import { useSubscription } from "@/hooks/use-subscription"

interface Plan {
  id: string
  name: string
  price: number
  period: string
  description: string
  features: { name: string; included: boolean }[]
  highlighted?: boolean
  isTrial?: boolean
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Plano Básico",
    price: 149.9,
    period: "mês",
    description: "Perfeito para profissionais solo",
    features: [
      { name: "Até 75 clientes", included: true },
      { name: "Até 7 profissionais", included: true },
      { name: "50 agendamentos/mês", included: true },
      { name: "Relatórios básicos", included: true },
      { name: "Suporte por email", included: true },
      { name: "ViraBot AI 24/7", included: false },
      { name: "Suporte prioritário", included: false },
    ],
  },
  {
    id: "premium",
    name: "Plano Premium",
    price: 249.9,
    period: "mês",
    description: "Para empresas em crescimento",
    highlighted: true,
    isTrial: true,
    features: [
      { name: "Até 500 clientes", included: true },
      { name: "Até 50 profissionais", included: true },
      { name: "500 agendamentos/mês", included: true },
      { name: "Relatórios avançados", included: true },
      { name: "ViraBot AI 24/7", included: true },
      { name: "Suporte por email e WhatsApp", included: true },
      { name: "Suporte prioritário", included: true },
    ],
  },
  {
    id: "master",
    name: "Plano Master",
    price: 249.9,
    period: "mês",
    description: "Recursos completos para grandes empresas",
    features: [
      { name: "Clientes ilimitados", included: true },
      { name: "Profissionais ilimitados", included: true },
      { name: "Agendamentos ilimitados", included: true },
      { name: "Relatórios avançados", included: true },
      { name: "ViraBot AI 24/7", included: true },
      { name: "Suporte via WhatsApp especializado", included: true },
      { name: "Suporte prioritário 24/7", included: true },
      { name: "Gerente de conta dedicado", included: true },
    ],
  },
]

export default function PlansSelectionPage() {
    const { user, loading: authLoading, signOut } = useAuth() as any
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const { toast } = useToast()
    const router = useRouter()

    const handleSelectPlan = async (planType: string, isTrial: boolean) => {
        setIsLoading(planType)
        try {
            const { url } = await fetchJson("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    plan_type: planType,
                    is_trial: isTrial
                }),
            })

            if (url) {
                window.location.href = url
            } else {
                throw new Error("Não foi possível gerar o link de checkout")
            }
        } catch (err: any) {
            toast({
                title: "Erro no checkout",
                description: err.message || "Tente novamente mais tarde.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(null)
        }
    }

    if (authLoading || subLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
    )

    const currentStatus = subscription?.status as string
    const isActive = currentStatus === 'active' || currentStatus === 'trialing' || currentStatus === 'past_due' || currentStatus === 'expired'

    if (user && subscription && isActive) {
        // Redireciona para a raiz do domínio atual (resolve localhost e produção)
        window.location.href = window.location.origin
        return null
    }

    if (!user) {
        // Se não há usuário, verificamos se acabamos de vir de um cadastro (via cookie)
        // para evitar o flash/redirecionamento imediato enquanto o Supabase sincroniza
        const hasGotoCookie = typeof document !== 'undefined' && document.cookie.includes('vwd_goto=free-trial')
        
        if (!hasGotoCookie) {
            const locale = window.location.pathname.split('/')[1] || 'pt-BR'
            router.push(`/${locale}/free-trial/auth`)
            return null
        }
        
        // Se tem o cookie, mostramos um loading state breve ou permitimos a renderização 
        // mas o useAuth deve resolver em breve.
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-background to-secondary/5 font-sans">
            {/* Nav */}
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-between">
                <Image width={120} height={36} alt="ViraWeb logo" src="/viraweb3.png" />
                <div className="flex items-center gap-6">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:block">
                        Passo 2 de 2: Escolha seu plano
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                            await signOut()
                            router.push('/')
                        }}
                        className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold text-xs"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </Button>
                </div>
            </nav>

            {/* Header */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                        <Sparkles className="w-3 h-3 fill-current" />
                        Sua conta está ativa
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-foreground tracking-tight">Planos e Preços</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
                        Escolha o plano perfeito para seu negócio. Sem taxas ocultas, cancele quando quiser.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative border-2 transition-all duration-300 hover:shadow-2xl rounded-[24px] overflow-hidden ${plan.highlighted
                                ? "border-primary bg-linear-to-br from-primary/2 to-secondary/2 md:scale-105"
                                : "border-border hover:border-primary/50"
                                }`}
                        >
                            {plan.isTrial && (
                                <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground py-2 text-center text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm">
                                    <Zap className="w-3 h-3 fill-current" />
                                    14 Dias Grátis — Ativação Instantânea
                                </div>
                            )}
                            
                            {!plan.isTrial && plan.highlighted && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                    Mais Popular
                                </div>
                            )}

                            <div className={`p-8 ${plan.isTrial ? 'pt-12' : ''}`}>
                                {/* Plan Header */}
                                <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">{plan.name}</h3>
                                <p className="text-muted-foreground text-sm mb-8 font-medium leading-relaxed">{plan.description}</p>

                                {/* Price */}
                                <div className="mb-8 p-4 rounded-2xl bg-secondary/20 border border-secondary/10 flex flex-col items-center justify-center">
                                    {plan.isTrial && (
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Início: R$ 0,00</span>
                                    )}
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-black text-foreground tracking-tighter">R${plan.price.toFixed(2)}</span>
                                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">/{plan.period}</span>
                                    </div>
                                    {plan.isTrial && (
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-1 text-center">cobrados após 14 dias de uso</span>
                                    )}
                                </div>

                                {/* CTA Button */}
                                <Button
                                    disabled={!!isLoading}
                                    onClick={() => handleSelectPlan(plan.id, !!plan.isTrial)}
                                    className={`w-full mb-8 font-black py-7 rounded-xl text-xs uppercase tracking-[0.2em] transition-all ${plan.highlighted
                                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20"
                                        : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                        }`}
                                >
                                    {isLoading === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <div className="flex items-center gap-2">
                                            {plan.isTrial ? "Ativar Teste Grátis" : "Escolher Plano"}
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    )}
                                </Button>

                                {/* Features */}
                                <div className="space-y-4">
                                    <p className="text-[10px] font-black text-foreground mb-4 uppercase tracking-[0.2em]">O que está incluído:</p>
                                    {plan.features.map((feature, index) => (
                                        <div key={index} className="flex items-start gap-3 group">
                                            {feature.included ? (
                                                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-110 transition-transform">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-slate-50 text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                                                    <X className="w-3 h-3" />
                                                </div>
                                            )}
                                            <span
                                                className={`text-sm font-semibold tracking-tight ${feature.included ? "text-slate-600" : "text-slate-400 line-through"
                                                    }`}
                                            >
                                                {feature.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="text-center mt-20 space-y-6">
                    <div className="flex items-center justify-center gap-8 grayscale opacity-50">
                         {/* Security badges placeholder or simple text */}
                         <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Stripe Security Verified</span>
                         </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        © 2026 ViraWeb · Todos os direitos reservados
                    </p>
                </div>
            </div>
        </div>
    )
}
