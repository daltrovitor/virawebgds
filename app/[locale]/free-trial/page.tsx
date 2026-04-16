"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useSubscription } from "@/hooks/use-subscription"
import { motion } from "framer-motion"
import { 
    Check, Zap, ShieldCheck, Clock, 
    ArrowRight, 
    PlayCircle, CheckCircle2, RefreshCcw, BarChart3,
    TrendingUp, Shield, Users, Calendar, Wallet,
    Tag, ListChecks, Bell, ArrowRightCircle,
    Target, LineChart, Lock, Rocket, FileText, CheckCheck, Upload, BookOpen, Trophy
} from "lucide-react"
import Image from "next/image"
import LanguageToggle from "@/components/language-toggle"
import DemoDashboard from "@/components/demo-dashboard"
import { useTranslations } from 'next-intl'

export default function FreeTrialPage() {
    const { user, loading: authLoading } = useAuth() as any
    const { subscription, loading: subLoading } = useSubscription(user?.id || null)
    const router = useRouter()
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

    const fadeInUp = {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.5 }
    }

    const problemItems = [
        { icon: Clock, titleKey: 'problem.item1Title', descKey: 'problem.item1Desc' },
        { icon: Wallet, titleKey: 'problem.item2Title', descKey: 'problem.item2Desc' },
        { icon: Users, titleKey: 'problem.item3Title', descKey: 'problem.item3Desc' }
    ]

    const benefitItems = [
        {
            icon: Zap,
            titleKey: 'benefits.item1Title',
            descKey: 'benefits.item1Desc',
            color: "bg-[#FFD400]",
            textColor: "text-slate-900"
        },
        {
            icon: LineChart,
            titleKey: 'benefits.item2Title',
            descKey: 'benefits.item2Desc',
            color: "bg-emerald-500",
            textColor: "text-white"
        },
        {
            icon: ShieldCheck,
            titleKey: 'benefits.item3Title',
            descKey: 'benefits.item3Desc',
            color: "bg-[#3396D3]",
            textColor: "text-white"
        }
    ]

    const featureItems = [
        { icon: Upload, titleKey: 'features.import', descKey: 'features.importDesc' },
        { icon: BookOpen, titleKey: 'features.notes', descKey: 'features.notesDesc' },
        { icon: ListChecks, titleKey: 'features.checklist', descKey: 'features.checklistDesc' },
        { icon: Bell, titleKey: 'features.reminders', descKey: 'features.remindersDesc' },
        { icon: Zap, titleKey: 'features.virabot', descKey: 'features.virabotDesc' },
        { icon: Trophy, titleKey: 'features.goals', descKey: 'features.goalsDesc' },
        { icon: Calendar, titleKey: 'features.scheduling', descKey: 'features.schedulingDesc' },
        { icon: Users, titleKey: 'features.clients', descKey: 'features.clientsDesc' },
        { icon: Wallet, titleKey: 'features.financial', descKey: 'features.financialDesc' },
        { icon: Tag, titleKey: 'features.priceTable', descKey: 'features.priceTableDesc' },
        { icon: Target, titleKey: 'features.budgets', descKey: 'features.budgetsDesc' },
        { icon: CheckCheck, titleKey: 'features.closure', descKey: 'features.closureDesc' }
    ]

    const authorityItems = [
        { titleKey: 'authority.item1Title', descKey: 'authority.item1Desc' },
        { titleKey: 'authority.item2Title', descKey: 'authority.item2Desc' },
        { titleKey: 'authority.item3Title', descKey: 'authority.item3Desc' }
    ]

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-x-hidden">
            {/* 1. Header Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-[60] bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-28" />
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#solucao" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">{t('nav.solution')}</a>
                        <a href="#beneficios" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">{t('nav.benefits')}</a>
                        <a href="#recursos" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">{t('nav.features')}</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageToggle variant="compact" />
                        {!user && (
                            <button onClick={() => {
                                const locale = window.location.pathname.split('/')[1] || 'pt-BR'
                                router.push(`/${locale}/free-trial/auth?login=true`)
                            }} className="hidden sm:block text-sm font-semibold text-slate-700 hover:text-slate-900">
                                {t('nav.login')}
                            </button>
                        )}
                        <button onClick={handleStartTrial} className="bg-[#3396D3] text-white font-bold px-6 py-2.5 text-sm shadow-lg shadow-blue-500/10 hover:bg-[#2a7eb3] hover:scale-[1.02] active:scale-95 transition-all">
                            {t('nav.cta')}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-20">
                {/* 1. HERO SECTION */}
                <section className="relative pt-20 pb-32 overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(51,150,211,0.05)_0%,transparent_50%)] pointer-events-none"></div>
                    
                    <div className="max-w-7xl mx-auto px-4 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="space-y-8"
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-sm font-bold text-[#3396D3] border border-blue-100 mb-4">
                                <Rocket className="w-4 h-4" />
                                <span>{t('hero.badge')}</span>
                            </div>
                            
                            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.05] max-w-5xl mx-auto">
                                {t('hero.title')} <span className="text-[#3396D3]">{t('hero.titleHighlight')}</span> {t('hero.titleEnd')}
                            </h1>
                            
                            <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                                {t('hero.description')} <span className="font-bold text-slate-900">{t('hero.descriptionBold')}</span>.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-5 justify-center pt-8">
                                <button 
                                    onClick={handleStartTrial} 
                                    className="group relative inline-flex items-center justify-center gap-2 h-16 px-10 bg-slate-900 text-white text-lg font-bold shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all hover:-translate-y-1"
                                >
                                    {t('hero.ctaPrimary')} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </button>
                                <button 
                                    onClick={scrollToDemo} 
                                    className="inline-flex items-center justify-center gap-2 h-16 px-10 bg-white text-slate-900 text-lg font-bold border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                                >
                                    {t('hero.ctaSecondary')} <PlayCircle className="w-5 h-5 text-[#3396D3]" />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* 2. PROBLEMA SECTION */}
                <section className="py-24 bg-slate-950 text-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="max-w-7xl mx-auto px-4 relative z-10">
                        <div className="text-center mb-20">
                            <h2 className="text-3xl md:text-5xl font-bold mb-6">{t('problem.title')}</h2>
                            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">{t('problem.subtitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {problemItems.map((item, idx) => (
                                <motion.div 
                                    key={idx}
                                    {...fadeInUp}
                                    className="p-8 bg-white/5 border border-white/10"
                                >
                                    <div className="w-14 h-14 bg-blue-500/10 flex items-center justify-center text-blue-400 mb-6">
                                        <item.icon className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-4">{t(item.titleKey)}</h3>
                                    <p className="text-slate-400 leading-relaxed">{t(item.descKey)}</p>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-20 text-center">
                            <p className="text-2xl font-medium text-blue-300 italic">
                                {t('problem.quote')}
                            </p>
                        </div>
                    </div>
                </section>

                {/* 3. SOLUÇÃO SECTION */}
                <section id="solucao" className="py-32 bg-white">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                            <motion.div {...fadeInUp} className="space-y-8">
                                <div className="inline-block px-4 py-1 bg-blue-50 text-blue-700 text-sm font-bold">{t('solution.badge')}</div>
                                <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">
                                    {t('solution.title')}
                                </h2>
                                <p className="text-xl text-slate-600 leading-relaxed">
                                    {t('solution.description')} <span className="text-slate-900 font-bold">{t('solution.descriptionBold')}</span> {t('solution.descriptionEnd')}
                                </p>
                                <div className="space-y-4">
                                    {['check1', 'check2', 'check3'].map((key, i) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 bg-[#3396D3] flex items-center justify-center">
                                                <Check className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="font-semibold text-slate-700">{t(`solution.${key}`)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="pt-4">
                                    <p className="text-lg font-bold text-slate-900">
                                        {t('solution.cta')}
                                    </p>
                                </div>
                            </motion.div>
                            
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8 }}
                                viewport={{ once: true }}
                                className="relative"
                            >
                                <div className="relative bg-slate-50 border border-slate-200 p-8 shadow-xl">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-4">
                                            <div className="h-32 bg-white shadow-sm border border-slate-100 p-4 flex flex-col justify-end">
                                                <TrendingUp className="w-6 h-6 text-emerald-500 mb-2" />
                                                <div className="text-xs font-bold text-slate-400">{t('solution.revenue')}</div>
                                                <div className="text-lg font-bold">{t('solution.revenueValue')}</div>
                                            </div>
                                            <div className="h-48 bg-[#3396D3] shadow-sm p-4 text-white flex flex-col justify-between">
                                                <Zap className="w-8 h-8 opacity-50" />
                                                <div>
                                                    <div className="text-xs font-bold opacity-70">{t('solution.automations')}</div>
                                                    <div className="text-xl font-bold">{t('solution.automationsValue')}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-8">
                                            <div className="h-48 bg-slate-900 shadow-sm p-4 text-white flex flex-col justify-between">
                                                <Users className="w-8 h-8 opacity-50" />
                                                <div>
                                                    <div className="text-xs font-bold opacity-70">{t('solution.clients')}</div>
                                                    <div className="text-xl font-bold">{t('solution.clientsValue')}</div>
                                                </div>
                                            </div>
                                            <div className="h-32 bg-white shadow-sm border border-slate-100 p-4 flex flex-col justify-end">
                                                <BarChart3 className="w-6 h-6 text-blue-500 mb-2" />
                                                <div className="text-xs font-bold text-slate-400">{t('solution.conversion')}</div>
                                                <div className="text-lg font-bold">{t('solution.conversionValue')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* 4. BENEFÍCIOS SECTION */}
                <section id="beneficios" className="py-24 bg-slate-50 relative">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="text-center mb-20 space-y-4">
                            <h2 className="text-4xl font-bold text-slate-900">{t('benefits.title')}</h2>
                            <p className="text-slate-600 text-lg max-w-2xl mx-auto">{t('benefits.subtitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                            {benefitItems.map((benefit, i) => (
                                <motion.div 
                                    key={i} 
                                    {...fadeInUp}
                                    className="bg-white p-10 border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 group"
                                >
                                    <div className={`w-14 h-14 ${benefit.color} flex items-center justify-center ${benefit.textColor} mb-8 group-hover:scale-110 transition-transform`}>
                                        <benefit.icon className="w-7 h-7" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{t(benefit.titleKey)}</h3>
                                    <p className="text-slate-600 leading-relaxed text-lg">{t(benefit.descKey)}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. TRANSFORMAÇÃO (Antes vs Depois) */}
                <section className="py-32 bg-white">
                    <div className="max-w-5xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-extrabold text-slate-900 mb-4">{t('transformation.title')}</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden border border-slate-200 shadow-2xl">
                            <div className="bg-slate-50 p-12 border-b md:border-b-0 md:border-r border-slate-200">
                                <div className="text-slate-400 font-bold tracking-widest uppercase mb-8 text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-slate-300"></div> {t('transformation.before')}
                                </div>
                                <ul className="space-y-6">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <li key={i} className="flex items-start gap-4 text-slate-500">
                                            <div className="flex-shrink-0 w-5 h-5 mt-0.5 border-2 border-slate-200 flex items-center justify-center text-[10px] font-bold">X</div>
                                            <span className="text-lg">{t(`transformation.before${i}`)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            <div className="bg-slate-950 p-12 text-white">
                                <div className="text-[#FFD400] font-bold tracking-widest uppercase mb-8 text-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#FFD400] animate-pulse"></div> {t('transformation.after')}
                                </div>
                                <ul className="space-y-6">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <li key={i} className="flex items-start gap-4 text-slate-200">
                                            <div className="flex-shrink-0 w-5 h-5 mt-0.5 bg-[#3396D3] flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                            <span className="text-lg font-medium">{t(`transformation.after${i}`)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 6. FUNCIONALIDADES SECTION */}
                <section id="recursos" className="py-32 bg-slate-50 border-y border-slate-100">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="text-center mb-24">
                            <h2 className="text-4xl font-bold text-slate-900 mb-4">{t('features.title')}</h2>
                            <p className="text-slate-600 text-lg">{t('features.subtitle')}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {featureItems.map((feature, i) => (
                                <motion.div 
                                    key={i} 
                                    {...fadeInUp}
                                    className="p-8 bg-white border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all"
                                >
                                    <div className="w-12 h-12 bg-slate-50 flex items-center justify-center text-slate-700 mb-6">
                                        <feature.icon className="w-6 h-6" />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 mb-2">{t(feature.titleKey)}</h4>
                                    <p className="text-slate-600 leading-relaxed">{t(feature.descKey)}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 7. DEMO INTERATIVA (DIFERENCIAL) */}
                <section id="demo-section" className="py-32 bg-white relative overflow-hidden">
                    <div className="max-w-[1200px] mx-auto px-4">
                        <div className="text-center mb-16 space-y-6">
                            <div className="inline-block px-4 py-1.5 bg-slate-900 text-[#FFD400] text-xs font-black tracking-widest uppercase">{t('demo.badge')}</div>
                            <h2 className="text-4xl md:text-6xl font-black text-slate-900">{t('demo.title')}</h2>
                            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                                {t('demo.subtitle1')} <br />
                                {t('demo.subtitle2')}
                            </p>
                        </div>

                        <div className="relative group">
                            {/* Decorative elements - removed blur */}
                            
                            {/* Browser Mockup */}
                            <div className="bg-white shadow-[0_50px_100px_-20px_rgba(0,0,0,0.15)] ring-1 ring-slate-200 overflow-hidden relative">
                                <div className="bg-slate-100/50 border-b border-slate-200 p-4 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 bg-slate-300"></div>
                                        <div className="w-3 h-3 bg-slate-300"></div>
                                        <div className="w-3 h-3 bg-slate-300"></div>
                                    </div>
                                    <div className="flex-1 max-w-sm mx-auto bg-white text-xs font-semibold text-slate-400 py-2 px-4 flex items-center justify-center gap-2 border border-slate-200">
                                        <Lock className="w-3 h-3" /> gdc.viraweb.online/demo-interativa
                                    </div>
                                    <div className="w-16"></div>
                                </div>
                                <div className="h-[700px] overflow-hidden bg-slate-50">
                                    <DemoDashboard showFullPage={false} />
                                </div>
                                
                                {/* High Persuasion Overlay */}
                                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/95 to-transparent flex items-end justify-center pb-10 px-4">
                                    <div className="flex flex-col items-center gap-4">
                                        <p className="text-slate-900 font-bold hidden sm:block">{t('demo.overlayText')}</p>
                                        <button 
                                            onClick={handleStartTrial} 
                                            className="px-10 py-5 bg-[#3396D3] text-white text-lg font-black shadow-2xl shadow-blue-600/30 hover:bg-[#2a7eb3] hover:scale-[1.05] transition-all flex items-center gap-3"
                                        >
                                            {t('demo.overlayCta')} <ArrowRightCircle className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 8. PROBLEMAS RESOLVIDOS & 9. AUTORIDADE */}
                <section className="py-32 bg-slate-950 text-white">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
                            <div>
                                <h2 className="text-4xl md:text-5xl font-bold mb-10 leading-tight">
                                    {t('authority.title')} <span className="text-[#FFD400] animate-pulse">{t('authority.titleHighlight')}</span>.
                                </h2>
                                <p className="text-lg text-slate-400 mb-12 leading-relaxed">
                                    {t('authority.description')}
                                </p>
                                <div className="space-y-6">
                                    {authorityItems.map((item, i) => (
                                        <div key={i} className="flex gap-6 p-6 bg-white/5 border border-white/10">
                                            <div className="flex-shrink-0 w-12 h-12 bg-blue-500/20 flex items-center justify-center text-[#3396D3] font-bold text-xl">{i+1}</div>
                                            <div>
                                                <h4 className="text-xl font-bold mb-1">{t(item.titleKey)}</h4>
                                                <p className="text-slate-400">{t(item.descKey)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="relative">
                                <div className="bg-blue-600/10 border border-blue-500/30 p-12 text-center space-y-8">
                                    <div className="w-20 h-20 bg-[#3396D3] flex items-center justify-center mx-auto shadow-2xl shadow-blue-600/50">
                                        <Shield className="w-10 h-10 text-white" />
                                    </div>
                                    <h3 className="text-3xl font-bold">{t('authority.guaranteeTitle')}</h3>
                                    <p className="text-lg text-slate-300 leading-relaxed">
                                        {t('authority.guaranteeDesc')}
                                    </p>
                                    <ul className="text-left space-y-4 inline-block mx-auto">
                                        <li className="flex items-center gap-3 text-slate-200">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {t('authority.guarantee1')}
                                        </li>
                                        <li className="flex items-center gap-3 text-slate-200">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {t('authority.guarantee2')}
                                        </li>
                                        <li className="flex items-center gap-3 text-slate-200">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-400" /> {t('authority.guarantee3')}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 10. OFERTA / CTA FINAL */}
                <section className="py-40 bg-white text-center relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
                    
                    <div className="max-w-4xl mx-auto px-4 space-y-12">
                        <motion.div {...fadeInUp} className="space-y-6">
                            <h2 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter">
                                {t('finalCta.title')}
                            </h2>
                            <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto font-medium">
                                {t('finalCta.subtitle')}
                            </p>
                        </motion.div>
                        
                        <div className="flex flex-col items-center gap-8">
                            <div className="flex flex-col sm:flex-row gap-5 w-full justify-center">
                                <button 
                                    onClick={handleStartTrial} 
                                    className="h-20 px-12 bg-slate-900 text-white text-2xl font-black shadow-2xl shadow-slate-900/30 hover:bg-slate-800 hover:-translate-y-2 transition-all flex items-center justify-center gap-4 group"
                                >
                                    {t('finalCta.ctaPrimary')} <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                                </button>
                                <button 
                                    onClick={scrollToDemo} 
                                    className="h-20 px-12 bg-white text-slate-900 text-2xl font-black border-4 border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-4"
                                >
                                    {t('finalCta.ctaSecondary')}
                                </button>
                            </div>
                            
                            <div className="flex flex-wrap justify-center gap-10 text-sm font-bold text-slate-400 uppercase tracking-widest">
                                <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> {t('finalCta.badge1')}</span>
                                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> {t('finalCta.badge2')}</span>
                                <span className="flex items-center gap-2"><Check className="w-4 h-4" /> {t('finalCta.badge3')}</span>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Premium Footer */}
            <footer className="py-20 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12">
                        <div className="flex flex-col items-center md:items-start gap-6">
                            <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-32 " />
                            <p className="text-slate-500 font-medium max-w-xs text-center md:text-left">
                                {t('footer.tagline')}
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-slate-500">
                            <a href="/pt-BR/termos" className="hover:text-blue-600 transition-colors uppercase tracking-wider">{t('footer.terms')}</a>
                            <a href="/pt-BR/privacidade" className="hover:text-blue-600 transition-colors uppercase tracking-wider">{t('footer.privacy')}</a>
                            <a href="/pt-BR/lgpd" className="hover:text-blue-600 transition-colors uppercase tracking-wider">{t('footer.lgpd')}</a>
                        </div>

                        <div className="text-slate-400 text-sm font-medium">
                            {t('footer.copyright')}
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
