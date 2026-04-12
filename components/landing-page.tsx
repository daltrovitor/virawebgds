"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { motion, useInView, LazyMotion, domMax } from "framer-motion"
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
  ArrowLeft,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { PRODUCTS } from "@/lib/products"
import Image from "next/image"

// Dynamic imports for heavy components
const DashboardPreview = dynamic(() => import("@/components/dashboard-preview"), {
  loading: () => <div className="h-[400px] w-full bg-slate-900/50 animate-pulse rounded-xl" />,
  ssr: false
})
const DemoPage = dynamic(() => import("@/components/demo-page"), {
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
      transition: { duration: 0.5 },
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

const FadeInText = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}

export default function LandingPage({ onLoginClick, onSignupClick }: LandingPageProps) {
  const [showDemo, setShowDemo] = useState(false)

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

  return (
    <LazyMotion features={domMax} strict>
      <div className="dark min-h-screen bg-[#000000] text-[#F7F8F8] selection:bg-primary/30 font-sans selection:text-white">
      {/* Header */}
      <header
        ref={navRef}
        id="nav"
        className="top-0 z-50 sticky bg-[#000000]/80 backdrop-blur-md border-b border-white/5 transition-all duration-300"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <a href="#" aria-label="ViraWeb - Início" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Image width={32} height={32} alt="ViraWeb icon" src="/favicon.png" className="w-[22px] h-[22px]" priority />
              <Image width={140} height={40} alt="ViraWeb logo" src="/viraweb3.png" className="h-[18px] w-auto object-contain brightness-0 invert" priority />
            </a>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#8A8F98]">
            <a href="#" className="hover:text-white transition-colors">Produto</a>
            <a href="#" className="hover:text-white transition-colors">Recursos</a>
            <a href="#" className="hover:text-white transition-colors">Clientes</a>
            <a href="#" className="hover:text-white transition-colors">Preços</a>
          </nav>

          <div className="flex items-center gap-5">
            <button onClick={onLoginClick} className="text-[13px] font-medium text-[#8A8F98] hover:text-white transition-colors hidden sm:block">
              Log in
            </button>
            <button
              onClick={onSignupClick}
              className="text-[13px] font-semibold bg-white text-black hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-[4px] shadow-sm"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden flex flex-col items-center">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none opacity-40 mix-blend-screen" />

        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center flex flex-col items-center">
          <motion.h1
            className="text-5xl sm:text-6xl md:text-[84px] font-medium tracking-tight text-[#F7F8F8] mb-6 text-balance leading-[1.05]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            O sistema de gestão <br className="hidden md:block" /> definitivo para equipes
          </motion.h1>

          <motion.p
            className="text-[21px] text-[#8A8F98] mb-12 max-w-[700px] text-balance tracking-wide font-normal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            Criado para planejar e escalar negócios de agendamento. Desenhado para a era da inteligência artificial.
          </motion.p>

          <motion.div
            className="flex items-center gap-6 mb-24"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => setShowDemo(true)}
              className="group flex items-center gap-2 text-[14px] font-medium text-[#8A8F98] hover:text-[#F7F8F8] transition-colors"
            >
              <span className="text-[#F7F8F8] mr-1">New</span>
              Importação Inteligente (Beta)
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform ml-1" />
            </button>
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto w-full max-w-[1200px] px-8"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Window Frame Mockup / Interactive Demo container */}
          <div className="rounded-xl border border-white/10 bg-[#0A0A0A] shadow-2xl overflow-hidden ring-1 ring-white/5 relative z-20">
            <div className="flex px-4 py-3 items-center border-b border-white/[0.05] bg-[#141414]">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50" />
                <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50" />
                <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-2 bg-[#0A0A0A] px-24 py-1.5 rounded-md border border-white/5 shadow-inner">
                  <Sparkles className="w-3 h-3 text-[#5E6AD2]" />
                  <span className="text-[11px] text-[#8A8F98] font-medium tracking-wide">app.viraweb.com</span>
                </div>
              </div>
            </div>

            {/* The actual interactive preview */}
            <div className="relative bg-background text-foreground text-left p-0.5">
              <DashboardPreview />
            </div>
          </div>

          {/* Base fade for realistic mockup depth mapping Linear's style */}
          <div className="absolute -inset-x-20 top-2/3 -bottom-40 bg-gradient-to-t from-[#000000] via-[#000000]/80 to-transparent z-30 pointer-events-none" />
        </motion.div>
      </section>

      {/* ViraBot AI Feature Section */}
      <section className="py-20 sm:py-32 relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Animated background */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollAnimatedSection className="text-center mb-16">
            <motion.div className="inline-block mb-6 px-6 py-3 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full border-2 border-primary/30" initial={{ scale: 0.95 }} whileInView={{ scale: 1 }} transition={{ duration: 0.5 }}>
              <p className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                Powered by AI
              </p>
            </motion.div>
            <h3 className="text-4xl sm:text-5xl font-bold text-white mb-6 text-balance">
              Conheça o{" "}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                ViraBot IA
              </span>
            </h3>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto text-balance leading-relaxed">
              Seu assistente inteligente que revoluciona a gestão do seu negócio com inteligência artificial de última
              geração
            </p>
          </ScrollAnimatedSection>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            {/* Left: AI Visual */}
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

                  {/* Chat simulation */}
                  <motion.div className="space-y-4" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} viewport={{ once: true }}>
                    <motion.div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                      <p className="text-sm text-white">Quantos agendamentos tenho hoje?</p>
                    </motion.div>
                    <motion.div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg p-4 border border-primary/30" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                      <p className="text-sm text-white mb-2">
                        Você tem <strong>12 agendamentos</strong> hoje:
                      </p>
                      <ul className="text-xs text-gray-300 space-y-1 ml-4">
                        <li>• 8 consultas confirmadas</li>
                        <li>• 3 aguardando confirmação</li>
                        <li>• 1 cancelamento</li>
                      </ul>
                    </motion.div>
                    <motion.div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                      <p className="text-sm text-white">Como posso melhorar a taxa de ocupação?</p>
                    </motion.div>
                    <motion.div className="bg-gradient-to-r from-primary/20 to-secondary/20 rounded-lg p-4 border border-primary/30" variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
                      <p className="text-sm text-white">Baseado nos seus dados, sugiro...</p>
                    </motion.div>
                  </motion.div>
                </div>
              </div>
            </motion.div>

            {/* Right: Features */}
            <motion.div className="space-y-6" initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
              {[
                {
                  icon: MessageSquare,
                  color: "primary",
                  title: "Conversas Naturais",
                  desc: "Converse naturalmente com o ViraBot como se fosse um assistente humano. Faça perguntas sobre seu negócio e receba respostas instantâneas."
                },
                {
                  icon: Brain,
                  color: "secondary",
                  title: "Análise Inteligente",
                  desc: "O ViraBot analisa seus dados e identifica padrões, tendências e oportunidades de melhoria para seu negócio."
                },
                {
                  icon: TrendingUp,
                  color: "primary",
                  title: "Insights Acionáveis",
                  desc: "Receba sugestões práticas e personalizadas para otimizar processos, aumentar eficiência e melhorar resultados."
                },
                {
                  icon: Zap,
                  color: "secondary",
                  title: "Automação Inteligente",
                  desc: "Automatize tarefas repetitivas e deixe o ViraBot cuidar do trabalho pesado enquanto você foca no atendimento."
                }
              ].map((feature, idx) => {
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

          {/* CTA */}
          <motion.div className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
            <div className="inline-block p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-2 border-primary/30 backdrop-blur">
              <p className="text-white mb-4 text-lg">
                ViraBot AI está disponível nos planos <span className="text-secondary">Premium</span> e{" "}
                <span className="text-secondary">Master</span>
              </p>
              <Button
                size="lg"
                onClick={onSignupClick}
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                Começar Agora
                <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Intelligent Import Section - NEW ULTRA SELLABLE SECTION */}
      <section className="py-24 sm:py-32 relative overflow-hidden bg-background">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-4"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Importação Instantânea
                </motion.div>
                <h3 className="text-4xl sm:text-5xl font-extrabold text-foreground leading-[1.1] mb-6">
                  Diga adeus à <span className="text-primary italic">digitação manual</span>
                </h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  Traga seus dados de planilhas, PDFs ou até fotos de agendas de papel. Nossa IA organiza tudo em segundos para você.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { title: "Zero Erros", desc: "A IA valida CPFs, emails e telefones automaticamente.", icon: Shield },
                  { title: "Economia de Tempo", desc: "Reduza 5 horas de trabalho manual para 15 segundos.", icon: Clock },
                  { title: "Versatilidade Total", desc: "Aceitamos CSV, PDF, Imagens e até texto colado.", icon: Upload },
                  { title: "Setup em 1 Clique", desc: "Seu dashboard populado e pronto para o uso imediato.", icon: Zap },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-colors group"
                  >
                    <item.icon className="w-6 h-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                    <h4 className="font-bold text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={() => setShowDemo(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xl shadow-primary/20 px-8 h-14 text-lg font-bold rounded-xl"
                >
                  Testar Importação Agora
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onSignupClick}
                  className="h-14 px-8 text-lg font-bold rounded-xl border-2"
                >
                  Ver como funciona
                </Button>
              </div>
            </motion.div>

            {/* Right: Visual Simulation */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, x: 30 }}
              whileInView={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Decorative background elements */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/20 rounded-full blur-3xl" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />

              <div className="relative rounded-3xl border border-secondary/30 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-slate-900 aspect-video lg:aspect-square flex flex-col">
                {/* Header Mockup */}
                <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="h-4 w-32 bg-slate-800 rounded-full" />
                  <div className="w-4 h-4 rounded bg-slate-800" />
                </div>

                <div className="flex-1 p-6 flex flex-col gap-6 relative overflow-hidden">
                  {/* Step 1: Upload box */}
                  <motion.div
                    animate={{
                      y: [0, -100],
                      opacity: [1, 0]
                    }}
                    transition={{ duration: 0.8, delay: 3, repeat: Infinity, repeatDelay: 5 }}
                    className="border-2 border-dashed border-slate-700 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 bg-slate-800/30"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-white font-bold">lista_clientes.pdf</p>
                      <p className="text-slate-500 text-xs text-balance">Solte seus arquivos aqui</p>
                    </div>
                  </motion.div>

                  {/* Step 2: Processing visual */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      scale: [0.9, 1, 1, 0.9],
                      y: [50, 0, 0, -50]
                    }}
                    transition={{ duration: 1.5, delay: 3.5, repeat: Infinity, repeatDelay: 4.3 }}
                    className="absolute inset-x-6 top-6 bottom-6 bg-slate-900/90 backdrop-blur rounded-2xl border border-primary/50 flex flex-col items-center justify-center p-8 z-20"
                  >
                    <div className="relative mb-6">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="w-24 h-24 rounded-full border-t-2 border-primary"
                      />
                      <Sparkles className="w-8 h-8 text-secondary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-white font-bold text-lg mb-2">IA Extraindo Dados...</p>
                    <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-full h-full bg-gradient-to-r from-primary to-secondary"
                      />
                    </div>
                  </motion.div>

                  {/* Step 3: Success preview grid */}
                  <motion.div
                    initial={{ opacity: 0, x: 100 }}
                    animate={{
                      opacity: [0, 0, 1, 1],
                      x: [100, 100, 0, 0],
                      y: [0, 0, 0, -100]
                    }}
                    transition={{ duration: 1, delay: 5, repeat: Infinity, repeatDelay: 4.8 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between text-white">
                      <p className="font-bold">Clientes Identificados (3)</p>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">98% Confiança</Badge>
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="bg-slate-800/50 p-3 rounded-lg flex items-center gap-3 border border-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2 w-24 bg-slate-600 rounded" />
                            <div className="h-1.5 w-32 bg-slate-700 rounded" />
                          </div>
                          <div className="h-2 w-12 bg-slate-700 rounded" />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* Floating Micro-data Cards */}
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                    x: [0, 5, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -right-6 top-1/4 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-2xl border border-border z-30 hidden sm:block"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Tempo Salvo</p>
                      <p className="text-xl font-black text-foreground">4.8h</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollAnimatedSection className="text-center mb-16">
            <h3 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Tudo que você precisa</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Recursos poderosos projetados para negócios de agendamento modernos
            </p>
          </ScrollAnimatedSection>

          <StaggeredCards columns={3}>
            {[
              { icon: Calendar, title: "Agendamentos", desc: "Gerencie agendamentos com facilidade, evite conflitos e otimize o tempo dos profissionais." },
              { icon: Users, title: "Gestão de Clientes", desc: "Mantenha histórico completo de clientes, agendamentos e serviços em um só lugar." },
              { icon: BarChart3, title: "Relatórios", desc: "Analise dados, acompanhe desempenho e tome decisões baseadas em informações reais." },
              { icon: CreditCard, title: "Financeiro Inteligente", desc: "Controle pagamentos, descontos e presença automaticamente. Relatórios diários, semanais e mensais com gráficos e visão completa do fluxo de caixa." },
              { icon: Clock, title: "Eficiência", desc: "Economize tempo com automação e processos otimizados para seu negócio." },
              { icon: Shield, title: "Segurança", desc: "Dados protegidos com criptografia e conformidade com regulamentações de saúde." },
              { icon: Zap, title: "Rápido", desc: "Interface responsiva e rápida que funciona perfeitamente em qualquer dispositivo." },
            ].map((feature) => {
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

      <section className="py-20 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollAnimatedSection className="text-center mb-16">
            <motion.div className="inline-block mb-4 px-4 py-2 bg-secondary/20 rounded-full border-2 border-secondary" initial={{ scale: 0.95 }} whileInView={{ scale: 1 }} transition={{ duration: 0.5 }}>
              <p className="text-sm font-semibold text-foreground">💎 Planos Premium</p>
            </motion.div>
            <h3 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">Escolha o Plano Ideal</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transparência total. Sem taxas ocultas. Cancele quando quiser.
            </p>
          </ScrollAnimatedSection>

          <motion.div className="grid md:grid-cols-3 gap-8 mb-12" initial="hidden" whileInView="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.15 } } }} viewport={{ once: true }}>
            {PRODUCTS.map((product) => (
              <motion.div key={product.id} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}>
                <Card
                  className={`relative p-8 border-2 transition-all duration-300 hover:shadow-2xl ${product.planType === "premium"
                    ? "border-secondary bg-gradient-to-br from-secondary/10 via-background to-primary/5 md:scale-105 shadow-xl"
                    : "border-border hover:border-primary bg-card"
                    }`}
                >
                  {product.planType === "premium" && (
                    <motion.div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 }}>
                      <Star className="w-4 h-4 fill-current" />
                      Mais Popular
                    </motion.div>
                  )}

                  <div className="mb-6">
                    <h4 className="text-2xl font-bold text-foreground mb-2">{product.name}</h4>
                    <p className="text-muted-foreground text-sm leading-relaxed">{product.description}</p>
                  </div>

                  <div className="mb-8">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold text-primary">
                        R$ {(product.priceInCents / 100).toFixed(0)}
                      </span>
                      <div className="flex flex-col">
                        <span className="text-sm text-muted-foreground">
                          {product.billingCycle === "monthly" ? "/mês" : "único"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={onSignupClick}
                    className={`w-full mb-8 h-12 text-base font-semibold transition-all ${product.planType === "premium"
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                  >
                    Escolher {product.name}
                  </Button>

                  <div className="space-y-4">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Recursos Inclusos
                    </div>
                    {product.features.map((feature, idx) => (
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
              Comparar Planos em Detalhes
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} viewport={{ once: true }}>
              <h3 className="text-3xl sm:text-4xl font-bold text-foreground mb-6">Por que escolher ViraWeb?</h3>
              <ul className="space-y-4">
                {[
                  "Reduz tempo administrativo em até 70%",
                  "Aumenta satisfação dos clientes",
                  "Melhora organização do negócio",
                  "Suporte técnico dedicado",
                  "Integração com sistemas existentes",
                  "Backup automático de dados",
                ].map((benefit, i) => (
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
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">Pronto para transformar seu negócio?</h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto text-balance leading-relaxed">
            Escolha seu plano e comece a usar ViraWeb hoje. Veja como podemos melhorar significativamente a gestão do
            seu negócio.
          </p>
          <motion.div className="flex gap-4 justify-center flex-wrap" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }} viewport={{ once: true }}>
            <Button
              size="lg"
              onClick={onSignupClick}
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            >
              Começar Agora
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={onLoginClick}
              className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary bg-transparent"
            >
              Já tenho conta
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
                Gerenciamento completo para negócios de agendamento modernos.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Recursos
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Preços
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Segurança
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Sobre
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Contato
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Privacidade
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    Termos
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-primary transition-colors">
                    LGPD
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2026 ViraWeb. Todos os direitos reservados.</p>
          </div>
        </motion.div>
      </footer>
    </LazyMotion>
  )
}
