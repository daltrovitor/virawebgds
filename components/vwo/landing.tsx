// Hello World
"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react"
import { ArrowRight, ArrowUpRight, Check } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import LanguageToggle from "@/components/language-toggle"
import { VwoLogo } from "@/components/brand/vwo-logo"
import { PRODUCTS } from "@/lib/products"
import { BRAND } from "@/lib/brand"
import { cn } from "@/lib/utils"
import { SmoothScroll } from "./smooth-scroll"
import { CssReveal, KineticLine, Reveal } from "./kinetic-title"
import { MagneticButton } from "./magnetic-button"
import { HeroDemo } from "./hero-demo"
import { FlowSection } from "./flow-section"

export interface VwoLandingProps {
  onStart: () => void
  onLogin: () => void
}

function Header({ onStart, onLogin }: VwoLandingProps) {
  const t = useTranslations("vwo.nav")
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setHidden(y > prev && y > 140)
    setScrolled(y > 8)
  })

  const links = [
    { href: "#produto", label: t("product") },
    { href: "#fluxo", label: t("flow") },
    { href: "#planos", label: t("plans") },
    { href: "#contato", label: t("contact") },
  ]

  return (
    <motion.header
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ type: "spring", stiffness: 320, damping: 34 }}
      className={cn("fixed inset-x-0 top-0 z-50 transition-colors duration-300", scrolled ? "border-b border-hairline bg-background/85 backdrop-blur-md" : "bg-transparent")}
    >
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-8">
        <a href="#topo" className="shrink-0" title={t("home")}>
          <VwoLogo variant="stacked" animate="mount" markClassName="w-8 sm:w-9" />
        </a>
        <nav aria-label={t("label")} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="group relative px-3 py-3 text-[14px] font-medium text-ink-soft transition-colors hover:text-ink">
              {l.label}
              <span className="absolute inset-x-3 bottom-2 h-px origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" aria-hidden />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <LanguageToggle variant="compact" className="hidden sm:flex" />
          <button type="button" onClick={onLogin} className="h-11 px-2 text-[14px] font-medium text-ink-soft hover:text-ink sm:px-3">
            {t("login")}
          </button>
          <button type="button" onClick={onStart} className="h-11 rounded-sm bg-primary px-4 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-5">
            {t("start")}
          </button>
        </div>
      </div>
    </motion.header>
  )
}

function Hero({ onStart }: Pick<VwoLandingProps, "onStart">) {
  const t = useTranslations("vwo.hero")
  const locale = useLocale()
  return (
    <section id="topo" aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* Linhas-guia da grade áurea (decorativas, só em telas largas) */}
      <div className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden>
        <div className="mx-auto h-full max-w-[1320px] px-8">
          <div className="relative h-full">
            <span className="absolute inset-y-0 left-[61.8%] w-px bg-hairline" />
            <span className="absolute inset-x-0 top-[61.8%] h-px bg-hairline" />
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-4 pb-20 pt-28 sm:px-8 sm:pt-36 lg:min-h-[100svh] lg:grid-cols-[1.618fr_1fr] lg:gap-10 lg:pb-16 lg:pt-28">
        <div className="min-w-0">
          <h1 id="hero-title" className="font-display text-[clamp(2.6rem,7.2vw,6.1rem)] font-bold leading-[0.98] tracking-[-0.045em] text-ink">
            <KineticLine text={t("titleA")} className="block" delay={0.05} trigger="css" />
            <KineticLine text={t("titleB")} className="block font-light text-primary" delay={0.25} trigger="css" />
          </h1>
          <CssReveal delay={0.45} className="mt-7 max-w-[34rem] text-[clamp(1rem,1.35vw,1.2rem)] leading-relaxed text-ink-soft">
            <p>{t("lead")}</p>
          </CssReveal>
          <CssReveal delay={0.6} className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <MagneticButton onClick={onStart} className="h-14 gap-2 rounded-sm bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_18px_40px_-20px_rgba(3,105,161,0.75)] hover:bg-primary/90">
              {t("primary")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
            <a href={`/${locale}/demo`} className="group inline-flex h-14 items-center justify-center gap-2 rounded-sm border border-border px-6 text-[15px] font-semibold text-ink transition-colors hover:border-ink/40">
              {t("secondary")}
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
            </a>
          </CssReveal>
          <CssReveal delay={0.75} className="mt-10">
            <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {[t("meta1"), t("meta2"), t("meta3")].map((m) => (
                <li key={m} className="flex items-center gap-2">
                  <span className="h-px w-4 bg-border" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </CssReveal>
        </div>
        <div className="min-w-0">
          <HeroDemo />
        </div>
      </div>
    </section>
  )
}

function Fact({ value, label, index }: { value: number; label: string; index: number }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)
  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, value, { duration: 1.1, delay: index * 0.08, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(Math.round(v)) })
    return () => controls.stop()
  }, [inView, reduce, value, index])
  return (
    <div className="border-t border-border pt-6">
      <p ref={ref} className="font-display text-[clamp(3rem,6vw,4.8rem)] font-semibold leading-none tracking-[-0.05em] text-ink tabular" aria-label={String(value)}>
        {display}
      </p>
      <p className="mt-3 max-w-[16rem] text-[14.5px] leading-snug text-ink-soft">{label}</p>
    </div>
  )
}

