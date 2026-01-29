"use client"

import { useState, useEffect, useRef } from "react"
import { motion, useInView } from "framer-motion"
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
} from "lucide-react"
import DashboardPreview from "@/components/dashboard-preview"
import DemoPage from "@/components/demo-page"
import { PRODUCTS } from "@/lib/products"
import Image from "next/image"
import { useTranslations } from 'next-intl'
import LanguageToggle from "@/components/language-toggle"

interface LandingPageProps {
    onLoginClick: () => void
    onSignupClick: () => void
}

const ScrollAnimatedSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, amount: 0.2 })

    return (
        <motion.section
            ref={ref}
            initial={{ opacity: 0, y: 50 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.section>
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
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            variants={containerVariants}
            className={`grid gap-8 ${gridClassName}`}
        >
            {children.map((child, idx) => (
                <motion.div key={idx} variants={itemVariants}>
                    {child}
                </motion.div>
            ))}
        </motion.div>
    )
}

export default function LandingPage({ onLoginClick, onSignupClick }: LandingPageProps) {
    const [showDemo, setShowDemo] = useState(false)
    const t = useTranslations('landing')
    const tPricing = useTranslations('landing.pricing')
    const tProducts = useTranslations('products')

    const plans = PRODUCTS.map((product) => {
        const featuresObject = tProducts.raw(`${product.planType}.features`) as Record<string, string>;
        const features = Object.values(featuresObject);

        return {
            id: product.planType,
            name: tProducts(`${product.planType}.name`),
            price: `R$ ${(product.priceInCents / 100).toFixed(0)}`,
            period: product.billingCycle === "monthly" ? tPricing('perMonth') : tPricing('oneTime'),
            description: tProducts(`${product.planType}.description`),
            features: features,
            priceInCents: product.priceInCents,
            billingCycle: product.billingCycle
        }
    })

    useEffect(() => {
        if (typeof window !== "undefined") {
            let ultimaPosicao = 0
            window.addEventListener("scroll", () => {
                const nav: any = document.querySelector("#nav")
                const atualPosicao = window.scrollY

                if (atualPosicao > ultimaPosicao && atualPosicao > 0) {
                    nav.style.transform = "translateY(-100%)"
                } else {
                    nav.style.transform = "translateY(0%)"
                }
                if (atualPosicao < 80) {
                    nav.style.transform = "translateY(0%)"
                    nav.style.transition = "0.5s"
                }
                ultimaPosicao = atualPosicao
            })
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
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header
                id="nav"
                className="top-0 z-50 sticky border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <a href="#" aria-label="ViraWeb - Início">
                            <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-40" />
                        </a>
                    </div>
                    <div className="flex gap-3 items-center">
                        <LanguageToggle variant="compact" />
                        <Button variant="ghost" onClick={onLoginClick} className="text-foreground hover:bg-muted">
                            {t('header.login')}
                        </Button>
                        <Button
                            onClick={onSignupClick}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
                        >
                            {t('header.start')}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative overflow-hidden py-20 sm:py-32">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-secondary/10 pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                        <motion.div className="inline-block mb-6 px-4 py-2 bg-secondary/20 rounded-full border-2 border-secondary" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-primary" />
                                {t('hero.badge')}
                            </p>
                        </motion.div>

                        <motion.h1 className="text-5xl font-bold text-foreground mb-6 text-balance leading-tight" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                            {t('hero.title')} <span className="text-primary">{t('hero.titleHighlight')}</span>
                        </motion.h1>

                        <motion.p className="text-md text-muted-foreground mb-8 max-w-2xl mx-auto text-balance leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}>
                            {t('hero.description')}
                        </motion.p>

                        <motion.div className="flex gap-4 justify-center flex-wrap" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
                            <Button
                                size="lg"
                                onClick={onSignupClick}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg group"
                            >
                                {t('hero.startNow')}
                                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                onClick={() => setShowDemo(true)}
                                className="border-primary text-primary hover:bg-primary/10"
                            >
                                {t('hero.viewDemo')}
                            </Button>
                        </motion.div>
                    </motion.div>

                    <motion.div className="mt-16" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.5 }}>
                        <DashboardPreview />
                    </motion.div>
                </div>
            </section>

            {/* ViraBot AI Feature Section */}
            <section className="py-20 sm:py-32 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <ScrollAnimatedSection className="text-center mb-16">
                        <motion.div className="inline-block mb-6 px-6 py-3 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full border-2 border-primary/30" initial={{ scale: 0.95 }} whileInView={{ scale: 1 }} transition={{ duration: 0.5 }}>
                            <p className="text-sm font-bold text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-secondary" />
                                {t('virabot.badge')}
                            </p>
                        </motion.div>
                        <h3 className="text-4xl sm:text-5xl font-bold text-white mb-6 text-balance">
                            {t('virabot.title')}{" "}
                            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                {t('virabot.titleHighlight')}
                            </span>
                        </h3>
                        <p className="text-xl text-gray-300 max-w-3xl mx-auto text-balance leading-relaxed">
                            {t('virabot.description')}
                        </p>
                    </ScrollAnimatedSection>

                    <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
                        <motion.div className="relative" initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                            <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-slate-800 to-slate-900 p-8 shadow-2xl">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl" />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                                            <Brain className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white">ViraBot</h4>
                                            <p className="text-xs text-gray-400">Assistente IA</p>
                                        </div>
                                    </div>

                                    <motion.div className="space-y-4" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} viewport={{ once: true }}>
                                        <motion.div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-sm text-white">{t('virabot.question1')}</p>
                                        </motion.div>
                                        <motion.div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg p-4 border border-primary/30" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-sm text-white mb-2">
                                                {t('virabot.answer1', { count: 12 })}
                                            </p>
                                            <ul className="text-xs text-gray-300 space-y-1 ml-4">
                                                <li>• {t('virabot.confirmed', { count: 8 })}</li>
                                                <li>• {t('virabot.pending', { count: 3 })}</li>
                                                <li>• {t('virabot.cancelled', { count: 1 })}</li>
                                            </ul>
                                        </motion.div>
                                        <motion.div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-sm text-white">{t('virabot.question2')}</p>
                                        </motion.div>
                                        <motion.div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg p-4 border border-primary/30" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                                            <p className="text-sm text-white">{t('virabot.answer2')}</p>
                                        </motion.div>
                                    </motion.div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div className="space-y-6" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                            {virabotFeatures.map((feature, idx) => {
                                const Icon = feature.icon
                                return (
                                    <motion.div key={idx} className="flex gap-4 items-start" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: idx * 0.1 }} viewport={{ once: true }}>
                                        <div className={`w-12 h-12 rounded-xl bg-${feature.color}/20 flex items-center justify-center flex-shrink-0`}>
                                            <Icon className={`w-6 h-6 text-${feature.color}`} />
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-bold text-white mb-2">{feature.title}</h4>
                                            <p className="text-gray-300 leading-relaxed">{feature.desc}</p>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    </div>

                    <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                        <div className="inline-block p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-primary/30 backdrop-blur">
                            <p className="text-white mb-4 text-lg">
                                <strong>{t('virabot.titleHighlight')}</strong> {t('virabot.availability')} <span className="text-secondary">{t('virabot.premium')}</span> {t('virabot.and')}{" "}
                                <span className="text-secondary">{t('virabot.lifetime')}</span>
                            </p>
                            <Button
                                size="lg"
                                onClick={onSignupClick}
                                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                            >
                                {t('virabot.startWith')}
                                <Sparkles className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-20 sm:py-32 bg-muted/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <ScrollAnimatedSection className="text-center mb-16">
                        <h3 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">{t('features.title')}</h3>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {t('features.description')}
                        </p>
                    </ScrollAnimatedSection>

                    <StaggeredCards columns={3}>
                        {features.map((feature) => {
                            const Icon = feature.icon
                            return (
                                <Card key={feature.title} className="p-8 border-2 border-border hover:border-primary hover:shadow-xl transition-all duration-300 group bg-card">
                                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all">
                                        <Icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors" />
                                    </div>
                                    <h4 className="text-xl font-bold text-foreground mb-2">{feature.title}</h4>
                                    <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                                </Card>
                            )
                        })}
                    </StaggeredCards>
                </div>
            </section>

            {/* Pricing Section */}
            <section className="py-20 sm:py-32 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <ScrollAnimatedSection className="text-center mb-16">
                        <motion.div className="inline-block mb-4 px-4 py-2 bg-secondary/20 rounded-full border-2 border-secondary" initial={{ scale: 0.95 }} whileInView={{ scale: 1 }} transition={{ duration: 0.5 }}>
                            <p className="text-sm font-semibold text-foreground">{tPricing('badge')}</p>
                        </motion.div>
                        <h3 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">{tPricing('title')}</h3>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            {tPricing('description')}
                        </p>
                    </ScrollAnimatedSection>

                    <motion.div className="grid md:grid-cols-3 gap-8 mb-12" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } }} viewport={{ once: true }}>
                        {plans.map((plan) => (
                            <motion.div key={plan.id} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                                <Card
                                    className={`relative p-8 border-2 transition-all duration-300 hover:shadow-2xl ${plan.id === "premium"
                                        ? "border-secondary bg-gradient-to-br from-secondary/10 via-background to-primary/5 md:scale-105 shadow-xl"
                                        : "border-border hover:border-primary bg-card"
                                        }`}
                                >
                                    {plan.id === "premium" && (
                                        <motion.div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}>
                                            <Star className="w-4 h-4 fill-current" />
                                            {tPricing('popular')}
                                        </motion.div>
                                    )}

                                    <div className="mb-6">
                                        <h4 className="text-2xl font-bold text-foreground mb-2">{plan.name}</h4>
                                        <p className="text-muted-foreground text-sm leading-relaxed">{plan.description}</p>
                                    </div>

                                    <div className="mb-8">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-bold text-primary">
                                                {plan.price}
                                            </span>
                                            <div className="flex flex-col">
                                                <span className="text-sm text-muted-foreground">
                                                    {plan.period}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={onSignupClick}
                                        className={`w-full mb-8 h-12 text-base font-semibold transition-all ${plan.id === "premium"
                                            ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105"
                                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                                            }`}
                                    >
                                        {tPricing('choose')} {plan.name}
                                    </Button>

                                    <div className="space-y-4">
                                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                                            {tPricing('includedFeatures')}
                                        </div>
                                        {plan.features.map((feature, idx) => (
                                            <motion.div key={idx} className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} viewport={{ once: true }}>
                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <CheckCircle2 className="w-3 h-3 text-primary" />
                                                </div>
                                                <span className="text-sm text-foreground leading-relaxed">{feature}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>

                    <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
                        <Button
                            size="lg"
                            onClick={() => setShowDemo(true)}
                            variant="outline"
                            className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                            {tPricing('compareDetails')}
                        </Button>
                    </motion.div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 sm:py-32">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                            <h3 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">{t('benefits.title')}</h3>
                            <ul className="space-y-4">
                                {benefits.map((benefit, i) => (
                                    <motion.li key={i} className="flex items-start gap-3" initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.4 }} viewport={{ once: true }}>
                                        <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                                        <span className="text-foreground leading-relaxed">{benefit}</span>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                        <motion.div className="rounded-xl overflow-hidden border border-border shadow-xl bg-gradient-to-br from-primary/10 to-secondary/10 p-8" initial={{ opacity: 0, x: 30, scale: 0.95 }} whileInView={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                            <motion.div className="aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center" animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                                <Users className="w-24 h-24 text-primary/30" />
                            </motion.div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 sm:py-32 bg-primary text-primary-foreground relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
                <div className="absolute top-10 right-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
                <div className="absolute bottom-10 left-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />

                <motion.div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                    <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">{t('cta.title')}</h2>
                    <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto text-balance leading-relaxed">
                        {t('cta.description')}
                    </p>
                    <motion.div className="flex gap-4 justify-center flex-wrap" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} viewport={{ once: true }}>
                        <Button
                            size="lg"
                            onClick={onSignupClick}
                            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                        >
                            {t('cta.startNow')}
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={onLoginClick}
                            className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent"
                        >
                            {t('cta.haveAccount')}
                        </Button>
                    </motion.div>
                </motion.div>
            </section>

            {/* Footer */}
            <footer className="border-t border-border py-12 bg-muted/30">
                <motion.div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <a href="#" aria-label="ViraWeb - Início">
                                    <Image width={512} height={512} alt="ViraWeb logo" src="/viraweb3.png" className="w-40" />
                                </a>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t('footer.description')}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground mb-4">{t('footer.product')}</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.features')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.prices')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.security')}</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground mb-4">{t('footer.company')}</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.about')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.blog')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.contact')}</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-foreground mb-4">{t('footer.legal')}</h4>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.privacy')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.terms')}</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">{t('footer.lgpd')}</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
                        <p>{t('footer.copyright')}</p>
                    </div>
                </motion.div>
            </footer>
        </div>
    )
}
