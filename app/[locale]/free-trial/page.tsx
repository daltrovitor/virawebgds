"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
    Check, Sparkles, Zap, Shield, Image as ImageIcon, FileText, 
    Table2, Upload, Loader2, ArrowRight, Bot, Target, 
    MessageSquare, Clock, Globe, Star, ChevronDown, Rocket,
    Home, Users, Calendar, CreditCard, BarChart3, Settings,
    Bell, Menu, Search, Filter, Plus, Layout, PieChart
} from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSubscription } from "@/hooks/use-subscription"
import { motion, AnimatePresence } from "framer-motion"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"
import DemoDashboard from "@/components/demo-dashboard"

// --- Main Page Component ---

export default function FreeTrialPage() {
    const { user, loading: authLoading } = useAuth() as any
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const t = useTranslations('freeTrial')

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
        setIsLoading(true)
        const locale = window.location.pathname.split('/')[1] || 'pt-BR'
        const target = user ? `/${locale}/free-trial/plans` : `/${locale}/free-trial/auth`
        router.push(target)
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        )
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3
            }
        }
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    }

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary/10 overflow-x-hidden">
            {/* Nav */}
            <nav className="sticky top-0 z-50 p-4 bg-white border-b border-slate-300">
                <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                        <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-24" />
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-4">
                        <LanguageToggle variant="compact" />
                        {!user && (
                            <button onClick={() => router.push("/")} className="text-[12px] font-bold text-slate-600 uppercase tracking-tight hover:text-slate-900">
                                {t('nav.login')}
                            </button>
                        )}
                        <button onClick={handleStartTrial} className="bg-primary text-white font-black rounded-none px-4 py-2 shadow-sm text-[12px] uppercase tracking-widest border border-primary">
                            {t('nav.start')}
                        </button>
                    </motion.div>
                </div>
            </nav>

            <main>
                {/* Hero Section with Interactive Demo */}
                <section className="relative pt-12 pb-20 px-4 bg-slate-50 border-b border-slate-200">
                    <div className="max-w-7xl mx-auto">
                        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="text-center space-y-6 max-w-4xl mx-auto mb-12">
                            <motion.h1 variants={itemVariants} className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 uppercase">
                                {t.rich('hero.title', {
                                    gestao: (chunks) => <span className="text-primary italic">{chunks}</span>
                                })}
                            </motion.h1>
                            
                            <motion.p variants={itemVariants} className="text-[15px] text-slate-600 max-w-2xl mx-auto leading-relaxed font-bold">
                                {t('hero.description')}
                            </motion.p>
                            
                            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button onClick={handleStartTrial} className="h-12 px-8 bg-slate-900 text-white rounded-none text-[14px] font-black shadow-sm uppercase tracking-widest border border-slate-900 hover:bg-slate-800 transition-all">
                                    {t('hero.cta')}
                                </button>
                            </motion.div>
                        </motion.div>

                        {/* Interactive Demo Area */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} 
                            whileInView={{ opacity: 1, y: 0 }} 
                            viewport={{ once: true }}
                            className="relative max-w-5xl mx-auto"
                        >
                            <div className="relative p-1 bg-white rounded-none shadow-md border border-slate-300 overflow-hidden">
                                <div className="bg-slate-100 border-b border-slate-300 p-2 flex items-center justify-between">
                                    <div className="flex gap-1">
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400 border border-slate-500" />
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400 border border-slate-500" />
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400 border border-slate-500" />
                                    </div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">viraweb.online/free-trial/demo</div>
                                    <div className="w-6" />
                                </div>
                                <DemoDashboard showFullPage={false} />
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* Explanatory Sections */}
                
                {/* 1. Gestão de Clientes & OCR */}
                <section className="py-16 px-4 bg-white overflow-hidden border-b border-slate-200">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 bg-slate-50 text-primary rounded-none border border-slate-300 shadow-sm flex items-center justify-center">
                                <Users className="w-6 h-6" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight uppercase">
                                    {t.rich('features.clients.title', {
                                        br: () => <br />
                                    })}
                                </h2>
                                <p className="text-[14px] text-slate-500 font-bold leading-relaxed">
                                    {t('features.clients.description')}
                                </p>
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <li key={i} className="flex items-center gap-2 font-black text-[12px] text-slate-700 uppercase tracking-tight">
                                        <Check className="w-3.5 h-3.5 text-primary" strokeWidth={4} />
                                        {t(`features.clients.item${i}`)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="relative">
                            <div className="p-4 bg-slate-50 rounded-none border border-slate-300 shadow-sm space-y-4">
                                <div className="border border-dashed border-slate-400 bg-white rounded-none p-8 text-center space-y-3">
                                    <Upload className="w-8 h-8 text-primary mx-auto" />
                                    <p className="font-black text-[11px] text-slate-600 uppercase tracking-wider">{t('features.clients.ocrDrop')}</p>
                                    <div className="w-full bg-slate-100 h-1.5 rounded-none overflow-hidden">
                                        <motion.div className="h-full bg-primary w-1/2" animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em]">{t('features.clients.ocrProcess')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Agenda & ViraBot AI */}
                <section className="py-16 px-4 bg-slate-50 border-b border-slate-200">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="order-2 lg:order-1 relative">
                            <div className="bg-slate-900 rounded-none p-6 text-white space-y-6 shadow-md border border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-primary rounded-none flex items-center justify-center border border-primary">
                                        <Bot className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase text-primary tracking-[0.2em]">{t('features.ai.badge')}</p>
                                        <h4 className="font-bold text-sm uppercase">{t('features.ai.subtitle')}</h4>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white/5 p-3 rounded-none border border-white/10">
                                        <p className="text-[10px] text-slate-400 uppercase font-black mb-1">{t('features.ai.patientSays')}</p>
                                        <p className="italic font-bold text-[13px]">{t('features.ai.patientText')}</p>
                                    </div>
                                    <div className="bg-primary/10 p-3 rounded-none border border-primary/30 ml-6">
                                        <p className="text-[10px] text-primary font-black uppercase mb-1">{t('features.ai.botSays')}</p>
                                        <p className="font-bold text-[13px] text-white">{t('features.ai.botText')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2 space-y-6">
                            <div className="w-12 h-12 bg-white text-primary rounded-none border border-slate-300 shadow-sm flex items-center justify-center">
                                <Bot className="w-6 h-6" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight uppercase">
                                    {t.rich('features.ai.title', {
                                        br: () => <br />
                                    })}
                                </h2>
                                <p className="text-[14px] text-slate-500 font-bold leading-relaxed">
                                    {t('features.ai.description')}
                                </p>
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <li key={i} className="flex items-center gap-2 font-black text-[12px] text-slate-700 uppercase tracking-tight">
                                        <Check className="w-3.5 h-3.5 text-primary" strokeWidth={4} />
                                        {t(`features.ai.item${i}`)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                {/* 3. Financeiro & Relatórios */}
                <section className="py-16 px-4 bg-white border-b border-slate-200">
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <div className="w-12 h-12 bg-slate-50 text-primary rounded-none border border-slate-300 shadow-sm flex items-center justify-center">
                                <CreditCard className="w-6 h-6" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-3xl font-black text-slate-900 leading-tight tracking-tight uppercase">
                                    {t.rich('features.financial.title', {
                                        br: () => <br />
                                    })}
                                </h2>
                                <p className="text-[14px] text-slate-500 font-bold leading-relaxed">
                                    {t('features.financial.description')}
                                </p>
                            </div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <li key={i} className="flex items-center gap-2 font-black text-[12px] text-slate-700 uppercase tracking-tight">
                                        <Check className="w-3.5 h-3.5 text-primary" strokeWidth={4} />
                                        {t(`features.financial.item${i}`)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-none border border-slate-300 shadow-sm">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                                    <h4 className="font-black text-[10px] uppercase tracking-widest text-slate-500">{t('features.financial.monthlyRevenue')}</h4>
                                    <span className="text-emerald-700 font-black text-[10px] uppercase">{t('features.financial.growth')}</span>
                                </div>
                                <div className="h-40 flex items-end gap-1.5 pb-2">
                                    {[30, 45, 60, 40, 75, 90, 85].map((h, i) => (
                                        <motion.div 
                                            key={i} 
                                            initial={{ height: 0 }} 
                                            whileInView={{ height: `${h}%` }}
                                            className="flex-1 bg-primary/20 border-t border-x border-primary rounded-none"
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white border border-slate-200">
                                        <p className="text-[9px] uppercase font-black text-slate-400">{t('features.financial.toPay')}</p>
                                        <p className="font-black text-red-600 text-sm">R$ 2.450</p>
                                    </div>
                                    <div className="p-3 bg-white border border-slate-200">
                                        <p className="text-[9px] uppercase font-black text-slate-400">{t('features.financial.toReceive')}</p>
                                        <p className="font-black text-emerald-600 text-sm">R$ 15.800</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Final CTA Card */}
                <section className="py-20 px-4 bg-slate-900 border-b border-slate-800">
                    <div className="max-w-4xl mx-auto">
                        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                            <div className="bg-white rounded-none border-2 border-primary shadow-lg p-10 text-center space-y-8">
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-white rounded-none text-[9px] font-black uppercase tracking-widest">
                                        <Zap className="w-3 h-3 fill-current" />
                                        {t('finalCta.badge')}
                                    </div>
                                    <h2 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
                                        {t.rich('finalCta.title', {
                                            nextLevel: (chunks) => <span className="text-primary italic">{chunks}</span>,
                                            br: () => <br />
                                        })}
                                    </h2>
                                    <p className="text-slate-600 font-bold text-[14px] max-w-md mx-auto uppercase tracking-tight">
                                        {t('finalCta.description')}
                                    </p>
                                </div>
                                <button onClick={handleStartTrial} className="h-16 w-full max-w-md mx-auto bg-primary text-white rounded-none text-[18px] font-black shadow-sm uppercase tracking-widest border border-primary hover:bg-blue-600 transition-all">
                                    {t('finalCta.button')}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="py-16 px-4 bg-white border-b border-slate-200">
                    <div className="max-w-3xl mx-auto space-y-10">
                        <div className="text-center space-y-2">
                            <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase">{t('faq.title')}</h2>
                            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em]">{t('faq.subtitle')}</p>
                        </div>
                        <Accordion type="single" collapsible className="w-full space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <AccordionItem key={i} value={`item-${i}`} className="border border-slate-300 bg-slate-50 px-6 rounded-none shadow-sm">
                                    <AccordionTrigger className="text-left font-bold text-slate-900 hover:no-underline py-4 uppercase text-[12px] tracking-tight">{t(`faq.q${i}`)}</AccordionTrigger>
                                    <AccordionContent className="text-slate-600 text-[13px] font-medium pb-4 leading-relaxed">{t(`faq.a${i}`)}</AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="py-12 px-4 bg-white border-t border-slate-300">
                <div className="max-w-7xl mx-auto flex flex-col items-center gap-6">
                    <div className="opacity-40 grayscale">
                        <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-24" />
                    </div>
                    <div className="flex gap-6">
                        <a href="/termos" className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors">Termos de Uso</a>
                        <a href="/privacidade" className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors">Privacidade</a>
                        <a href="/lgpd" className="text-[9px] font-black text-slate-500 uppercase tracking-widest hover:text-primary transition-colors">LGPD</a>
                    </div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">© 2026 ViraWeb Tecnologias. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    )
}
