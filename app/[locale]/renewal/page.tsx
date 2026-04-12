"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase-client"
import { useToast } from "@/hooks/use-toast"
import { fetchJson } from "@/lib/fetch-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Check, Sparkles, Zap, Shield, Image as ImageIcon, FileText, Table2, Upload, Loader2, ArrowRight, XCircle, AlertTriangle } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { PLAN_LIMITS } from "@/lib/plan-limits"

export default function RenewalPage() {
    const { user, loading: authLoading, signOut } = useAuth() as any
    const { toast } = useToast()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [lastSubscription, setLastSubscription] = useState<any>(null)
    const [fetching, setFetching] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!authLoading && user) {
            fetchLastSubscription()
        } else if (!authLoading && !user) {
            router.push("/?goto=renewal")
        }
    }, [user, authLoading])

    const fetchLastSubscription = async () => {
        try {
            const { data, error } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (data) setLastSubscription(data)
        } catch (err) {
            console.error("Error fetching last sub:", err)
        } finally {
            setFetching(false)
        }
    }

    const handleRenewal = async (planType: string) => {
        setIsLoading(true)
        try {
            const { url } = await fetchJson("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    plan_type: planType 
                }),
            })

            if (url) {
                window.location.href = url
            } else {
                throw new Error("Não foi possível gerar o link de checkout")
            }
        } catch (err: any) {
            toast({
                title: "Erro ao renovar",
                description: err.message || "Tente novamente mais tarde.",
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    if (authLoading || fetching) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    const currentPlan = lastSubscription?.plan_type || "nenhum"
    const isPremium = currentPlan === "premium" || currentPlan === "master"

    const plans = [
        { 
          id: "basic", 
          name: "Básico", 
          price: `R$ ${PLAN_LIMITS.basic.price.toFixed(2).replace('.', ',')}`, 
          desc: "Gestão essencial para seu negócio.", 
          color: "text-slate-600", 
          bg: "bg-slate-100" 
        },
        { 
          id: "premium", 
          name: "Premium", 
          price: `R$ ${PLAN_LIMITS.premium.price.toFixed(2).replace('.', ',')}`, 
          desc: "Recursos avançados com IA.", 
          color: "text-blue-600", 
          bg: "bg-blue-100", 
          highlight: true 
        },
        { 
          id: "master", 
          name: "Master", 
          price: `R$ ${PLAN_LIMITS.master.price.toFixed(2).replace('.', ',')}`, 
          desc: "Recursos ilimitados e suporte exclusivo.", 
          color: "text-purple-600", 
          bg: "bg-purple-100" 
        },
    ]

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <nav className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
                <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-32" />
                <Button variant="ghost" onClick={signOut} className="font-bold text-xs uppercase tracking-widest text-slate-400">
                    Sair
                </Button>
            </nav>

            <main className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
                <div className="max-w-4xl w-full space-y-12">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                            <XCircle className="w-3 h-3" />
                            Acesso Expirado
                        </div>
                        <h1 className="text-5xl lg:text-6xl font-black text-slate-900 tracking-tighter leading-tight">
                            Sua jornada não <br />
                            precisa <span className="text-primary italic underline underline-offset-8">parar agora.</span>
                        </h1>
                        <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto leading-relaxed">
                            Seu período de acesso terminou. Renove agora para manter sua gestão automatizada e continuar escalando seu negócio.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {plans.map((p) => {
                            const isCurrent = currentPlan === p.id
                            const canUpgrade = !isPremium && p.id === "premium"

                            return (
                                <Card key={p.id} className={`relative border-none overflow-hidden transition-all duration-300 ${p.highlight ? "shadow-2xl scale-105 z-10" : "shadow-lg"}`}>
                                    {isCurrent && (
                                        <div className="absolute top-4 right-4 px-2 py-1 bg-slate-900 text-white text-[8px] font-black uppercase tracking-widest rounded">
                                            Seu Plano
                                        </div>
                                    )}
                                    <CardHeader className="pt-8 pb-4">
                                        <div className={`p-3 rounded-xl w-fit ${p.bg} ${p.color} mb-3`}>
                                            <Zap className="w-5 h-5 fill-current" />
                                        </div>
                                        <CardTitle className="text-xl font-black text-slate-900">{p.name}</CardTitle>
                                        <CardDescription className="text-xs font-bold text-slate-400 h-10">{p.desc}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-slate-900">{p.price}</span>
                                            <span className="text-xs font-bold text-slate-400">/mês</span>
                                        </div>
                                        <Button 
                                            disabled={isLoading}
                                            onClick={() => handleRenewal(p.id)}
                                            variant={p.highlight ? "default" : "outline"}
                                            className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest gap-2 ${p.highlight ? "bg-primary shadow-lg shadow-primary/20" : ""}`}
                                        >
                                            {canUpgrade ? "Fazer Upgrade" : isCurrent ? "Renovar Agora" : "Selecionar"}
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </CardContent>
                                    {canUpgrade && (
                                        <div className="bg-primary/10 p-3 flex items-center justify-center gap-2">
                                            <Sparkles className="w-4 h-4 text-primary fill-current" />
                                            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Recomendado</span>
                                        </div>
                                    )}
                                </Card>
                            )
                        })}
                    </div>

                    <div className="bg-amber-50 border border-amber-100 p-6 rounded-[24px] flex items-center gap-4 max-w-2xl mx-auto">
                        <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                        <p className="text-sm font-semibold text-amber-900 leading-relaxed">
                            Seus dados (<span className="font-black italic">clientes, profissionais e notas</span>) continuam salvos e seguros. Eles serão liberados instantaneamente após a renovação.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    )
}
