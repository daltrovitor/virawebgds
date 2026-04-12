"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useSubscription } from "@/hooks/use-subscription"
import { motion } from "framer-motion"
import { 
    Check, Zap, Server, ShieldCheck, Clock, 
    MousePointerClick, ArrowRight, LayoutDashboard,
    PlayCircle, CheckCircle2, RefreshCcw, BarChart3,
} from "lucide-react"
import Image from "next/image"
import LanguageToggle from "@/components/language-toggle"
import DemoDashboard from "@/components/demo-dashboard"

export default function FreeTrialPage() {
    const { user, loading: authLoading } = useAuth() as any
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)
    const router = useRouter()
    
    // Auto-redirect logic
    useEffect(() => {
        if (authLoading || subLoading) return

        if (user) {
            const hasCustomerCookie = document.cookie.includes('vwd_is_customer=true')
            const locale = window.location.pathname.split('/')[1] || 'pt-BR'

            const currentStatus = subscription?.status as string
            const isActive = currentStatus === 'active' || currentStatus === 'trialing' || currentStatus === 'past_due' || currentStatus === 'expired'

            if ((subscription && isActive) || hasCustomerCookie) {
                const hostname = window.location.hostname
                const domain = hostname.includes('.') ? hostname.split('.').slice(-2).join('.') : hostname
                const cookieDomain = hostname.includes('.') ? `.${domain}` : domain
                
                document.cookie = `vwd_is_customer=true; Domain=${cookieDomain}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
                
                window.location.href = `/${locale}`
                return
            }

            router.push(`/${locale}/free-trial/plans`)
        }
    }, [user, authLoading, subLoading, subscription, router])

    const handleStartTrial = () => {
        const locale = window.location.pathname.split('/')[1] || 'pt-BR'
        const target = user ? `/${locale}/free-trial/plans` : `/${locale}/free-trial/auth`
        router.push(target)
    }

    const scrollToDemo = () => {
        document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' })
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <RefreshCcw className="w-8 h-8 animate-spin text-slate-800" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-200 overflow-x-hidden">
            {/* Minimalist Nav */}
            <nav className="sticky top-0 z-50 p-5 bg-white border-b border-slate-100">
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                    <div>
                        <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-24" />
                    </div>
                    <div className="flex items-center gap-6">
                        <LanguageToggle variant="compact" />
                        {!user && (
                            <button onClick={() => {
                                const locale = window.location.pathname.split('/')[1] || 'pt-BR'
                                router.push(`/${locale}/free-trial/auth?login=true`)
                            }} className="cursor-pointer text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                                Entrar
                            </button>
                        )}
                        <button onClick={handleStartTrial} className="cursor-pointer bg-slate-900 text-white font-medium rounded-lg px-5 py-2.5 text-sm shadow-sm hover:bg-slate-800 transition-all">
                            Começar teste grátis
                        </button>
                    </div>
                </div>
            </nav>

            <main>
                {/* 1. Hero Content */}
                <section className="pt-24 pb-16 px-4 bg-white text-center">
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-800 border border-slate-200">
                            <Zap className="w-4 h-4 text-emerald-500" />
                            <span>Experimente grátis por 14 dias.</span>
                        </div>
                        
                        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
                            Sua gestão centralizada, <br />
                            <span className="text-slate-500">antes mesmo de criar conta.</span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                            Simule agora mesmo como nosso dashboard elimina o trabalho manual e acelera a performance do seu negócio. Explore a demonstração abaixo.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                            <button 
                                onClick={handleStartTrial} 
                                className="cursor-pointer inline-flex items-center justify-center gap-2 h-14 px-8 bg-slate-900 text-white rounded-xl text-lg font-medium shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all w-full sm:w-auto"
                            >
                                Começar teste grátis <ArrowRight className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={scrollToDemo} 
                                className="cursor-pointer inline-flex items-center justify-center gap-2 h-14 px-8 bg-white text-slate-900 rounded-xl text-lg font-medium border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all w-full sm:w-auto"
                            >
                                Explorar demo <PlayCircle className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* 2. Interactive Dashboard Demo */}
                <section id="demo-section" className="py-12 px-4 bg-slate-50/50 relative border-y border-slate-100">
                    <div className="max-w-[1200px] mx-auto">
                        <div className="text-center mb-10">
                            <h3 className="text-sm font-bold tracking-widest uppercase text-slate-400 mb-2">Veja exatamente como funciona</h3>
                            <p className="text-slate-600 font-medium">Interaja com a interface real da plataforma</p>
                        </div>

                        {/* Wrapper of Demo Dashboard with Tooltips */}
                        <div className="relative">
                            

                            {/* Demo Container */}
                            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 ring-1 ring-slate-200 overflow-hidden relative">
                                {/* Browser Mockup Header */}
                                <div className="bg-slate-100/80 border-b border-slate-200 p-3 flex items-center gap-4">
                                    <div className="flex gap-1.5 ml-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                                    </div>
                                    <div className="flex-1 max-w-sm mx-auto bg-white rounded-md text-[11px] font-medium text-slate-400 py-1.5 px-3 flex items-center justify-center gap-2 border border-slate-200 shadow-sm">
                                        <ShieldCheck className="w-3 h-3" /> app.viraweb.online
                                    </div>
                                </div>
                                <div className="h-[600px] overflow-hidden bg-slate-50">
                                    <DemoDashboard showFullPage={false} />
                                </div>
                                
                                {/* Overlay to block navigation out of demo but allow clicks inside if demo supports it */}
                                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-end justify-center pb-6">
                                    <button onClick={handleStartTrial} className="cursor-pointer pointer-events-auto shadow-xl bg-slate-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-slate-800 hover:scale-105 transition-all">
                                        Acessar o sistema completo <MousePointerClick className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Benefits (Foco em Resultados) */}
                <section className="py-20 px-4 bg-white">
                    <div className="max-w-6xl mx-auto space-y-12">
                        <div className="text-center max-w-2xl mx-auto space-y-4">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
                                Desenhado para eliminar o caos
                            </h2>
                            <p className="text-lg text-slate-600">
                                Não vendemos ferramentas. Vendemos tempo, organização e escala.
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[
                                { icon: Clock, title: "Economize horas", desc: "Automatize rotinas repetitivas que drenam a energia da sua equipe todos os dias." },
                                { icon: LayoutDashboard, title: "Centralize tudo", desc: "Suas vendas, clientes e métricas em uma única janela. Fim das abas perdidas." },
                                { icon: Zap, title: "Automação inteligente", desc: "Deixe o software trabalhar por você com fluxos que rodam no background." },
                                { icon: CheckCircle2, title: "Evite erros manuais", desc: "Padronize a entrada de dados e reduza perdas por falhas de preenchimento." },
                                { icon: BarChart3, title: "Decisões precisas", desc: "Dados limpos e em tempo real para você saber exatamente o próximo passo." },
                                { icon: Server, title: "Escale com segurança", desc: "Infraestrutura robusta que suporta o crescimento acelerado da sua operação." }
                            ].map((b, i) => (
                                <div key={i} className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:shadow-lg hover:border-slate-200 transition-all group">
                                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-700 mb-5 group-hover:scale-110 transition-transform">
                                        <b.icon className="w-6 h-6 stroke-[1.5]" />
                                    </div>
                                    <h4 className="text-xl font-semibold text-slate-900 mb-2">{b.title}</h4>
                                    <p className="text-slate-600 leading-relaxed">{b.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. Como Funciona */}
                <section className="py-20 px-4 bg-slate-50 border-y border-slate-100">
                    <div className="max-w-5xl mx-auto">
                        <div className="text-center mb-16 space-y-4">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Em produção em 3 passos simples</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 relative">
                            {/* Connector line */}
                            <div className="hidden md:block absolute top-[28px] left-[15%] right-[15%] h-0.5 bg-slate-200"></div>
                            
                            {[
                                { step: "01", title: "Crie sua conta livre", desc: "Acesso total em 30 segundos. Sem precisar preencher dados de cartão." },
                                { step: "02", title: "Configure o essencial", desc: "Adicione seus dados básicos e veja a interface se moldar ao seu negócio." },
                                { step: "03", title: "Assuma o controle", desc: "Operação rodando redonda no mesmo dia. Simples e sem fricção." }
                            ].map((s, i) => (
                                <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                                    <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center font-bold text-lg text-slate-900 shadow-md border border-slate-200 mb-6 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                        {s.step}
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 mb-3">{s.title}</h4>
                                    <p className="text-slate-600 text-sm">{s.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. Trust Proves & 6. Final CTA */}
                <section className="py-24 px-4 bg-white text-center">
                    <div className="max-w-3xl mx-auto space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-bold tracking-tight text-slate-900">
                                Feito para negócios reais. <br />
                                <span className="text-slate-400">Sem complexidade desnecessária.</span>
                            </h2>
                            <p className="text-lg text-slate-600 pb-4">
                                Você já viu como funciona. Agora é hora de colocar a plataforma para rodar os bastidores da sua empresa. Pronto para começar?
                            </p>
                        </div>
                        
                        <div className="flex flex-col items-center gap-6">
                            <button 
                                onClick={handleStartTrial} 
                                className="cursor-pointer h-16 px-10 bg-slate-900 text-white rounded-xl text-xl font-medium shadow-xl shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-1 transition-all w-full sm:w-auto flex items-center justify-center gap-3"
                            >
                                Começar teste grátis agora
                                <ArrowRight className="w-5 h-5" />
                            </button>
                            
                            {/* 7. Redução de Risco */}
                            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-slate-500">
                                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Sem cartão de crédito</span>
                                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Cancele quando quiser</span>
                                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500" /> Configuração em minutos</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Clean Footer */}
            <footer className="py-10 px-4 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-20 " />
                    <div className="flex gap-6 text-sm font-medium text-slate-500">
                        <a href="/pt-BR/termos" className="hover:text-slate-900 transition-colors">Termos</a>
                        <a href="/pt-BR/privacidade" className="hover:text-slate-900 transition-colors">Privacidade</a>
                        <a href="/pt-BR/lgpd" className="hover:text-slate-900 transition-colors">LGPD</a>
                    </div>
                    <p className="text-sm font-medium text-slate-400">© 2026 ViraWeb. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    )
}