function Facts() {
  const t = useTranslations("vwo.facts")
  const facts = [1, 2, 3, 4].map((n) => ({ value: Number(t(`f${n}Value`)), label: t(`f${n}Label`) }))
  return (
    <section aria-labelledby="facts-title" className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8 lg:py-32">
      <h2 id="facts-title" className="max-w-2xl font-display text-[clamp(1.7rem,3vw,2.6rem)] font-semibold leading-tight tracking-[-0.03em] text-ink">
        <KineticLine text={t("title")} trigger="inView" />
      </h2>
      <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        {facts.map((f, i) => (
          <Fact key={f.label} value={f.value} label={f.label} index={i} />
        ))}
      </div>
    </section>
  )
}

function Modules() {
  const t = useTranslations("vwo.modules")
  const items = Array.from({ length: 9 }, (_, i) => ({ name: t(`m${i + 1}`), desc: t(`m${i + 1}d`) }))
  return (
    <section id="produto" aria-labelledby="modules-title" className="border-t border-hairline">
      <div className="mx-auto grid max-w-[1320px] gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.618fr] lg:gap-16 lg:py-32">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="modules-title" className="font-display text-[clamp(1.9rem,3.6vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink text-balance">
            <KineticLine text={t("title")} trigger="inView" />
          </h2>
          <Reveal as="p" className="mt-5 max-w-md text-[15.5px] leading-relaxed text-ink-soft">
            {t("lead")}
          </Reveal>
        </div>
        <ul className="border-t border-border">
          {items.map((m, i) => (
            <Reveal as="li" key={m.name} delay={Math.min(i, 5) * 0.04} className="group relative border-b border-border">
              <div className="grid grid-cols-[48px_1fr] gap-x-4 py-6 sm:grid-cols-[64px_1fr_1.3fr] sm:items-baseline sm:gap-x-8">
                <span className="font-display text-[13px] font-semibold tabular text-muted-foreground transition-colors group-hover:text-primary">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-[clamp(1.15rem,1.8vw,1.5rem)] font-semibold tracking-[-0.02em] text-ink transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5">{m.name}</h3>
                <p className="col-start-2 mt-1.5 text-[14.5px] leading-relaxed text-ink-soft sm:col-start-3 sm:mt-0">{m.desc}</p>
              </div>
              <span className="absolute bottom-[-1px] left-0 h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" aria-hidden />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Pricing({ onStart }: Pick<VwoLandingProps, "onStart">) {
  const t = useTranslations("vwo.pricing")
  const tProducts = useTranslations("products")
  const plans = PRODUCTS.map((p) => ({
    id: p.planType,
    name: tProducts(`${p.planType}.name`),
    description: tProducts(`${p.planType}.description`),
    price: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.priceInCents / 100),
    features: Object.values(tProducts.raw(`${p.planType}.features`) as Record<string, string>).slice(0, 6),
  }))
  return (
    <section id="planos" aria-labelledby="pricing-title" className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-24 sm:px-8 lg:py-32">
        <div className="grid gap-6 lg:grid-cols-[1.618fr_1fr] lg:items-end">
          <h2 id="pricing-title" className="font-display text-[clamp(1.9rem,3.6vw,3.1rem)] font-semibold leading-[1.04] tracking-[-0.03em] text-ink">
            <KineticLine text={t("title")} trigger="inView" />
          </h2>
          <Reveal as="p" className="text-[15.5px] leading-relaxed text-ink-soft">
            {t("lead")}
          </Reveal>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => {
            const featured = plan.id === "premium"
            return (
              <Reveal key={plan.id} delay={i * 0.08}>
                <article className={cn("flex h-full flex-col rounded-md border bg-background p-7 transition-shadow duration-500 hover:shadow-[0_30px_60px_-40px_rgba(15,31,51,0.45)]", featured ? "border-primary" : "border-border")}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{plan.name}</h3>
                    {featured && <span className="rounded-xs border border-primary/30 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{t("popular")}</span>}
                  </div>
                  <p className="mt-2 text-[14px] text-ink-soft">{plan.description}</p>
                  <p className="mt-7 font-display text-[2.4rem] font-semibold leading-none tracking-[-0.04em] text-ink tabular">
                    {plan.price}
                    <span className="ml-1 text-[14px] font-medium tracking-normal text-muted-foreground">/ {t("perMonth")}</span>
                  </p>
                  <ul className="mt-7 flex-1 space-y-3 border-t border-hairline pt-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[14px] text-ink-soft">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={onStart}
                    className={cn("mt-8 h-12 rounded-sm text-[14.5px] font-semibold transition-colors", featured ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border text-ink hover:border-ink/40")}
                  >
                    {t("choose")}
                  </button>
                </article>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ClosingCta({ onStart, onLogin }: VwoLandingProps) {
  const t = useTranslations("vwo.cta")
  return (
    <section id="contato" aria-labelledby="cta-title" className="border-t border-hairline">
      <div className="mx-auto grid max-w-[1320px] gap-14 px-4 py-24 sm:px-8 lg:grid-cols-[1.618fr_1fr] lg:py-32">
        <div>
          <h2 id="cta-title" className="font-display text-[clamp(2.2rem,5.2vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.045em] text-ink text-balance">
            <KineticLine text={t("title")} trigger="inView" />
          </h2>
          <Reveal as="p" className="mt-6 max-w-xl text-[16px] leading-relaxed text-ink-soft">
            {t("lead")}
          </Reveal>
          <Reveal className="mt-9 flex flex-col gap-3 sm:flex-row">
            <MagneticButton onClick={onStart} className="h-14 gap-2 rounded-sm bg-primary px-7 text-[15px] font-semibold text-primary-foreground hover:bg-primary/90">
              {t("primary")}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </MagneticButton>
            <button type="button" onClick={onLogin} className="h-14 rounded-sm border border-border px-6 text-[15px] font-semibold text-ink hover:border-ink/40">
              {t("secondary")}
            </button>
          </Reveal>
        </div>
        <Reveal className="self-end border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <p className="font-display text-[15px] font-semibold text-ink">{t("talk")}</p>
          <ul className="mt-4 space-y-1">
            <li>
              <a href={`https://wa.me/${BRAND.whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="group flex min-h-12 items-center justify-between gap-3 border-b border-hairline text-[15px] text-ink-soft hover:text-ink">
                <span>
                  <span className="text-muted-foreground">{t("whatsapp")} · </span>
                  {BRAND.whatsappDisplay}
                </span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </a>
            </li>
            <li>
              <a href={`mailto:${BRAND.supportEmail}`} className="group flex min-h-12 items-center justify-between gap-3 border-b border-hairline text-[15px] text-ink-soft hover:text-ink">
                <span>
                  <span className="text-muted-foreground">{t("email")} · </span>
                  {BRAND.supportEmail}
                </span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </a>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  const t = useTranslations("vwo.footer")
  const locale = useLocale()
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-4 py-12 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-between gap-4">
          <VwoLogo variant="inline" markClassName="w-7" />
          <LanguageToggle variant="compact" className="sm:hidden" />
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-2 gap-y-1">
          {[
            { href: `/${locale}/demo`, label: t("demo") },
            { href: `/${locale}/termos`, label: t("terms") },
            { href: `/${locale}/privacidade`, label: t("privacy") },
            { href: `/${locale}/lgpd`, label: t("lgpd") },
          ].map((l) => (
            <a key={l.href} href={l.href} className="inline-flex min-h-11 items-center px-2 text-[13.5px] text-ink-soft hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <p className="text-[13px] text-muted-foreground">
          © 2026 {BRAND.company}. {t("rights")}
        </p>
      </div>
    </footer>
  )
}

/** Landing Vira Web Odonto — composição em Proporção Áurea (61,8 / 38,2), rolagem Lenis + GSAP + Motion. */
export default function VwoLanding({ onStart, onLogin }: VwoLandingProps) {
  return (
    <SmoothScroll>
      <div className="min-h-screen overflow-x-clip bg-background text-foreground">
        <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">
          Pular para o conteúdo
        </a>
        <Header onStart={onStart} onLogin={onLogin} />
        <main id="conteudo">
          <Hero onStart={onStart} />
          <FlowSection />
          <Facts />
          <Modules />
          <Pricing onStart={onStart} />
          <ClosingCta onStart={onStart} onLogin={onLogin} />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  )
}
