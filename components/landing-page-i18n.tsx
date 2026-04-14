"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { m, useInView, LazyMotion, domMax } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
    Calendar,
    Users,
    BarChart3,
    CreditCard,
    Clock,
    Shield,
    Zap,
    ArrowRight,
    CheckCircle2,
    Sparkles,
    Star,
    Brain,
    MessageSquare,
    TrendingUp,
    Upload,
    FileJson,
    MousePointer2,
    Database,
    User,
    ZapOff,
    Mail,
    Target,
    UserCog,
    FileText,
    CheckSquare,
} from "lucide-react"
import { PRODUCTS } from "@/lib/products"
import Image from "next/image"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"

// Dynamic imports for heavy components
const DashboardPreview = dynamic(() => import("@/components/dashboard-preview"), {
    loading: () => <div className="h-[400px] w-full bg-slate-50 animate-pulse border border-slate-300" />,
    ssr: false
})
const DemoPage = dynamic(() => import("@/components/demo-page"), {
    ssr: false
})
const DemoDashboard = dynamic(() => import("@/components/demo-dashboard"), {
    loading: () => <div className="h-[600px] w-full bg-white animate-pulse" />,
    ssr: false
})

interface LandingPageProps {
    onLoginClick: () => void
    onSignupClick: () => void
}

const ScrollAnimatedSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, amount: 0.2 })

    return (
        <m.section
            ref={ref}
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={className}
        >
            {children}
        </m.section>
    )
}

const StaggeredCards = ({ children, columns = 3 }: { children: React.ReactNode[]; columns?: number }) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.2,
            },
        },
    }

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.5, ease: "easeOut" as const },
        },
    }

    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, amount: 0.15 })

    const gridClassName = columns === 3 ? "md:grid-cols-3" : columns === 2 ? "md:grid-cols-2" : "md:grid-cols-1"

    return (
        <m.div
            ref={ref}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
            className={`grid gap-8 ${gridClassName}`}
        >
            {children.map((child, idx) => (
                <m.div key={idx} variants={itemVariants}>
                    {child}
                </m.div>
            ))}
        </m.div>
    )
}

export default function LandingPage({ onLoginClick, onSignupClick }: LandingPageProps) {
    const [showDemo, setShowDemo] = useState(false)
    const demoRef = useRef<HTMLDivElement>(null)

    const t = useTranslations('landing')
    const tPricing = useTranslations('landing.pricing')
    const tProducts = useTranslations('products')
    const tTitles = useTranslations('titles')

    useEffect(() => {
        document.title = tTitles('landing')
    }, [tTitles])

    const plans = PRODUCTS.map((product) => {
        const featuresObject = tProducts.raw(`${product.planType}.features`) as Record<string, string>;
        const features = Object.values(featuresObject);

        return {
            id: product.planType,
            name: tProducts(`${product.planType}.name`),
            price: `${tPricing('currencySymbol')} ${(product.priceInCents / 100).toFixed(0)}`,
            period: product.billingCycle === "monthly" ? tPricing('perMonth') : tPricing('oneTime'),
            description: tProducts(`${product.planType}.description`),
            features: features,
            priceInCents: product.priceInCents,
            billingCycle: product.billingCycle
        }
    })

    const navRef = useRef<HTMLElement>(null)

    useEffect(() => {
        if (typeof window !== "undefined") {
            let ultimaPosicao = 0
            const handleScroll = () => {
                const nav = navRef.current
                if (!nav) return
                
                const atualPosicao = window.scrollY

                if (atualPosicao > ultimaPosicao && atualPosicao > 80) {
                    nav.style.transform = "translateY(-100%)"
                } else {
                    nav.style.transform = "translateY(0%)"
                }
                
                ultimaPosicao = atualPosicao
            }

            window.addEventListener("scroll", handleScroll, { passive: true })
            return () => window.removeEventListener("scroll", handleScroll)
        }
    }, [])

    if (showDemo) {
        return (
            <div>
                <DemoPage />
            </div>
        )
    }

    const features = [
        { icon: Calendar, title: t('features.appointments'), desc: t('features.appointmentsDesc') },
        { icon: Users, title: t('features.clients'), desc: t('features.clientsDesc') },
        { icon: BarChart3, title: t('features.reports'), desc: t('features.reportsDesc') },
        { icon: CreditCard, title: t('features.financial'), desc: t('features.financialDesc') },
        { icon: Clock, title: t('features.efficiency'), desc: t('features.efficiencyDesc') },
        { icon: Shield, title: t('features.security'), desc: t('features.securityDesc') },
        { icon: Zap, title: t('features.fast'), desc: t('features.fastDesc') },
    ]

    const virabotFeatures = [
        { icon: MessageSquare, color: "primary", title: t('virabot.feature1Title'), desc: t('virabot.feature1Desc') },
        { icon: Brain, color: "secondary", title: t('virabot.feature2Title'), desc: t('virabot.feature2Desc') },
        { icon: TrendingUp, color: "primary", title: t('virabot.feature3Title'), desc: t('virabot.feature3Desc') },
        { icon: Zap, color: "secondary", title: t('virabot.feature4Title'), desc: t('virabot.feature4Desc') },
    ]

    const benefits = [
        t('benefits.benefit1'),
        t('benefits.benefit2'),
        t('benefits.benefit3'),
        t('benefits.benefit4'),
        t('benefits.benefit5'),
        t('benefits.benefit6'),
    ]

    return (
        <LazyMotion features={domMax} strict>
            <div className="min-h-screen bg-white text-slate-900 selection:bg-primary/30 selection:text-primary">
            {/* Header */}
            <header
                ref={navRef}
                id="nav"
                className="top-0 z-50 sticky bg-white border-b border-slate-300 transition-all duration-300"
            >
                <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
                    <a href="#" aria-label="ViraWeb - Início" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <Image 
                            width={120} 
                            height={30} 
                            alt="ViraWeb logo" 
                            src="/viraweb3.png" 
                            className="w-24 object-contain" 
                            priority 
                            fetchPriority="high"
                            loading="eager"
                            decoding="sync"
                            sizes="(max-width: 768px) 96px, 120px"
                        />
                    </a>

                    <nav className="hidden md:flex items-center gap-6 text-[13px] font-bold text-slate-700 uppercase tracking-tight">
                        <a href="#features" className="hover:text-primary transition-colors">{t('footer.product')}</a>
                        <a href="#pricing" className="hover:text-primary transition-colors">{t('footer.prices')}</a>
                        <a href="#benefits" className="hover:text-primary transition-colors">{t('footer.contact')}</a>
                    </nav>

                    <div className="flex items-center gap-3">
                        <LanguageToggle variant="compact" />
                        <button onClick={onLoginClick} className="text-[13px] font-bold text-slate-700 hover:text-primary transition-colors hidden sm:block">
                            {t('header.login')}
                        </button>
                        <button
                            onClick={onSignupClick}
                            className="text-[13px] font-bold bg-primary text-white hover:bg-primary/90 transition-all px-4 py-2 rounded-none shadow-sm border border-primary"
                        >
                            {t('header.start')}
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section - Image 2 Design */}
            <section className="relative pt-20 sm:pt-28 pb-20 overflow-x-clip flex flex-col">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

                {/* Floating V Logos Background - Image 3 & 4 style */}
                <m.div
                    className="absolute top-10 left-[5%] opacity-[0.03] select-none pointer-events-none"
                    animate={{ y: [-20, 20, -20], rotate: [0, 5, 0] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Image 
                        src="/viraweb6.png" 
                        alt="ViraWeb Background Pattern" 
                        width={400} 
                        height={400} 
                        className="w-[300px] md:w-[600px] h-auto grayscale saturate-0" 
                        priority
                        sizes="(max-width: 768px) 300px, 600px"
                    />
                </m.div>
                <m.div
                    className="absolute bottom-40 right-[0%] opacity-[0.03] select-none pointer-events-none"
                    animate={{ y: [20, -20, 20], rotate: [0, -5, 0] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Image src="/viraweb6.png" alt="ViraWeb BG" width={500} height={500} className="w-[400px] md:w-[800px] h-auto grayscale saturate-0" priority />
                </m.div>

                <div className="max-w-[1200px] mx-auto w-full px-4 relative z-10 flex flex-col items-start mb-8">
                    {/* Badge / Top Line */}
                    <m.div
                        className="inline-flex items-center gap-3 mb-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <span className="w-8 h-[2px] bg-primary" />
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            {t('hero.badge')}
                        </span>
                    </m.div>

                    {/* Title */}
                    <h1
                        className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4 text-left leading-tight max-w-3xl"
                    >
                        {t('hero.title')}{" "}
                        <span className="text-primary">
                            {t('hero.titleHighlight')}
                        </span>
                    </h1>

                    {/* Subtitle */}
                    <p
                        className="text-[15px] sm:text-[16px] text-slate-700 mb-8 max-w-xl text-left leading-relaxed font-normal"
                    >
                        {t('hero.description')}
                    </p>

                    {/* CTAs */}
                    <m.div
                        className="flex flex-col sm:flex-row items-center gap-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                    >
                        <button
                            onClick={onSignupClick}
                            className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-6 py-3 rounded-none shadow-sm hover:bg-slate-800 transition-all text-[14px] w-full sm:w-auto border border-slate-900"
                        >
                            {t('hero.startNow')} <ArrowRight className="w-4 h-4" />
                        </button>
                    </m.div>

                </div>

                {/* Interactive Demo Container */}
                <div className="h-[200vh] w-full relative">
                    <m.div
                        ref={demoRef}
                        className="relative mx-auto w-full max-w-[1200px] px-4 mt-6 sticky top-24 z-30"
                        initial={{ opacity: 1, y: 0 }}
                    >
                    <div className="rounded-none border border-slate-300 bg-white shadow-sm overflow-hidden relative z-20">
                        {/* Title bar */}
                        <div className="flex px-3 py-2 items-center border-b border-slate-200 bg-slate-100">
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-none bg-slate-300 border border-slate-400" />
                                <div className="w-2.5 h-2.5 rounded-none bg-slate-300 border border-slate-400" />
                                <div className="w-2.5 h-2.5 rounded-none bg-slate-300 border border-slate-400" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="flex items-center gap-2 bg-white px-6 py-1 rounded-none border border-slate-300 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                                    app.viraweb.com
                                </div>
                            </div>
                        </div>

                        {/* Full Interactive Demo Content */}
                        <div className="relative text-left bg-white h-[600px] overflow-hidden flex flex-col group">
                            <DemoDashboard />
                        </div>
                    </div>
                </m.div>
            </div>

                    {/* Bottom fade for depth effect */}
                    <div className="absolute -inset-x-20 top-2/3 -bottom-40 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent z-30 pointer-events-none" />

            </section>

            {/* ViraBot AI Feature Section */}
            <section className="py-16 sm:py-20 relative bg-slate-100 border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <ScrollAnimatedSection className="text-center mb-12">
                        <div className="inline-block mb-4 px-3 py-1 bg-white border border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            {t('virabot.badge')}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                            {t('virabot.title')}{" "}
                            <span className="text-primary">
                                {t('virabot.titleHighlight')}
                            </span>
                        </h2>
                        <p className="text-[15px] text-slate-700 max-w-2xl mx-auto leading-relaxed">
                            {t('virabot.description')}
                        </p>
                    </ScrollAnimatedSection>

                    <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
                        <m.div className="relative" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                            <div className="relative rounded-none border border-slate-300 bg-white p-6 shadow-sm">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 rounded-none bg-slate-50 flex items-center justify-center border border-slate-300 shadow-sm">
                                            <Brain className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-slate-900 uppercase tracking-tight">ViraBot</h4>
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t('virabot.badge')}</p>
                                        </div>
                                    </div>

                                    <m.div className="space-y-3" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} viewport={{ once: true }}>
                                        <m.div className="bg-slate-50 rounded-none p-3 border border-slate-200" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-[13px] font-bold text-slate-700">{t('virabot.question1')}</p>
                                        </m.div>
                                        <m.div className="bg-white rounded-none p-3 border border-slate-300 shadow-sm ml-6" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-[13px] font-medium text-slate-700 mb-3">
                                                {t('virabot.answer1', { count: 12 })}
                                            </p>
                                            <ul className="text-[12px] text-slate-600 space-y-2 font-bold uppercase tracking-tight">
                                                <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-none bg-green-500" /> {t('virabot.confirmed', { count: 8 })}</li>
                                                <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-none bg-yellow-500" /> {t('virabot.pending', { count: 3 })}</li>
                                                <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-none bg-red-500" /> {t('virabot.cancelled', { count: 1 })}</li>
                                            </ul>
                                        </m.div>
                                    </m.div>
                                </div>
                            </div>
                        </m.div>

                        <m.div className="space-y-6" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                            {virabotFeatures.map((feature, idx) => {
                                const Icon = feature.icon
                                return (
                                    <m.div key={idx} className="flex gap-4 items-start" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.1 }} viewport={{ once: true }}>
                                        <div className="w-12 h-12 rounded-none bg-white flex items-center justify-center flex-shrink-0 border border-slate-300 shadow-sm">
                                            <Icon className="w-5 h-5 text-primary" strokeWidth={2} />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-slate-900 mb-1 uppercase tracking-tight">{feature.title}</h4>
                                            <p className="text-[13px] text-slate-600 leading-relaxed max-w-md">{feature.desc}</p>
                                        </div>
                                    </m.div>
                                )
                            })}
                        </m.div>
                    </div>

                    <m.div className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                        <div className="inline-block p-6 rounded-none bg-white shadow-sm border border-slate-300 max-w-2xl mx-auto w-full">
                            <p className="text-slate-700 mb-4 text-[14px] font-bold uppercase tracking-tight">
                                {t('virabot.availability')} <span className="text-primary font-black">{t('virabot.premium')}</span> {t('virabot.and')}{" "}
                                <span className="text-primary font-black">{t('virabot.lifetime')}</span>
                            </p>
                            <button
                                onClick={onSignupClick}
                                className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-6 py-3 rounded-none shadow-sm hover:bg-slate-800 transition-all text-[14px] w-full sm:w-auto border border-slate-900"
                            >
                                {t('hero.startNow')}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </m.div>
                </div>
            </section>
            {/* Smart Import Section - Cleaned Up */}
            <section className="py-16 sm:py-20 relative bg-white border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <ScrollAnimatedSection>
                            <div className="inline-block mb-4 px-3 py-1 bg-slate-100 border border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                {t('import.badge')}
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                                {t('import.title')} <br />
                                <span className="text-primary italic font-bold">{t('import.titleHighlight')}</span>
                            </h2>
                            <p className="text-[15px] text-slate-700 leading-relaxed">
                                {t('import.description')}
                            </p>
                        </ScrollAnimatedSection>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-12 md:gap-16 items-center mb-12">
                        <m.div
                            className="space-y-8"
                            initial={{ opacity: 0, x: -30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-8">
                                {[
                                    {
                                        icon: Clock,
                                        title: t('import.benefit1'),
                                        desc: t('import.benefit1Desc')
                                    },
                                    {
                                        icon: Sparkles,
                                        title: t('import.benefit2'),
                                        desc: t('import.benefit2Desc')
                                    },
                                    {
                                        icon: ZapOff,
                                        title: t('import.benefit3'),
                                        desc: t('import.benefit3Desc')
                                    },
                                    {
                                        icon: Zap,
                                        title: t('import.benefit4'),
                                        desc: t('import.benefit4Desc')
                                    }
                                ].map((benefit, i) => (
                                    <div key={i} className="group">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-none bg-slate-50 flex items-center justify-center border border-slate-300 shadow-sm">
                                                <benefit.icon className="w-5 h-5 text-primary" strokeWidth={2} />
                                            </div>
                                            <h4 className="font-bold text-[15px] text-slate-900 uppercase tracking-tight">{benefit.title}</h4>
                                        </div>
                                        <p className="text-[13px] text-slate-600 leading-relaxed">{benefit.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </m.div>

                        <m.div
                            className="relative"
                            initial={{ opacity: 0, x: 30 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <div className="relative z-10 rounded-none overflow-hidden shadow-sm bg-white border border-slate-300">
                                <div className="bg-slate-100 border-b border-slate-300 p-3 flex items-center justify-between">
                                    <div className="flex gap-1">
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400" />
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400" />
                                        <div className="w-2.5 h-2.5 rounded-none bg-slate-400" />
                                    </div>
                                    <div className="px-2 py-0.5 bg-white border border-slate-300 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                                        vira.web/dashboard/import
                                    </div>
                                    <div className="w-6" />
                                </div>
                                <div className="p-4 space-y-3 bg-white relative">
                                    <div className="flex items-center gap-3 p-3 border border-primary border-dashed bg-slate-50">
                                        <div className="w-10 h-10 rounded-none bg-white shadow-sm flex items-center justify-center border border-slate-200">
                                            <Upload className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-[13px] text-slate-900 uppercase tracking-tight">{t('import.fileName')}</p>
                                            <p className="text-[11px] font-medium text-slate-500">{t('import.extracting')}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {[
                                            { n: "Ana Oliveira", v: "R$ 450,00" },
                                            { n: "Bruno Silva", v: "R$ 1.200,00" },
                                            { n: "Carla Souza", v: "R$ 890,00" }
                                        ].map((item, i) => (
                                            <m.div
                                                key={i}
                                                className="flex items-center justify-between gap-3 p-2 bg-white border border-slate-200"
                                                initial={{ opacity: 0, y: 5 }}
                                                whileInView={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.4 + (i * 0.1) }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-none bg-slate-100 flex items-center justify-center border border-slate-200">
                                                        <User className="w-3 h-3 text-slate-400" />
                                                    </div>
                                                    <p className="text-[12px] font-bold text-slate-900 tracking-tight">{item.n}</p>
                                                </div>
                                                <div className="text-[11px] font-black text-primary px-2 py-0.5 bg-slate-50 border border-slate-100">
                                                    {item.v}
                                                </div>
                                            </m.div>
                                        ))}
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2">
                                        <div className="h-8 w-20 bg-slate-100 border border-slate-200" />
                                        <div className="h-8 px-3 bg-primary flex items-center justify-center text-[11px] font-bold text-white shadow-sm border border-primary uppercase tracking-wider">
                                            {t('import.cta')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </m.div>
                    </div>


                    <div className="mt-28 grid sm:grid-cols-3 gap-8 text-center border-t border-slate-200 pt-16">
                        {[
                            { label: t('import.formats'), value: t('import.formatsVal') },
                            { label: t('import.time'), value: t('import.timeVal') },
                            { label: t('import.privacy'), value: t('import.privacyVal') }
                        ].map((stat, i) => (
                            <div key={i}>
                                <p className="text-sm text-slate-500 mb-2 font-medium">{stat.label}</p>
                                <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-12 sm:py-16 bg-slate-50 border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4">
                    <ScrollAnimatedSection className="text-center mb-12">
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight uppercase">{t('motor.title')}</h2>
                        <p className="text-[15px] text-slate-700 max-w-4xl mx-auto leading-relaxed">
                            {t('motor.description')} <strong className="text-primary">{t('motor.description2')}</strong>
                        </p>
                    </ScrollAnimatedSection>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {[
                            { icon: Users, title: t('motor.feature1'), desc: t('motor.feature1Desc') },
                            { icon: CreditCard, title: t('motor.feature2'), desc: t('motor.feature2Desc') },
                            { icon: BarChart3, title: t('motor.feature3'), desc: t('motor.feature3Desc') },
                            { icon: Upload, title: t('motor.feature4'), desc: t('motor.feature4Desc') },
                            { icon: Sparkles, title: t('motor.feature5'), desc: t('motor.feature5Desc') },
                            { icon: UserCog, title: t('motor.feature6'), desc: t('motor.feature6Desc') },
                            { icon: Target, title: t('motor.feature7'), desc: t('motor.feature7Desc') },
                            { icon: FileText, title: t('motor.feature8'), desc: t('motor.feature8Desc') },
                            { icon: CheckSquare, title: t('motor.feature9'), desc: t('motor.feature9Desc') }
                        ].map((feature, idx) => {
                            const Icon = feature.icon
                            return (
                                <div key={feature.title} className="p-6 bg-white border border-slate-300 shadow-sm rounded-none">
                                    <div className="w-10 h-10 bg-slate-50 rounded-none flex items-center justify-center mb-6 text-primary border border-slate-200 shadow-sm">
                                        <Icon className="w-5 h-5" strokeWidth={2} />
                                    </div>
                                    <h4 className="text-[16px] font-bold text-slate-900 mb-3 uppercase tracking-tight">{feature.title}</h4>
                                    <p className="text-slate-600 leading-relaxed text-[13px]">{feature.desc}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-16 sm:py-20 relative bg-white border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <ScrollAnimatedSection className="text-center mb-12">
                        <div className="inline-block mb-4 px-3 py-1 bg-slate-100 border border-slate-300 text-[11px] font-bold tracking-wider text-slate-700 uppercase">
                            {tPricing('badge')}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight uppercase">{tPricing('title')}</h2>
                        <p className="text-lg text-slate-700 max-w-2xl mx-auto leading-relaxed">
                            {tPricing('description')}
                        </p>
                    </ScrollAnimatedSection>

                    <m.div className="grid md:grid-cols-3 gap-6 mb-12" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} viewport={{ once: true }}>
                        {plans.map((plan) => (
                            <m.div key={plan.id} variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } }}>
                                <div
                                    className={`relative p-8 border bg-white ${plan.id === "premium"
                                        ? "border-primary shadow-md border-2"
                                        : "border-slate-300 shadow-sm"
                                        }`}
                                >
                                    {plan.id === "premium" && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-0.5 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                                            {tPricing('popular')}
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <h4 className="text-xl font-bold text-slate-900 mb-2 uppercase tracking-tight">{plan.name}</h4>
                                        <p className="text-slate-600 font-medium text-[13px] leading-relaxed">{plan.description}</p>
                                    </div>

                                    <div className="mb-8">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-4xl font-bold text-slate-900 tracking-tight">
                                                {plan.price}
                                            </span>
                                            <span className="text-[13px] font-bold text-slate-400 uppercase">
                                                / {plan.period}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={onSignupClick}
                                        className={`w-full mb-8 h-12 text-[13px] font-bold transition-all flex items-center justify-center uppercase tracking-wider ${plan.id === "premium"
                                            ? "bg-primary text-white hover:bg-blue-600 border border-primary shadow-sm"
                                            : "bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-300 shadow-sm"
                                            }`}
                                    >
                                        {tPricing('choose')}
                                    </button>

                                    <div className="space-y-3">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                                            {tPricing('includedFeatures')}
                                        </div>
                                        {plan.features.slice(0, 6).map((feature, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-1 shrink-0" strokeWidth={3} />
                                                <span className="text-[13px] text-slate-600 font-bold leading-snug">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </m.div>
                        ))}
                    </m.div>

                    <m.div className="text-center" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                        <button
                            onClick={() => setShowDemo(true)}
                            className="border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 h-12 px-8 rounded-none shadow-sm bg-white uppercase text-[12px] tracking-widest transition-all"
                        >
                            {tPricing('compareDetails')}
                        </button>
                    </m.div>
                </div>
            </section>

            {/* Discord Community Section - 2015 Style */}
            <section className="py-20 bg-slate-50 border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="bg-white border border-slate-300 p-8 sm:p-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-24 relative overflow-hidden">
                        <div className="flex-1 text-center lg:text-left relative z-10">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-900 mb-6 font-bold text-[10px] tracking-[0.2em] uppercase text-white shadow-sm">
                                <Users className="w-3 h-3" />
                                {t('discord.badge')}
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-6 tracking-tight leading-tight uppercase">
                                {t('discord.title')} <br />
                                <span className="text-primary">{t('discord.titleHighlight')}</span>
                            </h2>
                            <p className="text-[15px] text-slate-600 mb-10 font-medium leading-relaxed max-w-xl mx-auto lg:mx-0">
                                {t('discord.description')}
                            </p>
                            <button 
                                onClick={() => window.open('https://discord.gg/2NceQ7vJr2', '_blank')}
                                className="bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold h-14 px-10 rounded-none shadow-sm transition-all text-sm gap-3 w-full sm:w-auto uppercase tracking-widest border border-[#4752c4]"
                            >
                                {t('discord.cta')} ↗
                            </button>
                        </div>

                        <div className="flex-1 relative w-full lg:w-auto">
                            <div className="relative z-10 p-6 sm:p-8 bg-slate-900 rounded-none border border-slate-800 shadow-xl max-w-sm mx-auto">
                                <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                                    <div className="w-3 h-3 rounded-none bg-red-500" />
                                    <div className="w-3 h-3 rounded-none bg-yellow-500" />
                                    <div className="w-3 h-3 rounded-none bg-green-500" />
                                    <div className="ml-auto px-3 py-1 bg-slate-800 border border-slate-700 text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">VWD Networking</div>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-none bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">V</div>
                                        <div className="space-y-2 pt-1 w-full opacity-30">
                                            <div className="h-2 w-24 bg-slate-600" />
                                            <div className="h-3 w-full bg-slate-600" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-none bg-emerald-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">A</div>
                                        <div className="space-y-2 pt-1 w-full">
                                            <div className="h-2 w-20 bg-slate-600 opacity-30" />
                                            <div className="h-8 w-full bg-white/5 border border-white/10 flex items-center px-4">
                                                <div className="h-1.5 w-full bg-primary opacity-50" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Contact Section - 2015 Style */}
            <section id="contato" className="py-20 bg-white border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4 relative z-10">
                    <ScrollAnimatedSection className="text-center mb-16">
                        <div className="inline-block mb-4 px-3 py-1 bg-slate-100 border border-slate-300 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            {t('footer.contact')}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4 tracking-tight uppercase">
                            {t('contactTalk.title')} <span className="text-primary">{t('contactTalk.titleHighlight')}</span>
                        </h2>
                        <p className="text-[15px] text-slate-700 mb-8 max-w-2xl mx-auto">
                            {t('contactTalk.description')}
                        </p>
                    </ScrollAnimatedSection>

                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} viewport={{ once: true }}>
                            <div className="flex flex-col items-center text-center gap-4 bg-slate-50 p-8 border border-slate-300 shadow-sm rounded-none">
                                <div className="mt-2 flex flex-col items-center flex-1 w-full">
                                    <h4 className="font-bold text-slate-900 text-lg mb-2 uppercase tracking-tight">{t('contactTalk.whatsappTitle')}</h4>
                                    <p className="text-slate-600 text-[13px] mb-6 max-w-[280px]">{t('contactTalk.whatsappDesc')}</p>
                                    <div className="mt-auto w-full">
                                        <button onClick={() => window.open('https://wa.me/5562992466109', '_blank')} className="bg-green-600 hover:bg-green-700 text-white font-bold h-12 px-6 rounded-none shadow-sm w-full text-[14px] border border-green-700 transition-all uppercase tracking-wider">
                                            (62) 9 9246-6109
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </m.div>

                        <m.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} viewport={{ once: true }}>
                            <div className="flex flex-col items-center text-center gap-4 bg-slate-50 p-8 border border-slate-300 shadow-sm rounded-none">
                                <div className="mt-2 flex flex-col items-center flex-1 w-full">
                                    <h4 className="font-bold text-slate-900 text-lg mb-2 uppercase tracking-tight">{t('contactTalk.emailTitle')}</h4>
                                    <p className="text-slate-600 text-[13px] mb-6 max-w-[280px]">{t('contactTalk.emailDesc')}</p>
                                    <div className="mt-auto w-full">
                                        <button onClick={() => window.open('mailto:suporte@viraweb.online', '_blank')} className="border-slate-300 hover:bg-white text-slate-900 bg-white font-bold h-12 px-6 rounded-none shadow-sm w-full text-[14px] transition-all uppercase tracking-wider">
                                            suporte@viraweb.online
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </m.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-slate-900 text-white relative border-t border-slate-800">
                <m.div className="max-w-4xl mx-auto px-4 text-center relative z-10" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight uppercase">{t('cta.title')}</h2>
                    <p className="text-[15px] mb-8 max-w-2xl mx-auto opacity-70 leading-relaxed font-bold">
                        {t('cta.description')}
                    </p>
                    <div className="flex gap-3 justify-center flex-wrap">
                        <button
                            onClick={onSignupClick}
                            className="bg-primary text-white hover:bg-blue-600 shadow-sm h-12 px-8 text-[14px] font-bold rounded-none border border-primary uppercase tracking-widest transition-all"
                        >
                            {t('cta.startNow')}
                        </button>
                        <button
                            onClick={onLoginClick}
                            className="border border-slate-700 text-white hover:bg-slate-800 bg-transparent shadow-sm h-12 px-8 text-[14px] font-bold rounded-none uppercase tracking-widest transition-all"
                        >
                            {t('cta.haveAccount')}
                        </button>
                    </div>
                </m.div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-white text-slate-500 border-t border-slate-300">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <div className="mb-6 opacity-30 grayscale">
                        <Image src="/viraweb3.png" alt="ViraWeb" width={100} height={30} className="mx-auto object-contain" />
                    </div>
                    <div className="flex flex-wrap justify-center gap-8 mb-8 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">
                        <a href="/termos" className="hover:text-primary transition-colors">Terms</a>
                        <a href="/privacidade" className="hover:text-primary transition-colors">Privacy</a>
                        <a href="/lgpd" className="hover:text-primary transition-colors">LGPD</a>
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
                        © 2026 ViraWeb Tecnologias. All Rights Reserved.
                    </p>
                </div>
            </footer>
        </div>
        </LazyMotion>
    )
}
